import React, { useState, useEffect, useRef } from 'react';
import { useOwner } from '../hooks/useOwner';
import { useSuppliers } from '../hooks/useSuppliers';
import { useSupplierDebts } from '../hooks/useSupplierDebts';
import { useToast } from '../components/shared/Toast';
import { Search, FileText, CheckCircle2, History, X, Plus, Trash2 } from 'lucide-react';
import { serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

const SupplierDebts = () => {
	const owner = useOwner();
	const { showToast } = useToast();
	const { suppliers, updateSupplier } = useSuppliers();
	const { debts, addDebt, removeDebt } = useSupplierDebts();

	const [activeTab, setActiveTab] = useState<'debts' | 'history'>('debts');
	const [searchTerm, setSearchTerm] = useState('');
	const searchInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const handleOpenSearch = () => {
			if (activeTab !== 'debts') setActiveTab('debts');
			setTimeout(() => searchInputRef.current?.focus(), 200);
		};
		window.addEventListener('open-mobile-search', handleOpenSearch);
		return () => window.removeEventListener('open-mobile-search', handleOpenSearch);
	}, [activeTab]);

	const [showPaymentForm, setShowPaymentForm] = useState(false);
	const [selectedSupplier, setSelectedSupplier] = useState<any>(null);

	const [paymentAmount, setPaymentAmount] = useState('');
	const [paymentMethod, setPaymentMethod] = useState('Chuyển khoản');
	const [paymentNote, setPaymentNote] = useState('');

	// Add Debt State
	const [showAddDebtForm, setShowAddDebtForm] = useState(false);
	const [debtSupplier, setDebtSupplier] = useState<any>(null);
	const [showDebtSupplierSearch, setShowDebtSupplierSearch] = useState(false);
	const [debtSupplierSearchQuery, setDebtSupplierSearchQuery] = useState('');
	const [debtAmountInput, setDebtAmountInput] = useState('');
	const [debtNote, setDebtNote] = useState('');

	const debtSupplierSearchRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (debtSupplierSearchRef.current && !debtSupplierSearchRef.current.contains(event.target as Node)) {
				setShowDebtSupplierSearch(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const suppliersWithDebt = suppliers.filter(s => (s.totalDebt || 0) > 0);
	const filteredSuppliers = suppliersWithDebt.filter(s => 
		s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
		(s.phone && s.phone.includes(searchTerm))
	);

	const handlePayDebt = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedSupplier || !paymentAmount) return;

		const amountNum = parseFloat(paymentAmount.replace(/\D/g, ''));
		if (isNaN(amountNum) || amountNum <= 0) {
			showToast("Số tiền không hợp lệ", "error");
			return;
		}

		try {
			// Create payment transaction
			await addDebt({
				supplierId: selectedSupplier.id,
				supplierName: selectedSupplier.name,
				type: 'payment',
				amount: amountNum,
				method: paymentMethod,
				note: paymentNote,
				createdBy: owner.ownerId,
				createdAt: serverTimestamp()
			});

			// P0 #2: totalDebt tự động tính từ debts listener, không cần update thủ công

			showToast("Thanh toán thành công", "success");
			setShowPaymentForm(false);
			setPaymentAmount('');
			setPaymentNote('');
		} catch (error) {
			console.error(error);
			showToast("Lỗi thanh toán", "error");
		}
	};

	const handleSaveDebt = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!debtSupplier || !debtAmountInput) return;

		const amountNum = parseFloat(debtAmountInput.replace(/\D/g, ''));
		if (isNaN(amountNum) || amountNum <= 0) {
			showToast("Số tiền không hợp lệ", "error");
			return;
		}

		try {
			// Ghi nhận TRẢ NỢ (giảm nợ), không phải ghi nợ mới
			await addDebt({
				supplierId: debtSupplier.id,
				supplierName: debtSupplier.name,
				type: 'payment',
				amount: amountNum,
				method: 'Chuyển khoản',
				note: debtNote || 'Ghi nhận trả nợ',
				createdBy: owner.ownerId,
				createdAt: serverTimestamp()
			});

			showToast("Đã ghi nhận trả nợ thành công", "success");
			setShowAddDebtForm(false);
			setDebtSupplier(null);
			setDebtAmountInput('');
			setDebtNote('');
		} catch (error) {
			console.error(error);
			showToast("Có lỗi xảy ra", "error");
		}
	};

	const handleDeleteDebt = async (debt: any) => {
		if (!window.confirm(`Xoá giao dịch ${debt.type === 'payment' ? 'trả nợ' : 'ghi nợ'} ${debt.amount?.toLocaleString('vi-VN') || '0'}đ của ${debt.supplierName}?`)) return;
		try {
			await removeDebt(debt.id);
			showToast("Đã xoá giao dịch", "success");
		} catch (error: any) {
			console.error(error);
			showToast(`Lỗi khi xoá: ${error.message || 'Không xác định'}`, "error");
		}
	};

	const formatCurrency = (val: any) => {
		return Number(val || 0).toLocaleString('vi-VN');
	};

	return (
		<div className="h-full flex flex-col relative pb-24 lg:pb-0">
			{/* Header */}
			<div className="sticky top-0 z-40 bg-[#f8f9fa] dark:bg-slate-950 pb-4">
				<div className="flex flex-col gap-4">
					<div className="flex items-center justify-between">
						<h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3">
							<span className="material-symbols-outlined text-[#1A237E] dark:text-[#FF6D00] text-3xl">account_balance</span>
							Công Nợ Nhà Cung Cấp
						</h1>
						<button 
							onClick={() => setShowAddDebtForm(true)}
							className="p-2 bg-[#FF6D00] text-white rounded-xl shadow-lg hover:scale-105 transition-transform flex items-center justify-center gap-2 px-4 font-bold"
						>
							<Plus size={20} /> <span className="hidden sm:inline">Điều Chỉnh Nợ</span>
						</button>
					</div>

					<div className="flex border-b border-slate-200 dark:border-slate-800">
						<button
							onClick={() => setActiveTab('debts')}
							className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'debts' ? 'border-[#FF6D00] text-[#FF6D00]' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
						>
							Cần Thanh Toán
						</button>
						<button
							onClick={() => setActiveTab('history')}
							className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'history' ? 'border-[#FF6D00] text-[#FF6D00]' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
						>
							Lịch Sử Chi Trả
						</button>
					</div>
				</div>
			</div>

			{activeTab === 'debts' ? (
				<div className="mt-4">
					<div className="mb-4">
						<div className="relative">
							<Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
							<input
								ref={searchInputRef}
								type="text"
								placeholder="Tìm nhà cung cấp..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="w-full h-12 pl-12 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white"
							/>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{filteredSuppliers.map(supplier => (
							<div key={supplier.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
								<div>
									<h3 className="font-bold text-lg text-slate-800 dark:text-white mb-1">{supplier.name}</h3>
									<p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{supplier.phone}</p>
								</div>
								<div className="flex items-end justify-between border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
									<div>
										<div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Nợ cần trả:</div>
										<div className="text-xl font-black text-red-600 dark:text-red-400">{formatCurrency(supplier.totalDebt)} đ</div>
									</div>
									<button
										onClick={() => { setSelectedSupplier(supplier); setShowPaymentForm(true); }}
										className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all flex items-center gap-2"
									>
										<CheckCircle2 size={18} />
										Trả Nợ
									</button>
								</div>
							</div>
						))}
						{filteredSuppliers.length === 0 && (
							<div className="col-span-full py-12 text-center text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
								Không có nhà cung cấp nào đang nợ.
							</div>
						)}
					</div>
				</div>
			) : (
				<div className="mt-4 space-y-3">
					{debts.filter(d => ['payment', 'debt_increase'].includes(d.type)).map(payment => {
						const isIncrease = payment.type === 'debt_increase';
						const colorClass = isIncrease ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400';
						const bgClass = isIncrease ? 'bg-red-100 dark:bg-red-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30';
						const sign = isIncrease ? '+' : '-';
						const typeLabel = payment.type === 'payment' ? 'Thanh toán trả nợ' : 'Ghi nợ mới';

						return (
							<div key={payment.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between group">
								<div className="flex items-center gap-4 flex-1 min-w-0">
									<div className={`size-10 rounded-full flex items-center justify-center shrink-0 ${bgClass} ${colorClass}`}>
										<History size={20} />
									</div>
									<div className="min-w-0">
										<h4 className="font-bold text-slate-800 dark:text-white truncate">{payment.supplierName}</h4>
										<div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
											{payment.createdAt ? new Date(payment.createdAt.seconds * 1000).toLocaleString('vi-VN') : 'Đang xử lý...'}
											<span className="mx-2">•</span>
											<span className="font-semibold">{typeLabel}</span>
											{payment.method && <><span className="mx-2">•</span>{payment.method}</>}
										</div>
										{payment.note && <div className="text-sm mt-1 text-slate-600 dark:text-slate-300 truncate">{payment.note}</div>}
									</div>
								</div>
								<div className="flex items-center gap-3">
									<div className="text-right">
										<div className={`font-black text-lg ${colorClass}`}>{sign}{formatCurrency(payment.amount)} đ</div>
									</div>
									<button
										onClick={(e) => { e.stopPropagation(); handleDeleteDebt(payment); }}
										className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
										title="Xoá giao dịch"
									>
										<Trash2 size={16} />
									</button>
								</div>
							</div>
						);
					})}
					{debts.filter(d => ['payment', 'debt_increase'].includes(d.type)).length === 0 && (
						<div className="py-12 text-center text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
							Chưa có lịch sử chi trả nào.
						</div>
					)}
				</div>
			)}

			{/* Payment Form Modal */}
			{showPaymentForm && selectedSupplier && (
				<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
					<div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
						<div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
							<h3 className="font-black text-lg text-slate-800 dark:text-white uppercase tracking-tight">Thanh Toán Trả Nợ NCC</h3>
							<button onClick={() => setShowPaymentForm(false)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-colors">
								<X size={20} />
							</button>
						</div>
						<div className="p-5 flex-1 overflow-y-auto">
							<div className="mb-6 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
								<div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Thanh toán cho:</div>
								<div className="font-bold text-slate-800 dark:text-white">{selectedSupplier.name}</div>
								<div className="mt-3 text-sm text-slate-500 dark:text-slate-400 mb-1">Công nợ hiện tại:</div>
								<div className="font-black text-red-600 dark:text-red-400 text-xl">{formatCurrency(selectedSupplier.totalDebt)} đ</div>
							</div>

							<form id="payDebtForm" onSubmit={handlePayDebt} className="space-y-4">
								<div>
									<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Số Tiền Trả <span className="text-red-500">*</span></label>
									<input
										type="text"
										required
										value={paymentAmount}
										onChange={(e) => {
											const val = e.target.value.replace(/\D/g, '');
											setPaymentAmount(val ? Number(val).toLocaleString('vi-VN') : '');
										}}
										className="w-full h-12 px-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg dark:text-white transition-all text-right"
										placeholder="0"
									/>
								</div>
								<div>
									<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Phương thức</label>
									<select
										value={paymentMethod}
										onChange={(e) => setPaymentMethod(e.target.value)}
										className="w-full h-12 px-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium dark:text-white transition-all"
									>
										<option value="Chuyển khoản">Chuyển khoản</option>
										<option value="Tiền mặt">Tiền mặt</option>
									</select>
								</div>
								<div>
									<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Ghi chú (Tuỳ chọn)</label>
									<textarea
										rows={2}
										value={paymentNote}
										onChange={(e) => setPaymentNote(e.target.value)}
										className="w-full p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white resize-none"
										placeholder="Nhập ghi chú thanh toán..."
									/>
								</div>
							</form>
						</div>
						<div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex gap-3">
							<button onClick={() => setShowPaymentForm(false)} className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 transition-colors">
								Huỷ
							</button>
							<button type="submit" form="payDebtForm" className="flex-1 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all flex justify-center items-center gap-2">
								<CheckCircle2 size={20} /> Xác Nhận Trả
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Add/Decrease Debt Form Modal */}
			{showAddDebtForm && (
				<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
					<div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
						<div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
							<h3 className="font-black text-lg text-slate-800 dark:text-white uppercase tracking-tight">Ghi Nhận Trả Nợ NCC</h3>
							<button onClick={() => setShowAddDebtForm(false)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-colors">
								<X size={20} />
							</button>
						</div>
						<div className="p-5 flex-1 overflow-y-auto">
							<form id="addDebtForm" onSubmit={handleSaveDebt} className="space-y-4">
								<div>
									<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Nhà Cung Cấp <span className="text-red-500">*</span></label>
									{debtSupplier ? (
										<div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
											<div>
												<div className="font-bold text-slate-800 dark:text-white">{debtSupplier.name}</div>
												<div className="text-xs text-red-500 mt-1">Đang nợ: {formatCurrency(debtSupplier.totalDebt)} đ</div>
											</div>
											<button type="button" onClick={() => setDebtSupplier(null)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg">
												<X size={16} />
											</button>
										</div>
									) : (
										<div className="relative" ref={debtSupplierSearchRef}>
											<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
											<input
												type="text"
												placeholder="Tìm nhà cung cấp..."
												value={debtSupplierSearchQuery}
												onChange={(e) => { setDebtSupplierSearchQuery(e.target.value); setShowDebtSupplierSearch(true); }}
												onFocus={() => setShowDebtSupplierSearch(true)}
												className="w-full h-12 pl-10 pr-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white"
											/>
											{showDebtSupplierSearch && (
												<div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
													{suppliers.filter(s => s.name.toLowerCase().includes(debtSupplierSearchQuery.toLowerCase())).map(supplier => (
														<div
															key={supplier.id}
															onClick={() => { setDebtSupplier(supplier); setShowDebtSupplierSearch(false); setDebtSupplierSearchQuery(''); }}
															className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700/50 last:border-0"
														>
															<div className="font-bold text-slate-800 dark:text-white">{supplier.name}</div>
															<div className="text-xs text-slate-500">Nợ hiện tại: {formatCurrency(supplier.totalDebt)} đ</div>
														</div>
													))}
													{suppliers.filter(s => s.name.toLowerCase().includes(debtSupplierSearchQuery.toLowerCase())).length === 0 && (
														<div className="p-3 text-center text-sm text-slate-500">
															Không tìm thấy nhà cung cấp nào
														</div>
													)}
												</div>
											)}
										</div>
									)}
								</div>

								<div>
									<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Số Tiền <span className="text-red-500">*</span></label>
									<input
										type="text"
										required
										value={debtAmountInput}
										onChange={(e) => {
											const val = e.target.value.replace(/\D/g, '');
											setDebtAmountInput(val ? Number(val).toLocaleString('vi-VN') : '');
										}}
										className="w-full h-12 px-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none font-bold text-lg dark:text-white transition-all text-right"
										placeholder="0"
									/>
								</div>
								<div>
									<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Ghi chú (Tuỳ chọn)</label>
									<textarea
										rows={2}
										value={debtNote}
										onChange={(e) => setDebtNote(e.target.value)}
										className="w-full p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none dark:text-white resize-none"
										placeholder="VD: Nợ phí vận chuyển, nợ cũ phát sinh..."
									/>
								</div>
							</form>
						</div>
						<div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex gap-3">
							<button onClick={() => setShowAddDebtForm(false)} className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 transition-colors">
								Huỷ
							</button>
							<button type="submit" form="addDebtForm" className="flex-1 px-4 py-3 text-white font-bold rounded-xl shadow-lg transition-all flex justify-center items-center gap-2 bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30">
								<CheckCircle2 size={20} /> Xác Nhận Trả Nợ
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default SupplierDebts;
