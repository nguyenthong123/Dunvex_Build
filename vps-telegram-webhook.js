import crypto from "crypto";
const PROJECT_ID = "dunvex-89461";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "sk-5ced935df4be41938479954151790443";
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
  if (!DEEPSEEK_API_KEY) {
    console.error("DEEPSEEK_API_KEY not configured on server");
    return res.status(500).json({ error: "DEEPSEEK_API_KEY not configured on server" });
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
      const fallbackStaff = o.fields?.createdBy?.stringValue === ownerId ? adminName : emailName || "Nhân viên";
      return {
        customerName: o.fields?.customerName?.stringValue || "",
        totalAmount: Number(o.fields?.totalAmount?.integerValue || o.fields?.totalAmount?.doubleValue || 0),
        staffName: o.fields?.createdByDisplayName?.stringValue || o.fields?.staffName?.stringValue || fallbackStaff,
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
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ];

    const tools = [
      {
        type: "function",
        function: {
          name: "create_order",
          description: "Tạo đơn hàng mới cho khách hàng.",
          parameters: {
            type: "object",
            properties: {
              customerName: { type: "string", description: "Tên khách hàng" },
              totalAmount: { type: "number", description: "Tổng tiền đơn hàng (VNĐ)" }
            },
            required: ["customerName", "totalAmount"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_customer_debt",
          description: "Thêm hoặc trừ công nợ của khách hàng (VD: khách trả nợ thì trừ nợ, khách mua nợ thì thêm nợ).",
          parameters: {
            type: "object",
            properties: {
              customerName: { type: "string", description: "Tên khách hàng" },
              adjustmentAmount: { type: "number", description: "Số tiền thay đổi (số âm nếu khách trả nợ / giảm nợ, số dương nếu khách nợ thêm)" }
            },
            required: ["customerName", "adjustmentAmount"]
          }
        }
      }
    ];

    let response;
    try {
      response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages,
          tools,
          tool_choice: "auto",
          temperature: 0.1
        })
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`DeepSeek API error ${response.status}: ${errText}`);
      }
    } catch (e) {
      console.error("DeepSeek API error:", e);
      return res.status(500).json({ error: "Lỗi khi gọi AI", details: e.message });
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const assistantMessage = choice?.message;
    const toolCalls = assistantMessage?.tool_calls;

    let text = "";

    if (toolCalls && toolCalls.length > 0) {
      const toolCall = toolCalls[0];
      let funcResult = "";
      try {
        const args = JSON.parse(toolCall.function.arguments || "{}");
        if (toolCall.function.name === "create_order") {
          const { customerName, totalAmount } = args;
          await restCreate(token, "orders", {
            ownerId: { stringValue: ownerId },
            customerName: { stringValue: customerName },
            totalAmount: { integerValue: String(totalAmount) },
            status: { stringValue: "Đơn chốt" },
            createdAt: { timestampValue: new Date().toISOString() },
            createdBy: { stringValue: "Telegram Bot" }
          });
          funcResult = `Tạo đơn hàng thành công cho ${customerName} với số tiền ${totalAmount}đ`;
        } else if (toolCall.function.name === "update_customer_debt") {
          const { customerName, adjustmentAmount } = args;
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
            funcResult = `Đã cập nhật công nợ cho ${customerName}. Nợ cũ: ${currentDebt}đ, Nợ mới: ${newDebt}đ`;
          } else {
            funcResult = `Không tìm thấy khách hàng nào tên ${customerName}. Yêu cầu quản trị viên kiểm tra lại tên.`;
          }
        }
      } catch (e) {
        funcResult = `Lỗi hệ thống khi thực hiện: ${e.message}`;
      }

      // Send the tool response back to DeepSeek to get the final conversational response
      messages.push(assistantMessage);
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: funcResult
      });

      try {
        const finalResponse = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages
          })
        });
        if (!finalResponse.ok) {
          const errText = await finalResponse.text();
          throw new Error(`DeepSeek final API error: ${errText}`);
        }
        const finalData = await finalResponse.json();
        text = finalData.choices?.[0]?.message?.content || "Không có phản hồi.";
      } catch (e) {
        console.error("DeepSeek function response send error:", e);
        text = `Đã thực hiện lệnh: ${funcResult}`;
      }
    } else {
      text = assistantMessage?.content || "Xin lỗi, tôi không thể xử lý câu hỏi này lúc này.";
    }
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
