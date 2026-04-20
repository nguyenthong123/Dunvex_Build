import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';

interface InventoryDetailModalProps {
	show: boolean;
	onClose: () => void;
	selectedProduct: any;
	products: any[];
	hasManagePermission: boolean;
	formatPrice: (price: number) => string;
	getImageUrl: (url: string) => string;
	copyToClipboard: (text: string, label: string) => void;
	openEdit: (product: any) => void;
	handleDeleteProduct: (id: string) => void;
	printQRLabel: (product: any) => void;
	qrRef: React.RefObject<HTMLCanvasElement | null>;
}

const InventoryDetailModal: React.FC<InventoryDetailModalProps> = ({
	show,
	onClose,
	selectedProduct,
	products,
	hasManagePermission,
	formatPrice,
	getImageUrl,
	copyToClipboard,
	openEdit,
	handleDeleteProduct,
	printQRLabel,
	qrRef
}) => {
	if (!show || !selectedProduct) return null;

	const groupedStock = selectedProduct.sku 
		? products.filter(p => p.sku === selectedProduct.sku).reduce((sum, p) => sum + (Number(p.stock) || 0), 0) 
		: selectedProduct.stock;

	const skuCount = selectedProduct.sku 
		? products.filter(p => p.sku === selectedProduct.sku).length 
		: 0;

	return (
		<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#1A237E]/80 dark:bg-black/80 backdrop-blur-sm">
			<div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[85vh] transition-colors duration-300">
				<div className="px-6 py-4 bg-[#1A237E] dark:bg-indigo-900 text-white flex items-center justify-between sticky top-0 z-10">
					<h3 className="text-xl font-black">Chi Tiết Sản Phẩm</h3>
					<button onClick={onClose} className="size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
						<span className="material-symbols-outlined">close</span>
					</button>
				</div>

				<div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
					<div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
						<div className="size-24 rounded-2xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 flex items-center justify-center overflow-hidden border border-gray-100 dark:border-slate-700 shadow-inner shrink-0 leading-none">
							{selectedProduct.imageUrl ? (
								<img
									src={getImageUrl(selectedProduct.imageUrl)}
									alt={selectedProduct.name}
									className="size-full object-cover"
									referrerPolicy="no-referrer"
								/>
							) : (
								<span className="material-symbols-outlined text-4xl">inventory_2</span>
							)}
						</div>
						<div className="flex-1 min-w-0">
							<p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">{selectedProduct.category}</p>
							<h2 className="text-xl font-black text-[#1A237E] dark:text-indigo-400 leading-tight break-words">{selectedProduct.name}</h2>
							<div className="flex flex-wrap items-center gap-2 mt-2">
								<div
									className="flex items-center gap-2 cursor-pointer group/copy bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700"
									onClick={() => copyToClipboard(selectedProduct.sku || selectedProduct.id, 'mã SKU')}
									title="Copy mã SKU"
								>
									<p className="text-xs font-bold text-slate-500 dark:text-slate-400">SKU: {selectedProduct.sku || '---'}</p>
									{(selectedProduct.sku || selectedProduct.id) && (
										<span className="material-symbols-outlined text-[14px] text-gray-300 group-hover/copy:text-blue-500 transition-colors">content_copy</span>
									)}
								</div>
								{selectedProduct.serialNumber && (
									<div
										className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/30 px-2 py-1 rounded-lg border border-orange-100 dark:border-orange-800/50 cursor-pointer group/copy hover:bg-orange-100/50 transition-all active:scale-95"
										onClick={() => copyToClipboard(selectedProduct.serialNumber, 'số Seri')}
										title="Copy số Seri"
									>
										<span className="material-symbols-outlined text-[14px] text-orange-500">fingerprint</span>
										<span className="text-xs font-bold text-orange-600 dark:text-orange-300">SN: {selectedProduct.serialNumber}</span>
										<span className="material-symbols-outlined text-[12px] text-orange-400 opacity-0 group-hover/copy:opacity-100 transition-opacity">content_copy</span>
									</div>
								)}
								<div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg border border-indigo-100 dark:border-indigo-800/50">
									<span className="material-symbols-outlined text-[14px] text-indigo-500">category</span>
									<span className="text-xs font-bold text-indigo-600 dark:text-indigo-300">{selectedProduct.category}</span>
								</div>
							</div>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
							<p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Giá bán công bố</p>
							<p className="text-blue-600 dark:text-blue-400 font-black text-lg">{formatPrice(selectedProduct.priceSell)}</p>
						</div>
						<div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
							<p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Tồn kho hiện tại</p>
							<p className="text-[#1A237E] dark:text-indigo-400 font-black text-lg">
								{groupedStock}
								<span className="text-xs"> {selectedProduct.unit}</span>
							</p>
							{skuCount > 1 && (
								<p className="text-[9px] text-slate-400 italic">Tổng gộp từ {skuCount} bản ghi SKU</p>
							)}
						</div>
					</div>

					{hasManagePermission && (
						<div className="grid grid-cols-2 gap-4">
							<div className="bg-orange-50 dark:bg-slate-800 p-4 rounded-2xl border border-orange-100 dark:border-orange-500/20">
								<p className="text-[10px] font-bold text-orange-500 uppercase mb-1">Giá nhập kho</p>
								<p className="text-orange-600 dark:text-orange-400 font-black text-xl">{formatPrice(selectedProduct.priceImport)}</p>
							</div>
							<div className="bg-emerald-50 dark:bg-slate-800 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
								<p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase mb-1">Lợi nhuận ước tính</p>
								<p className="text-emerald-600 dark:text-emerald-400 font-black text-xl">{formatPrice(selectedProduct.priceSell - selectedProduct.priceImport)}</p>
							</div>
						</div>
					)}

					<div className="grid grid-cols-2 gap-3">
						<div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
							<p className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Quy cách</p>
							<p className="text-xs font-black text-[#1A237E] dark:text-indigo-300">{selectedProduct.specification || '---'}</p>
						</div>
						<div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
							<p className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Đóng gói</p>
							<p className="text-xs font-black text-[#1A237E] dark:text-indigo-300">{selectedProduct.packaging || '---'}</p>
						</div>
						<div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
							<p className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Trọng lượng</p>
							<p className="text-xs font-black text-[#1A237E] dark:text-indigo-300">{selectedProduct.density || '---'}</p>
						</div>
						<div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
							<p className="text-[9px] font-bold text-orange-500 uppercase mb-1">Ngày hết hạn (Auto-Delete)</p>
							<p className="text-xs font-black text-orange-600 dark:text-orange-400">
								{selectedProduct.expiryDate ? new Date(selectedProduct.expiryDate).toLocaleDateString('vi-VN') : 'Không giới hạn'}
							</p>
						</div>
					</div>

					<div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6">
						<div className="flex-1">
							<p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Mô tả / Ghi chú</p>
							<p className="text-slate-600 dark:text-slate-300 italic whitespace-pre-wrap">{selectedProduct.note || 'Không có ghi chú'}</p>
							<div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
								<p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Người tạo</p>
								<p className="text-[10px] text-blue-500 font-bold truncate max-w-[200px]">{selectedProduct.createdByEmail || 'N/A'}</p>
							</div>
						</div>
						<div className="flex flex-col items-center p-4 bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700 shrink-0">
							<QRCodeCanvas
								ref={qrRef}
								value={selectedProduct.id}
								size={300}
								level="H"
								includeMargin={false}
								className="rounded-lg"
								style={{ width: 120, height: 120 }}
							/>
							<p className="text-[9px] font-black text-slate-400 uppercase mt-3 tracking-widest">QR ID Sản phẩm</p>
							<button
								onClick={() => printQRLabel(selectedProduct)}
								className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg text-[10px] font-black uppercase hover:bg-orange-100 transition-all border border-orange-100 dark:border-orange-800"
							>
								<span className="material-symbols-outlined text-sm">print</span>
								In Tem QR
							</button>
						</div>
					</div>

					<div className="flex gap-3 pt-2 pb-6">
						<button
							onClick={() => { onClose(); openEdit(selectedProduct); }}
							className="flex-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
						>
							<span className="material-symbols-outlined text-lg">edit</span> Chỉnh sửa
						</button>
						<button
							onClick={() => { onClose(); handleDeleteProduct(selectedProduct.id); }}
							className="flex-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
						>
							<span className="material-symbols-outlined text-lg">delete</span> Xóa sản phẩm
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default InventoryDetailModal;
