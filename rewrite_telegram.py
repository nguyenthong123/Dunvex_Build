import re

with open('/Volumes/DATA_SSD/Projects/Dunvex_Build-main/api/telegram-webhook.ts', 'r') as f:
    content = f.read()

# 1. Add imports at the top
import_str = "import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai';\n"
content = import_str + content

# 2. Add restCreate and restPatch
helpers = """
async function restCreate(token: string, collection: string, fields: any) {
  const url = `${FIRESTORE_BASE}/${collection}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error(`Firestore POST ${collection} failed: ${res.status}`);
  return res.json();
}

async function restPatch(token: string, path: string, fields: any) {
  const keys = Object.keys(fields);
  const mask = keys.map(k => `updateMask.fieldPaths=${k}`).join('&');
  const url = `${FIRESTORE_BASE}/${path}?${mask}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error(`Firestore PATCH ${path} failed: ${res.status}`);
  return res.json();
}
"""
content = content.replace("export default async function handler", helpers + "\nexport default async function handler")

# 3. Replace the Gemini calling part
# Find from "// 3. Construct prompt" to "const text = ...;"
start_idx = content.find("// 3. Construct prompt")
end_idx = content.find("// Gửi tin nhắn lại Telegram")

old_part = content[start_idx:end_idx]

new_part = """// 3. Construct prompt
    const systemPrompt = `Bạn là trợ lý AI (tên là dunvex bot) phục vụ ĐỘC QUYỀN cho tài khoản: ${adminName} của phần mềm quản lý Dunvex Build.
Nhiệm vụ của bạn: Trả lời tự nhiên, thân thiện và cung cấp thông tin chính xác từ hệ thống.
QUY TẮC QUAN TRỌNG: 
1. BẮT BUỘC SỬ DỤNG HTML ĐỂ ĐỊNH DẠNG (ví dụ: <b>chữ đậm</b>, <i>chữ nghiêng</i>). 
2. TUYỆT ĐỐI KHÔNG DÙNG MARKDOWN (không dùng dấu * hay ** hay #). Các danh sách hãy dùng gạch đầu dòng (-) hoặc các emoji (👉, 📦, 💰, 👤).
3. HIỆN TẠI BẠN ĐÃ CÓ KHẢ NĂNG SỬ DỤNG CÔNG CỤ (TOOLS). Khi người dùng yêu cầu tạo đơn hàng, sửa đơn hàng, hay chỉnh sửa công nợ, HÃY GỌI HÀM TƯƠNG ỨNG.
4. Báo cáo doanh thu hoặc công nợ một cách dễ hiểu, format tiền tệ VNĐ (ví dụ: 10.000.000đ).
5. Nhắc đến tên admin là ${adminName} nếu người dùng hỏi bạn đang phục vụ ai.

--- DỮ LIỆU HIỆN TẠI TỪ HỆ THỐNG CỦA ADMIN: ${adminName} ---
Khách hàng đang có công nợ (Khách hàng nợ mình):
${customersWithDebt.map((c: any) => `- ${c.name}: Nợ ${c.debt.toLocaleString('vi-VN')}đ (Số ngày: ${c.days})`).join('\\n') || 'Không có khách nợ.'}

Nhà cung cấp đang có công nợ (Mình nợ NCC):
${suppliersWithDebt.map((s: any) => `- ${s.name}: Đang nợ ${s.debt.toLocaleString('vi-VN')}đ`).join('\\n') || 'Không có nợ nhà cung cấp.'}

50 Đơn hàng gần nhất (Khách hàng / Doanh thu / Nhân viên / Ngày):
${ordersData.map((o: any) => `- ${o.customerName}: ${o.totalAmount.toLocaleString('vi-VN')}đ (Nhân viên: ${o.staffName}, Ngày: ${new Date(o.date).toLocaleDateString('vi-VN')})`).join('\\n') || 'Chưa có đơn hàng.'}
------------------------------------------------`;

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      systemInstruction: systemPrompt,
      tools: [{
        functionDeclarations: [
          {
            name: "create_order",
            description: "Tạo đơn hàng mới cho khách hàng.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                customerName: { type: SchemaType.STRING, description: "Tên khách hàng" },
                totalAmount: { type: SchemaType.NUMBER, description: "Tổng tiền đơn hàng (VNĐ)" }
              },
              required: ["customerName", "totalAmount"]
            }
          },
          {
            name: "update_customer_debt",
            description: "Thêm hoặc trừ công nợ của khách hàng (VD: khách trả nợ thì trừ nợ, khách mua nợ thì thêm nợ).",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                customerName: { type: SchemaType.STRING, description: "Tên khách hàng" },
                adjustmentAmount: { type: SchemaType.NUMBER, description: "Số tiền thay đổi (số ÂM nếu khách trả nợ / giảm nợ, số DƯƠNG nếu khách nợ thêm)" }
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
    } catch (e: any) {
      console.error('Gemini error:', e);
      return res.status(500).json({ error: 'Lỗi khi gọi AI', details: e.message });
    }

    const call = result.response.functionCalls()?.[0];
    if (call) {
      let funcResult = "";
      try {
        if (call.name === "create_order") {
          const { customerName, totalAmount } = call.args;
          await restCreate(token, 'orders', {
            ownerId: { stringValue: ownerId },
            customerName: { stringValue: customerName },
            totalAmount: { integerValue: String(totalAmount) },
            status: { stringValue: 'Đơn chốt' },
            createdAt: { timestampValue: new Date().toISOString() },
            createdBy: { stringValue: 'Telegram Bot' }
          });
          funcResult = `Tạo đơn hàng thành công cho ${customerName} với số tiền ${totalAmount}đ`;
        } else if (call.name === "update_customer_debt") {
          const { customerName, adjustmentAmount } = call.args;
          const customers = await runStructuredQuery(token, 'customers', [
            { fieldFilter: { field: { fieldPath: 'ownerId' }, op: 'EQUAL', value: { stringValue: ownerId } } },
            { fieldFilter: { field: { fieldPath: 'name' }, op: 'EQUAL', value: { stringValue: customerName } } }
          ], 1);
          if (customers.length > 0) {
            const c = customers[0];
            const currentDebt = Number(c.fields?.debt?.integerValue || c.fields?.debt?.doubleValue || 0);
            const newDebt = currentDebt + Number(adjustmentAmount);
            const customerId = c.name.split('/').pop();
            await restPatch(token, `customers/${customerId}`, {
              debt: { integerValue: String(newDebt) }
            });
            funcResult = `Đã cập nhật công nợ cho ${customerName}. Nợ cũ: ${currentDebt}đ, Nợ mới: ${newDebt}đ`;
          } else {
            funcResult = `Không tìm thấy khách hàng nào tên ${customerName}. Yêu cầu quản trị viên kiểm tra lại tên.`;
          }
        }
      } catch (e: any) {
        funcResult = `Lỗi hệ thống khi thực hiện: ${e.message}`;
      }

      // Gửi kết quả lại cho Gemini
      try {
        result = await chat.sendMessage([{
          functionResponse: {
            name: call.name,
            response: { result: funcResult }
          }
        }]);
      } catch (e: any) {
        console.error('Gemini function response error:', e);
      }
    }

    const text = result.response.text() || 'Xin lỗi, tôi không thể xử lý câu hỏi này lúc này.';
    
    """

content = content.replace(old_part, new_part)

with open('/Volumes/DATA_SSD/Projects/Dunvex_Build-main/api/telegram-webhook.ts', 'w') as f:
    f.write(content)

print("Rewrite successful")
