import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, XCircle, Clock, X, AlertTriangle, Coins, Database, Sparkles, BrainCircuit } from 'lucide-react';
import { db, auth } from '../services/firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, limit, serverTimestamp, setDoc } from 'firebase/firestore';
import { useToast } from './shared/Toast';

const NotificationBell = ({ placement = 'down', align = 'right', className = "" }: { placement?: 'up' | 'down', align?: 'left' | 'right', className?: string }) => {
	const [notifications, setNotifications] = useState<any[]>([]);
	const [showList, setShowList] = useState(false);
	const [unreadCount, setUnreadCount] = useState(0);
	const { showToast } = useToast();
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [aiSummary, setAiSummary] = useState<string | null>(null);

	useEffect(() => {
		if (!auth.currentUser) return;

		const q = query(
			collection(db, 'notifications'),
			where('userId', '==', auth.currentUser.uid)
		);

		const unsubscribe = onSnapshot(q,
			(snap) => {
				const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

				// Client-side sort and limit
				const sorted = data.sort((a: any, b: any) => {
					const timeA = a.createdAt?.seconds || 0;
					const timeB = b.createdAt?.seconds || 0;
					return timeB - timeA;
				});

				const recent = sorted.slice(0, 10);
				setNotifications(recent);
				setUnreadCount(data.filter((n: any) => !n.read).length);
			},
			(error) => {
				console.error("NotificationBell Firestore Error:", error);
			}
		);

		return () => unsubscribe();
	}, [auth.currentUser]);

	const markAsRead = async (id: string) => {
		try {
			await updateDoc(doc(db, 'notifications', id), { read: true });
		} catch (error) {
			// Failed to mark read
		}
	};

	const markAllAsRead = async () => {
		const unread = notifications.filter(n => !n.read);
		for (const n of unread) {
			await markAsRead(n.id);
		}
	};

	const handleAiSummary = async () => {
		if (notifications.length === 0) {
			showToast("Không có thông báo để tóm tắt", "info");
			return;
		}
		const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
		if (!apiKey) {
			showToast("Chưa cấu hình Nexus AI Key", "error");
			return;
		}

		setIsAnalyzing(true);
		setAiSummary(null);

		try {
			const notifData = notifications.map(n => ({
				title: n.title,
				body: n.body,
				type: n.type,
				time: n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString('vi-VN') : 'Vừa xong'
			}));

			const response = await fetch("https://api.deepseek.com/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${apiKey}`
				},
				body: JSON.stringify({
					model: "deepseek-chat",
					messages: [
						{
							role: "system",
							content: "Bạn là Nexus AI chuyên gia quản trị hệ thống Dunvex Build. Dựa vào danh sách thông báo hệ thống gần đây, hãy đưa ra một TÓM TẮT NHANH 1 ĐOẠN (khoảng 2-3 câu ngắn) đánh giá tình hình rủi ro/cơ hội và ĐỀ XUẤT MỘT HÀNH ĐỘNG QUAN TRỌNG NHẤT cần làm ngay (Actionable Insight). YÊU CẦU TRÌNH BÀY: KHÔNG dùng markdown nhảm như dấu sao (*) hay thăng (#), chỉ dùng nội dung, chữ số hoặc gạch ngang (-) để liệt kê nếu cần. Phục vụ như một giám đốc điều hành đưa ra lệnh."
						},
						{
							role: "user",
							content: `Danh sách sự kiện: ${JSON.stringify(notifData)}`
						}
					],
					stream: false
				})
			});

			const data = await response.json();
			if (data.choices?.[0]?.message?.content) {
				let content = data.choices[0].message.content;
				content = content.replace(/\*\*/g, '').replace(/\*/g, '-');
				setAiSummary(content);
			} else {
				throw new Error("Lỗi phản hồi");
			}
		} catch (error) {
			console.error(error);
			showToast("Không thể kết nối Nexus AI", "error");
		} finally {
			setIsAnalyzing(false);
		}
	};

	return (
		<div className="relative">
			<button
				onClick={() => {
					setShowList(!showList);
					if (!showList) markAllAsRead();
				}}
				className={`relative p-2 rounded-xl transition-all group ${className || 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
				title="Thông báo"
			>
				<Bell size={20} className={unreadCount > 0 ? "animate-wiggle" : ""} />
				{unreadCount > 0 && (
					<span className="absolute -top-1 -right-1 size-5 bg-[#FF6D00] text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-lg animate-pulse">
						{unreadCount}
					</span>
				)}
			</button>

			{showList && (
				<>
					<div
						className="fixed inset-0 z-[100]"
						onClick={() => setShowList(false)}
					/>
					<div className={`absolute ${placement === 'up' ? 'bottom-full mb-3' : 'top-12'} ${align === 'left' ? 'left-0' : 'right-0'} w-80 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden z-[101] animate-in ${placement === 'up' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'} duration-200`}>
						<div className="p-5 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
							<h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Thông báo</h3>
							<div className="flex items-center gap-2">
								<button 
									onClick={handleAiSummary}
									disabled={isAnalyzing || notifications.length === 0}
									className={`px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all ${isAnalyzing ? 'bg-indigo-100 text-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-500' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20'}`}
								>
									{isAnalyzing ? (
										<BrainCircuit size={14} className="animate-spin" />
									) : (
										<Sparkles size={14} />
									)}
									{isAnalyzing ? 'Đang tóm tắt...' : 'Hỏi Nexus AI'}
								</button>
								<button onClick={() => setShowList(false)} className="size-8 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors outline-none">
									<X size={16} />
								</button>
							</div>
						</div>

						<div className="max-h-[400px] overflow-y-auto no-scrollbar">
							{aiSummary && (
								<div className="p-4 mx-4 mt-4 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-2xl animate-in slide-in-from-top-4 duration-300">
									<div className="flex items-center gap-2 mb-2">
										<BrainCircuit size={16} className="text-indigo-600 dark:text-indigo-400 animate-pulse" />
										<span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Nexus AI Insight</span>
									</div>
									<p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
										{aiSummary}
									</p>
									<div className="mt-3 flex justify-end">
										<button onClick={() => setAiSummary(null)} className="text-[10px] uppercase font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
											Đóng gợi ý
										</button>
									</div>
								</div>
							)}
							{notifications.length > 0 ? (
								notifications.map((n) => (
									<div
										key={n.id}
										className={`p-4 border-b border-slate-50 dark:border-slate-800/50 flex gap-3 transition-colors ${!n.read ? 'bg-indigo-50/30 dark:bg-indigo-500/5' : 'hover:bg-slate-50 dark:hover:bg-slate-800/20'}`}
									>
										<div className={`mt-0.5 size-8 rounded-lg flex items-center justify-center shrink-0 ${n.type === 'lock' ? 'bg-rose-500/10 text-rose-500' :
											n.type === 'unlock' ? 'bg-emerald-500/10 text-emerald-500' :
												n.type === 'low_stock' ? 'bg-orange-500/10 text-orange-500' :
													n.type === 'debt_warning' ? 'bg-amber-500/10 text-amber-500' :
														n.type === 'auto_sync' ? 'bg-emerald-500/10 text-emerald-500' :
															'bg-indigo-500/10 text-indigo-500'
											}`}>
											{n.type === 'lock' && <XCircle size={16} />}
											{n.type === 'unlock' && <CheckCircle2 size={16} />}
											{n.type === 'low_stock' && <AlertTriangle size={16} />}
											{n.type === 'debt_warning' && <Coins size={16} />}
											{n.type === 'auto_sync' && <Database size={16} />}
											{n.type === 'payment' && <Bell size={16} />}
											{(n.type === 'order' || !n.type) && <Bell size={16} />}
										</div>
										<div className="flex-1">
											<p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug">{n.title}</p>
											<p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{n.body}</p>
											<div className="flex items-center gap-1 mt-2 text-[9px] font-bold text-slate-400 uppercase">
												<Clock size={10} />
												{n.createdAt?.toDate ? formatTimeAgo(n.createdAt.toDate()) : 'Vừa xong'}
											</div>
										</div>
									</div>
								))
							) : (
								<div className="p-12 text-center">
									<div className="size-16 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
										<Bell size={24} />
									</div>
									<p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Không có thông báo mới</p>
								</div>
							)}
						</div>
					</div>
				</>
			)}
		</div>
	);
};

const formatTimeAgo = (date: Date) => {
	const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
	let interval = seconds / 31536000;
	if (interval > 1) return Math.floor(interval) + " năm";
	interval = seconds / 2592000;
	if (interval > 1) return Math.floor(interval) + " tháng";
	interval = seconds / 86400;
	if (interval > 1) return Math.floor(interval) + " ngày";
	interval = seconds / 3600;
	if (interval > 1) return Math.floor(interval) + " giờ";
	interval = seconds / 60;
	if (interval > 1) return Math.floor(interval) + " phút";
	return "Vừa xong";
};

export default NotificationBell;
