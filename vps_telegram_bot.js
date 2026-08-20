const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const deepseekKey = process.env.DEEPSEEK_API_KEY;
const gasUrl = 'https://script.google.com/macros/s/AKfycby654qMZsV0IkzHs6XCVprXsn9rEgHpc4Cb9kyNDXJUFumqqYZvpOu8NGUlmSZHLpB0og/exec';

if (!deepseekKey) {
  console.error('❌ DEEPSEEK_KEY is missing! Please set it in .env or code.');
  process.exit(1);
}

const SYSTEM_PROMPT = `Bạn là trợ lý AI (tên là check tiền bot) của công ty TNHH Thạch Cao Tâm An.
Nhiệm vụ: Cung cấp thông tin giao dịch chính xác từ cơ sở dữ liệu.
Giọng điệu: Chuyên nghiệp, thân thiện, dễ hiểu, luôn xưng là "check tiền bot".

Bạn có công cụ "search_transactions". Hãy GỌI CÔNG CỤ NÀY NGAY LẬP TỨC nếu người dùng hỏi về giao dịch, số dư, tiền vào/ra.
KHÔNG ĐƯỢC TỰ BỊA RA GIAO DỊCH. NẾU KHÔNG CÓ DỮ LIỆU, HÃY NÓI KHÔNG TÌM THẤY.
Định dạng kết quả: Sử dụng in đậm cho số tiền, và định dạng ngày tháng rõ ràng. Đừng dùng bảng (table), hãy dùng danh sách bullet point. Thêm icon phù hợp.`;

const tools = [
  {
    type: "function",
    function: {
      name: "search_transactions",
      description: "Tìm kiếm các giao dịch tài chính (tiền vào/ra) từ cơ sở dữ liệu",
      parameters: {
        type: "object",
        properties: {
          keyword: {
            type: "string",
            description: "Từ khóa tìm kiếm (tên người chuyển, nội dung chuyển khoản, ngày tháng...)"
          },
          limit: {
            type: "integer",
            description: "Số lượng giao dịch cần lấy (mặc định 10)"
          }
        }
      }
    }
  }
];

const bot = new (TelegramBot.default || TelegramBot)(token, { polling: true });
console.log('📡 Dunvex Bot (DeepSeek) is starting in polling mode...');

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const chatType = msg.chat.type;
  if (!text) return;

  if (chatType === "group" || chatType === "supergroup") {
    if (!text.toLowerCase().includes("check tiền")) return;
  }

  bot.sendChatAction(chatId, 'typing').catch(() => {});

  const dsUrl = "https://api.deepseek.com/chat/completions";
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: text }
  ];

  try {
    const res1 = await axios.post(dsUrl, {
      model: "deepseek-chat",
      messages: messages,
      tools: tools,
      temperature: 0.7
    }, {
      headers: {
        "Authorization": `Bearer ${deepseekKey}`,
        "Content-Type": "application/json"
      }
    });

    const responseMessage = res1.data.choices[0].message;

    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      let args = {};
      try { args = JSON.parse(toolCall.function.arguments || "{}"); } catch (e) {}

      let searchResult = "";
      try {
        const token = process.env.NEXUS_WEBHOOK_TOKEN || "dunvex-nexus-2026";
        const fetchRes = await axios.get(`http://localhost:5000/api/bank-transactions?days=30&token=${token}&t=` + Date.now(), { maxRedirects: 5 });
        let transactions = fetchRes.data.data || [];
        if (args.keyword && args.keyword.trim() !== "") {
          const kw = args.keyword.toLowerCase().trim();
          transactions = transactions.filter((t) => 
            (t["Ngày"] && t["Ngày"].toString().toLowerCase().includes(kw)) ||
            (t["Phát sinh"] && t["Phát sinh"].toString().toLowerCase().includes(kw)) ||
            (t["Nội dung"] && t["Nội dung"].toString().toLowerCase().includes(kw))
          );
        }
        
        let limit = args.limit || 10;
        if (limit > 50) limit = 50;
        transactions = transactions.slice(0, limit);
        
        searchResult = transactions.length === 0 
          ? "Không tìm thấy giao dịch nào phù hợp."
          : transactions.map((t, i) => `Giao dịch ${i + 1}:\n- Ngày: ${t["Ngày"]}\n- Số tiền: ${t["Phát sinh"]}\n- Nội dung: ${t["Nội dung"]}`).join('\n\n');
      } catch (e) {
        console.error("GAS Error:", e.message);
        searchResult = "Lỗi khi lấy dữ liệu từ hệ thống.";
      }

      messages.push(responseMessage);
      messages.push({ role: "tool", tool_call_id: toolCall.id, content: searchResult });

      const res2 = await axios.post(dsUrl, {
        model: "deepseek-chat", messages, temperature: 0.7
      }, {
        headers: { "Authorization": `Bearer ${deepseekKey}`, "Content-Type": "application/json" }
      });

      let reply = res2.data.choices[0].message.content;
      bot.sendMessage(chatId, reply, { parse_mode: "Markdown" }).catch(() => bot.sendMessage(chatId, reply));
    } else {
      let reply = responseMessage.content;
      bot.sendMessage(chatId, reply, { parse_mode: "Markdown" }).catch(() => bot.sendMessage(chatId, reply));
    }
  } catch (error) {
    console.error("Error:", error.message);
    bot.sendMessage(chatId, "Xin lỗi, tôi đang gặp sự cố kết nối tới hệ thống AI.");
  }
});

bot.on('polling_error', (error) => {
  console.log("Polling error:", error.code, error.message);
});
