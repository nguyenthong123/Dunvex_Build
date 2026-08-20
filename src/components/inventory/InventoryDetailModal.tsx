import React, { useMemo, useState, useEffect } from 'react';
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
	handleDeleteProduct: (id: string, bypassConfirm?: boolean) => void;
	printQRLabel: (product: any) => void;
	qrRef: React.RefObject<HTMLCanvasElement | null>;
	context?: 'inventory' | 'product';
	inventoryLogs?: any[];
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
	qrRef,
	context = 'product',
	inventoryLogs = []
}) => {
	const [confirmDelete, setConfirmDelete] = useState(false);

	useEffect(() => {
		if (!show) {
			setConfirmDelete(false);
		}
	}, [show]);

	// Inventory-specific: stock logs for this product (Must be declared before early return to obey Rules of Hooks)
	const stockLogs = useMemo(() => {
		if (context !== 'inventory' || !inventoryLogs.length || !selectedProduct) return [];
		return inventoryLogs
			.filter((l: any) => l.productId === selectedProduct.id)
			.sort((a: any, b: any) => new Date(b.timestamp || b.createdAt || 0).getTime() - new Date(a.timestamp || a.createdAt || 0).getTime())
			.slice(0, 15);
	}, [inventoryLogs, selectedProduct?.id, context]);

	if (!show || !selectedProduct) return null;

	const groupedStock = selectedProduct.sku 
		? products.filter(p => p.sku === selectedProduct.sku).reduce((sum, p) => sum + (Number(p.stock) || 0), 0) 
		: selectedProduct.stock;

	const skuCount = selectedProduct.sku 
		? products.filter(p => p.sku === selectedProduct.sku).length 
		: 0;

	const title = context === 'inventory' ? 'Chi tiết tồn kho' : 'Chi tiết sản phẩm';

	const formatDate = (d: any) => {
		if (!d) return '';
		return new Date(d).toLocaleDateString('vi-VN');
	};

	const getLogTypeInfo = (type: string) => {
		switch (type) {
			case 'import': return { icon: 'add_circle', label: 'Nhập kho', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' };
			case 'export': return { icon: 'remove_circle', label: 'Xuất kho', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' };
			case 'adjust': return { icon: 'tune', label: 'Điều chỉnh', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' };
			default: return { icon: 'swap_horiz', label: type || 'Thay đổi', color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800' };
		}
	};

	return (
		<div className="fixed inset-0 z-[160] bg-white dark:bg-slate-950 flex flex-col animate-in fade-in duration-200">
			{/* Header */}
			<div className="flex-none flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
				<button onClick={onClose} className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
					<span className="material-symbols-outlined text-2xl">arrow_back</span>
				</button>
				<h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">{title}</h2>
				<div className="size-10"></div>
			</div>

			{/* Scrollable content */}
			<div className="flex-1 overflow-y-auto custom-scrollbar">
				<div className="max-w-2xl mx-auto px-5 py-6">
					
					{/* Image + Name / SKU section */}
					<div className="flex items-center gap-4 mb-6">
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

					{/* Inventory Context: Stock Summary Card */}
					{context === 'inventory' && (
						<div className="mb-3 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
							<div className="flex items-center gap-3">
								<span className="material-symbols-outlined text-indigo-500">warehouse</span>
								<div>
									<p className="text-[10px] font-black text-slate-400 uppercase">Tồn kho hiện tại</p>
									<p className="text-2xl font-black text-[#1A237E] dark:text-indigo-400">
										{groupedStock} <span className="text-sm font-semibold">{selectedProduct.unit}</span>
									</p>
								</div>
							</div>
							{skuCount > 1 && (
								<p className="text-[9px] text-slate-400 italic mt-2 ml-9">Tổng gộp từ {skuCount} bản ghi SKU</p>
							)}
						</div>
					)}

					{/* Product Info Grid */}
					<div className="grid grid-cols-2 gap-x-4 gap-y-0 mb-6">
						{/* Price Sell */}
						<div className="flex items-center gap-4 py-4 border-b border-slate-100 dark:border-slate-800/50">
							<span className="material-symbols-outlined text-slate-400">payments</span>
							<div className="flex-1 min-w-0">
								<p className="text-[10px] font-black text-slate-400 uppercase">Giá bán công bố</p>
								<p className="text-base font-bold text-blue-600 dark:text-blue-400">{formatPrice(selectedProduct.priceSell)}</p>
							</div>
						</div>

						{/* Stock */}
						{context === 'product' && (
							<div className="flex items-center gap-4 py-4 border-b border-slate-100 dark:border-slate-800/50">
								<span className="material-symbols-outlined text-slate-400">inventory_2</span>
								<div className="flex-1 min-w-0">
									<p className="text-[10px] font-black text-slate-400 uppercase">Tồn kho</p>
									<p className="text-base font-bold text-[#1A237E] dark:text-indigo-400">
										{groupedStock} <span className="text-sm font-semibold">{selectedProduct.unit}</span>
									</p>
								</div>
							</div>
						)}

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
								<p className="text-[10px] font-black text-slate-400 uppercase">Ngày hết hạn</p>
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
						{context === 'product' && (
							<div className="flex items-center gap-4 py-4 border-b border-slate-100 dark:border-slate-800/50 md:col-span-2">
								<span className="material-symbols-outlined text-slate-400">account_circle</span>
								<div className="flex-1 min-w-0">
									<p className="text-[10px] font-black text-slate-400 uppercase">Người tạo</p>
									<p className="text-sm font-semibold text-blue-500 truncate">{selectedProduct.createdByEmail || 'N/A'}</p>
								</div>
							</div>
						)}
					</div>

					{/* Inventory Context: Stock History */}
					{context === 'inventory' && stockLogs.length > 0 && (
						<div className="mb-6">
							<h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
								<span className="material-symbols-outlined text-sm">history</span>
								Lịch sử biến động kho ({stockLogs.length} gần nhất)
							</h3>
							<div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
								{stockLogs.map((log: any, i: number) => {
									const typeInfo = getLogTypeInfo(log.type);
									return (
										<div key={log.id || i} className={`flex items-center gap-3 px-4 py-3 ${i < stockLogs.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}>
											<div className={`size-8 rounded-lg ${typeInfo.bg} flex items-center justify-center shrink-0`}>
												<span className={`material-symbols-outlined text-sm ${typeInfo.color}`}>{typeInfo.icon}</span>
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-center justify-between">
													<span className="text-xs font-bold text-slate-700 dark:text-slate-300">{typeInfo.label}</span>
													<span className={`text-xs font-black ${log.qty > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
														{log.qty > 0 ? '+' : ''}{log.qty || 0} {selectedProduct.unit}
													</span>
												</div>
												<div className="flex items-center justify-between mt-0.5">
													<span className="text-[9px] text-slate-400">{log.note || log.reason || ''}</span>
													<span className="text-[9px] text-slate-400">{formatDate(log.timestamp || log.createdAt)}</span>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					)}

					{/* QR Code Section - Product context only */}
					{context === 'product' && (
						<div className="mt-4 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
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
					)}

					{/* Actions — Product context only */}
					{context === 'product' && (
					<div className="flex gap-3 pt-8 pb-10 items-center">
						{confirmDelete ? (
							<div className="flex-1 flex gap-2 items-center bg-rose-50 dark:bg-rose-900/20 p-2.5 rounded-2xl border border-rose-100 dark:border-rose-900/30 animate-in fade-in zoom-in duration-200">
								<span className="text-[10px] sm:text-xs font-black text-rose-600 dark:text-rose-400 uppercase flex-1 leading-snug">
									Xác nhận xóa sản phẩm này?
								</span>
								<button 
									onClick={() => setConfirmDelete(false)} 
									className="px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
								>
									Hủy
								</button>
								<button 
									onClick={() => {
										setConfirmDelete(false);
										onClose();
										handleDeleteProduct(selectedProduct.id, true);
									}} 
									className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md"
								>
									Xóa
								</button>
							</div>
						) : (
							<>
								<button
									onClick={() => openEdit(selectedProduct)}
									className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-[0.98]"
								>
									<span className="material-symbols-outlined">edit</span> Chỉnh sửa
								</button>
								<button
									onClick={() => setConfirmDelete(true)}
									className="flex-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all active:scale-[0.98]"
								>
									<span className="material-symbols-outlined">delete</span> Xóa sản phẩm
								</button>
							</>
						)}
					</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default InventoryDetailModal;
