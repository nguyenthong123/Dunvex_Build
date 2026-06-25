import type { VercelRequest, VercelResponse } from '@vercel/node';

// Server-side only — ưu tiên GEMINI_API_KEY, fallback VITE_GEMINI_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
  }

  try {
    const { prompt, images, imageBase64, mimeType } = req.body;
    
    // Hỗ trợ cả single image (cũ) và multi images (mới)
    let parts: any[] = [{ text: prompt }];
    
    if (images && Array.isArray(images)) {
      // Multi-image mode
      for (const img of images) {
        parts.push({ inline_data: { mime_type: img.mimeType || 'image/jpeg', data: img.base64 } });
      }
    } else if (imageBase64) {
      // Single image mode (backward compatible)
      parts.push({ inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } });
    } else {
      return res.status(400).json({ error: 'Missing images or imageBase64' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: parts,
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
        }),
        signal: AbortSignal.timeout(9000),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || `Gemini Vision API error ${response.status}`;
      console.error('Vision proxy error:', errMsg);
      return res.status(response.status).json({ error: errMsg });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return res.status(200).json({ text });
  } catch (error: any) {
    console.error('Vision proxy error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
