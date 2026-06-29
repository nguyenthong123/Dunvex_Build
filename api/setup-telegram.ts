import crypto from 'crypto';

/**
 * Vercel Serverless: POST /api/setup-telegram
 * Thiết lập Telegram Bot Webhook trực tiếp.
 */

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

async function restUpdate(token: string, path: string, fields: any) {
  const res = await fetch(`${FIRESTORE_BASE}/${path}?updateMask.fieldPaths=${Object.keys(fields).join('&updateMask.fieldPaths=')}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  return res.json();
}

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const apiKey = req.headers['x-api-key'] || req.headers['X-Api-Key'];
  if (!apiKey) return res.status(401).json({ error: 'Missing x-api-key header' });

  try {
    const { ownerId, botToken } = req.body;
    if (!ownerId) return res.status(400).json({ error: 'Missing ownerId' });

    const token = await getAccessToken();

    // Verify API key
    const keyDoc = await restGet(token, `api_keys/${ownerId}`);
    if (!keyDoc) return res.status(403).json({ error: 'API key not found' });
    const kf = keyDoc.fields || {};
    if (kf.enabled?.booleanValue !== true || kf.key?.stringValue !== apiKey) {
      return res.status(403).json({ error: 'Invalid or disabled API key' });
    }

    // Determine host to set webhook url
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const webhookUrl = `${protocol}://${host}/api/telegram-webhook?ownerId=${ownerId}`;

    if (botToken) {
      // Set webhook with Telegram
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      const tgData = await tgRes.json();
      
      if (!tgData.ok) {
        return res.status(400).json({ error: 'Lỗi từ Telegram: ' + tgData.description });
      }

      // Update Firestore with the bot token
      kf.telegramBotToken = { stringValue: botToken };
      await restUpdate(token, `api_keys/${ownerId}`, kf);
      
      return res.status(200).json({ success: true, message: 'Đã kết nối Telegram Bot thành công!' });
    } else {
      // Disconnect webhook
      if (kf.telegramBotToken?.stringValue) {
        await fetch(`https://api.telegram.org/bot${kf.telegramBotToken.stringValue}/deleteWebhook`);
      }
      
      // Remove token from Firestore
      delete kf.telegramBotToken;
      await restUpdate(token, `api_keys/${ownerId}`, kf);
      
      return res.status(200).json({ success: true, message: 'Đã ngắt kết nối Telegram Bot.' });
    }

  } catch (error: any) {
    console.error('Setup telegram error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
