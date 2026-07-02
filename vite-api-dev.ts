/**
 * Vite Dev Server API Handler
 * Xử lý /api/gemini-proxy và /api/gemini-vision trong dev mode
 * (trên production Vercel dùng serverless functions trong api/)
 */
import type { Plugin, ViteDevServer } from 'vite';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import crypto from 'crypto';

function getEnvVar(key: string): string {
	if (process.env[key]) return process.env[key] as string;
	
	try {
		const dotenv = require('dotenv');
		const result = dotenv.config({ path: resolve(process.cwd(), '.env') });
		if (result.parsed?.[key]) return result.parsed[key];
	} catch {}
	
	const envPath = resolve(process.cwd(), '.env');
	if (existsSync(envPath)) {
		const envContent = readFileSync(envPath, 'utf-8');
		// Handle keys that might have = inside their value
		const regex = new RegExp(`^${key}=(.*)$`, 'm');
		const match = envContent.match(regex);
		if (match) {
			let val = match[1].trim();
			if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
			else if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
			return val;
		}
	}
	
	return '';
}

function getApiKey(): string {
	return getEnvVar('GEMINI_API_KEY');
}

const PROJECT_ID = 'dunvex-89461';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function getFirebaseAccessToken(): Promise<string> {
	const json = getEnvVar('FIREBASE_SERVICE_ACCOUNT');
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
	const td: any = await tokenRes.json();
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

async function handleGeminiProxy(body: any): Promise<{ status: number; data: any }> {
	const API_KEY = getApiKey();
	if (!API_KEY) {
		return { status: 500, data: { error: 'GEMINI_API_KEY not configured' } };
	}

	const { prompt } = body;
	if (!prompt) {
		return { status: 400, data: { error: 'Missing prompt' } };
	}

	try {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${API_KEY}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [{ parts: [{ text: prompt }] }],
					generationConfig: {
						responseMimeType: 'application/json',
						temperature: 0.1,
					},
				}),
			}
		);

		const data: any = await response.json();

		if (!response.ok) {
			const errMsg = data?.error?.message || `Gemini API error ${response.status}`;
			console.error('[dev-api] Gemini proxy error:', errMsg);
			return { status: response.status, data: { error: errMsg } };
		}

		const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
		return { status: 200, data: { text } };
	} catch (error: any) {
		console.error('[dev-api] Proxy error:', error);
		return { status: 500, data: { error: error.message || 'Internal error' } };
	}
}

async function handleGeminiVision(body: any): Promise<{ status: number; data: any }> {
	const API_KEY = getApiKey();
	if (!API_KEY) {
		return { status: 500, data: { error: 'GEMINI_API_KEY not configured' } };
	}

	const { prompt, images } = body;
	if (!prompt || !images?.length) {
		return { status: 400, data: { error: 'Missing prompt or images' } };
	}

	try {
		const parts: any[] = [{ text: prompt }];
		for (const img of images) {
			parts.push({
				inlineData: { mimeType: img.mimeType, data: img.base64 },
			});
		}

		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${API_KEY}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [{ parts }],
					generationConfig: {
						responseMimeType: 'application/json',
						temperature: 0.1,
					},
				}),
			}
		);

		const data: any = await response.json();

		if (!response.ok) {
			const errMsg = data?.error?.message || `Gemini Vision API error ${response.status}`;
			console.error('[dev-api] Vision error:', errMsg);
			return { status: response.status, data: { error: errMsg } };
		}

		let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
		text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
		return { status: 200, data: { text } };
	} catch (error: any) {
		console.error('[dev-api] Vision error:', error);
		return { status: 500, data: { error: error.message || 'Internal error' } };
	}
}

export function devApiPlugin(): Plugin {
	return {
		name: 'dev-api-proxy',
		configureServer(server: ViteDevServer) {
			server.middlewares.use('/api/gemini-proxy', async (req: any, res: any) => {
				if (req.method === 'OPTIONS') {
					res.writeHead(200);
					res.end();
					return;
				}
				if (req.method !== 'POST') {
					res.writeHead(405).end(JSON.stringify({ error: 'Method not allowed' }));
					return;
				}
				const chunks: Buffer[] = [];
				req.on('data', (chunk: Buffer) => chunks.push(chunk));
				req.on('end', async () => {
					try {
						const body = JSON.parse(Buffer.concat(chunks).toString());
						const result = await handleGeminiProxy(body);
						res.writeHead(result.status, { 
							'Content-Type': 'application/json',
							'Access-Control-Allow-Origin': '*',
						});
						res.end(JSON.stringify(result.data));
					} catch {
						res.writeHead(400).end(JSON.stringify({ error: 'Invalid JSON' }));
					}
				});
			});

			server.middlewares.use('/api/gemini-vision', async (req: any, res: any) => {
				if (req.method === 'OPTIONS') {
					res.writeHead(200);
					res.end();
					return;
				}
				if (req.method !== 'POST') {
					res.writeHead(405).end(JSON.stringify({ error: 'Method not allowed' }));
					return;
				}
				const chunks: Buffer[] = [];
				req.on('data', (chunk: Buffer) => chunks.push(chunk));
				req.on('end', async () => {
					try {
						const body = JSON.parse(Buffer.concat(chunks).toString());
						const result = await handleGeminiVision(body);
						res.writeHead(result.status, { 
							'Content-Type': 'application/json',
							'Access-Control-Allow-Origin': '*',
						});
						res.end(JSON.stringify(result.data));
					} catch {
						res.writeHead(400).end(JSON.stringify({ error: 'Invalid JSON' }));
					}
				});
			});

			// Mock /api/setup-telegram cho môi trường local dev
			server.middlewares.use('/api/setup-telegram', async (req: any, res: any) => {
				if (req.method === 'OPTIONS') {
					res.writeHead(200);
					res.end();
					return;
				}
				if (req.method !== 'POST') {
					res.writeHead(405).end(JSON.stringify({ error: 'Method not allowed' }));
					return;
				}
				
				const chunks: Buffer[] = [];
				req.on('data', (chunk: Buffer) => chunks.push(chunk));
				req.on('end', async () => {
					try {
						const body = JSON.parse(Buffer.concat(chunks).toString());
						// Gắn body vào req để tương thích với Vercel API
						req.body = body;
						
						// Tạo mock cho res.status().json()
						res.status = (statusCode: number) => {
							res.statusCode = statusCode;
							return res;
						};
						res.json = (data: any) => {
							res.writeHead(res.statusCode || 200, {
								'Content-Type': 'application/json',
								'Access-Control-Allow-Origin': '*',
							});
							res.end(JSON.stringify(data));
						};

						// Gọi trực tiếp logic thay vì require file ts
						try {
							const { ownerId, botToken } = body;
							const apiKey = req.headers['x-api-key'] || req.headers['X-Api-Key'];
							if (!ownerId) return res.status(400).json({ error: 'Missing ownerId' });
							if (!apiKey) return res.status(401).json({ error: 'Missing x-api-key header' });

							const token = await getFirebaseAccessToken();
							const keyDoc = await restGet(token, `api_keys/${ownerId}`);
							if (!keyDoc) return res.status(403).json({ error: 'API key not found' });
							const kf = keyDoc.fields || {};
							if (kf.enabled?.booleanValue !== true || kf.key?.stringValue !== apiKey) {
								return res.status(403).json({ error: 'Invalid or disabled API key' });
							}

							const protocol = req.headers['x-forwarded-proto'] || 'http';
							const host = req.headers.host;
							const webhookUrl = `${protocol}://${host}/api/telegram-webhook?ownerId=${ownerId}`;

							if (botToken) {
								const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
								const tgData = await tgRes.json();
								
								if (!tgData.ok) {
									return res.status(400).json({ error: 'Lỗi từ Telegram: ' + tgData.description });
								}

								kf.telegramBotToken = { stringValue: botToken };
								await restUpdate(token, `api_keys/${ownerId}`, kf);
								return res.status(200).json({ success: true, message: 'Đã kết nối Telegram Bot thành công!' });
							} else {
								if (kf.telegramBotToken?.stringValue) {
									await fetch(`https://api.telegram.org/bot${kf.telegramBotToken.stringValue}/deleteWebhook`);
								}
								delete kf.telegramBotToken;
								await restUpdate(token, `api_keys/${ownerId}`, kf);
								return res.status(200).json({ success: true, message: 'Đã ngắt kết nối Telegram Bot.' });
							}
						} catch (importErr: any) {
							console.error('[dev-api] Error processing setup-telegram:', importErr);
							res.status(500).json({ error: 'Lỗi môi trường Dev: ' + importErr.message });
						}
					} catch (e) {
						res.writeHead(400).end(JSON.stringify({ error: 'Invalid JSON' }));
					}
				});
			});

			console.log('[dev-api] ✅ Gemini proxy ready at /api/gemini-proxy + /api/gemini-vision');
			console.log('[dev-api] ✅ Setup Telegram API mocked at /api/setup-telegram');
		},
	};
}
