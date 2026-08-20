import React from 'react';
import { CreditCard, Crown, Clock, CheckCircle2, Zap, Rocket, Shield, Download, Database, Activity } from 'lucide-react';

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

interface NexusConfigTabProps {
	paymentConfig: { bankId: string; accountNumber: string; accountName: string };
	systemConfig: any;
	addons: any[];
	isSavingConfig: boolean;
	editingAddon: any;
	setEditingAddon: (addon: any) => void;
	onSaveConfig: () => void;
	onSaveAddon: (e: React.FormEvent) => void;
	onDeleteAddon: (id: string) => void;
	onPaymentConfigChange: (config: { bankId: string; accountNumber: string; accountName: string }) => void;
}

export function NexusConfigTab({
	paymentConfig,
	systemConfig,
	addons,
	isSavingConfig,
	editingAddon,
	setEditingAddon,
	onSaveConfig,
	onSaveAddon,
	onDeleteAddon,
	onPaymentConfigChange,
}: NexusConfigTabProps) {
	return (
		<div className="space-y-6 lg:space-y-8 max-w-5xl">
			{/* Bank QR Config */}
			<div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl">
				<div className="px-6 lg:px-8 py-5 lg:py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-800/30 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<CreditCard className="text-indigo-500" size={20} />
						<h4 className="text-[10px] lg:text-xs font-black text-slate-900 dark:text-white uppercase tracking-[2px] lg:tracking-[4px]">Cấu hình Tài khoản Nhận tiền</h4>
					</div>
				</div>
				<div className="p-6 lg:p-8">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
						<div>
							<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Ngân hàng (VD: ICB, VCB)</label>
							<select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white" value={paymentConfig.bankId} onChange={e => onPaymentConfigChange({...paymentConfig, bankId: e.target.value})}>
								<option value="" disabled>-- Chọn ngân hàng --</option>
								{VIETNAM_BANKS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
							</select>										</div>
						<div>
							<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Số tài khoản</label>
							<input type="text" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white" value={paymentConfig.accountNumber} onChange={e => onPaymentConfigChange({...paymentConfig, accountNumber: e.target.value})} />
						</div>
						<div className="md:col-span-2">
							<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tên chủ tài khoản</label>
							<input type="text" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white" value={paymentConfig.accountName} onChange={e => onPaymentConfigChange({...paymentConfig, accountName: e.target.value})} />
						</div>
					</div>
					<button onClick={onSaveConfig} disabled={isSavingConfig} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all w-full md:w-auto flex justify-center items-center gap-2">
						{isSavingConfig ? <Clock className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
						Lưu Cấu Hình QR
					</button>
				</div>
			</div>

			{/* Addons CRUD */}
			<div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl">
				<div className="px-6 lg:px-8 py-5 lg:py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-800/30 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Crown className="text-amber-500" size={20} />
						<h4 className="text-[10px] lg:text-xs font-black text-slate-900 dark:text-white uppercase tracking-[2px] lg:tracking-[4px]">Quản lý Gói Dịch vụ</h4>
					</div>
					<button onClick={() => setEditingAddon({ id: `addon_${Date.now()}`, name: '', price: 0, description: '', icon: 'Zap', features: '', bgClass: '', textClass: '', shadowClass: '' })} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">
						Thêm Gói Mới
					</button>
				</div>

				<div className="p-6 lg:p-8">
					{editingAddon && (
						<form onSubmit={onSaveAddon} className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 mb-8 space-y-4">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase mb-2">ID Gói (VD: addon_export_5)</label>
									<input type="text" required className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white" value={editingAddon.id} onChange={e => setEditingAddon({...editingAddon, id: e.target.value})} />
								</div>
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tên gói (VD: Gói Tháng)</label>
									<input type="text" required className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white" value={editingAddon.name} onChange={e => setEditingAddon({...editingAddon, name: e.target.value})} />
								</div>
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mức giá (VNĐ)</label>
									<input type="number" required className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white" value={editingAddon.price} onChange={e => setEditingAddon({...editingAddon, price: e.target.value})} />
								</div>
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Biểu tượng (Icon)</label>
									<select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white" value={editingAddon.icon} onChange={e => setEditingAddon({...editingAddon, icon: e.target.value})}>
										<option value="Zap">Tia sét (Zap)</option>
										<option value="Crown">Vương miện (Crown)</option>
										<option value="Rocket">Tên lửa (Rocket)</option>
										<option value="Shield">Cái khiên (Shield)</option>
										<option value="Download">Tải xuống (Download)</option>
										<option value="Database">Cơ sở dữ liệu (Database)</option>
										<option value="Activity">Biểu đồ (Activity)</option>
									</select>
								</div>
								<div className="md:col-span-2">
									<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mô tả ngắn gọn</label>
									<input type="text" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white" value={editingAddon.description} onChange={e => setEditingAddon({...editingAddon, description: e.target.value})} />
								</div>
								<div className="md:col-span-2">
								<label className="block text-xs font-bold text-slate-500 uppercase mb-2">⏱️ Thời hạn gói</label>
								<select
									className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white"
									value={editingAddon.durationDays || 30}
									onChange={e => setEditingAddon({...editingAddon, durationDays: Number(e.target.value)})}
								>
									<option value={7}>7 ngày (Dùng thử ngắn)</option>
									<option value={30}>30 ngày (1 tháng)</option>
									<option value={60}>60 ngày (2 tháng)</option>
									<option value={90}>90 ngày (3 tháng)</option>
									<option value={180}>180 ngày (6 tháng)</option>
									<option value={365}>365 ngày (1 năm)</option>
								</select>
							</div>
								<div className="md:col-span-2">
									<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Màu sắc chủ đạo (Theme)</label>
									<select 
										className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white"
										value={editingAddon.textClass?.match(/text-([a-z]+)-/)?.[1] || 'slate'}
										onChange={e => {
											const color = e.target.value;
											setEditingAddon({
												...editingAddon, 
												bgClass: `bg-${color}-50 dark:bg-${color}-500/10`, 
												textClass: `text-${color}-600 dark:text-${color}-400`
											});
										}}
									>
										<option value="slate">Màu Xám (Mặc định)</option>
										<option value="indigo">Màu Tím (Indigo)</option>
										<option value="blue">Màu Xanh Dương (Blue)</option>
										<option value="emerald">Màu Xanh Ngọc (Emerald)</option>
										<option value="amber">Màu Cam (Amber)</option>
										<option value="rose">Màu Hồng (Rose)</option>
									</select>
								</div>
							</div>
							<div className="flex gap-3 justify-end pt-4">
								<button type="button" onClick={() => setEditingAddon(null)} className="px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">Hủy</button>
								<button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all">Lưu Gói</button>
							</div>
						</form>
					)}

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{addons.map(addon => (
							<div key={addon.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
								<div>
									<div className="flex items-start justify-between mb-2">
										<h5 className={`font-black text-lg flex items-center gap-2 ${addon.textClass || 'text-slate-900 dark:text-white'}`}>
											{renderAddonIcon(addon.icon, "size-5")}
											{addon.name}
										</h5>
										<span className="font-bold text-sm bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-md text-slate-700 dark:text-slate-300">{addon.price.toLocaleString()}đ</span>
									</div>
									<p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{addon.description}</p>
								{addon.durationDays ? (
									<span className="inline-block bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black px-2 py-0.5 rounded-md mb-2">⏱️ {addon.durationDays} ngày</span>
								) : addon.features?.length > 0 && (
									<span className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-md mb-2">{addon.features.length} tính năng</span>
								)}
									<p className="text-[10px] font-black uppercase text-slate-400 mb-1">ID: {addon.id}</p>
								</div>
								<div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
									<button onClick={() => setEditingAddon(addon)} className="flex-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 py-2 rounded-xl text-xs font-bold uppercase hover:bg-indigo-100 transition-colors">Sửa</button>
									<button onClick={() => onDeleteAddon(addon.id)} className="flex-1 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 py-2 rounded-xl text-xs font-bold uppercase hover:bg-rose-100 transition-colors">Xóa</button>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
