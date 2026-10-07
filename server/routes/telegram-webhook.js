import * as db from '../db.js';
import { sendTelegramMessage } from '../telegram-helper.js';

function now() {
  return new Date().toISOString();
}

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed. Use POST." });

  const deepseekApiKey = process.env.DEEPSEEK_API_KEY || "sk-5ced935df4be41938479954151790443";
  if (!deepseekApiKey) {
    console.error("DEEPSEEK_API_KEY not configured on server");
    return res.status(500).json({ error: "DEEPSEEK_API_KEY not configured on server" });
  }

  try {
    const ownerId = req.query.ownerId;
    if (!ownerId) return res.status(400).json({ error: "Missing ownerId" });

    const body = req.body;
    if (!body || !body.message || !body.message.chat) {
      return res.status(200).json({ status: "ignored" });
    }

    const userMessage = body.message.text || body.message.caption || "";
    const chatId = body.message.chat.id;
    const chatType = body.message.chat.type;

    if (chatType === "group" || chatType === "supergroup") {
      if (!userMessage.toLowerCase().includes("dunvex bot")) {
        return res.status(200).json({ status: "ignored_group_chatter" });
      }
    }

    // Validate API key & bot token
    const apiKeys = db.getAll('api_keys');
    const keyDoc = apiKeys.find(k => k.ownerId === ownerId || k.id === ownerId);
    if (!keyDoc) return res.status(403).json({ error: "Owner not found" });

    const botToken = keyDoc.telegramBotToken;
    if (!botToken || keyDoc.enabled !== true) {
      return res.status(403).json({ error: "Invalid or disabled bot token" });
    }

    // Lưu chat ID
    const isGroupChat = chatType === "group" || chatType === "supergroup";
    const chatIdField = isGroupChat ? "telegramGroupChatId" : "telegramChatId";
    const currentValue = keyDoc[chatIdField];
    if (!currentValue || currentValue !== String(chatId)) {
      db.update('api_keys', keyDoc.id, { [chatIdField]: String(chatId), updatedAt: now() });
    }

    // Lấy dữ liệu (Ưu tiên: profiles -> users -> settings)
    const profileDoc = db.get('profiles', ownerId);
    const users = db.getAll('users');
    const userDoc = users.find(u => u.ownerId === ownerId || u.id === ownerId);
    const settingsDoc = db.get('settings', ownerId);
    const adminName = profileDoc?.displayName || userDoc?.displayName || userDoc?.name || settingsDoc?.adminName || settingsDoc?.name || "Admin";

    const customers = db.getAll('customers', {
      where: [{ field: 'ownerId', op: '==', value: ownerId }]
    });
    const customersWithDebt = customers
      .filter(c => Number(c.totalDebt ?? c.debt ?? 0) > 0)
      .map(c => ({
        name: c.name || '',
        debt: Number(c.totalDebt ?? c.debt ?? 0),
        days: c.debtDays || 0
      }));

    const suppliers = db.getAll('suppliers', {
      where: [{ field: 'ownerId', op: '==', value: ownerId }]
    });
    const supplierDebts = db.getAll('supplier_debts', {
      where: [{ field: 'ownerId', op: '==', value: ownerId }]
    });

    const suppliersWithDebt = [];
    for (const s of suppliers) {
      const sDebts = supplierDebts.filter(d => d.supplierId === s.id);
      const netDebt = sDebts.reduce((sum, d) => {
        const amount = Number(d.amount || 0);
        return d.type === "debt_increase" ? sum + amount : d.type === "payment" ? sum - amount : sum;
      }, 0);
      if (netDebt > 0) {
        suppliersWithDebt.push({ name: s.name || '', debt: netDebt });
      }
    }

    const recentOrders = db.getAll('orders', {
      where: [{ field: 'ownerId', op: '==', value: ownerId }],
      orderBy: { field: 'createdAt', direction: 'desc' },
      limit: 50
    });

    const ordersData = recentOrders.map(o => {
      const emailName = o.createdByEmail ? o.createdByEmail.split("@")[0] : "";
      const fallbackStaff = o.createdBy === ownerId ? adminName : emailName || "Nhân viên";
      return {
        customerName: o.customerName || '',
        totalAmount: Number(o.totalAmount || 0),
        staffName: o.createdByDisplayName || o.staffName || fallbackStaff,
        date: o.orderDate || ''
      };
    });

    // System prompt cho Gemini
    const systemPrompt = `Bạn là trợ lý AI (tên là dunvex bot) phục vụ ĐỘC QUYỀN cho tài khoản: ${adminName} của phần mềm quản lý Dunvex Build.
Nhiệm vụ của bạn: Trả lời tự nhiên, thân thiện và cung cấp thông tin chính xác từ hệ thống.
QUY TẮC QUAN TRỌNG: 
1. BẮT BUỘC SỬ DỤNG HTML ĐỂ ĐỊNH DẠNG (ví dụ: <b>chữ đậm</b>, <i>chữ nghiêng</i>). 
2. TUYỆT ĐỐI KHÔNG DÙNG MARKDOWN (không dùng dấu * hay ** hay #).
3. HIỆN TẠI BẠN CÓ KHẢ NĂNG SỬ DỤNG CÔNG CỤ (TOOLS). Khi người dùng yêu cầu tạo đơn hàng, sửa đơn hàng, hay chỉnh sửa công nợ, HÃY GỌI HÀM TƯƠNG ỨNG.
4. Báo cáo doanh thu hoặc công nợ một cách dễ hiểu, format tiền tệ VNĐ (ví dụ: 10.000.000đ).
5. Nhắc đến tên admin là ${adminName} nếu người dùng hỏi bạn đang phục vụ ai.

--- DỮ LIỆU HIỆN TẠI ---
Khách hàng đang có công nợ:
${customersWithDebt.map(c => `- ${c.name}: Nợ ${c.debt.toLocaleString("vi-VN")}đ (Số ngày: ${c.days})`).join("\n") || "Không có khách nợ."}

Nhà cung cấp đang có công nợ:
${suppliersWithDebt.map(s => `- ${s.name}: Đang nợ ${s.debt.toLocaleString("vi-VN")}đ`).join("\n") || "Không có nợ nhà cung cấp."}

50 Đơn hàng gần nhất:
${ordersData.map(o => `- ${o.customerName}: ${o.totalAmount.toLocaleString("vi-VN")}đ (Nhân viên: ${o.staffName}, Ngày: ${new Date(o.date).toLocaleDateString("vi-VN")})`).join("\n") || "Chưa có đơn hàng."}
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
          description: "Thêm hoặc trừ công nợ của khách hàng.",
          parameters: {
            type: "object",
            properties: {
              customerName: { type: "string", description: "Tên khách hàng" },
              adjustmentAmount: { type: "number", description: "Số tiền thay đổi (âm = trả nợ, dương = thêm nợ)" }
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
          "Authorization": `Bearer ${deepseekApiKey}`
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
          db.create('orders', {
            ownerId,
            customerName,
            totalAmount: Number(totalAmount),
            status: "Đơn chốt",
            createdAt: now(),
            createdBy: "Telegram Bot"
          });
          funcResult = `Tạo đơn hàng thành công cho ${customerName} với số tiền ${totalAmount}đ`;
        } else if (toolCall.function.name === "update_customer_debt") {
          const { customerName, adjustmentAmount } = args;
          const matched = customers.find(c => c.name === customerName);
          if (matched) {
            const currentDebt = Number(matched.debt || 0);
            const newDebt = currentDebt + Number(adjustmentAmount);
            db.update('customers', matched.id, { debt: newDebt, updatedAt: now() });
            funcResult = `Đã cập nhật công nợ cho ${customerName}. Nợ cũ: ${currentDebt}đ, Nợ mới: ${newDebt}đ`;
          } else {
            funcResult = `Không tìm thấy khách hàng nào tên ${customerName}.`;
          }
        }
      } catch (e) {
        funcResult = `Lỗi hệ thống: ${e.message}`;
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
            "Authorization": `Bearer ${deepseekApiKey}`
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

    await sendTelegramMessage(botToken, chatId, text);

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("Telegram webhook error:", error);
    return res.status(200).json({ error: error.message || "Internal server error" });
  }
}

export { handler as default };
