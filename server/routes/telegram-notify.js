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
    const { ownerId, message } = req.body || {};
    if (!ownerId || !message) {
      return res.status(400).json({ error: "Missing ownerId or message" });
    }

    const apiKeys = db.getAll('api_keys');
    const keyDoc = apiKeys.find(k => k.ownerId === ownerId || k.id === ownerId);
    if (!keyDoc) {
      return res.status(403).json({ error: "Owner API keys not found" });
    }

    const botToken = keyDoc.telegramBotToken;
    // 🎯 CHỈ gửi vào nhóm, không gửi riêng
    const chatId = keyDoc.telegramGroupChatId;

    if (!botToken || keyDoc.enabled !== true) {
      return res.status(403).json({ error: "Invalid or disabled bot token" });
    }
    if (!chatId) {
      return res.status(400).json({ error: "Chưa cấu hình Telegram Group Chat ID" });
    }

    try {
      await sendTelegramMessage(botToken, chatId, message);
    } catch (teleErr) {
      console.error("Failed to send Telegram message:", teleErr.message);
      return res.status(500).json({ error: "Failed to send Telegram message", details: teleErr.message });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("Telegram Notify error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}

export { handler as default };
