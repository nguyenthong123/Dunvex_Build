import React from 'react';
import { useSyncEngine } from '../../hooks/useSyncEngine';
import { RefreshCw, CloudOff, CloudUpload, CheckCircle2, AlertCircle } from 'lucide-react';

export const SyncSidebarButton: React.FC = () => {
	const {
		isSyncing,
		isOnline,
		pendingCount,
		error,
		lastSyncTime,
		lastSuccessfulSyncAt,
		retryCount,
		conflictCount,
		nextRetryDelayMs,
		progressMessage,
		triggerSync,
	} = useSyncEngine();

	const formattedTime = lastSyncTime
		? new Date(lastSyncTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
		: 'Chưa có';
	const lastSuccessText = lastSuccessfulSyncAt
		? new Date(lastSuccessfulSyncAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
		: 'Chưa có';

	const getStatusConfig = () => {
		if (!isOnline) {
			return {
				icon: <CloudOff size={18} className="text-amber-300 shrink-0" />,
				label: 'Ngoại tuyến (Offline)',
				subtext: 'Lưu SQLite máy',
				badgeColor: 'bg-amber-500/20 text-amber-200 border-amber-500/30 hover:bg-amber-500/30',
				title: 'Đang ngoại tuyến: Dữ liệu được lưu trữ an toàn trong SQLite trên máy. Sẽ tự động tải lên VPS khi có kết nối mạng.',
			};
		}
		if (isSyncing) {
			return {
				icon: <RefreshCw size={18} className="text-cyan-300 animate-spin shrink-0" />,
				label: 'Đang đồng bộ...',
				subtext: progressMessage || 'Đang kết nối VPS',
				badgeColor: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/30',
				title: 'Đang đồng bộ 2 chiều với máy chủ VPS...',
			};
		}
		if (error) {
			const retryText = nextRetryDelayMs !== null
				? `Tự thử lại sau ${Math.ceil(nextRetryDelayMs / 1000)}s`
				: 'Bấm thử lại ngay';
			return {
				icon: <AlertCircle size={18} className="text-rose-400 shrink-0" />,
				label: 'Lỗi đồng bộ',
				subtext: retryText,
				badgeColor: 'bg-rose-500/20 text-rose-200 border-rose-500/30 hover:bg-rose-500/30',
				title: `Lỗi đồng bộ: ${error}. ${retryText}.`,
			};
		}
		if (conflictCount > 0) {
			return {
				icon: <AlertCircle size={18} className="text-amber-400 shrink-0" />,
				label: 'Xung đột đồng bộ',
				subtext: `${conflictCount} bản ghi chờ xử lý`,
				badgeColor: 'bg-amber-500/20 text-amber-200 border-amber-500/30 hover:bg-amber-500/30',
				title: `Có ${conflictCount} bản ghi xung đột dữ liệu khi đồng bộ với VPS.`,
			};
		}
		if (pendingCount > 0) {
			return {
				icon: <CloudUpload size={18} className="text-orange-400 shrink-0" />,
				label: `Đồng bộ (${pendingCount})`,
				subtext: 'Bấm đẩy lên VPS',
				badgeColor: 'bg-orange-500/25 text-orange-200 border-orange-500/40 hover:bg-orange-500/35',
				title: `Có ${pendingCount} thay đổi chưa tải lên VPS. Bấm để đồng bộ ngay.`,
			};
		}
		return {
			icon: <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />,
			label: 'Đã đồng bộ VPS',
			subtext: formattedTime !== 'Chưa có' ? `Lúc ${formattedTime}` : 'Tự động 2p/lần',
			badgeColor: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/25 hover:bg-emerald-500/25',
			title: `Đã đồng bộ khớp dữ liệu với VPS (Lần cuối: ${formattedTime}, cập nhật gần nhất: ${lastSuccessText}). Bấm để kiểm tra làm mới ngay. Tự động chạy mỗi 2 phút một lần.`,
		};
	};

	const config = getStatusConfig();

	return (
		<button
			type="button"
			onClick={() => triggerSync()}
			disabled={isSyncing || !isOnline}
			className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 group overflow-hidden cursor-pointer disabled:cursor-not-allowed select-none ${config.badgeColor} active:scale-[0.98]`}
			title={config.title}
		>
			<div className="relative size-5 flex items-center justify-center shrink-0">
				{config.icon}
				{pendingCount > 0 && !isSyncing && (
					<span className="absolute -top-1 -right-1 size-2 bg-orange-500 rounded-full animate-ping" />
				)}
			</div>
			<div className="hidden lg:flex flex-col items-start min-w-0 flex-1 overflow-hidden text-left">
				<span className="text-xs font-black uppercase tracking-tight truncate leading-tight w-full">
					{config.label}
				</span>
				<span className="text-[9px] font-semibold opacity-80 truncate leading-none mt-0.5 w-full">
					{config.subtext}
				</span>
			</div>
			{/* Tag hiển thị chu kỳ đồng bộ tự động 2 phút */}
			<div className="hidden lg:flex items-center shrink-0">
				{isSyncing ? (
					<span className="size-2 rounded-full bg-cyan-400 animate-ping" />
				) : (
					<span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-white/10 text-white/70 uppercase">
						2p
					</span>
				)}
			</div>
		</button>
	);
};

export default SyncSidebarButton;
