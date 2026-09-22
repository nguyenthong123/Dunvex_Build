import * as db from '../db.js';
import { sendTelegramMessage } from '../telegram-helper.js';

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { ownerId, message, eventType = 'generic', data = {} } = req.body || {};
    if (!ownerId) {
      return res.status(400).json({ error: "Missing ownerId" });
    }

    const apiKeys = db.getAll('api_keys');
    const keyDoc = apiKeys.find(k => k.ownerId === ownerId || k.id === ownerId);
    if (!keyDoc) {
      return res.status(403).json({ error: "Owner API keys not found" });
    }

    const botToken = keyDoc.telegramBotToken;
    const chatId = keyDoc.telegramGroupChatId || keyDoc.telegramChatId;

    if (!botToken || keyDoc.enabled !== true) {
      return res.status(403).json({ error: "Invalid or disabled bot token" });
    }
    if (!chatId) {
      return res.status(400).json({ error: "Chưa cấu hình Telegram Group Chat ID" });
    }

    // ── KIỂM TRA CÔNG TẮC BẬT/TẮT TỪNG LOẠI THÔNG BÁO ──
    if (eventType === 'order' && keyDoc.notifyNewOrder === false) {
      return res.status(200).json({ success: true, skipped: true, reason: "Đã tắt thông báo đơn hàng" });
    }
    if (eventType === 'attendance' && keyDoc.notifyAttendance === false) {
      return res.status(200).json({ success: true, skipped: true, reason: "Đã tắt thông báo chấm công" });
    }
    if (eventType === 'site_checkin' && keyDoc.notifySiteCheckin === false) {
      return res.status(200).json({ success: true, skipped: true, reason: "Đã tắt thông báo checkin công trình" });
    }
    if (eventType === 'debt_payment' && keyDoc.notifyDebtPayment === false) {
      return res.status(200).json({ success: true, skipped: true, reason: "Đã tắt thông báo thu nợ" });
    }
    if (eventType === 'leave_request' && keyDoc.notifyLeaveRequest === false) {
      return res.status(200).json({ success: true, skipped: true, reason: "Đã tắt thông báo nghỉ phép" });
    }
    if (eventType === 'eod_report' && keyDoc.notifyEodReport === false) {
      return res.status(200).json({ success: true, skipped: true, reason: "Đã tắt thông báo báo cáo cuối ngày" });
    }

    // ── ĐIỀU PHỐI QUA N8N ALERT HUB (CHUẨN N8N ENGINE) ──
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
      }
    } catch (n8nErr) {
      console.warn('[n8n Webhook] Fetch error:', n8nErr.message);
    }

    // Dự phòng nếu n8n gián đoạn
    if (!n8nSuccess && message) {
      try {
        await sendTelegramMessage(botToken, chatId, message);
      } catch (teleErr) {
        console.error("Failed to send Telegram message fallback:", teleErr.message);
      }
    }

    return res.status(200).json({ success: true, n8nDispatched: n8nSuccess });

  } catch (error) {
    console.error("Telegram Notify error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}

export { handler as default };

