import crypto from 'crypto';

const PROJECT_ID = 'dunvex-89461';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function getAccessToken(): Promise<string> {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!json) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT env');
  const sa = JSON.parse(json);

  const header = { alg: 'RS256', typ: 'JWT', kid: sa.private_key_id };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email, sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore',
  };

  const b64obj = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const sign = (pk: string, data: string) => {
    return crypto.createSign('RSA-SHA256').update(data).sign(pk, 'base64url');
  };
  const partial = `${b64obj(header)}.${b64obj(claim)}`;
  const jwt = `${partial}.${sign(sa.private_key, partial)}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const td = await tokenRes.json();
  if (td.error) throw new Error(`Auth: ${td.error_description || td.error}`);
  return td.access_token;
}

async function restGet(token: string, path: string) {
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore GET ${path}: ${res.status}`);
  return res.json();
}

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { ownerId, message } = req.body;
    if (!ownerId || !message) {
      return res.status(400).json({ error: 'Missing ownerId or message' });
    }

    const token = await getAccessToken();

    // Lấy API Key doc để tìm telegramBotToken và telegramChatId
    const keyDoc = await restGet(token, `api_keys/${ownerId}`);
    if (!keyDoc) {
      return res.status(403).json({ error: 'Owner API keys not found' });
    }
    const kf = keyDoc.fields || {};
    const botToken = kf.telegramBotToken?.stringValue;
    const chatId = kf.telegramGroupChatId?.stringValue || kf.telegramChatId?.stringValue;
    
    if (!botToken || kf.enabled?.booleanValue !== true) {
      return res.status(403).json({ error: 'Invalid or disabled bot token' });
    }
    if (!chatId) {
      // Người dùng chưa chat với bot bao giờ nên chưa lấy được chatId
      return res.status(400).json({ error: 'Telegram Chat ID not found. User needs to chat with the bot first.' });
    }

    // Gửi tin nhắn Telegram
    const teleRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });

    if (!teleRes.ok) {
      const err = await teleRes.text();
      console.error('Failed to send Telegram message:', err);
      return res.status(500).json({ error: 'Failed to send Telegram message', details: err });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Telegram Notify error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
