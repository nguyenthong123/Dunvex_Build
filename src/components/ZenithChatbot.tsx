import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, Loader2, Sparkles, ChevronDown, Trash2 } from 'lucide-react';

interface Message {
	role: 'user' | 'assistant';
	content: string;
	timestamp: Date;
}

const SYSTEM_PROMPT = `Bạn là Zenith AI — trợ lý thông minh của ứng dụng Dunvex Build, hệ thống quản lý doanh nghiệp xây dựng & vật liệu xây dựng chuyên nghiệp.

Nhiệm vụ của bạn:
- Hỗ trợ người dùng sử dụng ứng dụng Dunvex Build hiệu quả
- Giải đáp thắc mắc về quản lý đơn hàng, khách hàng, sản phẩm, tài chính, công nợ
- Tư vấn nghiệp vụ kinh doanh xây dựng & VLXD
- Giải thích các tính năng của ứng dụng

Các tính năng chính của Dunvex Build:
- Quản lý đơn hàng nhanh (Quick Order)
- Quản lý danh sách khách hàng & công nợ
- Quản lý kho hàng & sản phẩm
- Theo dõi tài chính & sổ quỹ
- Điểm danh nhân viên
- Bảng giá & báo giá
- Mã QR check-in
- Khóa đào tạo nội bộ
- Nexus Control AI — hệ thống quản trị thông minh

Phong cách trả lời: Chuyên nghiệp nhưng thân thiện, súc tích và thực tế. Ưu tiên trả lời bằng tiếng Việt trừ khi người dùng dùng tiếng Anh. Nếu không biết câu trả lời, hãy thành thật nói không biết.`;

const MAX_RESPONSE_TOKENS = 1024;
const AI_TEMPERATURE = 0.7;

const SUGGESTED_QUESTIONS = [
	'Cách tạo đơn hàng nhanh?',
	'Làm sao xem công nợ khách hàng?',
	'Hướng dẫn nhập hàng loạt sản phẩm',
	'Tính năng Nexus Control AI là gì?',
];

const formatTime = (date: Date) =>
	date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

const ZenithChatbot = () => {
	const [isOpen, setIsOpen] = useState(false);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [showScrollDown, setShowScrollDown] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const messagesContainerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	const scrollToBottom = useCallback((smooth = true) => {
		messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
	}, []);

	useEffect(() => {
		if (isOpen && messages.length > 0) {
			scrollToBottom();
		}
	}, [messages, isOpen, scrollToBottom]);

	useEffect(() => {
		if (isOpen) {
			setTimeout(() => inputRef.current?.focus(), 300);
			if (messages.length === 0) {
				setMessages([{
					role: 'assistant',
					content: 'Xin chào! Tôi là **Zenith AI** — trợ lý thông minh của Dunvex Build. 👋\n\nTôi có thể giúp bạn:\n• Hướng dẫn sử dụng các tính năng\n• Giải đáp thắc mắc về nghiệp vụ\n• Tư vấn quản lý kinh doanh\n\nBạn cần hỗ trợ gì hôm nay?',
					timestamp: new Date(),
				}]);
			}
		}
	}, [isOpen]);

	const handleScroll = () => {
		const container = messagesContainerRef.current;
		if (!container) return;
		const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
		setShowScrollDown(!isNearBottom);
	};

	const sendMessage = useCallback(async (userMessage: string) => {
		const trimmed = userMessage.trim();
		if (!trimmed || isLoading) return;

		const userMsg: Message = { role: 'user', content: trimmed, timestamp: new Date() };
		setMessages(prev => [...prev, userMsg]);
		setInput('');
		setIsLoading(true);

		try {
			const apiKey = import.meta.env.VITE_GROQ_API_KEY;
			if (!apiKey) {
				setMessages(prev => [...prev, {
					role: 'assistant',
					content: 'Xin lỗi, chưa cấu hình API key cho Zenith AI. Vui lòng liên hệ quản trị viên.',
					timestamp: new Date(),
				}]);
				return;
			}

			const history = messages
				.slice(-10)
				.map(m => ({ role: m.role, content: m.content }));

			const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model: 'llama-3.3-70b-versatile',
					messages: [
						{ role: 'system', content: SYSTEM_PROMPT },
						...history,
						{ role: 'user', content: trimmed },
					],
					max_tokens: MAX_RESPONSE_TOKENS,
					temperature: AI_TEMPERATURE,
				}),
			});

			if (!response.ok) {
				throw new Error(`API error: ${response.status}`);
			}

			const data = await response.json();
			const reply = data.choices?.[0]?.message?.content ?? 'Xin lỗi, tôi không thể xử lý yêu cầu này.';

			setMessages(prev => [...prev, {
				role: 'assistant',
				content: reply,
				timestamp: new Date(),
			}]);
		} catch (err) {
			console.error('Zenith Chatbot error:', err);
			setMessages(prev => [...prev, {
				role: 'assistant',
				content: 'Xin lỗi, đã xảy ra lỗi kết nối. Vui lòng thử lại sau.',
				timestamp: new Date(),
			}]);
		} finally {
			setIsLoading(false);
		}
	}, [isLoading, messages]);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage(input);
		}
	};

	const clearHistory = () => {
		setMessages([{
			role: 'assistant',
			content: 'Lịch sử trò chuyện đã được xóa. Tôi có thể giúp gì cho bạn?',
			timestamp: new Date(),
		}]);
	};

	const renderMessageContent = (content: string) => {
		const parts = content.split(/(\*\*[^*]+\*\*)/g);
		return parts.map((part, i) => {
			if (part.startsWith('**') && part.endsWith('**')) {
				return <strong key={i}>{part.slice(2, -2)}</strong>;
			}
			return <span key={i}>{part}</span>;
		});
	};

	return (
		<>
			{/* Floating toggle button */}
			<button
				onClick={() => setIsOpen(prev => !prev)}
				className={`fixed bottom-24 right-4 md:bottom-8 md:right-8 z-[9990] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 active:scale-90 ${
					isOpen
						? 'bg-slate-700 rotate-12'
						: 'bg-primary hover:bg-primary/90'
				}`}
				title="Zenith AI Chatbot"
				aria-label="Mở trợ lý Zenith AI"
			>
				{isOpen ? (
					<X size={22} className="text-white" />
				) : (
					<Bot size={22} className="text-white" />
				)}
			</button>

			{/* Chat panel */}
			{isOpen && (
				<div className="fixed bottom-44 right-4 md:bottom-28 md:right-8 z-[9980] w-[calc(100vw-2rem)] max-w-sm flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom-5 duration-300"
					style={{ height: '480px' }}
				>
					{/* Header */}
					<div className="flex items-center justify-between px-4 py-3 bg-primary text-white shrink-0">
						<div className="flex items-center gap-2">
							<div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
								<Sparkles size={16} />
							</div>
							<div>
								<p className="font-bold text-sm leading-none">Zenith AI</p>
								<p className="text-xs text-white/70 mt-0.5">Trợ lý thông minh</p>
							</div>
						</div>
						<button
							onClick={clearHistory}
							className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
							title="Xóa lịch sử"
							aria-label="Xóa lịch sử trò chuyện"
						>
							<Trash2 size={16} />
						</button>
					</div>

					{/* Messages */}
					<div
						ref={messagesContainerRef}
						onScroll={handleScroll}
						className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar"
					>
						{messages.map((msg, idx) => (
							<div
								key={idx}
								className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
							>
								{msg.role === 'assistant' && (
									<div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
										<Bot size={14} className="text-primary" />
									</div>
								)}
								<div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
									<div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
										msg.role === 'user'
											? 'bg-primary text-white rounded-tr-sm'
											: 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-sm'
									}`}>
										{renderMessageContent(msg.content)}
									</div>
									<span className="text-[10px] text-slate-400">{formatTime(msg.timestamp)}</span>
								</div>
							</div>
						))}

						{isLoading && (
							<div className="flex gap-2">
								<div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
									<Bot size={14} className="text-primary" />
								</div>
								<div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
									<Loader2 size={14} className="animate-spin text-primary" />
									<span className="text-xs text-slate-500">Đang trả lời...</span>
								</div>
							</div>
						)}
						<div ref={messagesEndRef} />
					</div>

					{/* Scroll to bottom button */}
					{showScrollDown && (
						<button
							onClick={() => scrollToBottom()}
							className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 rounded-full p-1.5 z-10 animate-in fade-in duration-200"
						>
							<ChevronDown size={16} className="text-primary" />
						</button>
					)}

					{/* Suggested questions (only shown when no user messages yet) */}
					{messages.length === 1 && (
						<div className="px-4 pb-2 flex gap-2 overflow-x-auto shrink-0 custom-scrollbar">
							{SUGGESTED_QUESTIONS.map((q, i) => (
								<button
									key={i}
									onClick={() => sendMessage(q)}
									className="shrink-0 text-xs bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap"
								>
									{q}
								</button>
							))}
						</div>
					)}

					{/* Input area */}
					<div className="px-3 pb-3 pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
						<div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-800 rounded-2xl px-3 py-2">
							<textarea
								ref={inputRef}
								value={input}
								onChange={e => {
									setInput(e.target.value);
									e.target.style.height = 'auto';
									e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px';
								}}
								onKeyDown={handleKeyDown}
								placeholder="Nhập câu hỏi..."
								rows={1}
								disabled={isLoading}
								className="flex-1 bg-transparent resize-none outline-none text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 max-h-24 leading-relaxed"
								style={{ minHeight: '24px' }}
							/>
							<button
								onClick={() => sendMessage(input)}
								disabled={!input.trim() || isLoading}
								className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 active:scale-90 transition-all shrink-0"
							>
								<Send size={14} className="text-white" />
							</button>
						</div>
						<p className="text-center text-[10px] text-slate-400 mt-1.5">Enter để gửi · Shift+Enter xuống dòng</p>
					</div>
				</div>
			)}
		</>
	);
};

export default ZenithChatbot;
