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
            description: "Mục đích của câu lệnh: CREATE_ORDER, UPDATE_ORDER, REVIEW_ORDER, FIX_ORDER, CREATE_CUSTOMER, CREATE_PRODUCT, SEARCH_CUSTOMER, UPDATE_CUSTOMER, CREATE_PAYMENT, INVENTORY_ACTION, UNKNOWN",
        },
        order_id: {
            type: SchemaType.STRING,
            description: "ID đơn hàng cần cập nhật (intent UPDATE_ORDER). VD: 6UTWIUJZ, ABC12345",
            nullable: true
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
- Nếu người dùng yêu cầu THÊM SẢN PHẨM VÀO ĐƠN CŨ hoặc SỬA ĐƠN CŨ bằng ID (VD: "thêm sắt hộp vào đơn 6UTWIUJZ", "sửa đơn ID ABC thêm 2 tấm nhựa", "bổ sung xi măng vào đơn hàng XYZ", "thêm vào đơn", "cập nhật đơn"): Gán intent là UPDATE_ORDER. Trích xuất 'order_id' (ID đơn hàng, VD: 6UTWIUJZ). Trích xuất danh sách sản phẩm cần THÊM vào mảng 'products' (tên, số lượng, BẮT BUỘC category). Nếu thiếu ID đơn hàng, thêm "ID đơn hàng" vào 'missing_info'. LƯU Ý: Hành động này là THÊM sản phẩm, KHÔNG phải thay thế toàn bộ đơn. ĐỌC DANH SÁCH THAM KHẢO để lấy CHÍNH XÁC category cho từng sản phẩm.
  + ⚠️ KHI NGƯỜI DÙNG SỬA SAI / PHẢN HỒI: Nếu người dùng nói "sai rồi", "giá sai", "chưa đúng", "sửa lại", "làm lại" SAU KHI bot vừa thực hiện UPDATE_ORDER hoặc CREATE_ORDER, bạn PHẢI GIỮ intent cũ (UPDATE_ORDER hoặc CREATE_ORDER) và CHỈ sửa phần bị sai. TUYỆT ĐỐI KHÔNG chuyển sang UNKNOWN hay xin lỗi suông. Hãy đọc lại context và lấy đúng category từ danh sách tham khảo.
- Nếu người dùng yêu cầu GỘP ĐƠN hoặc GOM ĐƠN từ nhiều ảnh (VD: "gộp 2 đơn hàng trong 2 hình thành 1 đơn", "gom đơn từ ảnh"): LUÔN dùng intent CREATE_ORDER. Chỉ trích xuất sản phẩm từ các ảnh, bỏ qua mã đơn (ID). Tuyệt đối không dùng REVIEW_ORDER hay ghép ID.
- Nếu người dùng yêu cầu XEM hoặc KIỂM TRA đơn hàng (VD: "check đơn 6UTWIUJZ", "xem đơn hàng ABC", "kiểm tra đơn XYZ", "review order"): Gán intent là REVIEW_ORDER. Trích xuất 'order_id'. Bot sẽ tự động fetch và hiển thị chi tiết đơn hàng.
- Nếu người dùng yêu cầu SỬA hoặc FIX đơn hàng (VD: "sửa đơn 6UTWIUJZ", "fix đơn ABC", "tự sửa lỗi đơn XYZ"): Gán intent là FIX_ORDER. Trích xuất 'order_id'. Bot sẽ tự động tìm các mặt hàng lỗi (qty=0, thiếu giá, thiếu productId) và match với sản phẩm trong kho để sửa.
- Nếu người dùng yêu cầu Tạo sản phẩm (CREATE_PRODUCT): Bạn có thể nhận diện một hoặc nhiều sản phẩm cùng lúc. Bắt buộc phải có Tên sản phẩm và Danh mục (category). Nếu người dùng chưa cung cấp danh mục sản phẩm, HÃY THÊM "Danh mục sản phẩm" vào mảng 'missing_info' và hỏi lại người dùng. TUYỆT ĐỐI KHÔNG tự ý gán danh mục mặc định. Các thông tin khác (Quy cách, Trọng lượng, Đóng gói, Giá nhập, Giá bán) có thì lấy, không có thì để trống (null). Điền tất cả vào mảng 'products_to_create'. Ở trường 'message', hãy tóm tắt ngắn gọn số lượng sản phẩm bạn nhận diện được và nhắc nhở họ kiểm tra lại (VD: "Em đã nhận diện được 2 sản phẩm. Tuy nhiên sản phẩm A chưa có danh mục. Anh/chị cho em biết danh mục nhé!").
- Nếu người dùng yêu cầu Điều chỉnh tồn kho / Nhập kho / Xuất kho / Chụp ảnh tồn kho (INVENTORY_ACTION): Gán intent là INVENTORY_ACTION. Trích xuất loại phiếu kho ('import' hoặc 'export') vào inventory_action.type và điền danh sách mặt hàng cùng số lượng tương ứng vào mảng products. Nếu sản phẩm không tồn tại trong danh sách tham khảo, vui lòng điền thông báo lỗi vào trường message. Bắt buộc phải có tên sản phẩm và số lượng.
  + 📸 KHI NHẬN ẢNH TỒN KHO: Nếu người dùng gửi ảnh chụp hàng hóa/kho hàng kèm tin nhắn như "check kho", "cập nhật tồn", "nhập kho", "xuất kho", "kiểm kê": Hãy quan sát kỹ ảnh để đếm SỐ LƯỢNG và nhận diện TÊN SẢN PHẨM. Sau đó ĐỐI CHIẾU với danh sách tham khảo để tìm sản phẩm khớp. Điền intent=INVENTORY_ACTION, inventory_action.type="import" (nếu là nhập kho) hoặc "export" (nếu xuất kho). Trong message, ghi rõ bạn thấy bao nhiêu sản phẩm, số lượng từng loại.
- Nếu người dùng gửi LINK GOOGLE SHEET và yêu cầu IMPORT TỒN KHO (VD: "import kho https://docs.google.com/...", "cập nhật tồn từ sheet", "import sheet"): Gán intent là IMPORT_INVENTORY. Trích xuất TOÀN BỘ URL Google Sheet vào trường 'import_url'. Trong message, hãy xác nhận bạn đã nhận link và sẽ xử lý. TUYỆT ĐỐI KHÔNG tự ý thêm sản phẩm vào mảng 'products'.
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


// ⏱️ Timeout + Retry utilities
const FETCH_TIMEOUT = 25000; // 25s cho proxy
const SDK_TIMEOUT = 20000;   // 20s cho SDK
const MAX_RETRIES = 2;       // Retry 2 lần (tổng 3 attempts)
const RETRY_DELAYS = [1000, 3000, 5000]; // ms giữa các lần retry

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(timer);
    }
}

async function retryWithBackoff<T>(fn: () => Promise<T>, retries: number = MAX_RETRIES, delays: number[] = RETRY_DELAYS): Promise<T> {
    let lastError: any;
    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        } catch (err: any) {
            lastError = err;
            // Không retry nếu là lỗi ko recoverable (400, 401, 403)
            if (err.name === 'AbortError' || err.message?.includes('timeout')) {
                console.warn(`⏱️ Attempt ${i + 1}/${retries + 1} timed out`);
            } else if (err.status === 400 || err.status === 401 || err.status === 403) {
                throw err; // No retry for client errors
            }
            if (i < retries) {
                const delay = delays[i] || delays[delays.length - 1];
                console.warn(`🔄 Retry ${i + 1}/${retries} in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
}

// 🔐 Gọi qua Vercel proxy (bảo mật, key nằm server-side)
async function callViaProxy(prompt: string): Promise<any> {
    return retryWithBackoff(async () => {
        const res = await fetchWithTimeout('/api/gemini-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
        }, FETCH_TIMEOUT);

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            const error: any = new Error(err.error || `Proxy error: ${res.status}`);
            error.status = res.status;
            throw error;
        }

        const data = await res.json();
        return JSON.parse(data.text || '{}');
    });
}

// 🏠 Fallback: gọi trực tiếp SDK (local dev)
async function callViaSDK(prompt: string): Promise<any> {
    return retryWithBackoff(async () => {
        const model = getSDKModel();
        if (!model) throw new Error("Gemini SDK not available (no API key)");
        
        // SDK không có AbortController built-in, dùng Promise.race
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('SDK call timed out')), SDK_TIMEOUT)
        );
        
        const resultPromise = model.generateContent(prompt).then((result: any) => {
            const text = result.response.text();
            return JSON.parse(text);
        });
        
        return Promise.race([resultPromise, timeoutPromise]);
    });
}

// 📸 Phân tích ảnh qua Gemini Vision
async function callVisionViaProxy(prompt: string, images: { base64: string; mimeType: string }[]): Promise<any> {
    return retryWithBackoff(async () => {
        const res = await fetchWithTimeout('/api/gemini-vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, images }),
        }, FETCH_TIMEOUT);

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            const error: any = new Error(err.error || `Vision proxy error: ${res.status}`);
            error.status = res.status;
            throw error;
        }

        const data = await res.json();
        return JSON.parse(data.text || '{}');
    });
}

// 🎙️ Phân tích ảnh qua SDK (fallback)
async function callVisionViaSDK(prompt: string, images: { base64: string; mimeType: string }[]): Promise<any> {
    return retryWithBackoff(async () => {
        if (!_genAI && apiKey) {
            _genAI = new GoogleGenerativeAI(apiKey);
        }
        if (!_genAI) throw new Error("Gemini SDK not available");

        const model = _genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const parts: any[] = [{ text: prompt }];
        for (const img of images) {
            parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
        }

        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Vision SDK call timed out')), SDK_TIMEOUT)
        );

        const resultPromise = model.generateContent(parts).then((result: any) => {
            let text = result.response.text();
            // 🔧 Strip markdown code blocks nếu Gemini bọc trong ```json
            text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
            try {
                return JSON.parse(text);
            } catch {
                return { intent: "UNKNOWN", message: text };
            }
        });

        return Promise.race([resultPromise, timeoutPromise]);
    });
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
    images: { base64: string; mimeType: string }[],
    message?: string,
    context?: string
) => {
    const prompt = `${SYSTEM_PROMPT}

NGỮ CẢNH ĐẶC BIỆT CHO ẢNH:
Bạn đang xem ${images.length > 1 ? images.length + ' bức ảnh' : 'một bức ảnh'} do người dùng gửi.

Hãy xác định loại ảnh và xử lý tương ứng:

📋 Nếu là PHIẾU GIAO HÀNG / HOÁ ĐƠN:
${images.length > 1 ? '⚠️ GỘP ĐƠN: Đây là NHIỀU PHIẾU KHÁC NHAU → intent=CREATE_ORDER. Gộp TẤT CẢ sản phẩm, cộng dồn shipping_fee và discount. KHÔNG cộng dồn số lượng sản phẩm trùng tên — giữ nguyên từng dòng riêng biệt.' : ''}
- Trích xuất TẤT CẢ sản phẩm với tên, số lượng, đơn giá.
- Trích xuất phí vận chuyển, chiết khấu, tổng tiền nếu có.
- TUYỆT ĐỐI KHÔNG trích xuất mã đơn hàng (ID) từ ảnh.

📦 Nếu là ẢNH CHỤP HÀNG HÓA / KHO HÀNG / TỒN KHO:
- Người dùng muốn CẬP NHẬT TỒN KHO → intent=INVENTORY_ACTION.
- ĐẾM CHÍNH XÁC số lượng từng loại sản phẩm trong ảnh.
- Dùng tên sản phẩm để tra cứu trong danh sách tham khảo.
- Nếu tin nhắn kèm theo nói "nhập kho", "nhập hàng" → inventory_action.type="import".
- Nếu nói "xuất kho", "bán ra" → inventory_action.type="export".
- Mặc định → "import".

👤 Nếu là THÔNG TIN KHÁCH HÀNG (danh thiếp, giấy tờ):
- Trích xuất tên, SĐT, địa chỉ.

⚠️ QUY TẮC CHUNG CHO ẢNH:
- ĐỌC SỐ CỰC KỲ CẨN THẬN, không suy diễn.
- KHÔNG GỘP SỐ LƯỢNG sản phẩm trùng tên từ nhiều ảnh.
- Nếu có nhiều ảnh chụp cùng 1 lô hàng → cộng dồn số lượng cho INVENTORY.
- Nếu người dùng nói "gộp đơn", "gom đơn" → intent LUÔN là CREATE_ORDER.

${context ? `\nDỮ LIỆU THAM KHẢO TỪ HỆ THỐNG (dùng để map tên + giá → danh mục chính xác):\n${context}\n` : ''}
${message ? `\nTin nhắn kèm theo: "${message}"` : ''}

⚠️ QUY TẮC MAP DANH MỤC: Với mỗi sản phẩm, dùng TÊN và ĐƠN GIÁ để tìm sản phẩm khớp nhất trong dữ liệu tham khảo, rồi lấy category từ đó. Nếu không tìm thấy sản phẩm khớp, dùng category của sản phẩm có tên gần giống nhất.

Hãy trả lời dạng JSON theo schema, với intent phù hợp và message mô tả những gì bạn thấy trong ảnh.`;

    try {
        if (USE_PROXY) {
            try {
                return await callVisionViaProxy(prompt, images);
            } catch (proxyErr: any) {
                // 🔄 Fallback: gọi thẳng SDK nếu proxy timeout hoặc lỗi
                console.warn('Vision proxy failed, falling back to SDK:', proxyErr.message);
                if (apiKey) return await callVisionViaSDK(prompt, images);
                throw proxyErr;
            }
        }
        return await callVisionViaSDK(prompt, images);
    } catch (error: any) {
        console.error("Vision API Error:", error);
        if (error.message?.includes('429') || error.message?.includes('exhausted')) {
            throw new Error("Bot đang quá tải, anh/chị đợi 1-2 phút rồi thử lại nhé!");
        }
        throw new Error(error.message || "Bot không thể phân tích ảnh này. Anh/chị thử chụp lại rõ hơn nhé!");
    }
};
