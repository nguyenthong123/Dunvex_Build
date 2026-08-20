import { Building2 } from 'lucide-react';
import { formatDate, formatPrice, getTicketImageUrl, computeTotalPackages, groupOrderItems } from './ticketUtils';

interface TicketBillProps {
	order: any;
	products?: any[];
	companyInfo: any;
	creatorName: string;
}

const TicketBill: React.FC<TicketBillProps> = ({ order, products, companyInfo, creatorName }) => {
	const groupedItems = groupOrderItems(order.items);
	return (
					<div
						id="order-ticket-bill"
						className="bg-white shadow-2xl relative border border-slate-200 text-black font-sans mx-auto"
						style={{
							width: '100%',
							padding: '24px',
							boxSizing: 'border-box'
						}}
					>
						<main className="bg-white text-black text-sm">
							{/* Company Header - Logo horizontally next to dealer name */}
							<div className="flex items-center gap-3.5 mb-3.5">
								{companyInfo?.logoUrl ? (
									<div className="w-12 h-12 rounded-full border border-slate-200 overflow-hidden bg-white shrink-0 shadow-sm">
										<img src={getTicketImageUrl(companyInfo.logoUrl)} alt="Logo" className="w-full h-full object-cover" />
									</div>
								) : (
									<div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm">
										<Building2 size={22} />
									</div>
								)}
								<div className="text-left flex-1 min-w-0">
									<h2 className="text-lg font-black uppercase leading-tight tracking-tight text-black break-words">
										{companyInfo?.name || 'DUNVEX'}
									</h2>
									<div className="text-[11px] text-slate-600 font-semibold leading-normal flex flex-col gap-0.5 mt-0.5">
										<p className="break-words">{companyInfo?.address || 'XÃ KIẾN ĐỨC , LÂM ĐỒNG'}</p>
										<p>SĐT: {order.createdByPhone && order.createdByPhone.trim() ? order.createdByPhone : (companyInfo?.phone || '0988765444')}</p>
									</div>
								</div>
							</div>

							{/* Bill Title */}
							<div className="text-center border-t border-b border-dashed border-slate-400 py-2 my-3">
								<h1 className="text-base font-black uppercase tracking-wider">PHIẾU GIAO HÀNG</h1>
								<p className="text-[10px] text-slate-500 font-bold mt-0.5">#{order.id?.slice(0, 8).toUpperCase()}</p>
							</div>

							{/* Bill Metadata - dùng flex để fill đúng 100% bề rộng (tránh table bị co khi export) */}
							<div className="text-xs text-slate-800 font-semibold mb-4 leading-normal">
								<div className="flex items-start gap-3" style={{ marginBottom: '6px' }}>
									<span className="text-slate-500 whitespace-nowrap shrink-0 w-[120px]">Ngày lập:</span>
									<span className="flex-1 text-right">{formatDate(order.orderDate || order.createdAt)}</span>
								</div>
								<div className="flex items-start gap-3" style={{ marginBottom: '6px' }}>
									<span className="text-slate-500 whitespace-nowrap shrink-0 w-[120px]">Khách hàng:</span>
									<span className="flex-1 font-bold text-black uppercase text-right">{order.customerBusinessName || order.customerName || 'Khách vãng lai'}</span>
								</div>
								<div className="flex items-start gap-3" style={{ marginBottom: '6px' }}>
									<span className="text-slate-500 whitespace-nowrap shrink-0 w-[120px]">Số điện thoại:</span>
									<span className="flex-1 text-right">{order.customerPhone || '---'}</span>
								</div>
								<div className="flex items-start gap-3" style={{ marginBottom: '6px' }}>
									<span className="text-slate-500 whitespace-nowrap shrink-0 w-[120px]">Người lập phiếu:</span>
									<span className="flex-1 text-right">{creatorName}</span>
								</div>
								<div className="flex items-start gap-3" style={{ marginBottom: '6px' }}>
									<span className="text-slate-500 whitespace-nowrap shrink-0 w-[120px]">Số kiện hàng:</span>
									<span className="flex-1 text-right">{computeTotalPackages(order)}</span>
								</div>
								<div className="flex items-start gap-3">
									<span className="text-slate-500 whitespace-nowrap shrink-0 w-[120px]">Trọng tải:</span>
									<span className="flex-1 text-right">{order.totalWeight ? formatPrice(order.totalWeight) : 0} kg</span>
								</div>
							</div>

							{/* Items Header */}
							<div className="border-t border-dashed border-slate-400 pt-2 font-bold text-xs text-slate-500 flex justify-between uppercase gap-4">
								<span className="whitespace-nowrap">Tên sản phẩm / Chi tiết</span>
								<span className="whitespace-nowrap">Thành tiền</span>
							</div>

							{/* Items List */}
							<div className="divide-y divide-dashed divide-slate-200 mt-1">
								{groupedItems.map((item: any, idx: number) => {
									const itemImageUrl = item.imageUrl || (products && products.find((p: any) => p.id === item.productId)?.imageUrl);
									return (
										<div key={idx} className="py-2.5 space-y-1">
											<div className="flex items-start gap-2">
												<span className="shrink-0 pt-0.5 font-extrabold text-black text-sm">{idx + 1}.</span>
												{itemImageUrl && (
													<div className="w-8 h-8 rounded-full border border-slate-200 overflow-hidden bg-white shrink-0 shadow-sm">
														<img 
															src={getTicketImageUrl(itemImageUrl)} 
															alt={item.name} 
															className="w-full h-full object-cover"
														/>
													</div>
												)}
												<div className="flex-1 min-w-0 flex flex-col gap-0.5">
													<span className="font-extrabold text-black uppercase leading-snug text-sm break-words">
														{item.name}
													</span>
													{item.specification && (
														<span className="text-[11px] text-slate-500 font-bold leading-normal">
															Quy cách: {item.specification}
														</span>
													)}
													{item.serialNumber && (
														<span className="text-[11px] text-amber-600 font-bold leading-normal">
															SN: {item.serialNumber}
														</span>
													)}
												</div>
											</div>
											<div className="flex justify-between items-center text-xs font-bold text-slate-700 pl-6 pt-0.5">
												<span className="whitespace-nowrap">
													SL: <strong className="text-black text-sm">{item.qty}</strong> {item.unit || '---'} x {formatPrice(item.price)}
												</span>
												<span className="text-black text-sm font-black whitespace-nowrap">
													{formatPrice(item.qty * item.price)}
												</span>
											</div>
										</div>
									);
								})}
							</div>

							{/* Note if exists */}
							{order.note && (
								<div className="border-t border-dashed border-slate-400 py-3 text-xs">
									<p className="font-bold text-slate-400 uppercase tracking-wider mb-1">Ghi chú đơn hàng:</p>
									<p className="font-medium text-slate-800 italic leading-relaxed">"{order.note}"</p>
								</div>
							)}

							{/* Totals Section - dùng margin inline thay [&>*+*] để chắc chắn không đè chữ */}
							<div className="border-t border-dashed border-slate-400 pt-3 text-xs font-bold text-slate-700 space-y-2">
								<div className="flex justify-between items-center gap-4">
									<span className="shrink-0 whitespace-nowrap">Cộng tiền hàng:</span>
									<span className="text-black whitespace-nowrap">{formatPrice(order.subTotal || 0)} ₫</span>
								</div>

								{order.discountValue > 0 && (
									<div className="flex justify-between items-center gap-4 text-red-600">
										<span className="shrink-0 whitespace-nowrap">Chiết khấu giảm (-):</span>
										<span className="whitespace-nowrap">-{formatPrice(order.discountValue)} ₫</span>
									</div>
								)}

								{order.adjustmentValue > 0 && (
									<div className="flex justify-between items-center gap-4">
										<span className="shrink-0 whitespace-nowrap">Phí vận chuyển (+):</span>
										<span className="text-black whitespace-nowrap">+{formatPrice(order.adjustmentValue || 0)} ₫</span>
									</div>
								)}

								<div className="border-t border-slate-950 pt-3 flex justify-between items-center font-black text-base text-black uppercase gap-4" style={{ marginTop: '14px' }}>
									<span className="shrink-0 whitespace-nowrap">Tổng thanh toán:</span>
									<span className="text-lg whitespace-nowrap">{formatPrice(order.totalAmount || 0)} ₫</span>
								</div>
							</div>

							{/* Signatures for Receipt */}
							<div className="border-t border-dashed border-slate-400 mt-6 pt-4 grid grid-cols-2 gap-4 text-center text-[10px] font-bold text-slate-500 uppercase leading-normal">
								<div>
									<p className="mb-10">Người lập phiếu</p>
									<span className="text-black font-extrabold">{creatorName}</span>
								</div>
								<div>
									<p className="mb-10">Người nhận hàng</p>
									<div className="mx-auto h-px w-16 bg-slate-300"></div>
								</div>
							</div>

							<div className="text-center text-[10px] text-slate-400 font-bold mt-8 italic leading-snug">
								Cảm ơn quý khách đã tin tưởng Dunvex Build!
							</div>
						</main>
					</div>
	);
};

export default TicketBill;
