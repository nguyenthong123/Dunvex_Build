import crypto from "crypto";
const PROJECT_ID = "dunvex-89461";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
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
  const sign = (pk, data) => crypto.createSign("RSA-SHA256").update(data).sign(pk, "base64url");
  const partial = `${b64obj(header)}.${b64obj(claim)}`;
  const jwt = `${partial}.${sign(sa.private_key, partial)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const td = await res.json();
  if (td.error) throw new Error(`Auth: ${td.error_description || td.error}`);
  return td.access_token;
}
async function runStructuredQuery(token, collectionId, filters = [], limitNum, orderByClause) {
  const body = {
    structuredQuery: {
      from: [{ collectionId }],
      where: filters.length > 0 ? filters.length === 1 ? filters[0] : { compositeFilter: { op: "AND", filters } } : void 0
    }
  };
  if (limitNum) body.structuredQuery.limit = limitNum;
  if (orderByClause) body.structuredQuery.orderBy = [orderByClause];
  const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) return [];
  const results = await res.json();
  if (!Array.isArray(results)) return [];
  return results.filter((r) => r.document).map((r) => ({ id: r.document.name.split("/").pop(), fields: r.document.fields }));
}
async function restGet(token, path) {
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  return res.json();
}
async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const token = await getAccessToken();
    const apiKeys = await runStructuredQuery(token, "api_keys", []);
    let processedCount = 0;
    const now = /* @__PURE__ */ new Date();
    const offset = 7 * 60 * 60 * 1e3;
    const localNow = new Date(now.getTime() + offset);
    localNow.setUTCHours(0, 0, 0, 0);
    const startOfDayUTC = new Date(localNow.getTime() - offset);
    for (const keyDoc of apiKeys) {
      const kf = keyDoc.fields || {};
      const ownerId = keyDoc.id;
      const botToken = kf.telegramBotToken?.stringValue;
      const chatId = kf.telegramChatId?.stringValue;
      const enabled = kf.enabled?.booleanValue !== false;
      if (!botToken || !chatId || !enabled) continue;
      const userDoc = await restGet(token, `users/${ownerId}`);
      const adminName = userDoc?.fields?.displayName?.stringValue || "Admin";
      const orders = await runStructuredQuery(token, "orders", [
        { fieldFilter: { field: { fieldPath: "ownerId" }, op: "EQUAL", value: { stringValue: ownerId } } },
        { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "\u0110\u01A1n ch\u1ED1t" } } }
      ]);
      const todaysOrders = orders.filter((o) => {
        const orderDateStr = o.fields?.orderDate?.stringValue || o.fields?.createdAt?.timestampValue;
        if (!orderDateStr) return false;
        const d = new Date(orderDateStr);
        return d >= startOfDayUTC;
      });
      const revenueByStaff = {};
      const revenueByCustomer = {};
      let totalRevenue = 0;
      todaysOrders.forEach((o) => {
        const amount = Number(o.fields?.totalAmount?.integerValue || o.fields?.totalAmount?.doubleValue || 0);
        const staff = o.fields?.staffName?.stringValue || o.fields?.createdBy?.stringValue || "Admin";
        const customer = o.fields?.customerName?.stringValue || "Kh\xE1ch v\xE3ng lai";
        revenueByStaff[staff] = (revenueByStaff[staff] || 0) + amount;
        revenueByCustomer[customer] = (revenueByCustomer[customer] || 0) + amount;
        totalRevenue += amount;
      });
      const customers = await runStructuredQuery(token, "customers", [
        { fieldFilter: { field: { fieldPath: "ownerId" }, op: "EQUAL", value: { stringValue: ownerId } } }
      ]);
      const debtorsRaw = customers.filter((c) => {
        const debt = Number(c.fields?.debt?.integerValue || c.fields?.debt?.doubleValue || 0);
        return debt > 0;
      });
      const debtors = [];
      for (const c of debtorsRaw) {
        let days = Number(c.fields?.debtDays?.integerValue || 0);
        try {
          const lastOrders = await runStructuredQuery(token, "orders", [
            { fieldFilter: { field: { fieldPath: "ownerId" }, op: "EQUAL", value: { stringValue: ownerId } } },
            { fieldFilter: { field: { fieldPath: "customerId" }, op: "EQUAL", value: { stringValue: c.id } } },
            { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "\u0110\u01A1n ch\u1ED1t" } } }
          ], 1, { field: { fieldPath: "createdAt" }, direction: "DESCENDING" });
          const lastPayments = await runStructuredQuery(token, "payments", [
            { fieldFilter: { field: { fieldPath: "ownerId" }, op: "EQUAL", value: { stringValue: ownerId } } },
            { fieldFilter: { field: { fieldPath: "customerId" }, op: "EQUAL", value: { stringValue: c.id } } }
          ], 1, { field: { fieldPath: "createdAt" }, direction: "DESCENDING" });
          let lastTxTime = 0;
          if (lastOrders.length > 0 && lastOrders[0].fields?.createdAt?.timestampValue) {
            lastTxTime = Math.max(lastTxTime, new Date(lastOrders[0].fields.createdAt.timestampValue).getTime());
          }
          if (lastPayments.length > 0 && lastPayments[0].fields?.createdAt?.timestampValue) {
            lastTxTime = Math.max(lastTxTime, new Date(lastPayments[0].fields.createdAt.timestampValue).getTime());
          }
          if (lastTxTime > 0) {
            days = Math.floor((Date.now() - lastTxTime) / (1e3 * 60 * 60 * 24));
          }
        } catch (e) {
          console.error("Error fetching lastTx for debtor", c.id, e);
        }
        debtors.push({
          name: c.fields?.name?.stringValue || "",
          debt: Number(c.fields?.debt?.integerValue || c.fields?.debt?.doubleValue || 0),
          days
        });
      }
      debtors.sort((a, b) => b.debt - a.debt);
      const prompt = `B\u1EA1n l\xE0 tr\u1EE3 l\xFD AI (Telegram Bot) c\u1EE7a ph\u1EA7n m\u1EC1m Dunvex Build, ph\u1EE5c v\u1EE5 s\u1EBFp: ${adminName}.
Nhi\u1EC7m v\u1EE5: D\u1EF1a v\xE0o s\u1ED1 li\u1EC7u d\u01B0\u1EDBi \u0111\xE2y, h\xE3y vi\u1EBFt 1 tin nh\u1EAFn B\xC1O C\xC1O CU\u1ED0I NG\xC0Y g\u1EEDi cho s\u1EBFp.
Y\xCAU C\u1EA6U:
1. D\xF9ng emoji ph\xF9 h\u1EE3p, l\u1EDDi v\u0103n k\xEDnh tr\u1ECDng, th\xE2n thi\u1EC7n v\xE0 \u0111\u1ED9ng vi\xEAn tinh th\u1EA7n.
2. Format ti\u1EC1n t\u1EC7 VN\u0110 (v\xED d\u1EE5: 10.000.000\u0111).
3. B\u1EAET BU\u1ED8C S\u1EEC D\u1EE4NG HTML TAGS \u0111\u1EC3 l\xE0m n\u1ED5i b\u1EADt (V\xED d\u1EE5: <b>ch\u1EEF \u0111\u1EADm</b>, <i>ch\u1EEF nghi\xEAng</i>).
4. TUY\u1EC6T \u0110\u1ED0I KH\xD4NG D\xD9NG MARKDOWN (kh\xF4ng d\xF9ng d\u1EA5u * hay ** hay #). C\xE1c m\u1EE5c danh s\xE1ch h\xE3y d\xF9ng g\u1EA1ch \u0111\u1EA7u d\xF2ng (-) ho\u1EB7c emoji (\u{1F449}, \u{1F4E6}).
5. N\u1ED9i dung b\xE1o c\xE1o c\u1EA7n ng\u1EAFn g\u1ECDn, chia l\xE0m 2 ph\u1EA7n ch\xEDnh: T\u1ED4NG K\u1EBET DOANH THU H\xD4M NAY v\xE0 DANH S\xC1CH NH\u1EAEC N\u1EE2 (ch\u1EC9 li\u1EC7t k\xEA 5 kh\xE1ch n\u1EE3 nhi\u1EC1u nh\u1EA5t n\u1EBFu danh s\xE1ch qu\xE1 d\xE0i).

=== D\u1EEE LI\u1EC6U ===
DOANH THU H\xD4M NAY: ${totalRevenue.toLocaleString("vi-VN")} \u0111
- Theo nh\xE2n vi\xEAn:
${Object.entries(revenueByStaff).map(([k, v]) => `  + ${k}: ${v.toLocaleString("vi-VN")} \u0111`).join("\n") || "Kh\xF4ng c\xF3 \u0111\u01A1n n\xE0o"}
- Theo kh\xE1ch h\xE0ng:
${Object.entries(revenueByCustomer).map(([k, v]) => `  + ${k}: ${v.toLocaleString("vi-VN")} \u0111`).join("\n") || "Kh\xF4ng c\xF3 \u0111\u01A1n n\xE0o"}

DANH S\xC1CH C\xD4NG N\u1EE2 HI\u1EC6N T\u1EA0I (T\u1EA5t c\u1EA3):
${debtors.length > 0 ? debtors.map((d) => `- ${d.name}: ${d.debt.toLocaleString("vi-VN")} \u0111 (S\u1ED1 ng\xE0y n\u1EE3: ${d.days})`).join("\n") : "Tuy\u1EC7t v\u1EDDi, kh\xF4ng c\xF3 kh\xE1ch n\xE0o n\u1EE3!"}
================
H\xE3y vi\u1EBFt b\xE1o c\xE1o g\u1EEDi s\u1EBFp \u0111i:`;
      let reportText = "B\xE1o c\xE1o cu\u1ED1i ng\xE0y kh\xF4ng kh\u1EA3 d\u1EE5ng do l\u1ED7i t\u1EA1o v\u0103n b\u1EA3n.";
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
          }
        );
        const data = await geminiRes.json();
        if (data.candidates && data.candidates[0].content.parts[0].text) {
          reportText = data.candidates[0].content.parts[0].text;
        }
      } catch (e) {
        console.error("Gemini error:", e);
      }
      const teleRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: reportText,
          parse_mode: "HTML"
        })
      });
      if (teleRes.ok) {
        processedCount++;
      } else {
        console.error("Telegram send EOD error:", await teleRes.text());
      }
    }
    return res.status(200).json({ success: true, processed: processedCount });
  } catch (error) {
    console.error("CRON EOD Error:", error);
    return res.status(500).json({ error: error.message || "Server Error" });
  }
}
export {
  handler as default
};
