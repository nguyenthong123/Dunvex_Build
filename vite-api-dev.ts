/**
 * Vite Dev Server API Handler
 * Xử lý /api/gemini-proxy và /api/gemini-vision trong dev mode
 * (trên production Vercel dùng serverless functions trong api/)
 */
import type { Plugin, ViteDevServer } from 'vite';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function getApiKey(): string {
	// Đọc từ .env (dùng dotenv nếu có, fallback manual parse)
	try {
		const dotenv = require('dotenv');
		const result = dotenv.config({ path: resolve(process.cwd(), '.env') });
		if (result.parsed?.GEMINI_API_KEY) return result.parsed.GEMINI_API_KEY;
	} catch {}
	
	// Fallback: đọc thủ công .env
	const envPath = resolve(process.cwd(), '.env');
	if (existsSync(envPath)) {
		const envContent = readFileSync(envPath, 'utf-8');
		const match = envContent.match(/^GEMINI_API_KEY=(.+)$/m);
		if (match) return match[1].trim();
	}
	
	// Last resort: process.env
	return process.env.GEMINI_API_KEY || '';
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
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
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
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
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

			console.log('[dev-api] ✅ Gemini proxy ready at /api/gemini-proxy + /api/gemini-vision');
		},
	};
}
