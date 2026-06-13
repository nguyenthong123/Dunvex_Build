import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.warn("VITE_GEMINI_API_KEY is not defined in .env");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

// Định nghĩa JSON Schema cho Output để đảm bảo dữ liệu trả về chuẩn xác
const botResponseSchema: Schema = {
    type: SchemaType.OBJECT,
    properties: {
        intent: {
            type: SchemaType.STRING,
            description: "Mục đích của câu lệnh: CREATE_ORDER, CREATE_CUSTOMER, CREATE_PRODUCT, SEARCH_CUSTOMER, UPDATE_CUSTOMER, CREATE_PAYMENT, UNKNOWN",
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

// Khởi tạo model gemini-2.5-flash với cấu hình JSON
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: botResponseSchema,
        temperature: 0.1, // Nhiệt độ thấp để đảm bảo tính nhất quán của dữ liệu
    }
});

const SYSTEM_PROMPT = `
Bạn là "SaleBot" - Trợ lý AI Đa nhiệm của hệ thống DunvexBuild. 
Nhiệm vụ của bạn là nhận tin nhắn và lịch sử hội thoại của người dùng để hiểu ngữ cảnh.
- Nếu tạo mới, trích xuất thông tin.
- Nếu tìm kiếm (SEARCH_CUSTOMER), trích xuất search_query.
- Nếu người dùng yêu cầu Lên đơn (CREATE_ORDER): BẮT BUỘC trích xuất 'products' (bao gồm tên, số lượng, và category nếu có nhắc đến mức giá như giá tại kho, giá thợ, v.v.), 'order_category' (nếu có nhắc đến mức giá chung cho cả đơn), 'notes', 'shipping_fee', 'discount_amount'.
  + LƯU Ý KHI LÊN ĐƠN: TUYỆT ĐỐI KHÔNG BẮT BUỘC số điện thoại. Về địa chỉ: Nếu chưa có địa chỉ, hãy hỏi "Anh/chị muốn giao hàng ra công trình hay giao về địa chỉ mặc định?". Nếu khách chưa trả lời, hãy thêm "Nơi giao hàng (Mặc định hay Công trình)" vào 'missing_info'. TUYỆT ĐỐI KHÔNG đưa "phone" hay "address" hay "delivery_preference" (tiếng anh) vào mảng 'missing_info'. Phải dùng TIẾNG VIỆT rõ ràng cho các mục bị thiếu (VD: "Quy cách sản phẩm", "Nơi giao hàng").
- Nếu người dùng yêu cầu Tạo sản phẩm (CREATE_PRODUCT): Bạn có thể nhận diện một hoặc nhiều sản phẩm cùng lúc. Bắt buộc phải có Tên sản phẩm. Các thông tin khác (Danh mục, Quy cách, Trọng lượng, Đóng gói, Giá nhập, Giá bán) có thì lấy, không có thì để trống (null). Điền tất cả vào mảng 'products_to_create'. Ở trường 'message', hãy tóm tắt ngắn gọn số lượng sản phẩm bạn nhận diện được và nhắc nhở họ kiểm tra lại (VD: "Em đã nhận diện được 2 sản phẩm. Tuy nhiên sản phẩm A chưa có giá bán. Anh/chị xem bảng bên dưới, nếu ok thì bấm Tạo nhé!"). TUYỆT ĐỐI KHÔNG ép buộc người dùng phải cung cấp đủ 7 trường.
- Nếu người dùng yêu cầu Thu công nợ / Nhập công nợ (CREATE_PAYMENT) HOẶC chỉ đơn giản hỏi "ai đang nợ", "hiển thị công nợ", "danh sách nợ": Hãy gán intent là CREATE_PAYMENT. Nếu thiếu tên khách hàng hoặc thiếu số tiền thu, liệt kê vào mảng 'missing_info' (Tên khách hàng, Số tiền thu). Ở trường 'message', hãy chủ động ĐỌC DỮ LIỆU THAM KHẢO và trả lời danh sách các khách hàng đang có nợ (nợ > 0), cùng với số nợ cụ thể của họ để người dùng chọn. VD: "Dạ, hiện tại có anh A nợ 10tr, chị B nợ 5tr. Anh/chị muốn thu của ai ạ?".
- KHI LÊN ĐƠN HÀNG (CREATE_ORDER): Bạn PHẢI đối chiếu tên sản phẩm khách gọi với Danh sách Sản phẩm tham khảo. Hãy trích xuất 'name' CHÍNH XÁC 100% như trong Danh sách. Nếu khách gõ tắt hoặc sai (VD: "pima 10"), hãy tự động sửa lại thành tên chuẩn (VD: "tấm nhựa NANO PIMA 10"). Nếu mặt hàng hoàn toàn không tồn tại (như khách gọi mã 11 nhưng kho chỉ có 10), cứ trích xuất nguyên văn nhưng BẮT BUỘC cảnh báo ở trường 'message' (VD: "Em không tìm thấy mã 11 trong kho, anh/chị xem lại nhé!").
- Tự động bổ sung thông tin còn thiếu nếu người dùng trả lời cho câu hỏi trước đó.
- LƯU Ý KHI SỬA ĐỔI (ĐIỀU CHỈNH): Nếu người dùng yêu cầu sửa đổi một thông tin nào đó (VD: "sửa số lượng tấm pima thành 10", "đổi tên thành anh hải"), bạn PHẢI ĐỌC dữ liệu "[Bản nháp đang có: ...]" trong lịch sử chat gần nhất của bạn. Bạn PHẢI kế thừa toàn bộ dữ liệu cũ của bản nháp đó và chỉ thay đổi phần được yêu cầu. Tuyệt đối không được làm mất các sản phẩm hoặc thông tin khách hàng đã trích xuất trước đó.
- TRA CỨU SẢN PHẨM / GIÁ: Nếu người dùng hỏi giá, hỏi thông tin sản phẩm, hoặc kiểm tra xem có mặt hàng nào đó không (VD: "giá tấm nano bao nhiêu", "có mã 10 không"): Hãy chủ động ĐỌC DỮ LIỆU THAM KHẢO về Danh sách Sản phẩm (sẽ có kèm giá bán) và trả lời kết quả trực tiếp ở trường 'message'. Gán intent là UNKNOWN.
- Nếu không rõ ràng, intent là UNKNOWN.

BẠN LÀ NHÂN VIÊN SALE, HÀY GIAO TIẾP LỊCH SỰ, CHUYÊN NGHIỆP VÀ NGẮN GỌN VỚI NGƯỜI DÙNG Ở TRƯỜNG \`message\` (Xưng em, gọi anh/chị). Báo giá một cách tự nhiên.
`.trim();

export const parseSaleMessage = async (message: string, context?: string, chatHistory?: any[]) => {
    try {
        if (!apiKey) throw new Error("Missing Gemini API Key");

        let prompt = `${SYSTEM_PROMPT}\n`;
        if (context) {
            prompt += `\nDỮ LIỆU THAM KHẢO TỪ HỆ THỐNG:\n${context}\nBẮT BUỘC:
1. Bạn phải trích xuất Tên Khách hàng và Tên Sản phẩm Y HỆT 100% như trong danh sách trên (copy/paste chính xác từng chữ) nếu có thể đoán được. Đừng tự chế tên.
2. Lưu ý: Người dùng thường nói "tạo đơn hàng [tên khách hàng] lấy [sản phẩm]". Ví dụ: "đơn hàng thông nháp" -> Tên khách hàng là "thông nháp" (Hoặc "Thông Nháp" nếu có trong danh sách tham khảo). TUYỆT ĐỐI KHÔNG lưu tên khách hàng vào phần Ghi chú (notes) trừ khi đó thực sự là ghi chú.\n`;
        }
        
        if (chatHistory && chatHistory.length > 0) {
            prompt += `\nLỊCH SỬ HỘI THOẠI TRƯỚC ĐÓ:\n`;
            chatHistory.forEach(msg => {
                prompt += `[${msg.role.toUpperCase()}]: ${msg.content}\n`;
            });
        }
        
        prompt += `\nTin nhắn người dùng hiện tại: "${message}"`;
        
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        
        const data = JSON.parse(text);


        return data;
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw error;
    }
};
