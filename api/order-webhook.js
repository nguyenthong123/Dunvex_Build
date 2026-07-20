import crypto from "crypto";
const PROJECT_ID = "dunvex-89461";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
async function getAccessToken() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!json) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT env");
  const sa = JSON.parse(json);
  const header = { alg: "RS256", typ: "JWT", kid: sa.private_key_id };
  const now = Math.floor(Date.now() / 1e3);
  const claim = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/datastore"
  };
  const b64obj = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const sign = (pk, data) => {
    return crypto.createSign("RSA-SHA256").update(data).sign(pk, "base64url");
  };
  const partial = `${b64obj(header)}.${b64obj(claim)}`;
  const jwt = `${partial}.${sign(sa.private_key, partial)}`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const td = await tokenRes.json();
  if (td.error) throw new Error(`Auth: ${td.error_description || td.error}`);
  return td.access_token;
}
function fString(v) {
  return { stringValue: v };
}
function fInt(v) {
  return { integerValue: String(v) };
}
function fDouble(v) {
  return { doubleValue: v };
}
function fBool(v) {
  return { booleanValue: v };
}
function fTs() {
  return { timestampValue: (/* @__PURE__ */ new Date()).toISOString() };
}
async function restGet(token, path) {
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore GET ${path}: ${res.status}`);
  return res.json();
}
async function runStructuredQuery(token, collectionId, fieldFilters) {
  const url = `${FIRESTORE_BASE}:runQuery`;
  const filter = fieldFilters.length === 1 ? fieldFilters[0] : {
    compositeFilter: {
      op: "AND",
      filters: fieldFilters
    }
  };
  const body = {
    structuredQuery: {
      from: [{ collectionId }],
      where: filter
    }
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Firestore query failed: ${res.status} ${txt}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.filter((item) => item.document).map((item) => item.document);
}
async function restCreate(token, collection, fields) {
  const res = await fetch(`${FIRESTORE_BASE}/${collection}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });
  const data = await res.json();
  if (data.error) throw new Error(`Firestore create: ${JSON.stringify(data.error)}`);
  const parts = (data.name || "").split("/");
  return parts[parts.length - 1];
}
async function restUpdate(token, path, fields) {
  const res = await fetch(`${FIRESTORE_BASE}/${path}?updateMask.fieldPaths=${Object.keys(fields).join("&updateMask.fieldPaths=")}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });
  return res.json();
}
async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }
  console.log("[order-webhook-vercel] Request from:", req.headers["origin"] || req.headers["referer"] || "unknown", "| body.customerId:", req.body?.customerId, "| items[0].productId:", req.body?.items?.[0]?.productId, "| customerName:", req.body?.customerName, "| items count:", req.body?.items?.length);
  const apiKey = req.headers["x-api-key"] || req.headers["X-Api-Key"];
  const webhookToken = req.query?.token;
  if (!apiKey) return res.status(401).json({ error: "Missing x-api-key header" });
  try {
    const body = req.body;
    // Nếu có webhook token, tìm ownerId từ token thay vì yêu cầu trong body
    let ownerId = body.ownerId;
    if (webhookToken && !ownerId) {
      const allApiKeys = await runStructuredQuery(token, "api_keys", []);
      const matchedKey = allApiKeys.find(doc => {
        const f = doc.fields || {};
        return f.webhookSecret?.stringValue === webhookToken && f.enabled?.booleanValue === true && f.key?.stringValue === apiKey;
      });
      if (matchedKey) {
        ownerId = matchedKey.name.split("/").pop();
      }
    }
    if (!ownerId) return res.status(400).json({ error: "Missing ownerId. Include in body or use a valid webhook URL." });
    if (!body.customerName || !body.items?.length) return res.status(400).json({ error: "Missing customerName or items" });
    const token = await getAccessToken();
    const keyDoc = await restGet(token, `api_keys/${ownerId}`);
    if (!keyDoc) return res.status(403).json({ error: "API key not found" });
    const kf = keyDoc.fields || {};
    // Validate: API key must match AND token must match (if provided) AND must be enabled
    const keyMatch = kf.key?.stringValue === apiKey;
    const tokenMatch = !webhookToken || kf.webhookSecret?.stringValue === webhookToken;
    if (kf.enabled?.booleanValue !== true || !keyMatch || !tokenMatch) {
      return res.status(403).json({ error: "Invalid or disabled API key/token" });
    }
    const allProducts = await runStructuredQuery(token, "products", [
      {
        fieldFilter: {
          field: { fieldPath: "ownerId" },
          op: "EQUAL",
          value: { stringValue: ownerId }
        }
      }
    ]);
    const items = [];
    const notFound = [];
    for (const item of body.items) {
      let matched = null;
      if (item.productId) {
        const found = allProducts.find((p) => p.name.split("/").pop() === item.productId);
        if (found) {
          matched = { id: item.productId, ...found.fields };
        } else {
          const prodDoc = await restGet(token, `products/${item.productId}`);
          if (prodDoc) {
            const pf = prodDoc.fields || {};
            if (pf.ownerId?.stringValue === ownerId) {
              matched = { id: item.productId, ...pf };
            }
          }
        }
      }
      if (!matched && item.productName) {
        const found = allProducts.find((doc) => {
          const f = doc.fields || {};
          return f.name?.stringValue?.toLowerCase() === item.productName.toLowerCase();
        });
        if (found) {
          matched = { id: found.name.split("/").pop(), ...found.fields };
        }
      }
      if (matched) {
        items.push({
          productId: matched.id,
          name: matched.name?.stringValue || "",
          category: matched.category?.stringValue || matched.order_category?.stringValue || "",
          qty: Number(item.qty) || 0,
          price: Number(item.price) || Number(matched.priceSell?.doubleValue || matched.priceSell?.integerValue || 0),
          buyPrice: Number(matched.priceImport?.doubleValue || matched.priceImport?.integerValue || 0),
          unit: matched.unit?.stringValue || "",
          weight: matched.density?.stringValue || (matched.density?.doubleValue !== void 0 ? String(matched.density.doubleValue) : "") || (matched.density?.integerValue !== void 0 ? String(matched.density.integerValue) : "") || "",
          stock: Number(matched.stock?.doubleValue || matched.stock?.integerValue || 0)
        });
      } else {
        notFound.push(item.productId || item.productName || "unknown");
      }
    }
    if (items.length === 0) {
      return res.status(400).json({ error: "No matching products found", notFound });
    }
    const customerName = body.customerName || "";
    const customerPhone = body.customerPhone || "";
    const customerEmail = body.customerEmail || "";
    let customerId = null;
    {
      let matchedCust = null;
      const filters = [
        {
          fieldFilter: {
            field: { fieldPath: "ownerId" },
            op: "EQUAL",
            value: { stringValue: ownerId }
          }
        }
      ];
      if (!matchedCust && customerName) {
        const docs = await runStructuredQuery(token, "customers", [
          ...filters,
          {
            fieldFilter: {
              field: { fieldPath: "name" },
              op: "EQUAL",
              value: { stringValue: customerName }
            }
          }
        ]);
        if (docs.length > 0) matchedCust = docs[0];
      }
      if (matchedCust) {
        customerId = matchedCust.name.split("/").pop();
      } else {
        customerId = await restCreate(token, "customers", {
          ownerId: fString(ownerId),
          name: fString(customerName),
          phone: fString(customerPhone),
          email: fString(customerEmail),
          address: fString(body.customerAddress || ""),
          type: fString("Kh\xE1ch web"),
          createdAt: fTs(),
          createdBy: fString(ownerId)
        });
      }
    }
    const shippingFee = Number(body.shippingFee) || 0;
    const subTotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const totalWeight = items.reduce((s, i) => s + (parseFloat(i.weight) || 0) * i.qty, 0);
    const totalCost = items.reduce((s, i) => s + (i.buyPrice || 0) * i.qty, 0);
    const totalAmount = subTotal + shippingFee;
    const orderFields = {
      ownerId: fString(ownerId),
      customerName: fString(customerName),
      customerPhone: fString(customerPhone),
      customerId: fString(customerId || ""),
      items: {
        arrayValue: {
          values: items.map((i) => ({
            mapValue: {
              fields: {
                productId: fString(i.productId),
                name: fString(i.name),
                category: fString(i.category || ""),
                qty: fInt(i.qty),
                price: fDouble(i.price),
                buyPrice: fDouble(i.buyPrice),
                unit: fString(i.unit),
                weight: fString(i.weight)
              }
            }
          }))
        }
      },
      subTotal: fDouble(subTotal),
      totalAmount: fDouble(totalAmount),
      paidAmount: fDouble(totalAmount),
      debtAmount: fDouble(0),
      discountValue: fDouble(0),
      adjustmentValue: fDouble(shippingFee),
      totalWeight: fDouble(totalWeight),
      totalCost: fDouble(totalCost),
      totalProfit: fDouble(subTotal - totalCost),
      status: fString("\u0110\u01A1n ch\u1ED1t"),
      note: fString(body.note || "\u0110\u01A1n t\u1EEB Webhook API"),
      orderDate: fString(body.orderDate ? new Date(body.orderDate).toISOString() : (/* @__PURE__ */ new Date()).toISOString()),
      createdAt: fTs(),
      updatedAt: fTs(),
      createdBy: fString(ownerId),
      createdByEmail: fString(customerEmail || "webhook"),
      source: fString("webhook"),
      order_category: fString(items[0]?.category || "")
    };
    const orderId = await restCreate(token, "orders", orderFields);
    for (const item of items) {
      const newStock = Math.max(0, item.stock - item.qty);
      await restUpdate(token, `products/${item.productId}`, {
        stock: fDouble(newStock),
        updatedAt: fTs()
      });
    }
    if (customerId) {
      try {
        const custDoc = await restGet(token, `customers/${customerId}`);
        const currentDebt = Number(custDoc?.fields?.debt?.doubleValue || custDoc?.fields?.debt?.integerValue || 0);
        await restUpdate(token, `customers/${customerId}`, {
          debt: fDouble(currentDebt + totalAmount)
        });
      } catch (debtErr) {
        console.error("Failed to update customer debt in webhook:", debtErr);
      }
    }
    try {
      const keyDoc2 = await restGet(token, `api_keys/${ownerId}`);
      if (keyDoc2 && keyDoc2.fields) {
        const kf2 = keyDoc2.fields;
        const botToken = kf2.telegramBotToken?.stringValue;
        const chatId = kf2.telegramGroupChatId?.stringValue || kf2.telegramChatId?.stringValue;
        if (botToken && chatId && kf2.enabled?.booleanValue === true) {
          const message = `\u{1F4E6} <b>\u0110\u01A0N H\xC0NG M\u1EDAI (CH\u1ED0T)</b>
- Kh\xE1ch h\xE0ng: <b>${customerName || "Kh\xE1ch v\xE3ng lai"}</b>
- T\u1ED5ng ti\u1EC1n: <b>${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(totalAmount)}</b>
- Ng\u01B0\u1EDDi thao t\xE1c: Bot Tr\u1EE3 L\xFD (Webhook)`;
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: message,
              parse_mode: "HTML"
            })
          });
        }
      }
    } catch (teleErr) {
      console.error("Failed to send Telegram notification in webhook:", teleErr);
    }
    return res.status(200).json({
      success: true,
      orderId,
      customerId: customerId || null,
      totalAmount,
      items: items.length,
      notFound: notFound.length > 0 ? notFound : void 0
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
export {
  handler as default
};
