import React, { useState, useEffect } from 'react';
import { FileText, Download, Share2, Building2, MapPin, Phone, Mail } from 'lucide-react';
import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useOwner } from '../hooks/useOwner';
import { getOptimizedImageUrl } from '../utils/validation';

interface OrderTicketProps {
	order: any;
	onClose: () => void;
}

const OrderTicket: React.FC<OrderTicketProps> = ({ order, onClose }) => {
	const owner = useOwner();
	const [scale, setScale] = useState(1);
	const [zoom, setZoom] = useState(0.85); // Default zoom slightly out for desktop
	const [companyInfo, setCompanyInfo] = useState<any>(null);

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
			if (window.innerWidth < 1050) {
				const s = (window.innerWidth - 40) / 1000;
				setScale(s);
			} else {
				setScale(1);
			}
		};
		handleResize();
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	const formatDate = (date: any) => {
		if (!date) return '---';
		const d = new Date(date.seconds * 1000);
		return d.toLocaleString('vi-VN');
	};

	const formatPrice = (num: number) => {
		return new Intl.NumberFormat('vi-VN').format(num || 0);
	};

	const handlePrint = () => {
		const printContent = document.getElementById('order-ticket-paper');
		if (!printContent) return;

		const printWindow = window.open('', '_blank', 'width=1200,height=1000');
		if (!printWindow) {
			alert("Vui lòng cho phép trình duyệt mở popup để in!");
			return;
		}

		// Compile active CSS rules directly to prevent black & white styling due to lazy-loaded CSS
		let styles = '';
		try {
			for (const sheet of document.styleSheets) {
				try {
					if (sheet.cssRules) {
						for (const rule of sheet.cssRules) {
							styles += rule.cssText + '\n';
						}
					}
				} catch (e) {
					// Fallback for cross-origin styles
					if (sheet.href) {
						styles += `@import url("${sheet.href}");\n`;
					}
				}
			}
		} catch (err) {
			console.warn("Could not inline all styles directly", err);
		}

		// Also collect current HTML style/link nodes as a fallback
		let fallbackTags = '';
		document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
			fallbackTags += node.outerHTML;
		});

		printWindow.document.write(`
			<html>
				<head>
					<base href="${window.location.origin}/">
					<title>In Phiếu Giao Hàng - ${order.orderId || ''}</title>
					<link rel="preconnect" href="https://fonts.googleapis.com">
					<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
					<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
					<style>${styles}</style>
					${fallbackTags}
					<style>
						body { 
							background: white !important; 
							padding: 0 !important; margin: 0 !important; 
							display: flex !important; justify-content: center !important;
							font-family: 'Inter', 'Manrope', sans-serif !important;
							color: #1e293b !important;
						}
						#order-ticket-paper {
							margin: 0 !important;
							box-shadow: none !important;
							border: none !important;
							width: 100% !important;
							max-width: 100% !important;
							background: white !important;
							visibility: visible !important;
							display: block !important;
							padding: 0 !important;
						}
						/* Force high fidelity colors */
						* {
							-webkit-print-color-adjust: exact !important;
							print-color-adjust: exact !important;
						}
						
						/* Table formatting for crisp printing */
						table {
							width: 100% !important;
							border-collapse: collapse !important;
							margin-top: 15px !important;
							page-break-inside: auto !important;
						}
						tr {
							page-break-inside: avoid !important;
							page-break-after: auto !important;
						}
						thead {
							display: table-header-group !important;
						}
						thead tr {
							background-color: #1c130d !important;
							color: #ffffff !important;
						}
						th {
							background-color: #1c130d !important;
							color: #ffffff !important;
							border: 1px solid #2d251e !important;
							font-weight: 800 !important;
							font-size: 11px !important;
							text-transform: uppercase !important;
							letter-spacing: 0.5px !important;
							padding: 10px 12px !important;
						}
						td {
							border: 1px solid #cbd5e1 !important;
							font-size: 11px !important;
							padding: 10px 12px !important;
							color: #1e293b !important;
						}
						
						/* Force typography and elements to print elegantly */
						.text-\[\#1A237E\], .text-indigo-600 {
							color: #1a237e !important;
						}
						.text-orange-500, .text-\[\#f27121\] {
							color: #e65100 !important;
						}
						
						@media print {
							body { 
								background: white !important; 
								margin: 0 !important; 
								padding: 0 !important;
								-webkit-print-color-adjust: exact !important;
								print-color-adjust: exact !important;
							}
							#order-ticket-paper { 
								margin: 0 !important; 
								padding: 0 !important; 
								border: none !important;
								box-shadow: none !important;
							}
							@page { 
								size: A4; 
								margin: 12mm 15mm 15mm 15mm; 
							}
							thead tr {
								background-color: #1c130d !important;
								color: #ffffff !important;
							}
							th {
								background-color: #1c130d !important;
								color: #ffffff !important;
								-webkit-print-color-adjust: exact !important;
								print-color-adjust: exact !important;
							}
						}
					</style>
				</head>
				<body>
					<div class="print-container">
						${printContent.outerHTML}
					</div>
					<script>
						function checkStylesAndPrint() {
							const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
							let loadedCount = 0;
							
							const printAndClose = () => {
								if (window.hasPrinted) return;
								window.hasPrinted = true;
								
								if (document.fonts && document.fonts.ready) {
									document.fonts.ready.then(() => {
										setTimeout(() => {
											window.print();
											if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
												window.close();
											}
										}, 250);
									}).catch(() => {
										setTimeout(() => {
											window.print();
											if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
												window.close();
											}
										}, 250);
									});
								} else {
									setTimeout(() => {
										window.print();
										if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
											window.close();
										}
									}, 250);
								}
							};

							if (links.length === 0) {
								printAndClose();
								return;
							}
							
							links.forEach(link => {
								if (link.sheet) {
									loadedCount++;
									if (loadedCount === links.length) {
										printAndClose();
									}
								} else {
									link.onload = () => {
										loadedCount++;
										if (loadedCount === links.length) {
											printAndClose();
										}
									};
									link.onerror = () => {
										loadedCount++;
										if (loadedCount === links.length) {
											printAndClose();
										}
									};
								}
							});
							
							// Backup timeout to make sure it prints even if a resource is blocked
							setTimeout(printAndClose, 1200);
						}
						
						if (document.readyState === 'complete') {
							checkStylesAndPrint();
						} else {
							window.onload = checkStylesAndPrint;
						}
					</script>
				</body>
			</html>
		`);
		printWindow.document.close();
	};

	return (
		<div className="fixed inset-0 z-100 bg-slate-900/95 backdrop-blur-xl flex flex-col items-center overflow-y-auto pt-32 md:pt-10 pb-10 custom-scrollbar print:hidden">


			{/* CONTROLS - Hidden when printing */}
			<div className="fixed top-4 right-4 flex items-center gap-3 z-110 no-print">
				<div className="flex bg-white/10 backdrop-blur-md rounded-full p-1 border border-white/20 mr-4">
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
				<button
					onClick={handlePrint}
					className="h-10 px-5 rounded-full bg-[#f27121] text-white flex items-center justify-center backdrop-blur-md border border-orange-500/30 shadow-xl shadow-orange-500/20 transition-all font-black text-[10px] uppercase tracking-widest active:scale-95 hover:bg-orange-600 gap-2"
				>
					<span className="material-symbols-outlined text-base">print</span>
					In phiếu
				</button>
				<button
					onClick={onClose}
					className="h-10 px-5 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all font-bold text-[10px] uppercase tracking-widest active:scale-95"
				>
					Đóng
				</button>
			</div>

			{/* Wrapper for scaling */}
			<div
				style={{
					width: '1000px',
					transform: `scale(${scale * zoom})`,
					transformOrigin: 'top center',
					marginBottom: (scale * zoom) < 1 ? `-${(1 - (scale * zoom)) * 1100}px` : '0'
				}}
				className="shrink-0 print-scale"
			>
				<div
					id="order-ticket-paper"
					className="bg-white shadow-2xl overflow-hidden relative border border-gray-100"
				>
					<main className="bg-white text-gray-900 font-sans antialiased">
						<header className="p-8 border-b border-gray-100">
							{/* Company Info Section */}
							<div className="flex justify-between items-start gap-8 mb-10">
								<div className="space-y-4">
									<div className="flex items-center gap-4">
										{companyInfo?.logoUrl ? (
											<img src={companyInfo.logoUrl} alt="Logo" className="h-16 object-contain shrink-0" />
										) : (
											<div className="size-14 bg-[#f27121] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20 shrink-0">
												<Building2 size={32} />
											</div>
										)}
										<h2 className="text-3xl font-black text-[#f27121] uppercase tracking-tighter leading-tight">
											{companyInfo?.name || 'DUNVEX'}
										</h2>
									</div>

									<div className="space-y-1.5 pl-1">
										<div className="flex items-start gap-2.5 text-gray-600">
											<MapPin size={12} className="text-[#f27121] shrink-0 mt-0.5" />
											<span className="text-[10px] font-black uppercase tracking-wide leading-tight">
												{companyInfo?.address || 'XÃ KIẾN ĐỨC , LÂM ĐỒNG'}
											</span>
										</div>
										<div className="flex items-center gap-5">
											<div className="flex items-center gap-1.5 text-gray-700">
												<Phone size={12} className="text-[#f27121]" />
												<span className="text-xs font-black">{order.createdByPhone && order.createdByPhone.trim() ? order.createdByPhone : (companyInfo?.phone || '0988765444')}</span>
											</div>
											<div className="flex items-center gap-1.5 text-gray-700">
												<Mail size={12} className="text-[#f27121]" />
												<span className="text-xs font-black">{companyInfo?.email || 'dunvex.green@gmail.com'}</span>
											</div>
										</div>
									</div>
								</div>

								<div className="text-right">
									<div className="inline-block px-4 py-1.5 bg-orange-50 rounded-lg mb-2">
										<p className="text-[10px] font-black text-[#f27121] uppercase tracking-[2px]">
											Hệ Thống Quản Lý Đơn Hàng
										</p>
									</div>
									<p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">
										Giao hàng & Thu hộ chuyên nghiệp
									</p>
								</div>
							</div>

							<h1 className="text-4xl font-black text-center text-gray-900 uppercase mb-6 tracking-[6px] border-y-2 border-gray-900 py-3">
								PHIẾU GIAO HÀNG
							</h1>
							<div className="flex justify-center gap-10 text-base font-bold text-gray-700 border-t border-b border-dashed border-gray-300 py-4">
								<div className="flex items-center">
									<span className="text-gray-400 mr-2 uppercase text-[10px] tracking-widest">Mã Đơn:</span>
									<span className="text-[#1A237E]">#{order.id?.slice(0, 8).toUpperCase()}</span>
								</div>
								<div className="flex items-center">
									<span className="text-gray-400 mr-2 uppercase text-[10px] tracking-widest">Ngày:</span>
									<span className="text-slate-900">{formatDate(order.createdAt)}</span>
								</div>
								<div className="flex items-center">
									<span className="text-gray-400 mr-2 uppercase text-[10px] tracking-widest">Kiện:</span>
									<span className="text-slate-900">
										{(() => {
											const totalPackages = order.items?.reduce((sum: number, item: any) => {
												const packaging = parseFloat(item.packaging) || 0;
												if (packaging <= 0) return sum;
												return sum + (Number(item.qty) / packaging);
											}, 0) || 0;
											return totalPackages.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
										})()}
									</span>
								</div>
								<div className="flex items-center">
									<span className="text-gray-400 mr-2 uppercase text-[10px] tracking-widest">TL tải:</span>
									<span className="text-[#f27121]">{order.totalWeight ? formatPrice(order.totalWeight) : 0} kg</span>
								</div>
							</div>
						</header>

						<section className="px-8 py-6 grid grid-cols-2 gap-8">
							<div className="space-y-4">
								<div className="flex flex-col">
									<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Khách hàng</span>
									<span className="font-black text-gray-900 text-xl uppercase leading-tight tracking-tight">{order.customerBusinessName || order.customerName || 'Khách vãng lai'}</span>
								</div>
								<div className="flex flex-col">
									<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Số điện thoại người nhận</span>
									<span className="text-gray-600 font-bold italic leading-relaxed">{order.customerPhone || '---'}</span>
								</div>
							</div>
							<div className="space-y-4 text-right">
								<div className="flex flex-col items-end">
									<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Người lập phiếu</span>
									<span className="font-black text-[#1A237E] uppercase">{order.createdByEmail?.split('@')[0]}</span>
								</div>
								<div className="flex flex-col items-end">
									<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Trạng thái đơn</span>
									<span className="px-4 py-1.5 rounded-lg bg-[#1A237E] text-white text-[10px] font-black uppercase tracking-[2px]">{order.status}</span>
								</div>
							</div>
						</section>

						<section className="px-8 pb-6">
							<div className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
								<table className="w-full text-left text-sm border-collapse table-fixed">
									<thead className="bg-[#1c130d] text-white uppercase font-black text-[10px] tracking-widest">
										<tr>
											<th className="px-3 py-4 text-center w-14 border-r border-white/10">ẢNH</th>
											<th className="px-5 py-4 border-r border-white/10">Tên Hàng Hóa / Sản phẩm</th>
											<th className="px-3 py-4 border-r border-white/10 w-24">Quy cách</th>
											<th className="px-3 py-4 text-center border-r border-white/10 w-16">ĐVT</th>
											<th className="px-3 py-4 text-center border-r border-white/10 w-16">SL</th>
											<th className="px-5 py-4 text-right border-r border-white/10 w-28">Đơn Giá</th>
											<th className="px-5 py-4 text-right w-32">Thành Tiền</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-100">
										{order.items?.map((item: any, idx: number) => (
											<tr key={idx} className="hover:bg-gray-50/50 transition-colors">
												<td className="px-2 py-4 text-center border-r border-gray-50 align-middle">
													<div className="flex justify-center">
														{item.imageUrl ? (
															<div className="size-12 rounded-full border-2 border-white shadow-[0_8px_16px_rgba(0,0,0,0.15),inset_0_2px_4px_rgba(255,255,255,0.4)] ring-1 ring-gray-200 overflow-hidden bg-white shrink-0 transform transition-transform hover:scale-105 active:scale-95">
																<img 
																	src={getOptimizedImageUrl(item.imageUrl)} 
																	alt={item.name} 
																	className="size-full object-cover"
																/>
															</div>
														) : (
															<div className="size-12 rounded-full border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-[10px] font-black text-gray-400 uppercase tracking-tighter shadow-inner">
																{item.name?.slice(0, 2)}
															</div>
														)}
													</div>
												</td>
												<td className="px-5 py-4 border-r border-gray-50 font-black text-[#1A237E] uppercase tracking-tight leading-tight break-words whitespace-normal">
													<div>{item.name}</div>
													{item.serialNumber && (
														<div className="text-[10px] text-[#B48C00] mt-0.5 font-bold break-words">SN: {item.serialNumber}</div>
													)}
												</td>
												<td className="px-3 py-4 border-r border-gray-50 text-gray-500 font-bold text-[10px] uppercase">{item.specification || '---'}</td>
												<td className="px-3 py-4 text-center border-r border-gray-50 text-gray-500 font-bold text-xs uppercase">{item.unit || '---'}</td>
												<td className="px-3 py-4 text-center border-r border-gray-50 font-black text-gray-900 text-base">{item.qty}</td>
												<td className="px-5 py-4 text-right border-r border-gray-50 text-gray-600 font-bold">{formatPrice(item.price)}</td>
												<td className="px-5 py-4 text-right font-black text-gray-900 text-base">{formatPrice(item.qty * item.price)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</section>

						<section className="px-8 pb-8 flex justify-between items-start">
							{/* Ghi chú on the left */}
							<div className="flex-1 pr-10">
								{order.note && (
									<div className="mt-2 p-5 bg-orange-50 rounded-2xl border border-orange-100/50 text-left overflow-hidden">
										<p className="text-[10px] font-black text-[#9c6949] uppercase tracking-widest mb-2">Ghi chú đơn hàng:</p>
										<p className="text-sm font-bold text-[#1c130d] italic leading-relaxed break-words whitespace-pre-wrap">"{order.note}"</p>
									</div>
								)}
							</div>

							{/* Totals on the right */}
							<div className="w-[350px] space-y-4">
								<div className="flex justify-between items-center text-xs font-bold text-gray-400">
									<span className="uppercase tracking-[2px]">Cộng tiền hàng:</span>
									<span className="text-gray-800 text-lg tabular-nums">{formatPrice(order.subTotal || 0)} ₫</span>
								</div>

								{order.discountValue > 0 && (
									<div className="flex justify-between items-center text-red-500 font-bold">
										<span className="text-[10px] uppercase tracking-[2px] italic">Chiết khấu giảm (-):</span>
										<span className="text-lg tabular-nums">-{formatPrice(order.discountValue)} ₫</span>
									</div>
								)}

								{order.adjustmentValue > 0 && (
									<div className="flex justify-between items-center text-gray-400 font-bold">
										<span className="text-[10px] uppercase tracking-[2px] italic">Phí vận chuyển (+):</span>
										<span className="text-gray-800 text-lg tabular-nums">+{formatPrice(order.adjustmentValue || 0)} ₫</span>
									</div>
								)}

								<div className="border-b border-gray-200 pb-2"></div>

								<div className="flex flex-col items-end pt-2 gap-1 text-right">
									<span className="text-xs font-black text-gray-900 uppercase tracking-[3px]">TỔNG THANH TOÁN:</span>
									<span className="font-black text-[#f27121] text-4xl tabular-nums tracking-tighter leading-none">{formatPrice(order.totalAmount || 0)} ₫</span>
								</div>
							</div>
						</section>

						<footer className="p-6 pb-10 mt-6 bg-gray-50/50 border-t border-gray-100 flex justify-between items-start text-center">
							<div className="w-1/3">
								<h4 className="font-black text-[9px] uppercase text-gray-400 mb-16 tracking-[2px]">Người Lập Phiếu</h4>
								<span className="font-black text-[#1A237E] text-[10px] uppercase border-t border-dashed border-gray-300 pt-3 px-4">{order.createdByEmail?.split('@')[0]}</span>
							</div>
							<div className="w-1/3">
								<h4 className="font-black text-[9px] uppercase text-gray-400 mb-20 tracking-[2px]">Người Giao Hàng</h4>
								<div className="mx-auto h-px w-20 bg-gray-200"></div>
							</div>
							<div className="w-1/3">
								<h4 className="font-black text-[9px] uppercase text-gray-400 mb-20 tracking-[2px]">Người Nhận Hàng</h4>
								<div className="mx-auto h-px w-20 bg-gray-200"></div>
							</div>
						</footer>
					</main>
				</div>
			</div>
		</div>
	);
};

export default OrderTicket;
