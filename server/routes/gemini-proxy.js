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
    const { prompt, schema } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
            ...schema ? { responseSchema: schema } : {}
          }
        })
      }
    );
    const data = await response.json();
    if (!response.ok) {
      const errMsg = data?.error?.message || `Gemini API error ${response.status}`;
      console.error("Gemini proxy error:", errMsg);
      return res.status(response.status).json({ error: errMsg });
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return res.status(200).json({ text });
  } catch (error) {
    console.error("Proxy error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
export {
  handler as default
};
