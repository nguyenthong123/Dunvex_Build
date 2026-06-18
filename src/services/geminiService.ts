import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";

// 🔐 API Key — only used as fallback in local dev. Production uses Vercel proxy.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const USE_PROXY = true; // Set false for local dev without Vercel

if (!apiKey && !USE_PROXY) {
    console.warn("VITE_GEMINI_API_KEY is not defined in .env (proxy mode will be used)");
}

// Fallback SDK instance (local dev only)
let _genAI: GoogleGenerativeAI | null = null;
let _model: any = null;
function getSDKModel() {
    if (!_genAI && apiKey) {
        _genAI = new GoogleGenerativeAI(apiKey);
        _model = _genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: botResponseSchema,
                temperature: 0.1,
            }
        });
    }
    return _model;
}

// Định nghĩa JSON Schema cho Output để đảm bảo dữ liệu trả về chuẩn xác
const botResponseSchema: Schema = {
    type: SchemaType.OBJECT,
    properties: {
        intent: {
            type: SchemaType.STRING,
            description: "Mục đích của câu lệnh: CREATE_ORDER, CREATE_CUSTOMER, CREATE_PRODUCT, SEARCH_CUSTOMER, UPDATE_CUSTOMER, CREATE_PAYMENT, INVENTORY_ACTION, UNKNOWN",
        },
        search_query: {
            type: SchemaType.STRING,
            description: "Từ khoá dùng để tìm kiếm khách hàng (tên hoặc SĐT) khi intent là SEARCH_CUSTOMER",
            nullable: true
        },
        customer: {
            type: SchemaType.OBJECT,
            description: "Thông tin khách hàng trích xuất được",
            properties: {
                id: { type: SchemaType.STRING, description: "ID của khách hàng nếu thực hiện lệnh UPDATE_CUSTOMER (lấy từ kết quả SEARCH trong lịch sử chat)", nullable: true },
                name: { type: SchemaType.STRING, nullable: true },
                phone: { type: SchemaType.STRING, nullable: true },
                address: { type: SchemaType.STRING, nullable: true },
                type: { 
                    type: SchemaType.STRING, 
                    description: "Phân loại khách hàng: 'Chủ nhà', 'Thầu Thợ', 'Cửa Hàng', 'Đại Lý', ... Nếu không rõ mặc định là 'Chủ nhà'",
                    nullable: true 
                },
                use_current_location: {
                    type: SchemaType.BOOLEAN,
                    description: "True nếu người dùng yêu cầu dùng vị trí hiện tại của họ để làm địa chỉ/toạ độ khách hàng",
                    nullable: true
                }
            }
        },
        order_category: {
            type: SchemaType.STRING,
            description: "Danh mục giá chung cho toàn bộ đơn hàng (VD: Giá tại kho, Giá thợ, Giá bán lẻ...). Ghi nhận nếu câu lệnh yêu cầu áp dụng một mức giá chung cho tất cả các mặt hàng.",
            nullable: true
        },
        payment_info: {
            type: SchemaType.OBJECT,
            description: "Thông tin thu công nợ khi intent là CREATE_PAYMENT",
            properties: {
                amount: { type: SchemaType.NUMBER, nullable: true, description: "Số tiền thu" },
                note: { type: SchemaType.STRING, nullable: true, description: "Nội dung thu" }
            }
        },
        products_to_create: {
            type: SchemaType.ARRAY,
            description: "Danh sách thông tin các sản phẩm cần tạo mới khi intent là CREATE_PRODUCT",
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    name: { type: SchemaType.STRING, nullable: true },
                    category: { type: SchemaType.STRING, nullable: true },
                    specs: { type: SchemaType.STRING, nullable: true, description: "Quy cách sản phẩm" },
                    weight: { type: SchemaType.STRING, nullable: true, description: "Trọng lượng" },
                    packaging: { type: SchemaType.STRING, nullable: true, description: "Đóng gói" },
                    import_price: { type: SchemaType.NUMBER, nullable: true, description: "Giá nhập" },
                    retail_price: { type: SchemaType.NUMBER, nullable: true, description: "Giá bán" }
                }
            }
        },
        products: {
            type: SchemaType.ARRAY,
            description: "Danh sách mặt hàng trích xuất được dùng cho lệnh CREATE_ORDER",
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    name: { type: SchemaType.STRING },
                    quantity: { type: SchemaType.NUMBER },
                    unit: { type: SchemaType.STRING, nullable: true },
                    category: { type: SchemaType.STRING, description: "Danh mục giá (VD: Giá tại kho, Giá thợ, Giá bán lẻ...). Ghi nhận nếu câu lệnh có nhắc đến một loại giá chung cho mặt hàng.", nullable: true }
                }
            }
        },
        notes: {
            type: SchemaType.STRING,
            description: "Ghi chú đơn hàng (nếu có)",
            nullable: true
        },
        shipping_fee: {
            type: SchemaType.NUMBER,
            description: "Phí vận chuyển (nếu có nhắc đến, ví dụ: 'vận chuyển 400 ngàn' -> 400000)",
            nullable: true
        },
        discount_amount: {
            type: SchemaType.NUMBER,
            description: "Số tiền chiết khấu (nếu có nhắc đến, ví dụ: 'chiết khấu 200 ngàn' -> 200000)",
            nullable: true
        },
        inventory_action: {
            type: SchemaType.OBJECT,
            description: "Thông tin hành động kho khi intent là INVENTORY_ACTION",
            nullable: true,
            properties: {
                type: { type: SchemaType.STRING, description: "'import' (nếu là nhập kho) hoặc 'export' (nếu là xuất kho)" },
                note: { type: SchemaType.STRING, description: "Ghi chú phiếu kho nếu có", nullable: true }
            }
        },
        missing_info: {
            type: SchemaType.ARRAY,
            description: "Các thông tin còn thiếu cần hỏi lại người dùng",
            items: { type: SchemaType.STRING }
        },
        message: {
            type: SchemaType.STRING,
            description: "Câu phản hồi giao tiếp tự nhiên với người dùng (VD: Em đã tạo xong đơn cho anh Dũng, nhưng chưa có địa chỉ...)"
        }
    },
    required: ["intent", "message"]
};

const SYSTEM_PROMPT = `
Bạn là "SaleBot" - Trợ lý AI Đa nhiệm của hệ thống DunvexBuild. 
Nhiệm vụ của bạn là nhận tin nhắn và lịch sử hội thoại của người dùng để hiểu ngữ cảnh.
- Nếu tạo mới, trích xuất thông tin.
- Nếu tìm kiếm (SEARCH_CUSTOMER), trích xuất search_query (có thể là tên hoặc số điện thoại).
- Nếu người dùng yêu cầu Lên đơn (CREATE_ORDER): BẮT BUỘC trích xuất 'products' (bao gồm tên, số lượng, và category nếu có nhắc đến mức giá như giá tại kho, giá thợ, v.v.), 'order_category' (nếu có nhắc đến mức giá chung cho cả đơn), 'notes', 'shipping_fee', 'discount_amount'.
  + LƯU Ý KHI LÊN ĐƠN: TUYỆT ĐỐI KHÔNG BẮT BUỘC số điện thoại. Về địa chỉ: Nếu chưa có địa chỉ, hãy hỏi "Anh/chị muốn giao hàng ra công trình hay giao về địa chỉ mặc định?". Nếu khách chưa trả lời, hãy thêm "Nơi giao hàng (Mặc định hay Công trình)" vào 'missing_info'. TUYỆT ĐỐI KHÔNG đưa "phone" hay "address" hay "delivery_preference" (tiếng anh) vào mảng 'missing_info'. Phải dùng TIẾNG VIỆT rõ ràng cho các mục bị thiếu (VD: "Quy cách sản phẩm", "Nơi giao hàng").
- Nếu người dùng yêu cầu Tạo sản phẩm (CREATE_PRODUCT): Bạn có thể nhận diện một hoặc nhiều sản phẩm cùng lúc. Bắt buộc phải có Tên sản phẩm và Danh mục (category). Nếu người dùng chưa cung cấp danh mục sản phẩm, HÃY THÊM "Danh mục sản phẩm" vào mảng 'missing_info' và hỏi lại người dùng. TUYỆT ĐỐI KHÔNG tự ý gán danh mục mặc định. Các thông tin khác (Quy cách, Trọng lượng, Đóng gói, Giá nhập, Giá bán) có thì lấy, không có thì để trống (null). Điền tất cả vào mảng 'products_to_create'. Ở trường 'message', hãy tóm tắt ngắn gọn số lượng sản phẩm bạn nhận diện được và nhắc nhở họ kiểm tra lại (VD: "Em đã nhận diện được 2 sản phẩm. Tuy nhiên sản phẩm A chưa có danh mục. Anh/chị cho em biết danh mục nhé!").
- Nếu người dùng yêu cầu Điều chỉnh tồn kho / Nhập kho / Xuất kho (INVENTORY_ACTION): Gán intent là INVENTORY_ACTION. Trích xuất loại phiếu kho ('import' hoặc 'export') vào \`inventory_action.type\` và điền danh sách mặt hàng cùng số lượng tương ứng vào mảng \`products\`. Nếu sản phẩm không tồn tại trong danh sách tham khảo, vui lòng điền thông báo lỗi vào trường \`message\`. Bắt buộc phải có tên sản phẩm và số lượng.
- Nếu người dùng yêu cầu Thu công nợ / Nhập công nợ (CREATE_PAYMENT) HOẶC chỉ đơn giản hỏi "ai đang nợ", "hiển thị công nợ", "danh sách nợ": Hãy gán intent là CREATE_PAYMENT. Nếu thiếu tên khách hàng hoặc thiếu số tiền thu, liệt kê vào mảng 'missing_info' (Tên khách hàng, Số tiền thu). Ở trường 'message', hãy chủ động ĐỌC DỮ LIỆU THAM KHẢO và trả lời danh sách các khách hàng đang có nợ (nợ > 0), cùng với số nợ cụ thể của họ để người dùng chọn. VD: "Dạ, hiện tại có anh A nợ 10tr, chị B nợ 5tr. Anh/chị muốn thu của ai ạ?".
- KHI LÊN ĐƠN HÀNG (CREATE_ORDER): 
  + BẮT BUỘC trích xuất CHÍNH XÁC 100% CẢ 'category' (Danh mục) VÀ 'name' (Tên sản phẩm) y hệt như trong Danh sách tham khảo nếu sản phẩm đó THỰC SỰ TỒN TẠI. VD: khách gõ "pima 10", bạn tra cứu thấy khớp, phải điền vào JSON: 'category': 'Nhựa và phụ kiện...', 'name': 'tấm nhựa NANO PIMA 10'. 
  + ĐẶC BIỆT LƯU Ý: Nếu khách hàng CỐ TÌNH CHỈ ĐỊNH danh mục/loại giá (VD: "với đơn hàng này giá tại kho", "lấy giá thi công"), bạn PHẢI áp dụng danh mục đó (VD: "giá tại kho") cho 'category' của TẤT CẢ các sản phẩm trong đơn, thay vì lấy danh mục gốc trong từ điển.
  + KIỂM TRA TRÙNG LẶP SẢN PHẨM: Nếu mặt hàng người dùng yêu cầu khớp với NHIỀU sản phẩm có cùng tên nhưng khác Quy cách hoặc Giá bán trong Danh sách tham khảo, TUYỆT ĐỐI KHÔNG trích xuất ngay vào 'products' hay chuyển sang CREATE_ORDER/INVENTORY_ACTION. Thay vào đó, gán intent là UNKNOWN và báo lỗi trong 'message' yêu cầu người dùng chỉ định rõ họ muốn lấy mức giá hay quy cách nào (VD: "Dạ sản phẩm sơn sắt hiện có 3 mức giá/quy cách khác nhau. Anh/chị vui lòng xác nhận muốn lấy loại nào ạ?"). Chỉ khi người dùng đã chỉ định rõ ràng thì mới tiếp tục lên đơn.
  + TUYỆT ĐỐI KHÔNG TỰ SUY DIỄN: Nếu mặt hàng người dùng yêu cầu KHÔNG TỒN TẠI trong danh sách tham khảo hoặc tên quá khác biệt (VD: "phào cản" không có trong kho, không được tự ý lấy "len chân" hay "phào lệch"), bạn BẮT BUỘC KHÔNG trích xuất mặt hàng đó vào mảng 'products', và PHẢI báo lỗi rõ ràng ở trường 'message' (VD: "Dạ hiện tại trong danh mục sản phẩm không có loại 'phào cản', anh/chị vui lòng kiểm tra lại mã hoặc bấm Tạo sản phẩm nhé!").
- Tự động bổ sung thông tin còn thiếu nếu người dùng trả lời cho câu hỏi trước đó.
- LƯU Ý KHI SỬA ĐỔI (ĐIỀU CHỈNH): Nếu người dùng yêu cầu sửa đổi một thông tin nào đó (VD: "sửa số lượng tấm pima thành 10", "đổi tên thành anh hải"), bạn PHẢI ĐỌC dữ liệu "[Bản nháp đang có: ...]" trong lịch sử chat gần nhất của bạn. Bạn PHẢI kế thừa toàn bộ dữ liệu cũ của bản nháp đó và chỉ thay đổi phần được yêu cầu. Tuyệt đối không được làm mất các sản phẩm hoặc thông tin khách hàng đã trích xuất trước đó.
- TRA CỨU SẢN PHẨM / GIÁ: Nếu người dùng hỏi giá, hỏi thông tin sản phẩm, hoặc kiểm tra xem có mặt hàng nào đó không (VD: "giá tấm nano bao nhiêu", "có mã 10 không"): Hãy chủ động ĐỌC DỮ LIỆU THAM KHẢO về Danh sách Sản phẩm (sẽ có kèm giá bán) và trả lời kết quả trực tiếp ở trường 'message'. Gán intent là UNKNOWN.
- Nếu không rõ ràng, intent là UNKNOWN.

BẠN LÀ NHÂN VIÊN SALE, HÃY GIAO TIẾP LỊCH SỰ, CHUYÊN NGHIỆP VÀ NGẮN GỌN VỚI NGƯỜI DÙNG Ở TRƯỜNG \`message\` (Xưng em, gọi anh/chị). Báo giá một cách tự nhiên.
`.trim();

function buildPrompt(message: string, context?: string, chatHistory?: any[]): string {
    let prompt = `${SYSTEM_PROMPT}\n`;
    if (context) {
        prompt += `\nDỮ LIỆU THAM KHẢO TỪ HỆ THỐNG:\n${context}\nBẮT BUỘC:
1. Bạn phải trích xuất Tên Khách hàng và Tên Sản phẩm Y HỆT 100% như trong danh sách trên (copy/paste chính xác từng chữ) nếu có thể tìm thấy dữ liệu khớp. TUYỆT ĐỐI KHÔNG tự chế tên, không được "ép" một mặt hàng không liên quan vào đơn nếu không tìm thấy chính xác.
2. Lưu ý: Người dùng thường nói "tạo đơn hàng [tên khách hàng] lấy [sản phẩm]". Ví dụ: "đơn hàng thông nháp" -> Tên khách hàng là "thông nháp" (Hoặc "Thông Nháp" nếu có trong danh sách tham khảo). TUYỆT ĐỐI KHÔNG lưu tên khách hàng vào phần Ghi chú (notes) trừ khi đó thực sự là ghi chú.\n`;
    }
    if (chatHistory && chatHistory.length > 0) {
        prompt += `\nLỊCH SỬ HỘI THOẠI TRƯỚC ĐÓ:\n`;
        chatHistory.forEach((msg: any) => {
            prompt += `[${msg.role.toUpperCase()}]: ${msg.content}\n`;
        });
    }
    prompt += `\nTin nhắn người dùng hiện tại: "${message}"`;
    return prompt;
}

// 🔐 Gọi qua Vercel proxy (bảo mật, key nằm server-side)
async function callViaProxy(prompt: string): Promise<any> {
    const res = await fetch('/api/gemini-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Proxy error: ${res.status}`);
    }

    const data = await res.json();
    return JSON.parse(data.text || '{}');
}

// 🏠 Fallback: gọi trực tiếp SDK (local dev)
async function callViaSDK(prompt: string): Promise<any> {
    const model = getSDKModel();
    if (!model) throw new Error("Gemini SDK not available (no API key)");
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
}

// 📸 Phân tích ảnh qua Gemini Vision
async function callVisionViaProxy(prompt: string, imageBase64: string, mimeType: string): Promise<any> {
    const res = await fetch('/api/gemini-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, imageBase64, mimeType }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Vision proxy error: ${res.status}`);
    }

    const data = await res.json();
    return JSON.parse(data.text || '{}');
}

// 🎙️ Phân tích ảnh qua SDK (fallback)
async function callVisionViaSDK(prompt: string, imageBase64: string, mimeType: string): Promise<any> {
    if (!_genAI && apiKey) {
        _genAI = new GoogleGenerativeAI(apiKey);
    }
    if (!_genAI) throw new Error("Gemini SDK not available");

    const model = _genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent([
        { text: prompt },
        { inlineData: { mimeType, data: imageBase64 } }
    ]);
    const text = result.response.text();
    // Try to parse as JSON, fallback to raw text
    try {
        return JSON.parse(text);
    } catch {
        return { intent: "UNKNOWN", message: text };
    }
}

// ==================== EXPORTED FUNCTIONS ====================

/**
 * Parse tin nhắn văn bản từ người dùng
 */
export const parseSaleMessage = async (message: string, context?: string, chatHistory?: any[]) => {
    const prompt = buildPrompt(message, context, chatHistory);

    try {
        // 🔐 Dùng proxy trong production (key nằm server-side)
        if (USE_PROXY) {
            return await callViaProxy(prompt);
        }
        // 🏠 Fallback SDK cho local dev
        return await callViaSDK(prompt);
    } catch (error: any) {
        console.error("Gemini API Error:", error);

        // 🛡️ Fallback: nếu proxy lỗi, thử gọi thẳng SDK
        if (USE_PROXY && apiKey) {
            console.log("Proxy failed, trying direct SDK...");
            try {
                return await callViaSDK(prompt);
            } catch (sdkError: any) {
                console.error("SDK fallback also failed:", sdkError);
                throw new Error(error.message || sdkError.message || "Bot đang bận, anh/chị thử lại sau 1 phút nhé!");
            }
        }

        // 📱 Thân thiện với người dùng
        if (error.message?.includes('429') || error.message?.includes('exhausted')) {
            throw new Error("Bot đang quá tải, anh/chị đợi 1-2 phút rồi thử lại nhé!");
        }
        if (error.message?.includes('400') || error.message?.includes('invalid')) {
            throw new Error("Bot chưa hiểu ý anh/chị lắm, thử diễn đạt lại giúp em nhé!");
        }
        throw new Error(error.message || "Bot gặp lỗi kết nối, anh/chị thử lại sau ít phút ạ!");
    }
};

/**
 * 📸 Phân tích ảnh — trích xuất thông tin khách hàng/sản phẩm từ ảnh
 * @param imageBase64 - Ảnh dạng base64 (bỏ prefix data:image/...)
 * @param mimeType - VD: "image/jpeg", "image/png"
 * @param message - Tin nhắn kèm theo (optional)
 * @param context - Dữ liệu tham khảo hệ thống
 */
export const analyzeImage = async (
    imageBase64: string,
    mimeType: string,
    message?: string,
    context?: string
) => {
    const prompt = `${SYSTEM_PROMPT}

NGỮ CẢNH ĐẶC BIỆT CHO ẢNH:
Bạn đang xem một bức ảnh do người dùng gửi. Hãy quan sát kỹ:
- Nếu ảnh chứa DANH SÁCH SẢN PHẨM / BÁO GIÁ / HOÁ ĐƠN: Trích xuất tất cả sản phẩm trong ảnh.
- Nếu ảnh chứa THÔNG TIN KHÁCH HÀNG (danh thiếp, bảng hiệu, giấy tờ): Trích xuất tên, SĐT, địa chỉ.
- Nếu ảnh chứa CÔNG TRÌNH / HIỆN TRƯỜNG: Mô tả ngắn gọn và tạo khách hàng nếu có thông tin.
- Nếu ảnh chứa SẢN PHẨM CỤ THỂ: Nhận diện và tra cứu trong dữ liệu tham khảo.

${context ? `\nDỮ LIỆU THAM KHẢO TỪ HỆ THỐNG:\n${context}\n` : ''}
${message ? `\nTin nhắn kèm theo: "${message}"` : ''}

Hãy trả lời dạng JSON theo schema, với intent phù hợp và message mô tả những gì bạn thấy trong ảnh.`;

    try {
        if (USE_PROXY) {
            return await callVisionViaProxy(prompt, imageBase64, mimeType);
        }
        return await callVisionViaSDK(prompt, imageBase64, mimeType);
    } catch (error: any) {
        console.error("Vision API Error:", error);
        if (error.message?.includes('429') || error.message?.includes('exhausted')) {
            throw new Error("Bot đang quá tải, anh/chị đợi 1-2 phút rồi thử lại nhé!");
        }
        throw new Error(error.message || "Bot không thể phân tích ảnh này. Anh/chị thử chụp lại rõ hơn nhé!");
    }
};
