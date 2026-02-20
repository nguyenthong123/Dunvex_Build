import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Crown, Rocket, ShieldCheck, ArrowLeft, CreditCard, QrCode } from 'lucide-react';
import { auth, db } from '../services/firebase';
import { collection, addDoc, serverTimestamp, query, where, limit, getDocs } from 'firebase/firestore';
import { useOwner } from '../hooks/useOwner';

import NotificationBell from '../components/NotificationBell';

const Pricing = () => {
	const navigate = useNavigate();
	const owner = useOwner();
	const [selectedPlan, setSelectedPlan] = useState<any>(null);
	const [step, setStep] = useState(1); // 1: Pricing, 2: Checkout
	const [loading, setLoading] = useState(false);
	const [transferCode, setTransferCode] = useState('');
	const [promoCode, setPromoCode] = useState('');
	const [appliedAffiliate, setAppliedAffiliate] = useState<any>(null);
	const [discountAmt, setDiscountAmt] = useState(0);

	const generateTransferCode = (email: string) => {
		const prefix = email.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
		const random = Math.floor(1000 + Math.random() * 9000);
		return `DVX ${prefix} ${random}`;
	};

	const plans = [
		{
			id: 'premium_monthly',
			name: 'Gói Tháng',
			price: 199000,
			period: 'tháng',
			description: 'Dành cho shop lẻ muốn trải nghiệm dịch vụ.',
			features: [
				'Đầy đủ tính năng bán hàng',
				'Quản lý công nợ khách hàng',
				'Báo cáo doanh thu chi tiết',
				'Hỗ trợ kỹ thuật 24/7'
			],
			color: 'indigo'
		},
		{
			id: 'premium_yearly',
			name: 'Gói Năm',
			price: 1500000,
			period: 'năm',
			description: 'Tiết kiệm hơn 35% - Giải pháp kinh doanh bền vững.',
			features: [
				'Toàn bộ tính năng Gói Tháng',
				'Quản lý nhân sự & Phân quyền',
				'Ưu tiên cập nhật tính năng mới',
				'Tặng 01 buổi training online'
			],
			recommended: true,
			color: 'amber'
		}
	];

	const handleSelectPlan = (plan: any) => {
		setSelectedPlan(plan);
		if (auth.currentUser?.email) {
			setTransferCode(generateTransferCode(auth.currentUser.email));
		}
		setStep(2);
	};

	const handleApplyPromo = async () => {
		if (!promoCode) return;
		try {
			// POLICY: Check if user has applied a coupon before OR has a premium subscription history
			// We check payment_requests OR if the shop already has a planId record
			const prevReqsQ = query(collection(db, 'payment_requests'), where('ownerId', '==', owner.ownerId), limit(1));
			const prevReqs = await getDocs(prevReqsQ);

			const isOldUser = !prevReqs.empty || owner.planId;

			if (isOldUser) {
				alert("CHÍNH SÁCH: Hệ thống nhận diện bạn là tài khoản cũ đang thực hiện Gia hạn/Đăng ký lại. Theo quy định, mã giảm giá chỉ áp dụng DUY NHẤT cho lần đầu tiên đăng ký hệ thống. Việc nhập mã CTV khác cũng sẽ không được áp dụng giảm giá, tuy nhiên hoa hồng vẫn sẽ được tính cho CTV đó để ghi nhận công hỗ trợ.");
			}

			const q = query(collection(db, 'affiliates'), where('referralCode', '==', promoCode.toUpperCase()), where('status', '==', 'active'), limit(1));
			const ship = await getDocs(q);
			if (ship.empty) {
				alert("Mã giảm giá không hợp lệ hoặc đã hết hạn.");
				return;
			}

			const affData = ship.docs[0].data();

			// POLICY: No self-referral
			if (auth.currentUser?.uid === ship.docs[0].id) {
				alert("CHÍNH SÁCH: Bạn không thể sử dụng mã ưu đãi của chính mình để nhận chiết khấu/hoa hồng.");
				return;
			}

			// POLICY: No internal referrals within the same shop/organization
			if (owner.ownerId === affData.ownerId && affData.ownerId !== 'GLOBAL') {
				alert("CHÍNH SÁCH: Mã ưu đãi không áp dụng giữa các thành viên trong cùng một hệ thống quản lý để tránh trục lợi.");
				return;
			}

			// POLICY: Only Admin (Shop Owner) can apply promo for payment
			if (owner.role !== 'admin') {
				alert("CHÍNH SÁCH: Chỉ tài khoản Quản trị viên (Chủ shop) mới được phép áp dụng mã ưu đãi khi đăng ký gói.");
				return;
			}

			setAppliedAffiliate({ id: ship.docs[0].id, ...affData });

			// Only calculate discount if totally new user
			if (!isOldUser) {
				const rate = affData.discountRate || 0;
				if (rate > 0) {
					const calculated = Math.round((selectedPlan.price * rate) / 100);
					setDiscountAmt(calculated);
					alert(`Đã áp dụng mã: Giảm ${rate}% (${calculated.toLocaleString('vi-VN')}đ)`);
				}
			} else {
				setDiscountAmt(0);
				alert(`Đối tác hỗ trợ: ${affData.name}. (Lưu ý: Không áp dụng giảm giá trực tiếp cho tài khoản gia hạn theo chính sách)`);
			}
		} catch (error) {
			console.error("Error applying promo:", error);
		}
	};

	const handlePaid = async () => {
		if (!auth.currentUser) return;
		setLoading(true);
		try {
			await addDoc(collection(db, 'payment_requests'), {
				userId: auth.currentUser.uid,
				userEmail: auth.currentUser.email,
				ownerId: owner.ownerId,
				ownerEmail: owner.ownerEmail,
				planId: selectedPlan.id,
				planName: selectedPlan.name,
				amount: selectedPlan.price - discountAmt,
				originalAmount: selectedPlan.price,
				transferCode: transferCode,
				status: 'pending',
				// Affiliate Tracking
				appliedPromoCode: appliedAffiliate?.referralCode || null,
				affiliateId: appliedAffiliate?.id || null,
				affiliateCommissionRate: appliedAffiliate?.commissionRate || 0,
				createdAt: serverTimestamp()
			});

			// Trigger Email notification through GAS (existing endpoint but with payment_request action)
			try {
				await fetch('https://script.google.com/macros/s/AKfycbwIup8ysoKT4E_g8GOVrBiQxXw7SOtqhLWD2b0GOUT54MuoXgTtxP42XSpFR_3aoXAG7g/exec', {
					method: 'POST',
					body: JSON.stringify({
						action: 'payment_request',
						email: auth.currentUser.email,
						ownerEmail: owner.ownerEmail,
						planName: selectedPlan.name,
						amount: selectedPlan.price,
						transferCode: transferCode
					})
				});
			} catch (err) {
				console.error("Failed to send payment email:", err);
			}

			alert("Yêu cầu đã được gửi! Chúng tôi sẽ kiểm tra và kích hoạt ngay sau khi nhận được thanh toán.");
			navigate('/');
		} catch (error) {
			console.error("Error submitting payment:", error);
			alert("Lỗi khi gửi yêu cầu thanh toán.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-[#f8f9fb] dark:bg-slate-950 transition-colors duration-300">
			{/* Header */}
			<header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center px-8 sticky top-0 z-50">
				<button
					onClick={() => step === 1 ? navigate(-1) : setStep(1)}
					className="p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors mr-4"
				>
					<ArrowLeft size={24} />
				</button>
				<h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex-1">
					{step === 1 ? 'Nâng Cấp Tài Khoản' : 'Thanh Toán'}
				</h2>
				<div className="bg-[#1A237E] p-1 rounded-xl">
					<NotificationBell />
				</div>
			</header>

			<div className="max-w-5xl mx-auto p-8">
				{step === 1 ? (
					<div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
						<div className="text-center mb-12">
							<h1 className="text-4xl font-black text-slate-900 dark:text-white mb-4">Mở Khóa Toàn Bộ Sức Mạnh</h1>
							<p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl mx-auto">
								Lựa chọn gói dịch vụ phù hợp để quản lý doanh nghiệp chuyên nghiệp và hiệu quả hơn.
							</p>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
							{plans.map((plan) => (
								<div
									key={plan.id}
									className={`relative bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-xl transition-all hover:scale-[1.02] border-2 ${plan.recommended ? 'border-amber-400 dark:border-amber-500 shadow-amber-500/10' : 'border-transparent'}`}
								>
									{plan.recommended && (
										<div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-6 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
											Khuyên dùng
										</div>
									)}

									<div className="flex justify-between items-start mb-6">
										<div>
											<h3 className="text-2xl font-black text-slate-800 dark:text-white mb-1">{plan.name}</h3>
											<p className="text-slate-400 dark:text-slate-500 text-sm font-medium">{plan.description}</p>
										</div>
										<div className={`p-3 rounded-2xl bg-${plan.color}-50 dark:bg-${plan.color}-900/20 text-${plan.color}-600 dark:text-${plan.color}-400`}>
											{plan.id === 'premium_monthly' ? <Rocket size={32} /> : <Crown size={32} />}
										</div>
									</div>

									<div className="mb-8 flex items-baseline gap-2">
										<span className="text-4xl font-black text-slate-900 dark:text-white">
											{new Intl.NumberFormat('vi-VN').format(plan.price)}
										</span>
										<span className="text-slate-400 dark:text-slate-500 font-bold uppercase text-xs">/ {plan.period}</span>
									</div>

									<div className="space-y-4 mb-10">
										{plan.features.map((feature, idx) => (
											<div key={idx} className="flex items-center gap-3">
												<div className="size-6 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 flex items-center justify-center shrink-0">
													<Check size={14} />
												</div>
												<span className="text-sm font-bold text-slate-600 dark:text-slate-300">{feature}</span>
											</div>
										))}
									</div>

									<button
										onClick={() => handleSelectPlan(plan)}
										className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg ${plan.recommended
											? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20'
											: 'bg-[#1A237E] text-white hover:bg-blue-800 shadow-blue-900/20'}`}
									>
										Chọn Gói Này
									</button>
								</div>
							))}
						</div>
					</div>
				) : (
					<div className="max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-300">
						<div className="bg-white dark:bg-slate-900 rounded-[3rem] p-8 md:p-12 shadow-2xl overflow-hidden relative">
							<div className="absolute top-0 right-0 p-8 opacity-5">
								<CreditCard size={120} />
							</div>

							<div className="flex flex-col items-center text-center mb-10">
								<div className="size-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl flex items-center justify-center text-emerald-500 mb-6 border border-emerald-100/50">
									<QrCode size={40} />
								</div>
								<h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Quét Mã Thanh Toán</h1>
								<p className="text-slate-500 dark:text-slate-400 text-sm">
									Chuyển khoản chính xác số tiền bên dưới để được kích hoạt tự động.
								</p>
							</div>

							<div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 mb-8 border border-slate-100 dark:border-slate-800">
								<div className="flex justify-between items-center mb-4">
									<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dịch vụ:</span>
									<span className="text-sm font-black text-slate-800 dark:text-white uppercase">{selectedPlan.name}</span>
								</div>
								<div className="flex justify-between items-center mb-4">
									<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cần thanh toán:</span>
									<div className="text-right">
										{discountAmt > 0 && (
											<span className="block text-[10px] font-black text-slate-400 line-through">
												{new Intl.NumberFormat('vi-VN').format(selectedPlan.price)} đ
											</span>
										)}
										<span className="text-xl font-black text-slate-800 dark:text-white tracking-tighter">
											{new Intl.NumberFormat('vi-VN').format(selectedPlan.price - discountAmt)} đ
										</span>
									</div>
								</div>

								{/* Coupon Code Section */}
								<div className="pt-4 mb-4 border-t border-slate-200 dark:border-slate-700">
									<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Mã giảm giá (Coupon)</label>
									<div className="flex gap-2">
										<input
											type="text"
											placeholder="NHẬP MÃ..."
											className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-black text-indigo-600 uppercase focus:ring-2 focus:ring-indigo-500/20"
											value={promoCode}
											onChange={(e) => setPromoCode(e.target.value)}
										/>
										<button
											onClick={handleApplyPromo}
											className="px-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase"
										>
											ÁP DỤNG
										</button>
									</div>
									{appliedAffiliate && (
										<p className="text-[9px] font-bold text-emerald-500 mt-2 uppercase">✓ Đã áp dụng mã {appliedAffiliate.referralCode} (Giảm {appliedAffiliate.discountRate}%)</p>
									)}
								</div>

								<div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
									<span className="block text-[10px] font-black text-indigo-500 uppercase tracking-[2px] mb-2 text-center">Nội dung chuyển khoản:</span>
									<div className="bg-white dark:bg-slate-900 border-2 border-dashed border-indigo-200 dark:border-indigo-900 rounded-2xl p-4 text-center">
										<span className="text-xl font-black text-indigo-600 dark:text-indigo-400 tracking-widest select-all">
											{transferCode}
										</span>
									</div>
									<p className="text-[9px] text-center text-slate-400 font-bold mt-2 uppercase italic">
										* Vui lòng nhập đúng nội dung để được kích hoạt tự động
									</p>
								</div>
							</div>

							{/* QR Image with Transfer Code */}
							<div className="bg-white p-4 rounded-3xl shadow-inner border border-slate-100 dark:border-slate-800 mx-auto w-fit mb-4">
								<img
									src={`https://img.vietqr.io/image/ICB-107882271865-compact2.png?amount=${selectedPlan.price - discountAmt}&addInfo=${encodeURIComponent(transferCode)}`}
									alt="Payment QR"
									className="size-64 object-contain rounded-2xl"
								/>
							</div>

							<div className="text-center mb-8 space-y-1">
								<p className="text-sm font-black text-slate-800 dark:text-white uppercase">VietinBank</p>
								<p className="text-xs font-bold text-slate-500">107882271865</p>
								<p className="text-[10px] font-black text-indigo-500 uppercase">NGUYEN BA THONG</p>
							</div>

							<div className="space-y-4">
								<button
									onClick={handlePaid}
									disabled={loading}
									className="w-full py-5 bg-indigo-600 dark:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-[2px] shadow-xl shadow-indigo-900/20 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50"
								>
									{loading ? 'Đang gửi yêu cầu...' : 'Tôi Đã Thanh Toán'}
								</button>
								<p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest">
									Yêu cầu sẽ được duyệt trong tối đa 15 phút.
								</p>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default Pricing;
