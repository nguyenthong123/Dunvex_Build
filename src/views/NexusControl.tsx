import React, { useState, useEffect, useRef } from 'react';
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
	Eye
} from 'lucide-react';
import { useToast } from '../components/shared/Toast';
import { auth, db } from '../services/firebase';
import {
	collection,
	query,
	onSnapshot,
	doc,
	updateDoc,
	serverTimestamp,
	orderBy,
	limit,
	getDoc,
	setDoc,
	addDoc
} from 'firebase/firestore';

const NEXUS_ADMIN_EMAIL = 'dunvex.green@gmail.com'; // User's email

const NexusControl = () => {
	const navigate = useNavigate();
	const { showToast } = useToast();
	const [activeTab, setActiveTab] = useState('requests');
	const [loading, setLoading] = useState(true);
	const [stats, setStats] = useState({
		totalUsers: 0,
		activePro: 0,
		pendingPayments: 0,
		totalRevenue: 0
	});

	const [requests, setRequests] = useState<any[]>([]);
	const [customers, setCustomers] = useState<any[]>([]);
	const [logs, setLogs] = useState<any[]>([]);
	const [aiAnomalies, setAiAnomalies] = useState<any[]>([]);
	const [isAiActive, setIsAiActive] = useState(true);
	const [systemConfig, setSystemConfig] = useState<any>({
		lock_free_orders: false,
		lock_free_debts: false,
		lock_free_sheets: false,
		maintenance_mode: false,
		ai_auto_lock: true
	});
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	useEffect(() => {
		// Security Check
		if (auth.currentUser?.email !== NEXUS_ADMIN_EMAIL) {
			// navigate('/');
			// return;
		}

		// 1. Listen to Payment Requests
		const qRequests = query(collection(db, 'payment_requests'), orderBy('createdAt', 'desc'), limit(50));
		const unsubRequests = onSnapshot(qRequests, (snap) => {
			const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
			setRequests(data);
			setStats(prev => ({ ...prev, pendingPayments: data.filter((r: any) => r.status === 'pending').length }));
		});

		// 2. Listen to Users & Settings to merge data
		const unsubUsers = onSnapshot(collection(db, 'users'), (userSnap) => {
			const usersData = userSnap.docs.map(d => ({ id: d.id, ...d.data() }));
			const owners = usersData.filter((u: any) => u.uid === u.ownerId || !u.ownerId);

			// Listen to Settings as well for real-time lock updates
			const unsubSettings = onSnapshot(collection(db, 'settings'), (settingsSnap) => {
				const settingsData: Record<string, any> = {};
				settingsSnap.docs.forEach(d => { settingsData[d.id] = d.data(); });

				// Merge Settings into Owners
				const merged = owners.map((u: any) => {
					const s = settingsData[u.uid] || {};
					return {
						...u,
						isPro: s.isPro ?? u.isPro ?? false,
						planId: s.planId || (s.isPro ? 'premium_monthly' : 'free'),
						subscriptionStatus: s.subscriptionStatus || (u.isPro ? 'active' : 'trial'),
						subscriptionExpiresAt: s.subscriptionExpiresAt || null,
						paymentConfirmedAt: s.paymentConfirmedAt || u.createdAt || null,
						manualLockOrders: s.manualLockOrders || false,
						manualLockDebts: s.manualLockDebts || false,
						manualLockSheets: s.manualLockSheets || false
					};
				});

				setCustomers(merged);
				setStats(prev => ({
					...prev,
					totalUsers: merged.length,
					activePro: merged.filter((c: any) => c.isPro).length
				}));
			});

			return () => unsubSettings();
		});

		// 3. System Config
		const fetchConfig = async () => {
			const docRef = doc(db, 'system_config', 'main');
			const docSnap = await getDoc(docRef);
			if (docSnap.exists()) {
				setSystemConfig(docSnap.data());
			}
			setLoading(false);
		};
		fetchConfig();

		// 4. Listen to Audit Logs (System-wide)
		const qLogs = query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(100));
		const unsubLogs = onSnapshot(qLogs, (snap) => {
			const newLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
			setLogs(newLogs);

			// AI ANOMALY DETECTION (Pocket Click Logic)
			if (isAiActive) {
				const userActionCounts: Record<string, any[]> = {};
				const now = Date.now();

				newLogs.forEach((log: any) => {
					const time = log.createdAt?.toMillis ? log.createdAt.toMillis() : 0;
					if (now - time < 60000) { // Only check last 60 seconds
						if (!userActionCounts[log.ownerId]) userActionCounts[log.ownerId] = [];
						userActionCounts[log.ownerId].push(log);
					}
				});

				const anomalies: any[] = [];
				Object.entries(userActionCounts).forEach(([ownerId, actions]) => {
					if (actions.length >= 5) { // Threshold: 5 actions in 1 minute
						// Check frequency
						const times = actions.map(a => a.createdAt?.toMillis ? a.createdAt.toMillis() : 0).sort();
						const span = times[times.length - 1] - times[0];
						if (span < 15000) { // 5 actions in 15 seconds = Suspicious
							anomalies.push({
								ownerId,
								email: actions[0].user,
								severity: 'high',
								reason: 'POCKET_CLICK_DETECTED',
								details: `Phát hiện ${actions.length} thao tác trong ${Math.round(span / 1000)}s - Có thể do cấn máy.`
							});

							// AUTO LOCK if enabled
							if (systemConfig.ai_auto_lock) {
								executeAiAutoLock(ownerId, actions[0].user);
							}
						}
					}
				});
				setAiAnomalies(anomalies);
			}
		});

		return () => {
			unsubRequests();
			unsubUsers();
			unsubLogs();
		};
	}, [navigate, isAiActive, systemConfig.ai_auto_lock]);

	const executeAiAutoLock = async (ownerId: string, email: string) => {
		try {
			// Only lock if not already locked
			const settingsRef = doc(db, 'settings', ownerId);
			const snap = await getDoc(settingsRef);
			const data = snap.data() || {};

			if (!data.manualLockOrders || !data.manualLockDebts || !data.manualLockSheets) {
				// We use setDoc with merge instead of updateDoc in case the doc doesn't exist yet
				await setDoc(settingsRef, {
					manualLockOrders: true,
					manualLockDebts: true,
					manualLockSheets: true,
					aiLockedAt: serverTimestamp(),
					aiLockReason: 'POCKET_CLICK_PREVENTION'
				}, { merge: true });

				// 🔍 AI Verification Step
				const verifySnap = await getDoc(settingsRef);
				const isLocked = verifySnap.exists() && verifySnap.data().manualLockOrders && verifySnap.data().manualLockDebts && verifySnap.data().manualLockSheets;

				// Notify User via Bell
				await addDoc(collection(db, 'notifications'), {
					userId: ownerId,
					title: isLocked ? '🔒 NEXUS AI: ĐÃ XÁC NHẬN KHÓA AN TOÀN' : '⚠️ CẢNH BÁO BẢO MẬT (NEXUS AI)',
					body: isLocked 
						? 'Hệ thống phát hiện thao tác nhanh bất thường. AI đã chủ động khóa và XÁC NHẬN KHÓA THÀNH CÔNG toàn bộ tính năng quan trọng để bảo vệ dữ liệu của bạn.'
						: 'Hệ thống phát hiện thao tác nhanh bất thường. Đang tiến hành khóa các chức năng, vui lòng kiểm tra lại.',
					type: 'alert',
					priority: 'high',
					read: false,
					createdAt: serverTimestamp()
				});

				// Log AI Action
				await addDoc(collection(db, 'ai_actions'), {
					type: 'security_lock',
					targetEmail: email,
					targetId: ownerId,
					details: 'Tự động khóa do phát hiện Pocket Click (thao tác nhanh bất thường)',
					timestamp: serverTimestamp()
				});

				showToast(`AI đã tự động khóa tài khoản ${email} do nghi ngờ cấn máy!`, "warning");
			}
		} catch (e) {
			console.error("AI Auto Lock Error:", e);
		}
	};

	// --- AUTONOMOUS AI MANAGER LOGIC ---
	const [aiActions, setAiActions] = useState<any[]>([]);

	useEffect(() => {
		const qActions = query(collection(db, 'ai_actions'), orderBy('timestamp', 'desc'), limit(20));
		return onSnapshot(qActions, (snap) => {
			setAiActions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		});
	}, []);

	const customersRef = useRef(customers);
	useEffect(() => {
		customersRef.current = customers;
	}, [customers]);

	useEffect(() => {
		if (isAiActive) {
			const interval = setInterval(() => {
				runAutonomousCycle(customersRef.current, requests);
			}, 30000); // Check every 30 seconds

			// Initial evaluation
			runAutonomousCycle(customersRef.current, requests);

			return () => clearInterval(interval);
		}
	}, [isAiActive, requests]);

	const runAutonomousCycle = async (currentCustomers: any[], currentRequests: any[]) => {
		if (!isAiActive) return;

		console.log("Nexus AI: Starting autonomous management cycle...");

		// 0. AUTO-APPROVE PENDING PAYMENT REQUESTS (TRUST MODEL)
		const pendingRequests = currentRequests.filter(r => r.status === 'pending');
		for (const req of pendingRequests) {
			try {
				await updateDoc(doc(db, 'payment_requests', req.id), {
					status: 'approved',
					handledAt: serverTimestamp(),
					handledBy: 'Nexus_AI_Bot'
				});

				const isYearly = req.planId === 'premium_yearly';
				const expireDate = new Date();
				if (isYearly) {
					expireDate.setFullYear(expireDate.getFullYear() + 1);
				} else {
					expireDate.setMonth(expireDate.getMonth() + 1);
				}

				await setDoc(doc(db, 'settings', req.ownerId), {
					subscriptionStatus: 'active',
					isPro: true,
					planId: req.planId,
					paymentConfirmedAt: serverTimestamp(),
					subscriptionExpiresAt: expireDate,
					manualLockOrders: false,
					manualLockDebts: false,
					manualLockSheets: false
				}, { merge: true });

				await addDoc(collection(db, 'ai_actions'), {
					type: 'provisioning',
					targetEmail: req.userEmail,
					targetId: req.ownerId,
					details: `Chấp nhận thanh toán tự động (Trust Model) cho gói ${req.planName || req.planId}. Đã mở khóa tính năng.`,
					timestamp: serverTimestamp()
				});

				await addDoc(collection(db, 'notifications'), {
					userId: req.ownerId,
					title: '⚡ NEXUS AI: ĐÃ XÁC NHẬN YÊU CẦU',
					body: `Yêu cầu kích hoạt gói ${req.planName || req.planId} đã được AI tự động duyệt. Tất cả tính năng đã được mở khóa! Vui lòng đảm bảo giao dịch đã hoàn tất.`,
					type: 'success',
					priority: 'high',
					read: false,
					createdAt: serverTimestamp()
				});
				
				console.log(`Nexus AI: Auto-approved payment for ${req.userEmail}`);
			} catch (e) {
				console.error("AI Auto Approve Error:", e);
			}
		}
		
		if (currentCustomers.length === 0) return;
		
		for (const customer of currentCustomers) {
			// CRITICAL: NEVER process the Super Admin account
			if (customer.email === NEXUS_ADMIN_EMAIL) continue;

			const status = getEffectiveStatus(customer);
			
			// 1. AUTO-PROVISIONING FOR NEW USERS (ADMINS/OWNERS)
			// A user is an "Admin/Owner" if uid matches ownerId (it's how we filtered them in useEffect)
			// Staff/Employees are NOT in this list, so they are never processed individually.
			const isNewOwner = !customer.planId && (!customer.paymentConfirmedAt || (customer.createdAt?.toDate && (Date.now() - customer.createdAt.toDate().getTime()) < 86400000));
			
			if (isNewOwner && !customer.isAiProcessed) {
				try {
					const expireDate = new Date();
					expireDate.setDate(expireDate.getDate() + 60); // 60 days trial

					await setDoc(doc(db, 'settings', customer.uid), {
						planId: 'free',
						isPro: false,
						subscriptionStatus: 'trial',
						paymentConfirmedAt: serverTimestamp(),
						subscriptionExpiresAt: expireDate,
						isAiProcessed: true // Mark so we don't repeat
					}, { merge: true });

					await addDoc(collection(db, 'ai_actions'), {
						type: 'provisioning',
						targetEmail: customer.email,
						targetId: customer.uid,
						details: 'Tự động kích hoạt gói dùng thử (FREE 60 ngày) cho người dùng mới.',
						timestamp: serverTimestamp()
					});
					console.log(`Nexus AI: Auto-provisioned trial for ${customer.email}`);
				} catch (e) { console.error("Auto Provision Error:", e); }
			}

			// 2. AUTO-ENFORCEMENT FOR EXPIRED USERS
			// If expired and features are NOT already manually locked or status is not expired
			if (status.isExpired && (!customer.manualLockOrders || !customer.manualLockDebts || !customer.manualLockSheets || customer.subscriptionStatus !== 'expired')) {
				try {
					await setDoc(doc(db, 'settings', customer.uid), {
						manualLockOrders: true,
						manualLockDebts: true,
						manualLockSheets: true,
						subscriptionStatus: 'expired',
						isPro: false
					}, { merge: true });

					// 🔍 AI Verification Step
						const verifySnap = await getDoc(doc(db, 'settings', customer.uid));
						const isLocked = verifySnap.exists() && verifySnap.data().manualLockOrders && verifySnap.data().manualLockDebts && verifySnap.data().manualLockSheets;

						// Notify Verification
						if (isLocked) {
							await addDoc(collection(db, 'notifications'), {
								userId: customer.uid,
								title: '🔒 HỆ THỐNG NEXUS AI: ĐÃ XÁC NHẬN KHÓA',
								body: 'Gói của bạn đã hết hạn. AI đã chủ động khóa và XÁC NHẬN KHÓA THÀNH CÔNG các tính năng theo chính sách. Vui lòng liên hệ Admin.',
								type: 'alert',
								priority: 'high',
								read: false,
								createdAt: serverTimestamp()
							});
						}

						await addDoc(collection(db, 'ai_actions'), {
							type: 'enforcement',
							targetEmail: customer.email,
							targetId: customer.uid,
							details: isLocked 
								? 'Tự động ngắt TẤT CẢ tính năng do hết hạn (ĐÃ XÁC NHẬN KHÓA THÀNH CÔNG).'
								: 'Tự động ngắt tính năng do hết hạn (Không thể xác minh khóa).',
							timestamp: serverTimestamp()
						});

						await addDoc(collection(db, 'notifications'), {
							userId: customer.uid,
							title: '🔒 TỰ ĐỘNG KHÓA VÀ THU HỒI GÓI (HẾT HẠN)',
							body: 'Gói dịch vụ cũ của bạn đã hết hạn. Hệ thống AI đã tự động cập nhật trạng thái gói và khóa các tính năng (Đơn hàng, Công nợ, Sheet) để bảo vệ dữ liệu. Vui lòng thực hiện thanh toán gia hạn để tự động kích hoạt lại.',
							type: 'lock',
							priority: 'high',
							read: false,
							createdAt: serverTimestamp()
						});
						console.log(`Nexus AI: Auto-locked expired account ${customer.email}`);
					} catch (e) {
					console.error("Auto Enforcement Error:", e);
				}
			}
		}
	};

	// Run cycle when customers change or AI is toggled
	useEffect(() => {
		const timeout = setTimeout(runAutonomousCycle, 5000); // Wait 5s for data to settle
		return () => clearTimeout(timeout);
	}, [customers.length, isAiActive]);

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
					manualLockSheets: true
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
				expireDate.setDate(expireDate.getDate() - 1);
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

	const getEffectiveStatus = (c: any) => {
		const now = new Date();
		const joinedAt = c.paymentConfirmedAt?.toDate ? c.paymentConfirmedAt.toDate() : (c.paymentConfirmedAt?.seconds ? new Date(c.paymentConfirmedAt.seconds * 1000) : null);
		const expireAt = c.subscriptionExpiresAt?.toDate ? c.subscriptionExpiresAt.toDate() : (c.subscriptionExpiresAt?.seconds ? new Date(c.subscriptionExpiresAt.seconds * 1000) : null);

		const diffDays = joinedAt ? Math.floor((now.getTime() - joinedAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;

		let isExpired = false;
		if (expireAt) {
			isExpired = expireAt < now;
		} else if (joinedAt) {
			// Legacy fallback if expireAt is missing
			const plan = c.planId || (c.isPro ? 'premium_monthly' : 'free');
			if (plan === 'free' && diffDays > 60) isExpired = true;
			else if (plan === 'premium_monthly' && diffDays > 30) isExpired = true;
			else if (plan === 'premium_yearly' && diffDays > 365) isExpired = true;
		}

		return {
			isExpired,
			daysUsed: diffDays
		};
	};

	const handleApprovePayment = async (request: any) => {
		if (!window.confirm(`Xác nhận thanh toán ${request.amount.toLocaleString()}đ cho ${request.userEmail}?`)) return;

		try {
			await updateDoc(doc(db, 'payment_requests', request.id), {
				status: 'approved',
				handledAt: serverTimestamp(),
				handledBy: auth.currentUser?.email
			});

			const isYearly = request.planId === 'premium_yearly';
			const expireDate = new Date();
			if (isYearly) {
				expireDate.setFullYear(expireDate.getFullYear() + 1);
			} else {
				expireDate.setMonth(expireDate.getMonth() + 1);
			}

			await setDoc(doc(db, 'settings', request.ownerId), {
				subscriptionStatus: 'active',
				isPro: true,
				planId: request.planId,
				paymentConfirmedAt: serverTimestamp(),
				subscriptionExpiresAt: expireDate,
				// Auto-unlock features upon approval
				manualLockOrders: false,
				manualLockDebts: false,
				manualLockSheets: false
			}, { merge: true });

			// Notify User via AI
			await addDoc(collection(db, 'notifications'), {
				userId: request.ownerId,
				title: '✨ GIA HẠN THÀNH CÔNG',
				body: `Nexus AI đã nhận được xác nhận thanh toán. Gói ${request.planName || request.planId} đã được kích hoạt. Tất cả tính năng đã được mở khóa.`,
				type: 'success',
				priority: 'high',
				read: false,
				createdAt: serverTimestamp()
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
				manualLockSheets: true
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

	const toggleUserLock = async (ownerId: string, field: string, currentVal: boolean) => {
		try {
			const newVal = !currentVal;
			await setDoc(doc(db, 'settings', ownerId), {
				[field]: newVal
			}, { merge: true });

			const featureMap: Record<string, string> = {
				'manualLockOrders': 'Chi tiết Đơn hàng',
				'manualLockDebts': 'Công nợ Chi tiết',
				'manualLockSheets': 'Tải & Đồng bộ dữ liệu (Export)'
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
		} catch (error) {
			// Error
		}
	};

	if (auth.currentUser?.email !== NEXUS_ADMIN_EMAIL) {
		return (
			<div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-8">
				<div className="bg-red-500/10 p-6 rounded-full text-red-500 mb-6 border border-red-500/20">
					<Lock size={64} />
				</div>
				<h1 className="text-4xl font-black uppercase tracking-tighter mb-4">Access Denied</h1>
				<p className="text-slate-400 text-center max-w-md">Nexus Control is restricted to system administrators only.</p>
				<button onClick={() => navigate('/')} className="mt-8 bg-white text-slate-950 px-8 py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-slate-200 transition-all">Go Back</button>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500 selection:text-white">
			{/* Mobile Header Overlay */}
			<div className="lg:hidden h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 sticky top-0 z-[60]">
				<div className="flex items-center gap-2">
					<Database size={20} className="text-indigo-500" />
					<h2 className="text-sm font-black text-white uppercase tracking-tight">Nexus</h2>
				</div>
				<button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-400">
					<Filter size={24} />
				</button>
			</div>

			{/* Sidebar */}
			<aside className={`fixed left-0 top-0 bottom-0 w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-6 z-[100] transition-transform duration-300 lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
				<div className="flex items-center justify-between lg:justify-start gap-3 mb-10 px-2">
					<div className="flex items-center gap-3">
						<div className="size-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
							<Database size={24} className="text-white" />
						</div>
						<div>
							<h2 className="text-lg font-black tracking-tighter text-white uppercase">Nexus Control</h2>
							<p className="text-[10px] font-black text-indigo-400 tracking-widest uppercase">System Core v1.0</p>
						</div>
					</div>
					<button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-2 text-slate-500">
						<XCircle size={20} />
					</button>
				</div>

				<nav className="flex-1 space-y-2">
					<SidebarItem icon={<Activity size={20} />} label="Hệ thống" active={activeTab === 'requests'} onClick={() => { setActiveTab('requests'); setIsMobileMenuOpen(false); }} badge={stats.pendingPayments} />
					<SidebarItem icon={<Users size={20} />} label="Khách hàng" active={activeTab === 'customers'} onClick={() => { setActiveTab('customers'); setIsMobileMenuOpen(false); }} />
					<SidebarItem icon={<Settings size={20} />} label="Lịch sử Log" active={activeTab === 'config'} onClick={() => { setActiveTab('config'); setIsMobileMenuOpen(false); }} />
					<SidebarItem icon={<Bot size={20} />} label="Nexus AI Manager" active={activeTab === 'ai'} onClick={() => { setActiveTab('ai'); setIsMobileMenuOpen(false); }} />
				</nav>

				<div className="mt-auto p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
					<div className="flex items-center gap-3 mb-3">
						<div className="size-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
							<ShieldAlert size={16} />
						</div>
						<p className="text-xs font-bold text-slate-300">Admin Mode</p>
					</div>
					<p className="text-[10px] text-slate-500 font-medium break-all">{auth.currentUser?.email}</p>
				</div>
			</aside>

			{/* Backdrop */}
			{isMobileMenuOpen && (
				<div onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] lg:hidden" />
			)}

			{/* Main Content */}
			<main className="lg:pl-64 min-h-screen flex flex-col">
				<header className="h-16 lg:h-20 border-b border-slate-800 flex items-center justify-between px-6 lg:px-10 bg-slate-950/50 backdrop-blur-xl sticky top-16 lg:top-0 z-40">
					<div>
						<h3 className="text-lg lg:text-2xl font-black text-white uppercase tracking-tight">
							{activeTab === 'requests' ? 'Yêu cầu' : activeTab === 'customers' ? 'Doanh nghiệp' : activeTab === 'config' ? 'Nhật ký Hệ thống' : 'Nexus AI Intelligence'}
						</h3>
					</div>
				</header>

				<div className="p-4 lg:p-10 flex-1 overflow-y-auto">
					{/* Stats Grid */}
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-10">
						<StatBox label="Doanh Nghiệp" value={stats.totalUsers} icon={<Users />} color="blue" />
						<StatBox label="Tài khoản Pro" value={stats.activePro} icon={<Crown />} color="amber" />
						<StatBox label="Yêu cầu chờ" value={stats.pendingPayments} icon={<Clock />} color="orange" />
						<StatBox label="Chuyển đổi" value={`${Math.round((stats.activePro / (stats.totalUsers || 1)) * 100)}%`} icon={<ArrowUpRight />} color="emerald" />
					</div>

					{activeTab === 'requests' && (
						<div className="space-y-6">
							<div className="bg-slate-900 rounded-3xl lg:rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl">
								{/* Desktop Table */}
								<div className="hidden md:block overflow-x-auto">
									<table className="w-full text-left min-w-[800px]">
										<thead>
											<tr className="bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
												<th className="px-8 py-5">Khách hàng</th>
												<th className="px-8 py-5">Gói đăng ký</th>
												<th className="px-8 py-5">Ngày gửi</th>
												<th className="px-8 py-5">Coupon</th>
												<th className="px-8 py-5">Nội dung chuyển</th>
												<th className="px-8 py-5">Số tiền</th>
												<th className="px-8 py-5 text-right">Hành động</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-slate-800">
											{requests.map((req) => (
												<tr key={req.id} className="hover:bg-slate-800/30 transition-colors group text-xs">
													<td className="px-8 py-6">
														<div className="flex items-center gap-3">
															<div className="size-10 rounded-xl bg-slate-800 flex items-center justify-center font-black text-slate-400">
																{req.userEmail?.[0].toUpperCase()}
															</div>
															<div className="max-w-[150px] truncate">
																<p className="font-bold text-white truncate">{req.userEmail}</p>
																<p className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-tight">{req.ownerId?.slice(-8)}</p>
															</div>
														</div>
													</td>
													<td className="px-8 py-6">
														<span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${req.planId === 'premium_yearly' ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
															{req.planName}
														</span>
													</td>
													<td className="px-8 py-6 text-slate-400 font-medium">
														{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleString('vi-VN', {
															hour: '2-digit',
															minute: '2-digit',
															day: '2-digit',
															month: '2-digit'
														}) : '---'}
													</td>
													<td className="px-8 py-6 font-black text-rose-500 uppercase tracking-widest">
														{req.appliedCode || '---'}
													</td>
													<td className="px-8 py-6 text-indigo-400 font-black tracking-widest">{req.transferCode || '---'}</td>
													<td className="px-8 py-6 font-black text-white">{req.amount.toLocaleString()}đ</td>
													<td className="px-8 py-6 text-right">
														<div className="flex justify-end gap-2">
															<button
																onClick={() => handleApprovePayment(req)}
																className={`size-10 rounded-xl flex items-center justify-center transition-all ${req.status === 'approved' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white'}`}
															>
																<CheckCircle2 size={18} />
															</button>
															<button
																onClick={() => handleRejectPayment(req)}
																className={`size-10 rounded-xl flex items-center justify-center transition-all ${req.status === 'rejected' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white'}`}
															>
																<XCircle size={18} />
															</button>
														</div>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>

								{/* Mobile Cards */}
								<div className="md:hidden divide-y divide-slate-800">
									{requests.map((req) => (
										<div key={req.id} className="p-6 space-y-4">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-3">
													<div className="size-10 rounded-xl bg-slate-800 flex items-center justify-center font-black text-slate-400">
														{req.userEmail?.[0].toUpperCase()}
													</div>
													<div>
														<p className="font-bold text-white text-sm">{req.userEmail}</p>
														<p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{req.ownerId?.slice(-8)}</p>
													</div>
												</div>
												<span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${req.planId === 'premium_yearly' ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
													{req.planName}
												</span>
											</div>
											<div className="grid grid-cols-2 gap-4 text-[10px] items-center">
												<div>
													<p className="text-slate-500 font-black uppercase tracking-widest mb-1">Số tiền</p>
													<p className="text-white font-black text-base">{req.amount.toLocaleString()}đ</p>
												</div>
												<div>
													<p className="text-slate-500 font-black uppercase tracking-widest mb-1">Mã CK</p>
													<p className="text-indigo-400 font-black tracking-widest uppercase">{req.transferCode || '---'}</p>
												</div>
											</div>
											<div className="flex items-center justify-between pt-2">
												<div className="text-[9px] text-slate-500 font-medium">
													{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleString('vi-VN') : '---'}
												</div>
												<div className="flex gap-2">
													<button
														onClick={() => handleApprovePayment(req)}
														className="bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest flex items-center gap-2"
													>
														<CheckCircle2 size={14} /> Duyệt
													</button>
													<button
														onClick={() => handleRejectPayment(req)}
														className="bg-rose-500/10 text-rose-500 px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest flex items-center gap-2"
													>
														<XCircle size={14} /> Loại
													</button>
												</div>
											</div>
										</div>
									))}
									{requests.length === 0 && (
										<div className="py-20 text-center text-slate-600 font-black uppercase tracking-widest text-xs opacity-40">
											Không có yêu cầu nào
										</div>
									)}
								</div>
							</div>
						</div>
					)}

					{activeTab === 'config' && (
						<div className="space-y-6">
							<div className="bg-slate-900 rounded-3xl lg:rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl">
								<div className="px-6 lg:px-8 py-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
									<div>
										<h4 className="text-[10px] lg:text-xs font-black text-indigo-400 uppercase tracking-[4px] mb-1">System Audit Logs</h4>
										<p className="text-[9px] lg:text-[10px] text-slate-500 font-bold uppercase tracking-wider">Theo dõi hoạt động toàn hệ thống</p>
									</div>
									<div className="size-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
										<Activity size={20} />
									</div>
								</div>

								{/* Desktop Table */}
								<div className="hidden md:block overflow-x-auto">
									<table className="w-full text-left min-w-[800px]" data-chatbot="audit-logs-table">
										<thead>
											<tr className="bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
												<th className="px-8 py-5">Thời gian</th>
												<th className="px-8 py-5">Người dùng</th>
												<th className="px-8 py-5">Trang</th>
												<th className="px-8 py-5">Hành động</th>
												<th className="px-8 py-5">Chi tiết</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-slate-800">
											{logs.map((log) => (
												<tr key={log.id} className="hover:bg-slate-800/30 transition-colors group text-xs" data-chatbot-row={log.id}>
													<td className="px-8 py-6 text-slate-400 font-medium whitespace-nowrap" data-chatbot-cell="time">
														{log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString('vi-VN', {
															hour: '2-digit',
															minute: '2-digit',
															day: '2-digit',
															month: '2-digit',
															year: '2-digit'
														}) : '---'}
													</td>
													<td className="px-8 py-6" data-chatbot-cell="user">
														<div className="flex items-center gap-3">
															<div className="size-8 rounded-lg bg-slate-800 flex items-center justify-center font-black text-slate-500 text-[10px]">
																{log.user?.[0].toUpperCase() || 'U'}
															</div>
															<div className="max-w-[200px] truncate">
																<p className="font-bold text-white truncate">{log.user || 'Hệ thống'}</p>
																<p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{log.ownerId?.slice(-8) || 'GLOBAL'}</p>
															</div>
														</div>
													</td>
													<td className="px-8 py-6">
														<span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider">{log.path || '/home'}</span>
													</td>
													<td className="px-8 py-6" data-chatbot-cell="action">
														<span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-slate-800 text-indigo-400 border border-slate-700/50`}>
															{log.action}
														</span>
													</td>
													<td className="px-8 py-6 text-slate-300 font-medium leading-relaxed max-w-md" data-chatbot-cell="details">
														{log.details}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>

								{/* Mobile Cards */}
								<div className="md:hidden divide-y divide-slate-800">
									{logs.map((log) => (
										<div key={log.id} className="p-6 space-y-3">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<p className="text-xs font-black text-white uppercase tracking-tight">{log.user || 'Hệ thống'}</p>
													<span className="text-[9px] text-slate-500 font-bold px-1.5 py-0.5 bg-slate-800 rounded">{log.ownerId?.slice(-8) || 'GLOBAL'}</span>
												</div>
												<span className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">{log.action}</span>
											</div>
											<p className="text-xs text-slate-400 font-medium leading-relaxed">{log.details}</p>
											<div className="flex items-center justify-between pt-2">
												<span className="text-[9px] text-slate-600 font-black uppercase tracking-tighter">{log.path || '/home'}</span>
												<span className="text-[9px] text-slate-600 font-medium">
													{log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString('vi-VN') : '---'}
												</span>
											</div>
										</div>
									))}
									{logs.length === 0 && (
										<div className="py-20 text-center text-slate-600 font-black uppercase tracking-widest text-xs opacity-40">
											Chưa có dữ liệu nhật ký
										</div>
									)}
								</div>
							</div>
						</div>
					)}

					{activeTab === 'customers' && (
						<div className="bg-slate-900 rounded-3xl lg:rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl">
							{/* Desktop Table */}
							<div className="hidden lg:block overflow-x-auto">
								<table className="w-full text-left min-w-[900px]">
									<thead>
										<tr className="bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
											<th className="px-6 py-5">Doanh nghiệp</th>
											<th className="px-6 py-5">Email Owner</th>
											<th className="px-6 py-5">Gói</th>
											<th className="px-6 py-5">Ngày vào trang</th>
											<th className="px-3 py-5 text-center">Đơn</th>
											<th className="px-3 py-5 text-center">Nợ</th>
											<th className="px-3 py-5 text-center">Sheet</th>
											<th className="px-6 py-5 text-right">Chi tiết</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-800">
										{customers.map((c) => {
											const eff = getEffectiveStatus(c);
											return (
												<tr key={c.id} className="hover:bg-slate-800/30 transition-colors text-xs">
													<td className="px-6 py-6 font-bold text-white uppercase truncate max-w-[150px]">
														{c.displayName || 'No Name'}
													</td>
													<td className="px-6 py-6 text-slate-400">{c.email}</td>
													<td className="px-6 py-6">
														<select
															className="bg-slate-800 text-white text-[10px] font-black rounded-lg px-2 py-1 outline-none border border-slate-700 hover:border-indigo-500 transition-colors cursor-pointer"
															value={c.planId || (c.isPro ? 'premium_monthly' : 'free')}
															onChange={(e) => handleUpdatePlan(c.uid, e.target.value)}
														>
															<option value="test_expire">TEST HẾT HẠN (-1d)</option>
															<option value="free">FREE (60d)</option>
															<option value="premium_monthly">1 THÁNG (30d)</option>
															<option value="premium_yearly">1 NĂM (365d)</option>
															<option value="cancel_payment">⛔ HUỶ ĐĂNG KÝ (KHÓA)</option>
														</select>
													</td>
													<td className="px-6 py-6 text-slate-500 whitespace-nowrap">
														<div className={`font-bold text-[10px] ${eff.isExpired ? 'text-rose-500' : 'text-slate-300'}`}>
															{eff.isExpired ? 'ĐÃ HẾT HẠN' : 'ĐANG HIỆU LỰC'}
														</div>
														<div className="text-[10px] uppercase font-black tracking-tighter">
															{c.paymentConfirmedAt?.toDate ? c.paymentConfirmedAt.toDate().toLocaleDateString('vi-VN') : '---'}
															<span className="ml-1 opacity-50">({eff.daysUsed}d)</span>
														</div>
													</td>
													<td className="px-3 py-6 text-center">
														<button
															onClick={() => toggleUserLock(c.uid, 'manualLockOrders', c.manualLockOrders)}
															className={`size-8 rounded-lg flex items-center justify-center mx-auto transition-all ${c.manualLockOrders ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-800 text-slate-500 hover:text-white'}`}
															title={c.manualLockOrders ? "Đã khóa" : "Khóa thủ công"}
														>
															{c.manualLockOrders ? <Lock size={12} /> : <Unlock size={12} />}
														</button>
													</td>
													<td className="px-3 py-6 text-center">
														<button
															onClick={() => toggleUserLock(c.uid, 'manualLockDebts', c.manualLockDebts)}
															className={`size-8 rounded-lg flex items-center justify-center mx-auto transition-all ${c.manualLockDebts ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-800 text-slate-500 hover:text-white'}`}
															title={c.manualLockDebts ? "Đã khóa" : "Khóa thủ công"}
														>
															{c.manualLockDebts ? <Lock size={12} /> : <Unlock size={12} />}
														</button>
													</td>
													<td className="px-3 py-6 text-center">
														<button
															onClick={() => toggleUserLock(c.uid, 'manualLockSheets', c.manualLockSheets)}
															className={`size-8 rounded-lg flex items-center justify-center mx-auto transition-all ${c.manualLockSheets ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-800 text-slate-500 hover:text-white'}`}
															title={c.manualLockSheets ? "Đã khóa" : "Khóa thủ công"}
														>
															{c.manualLockSheets ? <Lock size={12} /> : <Unlock size={12} />}
														</button>
													</td>
													<td className="px-6 py-6 text-right">
														<ExternalLink size={16} className="text-slate-600 cursor-not-allowed mx-auto" />
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>

							{/* Mobile/Tablet Card Layout */}
							<div className="lg:hidden divide-y divide-slate-800">
								{customers.map((c) => {
									const eff = getEffectiveStatus(c);
									return (
										<div key={c.id} className="p-6 space-y-5">
											<div className="flex items-center justify-between">
												<div>
													<p className="font-black text-white text-sm uppercase tracking-tight mb-1">{c.displayName || 'No Name'}</p>
													<p className="text-[10px] text-slate-500 font-medium">{c.email}</p>
												</div>
												<div className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${eff.isExpired ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
													{eff.isExpired ? 'Hết hạn' : 'Active'}
												</div>
											</div>

											<div className="grid grid-cols-2 gap-4">
												<div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
													<p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Gói dịch vụ</p>
													<select
														className="w-full bg-slate-900 text-white text-[10px] font-black rounded-lg px-2 py-1.5 outline-none border border-slate-700"
														value={c.planId || (c.isPro ? 'premium_monthly' : 'free')}
														onChange={(e) => handleUpdatePlan(c.uid, e.target.value)}
													>
														<option value="test_expire">TEST HẾT HẠN</option>
														<option value="free">FREE</option>
														<option value="premium_monthly">M-PRO</option>
														<option value="premium_yearly">Y-PRO</option>
														<option value="cancel_payment">⛔ HUỶ ĐĂNG KÝ (KHÓA)</option>
													</select>
												</div>
												<div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 flex flex-col justify-center">
													<p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Thời gian đã dùng</p>
													<p className="text-white font-black text-sm uppercase">{eff.daysUsed} ngày</p>
												</div>
											</div>

											<div className="flex items-center justify-between bg-slate-800/30 p-4 rounded-2xl border border-slate-700/30">
												<div className="flex flex-col items-center gap-1.5">
													<p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Đơn hàng</p>
													<button
														onClick={() => toggleUserLock(c.uid, 'manualLockOrders', c.manualLockOrders)}
														className={`size-10 rounded-xl flex items-center justify-center transition-all ${c.manualLockOrders ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-500'}`}
													>
														{c.manualLockOrders ? <Lock size={16} /> : <Unlock size={16} />}
													</button>
												</div>
												<div className="flex flex-col items-center gap-1.5">
													<p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Công nợ</p>
													<button
														onClick={() => toggleUserLock(c.uid, 'manualLockDebts', c.manualLockDebts)}
														className={`size-10 rounded-xl flex items-center justify-center transition-all ${c.manualLockDebts ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-500'}`}
													>
														{c.manualLockDebts ? <Lock size={16} /> : <Unlock size={16} />}
													</button>
												</div>
												<div className="flex flex-col items-center gap-1.5">
													<p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Sheets</p>
													<button
														onClick={() => toggleUserLock(c.uid, 'manualLockSheets', c.manualLockSheets)}
														className={`size-10 rounded-xl flex items-center justify-center transition-all ${c.manualLockSheets ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-500'}`}
													>
														{c.manualLockSheets ? <Lock size={16} /> : <Unlock size={16} />}
													</button>
												</div>
											</div>
										</div>
									);
								})}
								{customers.length === 0 && (
									<div className="py-20 text-center text-slate-600 font-black uppercase tracking-widest text-xs opacity-40">
										Chưa có doanh nghiệp nào
									</div>
								)}
							</div>
						</div>
					)}

					{activeTab === 'ai' && (
						<div className="space-y-6 lg:space-y-8 max-w-5xl">
							{/* AI Control Panel */}
							<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
								<div className="lg:col-span-2 bg-slate-900 rounded-[2rem] border border-slate-800 p-6 lg:p-8 shadow-2xl relative overflow-hidden group">
									<div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity hidden sm:block">
										<Bot size={120} className="text-indigo-500 rotate-12" />
									</div>
									<div className="relative z-10">
										<div className="flex items-center gap-4 mb-6">
											<div className={`size-12 rounded-2xl flex items-center justify-center ${isAiActive ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40 animate-pulse' : 'bg-slate-800 text-slate-500'}`}>
												<Zap size={24} />
											</div>
											<div>
												<h4 className="text-lg lg:text-xl font-black text-white uppercase tracking-tight">Nexus AI Core</h4>
												<p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">Autonomous System Monitoring</p>
											</div>
										</div>

										<div className="grid grid-cols-2 gap-3 lg:gap-4 mb-8">
											<div className="bg-slate-800/40 p-4 lg:p-5 rounded-2xl border border-slate-700/50">
												<p className="text-[8px] lg:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Status</p>
												<p className={`text-xs lg:text-sm font-black uppercase ${isAiActive ? 'text-emerald-400' : 'text-rose-400'}`}>
													{isAiActive ? 'Active' : 'Offline'}
												</p>
											</div>
											<div className="bg-slate-800/40 p-4 lg:p-5 rounded-2xl border border-slate-700/50">
												<p className="text-[8px] lg:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Threats</p>
												<p className={`text-xs lg:text-sm font-black uppercase ${aiAnomalies.length > 0 ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`}>
													{aiAnomalies.length > 0 ? 'Urgent' : 'Safe'}
												</p>
											</div>
										</div>

										<div className="flex flex-col sm:flex-row gap-3">
											<button
												onClick={() => setIsAiActive(!isAiActive)}
												className={`w-full sm:w-auto px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${isAiActive ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'}`}
											>
												{isAiActive ? 'Stop AI Monitor' : 'Start Nexus AI'}
											</button>
											<button
												onClick={() => toggleSystemFlag('ai_auto_lock')}
												className={`w-full sm:w-auto px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${systemConfig.ai_auto_lock ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}
											>
												Auto-Lock: {systemConfig.ai_auto_lock ? 'ON' : 'OFF'}
											</button>
										</div>
									</div>
								</div>

								<div className="bg-slate-900 rounded-[2rem] border border-slate-800 p-6 lg:p-8 shadow-2xl flex flex-col items-center justify-center text-center">
									<div className="size-16 lg:size-20 rounded-3xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6">
										<Eye size={32} />
									</div>
									<h5 className="font-black text-white uppercase tracking-tight mb-2 text-sm lg:text-base">Bot Intelligence</h5>
									<p className="text-[10px] lg:text-xs text-slate-500 font-medium mb-6">
										Bot đang quét và phân tích thao tác cấn máy trên toàn bộ ứng dụng.
									</p>
									<div className="w-full bg-slate-800 h-1.5 lg:h-2 rounded-full overflow-hidden">
										<div className="bg-indigo-500 h-full w-[85%] animate-[progress_2s_ease-in-out_infinite]" />
									</div>
								</div>
							</div>

							{/* Anomalies section */}
							<div className="bg-slate-900 rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl">
								<div className="px-6 lg:px-8 py-5 lg:py-6 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
									<div className="flex items-center gap-3">
										<AlertTriangle className="text-amber-500" size={20} />
										<h4 className="text-[10px] lg:text-xs font-black text-white uppercase tracking-[2px] lg:tracking-[4px]">Cảnh báo bất thường</h4>
									</div>
									<span className="text-[10px] text-slate-500 font-black uppercase whitespace-nowrap">{aiAnomalies.length} Phát hiện</span>
								</div>

								{/* Desktop Table */}
								<div className="hidden md:block overflow-x-auto">
									<table className="w-full text-left">
										<thead>
											<tr className="bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
												<th className="px-8 py-5">Tài khoản</th>
												<th className="px-8 py-5">Phân loại</th>
												<th className="px-8 py-5">Chi tiết phân tích AI</th>
												<th className="px-8 py-5 text-right">Thao tác</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-slate-800">
											{aiAnomalies.map((anom, idx) => (
												<tr key={idx} className="bg-rose-500/5 hover:bg-rose-500/10 transition-colors">
													<td className="px-8 py-6">
														<p className="font-bold text-white text-xs">{anom.email}</p>
														<p className="text-[10px] text-slate-500 font-black tracking-widest">{anom.ownerId?.slice(-8)}</p>
													</td>
													<td className="px-8 py-6">
														<span className="px-1.5 py-0.5 bg-rose-500 text-white rounded font-black text-[8px] uppercase tracking-wider">
															Suspicious
														</span>
													</td>
													<td className="px-8 py-6 text-slate-300 text-xs font-medium italic">
														"{anom.details}"
													</td>
													<td className="px-8 py-6 text-right">
														<button
															onClick={() => toggleUserLock(anom.ownerId, 'manualLockOrders', false)}
															className="bg-white text-slate-950 px-3 py-1.5 rounded-lg font-black text-[9px] uppercase hover:bg-indigo-500 hover:text-white transition-all shadow-sm"
														>
															Mở khóa
														</button>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>

								{/* Mobile Cards */}
								<div className="md:hidden divide-y divide-slate-800">
									{aiAnomalies.map((anom, idx) => (
										<div key={idx} className="p-6 space-y-4 bg-rose-500/5">
											<div className="flex items-center justify-between">
												<div className="min-w-0">
													<p className="text-xs font-black text-white uppercase truncate pr-2">{anom.email}</p>
													<p className="text-[9px] text-slate-500 font-black tracking-widest uppercase">{anom.ownerId?.slice(-8)}</p>
												</div>
												<span className="shrink-0 px-2 py-1 bg-rose-500 text-white rounded-lg font-black text-[8px] uppercase tracking-wider">Mối đe dọa</span>
											</div>
											<div className="bg-slate-900/50 p-4 rounded-xl border border-rose-500/10">
												<p className="text-[11px] text-slate-300 font-medium italic leading-relaxed">"{anom.details}"</p>
											</div>
											<button
												onClick={() => toggleUserLock(anom.ownerId, 'manualLockOrders', false)}
												className="w-full bg-white text-slate-950 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-white/5 active:scale-95 transition-transform"
											>
												Can thiệp ngay
											</button>
										</div>
									))}
								</div>
								{aiAnomalies.length === 0 && (
									<div className="py-20 text-center text-slate-600 font-black uppercase tracking-widest text-[10px] opacity-40">
										✨ Hệ thống chưa phát hiện hành vi bất thường
									</div>
								)}
							</div>

							{/* Autonomous Actions Log */}
							<div className="bg-slate-900 rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl">
								<div className="px-6 lg:px-8 py-5 lg:py-6 border-b border-slate-800 bg-indigo-500/5 flex items-center justify-between">
									<div className="flex items-center gap-3">
										<ShieldAlert className="text-indigo-400" size={20} />
										<h4 className="text-[10px] lg:text-xs font-black text-white uppercase tracking-[2px] lg:tracking-[4px]">Tác vụ tự động</h4>
									</div>
									<div className="hidden sm:flex items-center gap-2">
										<div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
										<span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Bot Live Monitoring</span>
									</div>
								</div>

								{/* Actions List (Unified for better mobile display) */}
								<div className="divide-y divide-slate-800/50">
									{aiActions.map((action) => (
										<div key={action.id} className="p-5 lg:px-8 lg:py-6 hover:bg-slate-800/10 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
											<div className="flex items-center gap-4">
												<div className={`size-10 rounded-xl shrink-0 flex items-center justify-center ${
													action.type === 'provisioning' ? 'bg-emerald-500/10 text-emerald-500' :
													action.type === 'enforcement' ? 'bg-amber-500/10 text-amber-500' :
													'bg-rose-500/10 text-rose-500'
												}`}>
													{action.type === 'provisioning' ? <Crown size={18} /> : <Zap size={18} />}
												</div>
												<div className="min-w-0">
													<p className="font-bold text-white text-xs sm:text-sm truncate sm:max-w-[200px]">{action.targetEmail}</p>
													<p className="text-[10px] text-slate-500 mt-0.5">
														{action.timestamp?.toDate ? action.timestamp.toDate().toLocaleString('vi-VN', {
															hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit'
														}) : '---'}
													</p>
												</div>
											</div>
											<div className="flex flex-col sm:items-end gap-1 px-14 sm:px-0">
												<span className="text-[10px] text-slate-400 font-medium bg-slate-800/50 px-2 py-1 rounded-md">
													{action.details}
												</span>
											</div>
										</div>
									))}
								</div>
								{aiActions.length === 0 && (
									<div className="py-20 text-center text-slate-600 font-black uppercase tracking-widest text-[10px] opacity-40">
										Đang chờ tác vụ tiếp theo...
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			</main>
		</div>
	);
};

const SidebarItem = ({ icon, label, active, onClick, badge }: any) => (
	<button
		onClick={onClick}
		className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all relative group ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
	>
		<span className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
		<span className="font-bold text-sm tracking-tight">{label}</span>
		{badge > 0 && <span className="ml-auto size-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse">{badge}</span>}
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
		<div className="bg-slate-900 rounded-2xl lg:rounded-3xl p-4 lg:p-6 border border-slate-800 shadow-xl flex flex-col gap-3 lg:gap-4 relative overflow-hidden group">
			<div className={`size-10 lg:size-12 rounded-xl lg:rounded-2xl ${colorMap[color]} flex items-center justify-center scale-90 lg:scale-100`}>{icon}</div>
			<div>
				<p className="text-[8px] lg:text-[10px] font-black text-slate-500 uppercase tracking-[2px] mb-1">{label}</p>
				<p className="text-lg lg:text-2xl font-black text-white tracking-tighter truncate">{value}</p>
			</div>
		</div>
	);
};

const ConfigToggle = ({ title, description, enabled, onToggle }: any) => (
	<div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 flex items-center justify-between group hover:border-slate-600 transition-all">
		<div className="pr-4">
			<h5 className="font-bold text-white mb-1 group-hover:text-indigo-400 transition-colors uppercase text-sm tracking-tight">{title}</h5>
			<p className="text-xs text-slate-500 font-medium">{description}</p>
		</div>
		<button onClick={onToggle} className={`w-14 h-8 shrink-0 rounded-full p-1 transition-colors duration-300 ${enabled ? 'bg-indigo-600' : 'bg-slate-700'}`}>
			<div className={`size-6 rounded-full bg-white shadow-xl transform transition-transform duration-300 ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
		</button>
	</div>
);

export default NexusControl;
