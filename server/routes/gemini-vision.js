const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured on server" });
  }
  try {
    const { prompt, images, imageBase64, mimeType } = req.body;
    let parts = [{ text: prompt }];
    if (images && Array.isArray(images)) {
      for (const img of images) {
        parts.push({ inline_data: { mime_type: img.mimeType || "image/jpeg", data: img.base64 } });
      }
    } else if (imageBase64) {
      parts.push({ inline_data: { mime_type: mimeType || "image/jpeg", data: imageBase64 } });
    } else {
      return res.status(400).json({ error: "Missing images or imageBase64" });
    }
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
            maxOutputTokens: 2048
          }
        }),
        signal: AbortSignal.timeout(9e3)
      }
    );
    const data = await response.json();
    if (!response.ok) {
      const errMsg = data?.error?.message || `Gemini Vision API error ${response.status}`;
      console.error("Vision proxy error:", errMsg);
      return res.status(response.status).json({ error: errMsg });
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return res.status(200).json({ text });
  } catch (error) {
    console.error("Vision proxy error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
export {
  handler as default
};
