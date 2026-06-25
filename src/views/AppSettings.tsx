import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { useTheme } from '../context/ThemeContext';
import { Moon, Sun, Globe, Bell, LogOut, User, HelpCircle } from 'lucide-react';
import { useToast } from '../components/shared/Toast';
import { useOwner } from '../hooks/useOwner';

const AppSettings = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const { theme, toggleTheme } = useTheme();
	const { showToast } = useToast();
	const owner = useOwner();
	const [showConfirmLogout, setShowConfirmLogout] = React.useState(false);

	React.useEffect(() => {
		const params = new URLSearchParams(location.search);
		const action = params.get('action');
		const section = params.get('section');

		if (action === 'toggleTheme') {
			toggleTheme();
			navigate('/settings', { replace: true });
		} else if (action === 'logout') {
			setShowConfirmLogout(true);
			navigate('/settings', { replace: true });
		}

		if (section === 'sync') {
			// section sync handled elsewhere
		}
	}, [location, toggleTheme, navigate]);

	const handleLogout = async () => {
		try {
			await signOut(auth);
			navigate('/login');
		} catch (error) {
			console.error("Logout error:", error);
			showToast("Đã xảy ra lỗi khi đăng xuất.", "error");
		}
	};

	return (
		<div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-slate-950 transition-colors duration-300">
			<header className="h-16 md:h-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0 transition-colors duration-300">
				<h2 className="text-[#1A237E] dark:text-indigo-400 text-lg md:text-2xl font-black uppercase tracking-tight">Cài Đặt Ứng Dụng</h2>
			</header>

			<div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">
				<div className="max-w-2xl mx-auto space-y-6">

					{/* Theme Section */}
					<div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
						<h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Giao diện & Hiển thị</h3>
						<div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
							<div className="flex items-center gap-4">
								<div className={`p-3 rounded-full ${theme === 'dark' ? 'bg-indigo-500 text-white' : 'bg-yellow-100 text-yellow-600'}`}>
									{theme === 'dark' ? <Moon size={24} /> : <Sun size={24} />}
								</div>
								<div>
									<h4 className="font-bold text-slate-700 dark:text-white">Chế độ tối</h4>
									<p className="text-xs text-slate-500 dark:text-slate-400">Chuyển đổi giao diện sáng/tối</p>
								</div>
							</div>
							<label className="relative inline-flex items-center cursor-pointer">
								<input type="checkbox" className="sr-only peer" checked={theme === 'dark'} onChange={toggleTheme} />
								<div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#1A237E]"></div>
							</label>
						</div>
					</div>

					{/* Account & Logout Section */}
					<div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
						<h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Tài khoản & Bảo mật</h3>

						<div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl mb-4 flex items-center gap-4">
							<div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
								<User size={24} />
							</div>
							<div>
								<h4 className="font-bold text-slate-700 dark:text-white truncate max-w-[200px]">
									{auth.currentUser?.displayName || 'Người dùng'}
								</h4>
								<p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
									{auth.currentUser?.email}
								</p>
							</div>
						</div>

						{showConfirmLogout ? (
							<div className="p-4 bg-rose-50 dark:bg-rose-900/10 rounded-xl border border-rose-200 dark:border-rose-900/30 animate-in zoom-in-95 duration-200">
								<p className="text-sm font-bold text-rose-700 dark:text-rose-400 text-center mb-4">
									Bạn chắc chắn muốn đăng xuất chứ?
								</p>
								<div className="flex gap-3">
									<button
										onClick={() => setShowConfirmLogout(false)}
										className="flex-1 py-3 px-4 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl text-sm border border-slate-200 dark:border-slate-700 active:scale-95 transition-transform"
									>
										Hủy
									</button>
									<button
										onClick={handleLogout}
										className="flex-1 py-3 px-4 bg-rose-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-rose-200 dark:shadow-none active:scale-95 transition-transform"
									>
										Xác nhận
									</button>
								</div>
							</div>
						) : (
							<button
								onClick={() => setShowConfirmLogout(true)}
								type="button"
								className="w-full flex items-center justify-between p-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/10 dark:hover:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl transition-colors group cursor-pointer"
							>
								<div className="flex items-center gap-4">
									<div className="p-3 bg-rose-100 dark:bg-rose-900/30 rounded-full group-hover:scale-110 transition-transform">
										<LogOut size={24} />
									</div>
									<div className="text-left">
										<h4 className="font-bold">Đăng xuất khỏi hệ thống</h4>
										<p className="text-[10px] uppercase font-black opacity-60 tracking-wider">Thoát tài khoản ngay</p>
									</div>
								</div>
								<span className="material-symbols-outlined">chevron_right</span>
							</button>
						)}
					</div>

					{/* ADMIN TOOLS */}
					<div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
						<h3 className="text-lg font-bold text-rose-600 dark:text-rose-400 mb-4 uppercase tracking-tight">Công cụ Quản trị hệ thống</h3>
						<div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-2xl border border-orange-200 dark:border-orange-900/30">
							<p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Đồng bộ Đơn hàng & Khách hàng</p>
							<p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Tìm và tự động liên kết các đơn hàng cũ chưa có mã khách hàng vào danh sách khách hàng dựa trên tên. Tự động tính toán lại công nợ.</p>
							<button
								onClick={async () => {
									const { collection, getDocs, writeBatch, doc, increment, query, where } = await import('firebase/firestore');
									const { db } = await import('../services/firebase');
									
									try {
										if (!owner.ownerId) {
											showToast('Chưa tải xong dữ liệu cửa hàng, vui lòng thử lại.', 'warning');
											return;
										}

										showToast('Đang quét dữ liệu, vui lòng đợi...', 'info');
										
										const qCust = query(collection(db, 'customers'), where('ownerId', '==', owner.ownerId));
										const customersSnap = await getDocs(qCust);
										const customersList = customersSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
										
										const qOrd = query(collection(db, 'orders'), where('ownerId', '==', owner.ownerId));
										const ordersSnap = await getDocs(qOrd);
										
										const orphans = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() as any }))
											.filter(o => !o.customerId && (o.customerName || o.customerBusinessName));

										if (orphans.length === 0) {
											alert('Không có đơn hàng nào bị mồ côi (chưa có mã khách hàng) trong hệ thống.');
											return;
										}

										const msg = orphans.map(o => `- Đơn ${o.id.slice(0,6)}: "${o.customerName}" / "${o.customerBusinessName}"`).join('\n');
										if (!confirm(`Tìm thấy ${orphans.length} đơn hàng chưa có mã khách hàng:\n${msg}\n\nBạn có muốn tự động tìm khớp và nối vào khách hàng không?`)) return;

										const batch = writeBatch(db);
										let count = 0;

										const normalize = (t: any) => String(t || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
										const removeAccents = (t: any) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

										orphans.forEach(order => {
											const oName = normalize(order.customerName || '');
											const oBiz = normalize(order.customerBusinessName || '');
											
											const match = customersList.find(c => {
												const cName = normalize(c.name || '');
												const cBiz = normalize(c.businessName || '');
												
												const exactMatch = (cName && (cName === oName || cName === oBiz)) || 
																   (cBiz && (cBiz === oName || cBiz === oBiz));
												
												const includesMatch = (cName && (oName.includes(cName) || oBiz.includes(cName))) ||
																	  (cBiz && (oName.includes(cBiz) || oBiz.includes(cBiz)));
												
												const noAccentMatch = (cName && (removeAccents(oName).includes(removeAccents(cName))));

												return exactMatch || includesMatch || noAccentMatch;
											});

											if (match) {
												batch.update(doc(db, 'orders', order.id), { customerId: match.id, customerPhone: match.phone || '' });
												if (order.status === 'Đơn chốt') {
													batch.update(doc(db, 'customers', match.id), { debt: increment(Number(order.totalAmount || 0)) });
												}
												count++;
											}
										});

										if (count > 0) {
											await batch.commit();
											showToast(`Đã đồng bộ thành công ${count} đơn hàng!`, 'success');
										} else {
											showToast('Tìm thấy đơn mồ côi nhưng TÊN KHÔNG KHỚP với bất kỳ khách hàng nào đang có.', 'warning');
										}
									} catch (e: any) {
										showToast('Lỗi đồng bộ: ' + e.message, 'error');
									}
								}}
								className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all"
							>
								Chạy Đồng Bộ Ngay
							</button>
						</div>
					</div>


					<div className="text-center text-xs text-slate-400 mt-8 pb-32">
						<p>Dunvex Build v1.0.1</p>
						<p>© 2026 Dunvex Technology</p>
					</div>

				</div>
			</div>
		</div>
	);
};

export default AppSettings;
