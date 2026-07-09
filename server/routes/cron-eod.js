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
      const chatId = kf.telegramGroupChatId?.stringValue || kf.telegramChatId?.stringValue;
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
        const amount = Number(o.fields?.totalAmount?.integerValue ?? o.fields?.totalAmount?.doubleValue ?? 0);
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
        const debt = Number(c.fields?.debt?.integerValue ?? c.fields?.debt?.doubleValue ?? 0);
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
          debt: Number(c.fields?.debt?.integerValue ?? c.fields?.debt?.doubleValue ?? 0),
          days
        });
      }
      debtors.sort((a, b) => b.debt - a.debt);
      const suppliers = await runStructuredQuery(token, "suppliers", [
        { fieldFilter: { field: { fieldPath: "ownerId" }, op: "EQUAL", value: { stringValue: ownerId } } }
      ]);
      const supplierDebts = await runStructuredQuery(token, "supplier_debts", [
        { fieldFilter: { field: { fieldPath: "ownerId" }, op: "EQUAL", value: { stringValue: ownerId } } }
      ]);
      const supplierDebtors = [];
      for (const s of suppliers) {
        const sDebts = supplierDebts.filter((d) => {
          const supplierId = d.fields?.supplierId?.stringValue;
          return supplierId === s.id;
        });
        const netDebt = sDebts.reduce((sum, d) => {
          const amount = Number(d.fields?.amount?.integerValue ?? d.fields?.amount?.doubleValue ?? 0);
          const type = d.fields?.type?.stringValue;
          if (type === "debt_increase") return sum + amount;
          if (type === "payment") return sum - amount;
          return sum;
        }, 0);
        if (netDebt > 0) {
          supplierDebtors.push({
            name: s.fields?.name?.stringValue || "",
            debt: netDebt
          });
        }
      }
      supplierDebtors.sort((a, b) => b.debt - a.debt);
      const fmtVND = (n) => n.toLocaleString("vi-VN") + "\u0111";
      let dataSection = `
\u{1F4CA} <b>T\u1ED4NG K\u1EBET DOANH THU H\xD4M NAY</b>
`;
      dataSection += `\u{1F4B0} T\u1ED5ng doanh thu: <b>${fmtVND(totalRevenue)}</b>
`;
      if (Object.keys(revenueByStaff).length > 0) {
        dataSection += `
\u{1F465} <i>Theo nh\xE2n vi\xEAn:</i>
`;
        for (const [staff, amount] of Object.entries(revenueByStaff)) {
          dataSection += `  - ${staff}: ${fmtVND(amount)}
`;
        }
      }
      if (Object.keys(revenueByCustomer).length > 0) {
        dataSection += `
\u{1F6D2} <i>Theo kh\xE1ch h\xE0ng:</i>
`;
        for (const [cust, amount] of Object.entries(revenueByCustomer)) {
          dataSection += `  - ${cust}: ${fmtVND(amount)}
`;
        }
      }
      if (totalRevenue === 0) {
        dataSection += `  H\xF4m nay ch\u01B0a c\xF3 \u0111\u01A1n h\xE0ng n\xE0o.
`;
      }
      dataSection += `
\u{1F4CB} <b>C\xD4NG N\u1EE2 KH\xC1CH H\xC0NG</b>
`;
      if (debtors.length === 0) {
        dataSection += `  \u2705 Tuy\u1EC7t v\u1EDDi, kh\xF4ng c\xF3 kh\xE1ch n\xE0o n\u1EE3!
`;
      } else {
        const top5 = debtors.slice(0, 5);
        top5.forEach((d, i) => {
          dataSection += `  ${i + 1}. ${d.name}: <b>${fmtVND(d.debt)}</b> (${d.days} ng\xE0y)
`;
        });
        if (debtors.length > 5) {
          dataSection += `  <i>... v\xE0 ${debtors.length - 5} kh\xE1ch n\u1EE3 kh\xE1c</i>
`;
        }
      }
      dataSection += `
\u{1F3ED} <b>C\xD4NG N\u1EE2 NH\xC0 CUNG C\u1EA4P (M\xECnh n\u1EE3 NCC)</b>
`;
      if (supplierDebtors.length === 0) {
        dataSection += `  \u2705 Kh\xF4ng c\xF3 kho\u1EA3n n\u1EE3 NCC n\xE0o!
`;
      } else {
        supplierDebtors.forEach((s, i) => {
          dataSection += `  ${i + 1}. ${s.name}: <b>${fmtVND(s.debt)}</b>
`;
        });
      }
      const prompt = `B\u1EA1n l\xE0 tr\u1EE3 l\xFD AI (Telegram Bot) c\u1EE7a ph\u1EA7n m\u1EC1m Dunvex Build, ph\u1EE5c v\u1EE5 s\u1EBFp: ${adminName}.
Nhi\u1EC7m v\u1EE5: Vi\u1EBFt 1 L\u1EDCI CH\xC0O m\u1EDF \u0111\u1EA7u v\xE0 1 L\u1EDCI K\u1EBET cho b\xE1o c\xE1o cu\u1ED1i ng\xE0y.

Th\xF4ng tin tham kh\u1EA3o (KH\xD4NG vi\u1EBFt l\u1EA1i s\u1ED1 li\u1EC7u, ph\u1EA7n s\u1ED1 li\u1EC7u s\u1EBD \u0111\u01B0\u1EE3c ch\xE8n t\u1EF1 \u0111\u1ED9ng):
- Doanh thu h\xF4m nay: ${totalRevenue.toLocaleString("vi-VN")} \u0111
- S\u1ED1 \u0111\u01A1n h\xE0ng: ${todaysOrders.length}
- S\u1ED1 kh\xE1ch \u0111ang n\u1EE3: ${debtors.length}

Y\xCAU C\u1EA6U:
1. D\xF9ng emoji ph\xF9 h\u1EE3p, l\u1EDDi v\u0103n k\xEDnh tr\u1ECDng, th\xE2n thi\u1EC7n v\xE0 \u0111\u1ED9ng vi\xEAn tinh th\u1EA7n.
2. B\u1EAET BU\u1ED8C d\xF9ng HTML TAGS (V\xED d\u1EE5: <b>ch\u1EEF \u0111\u1EADm</b>, <i>ch\u1EEF nghi\xEAng</i>).
3. TUY\u1EC6T \u0110\u1ED0I KH\xD4NG D\xD9NG MARKDOWN (kh\xF4ng d\xF9ng d\u1EA5u * hay ** hay #).
4. TUY\u1EC6T \u0110\u1ED0I KH\xD4NG li\u1EC7t k\xEA l\u1EA1i s\u1ED1 li\u1EC7u hay s\u1ED1 ti\u1EC1n c\u1EE5 th\u1EC3.
5. Tr\u1EA3 v\u1EC1 \u0110\xDANG 2 d\xF2ng, ph\xE2n c\xE1ch b\u1EB1ng |||:
   D\xF2ng 1: L\u1EDDi ch\xE0o m\u1EDF \u0111\u1EA7u (1-2 c\xE2u)
   D\xF2ng 2: L\u1EDDi k\u1EBFt \u0111\u1ED9ng vi\xEAn (1-2 c\xE2u)
V\xED d\u1EE5: \u{1F319} Ch\xE0o s\u1EBFp ${adminName}! D\u01B0\u1EDBi \u0111\xE2y l\xE0 b\xE1o c\xE1o cu\u1ED1i ng\xE0y \u1EA1!|||\u{1F4AA} Ch\xFAc s\u1EBFp ngh\u1EC9 ng\u01A1i th\u1EADt t\u1ED1t, ng\xE0y mai ti\u1EBFp t\u1EE5c chinh ph\u1EE5c nh\xE9! \u{1F680}`;
      let greeting = `\u{1F319} Ch\xE0o s\u1EBFp ${adminName}! D\u01B0\u1EDBi \u0111\xE2y l\xE0 b\xE1o c\xE1o cu\u1ED1i ng\xE0y \u1EA1!`;
      let closing = `\u{1F4AA} Ch\xFAc s\u1EBFp ngh\u1EC9 ng\u01A1i th\u1EADt t\u1ED1t! \u{1F680}`;
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
          }
        );
        if (!geminiRes.ok) {
          console.error("Gemini API error:", geminiRes.status, await geminiRes.text());
        } else {
          const data = await geminiRes.json();
          if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            const aiText = data.candidates[0].content.parts[0].text.trim();
            const parts = aiText.split("|||");
            if (parts.length >= 2) {
              greeting = parts[0].trim();
              closing = parts[1].trim();
            } else {
              greeting = aiText;
            }
          } else {
            console.error("Gemini: no candidates in response", JSON.stringify(data).substring(0, 500));
          }
        }
      } catch (e) {
        console.error("Gemini error:", e);
      }
      const reportText = `${greeting}
${dataSection}
${closing}`;
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
