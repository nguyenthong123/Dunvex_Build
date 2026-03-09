import React from 'react';
import { Lock, Crown, Rocket, CheckCircle2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UpgradeModalProps {
	onClose: () => void;
	featureName?: string;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ onClose, featureName = "Tính năng cao cấp" }) => {
	const navigate = useNavigate();

	return (
		<div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
			<div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

				{/* Relative container for close button */}
				<div className="relative p-8 pt-12 flex flex-col items-center text-center">
					<button
						onClick={onClose}
						className="absolute top-6 right-6 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
					>
						<X size={20} />
					</button>

					<div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-3xl flex items-center justify-center text-amber-500 mb-6 shadow-inner">
						<Crown size={40} />
					</div>

					<h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Gói Pro Hết Hạn</h3>
					<p className="text-slate-500 dark:text-slate-400 text-sm mb-8">
						Bạn cần nâng cấp lên gói <span className="font-bold text-indigo-600 dark:text-indigo-400">PRO</span> để tiếp tục sử dụng <span className="font-bold text-slate-800 dark:text-slate-200">{featureName}</span> và các tiện ích cao cấp khác.
					</p>

					<div className="w-full space-y-3 mb-8 text-left">
						<FeatureItem text="Xem chi tiết & In phiếu đơn hàng" />
						<FeatureItem text="Báo cáo công nợ chi tiết từng khách" />
						<FeatureItem text="Quản lý nhân sự & Phân quyền" />
						<FeatureItem text="Sao lưu dữ liệu tự động" />
					</div>

					<div className="w-full flex flex-col gap-3">
						<button
							onClick={() => {
								navigate('/pricing');
								onClose();
							}}
							className="w-full py-4 bg-[#1A237E] dark:bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 hover:bg-blue-800 dark:hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
						>
							<Rocket size={18} />
							Nâng Cấp Ngay
						</button>
						<button
							onClick={onClose}
							className="w-full py-4 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
						>
							Để sau
						</button>
					</div>
				</div>

				<div className="bg-slate-50 dark:bg-slate-800/50 p-4 text-[10px] text-slate-400 font-bold uppercase tracking-[2px] text-center border-t border-slate-100 dark:border-slate-800">
					Dunvex Build — Giải pháp quản lý thông minh
				</div>
			</div>
		</div>
	);
};

const FeatureItem = ({ text }: { text: string }) => (
	<div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
		<CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
		<span className="text-xs font-bold text-slate-600 dark:text-slate-300">{text}</span>
	</div>
);

export default UpgradeModal;
