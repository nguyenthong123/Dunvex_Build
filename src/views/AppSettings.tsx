import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { useTheme } from '../context/ThemeContext';
import { Moon, Sun, Globe, Bell, LogOut, User, HelpCircle, Key, Copy, Check, RefreshCw, Link } from 'lucide-react';
import { useToast } from '../components/shared/Toast';
import { useOwner } from '../hooks/useOwner';

const AppSettings = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const { theme, toggleTheme } = useTheme();
	const { showToast } = useToast();
	const owner = useOwner();
	const [showConfirmLogout, setShowConfirmLogout] = React.useState(false);
	const [apiKey, setApiKey] = React.useState('');
	const [apiCopied, setApiCopied] = React.useState(false);
	const [urlCopied, setUrlCopied] = React.useState(false);
	const [urlCopiedAI, setUrlCopiedAI] = React.useState(false);
	const [telegramBotToken, setTelegramBotToken] = React.useState('');
	const [savingTelegram, setSavingTelegram] = React.useState(false);
	const [generating, setGenerating] = React.useState(false);
	const [apiEnabled, setApiEnabled] = React.useState(false);

	React.useEffect(() => {
		if (!owner.ownerId) return;
		const load = async () => {
			try {
				const { doc: d, getDoc: gd } = await import('firebase/firestore');
				const snap = await gd(d(db, 'api_keys', owner.ownerId));
				if (snap.exists()) {
					const data = snap.data();
					setApiKey(data.key || '');
					setApiEnabled(data.enabled === true);
					setTelegramBotToken(data.telegramBotToken || '');
				}
			} catch (e) { console.error(e); }
		};
		load();
	}, [owner.ownerId]);

	const generateApiKey = async () => {
		if (!owner.ownerId) return;
		setGenerating(true);
		try {
			const { doc: d, setDoc: sd } = await import('firebase/firestore');
			const newKey = 'dvx_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
				.map(b => b.toString(16).padStart(2, '0')).join('');
			await sd(d(db, 'api_keys', owner.ownerId), {
				key: newKey, enabled: true, ownerId: owner.ownerId,
				createdAt: new Date().toISOString(),
				createdBy: auth.currentUser?.email || '',
			}, { merge: true });
			setApiKey(newKey);
			setApiEnabled(true);
			showToast('API Key đã được tạo!', 'success');
		} catch (e: any) {
			showToast('Lỗi: ' + e.message, 'error');
		} finally {
			setGenerating(false);
		}
	};

	const toggleApi = async () => {
		if (!owner.ownerId || !apiKey) return;
		const ns = !apiEnabled;
		try {
			const { doc: d, setDoc: sd } = await import('firebase/firestore');
			await sd(d(db, 'api_keys', owner.ownerId), { enabled: ns }, { merge: true });
			setApiEnabled(ns);
			showToast(ns ? 'API đã bật!' : 'API đã tắt!', 'success');
		} catch (e: any) {
			showToast('Lỗi: ' + e.message, 'error');
		}
	};

	const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/order-webhook` : '/api/order-webhook';
	const telegramWebhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/telegram-webhook` : '/api/telegram-webhook';

	const handleConnectTelegram = async () => {
		if (!apiKey) {
			showToast('Vui lòng tạo API Key trước', 'error');
			return;
		}
		setSavingTelegram(true);
		try {
			const res = await fetch('/api/setup-telegram', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
				body: JSON.stringify({ ownerId: owner.ownerId, botToken: telegramBotToken.trim() })
			});
			const data = await res.json();
			if (data.success) {
				showToast(data.message, 'success');
			} else {
				showToast(data.error || 'Lỗi kết nối Telegram', 'error');
			}
		} catch (err: any) {
			showToast(err.message, 'error');
		} finally {
			setSavingTelegram(false);
		}
	};

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


				{/* ─── API & Webhook Settings ─── */}
				<div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
					<div className="flex items-center gap-3 mb-4">
						<div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
							<Link size={24} />
						</div>
						<h3 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-tight">API & Webhook</h3>
					</div>
					<p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
						Kết nối website bên ngoài để tự động tạo đơn hàng vào hệ thống. Webhook nhận POST request kèm API Key.
					</p>

					<div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 mb-3">
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-center gap-2">
								<Key size={16} className="text-indigo-500" />
								<span className="text-xs font-black text-slate-500 uppercase tracking-widest">API Key</span>
							</div>
							<div className="flex items-center gap-2">
								<label className="relative inline-flex items-center cursor-pointer">
									<input type="checkbox" className="sr-only peer" checked={apiEnabled} onChange={toggleApi} disabled={!apiKey} />
									<div className="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:bg-emerald-500 after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
								</label>
								<span className="text-[10px] text-slate-400">{apiEnabled ? 'Bật' : 'Tắt'}</span>
							</div>
						</div>
						{apiKey ? (
							<div className="flex items-center gap-2">
								<code className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 truncate">{apiKey}</code>
								<button onClick={() => {{ navigator.clipboard.writeText(apiKey); setApiCopied(true); showToast('Copy xong!', 'success'); setTimeout(() => setApiCopied(false), 2000); }}} className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all">{apiCopied ? <Check size={16} /> : <Copy size={16} />}</button>
							</div>
						) : (
							<button onClick={generateApiKey} disabled={generating} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">{generating ? <RefreshCw size={16} className="animate-spin" /> : <Key size={16} />}Tạo API Key Mới</button>
						)}
					</div>

					<div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
						<div className="flex items-center gap-2 mb-2">
							<Globe size={16} className="text-emerald-500" />
							<span className="text-xs font-black text-slate-500 uppercase tracking-widest">Webhook URL</span>
						</div>
						<div className="flex items-center gap-2">
							<code className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 truncate">{webhookUrl}</code>
							<button onClick={() => {{ navigator.clipboard.writeText(webhookUrl); setUrlCopied(true); showToast('Copy xong!', 'success'); setTimeout(() => setUrlCopied(false), 2000); }}} className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all">{urlCopied ? <Check size={16} /> : <Copy size={16} />}</button>
						</div>
						<p className="text-[10px] text-slate-400 mt-2">Gửi POST request với header <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">x-api-key</code> và body JSON đơn hàng.</p>
					</div>

					{/* ─── Webhook Trợ Lý AI (Telegram) ─── */}
					<div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 mt-4">
						<div className="flex items-center gap-2 mb-3">
							<Globe size={16} className="text-blue-500" />
							<span className="text-xs font-black text-slate-500 uppercase tracking-widest">Kết nối Trợ Lý AI (Telegram)</span>
						</div>
						
						<div className="mb-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-xs text-slate-600 dark:text-slate-300 shadow-sm">
							<p className="font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-1.5">
								<span className="flex items-center justify-center w-4 h-4 bg-blue-100 text-blue-600 rounded-full text-[10px]">i</span> 
								Hướng dẫn nhanh (3 bước)
							</p>
							<ol className="list-decimal list-inside space-y-2 ml-1 marker:text-slate-400 marker:font-medium">
								<li>Mở Telegram, tìm và bắt đầu chat với <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-600 hover:underline font-semibold transition-colors">@BotFather</a>.</li>
								<li>Gõ lệnh <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-pink-500 font-mono">/newbot</code> và làm theo hướng dẫn để đặt tên.</li>
								<li>Copy đoạn mã <strong>HTTP API Token</strong> được cấp và dán vào ô bên dưới.</li>
							</ol>
						</div>
						<div className="flex items-center gap-2">
							<input 
								type="text" 
								placeholder="VD: 123456789:ABCdefGHIjklMNO..." 
								className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500"
								value={telegramBotToken}
								onChange={(e) => setTelegramBotToken(e.target.value)}
							/>
							<button 
								onClick={handleConnectTelegram} 
								disabled={savingTelegram || !apiKey}
								className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
							>
								{savingTelegram ? <RefreshCw size={14} className="animate-spin" /> : <Link size={14} />}
								Kết nối
							</button>
						</div>
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
