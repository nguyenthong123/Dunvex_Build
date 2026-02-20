import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../services/firebase';
import { collection, query, where, onSnapshot, serverTimestamp, doc, updateDoc, limit, setDoc, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { useNavigate, useLocation } from 'react-router-dom';
import { Users, Ticket, DollarSign, Target, ShieldCheck, CheckCircle2, Share2, Award, Percent, Clipboard, XCircle, Calendar, Filter, Send, Image as ImageIcon, Search, Zap, Edit2, Trash2 } from 'lucide-react';
import { useOwner } from '../hooks/useOwner';

const Affiliate = () => {
	const owner = useOwner();
	const isNexusAdmin = auth.currentUser?.email === 'dunvex.green@gmail.com';
	const isAdmin = owner.role === 'admin' || isNexusAdmin;
	const currentUserId = auth.currentUser?.uid;

	// Refs & Navigation
	const networkRef = useRef<HTMLDivElement>(null);
	const location = useLocation();
	const navigate = useNavigate();

	// States
	const [affiliates, setAffiliates] = useState<any[]>([]);
	const [myAffiliateData, setMyAffiliateData] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [regStatus, setRegStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
	const [regForm, setRegForm] = useState({
		name: auth.currentUser?.displayName || '',
		email: auth.currentUser?.email || '',
		phone: '',
		note: '',
		referrerCode: '',
		bankName: '',
		bankNumber: '',
		bankAccountName: ''
	});

	// Stats & Filters
	const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
	const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
	const [affiliateStats, setAffiliateStats] = useState<Record<string, { discount: number, commission: number, orderCount: number }>>({});

	// Payout Modal
	const [showPayModal, setShowPayModal] = useState(false);
	const [selectedAffForPay, setSelectedAffForPay] = useState<any>(null);
	const [payAmountInput, setPayAmountInput] = useState('');
	const [payProofUrl, setPayProofUrl] = useState('');
	const [paySubmitting, setPaySubmitting] = useState(false);
	const [payouts, setPayouts] = useState<any[]>([]);
	const [showHistory, setShowHistory] = useState(false);

	// Edit Affiliate Modal
	const [editingAffiliate, setEditingAffiliate] = useState<any>(null);
	const [editForm, setEditForm] = useState<any>({});
	const [adminTab, setAdminTab] = useState<'active' | 'pending' | 'rejected'>('active');

	// Registration Handler
	const handleRegister = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!currentUserId) return alert("Vui lòng đăng nhập để đăng ký Affiliate");

		setRegStatus('submitting');
		try {
			const referralCode = `DVX${Math.random().toString(36).substring(2, 7).toUpperCase()} `;

			// Resolve referrer if code provided
			let referrerData = null;
			if (regForm.referrerCode) {
				const q = query(collection(db, 'affiliates'), where('referralCode', '==', regForm.referrerCode.toUpperCase()), limit(1));
				const ship = await getDocs(q);
				if (!ship.empty) {
					referrerData = {
						userId: ship.docs[0].id,
						name: ship.docs[0].data().name,
						code: ship.docs[0].data().referralCode
					};
				}
			}

			const affiliatePayload = {
				...regForm,
				userId: currentUserId,
				ownerId: owner.ownerId || 'GLOBAL',
				referralCode,
				status: 'pending',
				commissionRate: 5,
				discountRate: 10,
				referrerId: referrerData?.userId || null,
				referrerName: referrerData?.name || null,
				referrerCode: referrerData?.code || null,
				createdAt: serverTimestamp()
			};

			await setDoc(doc(db, 'affiliates', currentUserId), affiliatePayload);

			// Send Email Notification to Admin
			try {
				await fetch('https://script.google.com/macros/s/AKfycbwIup8ysoKT4E_g8GOVrBiQxXw7SOtqhLWD2b0GOUT54MuoXgTtxP42XSpFR_3aoXAG7g/exec', {
					method: 'POST',
					mode: 'no-cors',
					body: JSON.stringify({
						action: 'affiliate_registration',
						...regForm,
						referralCode,
						userId: currentUserId
					})
				});
			} catch (err) {
				console.warn("Email notify trigger failed:", err);
			}

			setRegStatus('success');
		} catch (error) {
			console.error("Error registering affiliate:", error);
			alert("Lỗi khi đăng ký. Vui lòng thử lại.");
			setRegStatus('idle');
		}
	};

	// Fetch Stats Logic
	useEffect(() => {
		if (!isAdmin) return;

		const fetchStats = async () => {
			try {
				const start = new Date(startDate);
				start.setHours(0, 0, 0, 0);
				const end = new Date(endDate);
				end.setHours(23, 59, 59, 999);

				const q = query(
					collection(db, 'orders'),
					where('orderDate', '>=', start.toISOString()),
					where('orderDate', '<=', end.toISOString())
				);

				const snap = await getDocs(q);
				const stats: Record<string, any> = {};

				snap.docs.forEach(d => {
					const data = d.data();
					if (data.affiliateId) {
						if (!stats[data.affiliateId]) {
							stats[data.affiliateId] = { discount: 0, commission: 0, orderCount: 0 };
						}
						stats[data.affiliateId].discount += (Number(data.discountValue) || 0);
						// Commission is usually based on subTotal
						const comm = Math.round(((Number(data.subTotal) || 0) * (Number(data.affiliateCommissionRate) || 0)) / 100);
						stats[data.affiliateId].commission += comm;
						stats[data.affiliateId].orderCount += 1;
					}
				});
				setAffiliateStats(stats);
			} catch (err) {
				console.error("Error fetching aff stats:", err);
			}
		};

		fetchStats();
	}, [isAdmin, startDate, endDate, affiliates.length]);

	useEffect(() => {
		const params = new URLSearchParams(location.search);
		if (params.get('view') === 'network' && networkRef.current) {
			networkRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}, [location.search, loading]);

	// Payout Handler
	const handlePayout = async (e: React.FormEvent) => {
		e.preventDefault();
		const amount = parseInt(payAmountInput);
		if (!selectedAffForPay || !amount || amount <= 0) return;

		setPaySubmitting(true);
		try {
			const payoutData = {
				affiliateId: selectedAffForPay.id,
				affiliateName: selectedAffForPay.name,
				affiliateEmail: selectedAffForPay.email,
				amount: amount,
				proofUrl: payProofUrl,
				paidBy: auth.currentUser?.email,
				ownerId: owner.ownerId,
				date: new Date().toISOString(),
				createdAt: serverTimestamp()
			};

			await addDoc(collection(db, 'affiliate_payouts'), payoutData);

			// Email Notify Partner via GAS
			await fetch('https://script.google.com/macros/s/AKfycbwIup8ysoKT4E_g8GOVrBiQxXw7SOtqhLWD2b0GOUT54MuoXgTtxP42XSpFR_3aoXAG7g/exec', {
				method: 'POST',
				mode: 'no-cors',
				body: JSON.stringify({
					action: 'affiliate_payout_notify',
					email: selectedAffForPay.email,
					name: selectedAffForPay.name,
					amount: amount,
					proofUrl: payProofUrl
				})
			});

			alert("Đã ghi nhận lệnh chi và gửi email thông báo cho đối tác!");
			setShowPayModal(false);
			setPayAmountInput('');
			setPayProofUrl('');
		} catch (err) {
			console.error("Payout error:", err);
			alert("Lỗi khi thực hiện lệnh chi.");
		} finally {
			setPaySubmitting(false);
		}
	};

	const handleImageUpload = async (file: File) => {
		const reader = new FileReader();
		reader.onloadend = async () => {
			const base64 = (reader.result as string).split(',')[1];
			setPaySubmitting(true);
			try {
				const res = await fetch('https://script.google.com/macros/s/AKfycbwIup8ysoKT4E_g8GOVrBiQxXw7SOtqhLWD2b0GOUT54MuoXgTtxP42XSpFR_3aoXAG7g/exec', {
					method: 'POST',
					body: JSON.stringify({
						action: 'file_upload',
						filename: `payout_${Date.now()}.png`,
						mimeType: 'image/png',
						base64Data: base64,
						folderId: '1e_wK4mFQOgYeOBLpO6tfXyHLXnU0d8SU'
					})
				});
				const data = await res.json();
				if (data.status === 'success') {
					setPayProofUrl(data.fileUrl);
				}
			} catch (err) {
				console.error("Upload failed:", err);
			} finally {
				setPaySubmitting(false);
			}
		};
		reader.readAsDataURL(file);
	};

	// Load Data
	useEffect(() => {
		let unsubAffiliates = () => { };
		if (isAdmin) {
			const q = isNexusAdmin
				? query(collection(db, 'affiliates'))
				: query(collection(db, 'affiliates'), where('ownerId', '==', owner.ownerId));

			unsubAffiliates = onSnapshot(q, (snap) => {
				setAffiliates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
				setLoading(false);
			});
		}

		// Fetch Payouts if Admin
		let unsubPayouts = () => { };
		if (isAdmin) {
			const pq = query(collection(db, 'affiliate_payouts'), limit(50));
			unsubPayouts = onSnapshot(pq, (snap) => {
				const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
				setPayouts(list.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
			});
		}

		if (currentUserId) {
			const unsubMy = onSnapshot(doc(db, 'affiliates', currentUserId), (snap) => {
				if (snap.exists()) {
					setMyAffiliateData({ id: snap.id, ...snap.data() });
				}
				if (!isAdmin) setLoading(false);
			});
			return () => {
				unsubAffiliates();
				unsubPayouts();
				unsubMy();
			};
		}

		return () => {
			unsubAffiliates();
			unsubPayouts();
		};
	}, [owner.ownerId, isAdmin, isNexusAdmin, currentUserId]);

	// Handle Deep Link Actions from Email
	useEffect(() => {
		const searchParams = new URLSearchParams(location.search);
		const action = searchParams.get('action');
		const uid = searchParams.get('uid');

		if (action && uid && isAdmin && affiliates.length > 0) {
			const target = affiliates.find(a => a.id === uid);
			if (target) {
				const confirmMsg = action === 'APPROVE'
					? `Bạn có chắc muốn KÍCH HOẠT đối tác ${target.name}?`
					: `Bạn có chắc muốn TỪ CHỐI đối tác ${target.name}?`;

				if (window.confirm(confirmMsg)) {
					handleUpdateStatus(uid, action === 'APPROVE' ? 'active' : 'rejected', target.email, target.name, target.referralCode);
					// Clear params
					navigate('/affiliate', { replace: true });
				}
			}
		}
	}, [location.search, isAdmin, affiliates.length]);

	const handleUpdateStatus = async (affId: string, status: string, partnerEmail: string, partnerName: string, referralCode: string) => {
		try {
			await updateDoc(doc(db, 'affiliates', affId), { status });

			// Notify Partner via Email
			fetch('https://script.google.com/macros/s/AKfycbwIup8ysoKT4E_g8GOVrBiQxXw7SOtqhLWD2b0GOUT54MuoXgTtxP42XSpFR_3aoXAG7g/exec', {
				method: 'POST',
				mode: 'no-cors',
				body: JSON.stringify({
					action: 'affiliate_status_notify',
					email: partnerEmail,
					name: partnerName,
					status: status,
					referralCode: referralCode
				})
			});

			alert(status === 'active' ? "Đã kích hoạt & gửi email chào mừng!" : "Đã từ chối & gửi email thông báo.");
		} catch (error) {
			console.error("Error updating affiliate status:", error);
			alert("Lỗi khi cập nhật trạng thái.");
		}
	};

	const handleSaveEdit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingAffiliate) return;
		try {
			await updateDoc(doc(db, 'affiliates', editingAffiliate.id), {
				...editForm,
				referralCode: editForm.referralCode?.toUpperCase()
			});
			alert("Đã cập nhật thông tin đối tác!");
			setEditingAffiliate(null);
		} catch (err) {
			console.error("Update error:", err);
			alert("Lỗi khi cập nhật.");
		}
	};

	const handleDeleteAffiliate = async (id: string, name: string) => {
		if (window.confirm(`BẠN CÓ CHẮC MUỐN XÓA đối tác ${name}? Hành động này không thể hoàn tác.`)) {
			try {
				await deleteDoc(doc(db, 'affiliates', id));
				alert("Đã xóa đối tác khỏi mạng lưới.");
			} catch (err) {
				console.error("Delete error:", err);
				alert("Lỗi khi xóa.");
			}
		}
	};

	if (loading) return <div className="p-12 text-center animate-pulse font-black text-slate-400 uppercase tracking-widest text-xs">Đang đồng bộ dữ liệu đối tác...</div>;

	// RENDER REGISTRATION FORM
	if (!myAffiliateData && regStatus !== 'success' && !isNexusAdmin) {
		return (
			<div className="p-4 md:p-12 max-w-4xl mx-auto">
				<div className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 md:p-16 shadow-2xl border border-slate-100 dark:border-slate-800 text-center relative overflow-hidden">
					<div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50 dark:bg-indigo-900/20 rounded-full -mr-48 -mt-48 blur-[100px] opacity-60"></div>

					<div className="relative">
						<div className="size-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-8 shadow-2xl shadow-indigo-500/40 rotate-12">
							<Share2 size={36} />
						</div>
						<h2 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4">Mạng lưới Affiliate</h2>
						<p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto font-medium leading-relaxed">
							Trở thành đối tác của Dunvex. Giới thiệu khách hàng mới bằng mã giảm giá riêng và nhận hoa hồng xứng đáng.
						</p>

						{/* Policy Notice */}
						<div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-3xl p-6 mb-10 text-left">
							<h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
								<ShieldCheck size={14} /> Quy trình & Trách nhiệm đối tác
							</h4>
							<ul className="space-y-2 text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
								<li className="flex gap-2">• <span className="flex-1">Đối tác đóng vai trò là kỹ thuật viên và người đại diện hỗ trợ khách hàng sử dụng App.</span></li>
								<li className="flex gap-2">• <span className="flex-1 text-emerald-600 dark:text-emerald-500 font-black">Ưu đãi giảm giá chỉ áp dụng cho tài khoản đăng ký mới lần đầu.</span></li>
								<li className="flex gap-2">• <span className="flex-1 text-indigo-600 dark:text-indigo-400 font-black">Hoa hồng vẫn được tính cho các lần gia hạn và đăng ký lại của khách hàng.</span></li>
								<li className="flex gap-2">• <span className="flex-1">Số tiền hoa hồng sẽ được thanh toán định kỳ qua tài khoản ngân hàng bên dưới.</span></li>
							</ul>
						</div>

						<form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
							<div className="space-y-3">
								<label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-[2px]">Tên đối tác</label>
								<input
									className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[1.5rem] px-6 py-5 font-black text-slate-700 dark:text-white focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-300"
									placeholder="VD: Nguyễn Văn A"
									value={regForm.name}
									onChange={e => setRegForm({ ...regForm, name: e.target.value })}
									required
								/>
							</div>
							<div className="space-y-3">
								<label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-[2px]">Email liên lạc</label>
								<input
									className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[1.5rem] px-6 py-5 font-black text-slate-700 dark:text-white focus:ring-4 focus:ring-indigo-500/10"
									value={regForm.email}
									onChange={e => setRegForm({ ...regForm, email: e.target.value })}
									required
									type="email"
								/>
							</div>
							<div className="space-y-3">
								<label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-[2px]">Số điện thoại</label>
								<input
									className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[1.5rem] px-6 py-5 font-black text-slate-700 dark:text-white focus:ring-4 focus:ring-indigo-500/10"
									value={regForm.phone}
									onChange={e => setRegForm({ ...regForm, phone: e.target.value })}
									required
								/>
							</div>
							<div className="space-y-3">
								<label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-[2px]">Mã giới thiệu (Nếu có)</label>
								<input
									className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[1.5rem] px-6 py-5 font-black text-slate-700 dark:text-white focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-300"
									placeholder="VD: DVX12345"
									value={regForm.referrerCode}
									onChange={e => setRegForm({ ...regForm, referrerCode: e.target.value.toUpperCase() })}
								/>
							</div>

							{/* Bank Info Section */}
							<div className="md:col-span-2 pt-4">
								<div className="flex items-center gap-3 mb-6">
									<div className="h-[2px] flex-1 bg-slate-100 dark:bg-slate-800"></div>
									<span className="text-[10px] font-black text-slate-300 uppercase tracking-[4px]">Thông tin thanh toán</span>
									<div className="h-[2px] flex-1 bg-slate-100 dark:bg-slate-800"></div>
								</div>
							</div>

							<div className="space-y-3">
								<label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-[2px]">Ngân hàng</label>
								<input
									className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[1.5rem] px-6 py-5 font-black text-slate-700 dark:text-white focus:ring-4 focus:ring-indigo-500/10"
									placeholder="VD: Vietcombank, MB Bank..."
									value={regForm.bankName}
									onChange={e => setRegForm({ ...regForm, bankName: e.target.value })}
									required
								/>
							</div>
							<div className="space-y-3">
								<label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-[2px]">Số tài khoản</label>
								<input
									className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[1.5rem] px-6 py-5 font-black text-slate-700 dark:text-white focus:ring-4 focus:ring-indigo-500/10"
									value={regForm.bankNumber}
									onChange={e => setRegForm({ ...regForm, bankNumber: e.target.value })}
									required
								/>
							</div>
							<div className="space-y-3 md:col-span-2">
								<label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-[2px]">Chủ tài khoản (Viết hoa không dấu)</label>
								<input
									className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[1.5rem] px-6 py-5 font-black text-slate-700 dark:text-white focus:ring-4 focus:ring-indigo-500/10"
									placeholder="VD: NGUYEN VAN A"
									value={regForm.bankAccountName}
									onChange={e => setRegForm({ ...regForm, bankAccountName: e.target.value.toUpperCase() })}
									required
								/>
							</div>

							<div className="space-y-3 md:col-span-2">
								<label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-[2px]">Lời nhắn</label>
								<textarea
									className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[1.5rem] px-6 py-5 font-black text-slate-700 dark:text-white focus:ring-4 focus:ring-indigo-500/10 h-28 resize-none"
									placeholder="Chia sẻ thêm về kinh nghiệm của bạn..."
									value={regForm.note}
									onChange={e => setRegForm({ ...regForm, note: e.target.value })}
								/>
							</div>
							<div className="md:col-span-2 pt-6">
								<button
									type="submit"
									disabled={regStatus === 'submitting'}
									className="w-full bg-indigo-600 text-white font-black uppercase tracking-[4px] py-6 rounded-[2rem] shadow-2xl shadow-indigo-500/40 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
								>
									{regStatus === 'submitting' ? 'Đang gửi yêu cầu...' : 'Ghi danh đối tác'}
								</button>
							</div>
						</form>
					</div>
				</div>
			</div>
		);
	}

	if (regStatus === 'success') {
		return (
			<div className="p-8 text-center max-w-lg mx-auto mt-20">
				<div className="bg-white dark:bg-slate-900 p-16 rounded-[4rem] shadow-[0_50px_100px_rgba(0,0,0,0.1)] border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-500">
					<div className="size-24 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
						<CheckCircle2 size={56} />
					</div>
					<h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase mb-6 tracking-tight">Cảm ơn bạn!</h3>
					<p className="text-slate-500 dark:text-slate-400 mb-12 font-bold text-sm leading-relaxed">Đơn đăng ký của bạn đã được nhận. Dunvex sẽ kiểm tra và phản hồi qua Email trong vòng 24h làm việc.</p>
					<button onClick={() => window.location.reload()} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-[2px]">Hoàn tất</button>
				</div>
			</div>
		);
	}

	// DASHBOARD VIEW
	return (
		<div className="p-4 md:p-12 space-y-10 animate-in fade-in duration-700">
			<header className="flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-8">
				<div className="space-y-1 md:space-y-2">
					<div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-[2px]">
						<Award size={12} /> Partner Program
					</div>
					<h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Affiliate Hub</h2>
					<p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-[3px]">Hệ thống quản lý đối tác & mã ưu đãi</p>
				</div>

				{myAffiliateData && myAffiliateData.status === 'active' && (
					<div className="bg-white dark:bg-slate-900 px-6 md:px-10 py-4 md:py-6 rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 flex items-center gap-6 md:gap-10">
						<div className="flex flex-col flex-1 md:flex-initial">
							<span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[3px] mb-2 px-1">Mã của bạn:</span>
							<div className="flex items-center gap-3 md:gap-4 bg-indigo-50 dark:bg-indigo-900/20 px-4 md:px-6 py-2.5 md:py-3 rounded-[1.5rem] border border-indigo-100 dark:border-indigo-900/50">
								<Ticket size={20} className="text-indigo-600" />
								<span className="text-xl md:text-2xl font-black text-indigo-600 tracking-[1px] select-all uppercase">{myAffiliateData.referralCode}</span>
							</div>
						</div>
					</div>
				)}
			</header>

			{/* Stats Grid */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
				<div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden group">
					<div className="absolute -right-6 -bottom-6 bg-indigo-50 dark:bg-indigo-900/20 size-24 md:size-32 rounded-full transition-transform duration-700 group-hover:scale-150 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40"></div>
					<Users size={20} className="text-indigo-600 mb-4 md:mb-6 relative" />
					<p className="text-[10px] md:text-[12px] font-black text-slate-400 uppercase tracking-[3px] mb-1 md:mb-2 relative">Đối tác đồng hành</p>
					<h3 className="text-2xl md:text-4xl font-black text-indigo-600 relative tabular-nums">{affiliates.filter(a => a.status === 'active').length}</h3>
				</div>
				<div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden group">
					<div className="absolute -right-6 -bottom-6 bg-emerald-50 dark:bg-emerald-900/20 size-24 md:size-32 rounded-full transition-transform duration-700 group-hover:scale-150 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40"></div>
					<Target size={20} className="text-emerald-500 mb-4 md:mb-6 relative" />
					<p className="text-[10px] md:text-[12px] font-black text-slate-400 uppercase tracking-[3px] mb-1 md:mb-2 relative">Lượt chốt đơn qua mã</p>
					<h3 className="text-2xl md:text-4xl font-black text-emerald-500 relative tabular-nums">0</h3>
				</div>
				<div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden group">
					<div className="absolute -right-6 -bottom-6 bg-amber-50 dark:bg-amber-900/20 size-24 md:size-32 rounded-full transition-transform duration-700 group-hover:scale-150 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40"></div>
					<DollarSign size={20} className="text-amber-500 mb-4 md:mb-6 relative" />
					<p className="text-[10px] md:text-[12px] font-black text-slate-400 uppercase tracking-[3px] mb-1 md:mb-2 relative">Hoa hồng tích lũy</p>
					<h3 className="text-2xl md:text-4xl font-black text-amber-500 relative tabular-nums">0 ₫</h3>
				</div>
			</div>

			{/* Admin Interface */}
			{isAdmin && (
				<div ref={networkRef} className="bg-white dark:bg-slate-900 rounded-[2.5rem] md:rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden mt-10">
					<div className="p-6 md:p-10 border-b border-slate-50 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-50/30 backdrop-blur-sm">
						<div>
							<h3 className="text-base md:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Thiết lập & Quản lý mạng lưới</h3>
							<p className="text-[10px] text-slate-400 font-black mt-1 uppercase tracking-[3px] opacity-70">* Quản lý mã ưu đãi toàn hệ thống</p>
						</div>
						<div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 md:gap-6 w-full md:w-auto">
							<div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
								<button
									onClick={() => setAdminTab('active')}
									className={`px - 6 py - 2 rounded - xl text - [10px] font - black uppercase tracking - widest transition - all ${adminTab === 'active' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'} `}
								>
									Mạng lưới ({(affiliates.filter(a => a.status === 'active').length)})
								</button>
								<button
									onClick={() => setAdminTab('pending')}
									className={`px - 6 py - 2 rounded - xl text - [10px] font - black uppercase tracking - widest transition - all ${adminTab === 'pending' ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'} `}
								>
									Phê duyệt ({(affiliates.filter(a => a.status === 'pending').length)})
								</button>
							</div>

							<div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
								<Calendar size={14} className="text-slate-400" />
								<input
									type="date"
									className="bg-transparent border-none p-0 text-[10px] font-black text-slate-600 dark:text-white focus:ring-0"
									value={startDate}
									onChange={e => setStartDate(e.target.value)}
								/>
								<span className="text-slate-300 font-bold">→</span>
								<input
									type="date"
									className="bg-transparent border-none p-0 text-[10px] font-black text-slate-600 dark:text-white focus:ring-0"
									value={endDate}
									onChange={e => setEndDate(e.target.value)}
								/>
							</div>
						</div>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full text-left text-sm">
							<thead className="bg-[#fcfdff] dark:bg-slate-800/80 text-[10px] font-black text-indigo-500 uppercase tracking-[3px] text-center border-b border-slate-50 dark:border-slate-800">
								<tr>
									<th className="px-6 py-6 text-left font-black">Đối tác</th>
									<th className="px-4 py-6 font-black uppercase">Mã ưu đãi</th>
									<th className="px-4 py-6 font-black uppercase">Người giới thiệu</th>
									<th className="px-4 py-6 font-black uppercase">Trạng thái</th>
									<th className="px-4 py-6 font-black uppercase whitespace-nowrap">Khách giảm (%)</th>
									<th className="px-4 py-6 font-black uppercase whitespace-nowrap">Hoa hồng (%)</th>
									<th className="px-4 py-6 font-black uppercase">Tiền giảm (KH)</th>
									<th className="px-4 py-6 font-black uppercase">Hoa hồng (∑)</th>
									<th className="px-6 py-6 font-black uppercase">Hành động</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-50 dark:divide-slate-800">
								{affiliates.filter(a => a.status === adminTab).length === 0 ? (
									<tr><td colSpan={9} className="px-10 py-20 text-center text-slate-300 font-black uppercase tracking-[4px] text-xs">Không có dữ liệu trong mục này</td></tr>
								) : (
									affiliates.filter(a => a.status === adminTab).map((aff) => (
										<tr key={aff.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-all duration-300 group">
											<td className="px-10 py-6">
												<div className="flex items-center gap-4">
													<div className="size-12 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 rounded-2xl flex items-center justify-center font-black shadow-sm group-hover:scale-110 transition-transform">
														{aff.name[0].toUpperCase()}
													</div>
													<div>
														<p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none mb-1">{aff.name}</p>
														<p className="text-[9px] font-bold text-slate-400 opacity-60 uppercase mb-2">{aff.email}</p>
														{/* Bank Details in Mini-tag */}
														<div className="flex flex-wrap gap-1">
															<span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[8px] font-black text-slate-500 rounded-md uppercase border border-slate-200 dark:border-slate-700">{aff.bankName}</span>
															<span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[8px] font-black text-indigo-500 rounded-md uppercase border border-slate-200 dark:border-slate-700">{aff.bankNumber}</span>
														</div>
													</div>
												</div>
											</td>
											<td className="px-4 py-6 text-center">
												<div className="flex items-center justify-center gap-2 group/code">
													<span className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-lg font-black text-xs select-all border border-slate-100 dark:border-slate-700 shadow-inner">
														{aff.referralCode}
													</span>
													<button
														onClick={() => {
															navigator.clipboard.writeText(aff.referralCode);
															alert("Đã sao chép mã ưu đãi!");
														}}
														className="size-6 flex items-center justify-center text-slate-300 hover:text-indigo-600 transition-colors"
														title="Sao chép mã"
													>
														<Clipboard size={12} />
													</button>
												</div>
											</td>
											<td className="px-4 py-6 text-center">
												{aff.referrerCode ? (
													<div>
														<p className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase leading-none mb-1">{aff.referrerName}</p>
														<p className="text-[9px] font-bold text-indigo-500 opacity-60">{aff.referrerCode}</p>
													</div>
												) : (
													<span className="text-[9px] font-bold text-slate-300 uppercase">Trực tiếp</span>
												)}
											</td>
											<td className="px-4 py-6 text-center">
												<span className={`px - 4 py - 1.5 rounded - full text - [9px] font - black uppercase tracking - [2px] border ${aff.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
														aff.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
															'bg-rose-50 text-rose-600 border-rose-100'
													} `}>
													{aff.status === 'active' ? 'Hoạt động' : aff.status === 'pending' ? 'Chờ duyệt' : 'Từ chối'}
												</span>
											</td>
											<td className="px-4 py-6 text-center">
												{isNexusAdmin ? (
													<div className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
														<input
															type="number"
															className="w-10 bg-transparent border-none p-0 text-center font-black text-rose-500 text-xs focus:ring-0"
															value={aff.discountRate}
															onChange={async (e) => {
																const val = parseFloat(e.target.value);
																await updateDoc(doc(db, 'affiliates', aff.id), { discountRate: val || 0 });
															}}
														/>
														<Percent size={8} className="text-slate-400" />
													</div>
												) : (
													<span className="font-black text-rose-500 text-xs">{aff.discountRate}%</span>
												)}
											</td>
											<td className="px-4 py-6 text-center">
												{isNexusAdmin ? (
													<div className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
														<input
															type="number"
															className="w-10 bg-transparent border-none p-0 text-center font-black text-amber-600 text-xs focus:ring-0"
															value={aff.commissionRate}
															onChange={async (e) => {
																const val = parseFloat(e.target.value);
																await updateDoc(doc(db, 'affiliates', aff.id), { commissionRate: val || 0 });
															}}
														/>
														<Percent size={8} className="text-slate-400" />
													</div>
												) : (
													<span className="font-black text-amber-600 text-xs">{aff.commissionRate}%</span>
												)}
											</td>
											<td className="px-4 py-6 text-center font-black text-rose-500 text-xs tabular-nums">
												{(affiliateStats[aff.id]?.discount || 0).toLocaleString()} ₫
											</td>
											<td className="px-4 py-6 text-center font-black text-amber-600 text-xs tabular-nums">
												{(affiliateStats[aff.id]?.commission || 0).toLocaleString()} ₫
											</td>
											<td className="px-6 py-6 text-right">
												<div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
													{aff.status === 'active' && (
														<button
															onClick={() => {
																setSelectedAffForPay(aff);
																setPayAmountInput((affiliateStats[aff.id]?.commission || 0).toString());
																setShowPayModal(true);
															}}
															className="size-9 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
															title="Lệnh chi hoa hồng"
														>
															<DollarSign size={16} />
														</button>
													)}
													<button
														onClick={() => {
															setEditingAffiliate(aff);
															setEditForm({ ...aff });
														}}
														className="size-9 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-xl flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
														title="Chỉnh sửa tài khoản"
													>
														<Edit2 size={14} />
													</button>
													<button
														onClick={() => handleDeleteAffiliate(aff.id, aff.name)}
														className="size-9 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm"
														title="Xóa đối tác"
													>
														<Trash2 size={14} />
													</button>
												</div>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* Edit Affiliate Modal */}
			{editingAffiliate && (
				<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
					<div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300">
						<form onSubmit={handleSaveEdit}>
							<div className="p-8 border-b border-slate-50 dark:border-slate-800 bg-indigo-50/30 flex justify-between items-center">
								<h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
									<div className="size-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
										<Edit2 size={20} />
									</div>
									Cấu hình đối tác
								</h3>
								<button type="button" onClick={() => setEditingAffiliate(null)} className="p-3 rounded-full hover:bg-white dark:hover:bg-slate-800 transition-colors text-slate-400">
									<XCircle size={24} />
								</button>
							</div>

							<div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
								<div className="space-y-2">
									<label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tên đối tác</label>
									<input
										className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 font-black text-slate-700 dark:text-white focus:ring-4 focus:ring-indigo-500/10"
										value={editForm.name}
										onChange={e => setEditForm({ ...editForm, name: e.target.value })}
									/>
								</div>
								<div className="space-y-2">
									<label className="text-[10px] font-black text-slate-400 uppercase ml-1">Mã ưu đãi (COUPON)</label>
									<input
										className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 font-black text-indigo-600 uppercase focus:ring-4 focus:ring-indigo-500/10"
										value={editForm.referralCode}
										onChange={e => setEditForm({ ...editForm, referralCode: e.target.value.toUpperCase() })}
									/>
								</div>
								<div className="space-y-2">
									<label className="text-[10px] font-black text-slate-400 uppercase ml-1">Email</label>
									<input
										className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 font-bold text-slate-500"
										value={editForm.email}
										disabled
									/>
								</div>
								<div className="space-y-2">
									<label className="text-[10px] font-black text-slate-400 uppercase ml-1">Số điện thoại</label>
									<input
										className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 font-black text-slate-700 dark:text-white focus:ring-4 focus:ring-indigo-500/10"
										value={editForm.phone}
										onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
									/>
								</div>

								<div className="md:col-span-2 pt-4 border-t border-slate-100 dark:border-slate-800">
									<h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-4">Thông tin ngân hàng</h4>
								</div>

								<div className="space-y-2">
									<label className="text-[10px] font-black text-slate-400 uppercase ml-1">Ngân hàng</label>
									<input
										className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 font-black text-slate-700 dark:text-white"
										value={editForm.bankName}
										onChange={e => setEditForm({ ...editForm, bankName: e.target.value })}
									/>
								</div>
								<div className="space-y-2">
									<label className="text-[10px] font-black text-slate-400 uppercase ml-1">Số tài khoản</label>
									<input
										className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 font-black text-slate-700 dark:text-white"
										value={editForm.bankNumber}
										onChange={e => setEditForm({ ...editForm, bankNumber: e.target.value })}
									/>
								</div>
								<div className="md:col-span-2 space-y-2">
									<label className="text-[10px] font-black text-slate-400 uppercase ml-1">Chủ tài khoản</label>
									<input
										className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 font-black text-slate-700 dark:text-white uppercase"
										value={editForm.bankAccountName}
										onChange={e => setEditForm({ ...editForm, bankAccountName: e.target.value.toUpperCase() })}
									/>
								</div>

								{isNexusAdmin && (
									<>
										<div className="md:col-span-2 pt-4 border-t border-slate-100 dark:border-slate-800">
											<h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-4">Cấu hình Hoa hồng</h4>
										</div>
										<div className="space-y-2">
											<label className="text-[10px] font-black text-slate-400 uppercase ml-1">Chiết khấu khách (%)</label>
											<input
												type="number"
												className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 font-black text-rose-500"
												value={editForm.discountRate}
												onChange={e => setEditForm({ ...editForm, discountRate: parseFloat(e.target.value) })}
											/>
										</div>
										<div className="space-y-2">
											<label className="text-[10px] font-black text-slate-400 uppercase ml-1">Hoa hồng CTV (%)</label>
											<input
												type="number"
												className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 font-black text-amber-600"
												value={editForm.commissionRate}
												onChange={e => setEditForm({ ...editForm, commissionRate: parseFloat(e.target.value) })}
											/>
										</div>
									</>
								)}
							</div>

							<div className="p-8 bg-slate-50/50 dark:bg-slate-800/30">
								<button
									type="submit"
									className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase tracking-[3px] shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all"
								>
									Lưu thay đổi
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Payout History Section */}
			{isAdmin && (
				<div className="bg-white dark:bg-slate-900 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden">
					<button
						onClick={() => setShowHistory(!showHistory)}
						className="w-full p-10 flex justify-between items-center bg-slate-50/10 hover:bg-slate-50/30 transition-colors"
					>
						<div>
							<h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Lịch sử chi trả hoa hồng</h3>
							<p className="text-[10px] text-slate-400 font-black mt-1 uppercase tracking-[3px] opacity-70">* Danh sách 50 giao dịch gần nhất</p>
						</div>
						<div className="size-10 bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 rounded-xl flex items-center justify-center text-slate-400">
							{showHistory ? <Zap size={18} className="rotate-180 transition-transform" /> : <DollarSign size={18} />}
						</div>
					</button>

					{showHistory && (
						<div className="overflow-x-auto border-t border-slate-50 dark:border-slate-800 animate-in slide-in-from-top-4 duration-500">
							<table className="w-full text-left text-sm">
								<thead className="bg-[#fcfdff] dark:bg-slate-800/80 text-[10px] font-black text-slate-400 uppercase tracking-[3px] text-center border-b border-slate-50 dark:border-slate-800">
									<tr>
										<th className="px-10 py-6 text-left">Ngày chi</th>
										<th className="px-6 py-6">Đối tác</th>
										<th className="px-6 py-6">Số tiền</th>
										<th className="px-6 py-6">Minh chứng</th>
										<th className="px-10 py-6 text-right">Người chi</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-50 dark:divide-slate-800">
									{payouts.length === 0 ? (
										<tr><td colSpan={5} className="px-10 py-16 text-center text-slate-300 font-black uppercase text-[10px] tracking-[4px]">Chưa có lịch sử giao dịch</td></tr>
									) : (
										payouts.map((p) => (
											<tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
												<td className="px-10 py-6 font-bold text-slate-500 text-xs">
													{new Date(p.date).toLocaleDateString('vi-VN')}
												</td>
												<td className="px-6 py-6 text-center">
													<p className="text-xs font-black text-slate-800 dark:text-white uppercase">{p.affiliateName}</p>
													<p className="text-[9px] font-bold text-slate-400">{p.affiliateEmail}</p>
												</td>
												<td className="px-6 py-6 text-center font-black text-emerald-600">
													{Number(p.amount).toLocaleString()} ₫
												</td>
												<td className="px-6 py-6 text-center">
													{p.proofUrl ? (
														<a
															href={p.proofUrl}
															target="_blank"
															rel="noreferrer"
															className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
														>
															<ImageIcon size={12} /> Xem ảnh
														</a>
													) : (
														<span className="text-[10px] text-slate-300 font-bold uppercase">Không có</span>
													)}
												</td>
												<td className="px-10 py-6 text-right font-bold text-slate-400 text-xs">
													{p.paidBy?.split('@')[0]}
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					)}
				</div>
			)}

			{/* Payout Modal */}
			{showPayModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
					<div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300">
						<form onSubmit={handlePayout}>
							<div className="p-8 border-b border-slate-50 dark:border-slate-800 bg-emerald-50/30">
								<h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
									<div className="size-10 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg">
										<DollarSign size={20} />
									</div>
									Lệnh Chi Hoa Hồng
								</h3>
								<p className="text-[10px] text-slate-400 font-black mt-2 uppercase tracking-[2px]">Ghi nhận thanh toán cho đối tác: <span className="text-emerald-500">{selectedAffForPay?.name}</span></p>
							</div>

							<div className="p-8 space-y-6">
								<div className="space-y-2">
									<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Số tiền thanh toán (₫)</label>
									<input
										type="text"
										className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-black text-2xl text-emerald-600 focus:ring-4 focus:ring-emerald-500/10"
										value={payAmountInput}
										onChange={e => {
											const val = e.target.value.replace(/\D/g, '');
											setPayAmountInput(val.replace(/^0+/, ''));
										}}
										placeholder="0"
										required
									/>
								</div>

								<div className="space-y-4">
									<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Chứng từ thanh toán (Hình ảnh)</label>
									{!payProofUrl ? (
										<div className="relative group">
											<input
												type="file"
												accept="image/*"
												onChange={e => e.target.files && handleImageUpload(e.target.files[0])}
												className="absolute inset-0 opacity-0 cursor-pointer z-10"
												disabled={paySubmitting}
											/>
											<div className="w-full h-32 bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl flex flex-col items-center justify-center gap-2 group-hover:border-indigo-400 transition-colors">
												<div className="size-10 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-400 shadow-sm">
													<ImageIcon size={20} />
												</div>
												<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{paySubmitting ? 'Đang xử lý...' : 'Nhấn để tải ảnh hoặc kéo thả'}</span>
											</div>
										</div>
									) : (
										<div className="relative rounded-3xl overflow-hidden border-2 border-emerald-500 group">
											<img src={payProofUrl} alt="Proof" className="w-full h-40 object-cover" />
											<div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
												<button
													type="button"
													onClick={() => setPayProofUrl('')}
													className="bg-white text-rose-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase"
												>
													Thay đổi ảnh
												</button>
											</div>
										</div>
									)}
								</div>
							</div>

							<div className="p-8 bg-slate-50/50 dark:bg-slate-800/30 flex gap-4">
								<button
									type="button"
									onClick={() => setShowPayModal(false)}
									className="flex-1 py-4 bg-white dark:bg-slate-800 text-slate-400 rounded-2xl font-black uppercase text-xs tracking-[2px] border border-slate-100 dark:border-slate-700"
								>
									Hủy bỏ
								</button>
								<button
									type="submit"
									disabled={paySubmitting || !payAmountInput || payAmountInput === '0'}
									className="flex-[2] py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-xs tracking-[2px] shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
								>
									<Send size={16} />
									{paySubmitting ? 'Đang gửi...' : 'Xác nhận Chi tiền'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
};

export default Affiliate;
