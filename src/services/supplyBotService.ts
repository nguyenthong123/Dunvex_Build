/**
 * SupplyBot Service — Bot AI chuyên biệt cho NHẬP HÀNG / NCC / CÔNG NỢ
 * Tách biệt với SaleBot để tránh nhầm lẫn intent giữa bán hàng và nhập hàng.
 */

import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const USE_PROXY = true;

let _genAI: GoogleGenerativeAI | null = null;
let _model: any = null;

function getSDKModel() {
  if (!_genAI && apiKey) {
    _genAI = new GoogleGenerativeAI(apiKey);
    _model = _genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: supplyBotSchema,
        temperature: 0.1,
      }
    });
  }
  return _model;
}

// ─── Schema cho Supply Bot ──────────────────────────────────
const supplyBotSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    intent: {
      type: SchemaType.STRING,
      description: "Mục đích: CREATE_SUPPLIER | CREATE_PURCHASE_ORDER | RECORD_SUPPLIER_PAYMENT | IMPORT_GOOGLE_SHEET | UNKNOWN",
    },
    supplier: {
      type: SchemaType.OBJECT,
      description: "Thông tin nhà cung cấp (khi intent=CREATE_SUPPLIER)",
      properties: {
        name: { type: SchemaType.STRING, description: "Tên nhà cung cấp / đại lý" },
        phone: { type: SchemaType.STRING, nullable: true, description: "Số điện thoại NCC" },
        address: { type: SchemaType.STRING, nullable: true, description: "Địa chỉ NCC" },
        category: { type: SchemaType.STRING, nullable: true, description: "Loại: Xi măng, Thạch cao, Sắt thép, Vật liệu khác" },
        note: { type: SchemaType.STRING, nullable: true, description: "Ghi chú thêm" },
      },
      nullable: true,
    },
    purchase_order: {
      type: SchemaType.OBJECT,
      description: "Thông tin đơn nhập hàng (khi intent=CREATE_PURCHASE_ORDER)",
      properties: {
        supplierName: { type: SchemaType.STRING, description: "Tên NCC — phải khớp chính xác với NCC trong danh sách" },
        paidAmount: { type: SchemaType.NUMBER, nullable: true, description: "Số tiền đã trả trước (nếu có). Mặc định 0 nếu mua nợ." },
        note: { type: SchemaType.STRING, nullable: true },
        items: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              productName: { type: SchemaType.STRING, description: "Tên sản phẩm nhập" },
              qty: { type: SchemaType.NUMBER, description: "Số lượng" },
              priceImport: { type: SchemaType.NUMBER, description: "Giá nhập / đơn vị (VNĐ)" },
            },
            required: ["productName", "qty", "priceImport"],
          },
        },
      },
      nullable: true,
    },
    supplier_payment: {
      type: SchemaType.OBJECT,
      description: "Thông tin trả nợ NCC (khi intent=RECORD_SUPPLIER_PAYMENT)",
      properties: {
        supplierName: { type: SchemaType.STRING, description: "Tên NCC trả nợ" },
        amount: { type: SchemaType.NUMBER, description: "Số tiền trả" },
        method: { type: SchemaType.STRING, nullable: true, description: "Tiền mặt hoặc Chuyển khoản" },
        note: { type: SchemaType.STRING, nullable: true },
      },
      nullable: true,
    },
    google_sheet: {
      type: SchemaType.OBJECT,
      description: "Link Google Sheet nhập hàng (khi intent=IMPORT_GOOGLE_SHEET)",
      properties: {
        url: { type: SchemaType.STRING, description: "URL Google Sheet" },
        supplierName: { type: SchemaType.STRING, nullable: true, description: "Tên NCC nếu có đề cập trong câu lệnh" },
      },
      nullable: true,
    },
    response_message: {
      type: SchemaType.STRING,
      description: "Phản hồi bằng tiếng Việt cho người dùng. Ngắn gọn, thân thiện.",
    },
  },
  required: ["intent", "response_message"],
};

// ─── Prompt hệ thống ──────────────────────────────────────
const SYSTEM_PROMPT = `Bạn là trợ lý NHẬP HÀNG cho cửa hàng vật liệu xây dựng.

⚠️ QUAN TRỌNG: Bạn CHỈ xử lý các tác vụ LIÊN QUAN ĐẾN NHẬP HÀNG:
- Tạo nhà cung cấp mới
- Tạo đơn nhập hàng (Purchase Order)
- Ghi nhận trả nợ cho nhà cung cấp
- Nhập hàng từ Google Sheet

Nếu người dùng yêu cầu các tác vụ KHÔNG liên quan (như: tạo khách hàng, bán hàng, tạo đơn bán, kiểm tra tồn kho, tư vấn giá...), trả lời: "Xin lỗi, tôi chỉ hỗ trợ nhập hàng và quản lý nhà cung cấp. Vui lòng dùng tính năng phù hợp."

LUẬT PHÂN BIỆT INTENT:
- 'nhập hàng từ NCC...', 'nhập 10 tấm thạch cao...', 'mua hàng của đại lý...', 'lấy hàng từ...' → CREATE_PURCHASE_ORDER
- 'thêm NCC...', 'tạo nhà cung cấp...', 'thêm đại lý...' → CREATE_SUPPLIER  
- 'trả nợ NCC...', 'thanh toán cho...', 'trả tiền cho đại lý...', 'gửi tiền NCC...' → RECORD_SUPPLIER_PAYMENT
- 'nhập link sheet...', 'import google sheet...', 'tạo đơn từ sheet...' → IMPORT_GOOGLE_SHEET
- Các câu không rõ nghĩa hoặc không liên quan → UNKNOWN, response_message giải thích lý do

Với CREATE_PURCHASE_ORDER: luôn yêu cầu supplierName (tên NCC), ít nhất 1 item với productName + qty + priceImport.
Với RECORD_SUPPLIER_PAYMENT: luôn yêu cầu supplierName và amount.
`;

// ─── Hàm chính: parse tin nhắn ────────────────────────────
export async function parseSupplyMessage(
  message: string,
  context?: {
    suppliers?: string; // Danh sách NCC hiện có (để fuzzy match)
    products?: string;  // Danh sách SP hiện có
  }
): Promise<{
  intent: string;
  supplier?: any;
  purchase_order?: any;
  supplier_payment?: any;
  google_sheet?: any;
  response_message: string;
}> {
  const systemContext = context
    ? `\n\nDANH SÁCH NCC HIỆN CÓ:\n${context.suppliers || '(trống)'}\n\nDANH SÁCH SẢN PHẨM HIỆN CÓ:\n${context.products || '(trống)'}`
    : '';

  const fullPrompt = SYSTEM_PROMPT + systemContext + `\n\nCÂU LỆNH CỦA NGƯỜI DÙNG: ${message}`;

  try {
    if (USE_PROXY) {
      const res = await fetch('/api/gemini-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, schema: supplyBotSchema }),
      });
      if (!res.ok) throw new Error(`Proxy error: ${res.status}`);
      return await res.json();
    } else {
      const model = getSDKModel();
      if (!model) throw new Error('Gemini SDK not available');
      const result = await model.generateContent([{ text: fullPrompt }]);
      return JSON.parse(result.response.text());
    }
  } catch (error) {
    console.error('SupplyBot parse error:', error);
    return {
      intent: 'UNKNOWN',
      response_message: 'Có lỗi xử lý, vui lòng thử lại.',
    };
  }
}
