import * as db from '../db.js';

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, x-owner-id");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed. Use GET." });

  const apiKey = req.headers["x-api-key"] || req.headers["X-Api-Key"];
  const ownerId = req.headers["x-owner-id"] || req.headers["X-Owner-Id"];
  if (!apiKey) return res.status(401).json({ error: "Missing x-api-key header" });
  if (!ownerId) return res.status(400).json({ error: "Missing x-owner-id header" });

  try {
    // Verify API key
    const apiKeys = db.getAll('api_keys');
    const keyDoc = apiKeys.find(k => (k.ownerId === ownerId || k.id === ownerId) && k.enabled === true && k.key === apiKey);
    if (!keyDoc) return res.status(403).json({ error: "Invalid or disabled API key" });

    const products = db.getAll('products', {
      where: [{ field: 'ownerId', op: '==', value: ownerId }],
      limit: 500
    });

    const mapped = products.map(p => ({
      id: p.id,
      name: p.name || '',
      category: p.category || p.categories || '',
      priceSell: Number(p.priceSell || 0),
      priceImport: Number(p.priceImport || 0),
      unit: p.unit || '',
      weight: p.density || p.weight || '',
      stock: Number(p.stock || 0),
      articleNo: p.articleNo || p.sku || '',
      specification: p.specification || '',
      packaging: p.packaging || ''
    }));

    return res.status(200).json({ success: true, total: mapped.length, products: mapped });

  } catch (error) {
    console.error("Products API error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}

export { handler as default };
