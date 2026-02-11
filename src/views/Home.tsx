import { useNavigate } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, updateDoc, doc, writeBatch, getDocs, limit } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';
import { useNavigationConfig } from '../hooks/useNavigationConfig';

const Home = () => {
	const navigate = useNavigate();
	const { sidebarItems } = useNavigationConfig();
	const [unreadCount, setUnreadCount] = useState(0);
	const [showNotifications, setShowNotifications] = useState(false);
	const [notifications, setNotifications] = useState<any[]>([]);

	useEffect(() => {
		if (!auth.currentUser) return;

		// 1. Listen for unread count
		const qUnread = query(
			collection(db, 'notifications'),
			where('userId', '==', auth.currentUser.uid),
			where('read', '==', false)
		);

		const unsubscribeUnread = onSnapshot(qUnread, (snapshot) => {
			setUnreadCount(snapshot.size);
		});

		// 2. Listen for notification list (last 20)
		const qList = query(
			collection(db, 'notifications'),
			where('userId', '==', auth.currentUser.uid),
			limit(20)
		);

		const unsubscribeList = onSnapshot(qList, (snapshot) => {
			const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
			// Client-side sort to avoid index issues
			list.sort((a: any, b: any) => {
				const timeA = a.createdAt?.seconds || 0;
				const timeB = b.createdAt?.seconds || 0;
				return timeB - timeA;
			});
			setNotifications(list);
		});

		return () => {
			unsubscribeUnread();
			unsubscribeList();
		};
	}, []);

	const markAllAsRead = async () => {
		if (!auth.currentUser) return;
		const q = query(
			collection(db, 'notifications'),
			where('userId', '==', auth.currentUser.uid),
			where('read', '==', false)
		);
		const snapshot = await getDocs(q);
		const batch = writeBatch(db);
		snapshot.docs.forEach((d) => {
			batch.update(d.ref, { read: true });
		});
		await batch.commit();
	};

	const handleNotificationClick = async (notification: any) => {
		if (!notification.read) {
			await updateDoc(doc(db, 'notifications', notification.id), { read: true });
		}
		// Optional: Navigate if notification has a link
		// if (notification.link) navigate(notification.link);
	};

	const formatTimeAgo = (timestamp: any) => {
		if (!timestamp) return '';
		const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
		const now = new Date();
		const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

		if (diffInSeconds < 60) return 'Vừa xong';
		if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
		if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
		return `${date.getDate()}/${date.getMonth() + 1}`;
	};

	const handleLogout = async () => {
		if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
			await signOut(auth);
			navigate('/login');
		}
	};

	return (
		<>
			{/* HEADER */}
			<header className="h-16 md:h-20 bg-white border-b border-gray-100 flex items-center justify-between px-4 md:px-8 shrink-0 relative z-20">
				<h2 className="text-lg md:text-xl font-black text-[#1A237E] uppercase tracking-tight">Tổng Quan Hệ Thống</h2>
				<div className="flex items-center gap-4">

					{/* Notification Bell */}
					<div className="relative">
						<button
							onClick={() => setShowNotifications(!showNotifications)}
							className="p-2 relative text-slate-400 hover:bg-slate-50 rounded-xl transition-colors group"
							title="Thông báo"
						>
							<span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">notifications</span>
							{unreadCount > 0 && (
								<span className="absolute top-2 right-2 size-4 bg-[#FF6D00] text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 border-white animate-bounce">
									{unreadCount}
								</span>
							)}
						</button>

						{/* Notification Dropdown */}
						{showNotifications && (
							<>
								<div className="fixed inset-0 z-30" onClick={() => setShowNotifications(false)}></div>
								<div className="absolute top-full right-0 mt-2 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-slate-100 z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
									<div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
										<h3 className="font-bold text-xs uppercase text-slate-700 tracking-wider">Thông báo</h3>
										<button onClick={markAllAsRead} className="text-[10px] font-bold text-[#1A237E] hover:underline cursor-pointer">
											Đánh dấu đã đọc tất cả
										</button>
									</div>
									<div className="max-h-[400px] overflow-y-auto custom-scrollbar">
										{notifications.length === 0 ? (
											<div className="p-8 text-center flex flex-col items-center">
												<span className="material-symbols-outlined text-4xl text-slate-200 mb-2">notifications_off</span>
												<p className="text-xs text-slate-400 font-medium">Không có thông báo nào</p>
											</div>
										) : (
											<div className="divide-y divide-slate-50">
												{notifications.map((n) => (
													<div
														key={n.id}
														onClick={() => handleNotificationClick(n)}
														className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors flex gap-3 ${!n.read ? 'bg-blue-50/30' : ''}`}
													>
														<div className={`mt-1.5 size-2 rounded-full shrink-0 ${!n.read ? 'bg-[#FF6D00] ring-4 ring-orange-50' : 'bg-slate-200'}`}></div>
														<div>
															<h4 className={`text-sm ${!n.read ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}>
																{n.title || 'Thông báo hệ thống'}
															</h4>
															<p className="text-xs text-slate-500 mt-1 leading-relaxed">
																{n.message}
															</p>
															<p className="text-[10px] text-slate-400 mt-2 font-medium">
																{formatTimeAgo(n.createdAt)}
															</p>
														</div>
													</div>
												))}
											</div>
										)}
									</div>
									<div className="p-2 border-t border-slate-50 bg-slate-50/30 text-center">
										<button className="text-[10px] font-bold text-slate-500 hover:text-[#1A237E]">Xem tất cả</button>
									</div>
								</div>
							</>
						)}
					</div>

					<div className="h-8 w-px bg-slate-100 mx-2"></div>

					<div className="text-right hidden sm:block">
						<p className="text-xs font-bold leading-none text-slate-900">{auth.currentUser?.displayName || 'Người dùng'}</p>
						<p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Quản trị viên</p>
					</div>
					<img
						alt="Profile"
						className="size-10 rounded-full object-cover border-2 border-[#1A237E]/10"
						src={auth.currentUser?.photoURL || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=100"}
					/>
				</div>
			</header>

			<main className="p-4 md:p-8 max-w-[1600px] mx-auto">
				{/* Alerts Section */}
				<div className="mb-8 flex flex-col md:flex-row gap-4">
					<div className="flex-1 bg-white border-l-4 border-[#FF6D00] p-4 rounded-r-xl shadow-sm flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="bg-orange-50 p-2 rounded-lg text-[#FF6D00]">
								<span className="material-symbols-outlined">warning</span>
							</div>
							<div>
								<h4 className="text-sm font-bold">Cảnh báo tồn kho</h4>
								<p className="text-xs text-slate-500">Xi măng Hà Tiên dưới mức an toàn (50 bao)</p>
							</div>
						</div>
						<button className="text-xs font-bold text-[#FF6D00] px-3 py-1 hover:bg-orange-50 rounded-lg">Xử lý ngay</button>
					</div>

					<div className="hidden md:flex flex-1 bg-white border-l-4 border-blue-600 p-4 rounded-r-xl shadow-sm items-center gap-3">
						<div className="bg-blue-50 p-2 rounded-lg text-blue-600">
							<span className="material-symbols-outlined">payments</span>
						</div>
						<div>
							<h4 className="text-sm font-bold">Công nợ cần thu</h4>
							<p className="text-xs text-slate-500">3 khách hàng đến hạn thanh toán trong hôm nay</p>
						</div>
					</div>
				</div>

				<div className="grid grid-cols-12 gap-6">
					{/* Revenue and Shortcuts */}
					<div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
						<div className="bg-[#1A237E] text-white rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group">
							<div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-[#FF6D00]/20 transition-all duration-700"></div>
							<p className="text-white/60 text-sm font-medium mb-1">Doanh thu hôm nay</p>
							<div className="flex items-baseline gap-2">
								<h2 className="text-4xl font-black tracking-tighter">152.0M</h2>
								<span className="text-sm font-bold text-[#FF6D00]">VND</span>
							</div>
							<div className="mt-6 flex gap-4">
								<div className="bg-white/10 px-3 py-2 rounded-xl">
									<p className="text-[10px] text-white/50 uppercase font-bold">Đơn hàng</p>
									<p className="text-lg font-bold">45</p>
								</div>
								<div className="bg-white/10 px-3 py-2 rounded-xl">
									<p className="text-[10px] text-white/50 uppercase font-bold">Tăng trưởng</p>
									<p className="text-lg font-bold text-green-400">+12%</p>
								</div>
							</div>
						</div>

						<div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200">
							<h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
								Phím tắt nhanh
								<span className="material-symbols-outlined text-slate-300">apps</span>
							</h3>
							<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
								{sidebarItems
									.filter(item => item.path !== '/dashboard')
									.map((item) => (
										<button
											key={item.path}
											onClick={() => navigate(item.path)}
											className="aspect-square bg-slate-50 hover:bg-[#1A237E] hover:text-white transition-all rounded-3xl flex flex-col items-center justify-center gap-2 group p-2"
										>
											<div className="p-3 bg-white rounded-full text-[#1A237E] group-hover:bg-[#FF6D00] group-hover:text-white shadow-sm transition-colors">
												<span className="material-symbols-outlined">{item.icon}</span>
											</div>
											<span className="text-[11px] font-bold text-center leading-tight">{item.label}</span>
										</button>
									))}
							</div>
						</div>
					</div>

					{/* Chart and Recent Activity */}
					<div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
						<div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200 flex-1">
							<div className="flex justify-between items-center mb-8">
								<div>
									<h3 className="font-bold text-lg text-slate-900">Biểu đồ tăng trưởng doanh thu</h3>
									<p className="text-xs text-slate-400">Dữ liệu tổng hợp theo thời gian thực</p>
								</div>
								<select className="bg-slate-100 border-none rounded-lg text-xs font-bold px-4 py-2 outline-none cursor-pointer">
									<option>7 ngày qua</option>
									<option>Tháng này</option>
								</select>
							</div>
							<div className="h-48 w-full flex items-end justify-between gap-2 lg:gap-4 px-2">
								{[40, 65, 50, 85, 70, 95].map((height, i) => (
									<div key={i} className="flex-1 bg-slate-100 rounded-t-xl relative group" style={{ height: `${height}%` }}>
										<div className={`absolute bottom-0 w-full rounded-t-xl transition-all ${i === 5 ? 'bg-[#FF6D00] shadow-lg shadow-orange-200' : 'bg-[#1A237E] opacity-20 group-hover:opacity-40'}`} style={{ height: '100%' }}></div>
										{i === 5 && <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Hôm nay</div>}
									</div>
								))}
							</div>
						</div>

						<div className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-200">
							<div className="p-6 border-b border-slate-100 flex justify-between items-center">
								<h3 className="font-bold text-slate-900">Hoạt động mới nhất</h3>
								<button className="text-xs font-bold text-[#1A237E] flex items-center gap-1">Xem tất cả <span className="material-symbols-outlined text-xs">arrow_forward</span></button>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full text-left font-['Inter']">
									<thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
										<tr>
											<th className="px-6 py-4">Nhân viên / Khách</th>
											<th className="px-6 py-4 hidden md:table-cell">Nội dung</th>
											<th className="px-6 py-4">Giá trị</th>
											<th className="px-6 py-4 text-right">Thời gian</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-50">
										<ActivityRow icon="NV" color="bg-blue-100 text-blue-600" name="Nguyễn Văn A" task="Tạo đơn hàng #HD2901" value="+12.5tr" time="2p trước" />
										<ActivityRow icon="KH" color="bg-green-100 text-green-600" name="Trần Thị B" task="Thanh toán công nợ" value="+5.2tr" time="15p trước" />
										<ActivityRow icon="K" color="bg-purple-100 text-purple-600" name="Kho Tổng" task="Nhập kho Xi măng HT" value="500 bao" time="32p trước" />
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</div>
			</main>
		</>
	);
};

const ActivityRow = ({ icon, color, name, task, value, time }: any) => (
	<tr className="hover:bg-slate-50 transition-colors">
		<td className="px-6 py-4">
			<div className="flex items-center gap-3">
				<div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center font-bold text-xs shadow-sm`}>{icon}</div>
				<span className="text-sm font-black text-slate-700 uppercase tracking-tight">{name}</span>
			</div>
		</td>
		<td className="px-6 py-4 hidden md:table-cell">
			<span className="text-sm text-slate-500 font-medium">{task}</span>
		</td>
		<td className="px-6 py-4">
			<span className="text-sm font-black text-slate-900 tracking-tight">{value}</span>
		</td>
		<td className="px-6 py-4 text-right">
			<span className="text-[10px] text-slate-400 font-bold uppercase">{time}</span>
		</td>
	</tr>
);


export default Home;
