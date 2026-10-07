import * as db from '../db.js';

const randomId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 20; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, x-owner-id");

  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = req.headers["x-api-key"] || req.headers["X-Api-Key"];
  const ownerId = req.headers["x-owner-id"] || req.headers["X-Owner-Id"];
  if (!apiKey) return res.status(401).json({ error: "Missing x-api-key header" });
  if (!ownerId) return res.status(400).json({ error: "Missing x-owner-id header" });

  // Verify API key
  const apiKeys = db.getAll('api_keys');
  const keyDoc = apiKeys.find(k => (k.ownerId === ownerId || k.id === ownerId) && k.enabled === true && k.key === apiKey);
  if (!keyDoc) return res.status(403).json({ error: "Invalid or disabled API key" });

  try {
    if (req.method === "GET") {
      const customers = db.getAll('customers', {
        where: [{ field: 'ownerId', op: '==', value: ownerId }],
        limit: 2000
      });
      return res.status(200).json({ success: true, total: customers.length, customers });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const customerData = req.body;
      const customerId = req.params?.id || req.body.id;

      if (req.method === "PUT") {
        if (!customerId) return res.status(400).json({ error: "Customer ID required for update" });
        const updated = db.update('customers', customerId, {
          ...customerData,
          updatedAt: new Date().toISOString()
        });
        if (!updated) return res.status(404).json({ error: "Customer not found" });
        return res.status(200).json({ success: true });
      }

      // POST - Create or Upsert by email
      if (customerData.email) {
        const existing = db.getAll('customers', {
          where: [
            { field: 'ownerId', op: '==', value: ownerId },
            { field: 'email', op: '==', value: customerData.email }
          ]
        });
        if (existing.length > 0) {
          const updated = db.update('customers', existing[0].id, {
            ...customerData,
            updatedAt: new Date().toISOString()
          });
          return res.status(200).json({ success: true, id: updated.id, upserted: true });
        }
      }

      const ownerUser = db.get('users', ownerId) || {};
      const ownerEmail = ownerUser.email || keyDoc.createdBy || '';

      const newId = randomId();
      const newCustName = customerData.name || 'Khách Web';
      db.create('customers', {
        ...customerData,
        ownerId,
        name: newCustName,
        businessName: customerData.businessName || newCustName,
        phone: customerData.phone || '',
        email: customerData.email || '',
        address: customerData.address || '',
        type: customerData.type || 'Chủ nhà',
        route: customerData.route || 'Khách đặt từ Website',
        note: customerData.note || 'Nguồn từ Website',
        source: customerData.source || 'web',
        status: customerData.status || 'Hoạt động',
        creditLimit: Number(customerData.creditLimit || 0),
        debt: Number(customerData.debt || 0),
        totalDebt: Number(customerData.totalDebt || customerData.debt || 0),
        totalOrders: Number(customerData.totalOrders || 0),
        totalOrdersAmount: Number(customerData.totalOrdersAmount || 0),
        totalPaymentsAmount: Number(customerData.totalPaymentsAmount || 0),
        licenseUrls: customerData.licenseUrls || [],
        additionalImages: customerData.additionalImages || [],
        taxName: customerData.taxName || '',
        taxCode: customerData.taxCode || '',
        taxAddress: customerData.taxAddress || '',
        taxPhone: customerData.taxPhone || '',
        ownerEmail: ownerEmail || '',
        createdByEmail: customerData.createdByEmail || ownerEmail || 'web@dunvex.com',
        createdBy: ownerId,
        createdAt: customerData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, newId);

      return res.status(200).json({ success: true, id: newId });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (error) {
    console.error("Customers API error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}

export { handler as default };
