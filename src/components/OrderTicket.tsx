import React, { useState, useEffect } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { db, doc, getDoc } from '../services/firebase';
import { useOwner } from '../hooks/useOwner';
import { getCreatorName, getScaleAndWidth } from './orderTicket/ticketUtils';
import { useTicketActions } from './orderTicket/useTicketActions';
import TicketPaper from './orderTicket/TicketPaper';
import TicketBill from './orderTicket/TicketBill';

interface OrderTicketProps {
	order: any;
	onClose: () => void;
	products?: any[];
}

const OrderTicket: React.FC<OrderTicketProps> = ({ order, onClose, products }) => {
	const owner = useOwner();
	const [screenWidth, setScreenWidth] = useState(window.innerWidth);
	const [zoom, setZoom] = useState(0.85); // Default zoom slightly out for desktop
	const [companyInfo, setCompanyInfo] = useState<any>(null);
	const [isSavingImage, setIsSavingImage] = useState(false);
	const [capturedImage, setCapturedImage] = useState<string | null>(null);
	const [showCopySuccess, setShowCopySuccess] = useState(false);
	const [layoutMode, setLayoutMode] = useState<'a4' | 'receipt'>(window.innerWidth < 768 ? 'receipt' : 'a4');

	useEffect(() => {
		if (!owner.ownerId) return;
		const fetchSettings = async () => {
			const settingsRef = doc(db, 'settings', owner.ownerId);
			const settingsSnap = await getDoc(settingsRef);
			if (settingsSnap.exists()) {
				setCompanyInfo(settingsSnap.data());
			}
		};
		fetchSettings();
	}, [owner.ownerId]);

	useEffect(() => {
		const handleResize = () => {
			setScreenWidth(window.innerWidth);
		};
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	const creatorName = getCreatorName(order, owner);
	const { width: targetWidthStr, scale: activeScale } = getScaleAndWidth(layoutMode, screenWidth);

	const { handlePrint, handleSaveImage, handleCopyImage, handleDirectCopyImage } = useTicketActions({
		layoutMode,
		order,
		capturedImage,
		setCapturedImage,
		setIsSavingImage,
		setShowCopySuccess,
		companyInfo,
		products,
	});

	return (
		<div className="fixed inset-0 z-100 bg-slate-900/95 print:hidden">
			{/* CONTROLS - Fixed at the top, responsive and single-row on mobile */}
			<div className="fixed top-0 left-0 right-0 md:top-4 md:left-1/2 md:right-auto md:-translate-x-1/2 flex items-center justify-between gap-3 p-3 md:py-2.5 md:px-5 bg-slate-955/80 md:bg-slate-900/80 backdrop-blur-lg border-b border-white/5 md:border md:border-white/10 md:rounded-full z-110 no-print w-full md:w-[calc(100%-2rem)] md:max-w-[1000px]">
				{/* Layout Mode Toggle */}
				<div className="flex bg-white/10 backdrop-blur-md rounded-full p-1 border border-white/20 shrink-0">
					<button
						onClick={() => setLayoutMode('a4')}
						className={`px-2.5 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all ${layoutMode === 'a4' ? 'bg-white text-slate-900 shadow-md' : 'text-white hover:bg-white/10'}`}
					>
						Mẫu A4
					</button>
					<button
						onClick={() => setLayoutMode('receipt')}
						className={`px-2.5 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all ${layoutMode === 'receipt' ? 'bg-white text-slate-900 shadow-lg' : 'text-white hover:bg-white/10'}`}
					>
						Mẫu Bill
					</button>
				</div>

				<div className="flex items-center gap-2">
					{/* Desktop-only zoom controls */}
					<div className="hidden md:flex bg-white/10 backdrop-blur-md rounded-full p-1 border border-white/20 mr-2">
						{[0.6, 0.85, 1.0].map((v) => (
							<button
								key={v}
								onClick={() => setZoom(v)}
								className={`px-3 py-1.5 rounded-full text-[9px] font-black transition-all ${zoom === v ? 'bg-white text-slate-900 shadow-lg' : 'text-white hover:bg-white/10'}`}
							>
								{v * 100}%
							</button>
						))}
					</div>

					{/* Desktop-only Action Buttons */}
					<div className="hidden md:flex items-center gap-2">
						<button
							onClick={handleSaveImage}
							disabled={isSavingImage}
							className="h-10 px-4 rounded-full bg-emerald-600 text-white flex items-center justify-center border border-emerald-500/30 shadow-lg transition-all font-black text-[10px] uppercase tracking-widest active:scale-95 hover:bg-emerald-700 disabled:opacity-50 gap-1.5 shrink-0"
						>
							<span className="material-symbols-outlined text-base">download</span>
							<span>{isSavingImage ? 'Đang tạo...' : 'Lưu ảnh'}</span>
						</button>

						<button
							onClick={handleDirectCopyImage}
							disabled={isSavingImage}
							className="h-10 px-4 rounded-full bg-blue-600 text-white flex items-center justify-center border border-blue-500/30 shadow-lg transition-all font-black text-[10px] uppercase tracking-widest active:scale-95 hover:bg-blue-700 disabled:opacity-50 gap-1.5 shrink-0"
						>
							<span className="material-symbols-outlined text-base">content_copy</span>
							<span>{isSavingImage ? 'Đang copy...' : 'Copy ảnh'}</span>
						</button>

						<button
							onClick={handlePrint}
							className="h-10 px-5 rounded-full bg-slate-800 text-white flex items-center justify-center border border-slate-700 shadow-lg transition-all font-black text-[10px] uppercase tracking-widest active:scale-95 hover:bg-black gap-2 shrink-0"
							title="In phiếu"
						>
							<span className="material-symbols-outlined text-base">print</span>
							<span>In phiếu</span>
						</button>
					</div>

					{/* Close Button - Always visible, full text on desktop, icon only on mobile */}
					<button
						onClick={onClose}
						className="h-9 w-9 sm:h-10 sm:w-10 md:w-auto md:px-5 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/20 transition-all font-bold text-[10px] uppercase tracking-widest active:scale-95 shrink-0"
						title="Đóng"
					>
						<span className="md:hidden"><X size={16} /></span>
						<span className="hidden md:inline">Đóng</span>
					</button>
				</div>
			</div>

			{/* SCROLLABLE WRAPPER FOR TICKET CONTENT */}
			<div className="w-full h-full overflow-y-auto pt-20 pb-28 md:pt-24 md:pb-10 flex flex-col items-center custom-scrollbar">
				{/* Wrapper for scaling, responsive size based on selected design mode */}
				<div
				style={{
					width: targetWidthStr,
					maxWidth: layoutMode === 'receipt' ? '420px' : undefined,
					transform: `scale(${activeScale * (layoutMode === 'a4' ? zoom : 1)})`,
					transformOrigin: 'top center',
					marginBottom: (activeScale * (layoutMode === 'a4' ? zoom : 1)) < 1 
						? `-${(1 - (activeScale * (layoutMode === 'a4' ? zoom : 1))) * (layoutMode === 'a4' ? 1100 : 700)}px` 
						: '0'
				}}
				className="shrink-0 print-scale"
			>
					{layoutMode === 'a4' ? (
						<TicketPaper order={order} products={products} companyInfo={companyInfo} creatorName={creatorName} />
					) : (
						<TicketBill order={order} products={products} companyInfo={companyInfo} creatorName={creatorName} />
					)}
			</div>
		</div>

		{/* Mobile Image Sharing / Long Press Helper Modal */}
		{capturedImage && (
				<div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
					<div className="relative w-full max-w-lg flex flex-col bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 overflow-hidden max-h-[90vh]">
						<div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
							<div className="flex items-center gap-2">
								<span className="material-symbols-outlined text-[#FF6D00] text-xl animate-pulse">download_done</span>
								<h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">Ảnh Phiếu Giao Hàng</h3>
							</div>
							<button 
								onClick={() => setCapturedImage(null)} 
								className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
							>
								<X size={20} />
							</button>
						</div>

						<div className="py-3 text-center shrink-0">
							<p className="text-xs sm:text-sm font-extrabold text-[#FF6D00] bg-orange-500/10 py-2.5 px-4 rounded-xl inline-block leading-snug">
								👉 Nhấn giữ vào ảnh bên dưới, chọn "Lưu ảnh" hoặc "Chia sẻ" trực tiếp sang Zalo / Facebook!
							</p>
						</div>

						<div className="flex-1 overflow-y-auto min-h-0 bg-white rounded-2xl border border-slate-800 p-2 flex justify-center items-start shadow-inner">
							<img 
								src={capturedImage} 
								alt="Phiếu Giao Hàng" 
								className="max-w-full h-auto rounded-lg select-all" 
							/>
						</div>

						<div className="pt-4 border-t border-slate-800 shrink-0 flex gap-2">
							<button
								onClick={handleCopyImage}
								className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl active:scale-95 transition-all text-[11px] uppercase tracking-wider hover:bg-emerald-700"
							>
								Sao chép ảnh
							</button>
							<button
								onClick={() => {
									const link = document.createElement('a');
									link.download = `phieu_giao_hang_${layoutMode.toUpperCase()}_${order.id?.slice(0, 8).toUpperCase()}.png`;
									link.href = capturedImage;
									link.click();
								}}
								className="flex-1 py-3 bg-[#FF6D00] text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all text-[11px] uppercase tracking-wider hover:bg-[#e66200]"
							>
								Tải về
							</button>
							<button
								onClick={() => setCapturedImage(null)}
								className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl active:scale-95 transition-all text-[11px] uppercase tracking-wider hover:bg-slate-700"
							>
								Đóng
							</button>
						</div>
					</div>
				</div>
			)}

			{/* MOBILE BOTTOM ACTION BAR */}
			<div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-955/90 backdrop-blur-xl border-t border-white/10 z-110 flex items-center justify-around gap-3 md:hidden no-print">
				<button
					onClick={handleSaveImage}
					disabled={isSavingImage}
					className="flex-1 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center border border-emerald-500/30 shadow-lg transition-all font-extrabold text-[11px] uppercase tracking-wider active:scale-95 hover:bg-emerald-700 disabled:opacity-50 gap-1.5"
				>
					<span className="material-symbols-outlined text-lg">download</span>
					<span>{isSavingImage ? 'Đang tạo...' : 'Lưu ảnh'}</span>
				</button>

				<button
					onClick={handleDirectCopyImage}
					disabled={isSavingImage}
					className="flex-1 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center border border-blue-500/30 shadow-lg transition-all font-extrabold text-[11px] uppercase tracking-wider active:scale-95 hover:bg-blue-700 disabled:opacity-50 gap-1.5"
				>
					<span className="material-symbols-outlined text-lg">content_copy</span>
					<span>{isSavingImage ? 'Đang copy...' : 'Copy ảnh'}</span>
				</button>

				<button
					onClick={handlePrint}
					className="w-12 h-12 rounded-xl bg-slate-800 text-white flex items-center justify-center border border-slate-700 shadow-lg transition-all active:scale-95 hover:bg-black"
					title="In phiếu"
				>
					<span className="material-symbols-outlined text-lg">print</span>
				</button>
			</div>

			{showCopySuccess && (
				<div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col items-center gap-4 text-center max-w-sm mx-4 animate-in zoom-in-95 duration-200 shadow-2xl">
						<div className="size-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.25)] animate-bounce">
							<CheckCircle2 size={36} className="stroke-[2.5]" />
						</div>
						<div>
							<h4 className="text-white font-black text-base uppercase tracking-wider mb-1">Sao chép thành công!</h4>
							<p className="text-slate-400 text-xs leading-relaxed">Đã sao chép ảnh phiếu giao hàng vào khay nhớ tạm. Bạn có thể dán (Paste) gửi ngay sang Zalo / Facebook!</p>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default OrderTicket;