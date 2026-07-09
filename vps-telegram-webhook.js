import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import crypto from "crypto";
const PROJECT_ID = "dunvex-89461";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
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
async function restGet(token, path) {
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore GET ${path}: ${res.status}`);
  return res.json();
}
async function runStructuredQuery(token, collectionId, fieldFilters, limit, orderBy) {
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
  if (limit) body.structuredQuery.limit = limit;
  if (orderBy) body.structuredQuery.orderBy = [orderBy];
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
  const url = `${FIRESTORE_BASE}/${collection}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error(`Firestore POST ${collection} failed: ${res.status}`);
  return res.json();
}
async function restPatch(token, path, fields) {
  const keys = Object.keys(fields);
  const mask = keys.map((k) => `updateMask.fieldPaths=${k}`).join("&");
  const url = `${FIRESTORE_BASE}/${path}?${mask}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error(`Firestore PATCH ${path} failed: ${res.status}`);
  return res.json();
}
async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY not configured on server");
    return res.status(500).json({ error: "GEMINI_API_KEY not configured on server" });
  }
  try {
    const ownerId = req.query.ownerId;
    if (!ownerId) {
      console.error("Missing ownerId in query");
      return res.status(400).json({ error: "Missing ownerId" });
    }
    const body = req.body;
    if (!body || !body.message || !body.message.chat) {
      return res.status(200).json({ status: "ignored" });
    }
    const userMessage = body.message.text || body.message.caption || "";
    const chatId = body.message.chat.id;
    const chatType = body.message.chat.type;
    if (chatType === "group" || chatType === "supergroup") {
      const lowerText = userMessage.toLowerCase();
      const isCalledByName = lowerText.includes("dunvex bot");
      if (!isCalledByName) {
        return res.status(200).json({ status: "ignored_group_chatter" });
      }
    }
    const token = await getAccessToken();
    const keyDoc = await restGet(token, `api_keys/${ownerId}`);
    if (!keyDoc) {
      console.error("API key doc not found for owner:", ownerId);
      return res.status(403).json({ error: "Owner not found" });
    }
    const kf = keyDoc.fields || {};
    const botToken = kf.telegramBotToken?.stringValue;
    if (!botToken || kf.enabled?.booleanValue !== true) {
      console.error("Invalid or disabled bot token for owner:", ownerId);
      return res.status(403).json({ error: "Invalid or disabled bot token" });
    }
    const isGroupChat = chatType === "group" || chatType === "supergroup";
    const chatIdField = isGroupChat ? "telegramGroupChatId" : "telegramChatId";
    const currentValue = kf[chatIdField]?.stringValue;
    if (!currentValue || currentValue !== String(chatId)) {
      await fetch(`${FIRESTORE_BASE}/api_keys/${ownerId}?updateMask.fieldPaths=${chatIdField}`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `projects/${PROJECT_ID}/databases/(default)/documents/api_keys/${ownerId}`,
          fields: {
            [chatIdField]: { stringValue: String(chatId) }
          }
        })
      });
    }
    const [userDoc, customersData, suppliersData, recentOrders, supplierDebtsData] = await Promise.all([
      restGet(token, `users/${ownerId}`),
      runStructuredQuery(token, "customers", [{ fieldFilter: { field: { fieldPath: "ownerId" }, op: "EQUAL", value: { stringValue: ownerId } } }]),
      runStructuredQuery(token, "suppliers", [{ fieldFilter: { field: { fieldPath: "ownerId" }, op: "EQUAL", value: { stringValue: ownerId } } }]),
      runStructuredQuery(token, "orders", [{ fieldFilter: { field: { fieldPath: "ownerId" }, op: "EQUAL", value: { stringValue: ownerId } } }], 50, { field: { fieldPath: "createdAt" }, direction: "DESCENDING" }),
      runStructuredQuery(token, "supplier_debts", [{ fieldFilter: { field: { fieldPath: "ownerId" }, op: "EQUAL", value: { stringValue: ownerId } } }])
    ]);
    const adminName = userDoc?.fields?.displayName?.stringValue || userDoc?.fields?.email?.stringValue || "Admin";
    const customersWithDebt = customersData.filter((c) => {
      const debt = Number(c.fields?.debt?.integerValue || c.fields?.debt?.doubleValue || 0);
      return debt > 0;
    }).map((c) => {
      return {
        name: c.fields?.name?.stringValue || "",
        debt: Number(c.fields?.debt?.integerValue || c.fields?.debt?.doubleValue || 0),
        days: c.fields?.debtDays?.integerValue || 0
      };
    });
    const suppliersWithDebt = [];
    for (const s of suppliersData) {
      const sDebts = supplierDebtsData.filter((d) => {
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
        suppliersWithDebt.push({
          name: s.fields?.name?.stringValue || "",
          debt: netDebt
        });
      }
    }
    const ordersData = recentOrders.map((o) => {
      const emailName = o.fields?.createdByEmail?.stringValue ? o.fields.createdByEmail.stringValue.split("@")[0] : "";
      const fallbackStaff = o.fields?.createdBy?.stringValue === ownerId ? adminName : emailName || "Nh\xE2n vi\xEAn";
      return {
        customerName: o.fields?.customerName?.stringValue || "",
        totalAmount: Number(o.fields?.totalAmount?.integerValue || o.fields?.totalAmount?.doubleValue || 0),
        staffName: o.fields?.staffName?.stringValue || fallbackStaff,
        date: o.fields?.orderDate?.stringValue || ""
      };
    });
    const systemPrompt = `B\u1EA1n l\xE0 tr\u1EE3 l\xFD AI (t\xEAn l\xE0 dunvex bot) ph\u1EE5c v\u1EE5 \u0110\u1ED8C QUY\u1EC0N cho t\xE0i kho\u1EA3n: ${adminName} c\u1EE7a ph\u1EA7n m\u1EC1m qu\u1EA3n l\xFD Dunvex Build.
Nhi\u1EC7m v\u1EE5 c\u1EE7a b\u1EA1n: Tr\u1EA3 l\u1EDDi t\u1EF1 nhi\xEAn, th\xE2n thi\u1EC7n v\xE0 cung c\u1EA5p th\xF4ng tin ch\xEDnh x\xE1c t\u1EEB h\u1EC7 th\u1ED1ng.
QUY T\u1EAEC QUAN TR\u1ECCNG: 
1. B\u1EAET BU\u1ED8C S\u1EEC D\u1EE4NG HTML \u0110\u1EC2 \u0110\u1ECANH D\u1EA0NG (v\xED d\u1EE5: <b>ch\u1EEF \u0111\u1EADm</b>, <i>ch\u1EEF nghi\xEAng</i>). 
2. TUY\u1EC6T \u0110\u1ED0I KH\xD4NG D\xD9NG MARKDOWN (kh\xF4ng d\xF9ng d\u1EA5u * hay ** hay #). C\xE1c danh s\xE1ch h\xE3y d\xF9ng g\u1EA1ch \u0111\u1EA7u d\xF2ng (-) ho\u1EB7c c\xE1c emoji (\u{1F449}, \u{1F4E6}, \u{1F4B0}, \u{1F464}).
3. HI\u1EC6N T\u1EA0I B\u1EA0N \u0110\xC3 C\xD3 KH\u1EA2 N\u0102NG S\u1EEC D\u1EE4NG C\xD4NG C\u1EE4 (TOOLS). Khi ng\u01B0\u1EDDi d\xF9ng y\xEAu c\u1EA7u t\u1EA1o \u0111\u01A1n h\xE0ng, s\u1EEDa \u0111\u01A1n h\xE0ng, hay ch\u1EC9nh s\u1EEDa c\xF4ng n\u1EE3, H\xC3Y G\u1ECCI H\xC0M T\u01AF\u01A0NG \u1EE8NG.
4. B\xE1o c\xE1o doanh thu ho\u1EB7c c\xF4ng n\u1EE3 m\u1ED9t c\xE1ch d\u1EC5 hi\u1EC3u, format ti\u1EC1n t\u1EC7 VN\u0110 (v\xED d\u1EE5: 10.000.000\u0111).
5. Nh\u1EAFc \u0111\u1EBFn t\xEAn admin l\xE0 ${adminName} n\u1EBFu ng\u01B0\u1EDDi d\xF9ng h\u1ECFi b\u1EA1n \u0111ang ph\u1EE5c v\u1EE5 ai.

--- D\u1EEE LI\u1EC6U HI\u1EC6N T\u1EA0I T\u1EEA H\u1EC6 TH\u1ED0NG C\u1EE6A ADMIN: ${adminName} ---
Kh\xE1ch h\xE0ng \u0111ang c\xF3 c\xF4ng n\u1EE3 (Kh\xE1ch h\xE0ng n\u1EE3 m\xECnh):
${customersWithDebt.map((c) => `- ${c.name}: N\u1EE3 ${c.debt.toLocaleString("vi-VN")}\u0111 (S\u1ED1 ng\xE0y: ${c.days})`).join("\n") || "Kh\xF4ng c\xF3 kh\xE1ch n\u1EE3."}

Nh\xE0 cung c\u1EA5p \u0111ang c\xF3 c\xF4ng n\u1EE3 (M\xECnh n\u1EE3 NCC):
${suppliersWithDebt.map((s) => `- ${s.name}: \u0110ang n\u1EE3 ${s.debt.toLocaleString("vi-VN")}\u0111`).join("\n") || "Kh\xF4ng c\xF3 n\u1EE3 nh\xE0 cung c\u1EA5p."}

50 \u0110\u01A1n h\xE0ng g\u1EA7n nh\u1EA5t (Kh\xE1ch h\xE0ng / Doanh thu / Nh\xE2n vi\xEAn / Ng\xE0y):
${ordersData.map((o) => `- ${o.customerName}: ${o.totalAmount.toLocaleString("vi-VN")}\u0111 (Nh\xE2n vi\xEAn: ${o.staffName}, Ng\xE0y: ${new Date(o.date).toLocaleDateString("vi-VN")})`).join("\n") || "Ch\u01B0a c\xF3 \u0111\u01A1n h\xE0ng."}
------------------------------------------------`;
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      systemInstruction: systemPrompt,
      tools: [{
        functionDeclarations: [
          {
            name: "create_order",
            description: "T\u1EA1o \u0111\u01A1n h\xE0ng m\u1EDBi cho kh\xE1ch h\xE0ng.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                customerName: { type: SchemaType.STRING, description: "T\xEAn kh\xE1ch h\xE0ng" },
                totalAmount: { type: SchemaType.NUMBER, description: "T\u1ED5ng ti\u1EC1n \u0111\u01A1n h\xE0ng (VN\u0110)" }
              },
              required: ["customerName", "totalAmount"]
            }
          },
          {
            name: "update_customer_debt",
            description: "Th\xEAm ho\u1EB7c tr\u1EEB c\xF4ng n\u1EE3 c\u1EE7a kh\xE1ch h\xE0ng (VD: kh\xE1ch tr\u1EA3 n\u1EE3 th\xEC tr\u1EEB n\u1EE3, kh\xE1ch mua n\u1EE3 th\xEC th\xEAm n\u1EE3).",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                customerName: { type: SchemaType.STRING, description: "T\xEAn kh\xE1ch h\xE0ng" },
                adjustmentAmount: { type: SchemaType.NUMBER, description: "S\u1ED1 ti\u1EC1n thay \u0111\u1ED5i (s\u1ED1 \xC2M n\u1EBFu kh\xE1ch tr\u1EA3 n\u1EE3 / gi\u1EA3m n\u1EE3, s\u1ED1 D\u01AF\u01A0NG n\u1EBFu kh\xE1ch n\u1EE3 th\xEAm)" }
              },
              required: ["customerName", "adjustmentAmount"]
            }
          }
        ]
      }]
    });
    const chat = model.startChat();
    let result;
    try {
      result = await chat.sendMessage(userMessage);
    } catch (e) {
      console.error("Gemini error:", e);
      return res.status(500).json({ error: "L\u1ED7i khi g\u1ECDi AI", details: e.message });
    }
    const call = result.response.functionCalls()?.[0];
    if (call) {
      let funcResult = "";
      try {
        if (call.name === "create_order") {
          const { customerName, totalAmount } = call.args;
          await restCreate(token, "orders", {
            ownerId: { stringValue: ownerId },
            customerName: { stringValue: customerName },
            totalAmount: { integerValue: String(totalAmount) },
            status: { stringValue: "\u0110\u01A1n ch\u1ED1t" },
            createdAt: { timestampValue: (/* @__PURE__ */ new Date()).toISOString() },
            createdBy: { stringValue: "Telegram Bot" }
          });
          funcResult = `T\u1EA1o \u0111\u01A1n h\xE0ng th\xE0nh c\xF4ng cho ${customerName} v\u1EDBi s\u1ED1 ti\u1EC1n ${totalAmount}\u0111`;
        } else if (call.name === "update_customer_debt") {
          const { customerName, adjustmentAmount } = call.args;
          const customers = await runStructuredQuery(token, "customers", [
            { fieldFilter: { field: { fieldPath: "ownerId" }, op: "EQUAL", value: { stringValue: ownerId } } },
            { fieldFilter: { field: { fieldPath: "name" }, op: "EQUAL", value: { stringValue: customerName } } }
          ], 1);
          if (customers.length > 0) {
            const c = customers[0];
            const currentDebt = Number(c.fields?.debt?.integerValue || c.fields?.debt?.doubleValue || 0);
            const newDebt = currentDebt + Number(adjustmentAmount);
            const customerId = c.name.split("/").pop();
            await restPatch(token, `customers/${customerId}`, {
              debt: { integerValue: String(newDebt) }
            });
            funcResult = `\u0110\xE3 c\u1EADp nh\u1EADt c\xF4ng n\u1EE3 cho ${customerName}. N\u1EE3 c\u0169: ${currentDebt}\u0111, N\u1EE3 m\u1EDBi: ${newDebt}\u0111`;
          } else {
            funcResult = `Kh\xF4ng t\xECm th\u1EA5y kh\xE1ch h\xE0ng n\xE0o t\xEAn ${customerName}. Y\xEAu c\u1EA7u qu\u1EA3n tr\u1ECB vi\xEAn ki\u1EC3m tra l\u1EA1i t\xEAn.`;
          }
        }
      } catch (e) {
        funcResult = `L\u1ED7i h\u1EC7 th\u1ED1ng khi th\u1EF1c hi\u1EC7n: ${e.message}`;
      }
      try {
        result = await chat.sendMessage([{
          functionResponse: {
            name: call.name,
            response: { result: funcResult }
          }
        }]);
      } catch (e) {
        console.error("Gemini function response error:", e);
      }
    }
    const text = result.response.text() || "Xin l\u1ED7i, t\xF4i kh\xF4ng th\u1EC3 x\u1EED l\xFD c\xE2u h\u1ECFi n\xE0y l\xFAc n\xE0y.";
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML"
      })
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return res.status(200).json({ error: error.message || "Internal server error" });
  }
}
export {
  handler as default
};
