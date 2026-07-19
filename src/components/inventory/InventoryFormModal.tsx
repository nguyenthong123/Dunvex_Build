import React from 'react';

interface InventoryFormModalProps {
	show: boolean;
	onClose: () => void;
	isEdit: boolean;
	formData: any;
	setFormData: (data: any) => void;
	onSubmit: (e: React.FormEvent) => void;
	categories: string[];
	units: string[];
	specifications: string[];
	packagings: string[];
	densities: string[];
	uploading: boolean;
	handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
	generateSKU: () => Promise<string>;
	copyToClipboard: (text: string, label: string) => void;
	hasManagePermission: boolean;
	getImageUrl: (url: string) => string;
}

const InventoryFormModal: React.FC<InventoryFormModalProps> = ({
	show,
	onClose,
	isEdit,
	formData,
	setFormData,
	onSubmit,
	categories,
	units,
	specifications,
	packagings,
	densities,
	uploading,
	handleImageUpload,
	generateSKU,
	copyToClipboard,
	hasManagePermission,
	getImageUrl
}) => {
	if (!show) return null;

	return (
		<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md transition-all duration-500" style={{ WebkitBackdropFilter: 'blur(12px)' }}>
			<div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[85vh] border border-white/20 dark:border-slate-800 transition-all duration-300">
				<div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between sticky top-0 z-10 transition-colors duration-300">
					<h3 className="text-xl font-black text-[#1A237E] dark:text-indigo-400">
						{isEdit ? 'Cập Nhật Sản Phẩm' : 'Thêm Sản Phẩm Mới'}
					</h3>
					<button
						onClick={onClose}
						className="size-8 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-colors"
					>
						<span className="material-symbols-outlined">close</span>
					</button>
				</div>

				<form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-left pb-10 custom-scrollbar">
					<div className="space-y-6">
						{/* Image Upload Area */}
						<div className="flex flex-col items-center">
							<div className="relative size-32 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 flex items-center justify-center overflow-hidden group">
								{formData.imageUrl ? (
									<img
										src={getImageUrl(formData.imageUrl)}
										className="size-full object-cover"
										referrerPolicy="no-referrer"
									/>
								) : (
									<div className="text-center p-2">
										<span className="material-symbols-outlined text-gray-300 dark:text-slate-600 text-3xl group-hover:text-[#FF6D00] transition-colors">cloud_upload</span>
										<p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold mt-1 group-hover:text-[#FF6D00] transition-colors">Tải ảnh lên Drive</p>
									</div>
								)}
								{uploading && (
									<div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex items-center justify-center z-10">
										<div className="size-8 border-2 border-[#FF6D00] border-t-transparent rounded-full animate-spin"></div>
									</div>
								)}
								<input
									type="file"
									accept="image/*"
									onChange={handleImageUpload}
									className="absolute inset-0 opacity-0 cursor-pointer z-20"
									disabled={uploading}
								/>
							</div>
							<p className="text-[10px] text-gray-400 dark:text-slate-500 mt-2 italic text-center">
								* Tải ảnh lên Google Drive<br />
								(Tự động lấy link)
							</p>

							{/* Manual Link Input */}
							<div className="w-full mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
								<input
									type="text"
									placeholder="Hoặc dán link ảnh trực tiếp..."
									className="w-full bg-slate-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-lg py-2 px-3 text-xs text-slate-600 dark:text-slate-300 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-orange-500/20"
									onChange={(e) => {
										let url = e.target.value;
										setFormData({ ...formData, imageUrl: getImageUrl(url) });
									}}
								/>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="md:col-span-2">
								<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Tên sản phẩm *</label>
								<input
									required
									type="text"
									placeholder="VD: Tôn lạnh màu xanh ngọc 0.45"
									className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
									value={formData.name}
									onChange={(e) => setFormData({ ...formData, name: e.target.value })}
								/>
							</div>
							<div>
								<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Mã SKU / Code</label>
								<div className="relative">
									<input
										type="text"
										placeholder="Tự động tạo..."
										className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-4 pr-12 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
										value={formData.sku}
										onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
									/>
									<div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
										<button
											type="button"
											className="p-2 rounded-full text-slate-400 hover:text-blue-500 transition-all"
											title="Copy mã SKU"
											onClick={() => copyToClipboard(formData.sku, 'mã SKU')}
										>
											<span className="material-symbols-outlined text-xl">content_copy</span>
										</button>
										<button
											type="button"
											className="p-2 rounded-full text-slate-400 hover:text-orange-500 transition-all"
											title="Tạo mã mới"
											onClick={async () => {
												const newSku = await generateSKU();
												setFormData((prev: any) => ({ ...prev, sku: newSku }));
											}}
										>
											<span className="material-symbols-outlined text-xl">autorenew</span>
										</button>
									</div>
								</div>
							</div>
							<div>
								<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Số Seri (Serial Number)</label>
								<input
									type="text"
									placeholder="Nhập số seri..."
									className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
									value={formData.serialNumber}
									onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
								/>
							</div>
							<div>
								<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Đơn vị tính</label>
								<input
									list="product-units"
									placeholder="Chọn hoặc nhập mới..."
									className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
									value={formData.unit}
									onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
								/>
								<datalist id="product-units">
									{units.map(u => <option key={u} value={u} />)}
								</datalist>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							{hasManagePermission && (
								<div>
									<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Giá nhập</label>
									<input
										type="number"
										className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
										value={formData.priceImport === 0 ? '' : formData.priceImport}
										onChange={(e) => setFormData({ ...formData, priceImport: e.target.value === '' ? 0 : Number(e.target.value) })}
									/>
									<label className="flex items-center gap-2 mt-2 cursor-pointer">
										<input
											type="checkbox"
											checked={formData.applyOverheadCost || false}
											onChange={(e) => setFormData({ ...formData, applyOverheadCost: e.target.checked })}
											className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
										/>
										<span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Áp hệ số chi phí (MB, lương, vận chuyển...)</span>
									</label>
									<label className="flex items-center gap-2 mt-2 cursor-pointer">
										<input
											type="checkbox"
											checked={formData.excludeProfit || false}
											onChange={(e) => setFormData({ ...formData, excludeProfit: e.target.checked })}
											className="w-4 h-4 rounded border-slate-300 text-red-500 focus:ring-red-500"
										/>
										<span className="text-[11px] font-medium text-red-600 dark:text-red-400">🚫 Không tính lợi nhuận (thợ ứng tiền, công nợ...)</span>
									</label>
								</div>
							)}
							<div>
								<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Giá bán</label>
								<input
									type="number"
									className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-blue-600 dark:text-blue-400 font-black focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
									value={formData.priceSell === 0 ? '' : formData.priceSell}
									onChange={(e) => setFormData({ ...formData, priceSell: e.target.value === '' ? 0 : Number(e.target.value) })}
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">
									{isEdit ? 'Tồn kho (Không thể sửa trực tiếp)' : 'Số dư đầu kỳ (Tồn kho)'}
								</label>
								<input
									type="number"
									disabled={isEdit}
									className={`w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 font-bold transition-all outline-none ${isEdit ? 'text-slate-400 cursor-not-allowed opacity-70' : 'text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500'}`}
									value={formData.stock === 0 ? '' : formData.stock}
									onChange={(e) => setFormData({ ...formData, stock: e.target.value === '' ? 0 : Number(e.target.value) })}
								/>
							</div>
							<div>
								<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Danh mục</label>
								<input
									list="product-categories"
									className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
									value={formData.category}
									onChange={(e) => setFormData({ ...formData, category: e.target.value })}
								/>
								<datalist id="product-categories">
									{categories.map(cat => <option key={cat} value={cat} />)}
								</datalist>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Quy cách</label>
								<input
									list="product-specs"
									placeholder="VD: 1.2 x 2.4m"
									className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
									value={formData.specification}
									onChange={(e) => setFormData({ ...formData, specification: e.target.value })}
								/>
								<datalist id="product-specs">
									{specifications.map(s => <option key={s} value={s} />)}
								</datalist>
							</div>
							<div>
								<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Đóng gói</label>
								<input
									list="product-packs"
									placeholder="VD: Kiện 50 tấm"
									className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
									value={formData.packaging}
									onChange={(e) => setFormData({ ...formData, packaging: e.target.value })}
								/>
								<datalist id="product-packs">
									{packagings.map(p => <option key={p} value={p} />)}
								</datalist>
							</div>
							<div>
								<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Trọng lượng</label>
								<input
									list="product-weights"
									placeholder="VD: 25kg/tấm"
									className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
									value={formData.density}
									onChange={(e) => setFormData({ ...formData, density: e.target.value })}
								/>
								<datalist id="product-weights">
									{densities.map(d => <option key={d} value={d} />)}
								</datalist>
							</div>
						</div>

						<div>
							<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Ghi chú sản phẩm</label>
							<textarea
								rows={3}
								placeholder="..."
								className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
								value={formData.note}
								onChange={(e) => setFormData({ ...formData, note: e.target.value })}
							></textarea>
						</div>

						<div>
							<label className="block text-[10px] font-black text-[#FF6D00] uppercase mb-2 tracking-widest flex items-center gap-1">
								<span className="material-symbols-outlined text-[12px]">calendar_month</span> Ngày hết hạn (Tự động xóa)
							</label>
							<input
								type="date"
								className="w-full bg-orange-50/50 dark:bg-slate-800/80 border border-orange-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
								value={formData.expiryDate}
								onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
							/>
						</div>
					</div>

					{/* Action Buttons */}
					<div className="flex gap-4 pt-6 sticky bottom-0 bg-white dark:bg-slate-900">
						<button
							type="button"
							onClick={onClose}
							className="flex-1 py-4 px-6 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-100 dark:border-slate-700"
						>
							Hủy bỏ
						</button>
						<button
							type="submit"
							className="flex-[2] py-4 px-6 bg-[#1A237E] dark:bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all"
						>
							{isEdit ? 'Lưu cập nhật' : 'Thêm sản phẩm'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default InventoryFormModal;
