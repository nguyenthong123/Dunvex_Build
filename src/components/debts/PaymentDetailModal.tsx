import React, { useState, useRef } from 'react';
import { X, Printer, Copy, Download, CheckCircle2, FileText, Image as ImageIcon } from 'lucide-react';
import html2canvas from 'html2canvas-pro';

interface PaymentDetailModalProps {
	showPaymentDetail: boolean;
	selectedPayment: any;
	setShowPaymentDetail: (show: boolean) => void;
	setSelectedPayment: (payment: any) => void;
	formatDate: (date: any) => string;
	formatPrice: (price: number) => string;
	getImageUrl: (url: string) => string;
}

const convertNumberToVietnameseWords = (amount: number): string => {
	if (amount === 0) return 'Không đồng';
	const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
	const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
	
	let words = '';
	let temp = Math.abs(amount);
	let groupIdx = 0;
	
	while (temp > 0) {
		const group = temp % 1000;
		temp = Math.floor(temp / 1000);
		
		if (group > 0) {
			const h = Math.floor(group / 100);
			const t = Math.floor((group % 100) / 10);
			const u = group % 10;
			let groupWords = '';
			
			// Hundred digit
			if (h > 0 || temp > 0) {
				groupWords += digits[h] + ' trăm ';
			}
			
			// Ten digit
			if (t > 1) {
				groupWords += digits[t] + ' mươi ';
			} else if (t === 1) {
				groupWords += 'mười ';
			} else if (t === 0 && u > 0 && (h > 0 || temp > 0)) {
				groupWords += 'lẻ ';
			}
			
			// Unit digit
			if (u === 5 && t > 0) {
				groupWords += 'lăm';
			} else if (u === 1 && t > 1) {
				groupWords += 'mốt';
			} else if (u > 0) {
				groupWords += digits[u];
			}
			
			if (groupWords.trim() !== '') {
				words = groupWords.trim() + ' ' + units[groupIdx] + ' ' + words;
			}
		}
		groupIdx++;
	}
	
	words = words.trim();
	return words.charAt(0).toUpperCase() + words.slice(1) + ' đồng chẵn';
};

export const PaymentDetailModal: React.FC<PaymentDetailModalProps> = ({
	showPaymentDetail,
	selectedPayment,
	setShowPaymentDetail,
	setSelectedPayment,
	formatDate,
	formatPrice,
	getImageUrl
}) => {
	const [isSavingImage, setIsSavingImage] = useState(false);
	const [capturedImage, setCapturedImage] = useState<string | null>(null);
	const [showCopySuccess, setShowCopySuccess] = useState(false);
	const paperRef = useRef<HTMLDivElement>(null);

	if (!showPaymentDetail || !selectedPayment) return null;

	const handlePrint = () => {
		const printWindow = window.open('', '_blank', 'width=800,height=900');
		if (!printWindow) return;
		printWindow.document.write(`
			<html>
				<head>
					<title>Phiếu Thu Tiền - ${selectedPayment.customerName || ''}</title>
					<style>
						body { font-family: 'Arial', sans-serif; padding: 40px; color: #333; }
						.ticket { width: 100%; border: 1px dashed #bbb; padding: 30px; border-radius: 8px; box-sizing: border-box; }
						.header { text-align: center; margin-bottom: 30px; }
						.header h1 { margin: 5px 0; font-size: 22px; color: #1A237E; text-transform: uppercase; letter-spacing: 1px; }
						.header p { margin: 5px 0; font-size: 11px; color: #666; font-weight: bold; text-transform: uppercase; }
						.details { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
						.details td { padding: 12px 8px; border-bottom: 1px dashed #eee; font-size: 14px; }
						.details td.label { font-weight: bold; color: #555; width: 150px; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
						.details td.value { color: #111; font-weight: 600; }
						.amount { font-size: 18px; font-weight: bold; color: #10B981; }
						.footer { margin-top: 50px; display: flex; justify-content: space-between; }
						.signature { text-align: center; width: 220px; }
						.signature p { margin: 5px 0; font-size: 13px; }
						.signature .title { font-weight: bold; }
						.signature .space { height: 80px; }
						@media print {
							body { padding: 0; }
							.ticket { border: none; padding: 0; }
						}
					</style>
				</head>
				<body>
					<div class="ticket">
						<div class="header">
							<h1>Phiếu Thu Tiền</h1>
							<p>Hệ thống Quản lý Dunvex Build</p>
						</div>
						<table class="details">
							<tr>
								<td class="label">Khách hàng</td>
								<td class="value">${selectedPayment.customerName}</td>
							</tr>
							<tr>
								<td class="label">Ngày thu</td>
								<td class="value">${formatDate(selectedPayment.date || selectedPayment.createdAt)}</td>
							</tr>
							<tr>
								<td class="label">Số tiền</td>
								<td class="value amount">${formatPrice(selectedPayment.amount)}</td>
							</tr>
							<tr>
								<td class="label">Bằng chữ</td>
								<td class="value" style="font-style: italic;">${convertNumberToVietnameseWords(selectedPayment.amount)}</td>
							</tr>
							<tr>
								<td class="label">Hình thức</td>
								<td class="value">${selectedPayment.paymentMethod || 'Chuyển khoản'}</td>
							</tr>
							<tr>
								<td class="label">Ghi chú</td>
								<td class="value">${selectedPayment.note || '—'}</td>
							</tr>
						</table>
						<div class="footer">
							<div class="signature">
								<p class="title">Người nộp tiền</p>
								<p style="font-size: 11px; color: #777; font-style: italic;">(Ký, ghi rõ họ tên)</p>
								<div class="space"></div>
							</div>
							<div class="signature">
								<p class="title">Người nhận tiền</p>
								<p style="font-size: 11px; color: #777; font-style: italic;">(Ký, ghi rõ họ tên)</p>
								<div class="space"></div>
							</div>
						</div>
					</div>
					<script>
						window.onload = function() {
							window.print();
							setTimeout(function() { window.close(); }, 500);
						}
					</script>
				</body>
			</html>
		`);
		printWindow.document.close();
	};

	const handleSaveImage = async () => {
		if (!paperRef.current) return;
		setIsSavingImage(true);
		try {
			const canvas = await html2canvas(paperRef.current, {
				backgroundColor: '#ffffff',
				scale: 2,
				useCORS: true,
				allowTaint: false,
				logging: false,
			});
			const dataUrl = canvas.toDataURL('image/png');
			const link = document.createElement('a');
			link.download = `phieu_thu_${selectedPayment.customerName?.replace(/\s+/g, '_') || 'khach_hang'}.png`;
			link.href = dataUrl;
			link.click();
		} catch (error) {
			console.error("Lỗi tạo hình ảnh:", error);
			alert("Không thể tạo hình ảnh phiếu thu: " + (error instanceof Error ? error.message : String(error)));
		} finally {
			setIsSavingImage(false);
		}
	};

	const handleCopyImage = async () => {
		if (!paperRef.current) return;
		setIsSavingImage(true);
		let generatedUrl = '';
		try {
			if (!navigator.clipboard || !window.ClipboardItem) {
				throw new Error("Trình duyệt không hỗ trợ Clipboard API hoặc kết nối HTTP không bảo mật");
			}

			const blobPromise = (async () => {
				const canvas = await html2canvas(paperRef.current!, {
					backgroundColor: '#ffffff',
					scale: 2,
					useCORS: true,
					allowTaint: false,
					logging: false,
				});
				const dataUrl = canvas.toDataURL('image/png');
				generatedUrl = dataUrl;
				const response = await fetch(dataUrl);
				if (!response.ok) throw new Error(`HTTP status ${response.status}`);
				return await response.blob();
			})();

			await navigator.clipboard.write([
				new ClipboardItem({
					'image/png': blobPromise
				})
			]);
			setShowCopySuccess(true);
			setTimeout(() => setShowCopySuccess(false), 2500);
		} catch (error) {
			console.error("Lỗi sao chép hình ảnh:", error);
			if (generatedUrl) {
				setCapturedImage(generatedUrl);
			} else {
				alert("Không thể sao chép phiếu thu: " + (error instanceof Error ? error.message : String(error)));
			}
		} finally {
			setIsSavingImage(false);
		}
	};

	const handleClose = () => {
		setShowPaymentDetail(false);
		setSelectedPayment(null);
	};

	return (
		<div className="fixed inset-0 z-[170] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-start overflow-hidden print:hidden animate-in fade-in duration-200">
			{/* Controls bar */}
			<div 
				className="w-full flex items-center justify-between gap-2 p-3 bg-slate-950/80 backdrop-blur-lg border-b border-white/5 z-[180] no-print"
				style={{
					paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))'
				}}
			>
				{/* Close button - always visible */}
				<button
					onClick={handleClose}
					className="size-9 shrink-0 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/20 transition-all font-bold text-xs active:scale-95"
					title="Đóng"
				>
					<X size={18} />
				</button>

				{/* Action buttons */}
				<div className="flex bg-white/10 backdrop-blur-md rounded-full p-1 border border-white/20 gap-1 sm:gap-2 shrink-0">
					<button
						onClick={handlePrint}
						className="px-2.5 sm:px-3.5 py-1.5 bg-white text-slate-900 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all hover:bg-slate-100 flex items-center gap-1 active:scale-95"
					>
						<Printer size={13} /> In Phiếu
					</button>
					<button
						onClick={handleSaveImage}
						disabled={isSavingImage}
						className="px-2.5 sm:px-3.5 py-1.5 bg-emerald-500 text-white rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all hover:bg-emerald-600 flex items-center gap-1 disabled:opacity-50 active:scale-95"
					>
						<Download size={13} /> {isSavingImage ? 'Đang...' : 'Lưu Ảnh'}
					</button>
					<button
						onClick={handleCopyImage}
						disabled={isSavingImage}
						className="px-2.5 sm:px-3.5 py-1.5 bg-blue-500 text-white rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all hover:bg-blue-600 flex items-center gap-1 disabled:opacity-50 active:scale-95"
					>
						<Copy size={13} /> {isSavingImage ? 'Đang...' : 'Copy Ảnh'}
					</button>
				</div>
			</div>

			{/* SCROLLABLE DOCUMENT AREA */}
			<div className="w-full h-full overflow-y-auto pt-6 pb-28 md:pb-10 flex flex-col items-center justify-start p-4 custom-scrollbar">
				<div className="my-auto flex flex-col items-center">
					{/* The physical paper receipt */}
					<div
						ref={paperRef}
						id="payment-receipt-container"
						className="bg-white text-slate-800 w-[380px] sm:w-[420px] rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-150 flex flex-col gap-6 font-['Manrope']"
					>
						{/* Company Header */}
						<div className="text-center border-b border-dashed border-slate-200 pb-4">
							<h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">DUNVEX BUILD</h4>
							<p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Hệ thống Quản lý Dự án &amp; Công nợ</p>
						</div>

						{/* Title */}
						<div className="text-center my-1">
							<h2 className="text-xl font-black text-[#1A237E] tracking-widest uppercase">PHIẾU THU TIỀN</h2>
							<p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-wider">
								Ngày thu: {formatDate(selectedPayment.date || selectedPayment.createdAt)}
							</p>
						</div>

						{/* Detail Rows */}
						<div className="space-y-3.5 text-xs font-semibold text-slate-700">
							<div className="flex justify-between items-center pb-2 border-b border-slate-100">
								<span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Khách hàng</span>
								<span className="font-extrabold text-slate-900 uppercase truncate max-w-[200px]">{selectedPayment.customerName}</span>
							</div>
							<div className="flex justify-between items-center pb-2 border-b border-slate-100">
								<span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Số tiền</span>
								<span className="font-black text-emerald-600 text-sm tracking-tight">{formatPrice(selectedPayment.amount)}</span>
							</div>
							<div className="flex flex-col gap-1 pb-2 border-b border-slate-100">
								<span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Bằng chữ</span>
								<span className="font-bold text-slate-800 italic leading-relaxed">{convertNumberToVietnameseWords(selectedPayment.amount)}</span>
							</div>
							<div className="flex justify-between items-center pb-2 border-b border-slate-100">
								<span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Hình thức</span>
								<span className="font-black text-[#1A237E] uppercase">{selectedPayment.paymentMethod || 'Chuyển khoản'}</span>
							</div>
							{selectedPayment.note && (
								<div className="flex flex-col gap-1 pb-2 border-b border-slate-100">
									<span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ghi chú</span>
									<span className="font-medium text-slate-600 italic">"{selectedPayment.note}"</span>
								</div>
							)}
						</div>

						{/* Proof image (fully visible) */}
						{selectedPayment.proofImage && (
							<div className="space-y-2 border-t border-slate-100 pt-4">
								<span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Bằng chứng thanh toán</span>
								<div className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center p-2">
									<img
										src={getImageUrl(selectedPayment.proofImage)}
										alt="Proof"
										className="max-h-[350px] w-full object-contain"
										loading="lazy"
									/>
								</div>
							</div>
						)}

						{/* Signatures */}
						<div className="grid grid-cols-2 gap-4 border-t border-dashed border-slate-200 pt-6 text-center text-[11px] mt-2">
							<div>
								<p className="font-black text-slate-700 uppercase tracking-wider">Người nộp tiền</p>
								<p className="text-[9px] font-bold text-slate-400 italic mt-0.5">(Ký, ghi rõ họ tên)</p>
								<div className="h-16"></div>
							</div>
							<div>
								<p className="font-black text-slate-700 uppercase tracking-wider">Người nhận tiền</p>
								<p className="text-[9px] font-bold text-slate-400 italic mt-0.5">(Ký, ghi rõ họ tên)</p>
								<div className="h-16"></div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Copy Image Successful Toast */}
			{showCopySuccess && (
				<div className="fixed top-16 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-white py-2.5 px-5 rounded-full shadow-2xl flex items-center gap-2 z-[250] animate-in slide-in-from-top-4 duration-300">
					<CheckCircle2 size={16} className="text-emerald-500" />
					<span className="text-xs font-black uppercase tracking-wider">Đã copy phiếu thu vào bộ nhớ tạm!</span>
				</div>
			)}

			{/* Mobile share image long press modal */}
			{capturedImage && (
				<div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 animate-in fade-in duration-200">
					<div className="relative w-full max-w-lg flex flex-col bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 overflow-hidden max-h-[90vh]">
						<div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
							<div className="flex items-center gap-2">
								<span className="material-symbols-outlined text-[#FF6D00] text-xl animate-pulse">download_done</span>
								<h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">Ảnh Phiếu Thu Tiền</h3>
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
								alt="Phiếu Thu Tiền"
								className="max-w-full h-auto rounded-lg select-all"
							/>
						</div>

						<div className="pt-4 border-t border-slate-800 shrink-0 flex gap-2">
							<button
								onClick={async () => {
									try {
										const response = await fetch(capturedImage);
										const blob = await response.blob();
										await navigator.clipboard.write([
											new ClipboardItem({
												'image/png': blob
											})
										]);
										setShowCopySuccess(true);
										setTimeout(() => setShowCopySuccess(false), 2500);
										setCapturedImage(null);
									} catch (err) {
										alert("Không thể tự động copy. Hãy nhấn giữ vào ảnh để copy bằng tay.");
									}
								}}
								className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl active:scale-95 transition-all text-[11px] uppercase tracking-wider hover:bg-blue-700"
							>
								Sao chép ảnh
							</button>
							<button
								onClick={() => {
									const link = document.createElement('a');
									link.download = `phieu_thu_${selectedPayment.customerName?.replace(/\s+/g, '_') || 'khach_hang'}.png`;
									link.href = capturedImage;
									link.click();
									setCapturedImage(null);
								}}
								className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl active:scale-95 transition-all text-[11px] uppercase tracking-wider hover:bg-emerald-700"
							>
								Lưu ảnh
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
