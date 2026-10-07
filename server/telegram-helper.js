import * as db from './db.js';

export async function sendTelegramMessage(botToken, chatId, text, options = {}) {
  const parseMode = options.parseMode || "HTML";
  const retries = options.retries ?? 3;
  const timeoutMs = options.timeoutMs ?? 10000; // 10s timeout
  
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: parseMode
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return true;
      }
      
      const errMsg = await response.text();
      // If sending HTML failed due to parsing errors, try sending it as plain text (without HTML tags)
      if (parseMode === "HTML" && errMsg.includes("can't parse entities")) {
        console.warn(`[Telegram Bot] HTML parsing failed: ${errMsg}. Retrying in plain text mode...`);
        const cleanText = text.replace(/<[^>]*>/g, ''); // strip all HTML tags
        return sendTelegramMessage(botToken, chatId, cleanText, { ...options, parseMode: undefined });
      }
      throw new Error(`Telegram API status ${response.status}: ${errMsg}`);
      
    } catch (err) {
      lastError = err;
      const isAbort = err.name === 'AbortError';
      console.warn(`[Telegram Bot] Send message attempt ${attempt}/${retries} failed: ${err.message}. ${isAbort ? 'Timeout expired.' : ''}`);
      if (attempt < retries) {
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, attempt * 500));
      }
    }
  }
  
  throw lastError || new Error("Failed to send Telegram message after retries");
}

export async function dispatchNotification(ownerId, eventType, message, data = {}) {
  try {
    if (!ownerId) return;

    // Find Telegram bot credentials for this owner in api_keys or settings
    const apiKeys = db.getAll('api_keys') || [];
    const settings = db.getAll('settings') || [];
    
    let keyDoc = apiKeys.find(k => (k.ownerId === ownerId || k.id === ownerId) && k.telegramBotToken);
    if (!keyDoc) {
      keyDoc = settings.find(s => (s.id === ownerId || s.ownerId === ownerId) && s.telegramBotToken);
    }
    if (!keyDoc) {
      keyDoc = apiKeys.find(k => k.ownerId === ownerId || k.id === ownerId);
    }
    if (!keyDoc) {
      if (eventType === 'order') {
        console.warn(`[Notification] No Telegram configuration found for order owner ${ownerId}`);
      }
      return;
    }

    if (eventType === 'order' && (keyDoc.enabled === false || keyDoc.notifyNewOrder === false)) return;

    const botToken = keyDoc.telegramBotToken;
    const chatId = keyDoc.telegramGroupChatId || keyDoc.telegramChatId;
    if (!botToken || !chatId) {
      if (eventType === 'order') {
        console.warn(`[Notification] Telegram bot or chat ID is missing for order owner ${ownerId}`);
      }
      return;
    }

    // ── Dispatch via n8n Alert Hub (Chuẩn n8n Engine) ──
    let n8nSuccess = false;
    try {
      const n8nWebhookUrl = process.env.N8N_ALERT_HUB_URL || "https://34-133-127-214.nip.io/webhook/dunvex-events";
      const n8nRes = await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId,
          eventType,
          botToken,
          chatId,
          message,
          data
        }),
        signal: AbortSignal.timeout(5000)
      });
      if (n8nRes.ok) {
        n8nSuccess = true;
      } else {
        console.warn(`[n8n Alert Hub] Notification rejected with status ${n8nRes.status}`);
      }
    } catch (err) {
      console.warn('[n8n Alert Hub] Fetch error:', err.message);
    }

    // Dự phòng: nếu n8n lỗi hoặc không khả dụng, gửi trực tiếp qua Telegram API.
    if (!n8nSuccess && message) {
      await sendTelegramMessage(botToken, chatId, message).catch(e => console.error('[TG Fallback] Send error:', e.message));
    }
  } catch (err) {
    console.error('[Notification] Dispatch error:', err.message);
  }
}

function escapeTelegramHtml(value) {
  return String(value ?? '').replace(/[&<>]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
  })[char]);
}

export async function dispatchNewOrderNotification(ownerId, order, source) {
  if (!ownerId || !order || order.is_deleted || order.deleted) return;

  const orderId = order.id || '';
  const orderCode = order.orderCode || order.order_code || order.code || orderId || 'Chưa có mã';
  const customerName = order.customerName || order.customer_name || order.customer || 'Khách lẻ';
  const totalAmount = Number(order.totalAmount ?? order.total_amount ?? order.total ?? 0);
  const formattedAmount = new Intl.NumberFormat('vi-VN').format(
    Number.isFinite(totalAmount) ? totalAmount : 0,
  );
  const actorName = order.createdByDisplayName || order.createdByEmail || order.createdBy || 'Nhân viên';
  const message = `📦 <b>ĐƠN HÀNG MỚI</b>\n- Mã đơn: <b>${escapeTelegramHtml(orderCode)}</b>\n- Khách hàng: <b>${escapeTelegramHtml(customerName)}</b>\n- Tổng tiền: <b>${formattedAmount} đ</b>\n- Trạng thái: ${escapeTelegramHtml(order.status || 'Mới')}\n- Người lên đơn: ${escapeTelegramHtml(actorName)}`;

  await dispatchNotification(ownerId, 'order', message, {
    orderId,
    orderCode,
    customerName,
    totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
    status: order.status || 'Mới',
    actorName,
    createdAt: order.createdAt || order.created_at || null,
    source,
  });
}
