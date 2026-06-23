import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Plus, Search, Trash, X, ArrowLeft, CheckCircle2, Package, History } from 'lucide-react';
import { useOwner } from '../hooks/useOwner';
import { useSuppliers } from '../hooks/useSuppliers';
import { useProducts } from '../hooks/useProducts';
import { usePurchaseOrders } from '../hooks/usePurchaseOrders';
import { useSupplierDebts } from '../hooks/useSupplierDebts';
import { useToast } from '../components/shared/Toast';
import { serverTimestamp } from 'firebase/firestore';

const PurchaseOrders = () => {
	const navigate = useNavigate();
	const owner = useOwner();
	const { showToast } = useToast();
	
	const { suppliers, updateSupplier } = useSuppliers();
	const { products, update, create } = useProducts({ ownerId: owner.ownerId, enabled: !!owner.ownerId });
	const { purchaseOrders, loading, addPurchaseOrder } = usePurchaseOrders();
	const { addDebt } = useSupplierDebts();

	const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
	const [searchTerm, setSearchTerm] = useState('');

	const searchInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const handleOpenSearch = () => {
			if (activeTab !== 'list') setActiveTab('list');
			setTimeout(() => searchInputRef.current?.focus(), 200);
		};
		window.addEventListener('open-mobile-search', handleOpenSearch);
		return () => window.removeEventListener('open-mobile-search', handleOpenSearch);
	}, [activeTab]);

	// Create PO Form State
	const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
	const [orderNote, setOrderNote] = useState('');
	const [items, setItems] = useState<any[]>([{ id: crypto.randomUUID(), productId: '', name: '', qty: '', priceImport: 0 }]);
	const [paidAmount, setPaidAmount] = useState('');

	// UI State for dropdowns
	const [activeRow, setActiveRow] = useState<number | null>(null);
	const [productSearchQuery, setProductSearchQuery] = useState('');
	const [showSupplierResults, setShowSupplierResults] = useState(false);
	const [supplierSearchQuery, setSupplierSearchQuery] = useState('');

	const supplierSearchRef = useRef<HTMLDivElement>(null);
	const productDropdownRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
				setActiveRow(null);
			}
			if (supplierSearchRef.current && !supplierSearchRef.current.contains(event.target as Node)) {
				setShowSupplierResults(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const normalizeText = (text: any) => text ? String(text).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase() : '';
	const removeAccents = (str: any) => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
	const isMatch = (target: string, query: string) => {
		if (!query) return true;
		const t = normalizeText(target);
		const q = normalizeText(query);
		return t.includes(q) || removeAccents(t).includes(removeAccents(q));
	};

	const filteredPOs = purchaseOrders.filter(po => isMatch(po.supplierName, searchTerm) || isMatch(po.id, searchTerm));
	const filteredSuppliers = suppliers.filter(s => isMatch(s.name, supplierSearchQuery) || isMatch(s.phone, supplierSearchQuery));
	const filteredProducts = products.filter(p => isMatch(p.name, productSearchQuery) || isMatch(p.sku, productSearchQuery)).slice(0, 20);

	const calculateTotal = () => {
		return items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.priceImport) || 0), 0);
	};

	const totalAmount = calculateTotal();
	const unpaidAmount = totalAmount - (Number(paidAmount.replace(/\D/g, '')) || 0);

	const handleAddRow = () => {
		setItems([...items, { id: crypto.randomUUID(), productId: '', name: '', qty: '', priceImport: 0 }]);
	};

	const handleRemoveRow = (id: string) => {
		if (items.length > 1) {
			setItems(items.filter(item => item.id !== id));
		} else {
			setItems([{ id: crypto.randomUUID(), productId: '', name: '', qty: '', priceImport: 0 }]);
		}
	};

	const updateRow = (id: string, field: string, value: any) => {
		setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
	};

	const handleSelectProduct = (rowId: string, product: any) => {
		setItems(items.map(item => {
			if (item.id === rowId) {
				return {
					...item,
					productId: product.id,
					name: product.name,
					priceImport: product.priceImport || 0,
					currentStock: product.stock || 0
				};
			}
			return item;
		}));
		setActiveRow(null);
		setProductSearchQuery('');
	};

	const handleQuickAddProduct = async (rowId: string, name: string) => {
		try {
			// Thêm nhanh sản phẩm mới với các giá trị mặc định
			const newProductId = await create({
				name,
				sku: `SP${Date.now().toString().slice(-6)}`,
				priceImport: 0,
				priceSell: 0,
				stock: 0,
				category: 'Chưa phân loại'
			});
			
			setItems(items.map(item => {
				if (item.id === rowId) {
					return {
						...item,
						productId: newProductId,
						name: name,
						priceImport: 0,
						currentStock: 0
					};
				}
				return item;
			}));
			showToast("Đã thêm sản phẩm mới", "success");
			setActiveRow(null);
			setProductSearchQuery('');
		} catch (error) {
			showToast("Lỗi khi thêm sản phẩm", "error");
		}
	};

	const handleSubmit = async () => {
		if (!selectedSupplier) {
			showToast("Vui lòng chọn nhà cung cấp", "error");
			return;
		}

		const validItems = items.filter(i => i.productId && Number(i.qty) > 0);
		if (validItems.length === 0) {
			showToast("Vui lòng chọn ít nhất 1 sản phẩm có số lượng > 0", "error");
			return;
		}

		const paidNum = Number(paidAmount.replace(/\D/g, '')) || 0;
		if (paidNum > totalAmount) {
			showToast("Số tiền trả trước không được lớn hơn tổng giá trị đơn hàng", "error");
			return;
		}

		try {
			// 1. Tạo Purchase Order
			const orderData = {
				supplierId: selectedSupplier.id,
				supplierName: selectedSupplier.name,
				items: validItems,
				totalAmount,
				paidAmount: paidNum,
				debtAmount: unpaidAmount,
				note: orderNote,
				status: 'Hoàn thành',
				orderDate: new Date().toISOString()
			};

			const orderId = await addPurchaseOrder(orderData);

			// 2. Cập nhật Tồn kho và Giá nhập mới (Cách 1: Lấy giá mới nhất)
			for (const item of validItems) {
				const currentProduct = products.find(p => p.id === item.productId);
				if (currentProduct) {
					const newStock = (Number(currentProduct.stock) || 0) + Number(item.qty);
					// Cập nhật giá nhập mới nhất (Cách 1) để bảo toàn vốn
					await update(currentProduct.id, {
						stock: newStock,
						priceImport: Number(item.priceImport)
					});
				}
			}

			// 3. Ghi nhận Công nợ (nếu có nợ lại)
			if (unpaidAmount > 0) {
				await addDebt({
					supplierId: selectedSupplier.id,
					supplierName: selectedSupplier.name,
					type: 'debt_increase', // Phát sinh nợ
					amount: unpaidAmount,
					note: `Nợ đơn nhập hàng ngày ${new Date().toLocaleDateString('vi-VN')}`,
					orderId: orderId,
					createdBy: owner.ownerId,
					createdAt: serverTimestamp()
				});

				// Cập nhật tổng nợ của nhà cung cấp
				await updateSupplier(selectedSupplier.id, {
					totalDebt: (selectedSupplier.totalDebt || 0) + unpaidAmount
				});
			}
			
			// If paidAmount > 0, we should record a payment transaction too, but to keep it simple, it's just "tiền trả ngay".

			showToast("Đã hoàn thành phiếu nhập kho", "success");
			setActiveTab('list');
			
			// Reset Form
			setSelectedSupplier(null);
			setOrderNote('');
			setItems([{ id: crypto.randomUUID(), productId: '', name: '', qty: '', priceImport: 0 }]);
			setPaidAmount('');
		} catch (error) {
			console.error(error);
			showToast("Có lỗi xảy ra", "error");
		}
	};

	const formatCurrency = (val: any) => Number(val || 0).toLocaleString('vi-VN');

	if (loading) {
		return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1A237E]"></div></div>;
	}

	return (
		<div className="h-full flex flex-col relative pb-24 lg:pb-0">
			{/* Header */}
			<div className="sticky top-0 z-40 bg-[#f8f9fa] dark:bg-slate-950 pb-4">
				<div className="flex flex-col gap-4">
					<div className="flex items-center justify-between">
						<h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3">
							<span className="material-symbols-outlined text-[#1A237E] dark:text-[#FF6D00] text-3xl">local_shipping</span>
							Nhập Kho
						</h1>
					</div>

					<div className="flex border-b border-slate-200 dark:border-slate-800">
						<button
							onClick={() => setActiveTab('list')}
							className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'list' ? 'border-[#FF6D00] text-[#FF6D00]' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
						>
							Lịch Sử Nhập
						</button>
						<button
							onClick={() => setActiveTab('create')}
							className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'create' ? 'border-[#FF6D00] text-[#FF6D00]' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
						>
							Tạo Đơn Mới
						</button>
					</div>
				</div>
			</div>

			{activeTab === 'list' ? (
				<div className="mt-4">
					<div className="mb-4">
						<div className="relative">
							<Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
							<input
								ref={searchInputRef}
								type="text"
								placeholder="Tìm kiếm phiếu nhập..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="w-full h-12 pl-12 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white"
							/>
						</div>
					</div>

					<div className="space-y-3">
						{filteredPOs.map(po => (
							<div key={po.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
								<div className="flex justify-between items-start mb-2">
									<div>
										<h4 className="font-bold text-slate-800 dark:text-white">{po.supplierName}</h4>
										<div className="text-xs text-slate-500 mt-1">{new Date(po.orderDate).toLocaleString('vi-VN')}</div>
									</div>
									<div className="text-right">
										<div className="font-black text-slate-800 dark:text-white">{formatCurrency(po.totalAmount)} đ</div>
										{po.debtAmount > 0 && <div className="text-xs text-red-500 font-bold mt-1">Nợ: {formatCurrency(po.debtAmount)} đ</div>}
									</div>
								</div>
								<div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-400">
									{po.items.length} sản phẩm • {po.note || 'Không có ghi chú'}
								</div>
							</div>
						))}
						{filteredPOs.length === 0 && (
							<div className="py-12 text-center text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
								Chưa có phiếu nhập kho nào.
							</div>
						)}
					</div>
				</div>
			) : (
				<div className="mt-4 space-y-6">
					{/* Chọn Nhà Cung Cấp */}
					<div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
						<h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight mb-4 flex items-center gap-2">
							<Store size={18} className="text-[#FF6D00]" /> 1. Chọn Nhà Cung Cấp
						</h3>
						<div className="relative" ref={supplierSearchRef}>
							{selectedSupplier ? (
								<div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
									<div>
										<div className="font-bold text-slate-800 dark:text-white">{selectedSupplier.name}</div>
										<div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{selectedSupplier.phone || 'Không có SĐT'}</div>
									</div>
									<button onClick={() => setSelectedSupplier(null)} className="p-2 text-slate-400 hover:text-red-500 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
										<X size={18} />
									</button>
								</div>
							) : (
								<div>
									<div className="relative">
										<Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
										<input
											type="text"
											placeholder="Tìm kiếm nhà cung cấp..."
											value={supplierSearchQuery}
											onChange={(e) => { setSupplierSearchQuery(e.target.value); setShowSupplierResults(true); }}
											onFocus={() => setShowSupplierResults(true)}
											className="w-full h-12 pl-12 pr-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white"
										/>
									</div>
									{showSupplierResults && (
										<div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
											{filteredSuppliers.map(supplier => (
												<div
													key={supplier.id}
													onClick={() => { setSelectedSupplier(supplier); setShowSupplierResults(false); setSupplierSearchQuery(''); }}
													className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-100 dark:border-slate-800/50 last:border-0"
												>
													<div className="font-bold text-slate-800 dark:text-white">{supplier.name}</div>
													<div className="text-sm text-slate-500">{supplier.phone}</div>
												</div>
											))}
											{filteredSuppliers.length === 0 && (
												<div className="p-4 text-center text-slate-500">
													Không tìm thấy nhà cung cấp này. 
													<span className="text-[#FF6D00] font-bold block mt-1">Gợi ý: Cần qua mục Nhà Cung Cấp để tạo mới trước.</span>
												</div>
											)}
										</div>
									)}
								</div>
							)}
						</div>
					</div>

					{/* Nhập Sản Phẩm */}
					<div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
						<div className="flex items-center justify-between mb-4">
							<h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
								<Package size={18} className="text-[#FF6D00]" /> 2. Sản Phẩm Nhập
							</h3>
						</div>

						<div className="space-y-4" ref={productDropdownRef}>
							{items.map((item, index) => (
								<div key={item.id} className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl relative group">
									{/* Delete Button */}
									{items.length > 1 && (
										<button onClick={() => handleRemoveRow(item.id)} className="absolute -top-3 -right-3 size-8 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
											<Trash size={14} />
										</button>
									)}

									<div className="grid grid-cols-1 md:grid-cols-12 gap-4">
										{/* Tên sản phẩm */}
										<div className="md:col-span-6 relative">
											<label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên SP (Kho đang có: {item.currentStock || 0})</label>
											{item.productId ? (
												<div className="flex items-center justify-between w-full h-12 px-4 bg-white dark:bg-slate-900 border border-emerald-500 rounded-xl shadow-sm">
													<span className="font-bold text-slate-800 dark:text-white line-clamp-1">{item.name}</span>
													<button onClick={() => updateRow(item.id, 'productId', '')} className="text-slate-400 hover:text-red-500">
														<X size={16} />
													</button>
												</div>
											) : (
												<div>
													<input
														type="text"
														placeholder="Gõ để tìm tên sản phẩm..."
														value={activeRow === index ? productSearchQuery : ''}
														onChange={(e) => { setProductSearchQuery(e.target.value); setActiveRow(index); }}
														onFocus={() => setActiveRow(index)}
														className="w-full h-12 px-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white"
													/>
													{activeRow === index && productSearchQuery && (
														<div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
															{filteredProducts.map(product => (
																<div
																	key={product.id}
																	onClick={() => handleSelectProduct(item.id, product)}
																	className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700/50 last:border-0"
																>
																	<div className="font-bold text-slate-800 dark:text-white">{product.name}</div>
																	<div className="text-xs text-slate-500">Giá nhập cũ: {formatCurrency(product.priceImport)} đ • Tồn: {product.stock}</div>
																</div>
															))}
															{filteredProducts.length === 0 && (
																<div className="p-3 text-center">
																	<p className="text-sm text-slate-500 mb-2">Chưa có sản phẩm này</p>
																	<button
																		onClick={() => handleQuickAddProduct(item.id, productSearchQuery)}
																		className="w-full py-2 bg-slate-100 dark:bg-slate-700 text-[#FF6D00] font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
																	>
																		<Plus size={16} /> Thêm nhanh SP mới
																	</button>
																</div>
															)}
														</div>
													)}
												</div>
											)}
										</div>

										{/* Số lượng */}
										<div className="md:col-span-2">
											<label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số lượng</label>
											<input
												type="number"
												min="0"
												value={item.qty}
												onChange={(e) => updateRow(item.id, 'qty', e.target.value)}
												className="w-full h-12 px-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white"
												placeholder="0"
											/>
										</div>

										{/* Giá nhập */}
										<div className="md:col-span-4">
											<label className="block text-xs font-bold text-slate-500 uppercase mb-1">Giá nhập (Cập nhật nếu đổi)</label>
											<div className="relative">
												<input
													type="text"
													value={item.priceImport ? Number(item.priceImport).toLocaleString('vi-VN') : ''}
													onChange={(e) => updateRow(item.id, 'priceImport', e.target.value.replace(/\D/g, ''))}
													className="w-full h-12 pl-4 pr-10 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white text-right font-bold text-[#FF6D00]"
													placeholder="0"
												/>
												<span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">đ</span>
											</div>
										</div>
									</div>
								</div>
							))}
						</div>

						<button onClick={handleAddRow} className="mt-4 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
							<Plus size={18} /> Thêm dòng
						</button>
					</div>

					{/* Thanh Toán & Hoàn Thành */}
					<div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 mb-8">
						<div className="space-y-4">
							<div>
								<label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ghi chú phiếu nhập</label>
								<input
									type="text"
									value={orderNote}
									onChange={(e) => setOrderNote(e.target.value)}
									className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white"
									placeholder="Ví dụ: Nhập hàng đợt 1 tháng 11..."
								/>
							</div>

							<div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
								<div className="flex items-center justify-between">
									<span className="text-slate-500 dark:text-slate-400 font-medium">Tổng tiền hàng:</span>
									<span className="font-bold text-slate-800 dark:text-white text-lg">{formatCurrency(totalAmount)} đ</span>
								</div>
								
								<div className="flex items-center justify-between">
									<span className="text-slate-500 dark:text-slate-400 font-bold">Tiền trả ngay NCC:</span>
									<div className="relative w-48">
										<input
											type="text"
											value={paidAmount}
											onChange={(e) => setPaidAmount(e.target.value ? Number(e.target.value.replace(/\D/g, '')).toLocaleString('vi-VN') : '')}
											className="w-full h-10 pl-4 pr-8 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:text-white text-right font-bold text-emerald-600 dark:text-emerald-400"
											placeholder="0"
										/>
										<span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">đ</span>
									</div>
								</div>

								<div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
									<span className="text-slate-600 dark:text-slate-300 font-black uppercase">Còn nợ lại:</span>
									<span className="font-black text-red-600 dark:text-red-400 text-xl">{formatCurrency(unpaidAmount)} đ</span>
								</div>
							</div>

							<button
								onClick={handleSubmit}
								className="w-full mt-6 py-4 bg-[#FF6D00] text-white font-black rounded-xl shadow-lg shadow-orange-500/30 hover:bg-[#E66000] active:scale-[0.98] transition-all flex justify-center items-center gap-2 uppercase tracking-wide text-lg"
							>
								<CheckCircle2 size={24} /> Hoàn Thành Nhập Kho
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default PurchaseOrders;
