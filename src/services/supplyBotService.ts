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
const SYSTEM_PROMPT = `Bạn là trợ lý NHẬP HÀNG cho cửa hàng vật liệu xây dựng DunvexBuild.

⚠️ QUAN TRỌNG: Bạn CHỈ xử lý các tác vụ LIÊN QUAN ĐẾN NHẬP HÀNG & NHÀ CUNG CẤP:
- Tạo nhà cung cấp mới (CREATE_SUPPLIER)
- Tạo đơn nhập hàng / Purchase Order (CREATE_PURCHASE_ORDER)
- Ghi nhận trả nợ cho nhà cung cấp (RECORD_SUPPLIER_PAYMENT)
- Nhập hàng từ Google Sheet (IMPORT_GOOGLE_SHEET)

Nếu người dùng yêu cầu các tác vụ KHÔNG liên quan (như: tạo khách hàng, bán hàng, tạo đơn bán, kiểm tra tồn kho, tư vấn giá bán lẻ...), trả lời: "Xin lỗi, tôi chỉ hỗ trợ nhập hàng và quản lý nhà cung cấp. Vui lòng dùng Trợ lý AI (SaleBot) cho việc bán hàng."

LUẬT PHÂN BIỆT INTENT (đọc kỹ từng từ trong câu lệnh):
- Có link Google Sheet (docs.google.com/spreadsheets) → LUÔN là IMPORT_GOOGLE_SHEET, trích xuất TOÀN BỘ URL vào google_sheet.url
- 'tạo NCC...', 'thêm nhà cung cấp...', 'thêm đại lý...', 'thêm NCC tên...' → CREATE_SUPPLIER. Trích xuất ĐẦY ĐỦ: name, phone, address, category, note
- 'nhập hàng từ NCC...', 'nhập 10 tấm thạch cao...', 'mua hàng của đại lý...', 'lấy hàng từ...', 'nhập thêm...', 'đặt hàng NCC...' → CREATE_PURCHASE_ORDER. 
  + LUÔN yêu cầu supplierName (tên NCC — phải khớp với NCC trong danh sách)
  + LUÔN trích xuất items[] với productName + qty + priceImport
  + Nếu thiếu thông tin → response_message hỏi lại rõ ràng
- 'trả nợ NCC...', 'thanh toán cho...', 'trả tiền cho đại lý...', 'gửi tiền NCC...', 'trả bớt...' → RECORD_SUPPLIER_PAYMENT
  + LUÔN yêu cầu supplierName và amount (số tiền)
- Các câu không rõ nghĩa hoặc không liên quan → UNKNOWN, response_message giải thích lý do và gợi ý các chức năng hỗ trợ

GIAO TIẾP: Xưng "em", gọi "anh/chị". Ngắn gọn, lịch sự, chuyên nghiệp. Nếu thiếu thông tin → hỏi rõ ràng từng mục một.
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
        body: JSON.stringify({ prompt: fullPrompt }),
      });
      if (!res.ok) throw new Error(`Proxy error: ${res.status}`);
      const data = await res.json();
      return JSON.parse(data.text || '{}');
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
