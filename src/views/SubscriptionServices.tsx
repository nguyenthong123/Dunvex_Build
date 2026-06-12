import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOwner } from '../hooks/useOwner';
import { Crown, Download, Zap, CheckCircle2, ShoppingCart, Rocket, Shield, Clock, ChevronRight } from 'lucide-react';
import { db } from '../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const SubscriptionServices = () => {
	const navigate = useNavigate();
	const owner = useOwner();
	const [exportCount, setExportCount] = useState(0);
	const [extraExportLimit, setExtraExportLimit] = useState(0);

	useEffect(() => {
		if (!owner.ownerId) return;
		const currentMonth = new Date().toISOString().slice(0, 7);
		const unsub = onSnapshot(doc(db, 'usage_limits', `${owner.ownerId}_${currentMonth}`), (snap) => {
			if (snap.exists()) {
				setExportCount(snap.data().count || 0);
				setExtraExportLimit(snap.data().extraExportLimit || 0);
			}
		});
		return () => unsub();
	}, [owner.ownerId]);

	const handleBuyAddon = (addon: any) => {
		navigate('/pricing', {
			state: {
				selectedPlan: {
					id: addon.id,
					name: addon.name,
					price: addon.price,
					period: 'gói',
					description: addon.description,
					features: addon.features
				}
			}
		});
	};

	const addons = [
		{
			id: 'addon_export_5',
			name: 'Gói thêm 5 lượt tải Excel',
			price: 100000,
			description: 'Giải pháp tức thời khi bạn đã dùng hết giới hạn trích xuất dữ liệu trong tháng.',
			icon: <Download size={28} className="text-blue-500" />,
			features: ['Có tác dụng ngay lập tức', 'Cộng dồn vào tháng hiện tại', 'Không giới hạn dung lượng tải'],
			bgClass: 'bg-blue-50 dark:bg-blue-900/10',
			textClass: 'text-blue-500',
			shadowClass: 'shadow-blue-500/20'
		},
		{
			id: 'addon_monthly',
			name: 'Gói Tháng',
			price: 250000,
			description: 'Trải nghiệm toàn bộ tính năng quản lý ưu việt của Dunvex Build trong 1 tháng.',
			icon: <Zap size={28} className="text-amber-500" />,
			features: ['Mở khóa tất cả tính năng', 'Không giới hạn dung lượng', 'Hỗ trợ kỹ thuật ưu tiên'],
			bgClass: 'bg-amber-50 dark:bg-amber-900/10',
			textClass: 'text-amber-500',
			shadowClass: 'shadow-amber-500/20'
		},
		{
			id: 'addon_yearly',
			name: 'Gói Năm',
			price: 2500000,
			description: 'Gói siêu tiết kiệm dành cho doanh nghiệp, sử dụng liên tục trong 12 tháng.',
			icon: <Crown size={28} className="text-rose-500" />,
			features: ['Tiết kiệm 2 tháng sử dụng', 'Ưu tiên cập nhật tính năng mới', 'Hỗ trợ trực tiếp 1-1'],
			bgClass: 'bg-rose-50 dark:bg-rose-900/10',
			textClass: 'text-rose-500',
			shadowClass: 'shadow-rose-500/20'
		},
		{
			id: 'addon_ai_assistant',
			name: 'Gói Trợ lý AI',
			price: 500000,
			description: 'Sử dụng SaleBot AI để lên đơn hàng nhanh chóng bằng giọng nói hoặc tin nhắn.',
			icon: <Rocket size={28} className="text-purple-500" />,
			features: ['Lên đơn siêu tốc', 'Phân tích tin nhắn tự động', 'Hỗ trợ trả lời khách hàng'],
			bgClass: 'bg-purple-50 dark:bg-purple-900/10',
			textClass: 'text-purple-500',
			shadowClass: 'shadow-purple-500/20'
		}
	];

	return (
		<div className="min-h-screen bg-[#F8F9FA] dark:bg-slate-950 p-4 md:p-8 font-sans transition-colors duration-300 pb-32">
			{/* Page Header */}
			<div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-8">
				<div className="max-w-2xl">
					<h1 className="text-3xl md:text-4xl font-black mb-4 text-[#1A237E] dark:text-indigo-400 tracking-tight uppercase">Dịch vụ & Tiện ích</h1>
					<p className="text-slate-600 dark:text-slate-400 text-sm md:text-base leading-relaxed font-medium">
						Quản lý gói dịch vụ của bạn, nâng cấp tính năng hoặc mua thêm các tiện ích mở rộng để tối ưu hóa quy trình quản lý kinh doanh cùng Dunvex Build.
					</p>
				</div>

				{/* Current Plan Card */}
				<div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl shadow-slate-200/50 dark:shadow-none min-w-[320px] relative overflow-hidden group">
					<div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-500">
						<Crown size={80} />
					</div>
					<div className="relative z-10">
						<div className="flex justify-between items-center mb-4">
							<span className="text-[10px] font-black text-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400 px-3 py-1.5 rounded-lg tracking-widest uppercase">
								Gói hiện tại
							</span>
							{owner.isPro ? (
								<span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded flex items-center gap-1">
									<CheckCircle2 size={12} /> KÍCH HOẠT
								</span>
							) : (
								<span className="text-[10px] text-slate-500 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded flex items-center gap-1">
									<Clock size={12} /> MIỄN PHÍ
								</span>
							)}
						</div>
						<div className="text-2xl font-black mb-6 dark:text-white uppercase tracking-tight">
							{owner.isPro ? 'Dunvex Pro' : 'Dunvex Starter'}
						</div>
						<div className="space-y-3 text-sm">
							<div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
								<span className="text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider">Lượt tải Excel</span>
								<span className={`font-black ${exportCount >= (5 + extraExportLimit) && !owner.isPro ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
									{exportCount} / {owner.isPro ? 'Không giới hạn' : (5 + extraExportLimit)}
								</span>
							</div>
							{!owner.isPro && (
								<button onClick={() => navigate('/pricing')} className="w-full mt-2 py-3 bg-[#1A237E] hover:bg-indigo-700 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 active:scale-95">
									<Rocket size={16} /> Nâng Cấp Ngay
								</button>
							)}
						</div>
					</div>
				</div>
			</div>

			<div className="max-w-7xl mx-auto">
				{/* Add-on Services */}
				<div className="mb-16">
					<div className="flex items-center gap-3 mb-8">
						<div className="size-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
							<ShoppingCart size={20} />
						</div>
						<h2 className="text-2xl font-black dark:text-white uppercase tracking-tight">Tiện ích mua thêm (Add-ons)</h2>
					</div>
					
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
						{addons.map(addon => (
							<div key={addon.id} className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-lg shadow-slate-200/50 dark:shadow-none flex flex-col group hover:-translate-y-1 transition-all duration-300">
								<div className={`h-32 ${addon.bgClass} relative flex items-center justify-center overflow-hidden`}>
									<div className="absolute inset-0 opacity-20 bg-gradient-to-br from-transparent to-black/5 dark:to-white/5"></div>
									<div className={`p-5 rounded-3xl bg-white dark:bg-slate-800 shadow-xl ${addon.shadowClass} group-hover:scale-110 transition-transform duration-500 z-10`}>
										{addon.icon}
									</div>
								</div>
								
								<div className="p-6 flex-1 flex flex-col">
									<div className="flex justify-between items-start mb-3 gap-4">
										<h4 className="font-black text-lg text-slate-800 dark:text-white leading-tight">{addon.name}</h4>
										<span className="text-[#FF6D00] font-black whitespace-nowrap bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-lg text-sm border border-orange-100 dark:border-orange-900/50">
											{new Intl.NumberFormat('vi-VN').format(addon.price)}đ
										</span>
									</div>
									<p className="text-slate-500 dark:text-slate-400 text-sm mb-6 flex-1 font-medium leading-relaxed">
										{addon.description}
									</p>
									
									<div className="space-y-3 mb-8">
										{addon.features.map((feature, idx) => (
											<div key={idx} className="flex items-start gap-2">
												<CheckCircle2 size={16} className={`${addon.textClass} shrink-0 mt-0.5`} />
												<span className="text-xs font-bold text-slate-600 dark:text-slate-300">{feature}</span>
											</div>
										))}
									</div>

									<button 
										onClick={() => handleBuyAddon(addon)}
										className="w-full py-4 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all flex justify-center items-center gap-2 shadow-lg hover:shadow-xl active:scale-95"
									>
										<ShoppingCart size={16} />
										Mua Tiện Ích Này
									</button>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Enterprise Banner */}
				<div className="bg-gradient-to-br from-[#1A237E] to-indigo-900 rounded-[2.5rem] p-8 md:p-12 text-white flex flex-col md:flex-row justify-between items-center relative overflow-hidden shadow-2xl">
					{/* Background Pattern */}
					<div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
						<Shield size={300} />
					</div>
					
					<div className="max-w-2xl mb-8 md:mb-0 relative z-10">
						<div className="inline-block bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
							Dunvex Enterprise
						</div>
						<h2 className="text-3xl md:text-4xl font-black mb-4 tracking-tight leading-tight">Bạn cần một giải pháp tùy chỉnh riêng?</h2>
						<p className="text-indigo-100 text-sm md:text-base font-medium leading-relaxed max-w-xl">
							Các chuyên gia của chúng tôi có thể giúp bạn thiết kế một gói dịch vụ riêng biệt, phù hợp với quy mô doanh nghiệp và yêu cầu vận hành đặc thù của bạn.
						</p>
					</div>
					<div className="flex flex-col sm:flex-row gap-4 relative z-10 w-full md:w-auto">
						<button className="bg-[#FF6D00] hover:bg-orange-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all whitespace-nowrap shadow-xl shadow-orange-500/20 active:scale-95 flex items-center justify-center gap-2">
							Liên Hệ Tư Vấn
						</button>
						<button className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all whitespace-nowrap active:scale-95 flex items-center justify-center gap-2">
							Xem Tài Liệu API <ChevronRight size={18} />
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default SubscriptionServices;
