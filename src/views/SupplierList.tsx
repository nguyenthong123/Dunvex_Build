import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Plus, Search, MapPin, Phone, Trash, X, FileText, ArrowLeft, PenSquare, QrCode, Building2, CreditCard, User } from 'lucide-react';
import { useOwner } from '../hooks/useOwner';
import { useSuppliers } from '../hooks/useSuppliers';
import { useToast } from '../components/shared/Toast';
import { BANK_LIST } from '../data/banks';
import SupplierQRModal from '../components/supplier/SupplierQRModal';

const SupplierList = () => {
	const navigate = useNavigate();
	const owner = useOwner();
	const { showToast } = useToast();
	const { suppliers, loading, addSupplier, updateSupplier, deleteSupplier } = useSuppliers();

	const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem('suppliers_searchTerm') || '');
	const [showMobileSearch, setShowMobileSearch] = useState(false);

	useEffect(() => {
		sessionStorage.setItem('suppliers_searchTerm', searchTerm);
	}, [searchTerm]);
	const searchInputRef = useRef<HTMLInputElement>(null);

	const [showAddForm, setShowAddForm] = useState(false);
	const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

	const [formData, setFormData] = useState({
		name: '',
		phone: '',
		address: '',
		category: 'Sắt Thép',
		note: '',
		bankName: '',
		bankAccount: '',
		bankHolder: '',
	});

	const [qrModalSupplier, setQrModalSupplier] = useState<any>(null);

	const categories = ['Sắt Thép', 'Xi Măng', 'Sơn', 'Gạch Ốp Lát', 'Thiết Bị Vệ Sinh', 'Khác'];

	useEffect(() => {
		const handleOpenSearch = () => {
			setShowMobileSearch(true);
			setTimeout(() => searchInputRef.current?.focus(), 200);
		};
		window.addEventListener('open-mobile-search', handleOpenSearch);
		return () => window.removeEventListener('open-mobile-search', handleOpenSearch);
	}, []);

	useEffect(() => {
		const handleOpenAdd = () => {
			setSelectedSupplier(null);
			setFormData({ name: '', phone: '', address: '', category: 'Sắt Thép', note: '', bankName: '', bankAccount: '', bankHolder: '' });
			setShowAddForm(true);
		};
		window.addEventListener('open-mobile-add', handleOpenAdd);
		return () => window.removeEventListener('open-mobile-add', handleOpenAdd);
	}, []);

	const normalizeText = (text: any) => text ? String(text).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase() : '';
	const removeAccents = (str: any) => {
		return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
	};
	const isMatch = (target: string, query: string) => {
		if (!query) return true;
		const t = normalizeText(target);
		const q = normalizeText(query);
		return t.includes(q) || removeAccents(t).includes(removeAccents(q));
	};

	const filteredSuppliers = suppliers.filter(s => isMatch(s.name, searchTerm) || isMatch(s.phone, searchTerm));

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!formData.name.trim()) return showToast("Vui lòng nhập tên nhà cung cấp", "error");

		try {
			if (selectedSupplier) {
				await updateSupplier(selectedSupplier.id, formData);
				showToast("Cập nhật thành công", "success");
			} else {
				await addSupplier(formData);
				showToast("Thêm nhà cung cấp thành công", "success");
			}
			setShowAddForm(false);
		} catch (error) {
			console.error("Lỗi:", error);
			showToast("Có lỗi xảy ra, vui lòng thử lại", "error");
		}
	};

	const handleDelete = async (id: string) => {
		const supplier = suppliers.find(s => s.id === id);
		if (supplier && (supplier.totalDebt || 0) > 0) {
			showToast("Không thể xoá nhà cung cấp đang có công nợ", "error");
			setDeleteConfirmId(null);
			return;
		}

		try {
			await deleteSupplier(id);
			showToast("Đã xoá nhà cung cấp", "success");
			setDeleteConfirmId(null);
		} catch (error) {
			showToast("Không thể xoá", "error");
		}
	};

	const openEdit = (supplier: any) => {
		setSelectedSupplier(supplier);
		setFormData({
			name: supplier.name || '',
			phone: supplier.phone || '',
			address: supplier.address || '',
			category: supplier.category || 'Sắt Thép',
			note: supplier.note || '',
			bankName: supplier.bankName || '',
			bankAccount: supplier.bankAccount || '',
			bankHolder: supplier.bankHolder || '',
		});
		setShowAddForm(true);
	};

	if (loading) {
		return (
			<div className="flex justify-center items-center h-64">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1A237E]"></div>
			</div>
		);
	}

	return (
		<div className="h-full flex flex-col relative">
			{/* Header */}
			<div className="sticky top-0 z-40 bg-[#f8f9fa] dark:bg-slate-950 pb-4">
				<div className="flex flex-col gap-4">
					<div className="flex items-center justify-between">
						<h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3">
							<span className="material-symbols-outlined text-[#1A237E] dark:text-[#FF6D00] text-3xl">storefront</span>
							Nhà Cung Cấp
						</h1>
						<div className="flex items-center gap-2">
							<button onClick={() => setShowMobileSearch(!showMobileSearch)} className="lg:hidden p-2 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
								<Search size={20} />
							</button>
							<button onClick={() => { setSelectedSupplier(null); setFormData({ name: '', phone: '', address: '', category: 'Sắt Thép', note: '', bankName: '', bankAccount: '', bankHolder: '' }); setShowAddForm(true); }} className="hidden lg:flex items-center gap-2 px-4 py-2.5 bg-[#FF6D00] text-white font-bold rounded-xl shadow-lg shadow-orange-500/30 hover:scale-105 active:scale-95 transition-all">
								<Plus size={20} /> Thêm NCC
							</button>
						</div>
					</div>

					<div className={`transition-all duration-300 ${showMobileSearch ? 'block' : 'hidden lg:block'}`}>
						<div className="relative">
							<Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
							<input
								ref={searchInputRef}
								type="text"
								placeholder="Tìm tên, số điện thoại..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="w-full h-12 pl-12 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#FF6D00] outline-none text-sm font-medium dark:text-white transition-all"
							/>
							{searchTerm && (
								<button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
									<X size={16} />
								</button>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Supplier Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-24 mt-4">
				{filteredSuppliers.map((supplier) => (
					<div key={supplier.id} onClick={() => openEdit(supplier)} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md hover:border-[#FF6D00]/30 transition-all cursor-pointer relative group">
						<div className="flex justify-between items-start mb-3">
							<div className="flex-1 min-w-0 pr-4">
								<h3 className="font-bold text-slate-800 dark:text-white text-lg truncate flex items-center gap-2">
									{supplier.name}
								</h3>
								<div className="flex items-center gap-2 mt-1">
									<span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
										{supplier.category || 'Chưa phân loại'}
									</span>
									{supplier.bankAccount && (
										<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
											<QrCode size={10} /> QR
										</span>
									)}
								</div>
							</div>
							<div className="flex gap-2">
								{supplier.bankAccount && (
									<button onClick={(e) => { e.stopPropagation(); setQrModalSupplier(supplier); }} className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition-colors" title="QR Chuyển khoản">
										<QrCode size={18} />
									</button>
								)}
								<button onClick={(e) => { e.stopPropagation(); openEdit(supplier); }} className="p-2 text-slate-400 hover:text-[#FF6D00] hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors" title="Chỉnh sửa">
									<PenSquare size={18} />
								</button>
								<button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(supplier.id); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Xoá">
									<Trash size={18} />
								</button>
							</div>
						</div>

						<div className="space-y-2 mt-4 text-sm">
							{supplier.phone && (
								<div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
									<Phone size={16} className="text-slate-400" />
									<a href={`tel:${supplier.phone}`} className="hover:text-[#FF6D00] font-medium">{supplier.phone}</a>
								</div>
							)}
							{supplier.address && (
								<div className="flex items-start gap-3 text-slate-600 dark:text-slate-400">
									<MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
									<span className="line-clamp-2 leading-relaxed">{supplier.address}</span>
								</div>
							)}
						</div>

						<div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
							<div className="text-xs text-slate-500 dark:text-slate-400">Công nợ hiện tại:</div>
							<div className={`font-black text-lg ${supplier.totalDebt > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
								{(supplier.totalDebt || 0).toLocaleString('vi-VN')} đ
							</div>
						</div>
						{!supplier.bankAccount && (
							<div className="mt-2 text-[10px] text-slate-400 text-center font-medium">
								✏️ Nhấn để thêm thông tin ngân hàng & QR
							</div>
						)}
					</div>
				))}

				{filteredSuppliers.length === 0 && (
					<div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400 bg-white/50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
						<Store size={48} className="mb-4 opacity-20" />
						<p className="font-medium text-lg text-slate-600 dark:text-slate-400">Chưa có nhà cung cấp nào</p>
					</div>
				)}
			</div>

			{/* Form Modal */}
			{showAddForm && (
				<div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
						<div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 relative z-10">
							<h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
								{selectedSupplier ? 'Cập Nhật Nhà Cung Cấp' : 'Thêm Nhà Cung Cấp'}
							</h2>
							<button onClick={() => setShowAddForm(false)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-colors">
								<X size={24} />
							</button>
						</div>

						<div className="overflow-y-auto p-4 sm:p-6 flex-1 custom-scrollbar">
							<form id="supplierForm" onSubmit={handleSave} className="space-y-5">
								<div>
									<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Tên Nhà Cung Cấp <span className="text-red-500">*</span></label>
									<input
										type="text"
										required
										value={formData.name}
										onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
										placeholder="VD: Công ty Thép Hoà Phát..."
										className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-[#FF6D00] focus:border-transparent outline-none transition-all dark:text-white font-medium placeholder:font-normal"
									/>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Số điện thoại</label>
										<input
											type="tel"
											value={formData.phone}
											onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
											placeholder="0912..."
											className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white"
										/>
									</div>
									<div>
										<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Ngành Hàng</label>
										<input
											list="category-list"
											value={formData.category}
											onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
											placeholder="Chọn hoặc nhập mới..."
											className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white"
										/>
										<datalist id="category-list">
											{categories.map(c => <option key={c} value={c} />)}
										</datalist>
									</div>
								</div>

								<div>
									<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Địa chỉ</label>
									<textarea
										rows={2}
										value={formData.address}
										onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
										placeholder="Nhập địa chỉ..."
										className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white resize-none"
									/>
								</div>
								
								<div>
									<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Ghi chú</label>
									<textarea
										rows={2}
										value={formData.note}
										onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
										placeholder="Lưu ý về nhà cung cấp này..."
										className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white resize-none"
									/>
								</div>
								
								{/* --- Thông tin Ngân hàng --- */}
								<div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-2">
									<h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
										<Building2 size={16} /> Thông tin ngân hàng (QR chuyển khoản)
									</h3>
									<div className="space-y-3">
										<div>
											<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Ngân hàng</label>
											<select
												value={formData.bankName}
												onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
												className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white"
											>
												<option value="">-- Chọn ngân hàng --</option>
												{BANK_LIST.map(bank => (
													<option key={bank.code} value={bank.code}>{bank.shortName}</option>
												))}
											</select>
										</div>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
											<div>
												<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
													<CreditCard size={14} className="inline mr-1" />Số tài khoản
												</label>
												<input type="text" value={formData.bankAccount} onChange={(e) => setFormData(prev => ({ ...prev, bankAccount: e.target.value }))} placeholder="VD: 1234567890" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white" />
											</div>
											<div>
												<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
													<User size={14} className="inline mr-1" />Chủ tài khoản
												</label>
												<input type="text" value={formData.bankHolder} onChange={(e) => setFormData(prev => ({ ...prev, bankHolder: e.target.value }))} placeholder="VD: CÔNG TY TNHH..." className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white" />
											</div>
										</div>
									</div>
								</div>
							</form>
						</div>

						<div className="p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex gap-3">
							<button onClick={() => setShowAddForm(false)} type="button" className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
								Huỷ
							</button>
							<button type="submit" form="supplierForm" className="flex-1 px-4 py-3 bg-[#FF6D00] text-white font-bold rounded-xl shadow-lg shadow-orange-500/30 hover:bg-[#E66000] active:scale-[0.98] transition-all">
								{selectedSupplier ? 'Cập nhật' : 'Thêm mới'}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Delete Confirm */}
			{deleteConfirmId && (
				<div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
						<div className="size-16 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
							<Trash size={32} />
						</div>
						<h3 className="text-xl font-black text-center text-slate-800 dark:text-white mb-2">Xác nhận xoá?</h3>
						<p className="text-center text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
							Bạn có chắc chắn muốn xoá nhà cung cấp này? Hành động này không thể hoàn tác.
						</p>
						<div className="flex gap-3">
							<button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
								Huỷ
							</button>
							<button onClick={() => handleDelete(deleteConfirmId)} className="flex-1 py-3 px-4 bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 hover:bg-red-600 active:scale-95 transition-all">
								Xoá NCC
							</button>
						</div>
					</div>
				</div>
			)}

			{/* QR Modal */}
			{qrModalSupplier && (
				<SupplierQRModal
					supplier={qrModalSupplier}
					onClose={() => setQrModalSupplier(null)}
				/>
			)}
		</div>
	);
};

export default SupplierList;
