import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, XCircle, Clock, X, AlertTriangle, Coins, Database, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { db, auth } from '../services/firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, limit, serverTimestamp, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { useToast } from './shared/Toast';

const NotificationBell = ({ placement = 'down', align = 'right', className = "" }: { placement?: 'up' | 'down', align?: 'left' | 'right', className?: string }) => {
	const [notifications, setNotifications] = useState<any[]>([]);
	const [showList, setShowList] = useState(false);
	const [unreadCount, setUnreadCount] = useState(0);
	const { showToast } = useToast();

	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 3;
	const maxPages = 5;

	useEffect(() => {
		if (!auth.currentUser) return;

		// Cleanup old notifications (> 3 days)
		const cleanup = async () => {
			const threeDaysAgo = new Date();
			threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

			const qCleanup = query(
				collection(db, 'notifications'),
				where('userId', '==', auth.currentUser?.uid)
			);

			try {
				const snap = await getDocs(qCleanup);
				for (const d of snap.docs) {
					const data = d.data();
					const created = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
					if (created < threeDaysAgo) {
						await deleteDoc(doc(db, 'notifications', d.id));
					}
				}
			} catch (err) {
				console.error("Cleanup error:", err);
			}
		};
		cleanup();

		const q = query(
			collection(db, 'notifications'),
			where('userId', '==', auth.currentUser.uid)
		);

		const unsubscribe = onSnapshot(q,
			(snap) => {
				const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

				// Client-side sort and limit (Max 15 items for 5 pages of 3)
				const sorted = data.sort((a: any, b: any) => {
					const timeA = a.createdAt?.seconds || 0;
					const timeB = b.createdAt?.seconds || 0;
					return timeB - timeA;
				});

				const limited = sorted.slice(0, itemsPerPage * maxPages);
				setNotifications(limited);
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



	const totalPages = Math.min(Math.ceil(notifications.length / itemsPerPage), maxPages);
	const paginatedNotifications = notifications.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

	return (
		<div className="relative">
			<button
				onClick={() => {
					setShowList(!showList);
					if (!showList) {
						markAllAsRead();
						setCurrentPage(1);
					}
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
								<button onClick={() => setShowList(false)} className="size-8 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors outline-none">
									<X size={16} />
								</button>
							</div>
						</div>

						<div className="max-h-[400px] overflow-y-auto no-scrollbar">

							{paginatedNotifications.length > 0 ? (
								paginatedNotifications.map((n) => (
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
											<div className="flex flex-wrap items-center gap-2 mt-2 text-[9px] font-bold text-slate-400 uppercase">
												<div className="flex items-center gap-1">
													<Clock size={10} />
													{n.createdAt?.toDate ? formatTimeAgo(n.createdAt.toDate()) : 'Vừa xong'}
												</div>
												{n.createdAt?.toDate && (
													<span className="text-slate-300 dark:text-slate-600">|</span>
												)}
												{n.createdAt?.toDate && (
													<span>{n.createdAt.toDate().toLocaleDateString('vi-VN')}</span>
												)}
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

						{totalPages > 1 && (
							<div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
								<button
									disabled={currentPage === 1}
									onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
									className="size-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm"
								>
									<ChevronLeft size={16} />
								</button>
								<div className="flex items-center gap-1">
									{[...Array(totalPages)].map((_, i) => (
										<button
											key={i}
											onClick={() => setCurrentPage(i + 1)}
											className={`size-6 rounded-md text-[10px] font-black transition-all ${currentPage === i + 1 
												? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none scale-110' 
												: 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
										>
											{i + 1}
										</button>
									))}
								</div>
								<button
									disabled={currentPage === totalPages}
									onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
									className="size-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm"
								>
									<ChevronRight size={16} />
								</button>
							</div>
						)}
					</div>
				</>
			)}
		</div>
	);
};

const formatTimeAgo = (date: Date) => {
	const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
	if (seconds < 60) return "Vừa xong";
	let interval = seconds / 31536000;
	if (interval > 1) return Math.floor(interval) + " năm trước";
	interval = seconds / 2592000;
	if (interval > 1) return Math.floor(interval) + " tháng trước";
	interval = seconds / 86400;
	if (interval > 1) return Math.floor(interval) + " ngày trước";
	interval = seconds / 3600;
	if (interval > 1) return Math.floor(interval) + " giờ trước";
	interval = seconds / 60;
	if (interval > 1) return Math.floor(interval) + " phút trước";
	return "Vừa xong";
};

export default NotificationBell;
