import React, { useState, useRef, useEffect } from 'react';
import { SUPER_ADMIN_EMAIL } from '../constants';
import { useNavigate } from 'react-router-dom';
import {
	LayoutDashboard,
	Users,
	CreditCard,
	Settings,
	ShieldAlert,
	CheckCircle2,
	XCircle,
	Clock,
	Search,
	ExternalLink,
	Filter,
	ArrowUpRight,
	Database,
	Activity,
	Mail,
	Lock,
	Unlock,
	Crown,
	Calendar,
	Bot,
	Zap,
	AlertTriangle,
	Eye,
	Download,
	Rocket,
	Shield,
	BrainCircuit,
	LineChart
} from 'lucide-react';
import { useToast } from '../components/shared/Toast';
import { auth, db, collection, query, onSnapshot, doc, updateDoc, where,
	serverTimestamp, orderBy, limit, getDoc, getDocs, setDoc, addDoc
} from '../services/firebase';
import { createAdminNotification } from '../utils/notifications';
import { useNexusData } from '../hooks/useNexusData';
import { NexusRequestsTab } from '../components/admin/NexusRequestsTab';
import { NexusCustomersTab } from '../components/admin/NexusCustomersTab';
import { NexusLogsTab } from '../components/admin/NexusLogsTab';
import { NexusConfigTab } from '../components/admin/NexusConfigTab';
import { NexusAiTab } from '../components/admin/NexusAiTab';

const NEXUS_ADMIN_EMAIL = SUPER_ADMIN_EMAIL; // User's email

const VIETNAM_BANKS = [
	{ id: "VCB", name: "Vietcombank (VCB)" },
	{ id: "ICB", name: "VietinBank (ICB)" },
	{ id: "BIDV", name: "BIDV" },
	{ id: "VBA", name: "Agribank (VBA)" },
	{ id: "STB", name: "Sacombank (STB)" },
	{ id: "TCB", name: "Techcombank (TCB)" },
	{ id: "MB", name: "MBBank (MB)" },
	{ id: "ACB", name: "ACB" },
	{ id: "VPB", name: "VPBank (VPB)" },
	{ id: "TPB", name: "TPBank (TPB)" },
	{ id: "VIB", name: "VIB" },
	{ id: "HDB", name: "HDBank (HDB)" },
	{ id: "SHB", name: "SHB" },
	{ id: "EIB", name: "Eximbank (EIB)" },
	{ id: "MSB", name: "MSB" },
	{ id: "OCB", name: "OCB" },
	{ id: "SCB", name: "SCB" },
	{ id: "LPB", name: "LienVietPostBank (LPB)" },
	{ id: "SGB", name: "Saigonbank (SGB)" },
	{ id: "NAB", name: "Nam A Bank (NAB)" },
	{ id: "KLB", name: "Kienlongbank (KLB)" },
	{ id: "VAB", name: "VietA Bank (VAB)" },
	{ id: "BVB", name: "BaoViet Bank (BVB)" },
	{ id: "NCB", name: "NCB" }
];

const renderAddonIcon = (iconName: string, className: string) => {
	switch (iconName) {
		case 'Crown': return <Crown className={className} />;
		case 'Rocket': return <Rocket className={className} />;
		case 'Shield': return <Shield className={className} />;
		case 'Download': return <Download className={className} />;
		case 'Database': return <Database className={className} />;
		case 'Activity': return <Activity className={className} />;
		case 'Zap':
		default:
			return <Zap className={className} />;
	}
};

const NexusControl = () => {
	const navigate = useNavigate();
	const { showToast } = useToast();
	const [activeTab, setActiveTab] = useState('requests');

	const {
		stats,
		requests,
		customers,
		logs,
		addons,
		aiAnomalies,
		aiAnalyticsData,
		loading,
		searchQuery,
		setSearchQuery,
		filteredCustomers,
		systemConfig,
		setSystemConfig,
		paymentConfig,
		setPaymentConfig,
		isSavingConfig,
		setIsSavingConfig,
		isAiActive,
		setIsAiActive,
		editingAddon,
		setEditingAddon,
		qrModal,
		setQrModal,
		aiActions,
		isRunningRef,
		customersRef,
		getEffectiveStatus,
	} = useNexusData();

	const parseExpireDate = (val: any): Date | null => {
		if (!val) return null;
		if (val.toDate) return val.toDate();
		if (val.seconds) return new Date(val.seconds * 1000);
		if (val instanceof Date) return val;
		return null;
	};

	const handleUpdatePlan = async (ownerId: string, newPlan: string) => {
		if (!window.confirm(`Xác nhận hành động: ${newPlan === 'cancel_payment' ? 'HUỶ ĐĂNG KÝ VÀ KHÓA' : newPlan}?`)) return;
		try {
			if (newPlan === 'cancel_payment') {
				const expireDate = new Date();
				expireDate.setDate(expireDate.getDate() - 2); // Explicitly expired

				await setDoc(doc(db, 'settings', ownerId), {
					planId: 'free',
					isPro: false,
					subscriptionStatus: 'expired',
					subscriptionExpiresAt: expireDate,
					manualLockOrders: true,
					manualLockDebts: true,
					manualLockSheets: true,
					manualLockAi: true
				}, { merge: true });

				await addDoc(collection(db, 'notifications'), {
					userId: ownerId,
					title: '⛔ HỦY TRUY CẬP (CHƯA NHẬN ĐƯỢC THANH TOÁN)',
					body: 'Admin đã kiểm tra đối soát nhưng chưa nhận được lệnh chuyển khoản từ bạn. Hệ thống đã tiến hành thu hồi gói cước và thiết lập khóa tính năng. Vui lòng thanh toán lại hoặc liên hệ hỗ trợ.',
					type: 'alert',
					priority: 'high',
					read: false,
					createdAt: serverTimestamp()
				});

				showToast("Đã hủy đăng ký, thiết lập khóa và gửi thông báo cho khách!", "success");
				return;
			}

			const isPro = newPlan !== 'free' && newPlan !== 'test_expire';
			const expireDate = new Date();

			if (newPlan === 'premium_monthly') {
				expireDate.setMonth(expireDate.getMonth() + 1);
			} else if (newPlan === 'premium_yearly') {
				expireDate.setFullYear(expireDate.getFullYear() + 1);
			} else if (newPlan === 'test_expire') {
				// Hết hạn → khoá ngay, không cho dùng
				expireDate.setDate(expireDate.getDate() - 1);
				await setDoc(doc(db, 'settings', ownerId), {
					planId: newPlan,
					isPro: false,
					subscriptionStatus: 'expired',
					paymentConfirmedAt: serverTimestamp(),
					subscriptionExpiresAt: expireDate,
					manualLockOrders: true,
					manualLockDebts: true,
					manualLockSheets: true,
					manualLockAi: true,
					graceUntil: null
				}, { merge: true });
				await addDoc(collection(db, 'notifications'), {
					userId: ownerId,
					title: '🔒 TÀI KHOẢN BỊ KHOÁ',
					body: 'Admin đã thiết lập trạng thái hết hạn cho tài khoản.',
					type: 'lock',
					priority: 'high',
					read: false,
					createdAt: serverTimestamp()
				});
				showToast("Đã khoá tài khoản (TEST HẾT HẠN).", "success");
				return;
			} else {
				// Free plan policy: 60 days
				expireDate.setDate(expireDate.getDate() + 60);
			}

			await setDoc(doc(db, 'settings', ownerId), {
				planId: newPlan,
				isPro: isPro,
				subscriptionStatus: isPro ? 'active' : 'trial',
				paymentConfirmedAt: serverTimestamp(),
				subscriptionExpiresAt: expireDate
			}, { merge: true });
			showToast("Cập nhật gói thành công. Số ngày còn lại đã được đồng bộ!", "success");
		} catch (error) {
			console.error("Plan Update Error:", error);
			showToast("Lỗi khi cập nhật gói", "error");
		}
	};

	const handleApprovePayment = async (request: any, autoApprove: boolean = false) => {
		if (!autoApprove && !window.confirm(`Xác nhận thanh toán ${request.amount.toLocaleString()}đ cho ${request.userEmail}?`)) return;

		try {
			await updateDoc(doc(db, 'payment_requests', request.id), {
				status: 'approved',
				handledAt: serverTimestamp(),
				handledBy: auth.currentUser?.email
			});

			const planId = request.planId;

			if (planId && planId.startsWith('addon_export')) {
				const currentMonth = new Date().toISOString().slice(0, 7);
				const { setDoc, increment } = await import('../services/firebase');
				await setDoc(doc(db, 'usage_limits', `${request.ownerId}_${currentMonth}`), {
					extraExportLimit: increment(5)
				}, { merge: true });
			} else if (planId === 'addon_ai_assistant') {
				await setDoc(doc(db, 'settings', request.ownerId), {
					hasAIAssistant: true
				}, { merge: true });
			} else {
				const expireDate = new Date();
				// Đọc durationDays từ gói trong subscription_packages
				let durDays = 30; // mặc định 30 ngày
				try {
					const planSnap = await getDoc(doc(db, 'subscription_packages', request.planId));
					if (planSnap.exists() && planSnap.data().durationDays) {
						durDays = Number(planSnap.data().durationDays);
					} else {
						// Fallback cũ nếu gói không có durationDays
						const isYearly = planId === 'premium_yearly' || planId === 'addon_yearly';
						durDays = isYearly ? 365 : 30;
					}
				} catch (e) { /* fallback */ }
				expireDate.setDate(expireDate.getDate() + durDays);

				await setDoc(doc(db, 'settings', request.ownerId), {
					subscriptionStatus: 'active',
					isPro: true,
					planId: request.planId,
					paymentConfirmedAt: serverTimestamp(),
					subscriptionExpiresAt: expireDate,
					// Auto-unlock features upon approval
					manualLockOrders: false,
					manualLockDebts: false,
					manualLockSheets: false,
					manualLockAi: false
				}, { merge: true });
			}

			// Notify User
			await addDoc(collection(db, 'notifications'), {
				userId: request.ownerId,
				title: '✨ GIA HẠN THÀNH CÔNG',
				body: `Hệ thống đã nhận được xác nhận thanh toán. Gói ${request.planName || request.planId} đã được kích hoạt thành công.`,
				type: 'success',
				priority: 'high',
				read: false,
				createdAt: serverTimestamp()
			});

			// 📢 Thông báo cho admin về gói đăng ký mới
			await createAdminNotification(request.ownerId, {
				title: `💰 GÓI MỚI: ${request.planName || request.planId}`,
				body: `${request.userEmail} vừa đăng ký gói ${request.planName || request.planId} — ${request.amount.toLocaleString('vi-VN')}đ. Đã được duyệt & kích hoạt.`,
				type: 'subscription',
				priority: 'high'
			});

			// 📢 Thông báo cho admin về gói đăng ký mới
			await createAdminNotification(request.ownerId, {
				title: `💰 GÓI MỚI: ${request.planName || request.planId}`,
				body: `${request.userEmail} vừa đăng ký gói ${request.planName || request.planId} — ${request.amount.toLocaleString('vi-VN')}đ. Đã được duyệt & kích hoạt.`,
				type: 'subscription',
				priority: 'high'
			});

			showToast("Đã duyệt thanh toán và kích hoạt tài khoản!", "success");
		} catch (error) {
			console.error("Approve Payment Error:", error);
			showToast("Lỗi khi duyệt thanh toán.", "error");
		}
	};

	const handleRejectPayment = async (request: any) => {
		const reason = window.prompt("Lý do từ chối hoặc thu hồi:", request.status === 'approved' ? "Thu hồi do nhầm lẫn" : "Không tìm thấy giao dịch");
		if (reason === null) return;

		try {
			await updateDoc(doc(db, 'payment_requests', request.id), {
				status: 'rejected',
				rejectReason: reason,
				handledAt: serverTimestamp(),
				handledBy: auth.currentUser?.email
			});

			await setDoc(doc(db, 'settings', request.ownerId), {
				subscriptionStatus: 'expired',
				isPro: false,
				revokedAt: serverTimestamp(),
				revokeReason: reason,
				// Re-lock features
				manualLockOrders: true,
				manualLockDebts: true,
				manualLockSheets: true,
				manualLockAi: true
			}, { merge: true });

			// Notify User
			await addDoc(collection(db, 'notifications'), {
				userId: request.ownerId,
				title: '❌ GIAO DỊCH BỊ TỪ CHỐI',
				body: `Yêu cầu gia hạn của bạn đã bị từ chối. Lý do: ${reason}. Hệ thống sẽ duy trì trạng thái khóa nếu tài khoản đã hết hạn.`,
				type: 'error',
				priority: 'high',
				read: false,
				createdAt: serverTimestamp()
			});

			showToast("Đã từ chối/thu hồi yêu cầu.", "info");
		} catch (error) {
			console.error("Reject Payment Error:", error);
			showToast("Lỗi khi thực hiện thao tác.", "error");
		}
	};

	const toggleSystemFlag = async (flag: string) => {
		const newVal = !systemConfig[flag];
		try {
			await setDoc(doc(db, 'system_config', 'main'), {
				[flag]: newVal
			}, { merge: true });
			setSystemConfig({ ...systemConfig, [flag]: newVal });
		} catch (error) {
			// Error
		}
	};

	const handleSaveConfig = async () => {
		if (!paymentConfig.bankId || !paymentConfig.accountNumber || !paymentConfig.accountName) {
			showToast("Vui lòng điền đầy đủ thông tin", "error");
			return;
		}
		setIsSavingConfig(true);
		try {
			await setDoc(doc(db, 'system_config', 'payment'), {
				...paymentConfig,
				bankId: paymentConfig.bankId.toUpperCase(),
				accountName: paymentConfig.accountName.toUpperCase(),
				updatedAt: serverTimestamp(),
				updatedBy: auth.currentUser?.email
			});
			showToast("Đã cập nhật thông tin QR thanh toán!", "success");
		} catch (error) {
			showToast("Lỗi khi lưu cấu hình", "error");
		} finally {
			setIsSavingConfig(false);
		}
	};

	const handleSaveAddon = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingAddon.id || !editingAddon.name || (editingAddon.price === undefined || editingAddon.price === null || editingAddon.price === '')) {
			showToast("Vui lòng điền ID, tên và giá gói (0đ = miễn phí)", "error");
			return;
		}
		try {
			await setDoc(doc(db, 'subscription_packages', editingAddon.id), {
				name: editingAddon.name,
				price: Number(editingAddon.price),
				description: editingAddon.description || '',
				icon: editingAddon.icon || 'Zap',
				durationDays: Number(editingAddon.durationDays) || 30,
				features: typeof editingAddon.features === 'string' ? editingAddon.features.split('\n').filter((f: string) => f.trim() !== '') : (editingAddon.features || []),
				bgClass: editingAddon.bgClass || 'bg-slate-50 dark:bg-slate-800',
				textClass: editingAddon.textClass || 'text-slate-500',
				shadowClass: editingAddon.shadowClass || 'shadow-none'
			});
			showToast("Đã lưu gói dịch vụ!", "success");
			setEditingAddon(null);
		} catch (error) {
			showToast("Lỗi lưu gói dịch vụ", "error");
		}
	};

	const handleDeleteAddon = async (id: string) => {
		if (!window.confirm("Chắc chắn xóa gói dịch vụ này?")) return;
		try {
			const { deleteDoc } = await import('../services/firebase');
			await deleteDoc(doc(db, 'subscription_packages', id));
			showToast("Đã xóa gói dịch vụ", "info");
		} catch (error) {
			showToast("Lỗi khi xóa gói dịch vụ", "error");
		}
	};

	const toggleUserLock = async (ownerId: string, field: string, currentVal: boolean) => {
		try {
			const newVal = !currentVal;
			const updateData: any = { [field]: newVal };
			// Khi khoá → tự động set subscriptionStatus = expired để đồng bộ
			if (newVal) {
				updateData.subscriptionStatus = 'expired';
				updateData.isPro = false;
			}
			await setDoc(doc(db, 'settings', ownerId), updateData, { merge: true });

			const featureMap: Record<string, string> = {
				'manualLockOrders': 'Chi tiết Đơn hàng',
				'manualLockDebts': 'Công nợ Chi tiết',
				'manualLockSheets': 'Tải & Đồng bộ dữ liệu (Export)',
				'manualLockAi': 'Trợ lý AI'
			};
			const featureName = featureMap[field] || 'Chính sách hệ thống';

			await addDoc(collection(db, 'notifications'), {
				userId: ownerId,
				title: newVal ? `Đã khóa ${featureName}` : `Đã mở khóa ${featureName}`,
				body: newVal
					? `Quản trị viên đã tạm thời khóa quyền truy cập của cả doanh nghiệp vào ${featureName}.`
					: `Doanh nghiệp của bạn đã có thể truy cập lại vào ${featureName}.`,
				type: newVal ? 'lock' : 'unlock',
				read: false,
				createdAt: serverTimestamp()
			});
		} catch (error: any) {
			console.error("Lock Toggle Error:", error);
			showToast("Lỗi khi khóa: " + error.message, "error");
		}
	};

	const hardLockUser = async (customer: any) => {
		if (customer.manualLockOrders && customer.manualLockDebts && customer.manualLockSheets && customer.manualLockAi) return;
		await setDoc(doc(db, 'settings', customer.uid), { manualLockOrders: true, manualLockDebts: true, manualLockSheets: true, manualLockAi: true, subscriptionStatus: 'expired', isPro: false, graceUntil: null }, { merge: true });
		await addDoc(collection(db, 'notifications'), { userId: customer.uid, title: '🔒 TÍNH NĂNG ĐÃ BỊ KHOÁ', body: 'Gói đã hết hạn. Vui lòng gia hạn để tiếp tục.', type: 'lock', priority: 'high', read: false, createdAt: serverTimestamp() });
		// 📢 Thông báo cho admin
		await createAdminNotification(customer.uid, { title: '🔒 KH ĐÃ BỊ KHOÁ', body: `${customer.email || customer.uid} đã hết hạn gói và bị khoá tính năng.`, type: 'subscription', priority: 'high' });
	};

	// 💰 Check bank transfer matches from AppScript (auto-confirm payments)
	// 🔐 NOW validates BOTH transfer code AND amount before auto-approving
	const checkBankTransferMatches = async () => {
		const lastCheck = localStorage.getItem('nexus_last_bank_check');
		const now = Date.now();
		if (lastCheck && now - parseInt(lastCheck) < 5 * 60 * 1000) return; // Mỗi 5 phút
		
		try {
			const appscriptUrl = 'https://script.google.com/macros/s/AKfycbwu682rk8EZl4__DKtw-LgRLjozSvUk5Jj9QFQvvZnT5NLrUwdRn8a-1tfJ5oU5XIAABQ/exec';
			
			// Gửi kèm danh sách pending payments để Apps Script kiểm tra cả số tiền
			const pendingPayments = requests
				.filter((r: any) => r.status === 'pending' && r.transferCode)
				.map((r: any) => ({ transferCode: r.transferCode, amount: r.amount, id: r.id }));
			
			const res = await fetch(`${appscriptUrl}?token=dunvex-nexus-2026&action=check_transfers`, {
				method: 'POST',
				headers: { 'Content-Type': 'text/plain;charset=utf-8' },
				body: JSON.stringify({ action: 'check_transfers', pendingPayments })
			});
			
			if (res.ok) {
				const data = await res.json();
				
				// New format: matchedTransactions [{code, amount, bankAmount, date}]
				if (data.matches > 0 && Array.isArray(data.matchedTransactions)) {
					for (const tx of data.matchedTransactions) {
						const matchedReq = requests.find((r: any) =>
							r.transferCode === tx.code &&
							r.status === 'pending' &&
							// 🔐 Kiểm tra số tiền (±5% tolerance cho phí chuyển khoản)
							Math.abs(r.amount - tx.bankAmount) <= Math.max(r.amount * 0.05, 10000)
						);
						if (matchedReq) {
							console.log('Nexus AI: Auto-approving matched payment for', tx.code, 'amount:', tx.bankAmount);
							await handleApprovePayment(matchedReq, true);
						} else {
							console.log('Nexus AI: Code matched but amount mismatch for', tx.code, 'bank amount:', tx.bankAmount);
						}
					}
				}
				// Old format fallback: matchedCodes (chỉ check code, không check amount)
				else if (data.matches > 0 && Array.isArray(data.matchedCodes)) {
					console.warn('⚠️ Apps Script đang dùng format cũ (chỉ check code, không check tiền). Nên nâng cấp!');
					for (const code of data.matchedCodes) {
						const matchedReq = requests.find((r: any) => r.transferCode === code && r.status === 'pending');
						if (matchedReq) {
							console.log('Nexus AI: Auto-approving (old format) for', code);
							await handleApprovePayment(matchedReq, true);
						}
					}
				}
			}
		} catch (e) {
			// AppScript có thể chưa bật Gmail API — silent fail
			console.log('Bank check skipped:', (e as Error).message);
		}
		localStorage.setItem('nexus_last_bank_check', now.toString());
	};

	// --- AUTONOMOUS AI MANAGER LOGIC ---
	const runAutonomousCycle = async (currentCustomers: any[], currentRequests: any[]) => {
		if (!isAiActive) return;
		if (isRunningRef.current) { return; }
		isRunningRef.current = true;
		try {
			// Starting cycle
			if (currentCustomers.length === 0) return;
			
			// 0. Check bank transfer matches (mỗi 5 phút)
			await checkBankTransferMatches();
			
			const processPromises = currentCustomers.map(async (customer) => {
				if (customer.email === NEXUS_ADMIN_EMAIL) return;
				const status = getEffectiveStatus(customer);
				const now = new Date();
				// 1. Provision new users - dùng gói trial từ subscription_packages
				if (!customer.planId && !customer.isAiProcessed) {
					const expireDate = new Date();
				// Tìm gói miễn phí (price=0) trong subscription_packages
					let trialDays = 60;
					try {
						const pkgSnap = await getDocs(query(
							collection(db, 'subscription_packages'),
							where('price', '==', 0),
							limit(1)
						));
						if (!pkgSnap.empty) {
							const pkgData = pkgSnap.docs[0].data();
							trialDays = Number(pkgData.durationDays) || 60;
						}
					} catch (e) { /* fallback 60 ngày */ }
					expireDate.setDate(expireDate.getDate() + trialDays);
					await setDoc(doc(db, 'settings', customer.uid), { planId: 'free_trial', isPro: false, subscriptionStatus: 'trial', subscriptionExpiresAt: expireDate, graceUntil: null, isAiProcessed: true }, { merge: true });
				}
				// 2. Grace period
				if (status.isExpired) {
					const expireAt = status.expireAt;
					const graceUntil = parseExpireDate(customer.graceUntil);
					if (!graceUntil && expireAt) {
						const graceEnd = new Date(expireAt.getTime());
						graceEnd.setDate(graceEnd.getDate() + 3);
						if (now < graceEnd) {
							await setDoc(doc(db, 'settings', customer.uid), { graceUntil: graceEnd, subscriptionStatus: 'grace' }, { merge: true });
							await addDoc(collection(db, 'notifications'), { userId: customer.uid, title: '⚠️ GÓI ĐÃ HẾT HẠN — 3 NGÀY ÂN HẠN', body: `Gói đã hết hạn. Bạn có 3 ngày (đến ${graceEnd.toLocaleDateString('vi-VN')}) để gia hạn trước khi bị khoá.`, type: 'warning', priority: 'high', read: false, createdAt: serverTimestamp() });
							// 📢 Thông báo cho admin
							await createAdminNotification(customer.uid, { title: '⚠️ KH gần hết hạn', body: `${customer.email || customer.uid} sắp hết hạn gói. Gia hạn trước ${graceEnd.toLocaleDateString('vi-VN')}.`, type: 'subscription', priority: 'high' });
							return;
						}
					}
					if (graceUntil && now >= graceUntil) { await hardLockUser(customer); return; }
					// Grace đã hết → khoá cứng luôn (không cần đợi grace cycle tiếp theo)
					if (!graceUntil) { await hardLockUser(customer); return; }
				}
				// 3. Auto-unlock after 30 min
				if (customer.manualLockAi && customer.aiLockedAt) {
					const lockedAt = parseExpireDate(customer.aiLockedAt);
					if (lockedAt && (now.getTime() - lockedAt.getTime()) > 30 * 60 * 1000) {
						await setDoc(doc(db, 'settings', customer.uid), { manualLockOrders: false, manualLockDebts: false, manualLockSheets: false, manualLockAi: false, aiLockedAt: null, aiLockReason: null }, { merge: true });
						await addDoc(collection(db, 'notifications'), { userId: customer.uid, title: '🔓 TỰ ĐỘNG MỞ KHOÁ', body: 'Hệ thống đã tự mở khoá sau 30 phút.', type: 'unlock', read: false, createdAt: serverTimestamp() });
					}
				}
			});
			await Promise.all(processPromises);
		} finally {
			isRunningRef.current = false;
		}
	};

	// Interval 30 giây (ĐÃ TẮT - CHUYỂN LÊN CLOUD FUNCTIONS)
	// Việc kiểm tra tự động giờ đây được chạy ngầm trên Firebase Cloud Functions mỗi giờ.
	// Nút "Quét ngay" trên giao diện (nếu có) vẫn có thể dùng hàm runAutonomousCycle để ép quét tay.
	useEffect(() => {
		// if (!isAiActive) return;
		// const interval = setInterval(() => runAutonomousCycle(customersRef.current, requests), 30000);
		// return () => clearInterval(interval);
	}, [isAiActive]);

	if (auth.currentUser?.email !== NEXUS_ADMIN_EMAIL) {
		return (
			<div className="min-h-screen bg-[#f8f9fb] dark:bg-slate-950 flex flex-col items-center justify-center text-slate-800 dark:text-slate-900 dark:text-white p-8">
				<div className="bg-red-500/10 p-6 rounded-full text-red-500 mb-6 border border-red-500/20">
					<Lock size={64} />
				</div>
				<h1 className="text-4xl font-black uppercase tracking-tighter mb-4">Access Denied</h1>
				<p className="text-slate-500 dark:text-slate-400 text-center max-w-md">Nexus Control is restricted to system administrators only.</p>
				<button onClick={() => navigate('/')} className="mt-8 bg-white dark:bg-slate-900 dark:bg-white text-slate-900 dark:text-white dark:text-slate-950 px-8 py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all">Go Back</button>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#f8f9fb] dark:bg-slate-950 p-4 md:p-8 pb-32 font-sans selection:bg-indigo-500 selection:text-slate-900 dark:text-white transition-colors duration-300">
			<div className="max-w-[1400px] mx-auto">
				{/* Header */}
				<div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
					<div className="flex items-center gap-4">
						<div>
							<h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-900 dark:text-white uppercase tracking-tight">Nexus Control</h1>
							<p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">System Core v1.0</p>
						</div>
						<button 
							onClick={() => runAutonomousCycle(customers, requests)}
							className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-95"
						>
							<Bot size={14} />
							Đồng bộ AI
						</button>
						<button 
							onClick={checkBankTransferMatches}
							className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95"
							title="Kiểm tra email ngân hàng đối chiếu chuyển khoản"
						>
							<CreditCard size={14} />
							Check Bank
						</button>
					</div>

					<div className="flex bg-white dark:bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-100 dark:border-slate-800 overflow-x-auto no-scrollbar">
						<TabItem active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} icon={<Activity size={18} />} label="Hệ thống" badge={stats.pendingPayments} />
						<TabItem active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<Users size={18} />} label="Khách hàng" />
						<TabItem active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<Settings size={18} />} label="Lịch sử Log" />
						<TabItem active={activeTab === 'config'} onClick={() => setActiveTab('config')} icon={<Bot size={18} />} label="Cấu hình" />
						<TabItem active={activeTab === 'ai-analytics'} onClick={() => setActiveTab('ai-analytics')} icon={<BrainCircuit size={18} />} label="AI Analytics" />
					</div>
				</div>

				<div className="space-y-8 animate-in fade-in duration-500">
					{/* Stats Grid */}
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-10">
						<StatBox label="Doanh Nghiệp" value={stats.totalUsers} icon={<Users />} color="blue" />
						<StatBox label="Tài khoản Pro" value={stats.activePro} icon={<Crown />} color="amber" />
						<StatBox label="Yêu cầu chờ" value={stats.pendingPayments} icon={<Clock />} color="orange" />
						<StatBox label="Chuyển đổi" value={`${Math.round((stats.activePro / (stats.totalUsers || 1)) * 100)}%`} icon={<ArrowUpRight />} color="emerald" />
					</div>

					{activeTab === 'requests' && (
						<NexusRequestsTab
							requests={requests}
							onApprove={(req) => handleApprovePayment(req)}
							onReject={(req) => handleRejectPayment(req)}
							loading={loading}
						/>
					)}

					{activeTab === 'logs' && (
						<NexusLogsTab
							logs={logs}
							loading={loading}
						/>
					)}

					{activeTab === 'customers' && (
						<NexusCustomersTab
							customers={filteredCustomers}
							addons={addons}
							searchQuery={searchQuery}
							onSearchChange={setSearchQuery}
							onUpdatePlan={handleUpdatePlan}
							onToggleLock={toggleUserLock}
							getEffectiveStatus={getEffectiveStatus}
						/>
					)}

					{activeTab === 'config' && (
						<NexusConfigTab
							paymentConfig={paymentConfig}
							systemConfig={systemConfig}
							addons={addons}
							isSavingConfig={isSavingConfig}
							editingAddon={editingAddon}
							setEditingAddon={setEditingAddon}
							onSaveConfig={handleSaveConfig}
							onSaveAddon={handleSaveAddon}
							onDeleteAddon={handleDeleteAddon}
							onPaymentConfigChange={setPaymentConfig}
						/>
					)}

					{activeTab === 'ai-analytics' && (
						<NexusAiTab
							aiAnomalies={aiAnomalies}
							aiAnalyticsData={aiAnalyticsData}
						/>
					)}
				</div>
			</div>

			{/* ═══ QR Thanh Toán ═══ */}
			{qrModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setQrModal(null)}>
					<div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-white font-black text-sm uppercase">QR Thanh Toán</h3>
							<button onClick={() => setQrModal(null)} className="text-slate-500 hover:text-white text-xl leading-none">&times;</button>
						</div>
						<p className="text-slate-400 text-xs mb-2">Người nhận: <span className="text-white font-bold">{qrModal.name || qrModal.email}</span></p>
						<p className="text-slate-400 text-xs mb-4">Nội dung CK: <code className="bg-slate-800 px-2 py-0.5 rounded text-indigo-400 font-bold text-[11px]">DVX {qrModal.email}</code></p>
						<div className="space-y-3 max-h-[350px] overflow-y-auto">
							{addons.filter(a => !a.deleted && Number(a.price) > 0).slice(0, 5).map(pkg => (
								<div key={pkg.id} className="bg-slate-800 rounded-xl p-3">
									<div className="flex items-center justify-between mb-2">
										<span className="text-white font-bold text-xs">{pkg.name}</span>
										<span className="text-amber-400 font-black text-sm">{Number(pkg.price).toLocaleString()}đ</span>
									</div>
									{paymentConfig.bankId && paymentConfig.accountNumber ? (
										<img loading="lazy" src={`https://img.vietqr.io/image/${paymentConfig.bankId}-${paymentConfig.accountNumber}-compact.png?amount=${Number(pkg.price)}&addInfo=${encodeURIComponent('DVX ' + qrModal.email)}&accountName=${encodeURIComponent(paymentConfig.accountName || '')}`} alt={`QR ${pkg.name}`} className="w-full rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
									) : (
										<p className="text-[10px] text-amber-400 bg-amber-500/10 p-2 rounded text-center">⚠️ Chưa cấu hình TK nhận tiền (tab Cấu hình)</p>
									)}
								</div>
							))}
						</div>
						<p className="text-[10px] text-slate-600 mt-4 text-center">Hệ thống tự động kích hoạt sau khi nhận tiền</p>
					</div>
				</div>
			)}
		</div>
	);
};

const TabItem = ({ icon, label, active, onClick, badge }: any) => (
	<button
		onClick={onClick}
		className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[13px] whitespace-nowrap transition-all duration-300 ${active ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-600 dark:text-slate-300'}`}
	>
		{icon}
		{label}
		{badge > 0 && <span className="ml-1 size-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse">{badge}</span>}
	</button>
);

const StatBox = ({ label, value, icon, color }: any) => {
	const colorMap: Record<string, string> = {
		blue: 'text-blue-500 bg-blue-500/10',
		amber: 'text-amber-500 bg-amber-500/10',
		orange: 'text-orange-500 bg-orange-500/10',
		emerald: 'text-emerald-500 bg-emerald-500/10'
	};
	return (
		<div className="bg-white dark:bg-slate-900 rounded-2xl lg:rounded-3xl p-4 lg:p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-3 lg:gap-4 relative overflow-hidden group">
			<div className={`size-10 lg:size-12 rounded-xl lg:rounded-2xl ${colorMap[color]} flex items-center justify-center scale-90 lg:scale-100`}>{icon}</div>
			<div>
				<p className="text-[8px] lg:text-[10px] font-black text-slate-500 uppercase tracking-[2px] mb-1">{label}</p>
				<p className="text-lg lg:text-2xl font-black text-slate-900 dark:text-white tracking-tighter truncate">{value}</p>
			</div>
		</div>
	);
};

const ConfigToggle = ({ title, description, enabled, onToggle }: any) => (
	<div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 flex items-center justify-between group hover:border-slate-600 transition-all">
		<div className="pr-4">
			<h5 className="font-bold text-slate-900 dark:text-white mb-1 group-hover:text-indigo-400 transition-colors uppercase text-sm tracking-tight">{title}</h5>
			<p className="text-xs text-slate-500 font-medium">{description}</p>
		</div>
		<button onClick={onToggle} className={`w-14 h-8 shrink-0 rounded-full p-1 transition-colors duration-300 ${enabled ? 'bg-indigo-600' : 'bg-slate-700'}`}>
			<div className={`size-6 rounded-full bg-white shadow-xl transform transition-transform duration-300 ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
		</button>
	</div>
);

export default NexusControl;
