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
		<div className="fixed inset-0 z-[160] bg-white dark:bg-slate-950 flex flex-col animate-in fade-in duration-200">
			{/* Header */}
			<div className="flex-none flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
				<button onClick={onClose} className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
					<span className="material-symbols-outlined text-2xl">arrow_back</span>
				</button>
				<h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Chi tiết sản phẩm</h2>
				<div className="size-10"></div>
			</div>

			{/* Scrollable content */}
			<div className="flex-1 overflow-y-auto custom-scrollbar">
				<div className="max-w-2xl mx-auto px-5 py-6">
					
					{/* Image + Name / SKU section */}
					<div className="flex items-center gap-4 mb-8">
						<div className="size-20 rounded-2xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 flex items-center justify-center overflow-hidden border border-gray-100 dark:border-slate-800 shadow-inner shrink-0 leading-none">
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
							<p className="text-[10px] font-bold text-[#FF6D00] uppercase tracking-wider mb-1">{selectedProduct.category}</p>
							<h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight mb-2 break-words">{selectedProduct.name}</h3>
							
							<div className="flex flex-wrap items-center gap-2">
								<div 
									className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 cursor-pointer hover:text-blue-500 transition-colors" 
									onClick={() => copyToClipboard(selectedProduct.sku || selectedProduct.id, 'mã SKU')}
								>
									<span className="material-symbols-outlined text-[14px]">qr_code_scanner</span>
									SKU: {selectedProduct.sku || '---'}
								</div>
								{selectedProduct.serialNumber && (
									<>
										<span className="text-slate-300 dark:text-slate-600">•</span>
										<div 
											className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 cursor-pointer hover:text-orange-500 transition-colors" 
											onClick={() => copyToClipboard(selectedProduct.serialNumber, 'số Seri')}
										>
											<span className="material-symbols-outlined text-[14px]">fingerprint</span>
											SN: {selectedProduct.serialNumber}
										</div>
									</>
								)}
							</div>
						</div>
					</div>

					{/* Detail Rows */}
					<div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-12 gap-y-1">
						{/* Price Sell */}
						<div className="flex items-center gap-4 py-4 border-b border-slate-100 dark:border-slate-800/50">
							<span className="material-symbols-outlined text-slate-400">payments</span>
							<div className="flex-1 min-w-0">
								<p className="text-[10px] font-black text-slate-400 uppercase">Giá bán công bố</p>
								<p className="text-base font-bold text-blue-600 dark:text-blue-400">{formatPrice(selectedProduct.priceSell)}</p>
							</div>
						</div>

						{/* Stock */}
						<div className="flex items-center gap-4 py-4 border-b border-slate-100 dark:border-slate-800/50">
							<span className="material-symbols-outlined text-slate-400">inventory_2</span>
							<div className="flex-1 min-w-0">
								<p className="text-[10px] font-black text-slate-400 uppercase">Tồn kho hiện tại</p>
								<p className="text-base font-bold text-[#1A237E] dark:text-indigo-400">
									{groupedStock} <span className="text-sm font-semibold">{selectedProduct.unit}</span>
								</p>
								{skuCount > 1 && (
									<p className="text-[9px] text-slate-400 italic">Tổng gộp từ {skuCount} bản ghi SKU</p>
								)}
							</div>
						</div>

						{hasManagePermission && (
							<>
								{/* Price Import */}
								<div className="flex items-center gap-4 py-4 border-b border-slate-100 dark:border-slate-800/50">
									<span className="material-symbols-outlined text-slate-400">storefront</span>
									<div className="flex-1 min-w-0">
										<p className="text-[10px] font-black text-slate-400 uppercase">Giá nhập kho</p>
										<p className="text-base font-bold text-orange-600 dark:text-orange-400">{formatPrice(selectedProduct.priceImport)}</p>
									</div>
								</div>
								{/* Profit */}
								<div className="flex items-center gap-4 py-4 border-b border-slate-100 dark:border-slate-800/50">
									<span className="material-symbols-outlined text-slate-400">trending_up</span>
									<div className="flex-1 min-w-0">
										<p className="text-[10px] font-black text-slate-400 uppercase">Lợi nhuận ước tính</p>
										<p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(selectedProduct.priceSell - selectedProduct.priceImport)}</p>
									</div>
								</div>
							</>
						)}

						{/* Specification */}
						<div className="flex items-center gap-4 py-4 border-b border-slate-100 dark:border-slate-800/50">
							<span className="material-symbols-outlined text-slate-400">straighten</span>
							<div className="flex-1 min-w-0">
								<p className="text-[10px] font-black text-slate-400 uppercase">Quy cách</p>
								<p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{selectedProduct.specification || '---'}</p>
							</div>
						</div>

						{/* Packaging */}
						<div className="flex items-center gap-4 py-4 border-b border-slate-100 dark:border-slate-800/50">
							<span className="material-symbols-outlined text-slate-400">package_2</span>
							<div className="flex-1 min-w-0">
								<p className="text-[10px] font-black text-slate-400 uppercase">Đóng gói</p>
								<p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{selectedProduct.packaging || '---'}</p>
							</div>
						</div>

						{/* Weight */}
						<div className="flex items-center gap-4 py-4 border-b border-slate-100 dark:border-slate-800/50">
							<span className="material-symbols-outlined text-slate-400">scale</span>
							<div className="flex-1 min-w-0">
								<p className="text-[10px] font-black text-slate-400 uppercase">Trọng lượng</p>
								<p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{selectedProduct.density || '---'}</p>
							</div>
						</div>

						{/* Expiry */}
						<div className="flex items-center gap-4 py-4 border-b border-slate-100 dark:border-slate-800/50">
							<span className="material-symbols-outlined text-slate-400">event_busy</span>
							<div className="flex-1 min-w-0">
								<p className="text-[10px] font-black text-slate-400 uppercase">Ngày hết hạn (Auto-Delete)</p>
								<p className="text-sm font-semibold text-orange-600 dark:text-orange-400">
									{selectedProduct.expiryDate ? new Date(selectedProduct.expiryDate).toLocaleDateString('vi-VN') : 'Không giới hạn'}
								</p>
							</div>
						</div>

						{/* Note */}
						<div className="flex items-start gap-4 py-4 border-b border-slate-100 dark:border-slate-800/50 md:col-span-2">
							<span className="material-symbols-outlined text-slate-400 mt-1">description</span>
							<div className="flex-1 min-w-0">
								<p className="text-[10px] font-black text-slate-400 uppercase mb-1">Mô tả / Ghi chú</p>
								<p className="text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{selectedProduct.note || 'Không có ghi chú'}</p>
							</div>
						</div>

						{/* Created By */}
						<div className="flex items-center gap-4 py-4 border-b border-slate-100 dark:border-slate-800/50 md:col-span-2">
							<span className="material-symbols-outlined text-slate-400">account_circle</span>
							<div className="flex-1 min-w-0">
								<p className="text-[10px] font-black text-slate-400 uppercase">Người tạo</p>
								<p className="text-sm font-semibold text-blue-500 truncate">{selectedProduct.createdByEmail || 'N/A'}</p>
							</div>
						</div>
					</div>

					{/* QR Code Section */}
					<div className="mt-8 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
						<QRCodeCanvas
							ref={qrRef}
							value={selectedProduct.id}
							size={300}
							level="H"
							includeMargin={false}
							className="rounded-xl shadow-sm bg-white p-2"
							style={{ width: 140, height: 140 }}
						/>
						<p className="text-[10px] font-black text-slate-400 uppercase mt-4 tracking-widest">QR ID Sản phẩm</p>
						<button
							onClick={() => printQRLabel(selectedProduct)}
							className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"
						>
							<span className="material-symbols-outlined text-base">print</span>
							In Tem QR
						</button>
					</div>

					{/* Actions */}
					<div className="flex gap-3 pt-8 pb-10">
						<button
							onClick={() => { onClose(); openEdit(selectedProduct); }}
							className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-[0.98]"
						>
							<span className="material-symbols-outlined">edit</span> Chỉnh sửa
						</button>
						<button
							onClick={() => { onClose(); handleDeleteProduct(selectedProduct.id); }}
							className="flex-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all active:scale-[0.98]"
						>
							<span className="material-symbols-outlined">delete</span> Xóa sản phẩm
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default InventoryDetailModal;
