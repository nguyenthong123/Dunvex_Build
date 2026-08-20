import { Building2, MapPin, Phone, Mail, ShieldCheck } from 'lucide-react';
import { formatDate, formatPrice, getTicketImageUrl, computeTotalPackages, groupOrderItems } from './ticketUtils';

interface TicketPaperProps {
	order: any;
	products?: any[];
	companyInfo: any;
	creatorName: string;
}

const TicketPaper: React.FC<TicketPaperProps> = ({ order, products, companyInfo, creatorName }) => {
	const groupedItems = groupOrderItems(order.items);
	const hasImages = groupedItems.some((item: any) => !!(item.imageUrl || (products && products.find((p: any) => p.id === item.productId)?.imageUrl))) || false;

	return (
					<div
						id="order-ticket-paper"
						className="bg-white shadow-2xl overflow-hidden relative border border-slate-200"
					>
						<main className="bg-white text-black font-sans antialiased">
							<header className="p-8 border-b border-slate-200">
								{/* Company Info Section */}
								<div className="flex justify-between items-start gap-8 mb-6">
									<div className="space-y-4">
										<div className="flex items-center gap-4">
											{companyInfo?.logoUrl ? (
												<div className="w-12 h-12 rounded-full border border-slate-200 overflow-hidden bg-white shrink-0 shadow-sm">
													<img src={getTicketImageUrl(companyInfo.logoUrl)} alt="Logo" className="w-full h-full object-cover" />
												</div>
											) : (
												<div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm">
													<Building2 size={24} />
												</div>
											)}
											<h2 className="text-2xl font-black text-black uppercase tracking-tight leading-tight">
												{companyInfo?.name || 'DUNVEX'}
											</h2>
										</div>

										<div className="space-y-1.5 pl-1">
											<div className="flex items-start gap-2 text-slate-800">
												<MapPin size={14} className="text-black shrink-0 mt-0.5" />
												<span className="text-xs sm:text-sm font-bold uppercase tracking-wide leading-tight">
													{companyInfo?.address || 'XÃ KIẾN ĐỨC , LÂM ĐỒNG'}
												</span>
											</div>
											<div className="flex items-center gap-5">
												<div className="flex items-center gap-1.5 text-slate-900">
													<Phone size={14} className="text-black" />
													<span className="text-sm font-extrabold">{order.createdByPhone && order.createdByPhone.trim() ? order.createdByPhone : (companyInfo?.phone || '0988765444')}</span>
												</div>
												<div className="flex items-center gap-1.5 text-slate-900">
													<Mail size={14} className="text-black" />
													<span className="text-sm font-extrabold">{companyInfo?.email || 'dunvex.green@gmail.com'}</span>
												</div>
											</div>
										</div>
									</div>

									<div className="text-right">
										<div className="inline-block px-4 py-1.5 bg-slate-100 rounded-lg mb-2">
											<p className="text-[10px] font-black text-black uppercase tracking-[2px]">
												Hệ Thống Quản Lý Đơn Hàng
											</p>
										</div>
										<p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
											Giao hàng & Thu hộ chuyên nghiệp
										</p>
									</div>
								</div>

								<h1 className="text-4xl font-black text-center text-black uppercase mb-6 tracking-[6px] border-y-2 border-black py-4">
									PHIẾU GIAO HÀNG
								</h1>
								
								{/* Meta Details Bar */}
								<div className="flex justify-center gap-10 text-base font-bold text-slate-900 border-t border-b border-dashed border-slate-300 py-4">
									<div className="flex items-center">
										<span className="text-slate-400 mr-2 uppercase text-xs tracking-widest">Mã Đơn:</span>
										<span className="text-black font-black">#{order.id?.slice(0, 8).toUpperCase()}</span>
									</div>
									<div className="flex items-center">
										<span className="text-slate-400 mr-2 uppercase text-xs tracking-widest">Ngày:</span>
										<span className="text-black font-black">{formatDate(order.orderDate || order.createdAt)}</span>
									</div>
									<div className="flex items-center">
										<span className="text-slate-400 mr-2 uppercase text-xs tracking-widest">Kiện:</span>
										<span className="text-black font-black">
											{computeTotalPackages(order)}
										</span>
									</div>
									<div className="flex items-center">
										<span className="text-slate-400 mr-2 uppercase text-xs tracking-widest">TL tải:</span>
										<span className="text-black font-black">{order.totalWeight ? formatPrice(order.totalWeight) : 0} kg</span>
									</div>
								</div>
							</header>

							{/* Customer & Creator info */}
							<section className="px-8 py-6 grid grid-cols-2 gap-8">
								<div className="space-y-4">
									<div className="flex flex-col">
										<span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Khách hàng</span>
										<span className="font-black text-black text-xl sm:text-2xl uppercase leading-tight tracking-tight">{order.customerBusinessName || order.customerName || 'Khách vãng lai'}</span>
									</div>
									<div className="flex flex-col">
										<span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Số điện thoại người nhận</span>
										<span className="text-slate-900 font-extrabold text-base sm:text-lg leading-relaxed">{order.customerPhone || '---'}</span>
									</div>
								</div>
								<div className="space-y-4 text-right flex flex-col items-end justify-between">
									<div className="flex flex-col items-end">
										<span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Người lập phiếu</span>
										<span className="font-black text-black text-base sm:text-lg uppercase">{creatorName}</span>
									</div>
									<div className="flex flex-col items-end">
										<span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Trạng thái đơn</span>
										<span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-black text-white text-xs font-black uppercase tracking-[2px]">
											<ShieldCheck size={12} /> {order.status}
										</span>
									</div>
								</div>
							</section>

							{/* Products Table */}
							<section className="px-8 pb-6">
								<div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
									<div className="flex bg-slate-900 text-white uppercase font-black text-xs tracking-wider">
										{hasImages && <div className="w-16 shrink-0 px-3 py-4 text-center border-r border-slate-800">ẢNH</div>}
										<div className="flex-1 min-w-0 px-5 py-4 border-r border-slate-800">Tên Hàng Hóa / Sản phẩm</div>
										<div className="w-20 shrink-0 px-3 py-4 text-center border-r border-slate-800">ĐVT</div>
										<div className="w-20 shrink-0 px-3 py-4 text-center border-r border-slate-800">SL</div>
										<div className="w-32 shrink-0 px-5 py-4 text-right border-r border-slate-800">Đơn Giá</div>
										<div className="w-36 shrink-0 px-5 py-4 text-right">Thành Tiền</div>
									</div>
									
									{groupedItems.map((item: any, idx: number) => {
										const itemImageUrl = item.imageUrl || (products && products.find((p: any) => p.id === item.productId)?.imageUrl);
										return (
											<div key={idx} className="flex items-center border-b border-slate-100">
												{hasImages && (
													<div className="w-16 shrink-0 px-2 py-4 text-center border-r border-slate-100">
														<div className="flex justify-center">
															{itemImageUrl ? (
																<div className="w-12 h-12 rounded-full border border-slate-200 overflow-hidden bg-white shrink-0">
																	<img 
																		src={getTicketImageUrl(itemImageUrl)} 
																		alt={item.name} 
																		className="w-full h-full object-cover rounded-full" 
																		/>
																</div>
															) : (
																<div className="w-12 h-12 rounded-full border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase tracking-tighter">
																	{item.name?.slice(0, 2)}
																</div>
															)}
														</div>
													</div>
												)}
												<div className="flex-1 min-w-0 px-5 py-4 border-r border-slate-100">
													<div className="font-black text-black text-lg uppercase tracking-tight leading-tight whitespace-normal break-words">
														{item.name}
													</div>
													{item.specification && (
														<div className="text-sm text-slate-500 font-bold mt-1">
															Quy cách: {item.specification}
														</div>
													)}
													{item.serialNumber && (
														<div className="text-xs text-slate-400 font-medium mt-1">
															SN: {item.serialNumber}
														</div>
													)}
												</div>
												<div className="w-20 shrink-0 px-3 py-4 text-center border-r border-slate-100 text-slate-800 font-bold text-base uppercase">
													{item.unit || '---'}
												</div>
												<div className="w-20 shrink-0 px-3 py-4 text-center border-r border-slate-100 font-black text-black text-xl">
													{item.qty}
												</div>
												<div className="w-32 shrink-0 px-5 py-4 text-right border-r border-slate-100 text-slate-800 font-bold text-base">
													{formatPrice(item.price)}
												</div>
												<div className="w-36 shrink-0 px-5 py-4 text-right font-black text-black text-lg">
													{formatPrice(item.qty * item.price)}
												</div>
											</div>
										);
									})}
								</div>
							</section>

							{/* Notes & Totals */}
							<section className="px-8 pb-8 flex justify-between items-start gap-6">
								{/* Notes */}
								<div className="flex-1 w-full">
									{order.note && (
										<div className="mt-2 p-5 bg-slate-50 rounded-2xl border border-slate-200 text-left">
											<p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Ghi chú đơn hàng:</p>
											<p className="text-sm font-bold text-slate-900 italic leading-relaxed break-words whitespace-pre-wrap">"{order.note}"</p>
										</div>
									)}
								</div>

								{/* Totals */}
								<div className="w-[350px] space-y-4 shrink-0">
									<div className="flex justify-between items-center text-sm font-bold text-slate-400 gap-4">
										<span className="uppercase tracking-[2px]">Cộng tiền hàng:</span>
										<span className="text-slate-900 text-xl tabular-nums font-extrabold whitespace-nowrap">{formatPrice(order.subTotal || 0)} ₫</span>
									</div>

									{order.discountValue > 0 && (
										<div className="flex justify-between items-center text-red-600 font-bold gap-4">
											<span className="text-xs uppercase tracking-[2px] italic">Chiết khấu giảm (-):</span>
											<span className="text-xl tabular-nums whitespace-nowrap">-{formatPrice(order.discountValue)} ₫</span>
										</div>
									)}

									{order.adjustmentValue > 0 && (
										<div className="flex justify-between items-center text-slate-400 font-bold gap-4">
											<span className="text-xs uppercase tracking-[2px] italic">Phí vận chuyển (+):</span>
											<span className="text-slate-900 text-xl tabular-nums font-extrabold whitespace-nowrap">+{formatPrice(order.adjustmentValue || 0)} ₫</span>
										</div>
									)}

									<div className="border-b border-slate-200 pb-2"></div>

									<div className="flex flex-col items-end pt-2 gap-1 text-right">
										<span className="text-xs font-black text-slate-900 uppercase tracking-[3px]">TỔNG THANH TOÁN:</span>
										<span className="font-black text-black text-5xl tabular-nums tracking-tighter leading-none whitespace-nowrap">{formatPrice(order.totalAmount || 0)} ₫</span>
									</div>
								</div>
							</section>

							{/* Signatures */}
							<footer className="p-6 pb-10 mt-6 bg-slate-50 border-t border-slate-100 flex justify-between items-start text-center">
								<div className="w-1/3">
									<h4 className="font-bold text-xs uppercase text-slate-400 mb-16 tracking-[2px]">Người Lập Phiếu</h4>
									<span className="font-black text-black text-sm uppercase border-t border-dashed border-slate-300 pt-3 px-4">{creatorName}</span>
								</div>
								<div className="w-1/3">
									<h4 className="font-bold text-xs uppercase text-slate-400 mb-20 tracking-[2px]">Người Giao Hàng</h4>
									<div className="mx-auto h-px w-20 bg-slate-200"></div>
								</div>
								<div className="w-1/3">
									<h4 className="font-bold text-xs uppercase text-slate-400 mb-20 tracking-[2px]">Người Nhận Hàng</h4>
									<div className="mx-auto h-px w-20 bg-slate-200"></div>
								</div>
							</footer>
						</main>
					</div>
	);
};

export default TicketPaper;
