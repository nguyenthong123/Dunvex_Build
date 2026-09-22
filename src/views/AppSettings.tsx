import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth, db, doc, getDoc, setDoc, onSnapshot, collection, addDoc, serverTimestamp } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { useTheme } from '../context/ThemeContext';
import { Moon, Sun, Globe, Bell, LogOut, User, HelpCircle, Key, Copy, Check, RefreshCw, Link, Send, Save, Download, Lock, RefreshCcw, ShoppingBag, Calendar, Clock, MapPin, DollarSign, FileText, Zap } from 'lucide-react';
import { useToast } from '../components/shared/Toast';
import { useOwner } from '../hooks/useOwner';

const AppSettings = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const { theme, toggleTheme } = useTheme();
	const { showToast } = useToast();
	const owner = useOwner();
	const isAdmin = !owner.loading && (owner.role?.toLowerCase() === 'admin' || !owner.isEmployee);
	const [showConfirmLogout, setShowConfirmLogout] = React.useState(false);
	const [apiKey, setApiKey] = React.useState('');
	const [apiCopied, setApiCopied] = React.useState(false);
	const [urlCopied, setUrlCopied] = React.useState(false);
	const [urlCopiedAI, setUrlCopiedAI] = React.useState(false);
	const [telegramBotToken, setTelegramBotToken] = React.useState('');
	const [telegramChatId, setTelegramChatId] = React.useState('');
	const [savingTelegram, setSavingTelegram] = React.useState(false);
	const [testingTelegram, setTestingTelegram] = React.useState(false);
	const [generating, setGenerating] = React.useState(false);
	const [apiEnabled, setApiEnabled] = React.useState(false);
	const [webhookSecret, setWebhookSecret] = React.useState('');
	const [regeneratingWebhook, setRegeneratingWebhook] = React.useState(false);

	// ── Notification Toggles State (n8n Engine) ──
	const [notifyNewOrder, setNotifyNewOrder] = React.useState(true);
	const [notifyEodReport, setNotifyEodReport] = React.useState(true);
	const [notifyAttendance, setNotifyAttendance] = React.useState(true);
	const [notifySiteCheckin, setNotifySiteCheckin] = React.useState(true);
	const [notifyDebtPayment, setNotifyDebtPayment] = React.useState(true);
	const [notifyLeaveRequest, setNotifyLeaveRequest] = React.useState(true);

	// Export Excel State
	const [exportLoading, setExportLoading] = useState(false);
	const [exportCount, setExportCount] = useState(0);
	const [extraExportLimit, setExtraExportLimit] = useState(0);
	const [syncRange, setSyncRange] = useState({
		start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
		end: new Date().toISOString().slice(0, 10),
	});

	useEffect(() => {
		if (!owner.ownerId) return;

		// Listen to Export Usage
		const currentMonth = new Date().toISOString().slice(0, 7);
		const unsubUsage = onSnapshot(doc(db, 'usage_limits', `${owner.ownerId}_${currentMonth}`), (snap: any) => {
			if (snap.exists()) {
				setExportCount(snap.data().count || 0);
				setExtraExportLimit(snap.data().extraExportLimit || 0);
			} else {
				setExportCount(0);
				setExtraExportLimit(0);
			}
		});

		const load = async () => {
			try {
				const snap = await getDoc(doc(db, 'api_keys', owner.ownerId));
				if (snap.exists()) {
					const data = snap.data();
					setApiKey(data.key || '');
					setApiEnabled(data.enabled === true);
					setTelegramBotToken(data.telegramBotToken || '');
					setTelegramChatId(data.telegramGroupChatId || data.telegramChatId || '');
					setWebhookSecret(data.webhookSecret || '');
					setNotifyNewOrder(data.notifyNewOrder ?? true);
					setNotifyEodReport(data.notifyEodReport ?? true);
					setNotifyAttendance(data.notifyAttendance ?? true);
					setNotifySiteCheckin(data.notifySiteCheckin ?? true);
					setNotifyDebtPayment(data.notifyDebtPayment ?? true);
					setNotifyLeaveRequest(data.notifyLeaveRequest ?? true);
				}
			} catch (e) { console.error(e); }
		};
		load();


		return () => {
			if (typeof unsubUsage === 'function') unsubUsage();
		};
	}, [owner.ownerId]);

	const generateApiKey = async () => {
		if (!owner.ownerId) return;
		setGenerating(true);
		try {
			const { doc: d, setDoc: sd } = await import('../services/firebase');
			const newKey = 'dvx_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
				.map(b => b.toString(16).padStart(2, '0')).join('');
			const newSecret = 'wh_' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
				.map(b => b.toString(16).padStart(2, '0')).join('');
			await sd(d(db, 'api_keys', owner.ownerId), {
				key: newKey, enabled: true, ownerId: owner.ownerId,
				webhookSecret: newSecret,
				createdAt: new Date().toISOString(),
				createdBy: auth.currentUser?.email || '',
			}, { merge: true });
			setApiKey(newKey);
			setWebhookSecret(newSecret);
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
			const { doc: d, setDoc: sd } = await import('../services/firebase');
			await sd(d(db, 'api_keys', owner.ownerId), { enabled: ns }, { merge: true });
			setApiEnabled(ns);
			showToast(ns ? 'API đã bật!' : 'API đã tắt!', 'success');
		} catch (e: any) {
			showToast('Lỗi: ' + e.message, 'error');
		}
	};

	const webhookUrl = typeof window !== 'undefined'
		? `${window.location.origin}/api/order-webhook${webhookSecret ? `?token=${webhookSecret}` : ''}`
		: `/api/order-webhook${webhookSecret ? `?token=${webhookSecret}` : ''}`;
	const telegramWebhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/telegram-webhook` : '/api/telegram-webhook';

	const regenerateWebhookUrl = async () => {
		if (!owner.ownerId) return;
		setRegeneratingWebhook(true);
		try {
			const { doc: d, setDoc: sd } = await import('../services/firebase');
			const newSecret = 'wh_' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
				.map(b => b.toString(16).padStart(2, '0')).join('');
			await sd(d(db, 'api_keys', owner.ownerId), {
				webhookSecret: newSecret,
			}, { merge: true });
			setWebhookSecret(newSecret);
			showToast('Webhook URL mới đã được tạo!', 'success');
		} catch (e: any) {
			showToast('Lỗi: ' + e.message, 'error');
		} finally {
			setRegeneratingWebhook(false);
		}
	};

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
				body: JSON.stringify({ 
					ownerId: owner.ownerId, 
					botToken: telegramBotToken.trim(),
					telegramChatId: telegramChatId.trim(),
					notifyNewOrder,
					notifyEodReport,
					notifyAttendance,
					notifySiteCheckin,
					notifyDebtPayment,
					notifyLeaveRequest
				})
			});
			const data = await res.json();
			if (data.success) {
				// Cập nhật Firebase
				const { doc: d, setDoc: sd } = await import('../services/firebase');
				await sd(d(db, 'api_keys', owner.ownerId), {
					telegramBotToken: telegramBotToken.trim(),
					telegramGroupChatId: telegramChatId.trim().startsWith('-') ? telegramChatId.trim() : '',
					telegramChatId: !telegramChatId.trim().startsWith('-') ? telegramChatId.trim() : '',
					notifyNewOrder,
					notifyEodReport,
					notifyAttendance,
					notifySiteCheckin,
					notifyDebtPayment,
					notifyLeaveRequest,
					updatedAt: new Date().toISOString()
				}, { merge: true });
				showToast(data.message || 'Đã lưu cấu hình kết nối và các luồng thông báo thành công!', 'success');
			} else {
				showToast(data.error || 'Lỗi kết nối Telegram', 'error');
			}
		} catch (err: any) {
			showToast(err.message, 'error');
		} finally {
			setSavingTelegram(false);
		}
	};


	const handleTestTelegram = async () => {
		if (!apiKey) {
			showToast('Vui lòng tạo API Key trước', 'error');
			return;
		}
		if (!telegramBotToken || !telegramChatId) {
			showToast('Vui lòng cấu hình cả Bot Token và Chat ID trước khi test', 'warning');
			return;
		}
		setTestingTelegram(true);
		try {
			const res = await fetch('/api/telegram-notify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					ownerId: owner.ownerId, 
					message: '🔔 <b>Dunvex Build - Kết nối thành công!</b>\nTelegram Bot của bạn đã kết nối hoạt động hoàn hảo với hệ thống. 🎉'
				})
			});
			const data = await res.json();
			if (data.success) {
				showToast('Gửi tin nhắn test thành công! Hãy kiểm tra Telegram.', 'success');
			} else {
				showToast(data.error || 'Lỗi gửi tin nhắn test', 'error');
			}
		} catch (err: any) {
			showToast(err.message, 'error');
		} finally {
			setTestingTelegram(false);
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
			localStorage.removeItem('dunvex_user_session');
			localStorage.removeItem('dunvex_owner_id');
			localStorage.removeItem('dunvex_api_key');
			window.dispatchEvent(new CustomEvent('dunvex_logout'));
			await signOut(auth);
			navigate('/login');
		} catch (error) {
			console.error("Logout error:", error);
			showToast("Đã xảy ra lỗi khi đăng xuất.", "error");
		}
	};

	const isSyncLocked = (owner.systemConfig?.lock_free_sheets && !owner.isPro) || owner.manualLockSheets;

	const handleExportData = async () => {
		if (!owner.ownerId) return;

		if (isSyncLocked) {
			showToast("Tính năng trích xuất dữ liệu đã bị khóa. Vui lòng nâng cấp Pro hoặc liên hệ Admin.", "warning");
			return;
		}

		if (!owner.isPro) {
			const limit = 5 + extraExportLimit;
			if (exportCount >= limit) {
				showToast("Bạn đã hết lượt tải về trong tháng này.", "error");
				return;
			}
		}

		setExportLoading(true);
		try {
			// 1. Fetch data from API (server-side fetch + date filter)
			const apiRes = await fetch('/api/export-data', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					ownerId: owner.ownerId,
					startDate: syncRange.start || undefined,
					endDate: syncRange.end || undefined,
				}),
			});

			if (!apiRes.ok) {
				const errData = await apiRes.json().catch(() => ({}));
				throw new Error(errData.error || `Server error: ${apiRes.status}`);
			}

			const { data: serverData } = await apiRes.json();

			// 2. Create Excel workbook from server data
			const XLSX = await import('xlsx');
			const workbook = XLSX.utils.book_new();

			const isEmployee = owner.isEmployee && owner.role !== 'admin';

			// Cấu hình bảng xuất Excel cho Nhân viên vs Admin
			const employeeSheetConfig: [string, string][] = [
				['orders', 'don_hang'],
				['customers', 'khach_hang'],
				['products', 'san_pham'],
				['inventory_logs', 'ton_kho'],
				['debts', 'cong_no'],
				['checkins', 'checkin'],
				['attendance_logs', 'cham_cong'],
			];

			const adminSheetConfig: [string, string][] = [
				['products', 'san_pham'],
				['customers', 'khach_hang'],
				['orders', 'don_hang'],
				['debts', 'cong_no'],
				['checkins', 'checkin'],
				['attendance_logs', 'cham_cong'],
				['payments', 'lich_su_thanh_toan'],
				['inventory_logs', 'ton_kho'],
				['supplier_debts', 'cong_no_nha_cung_cap'],
				['purchase_orders', 'don_nhap_hang'],
			];

			const sheetConfig = isEmployee ? employeeSheetConfig : adminSheetConfig;

			for (const [key, sheetName] of sheetConfig) {
				const items = serverData[key];
				if (items && items.length > 0) {
					const worksheet = XLSX.utils.json_to_sheet(items);
					XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
				}
			}

			// Add order details sheet
			if (serverData.orderDetails && serverData.orderDetails.length > 0) {
				const detailsSheet = XLSX.utils.json_to_sheet(serverData.orderDetails);
				XLSX.utils.book_append_sheet(workbook, detailsSheet, 'chi_tiet_don_hang');
			}

			// 3. Download file
			XLSX.writeFile(workbook, `Dunvex_Export_${owner.ownerId}_${new Date().toISOString().slice(0, 10)}.xlsx`);

			// 4. Update Usage Count in Firestore
			const currentMonth = new Date().toISOString().slice(0, 7);
			const usageRef = doc(db, 'usage_limits', `${owner.ownerId}_${currentMonth}`);
			await setDoc(usageRef, {
				ownerId: owner.ownerId,
				count: exportCount + 1,
				lastExportAt: serverTimestamp(),
				lastExportBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên'
			}, { merge: true });

			// 5. Audit Log
			await addDoc(collection(db, 'audit_logs'), {
				action: 'Bộ lưu dữ liệu (Export - API)',
				user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
				userId: auth.currentUser?.uid || "",
				ownerId: owner.ownerId,
				details: `Đã xuất dữ liệu ra Excel (Lần thứ ${exportCount + 1} trong tháng)`,
				createdAt: serverTimestamp()
			});

			showToast("Tải dữ liệu thành công!", "success");
		} catch (error: any) {
			console.error("Export Error:", error);
			showToast("Lỗi khi trích xuất dữ liệu: " + (error.message || "Vui lòng thử lại sau"), "error");
		} finally {
			setExportLoading(false);
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
									{owner.userDisplayName || auth.currentUser?.displayName || 'Người dùng'}
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

					{/* ─── Export Section for Everyone ─── */}
					<div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
						<div className="flex items-center gap-4 mb-6">
							<div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl text-indigo-600 dark:text-indigo-400">
								<Download size={24} />
							</div>
							<div>
								<h3 className="text-xl font-bold text-slate-800 dark:text-white">Bộ lưu dữ liệu (Export Excel)</h3>
								<p className="text-sm text-slate-500 dark:text-slate-400">Trích xuất toàn bộ dữ liệu tùy chọn theo mốc thời gian ra file Excel để phân tích.</p>
							</div>
							<div className="ml-auto flex flex-col items-end">
								<span className={`text-[10px] font-black px-2 py-1 rounded-lg ${!owner.isPro && exportCount >= (5 + extraExportLimit) ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
									SỬ DỤNG: {exportCount}/{owner.isPro ? 'Không giới hạn' : (5 + extraExportLimit + ' LẦN/THÁNG')}
								</span>
							</div>
							{isSyncLocked && (
								<div className="ml-auto bg-rose-500/10 text-rose-500 px-3 py-1 rounded-lg flex items-center gap-1.5 animate-pulse">
									<Lock size={14} />
									<span className="text-[10px] font-black">BỊ KHÓA</span>
								</div>
							)}
						</div>

						<div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
								<div className="space-y-1">
									<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Từ ngày</label>
									<input
										type="date"
										className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
										value={syncRange.start}
										onChange={(e) => setSyncRange({ ...syncRange, start: e.target.value })}
									/>
								</div>
								<div className="space-y-1">
									<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đến ngày</label>
									<input
										type="date"
										className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
										value={syncRange.end}
										onChange={(e) => setSyncRange({ ...syncRange, end: e.target.value })}
									/>
								</div>
							</div>

							<div className="flex flex-col md:flex-row items-center gap-6">
								<div className="flex-1">
									<h4 className="font-bold text-slate-800 dark:text-white mb-2">Tải dữ liệu phân tích Excel</h4>
									<p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
										Hệ thống sẽ lọc dữ liệu (Đơn hàng, Khách hàng, Sản phẩm, Tồn kho, Công nợ, Đơn nhập hàng, Check-in,...) theo khoảng thời gian bạn chọn và xuất file Excel nhiều sheet đầy đủ.
									</p>
								</div>
								<button
									onClick={handleExportData}
									disabled={exportLoading || (!owner.isPro && exportCount >= (5 + extraExportLimit)) || isSyncLocked}
									className="w-full md:w-auto bg-[#1A237E] dark:bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/10"
								>
									{exportLoading ? (
										<><RefreshCcw size={20} className="animate-spin" /> Đang xử lý...</>
									) : isSyncLocked ? (
										<><Lock size={20} /> ĐÃ BỊ KHÓA</>
									) : (
										<><Download size={20} /> Tải dữ liệu về</>
									)}
								</button>
							</div>
						</div>
					</div>

					{/* ─── API & Webhook Settings (Chỉ Admin / Chủ xưởng) ─── */}
					{isAdmin && (
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
								<div className="flex items-center justify-between mb-2">
									<div className="flex items-center gap-2">
										<Globe size={16} className="text-emerald-500" />
										<span className="text-xs font-black text-slate-500 uppercase tracking-widest">Webhook URL (Riêng)</span>
									</div>
									{apiKey && (
										<button
											onClick={regenerateWebhookUrl}
											disabled={regeneratingWebhook}
											className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-black rounded-lg hover:bg-emerald-200 transition-all flex items-center gap-1"
										>
											{regeneratingWebhook ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
											Tạo Mới
										</button>
									)}
								</div>
								{webhookSecret ? (
									<>
										<div className="flex items-center gap-2">
											<code className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 truncate">{webhookUrl}</code>
											<button onClick={() => {{ navigator.clipboard.writeText(webhookUrl); setUrlCopied(true); showToast('Copy xong!', 'success'); setTimeout(() => setUrlCopied(false), 2000); }}} className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all">{urlCopied ? <Check size={16} /> : <Copy size={16} />}</button>
										</div>
										<p className="text-[10px] text-slate-400 mt-2">Link này là <strong>duy nhất</strong> cho cửa hàng của bạn. Gửi POST request với header <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">x-api-key</code> và body JSON đơn hàng.</p>
									</>
								) : (
									<p className="text-xs text-slate-400 italic">Vui lòng tạo API Key trước, sau đó nhấn <strong>Tạo Mới</strong> để sinh Webhook URL riêng.</p>
								)}
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
										<li>Copy <strong>HTTP API Token</strong> được cấp dán vào ô Bot Token, tạo một group chat, add con bot vào group đó và copy <strong>Chat ID</strong> của group dán vào ô bên dưới.</li>
									</ol>
								</div>

								<div className="space-y-4">
									<div>
										<label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Bot Token</label>
										<input 
											type="text" 
											placeholder="VD: 123456789:ABCdefGHIjklMNO..." 
											className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 rounded-xl text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 transition-all shadow-sm"
											value={telegramBotToken}
											onChange={(e) => setTelegramBotToken(e.target.value)}
										/>
									</div>

									<div>
										<label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Chat ID (ID Nhóm hoặc Cá nhân)</label>
										<input 
											type="text" 
											placeholder="VD: -100234567890 hoặc 987654321" 
											className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 rounded-xl text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 transition-all shadow-sm"
											value={telegramChatId}
											onChange={(e) => setTelegramChatId(e.target.value)}
										/>
									</div>

									{/* ─── Cấu hình Các Luồng Báo Cáo & n8n Automation ─── */}
									<div className="pt-3 border-t border-slate-200 dark:border-slate-700/80">
										<div className="flex items-center justify-between mb-2">
											<div className="flex items-center gap-1.5">
												<Zap size={14} className="text-amber-500" />
												<span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
													Bật / Tắt Các Luồng Thông Báo Tự Động (n8n Engine)
												</span>
											</div>
											<span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
												Sát sao 24/7
											</span>
										</div>
										
										<p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
											Chủ động kiểm soát từng loại thông báo gửi tức thì vào nhóm Telegram để vận hành chính xác và không bị nhiễu.
										</p>

										<div className="grid grid-cols-1 gap-2">
											{/* 1. Đơn hàng */}
											<div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:border-blue-400">
												<div className="flex items-start gap-3 pr-2">
													<div className="size-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
														<ShoppingBag size={16} />
													</div>
													<div>
														<p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
															Báo Đơn Hàng Mới & Thay Đổi Đơn
															<span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 rounded">Chốt đơn</span>
														</p>
														<p className="text-[10px] text-slate-500 dark:text-slate-400">Báo ngay khi có đơn chốt, chỉnh sửa hoặc huỷ đơn hàng.</p>
													</div>
												</div>
												<button
													type="button"
													onClick={() => setNotifyNewOrder(!notifyNewOrder)}
													className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${notifyNewOrder ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
												>
													<span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${notifyNewOrder ? 'translate-x-5' : 'translate-x-0'}`} />
												</button>
											</div>

											{/* 2. Tổng kết cuối ngày */}
											<div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:border-indigo-400">
												<div className="flex items-start gap-3 pr-2">
													<div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
														<Calendar size={16} />
													</div>
													<div>
														<p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
															Báo Tổng Kết Doanh Thu Cuối Ngày (16:00)
															<span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 rounded">n8n Cron</span>
														</p>
														<p className="text-[10px] text-slate-500 dark:text-slate-400">Tự động tổng kết doanh thu, top nhân viên & công nợ lúc 16:00.</p>
													</div>
												</div>
												<button
													type="button"
													onClick={() => setNotifyEodReport(!notifyEodReport)}
													className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${notifyEodReport ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
												>
													<span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${notifyEodReport ? 'translate-x-5' : 'translate-x-0'}`} />
												</button>
											</div>

											{/* 3. Chấm công nhân viên */}
											<div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:border-emerald-400">
												<div className="flex items-start gap-3 pr-2">
													<div className="size-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
														<Clock size={16} />
													</div>
													<div>
														<p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
															Báo Chấm Công Nhân Viên (Vào / Ra Ca)
															<span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 rounded">Chấm công</span>
														</p>
														<p className="text-[10px] text-slate-500 dark:text-slate-400">Báo khi nhân viên chấm công tại xưởng kèm khoảng cách GPS.</p>
													</div>
												</div>
												<button
													type="button"
													onClick={() => setNotifyAttendance(!notifyAttendance)}
													className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${notifyAttendance ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}
												>
													<span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${notifyAttendance ? 'translate-x-5' : 'translate-x-0'}`} />
												</button>
											</div>

											{/* 4. Checkin công trình */}
											<div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:border-purple-400">
												<div className="flex items-start gap-3 pr-2">
													<div className="size-8 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
														<MapPin size={16} />
													</div>
													<div>
														<p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
															Báo Checkin Tại Công Trình / Giao Hàng
															<span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 rounded">GPS & Ảnh</span>
														</p>
														<p className="text-[10px] text-slate-500 dark:text-slate-400">Báo khi nhân viên checkin tại công trình kèm toạ độ vệ tinh & ảnh.</p>
													</div>
												</div>
												<button
													type="button"
													onClick={() => setNotifySiteCheckin(!notifySiteCheckin)}
													className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${notifySiteCheckin ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'}`}
												>
													<span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${notifySiteCheckin ? 'translate-x-5' : 'translate-x-0'}`} />
												</button>
											</div>

											{/* 5. Nhập công nợ */}
											<div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:border-amber-400">
												<div className="flex items-start gap-3 pr-2">
													<div className="size-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
														<DollarSign size={16} />
													</div>
													<div>
														<p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
															Báo Nhập & Thu Công Nợ Khách Hàng
															<span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300 rounded">Thu nợ</span>
														</p>
														<p className="text-[10px] text-slate-500 dark:text-slate-400">Báo ngay khi lập phiếu thu nợ, tiền thu & số dư nợ còn lại.</p>
													</div>
												</div>
												<button
													type="button"
													onClick={() => setNotifyDebtPayment(!notifyDebtPayment)}
													className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${notifyDebtPayment ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'}`}
												>
													<span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${notifyDebtPayment ? 'translate-x-5' : 'translate-x-0'}`} />
												</button>
											</div>

											{/* 6. Nghỉ phép */}
											<div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:border-rose-400">
												<div className="flex items-start gap-3 pr-2">
													<div className="size-8 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
														<FileText size={16} />
													</div>
													<div>
														<p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
															Báo Đơn Xin Nghỉ Phép / Đi Muộn
															<span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300 rounded">Nghỉ phép</span>
														</p>
														<p className="text-[10px] text-slate-500 dark:text-slate-400">Báo khi nhân viên đăng ký ngày nghỉ phép hoặc lý do đi muộn.</p>
													</div>
												</div>
												<button
													type="button"
													onClick={() => setNotifyLeaveRequest(!notifyLeaveRequest)}
													className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${notifyLeaveRequest ? 'bg-rose-600' : 'bg-slate-300 dark:bg-slate-700'}`}
												>
													<span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${notifyLeaveRequest ? 'translate-x-5' : 'translate-x-0'}`} />
												</button>
											</div>
										</div>
									</div>

									<div className="flex flex-col sm:flex-row gap-3 pt-2">
										<button 
											onClick={handleConnectTelegram} 
											disabled={savingTelegram || !apiKey}
											className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
										>
											{savingTelegram ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
											Lưu cấu hình
										</button>
										<button 
											onClick={handleTestTelegram} 
											disabled={testingTelegram || !telegramBotToken || !telegramChatId || !apiKey}
											className="flex-1 py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 disabled:opacity-50 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all active:scale-95 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center gap-2"
										>
											{testingTelegram ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
											Test kết nối
										</button>
									</div>
								</div>
							</div>
						</div>
					)}


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
