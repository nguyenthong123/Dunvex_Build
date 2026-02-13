import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, XCircle, Clock, X } from 'lucide-react';
import { db, auth } from '../services/firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, limit, serverTimestamp, setDoc } from 'firebase/firestore';

const NotificationBell = () => {
	const [notifications, setNotifications] = useState<any[]>([]);
	const [showList, setShowList] = useState(false);
	const [unreadCount, setUnreadCount] = useState(0);

	useEffect(() => {
		if (!auth.currentUser) return;

		const q = query(
			collection(db, 'notifications'),
			where('userId', '==', auth.currentUser.uid)
		);

		const unsubscribe = onSnapshot(q, (snap) => {
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
		});

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

	return (
		<div className="relative">
			<button
				onClick={() => {
					setShowList(!showList);
					if (!showList) markAllAsRead();
				}}
				className="relative p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all group"
				title="Thông báo"
			>
				<Bell size={20} className={unreadCount > 0 ? "animate-wiggle" : ""} />
				{unreadCount > 0 && (
					<span className="absolute -top-1 -right-1 size-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#1A237E] shadow-lg animate-pulse">
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
					<div className="absolute top-12 left-0 lg:left-auto lg:right-0 w-80 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden z-[101] animate-in slide-in-from-top-2 duration-200">
						<div className="p-5 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
							<h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Thông báo</h3>
							<button onClick={() => setShowList(false)} className="text-slate-400 hover:text-slate-600 outline-none">
								<X size={18} />
							</button>
						</div>

						<div className="max-h-[400px] overflow-y-auto no-scrollbar">
							{notifications.length > 0 ? (
								notifications.map((n) => (
									<div
										key={n.id}
										className={`p-4 border-b border-slate-50 dark:border-slate-800/50 flex gap-3 transition-colors ${!n.read ? 'bg-indigo-50/30 dark:bg-indigo-500/5' : 'hover:bg-slate-50 dark:hover:bg-slate-800/20'}`}
									>
										<div className={`mt-0.5 size-8 rounded-lg flex items-center justify-center shrink-0 ${n.type === 'lock' ? 'bg-rose-500/10 text-rose-500' :
											n.type === 'unlock' ? 'bg-emerald-500/10 text-emerald-500' :
												'bg-indigo-500/10 text-indigo-500'
											}`}>
											{n.type === 'lock' && <XCircle size={16} />}
											{n.type === 'unlock' && <CheckCircle2 size={16} />}
											{n.type === 'payment' && <Bell size={16} />}
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
