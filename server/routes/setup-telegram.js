import * as db from '../db.js';

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { ownerId, botToken, telegramChatId } = req.body || {};
    if (!ownerId) return res.status(400).json({ error: "Missing ownerId" });

    const apiKeys = db.getAll('api_keys');
    const keyDoc = apiKeys.find(k => (k.ownerId === ownerId || k.id === ownerId) && k.enabled === true);
    if (!keyDoc) return res.status(403).json({ error: "API key not found for this owner" });

    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host;
    const webhookUrl = `${protocol}://${host}/api/telegram-webhook?ownerId=${ownerId}`;

    if (botToken) {
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      const tgData = await tgRes.json();

      if (!tgData.ok) {
        return res.status(400).json({ error: "Lỗi từ Telegram: " + tgData.description });
      }

      const isGroup = telegramChatId && telegramChatId.trim().startsWith('-');
      db.update('api_keys', keyDoc.id, {
        telegramBotToken: botToken,
        telegramChatId: isGroup ? '' : (telegramChatId || ''),
        telegramGroupChatId: isGroup ? (telegramChatId || '') : '',
        updatedAt: new Date().toISOString()
      });

      return res.status(200).json({ success: true, message: "Đã kết nối Telegram Bot thành công!" });

    } else {
      if (keyDoc.telegramBotToken) {
        await fetch(`https://api.telegram.org/bot${keyDoc.telegramBotToken}/deleteWebhook`);
        db.update('api_keys', keyDoc.id, {
          telegramBotToken: '',
          telegramChatId: '',
          telegramGroupChatId: '',
          updatedAt: new Date().toISOString()
        });
      }

      return res.status(200).json({ success: true, message: "Đã ngắt kết nối Telegram Bot." });
    }

  } catch (error) {
    console.error("Setup telegram error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}

export { handler as default };
