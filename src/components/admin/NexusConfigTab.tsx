import React, { useState } from 'react';
import { CreditCard, Crown, Clock, CheckCircle2, Zap, Rocket, Shield, Download, Database, Activity, Bot, RefreshCw, Send, Cloud, ExternalLink, Play } from 'lucide-react';
import { useToast } from '../shared/Toast';

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
	const { showToast } = useToast();

	// n8n Super Admin AI Agent State
	const [nexusAgentUrl, setNexusAgentUrl] = useState(() => {
		return systemConfig?.nexus_agent_webhook_url || localStorage.getItem('nexus_agent_webhook_url') || 'https://34-133-127-214.nip.io/webhook/nexus-agent';
	});
	const [agentChatId, setAgentChatId] = useState(() => {
		return systemConfig?.nexus_agent_chat_id || localStorage.getItem('nexus_agent_chat_id') || '';
	});
	const [isSavingAgent, setIsSavingAgent] = useState(false);
	const [isTestingAgent, setIsTestingAgent] = useState(false);
	const [agentTestResponse, setAgentTestResponse] = useState<string | null>(null);

	// Google Drive Backup State
	const [isBackingUp, setIsBackingUp] = useState(false);
	const [lastBackupResult, setLastBackupResult] = useState<any>(null);

	const handleSaveAgentConfig = async () => {
		setIsSavingAgent(true);
		try {
			const cleanUrl = nexusAgentUrl.trim();
			const cleanChatId = agentChatId.trim();
			localStorage.setItem('nexus_agent_webhook_url', cleanUrl);
			localStorage.setItem('nexus_agent_chat_id', cleanChatId);

			// Lưu cấu hình Super Admin Telegram vào database
			await fetch('/api/data/system_config/main', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					nexus_agent_webhook_url: cleanUrl,
					nexus_agent_chat_id: cleanChatId
				})
			});

			showToast("Đã lưu cấu hình Super Admin AI Agent & Telegram thành công!", "success");
		} catch (err: any) {
			showToast("Lỗi khi lưu cấu hình: " + err.message, "error");
		} finally {
			setIsSavingAgent(false);
		}
	};

	const handleTestAgent = async () => {
		if (!nexusAgentUrl.trim()) {
			showToast("Vui lòng nhập Webhook URL n8n!", "error");
			return;
		}
		setIsTestingAgent(true);
		setAgentTestResponse(null);
		try {
			const res = await fetch(nexusAgentUrl.trim(), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					message: 'Kiểm tra trạng thái hệ thống',
					adminId: agentChatId.trim() || 'super_admin'
				})
			});
			const data = await res.json();
			if (data.nexusMessage || data.reply || data.success) {
				const msg = data.nexusMessage || data.reply || "Agent đã phản hồi thành công!";
				setAgentTestResponse(msg);
				showToast("Kết nối n8n AI Agent thành công! Đã nhận phản hồi.", "success");
			} else {
				setAgentTestResponse(JSON.stringify(data));
				showToast("Đã gửi lệnh thử tới n8n!", "info");
			}
		} catch (err: any) {
			console.error("Test Agent Error:", err);
			showToast("Lỗi khi test kết nối n8n: " + err.message, "error");
		} finally {
			setIsTestingAgent(false);
		}
	};

	const handleTriggerDriveBackup = async () => {
		setIsBackingUp(true);
		try {
			const res = await fetch('/api/backup-gdrive?token=5e2b86a8fdc7e19d7d4c2b9f3a5e1d7d8e6c4b2a9f1d8c7a', {
				method: 'POST'
			});
			const data = await res.json();
			if (data.success) {
				setLastBackupResult(data);
				showToast("Sao lưu lên Google Drive thành công!", "success");
			} else {
				showToast("Lỗi sao lưu: " + (data.error || "Không thành công"), "error");
			}
		} catch (err: any) {
			console.error("Drive Backup Error:", err);
			showToast("Lỗi sao lưu Google Drive: " + err.message, "error");
		} finally {
			setIsBackingUp(false);
		}
	};

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

			{/* n8n Super Admin AI Agent Config */}
			<div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl">
				<div className="px-6 lg:px-8 py-5 lg:py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-800/30 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Bot className="text-purple-500" size={20} />
						<div>
							<h4 className="text-[10px] lg:text-xs font-black text-slate-900 dark:text-white uppercase tracking-[2px] lg:tracking-[4px]">
								🤖 Cấu hình n8n AI Agent & Super Admin Telegram
							</h4>
							<p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
								Kết nối trợ lý n8n để nhận lệnh đóng/mở quyền hệ thống & tra cứu dữ liệu tự động.
							</p>
						</div>
					</div>
					<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
						n8n Automation
					</span>
				</div>

				<div className="p-6 lg:p-8 space-y-6">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="md:col-span-2">
							<label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center justify-between">
								<span>n8n Webhook URL (Trợ lý Super Admin)</span>
								<span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-normal">POST method</span>
							</label>
							<input 
								type="text" 
								className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-mono dark:text-white outline-none focus:border-purple-500" 
								value={nexusAgentUrl} 
								onChange={e => setNexusAgentUrl(e.target.value)}
								placeholder="https://34-133-127-214.nip.io/webhook/nexus-agent"
							/>
							<p className="text-[11px] text-slate-400 mt-1.5">
								URL Webhook từ workflow <strong>Dunvex Nexus - Super Admin AI Agent</strong> trên n8n.
							</p>
						</div>

						<div className="md:col-span-2">
							<label className="block text-xs font-bold text-slate-500 uppercase mb-2">
								Telegram Super Admin Chat ID (hoặc Group ID nhận thông báo)
							</label>
							<input 
								type="text" 
								className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-mono dark:text-white outline-none focus:border-purple-500" 
								value={agentChatId} 
								onChange={e => setAgentChatId(e.target.value)}
								placeholder="VD: 6039857921 (Chat ID cá nhân hoặc nhóm riêng của Super Admin)"
							/>
							<p className="text-[11px] text-slate-400 mt-1.5">
								ID nhóm chat hoặc cá nhân Super Admin để nhận báo cáo hệ thống & kết quả AI Agent (không gửi vào nhóm bán hàng của cơ sở).
							</p>
						</div>
					</div>

					{agentTestResponse && (
						<div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-xs text-purple-900 dark:text-purple-200">
							<p className="font-bold mb-1 flex items-center gap-1.5">
								<CheckCircle2 size={14} className="text-emerald-500" />
								Phản hồi từ n8n AI Agent:
							</p>
							<pre className="whitespace-pre-wrap font-mono text-[11px] bg-white/50 dark:bg-slate-900/50 p-2.5 rounded-lg mt-1 border border-purple-100 dark:border-purple-900">
								{agentTestResponse}
							</pre>
						</div>
					)}

					<div className="flex flex-col sm:flex-row gap-3 pt-2">
						<button 
							onClick={handleSaveAgentConfig} 
							disabled={isSavingAgent} 
							className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
						>
							{isSavingAgent ? <Clock className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
							Lưu Cấu Hình n8n Agent
						</button>

						<button 
							onClick={handleTestAgent} 
							disabled={isTestingAgent || !nexusAgentUrl.trim()} 
							className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-800 dark:text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2"
						>
							{isTestingAgent ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
							Test Kết Nối (Gửi Lệnh Thử)
						</button>
					</div>
				</div>
			</div>

			{/* Google Drive Automatic Backup Card */}
			<div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl">
				<div className="px-6 lg:px-8 py-5 lg:py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-800/30 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Cloud className="text-blue-500" size={20} />
						<div>
							<h4 className="text-[10px] lg:text-xs font-black text-slate-900 dark:text-white uppercase tracking-[2px] lg:tracking-[4px]">
								☁️ Tự Động Sao Lưu Dữ Liệu Lên Google Drive
							</h4>
							<p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
								Đồng bộ CSDL SQLite an toàn lên Google Drive hàng ngày qua n8n.
							</p>
						</div>
					</div>
					<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
						🟢 Tự động 17:05 hàng ngày
					</span>
				</div>

				<div className="p-6 lg:p-8 space-y-6">
					<div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
						<div className="space-y-1 text-xs">
							<p className="font-bold text-slate-800 dark:text-white">
								📁 Thư mục lưu trữ: <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">Dunvex Database Backup</span>
							</p>
							<p className="text-slate-500 dark:text-slate-400 text-[11px]">
								Folder ID: <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded font-mono">1kQciC7-VvMdKmt6rpiyspNNkQeThydxg</code>
							</p>
							<p className="text-slate-500 dark:text-slate-400 text-[11px]">
								Định dạng: <span className="font-semibold text-emerald-600">SQLite Online Snapshot (.db.gz)</span> — nén an toàn không gián đoạn giao dịch.
							</p>
						</div>
						<a 
							href="https://drive.google.com/drive/folders/1kQciC7-VvMdKmt6rpiyspNNkQeThydxg" 
							target="_blank" 
							rel="noreferrer"
							className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wider border border-blue-200 dark:border-blue-800 transition-colors w-fit"
						>
							<ExternalLink size={14} />
							Mở Thư Mục Drive
						</a>
					</div>

					{lastBackupResult && (
						<div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200">
							<p className="font-bold mb-1 flex items-center gap-1.5">
								<CheckCircle2 size={14} className="text-emerald-500" />
								Sao lưu thành công!
							</p>
							<p className="text-[11px] text-emerald-700 dark:text-emerald-300">
								Tệp: <code className="font-mono font-bold">{lastBackupResult.fileName}</code> — Đã đẩy lên Google Drive và gửi thông báo Telegram.
							</p>
						</div>
					)}

					<div>
						<button 
							onClick={handleTriggerDriveBackup} 
							disabled={isBackingUp} 
							className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
						>
							{isBackingUp ? <RefreshCw className="animate-spin" size={16} /> : <Cloud size={16} />}
							{isBackingUp ? 'Đang Sao Lưu & Tải Lên Google Drive...' : '🚀 Sao Lưu Lên Google Drive Ngay'}
						</button>
						<p className="text-[11px] text-slate-400 mt-2">
							Nhấn để tạo bản sao lưu snapshot SQLite mới nhất ngay lập tức và bắn link vào Telegram nhóm.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
