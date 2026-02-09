import React from 'react';
import { FileText, Download, Share2 } from 'lucide-react';

interface OrderTicketProps {
	order: any;
	onClose: () => void;
}

const OrderTicket: React.FC<OrderTicketProps> = ({ order, onClose }) => {
	const [scale, setScale] = React.useState(1);

	React.useEffect(() => {
		const handleResize = () => {
			if (window.innerWidth < 800) {
				const s = (window.innerWidth - 20) / 800;
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
		window.print();
	};

	return (
		<div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center overflow-y-auto pt-20 pb-10 custom-scrollbar">
			<style>
				{`
					@media print {
						.no-print { display: none !important; }
						body { background: white !important; padding: 0 !important; margin: 0 !important; }
						.print-scale { transform: scale(1) !important; transform-origin: top center !important; margin: 0 !important; width: 100% !important; }
						.fixed { position: relative !important; }
						.inset-0 { position: relative !important; background: white !important; }
						.overflow-y-auto { overflow: visible !important; }
					}
				`}
			</style>

			{/* CONTROLS - Hidden when printing */}
			<div className="fixed top-4 right-4 flex gap-3 z-[110] no-print">
				<button
					onClick={handlePrint}
					className="h-12 px-6 rounded-full bg-[#f27121] text-white flex items-center justify-center backdrop-blur-md border border-orange-500/30 shadow-xl shadow-orange-500/20 transition-all font-black text-xs uppercase tracking-widest active:scale-95 hover:bg-orange-600 gap-2"
				>
					<span className="material-symbols-outlined text-lg">print</span>
					In phiếu
				</button>
				<button
					onClick={onClose}
					className="h-12 px-6 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all font-bold text-sm uppercase tracking-widest active:scale-95"
				>
					Đóng
				</button>
			</div>

			{/* Wrapper for scaling */}
			<div
				style={{
					width: '800px',
					transform: `scale(${scale})`,
					transformOrigin: 'top center',
					marginBottom: scale < 1 ? `-${(1 - scale) * 1100}px` : '0'
				}}
				className="flex-shrink-0 print-scale"
			>
				<div className="bg-white shadow-2xl overflow-hidden relative border border-gray-200">
					<main className="bg-white text-gray-900 font-sans antialiased">
						<header className="p-10 border-b border-gray-100">
							<h1 className="text-4xl font-black text-center text-gray-900 uppercase mb-6 tracking-[4px]">
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
									<span className="text-slate-900">{order.totalItems || 0}</span>
								</div>
								<div className="flex items-center">
									<span className="text-gray-400 mr-2 uppercase text-[10px] tracking-widest">TL tải:</span>
									<span className="text-[#f27121]">{order.totalWeight ? formatPrice(order.totalWeight) : 0} kg</span>
								</div>
							</div>
						</header>

						<section className="px-10 py-8 grid grid-cols-2 gap-10">
							<div className="space-y-4">
								<div className="flex flex-col">
									<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Khách hàng</span>
									<span className="font-black text-gray-900 text-xl uppercase leading-tight tracking-tight">{order.customerName || 'Khách vãng lai'}</span>
								</div>
								<div className="flex flex-col">
									<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Địa chỉ giao hàng</span>
									<span className="text-gray-600 font-bold italic leading-relaxed">{order.deliveryAddress || '---'}</span>
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

						<section className="px-10 pb-8">
							<div className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
								<table className="w-full text-left text-sm border-collapse">
									<thead className="bg-[#1c130d] text-white uppercase font-black text-[10px] tracking-widest">
										<tr>
											<th className="px-5 py-4 text-center w-14 border-r border-white/10">STT</th>
											<th className="px-5 py-4 border-r border-white/10">Tên Hàng Hóa / Sản phẩm</th>
											<th className="px-5 py-4 text-center border-r border-white/10 w-20">ĐVT</th>
											<th className="px-5 py-4 text-center border-r border-white/10 w-20">SL</th>
											<th className="px-5 py-4 text-center border-r border-white/10 w-24">KG</th>
											<th className="px-5 py-4 text-right border-r border-white/10">Đơn Giá</th>
											<th className="px-5 py-4 text-right">Thành Tiền</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-100">
										{order.items?.map((item: any, idx: number) => (
											<tr key={idx} className="hover:bg-gray-50/50 transition-colors">
												<td className="px-5 py-4 text-center border-r border-gray-50 font-bold text-gray-400 text-xs">{idx + 1}</td>
												<td className="px-5 py-4 border-r border-gray-50 font-black text-[#1A237E] uppercase tracking-tight">{item.name}</td>
												<td className="px-5 py-4 text-center border-r border-gray-50 text-gray-500 font-bold text-xs uppercase">{item.unit || '---'}</td>
												<td className="px-5 py-4 text-center border-r border-gray-50 font-black text-gray-900 text-base">{item.qty}</td>
												<td className="px-5 py-4 text-center border-r border-gray-50 text-gray-500 font-bold text-xs italic">{(item.qty * (parseFloat(item.density) || 0)).toFixed(2)}</td>
												<td className="px-5 py-4 text-right border-r border-gray-50 text-gray-600 font-bold">{formatPrice(item.price)}</td>
												<td className="px-5 py-4 text-right font-black text-gray-900 text-base">{formatPrice(item.qty * item.price)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</section>

						<section className="px-10 pb-10 flex flex-col items-end">
							<div className="w-[400px] space-y-4">
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
								<div className="flex justify-between items-center border-b border-gray-200 pb-4 text-gray-400 font-bold">
									<span className="text-[10px] uppercase tracking-[2px] italic">Phí vận chuyển (+):</span>
									<span className="text-gray-800 text-lg tabular-nums">+{formatPrice(order.adjustmentValue || 0)} ₫</span>
								</div>
								<div className="flex flex-col items-end pt-2 gap-1 text-right">
									<span className="text-xs font-black text-gray-900 uppercase tracking-[3px]">TỔNG THANH TOÁN:</span>
									<span className="font-black text-[#f27121] text-4xl tabular-nums tracking-tighter leading-none">{formatPrice(order.totalAmount || 0)} ₫</span>
								</div>
								{order.note && (
									<div className="mt-6 p-5 bg-orange-50 rounded-2xl border border-orange-100/50 text-left">
										<p className="text-[10px] font-black text-[#9c6949] uppercase tracking-widest mb-2">Ghi chú đơn hàng:</p>
										<p className="text-sm font-bold text-[#1c130d] italic leading-relaxed">"{order.note}"</p>
									</div>
								)}
							</div>
						</section>

						<footer className="p-10 pb-20 mt-10 bg-gray-50/50 border-t border-gray-100 flex justify-between items-start text-center">
							<div className="w-1/3">
								<h4 className="font-black text-[10px] uppercase text-gray-400 mb-24 tracking-[2px]">Người Lập Phiếu</h4>
								<span className="font-black text-[#1A237E] text-xs uppercase border-t border-dashed border-gray-300 pt-4 px-6">{order.createdByEmail?.split('@')[0]}</span>
							</div>
							<div className="w-1/3">
								<h4 className="font-black text-[10px] uppercase text-gray-400 mb-32 tracking-[2px]">Người Giao Hàng</h4>
								<div className="mx-auto h-px w-24 bg-gray-200"></div>
							</div>
							<div className="w-1/3">
								<h4 className="font-black text-[10px] uppercase text-gray-400 mb-32 tracking-[2px]">Người Nhận Hàng</h4>
								<div className="mx-auto h-px w-24 bg-gray-200"></div>
							</div>
						</footer>
					</main>
				</div>
			</div>
		</div>
	);
};

export default OrderTicket;
