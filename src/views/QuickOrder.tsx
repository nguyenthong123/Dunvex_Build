import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search, Plus, Minus, Trash2, ShoppingCart, User, Package, MapPin, Truck, FileText, ChevronDown, X, Layers, CheckCircle, Mail, RotateCcw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, auth } from '../services/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, getDoc, serverTimestamp, where, increment, writeBatch } from 'firebase/firestore';

const QuickOrder = () => {
	const navigate = useNavigate();
	const { id } = useParams();
	const [products, setProducts] = useState<any[]>([]);
	const [customers, setCustomers] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [fetchingOrder, setFetchingOrder] = useState(false);
	const [sendEmail, setSendEmail] = useState(false);
	const [showSuccessModal, setShowSuccessModal] = useState(false);

	// Form state
	const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
	const [searchCustomerQuery, setSearchCustomerQuery] = useState('');
	const [showCustomerResults, setShowCustomerResults] = useState(false);
	const [orderStatus, setOrderStatus] = useState('Đơn chốt');
	const [orderNote, setOrderNote] = useState('');
	const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);

	// Line items state
	const [lineItems, setLineItems] = useState<any[]>([
		{ id: Date.now(), category: '', productId: '', name: '', qty: 1, price: 0, buyPrice: 0, unit: '', packaging: '', density: '', maxStock: 0 }
	]);

	// Adjustments
	const [shippingFee, setShippingFee] = useState(0);
	const [discountAmt, setDiscountAmt] = useState(0);

	const customerSearchRef = useRef<HTMLDivElement>(null);

	// ... (useEffect for auth) ...

	// Fetch Order for Editing
	useEffect(() => {
		if (id && auth.currentUser && customers.length > 0) {
			const fetchOrder = async () => {
				setFetchingOrder(true);
				try {
					const orderRef = doc(db, 'orders', id);
					const orderSnap = await getDoc(orderRef);
					if (orderSnap.exists()) {
						const data = orderSnap.data();

						setLineItems((data.items || []).map((item: any) => ({
							id: Math.random(),
							productId: item.id || '',
							name: item.name || '',
							category: item.category || '',
							qty: item.qty || 0,
							price: item.price || 0,
							buyPrice: item.buyPrice || 0, // Load historical buy price
							unit: item.unit || '',
							packaging: item.packaging || '',
							density: item.density || '',
							maxStock: 0 // Will be updated if product still exists
						})));
						// ...
					}
				} catch (err) {
					// ...
				} finally {
					setFetchingOrder(false);
				}
			};
			fetchOrder();
		}
	}, [id, auth.currentUser, customers.length > 0]);

	const addLineItem = () => {
		setLineItems([...lineItems, { id: Date.now(), category: '', productId: '', name: '', qty: 1, price: 0, buyPrice: 0, unit: '', packaging: '', density: '', maxStock: 0 }]);
	};

	const removeLineItem = (index: number) => {
		if (lineItems.length > 1) {
			setLineItems(lineItems.filter((_, i) => i !== index));
		}
	};

	const updateLineItem = (index: number, field: string, value: any) => {
		const newItems = [...lineItems];
		newItems[index][field] = value;

		if (field === 'productId') {
			const prod = products.find(p => p.id === value);
			if (prod) {
				newItems[index].name = prod.name;
				newItems[index].price = prod.priceSell;
				newItems[index].buyPrice = prod.priceBuy || 0; // Capture current buy price
				newItems[index].unit = prod.unit;
				newItems[index].category = prod.category;
				newItems[index].packaging = prod.packaging;
				newItems[index].density = prod.density;
				newItems[index].maxStock = prod.stock || 0;
			}
		}
		setLineItems(newItems);
	};

	const subTotal = lineItems.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0), 0);
	const finalTotal = subTotal + Number(shippingFee) - Number(discountAmt);

	const totalWeight = lineItems.reduce((sum, item) => {
		const unit = item.unit?.toLowerCase();
		const density = parseFloat(item.density) || 0;
		const qty = Number(item.qty) || 0;
		if (unit === 'kg') return sum + qty;
		return sum + (qty * density);
	}, 0);

	const handleConfirmOrder = async () => {
		const validItems = lineItems.filter(item => item.productId && item.qty > 0);
		if (validItems.length === 0) {
			alert("Vui lòng thêm sản phẩm vào đơn hàng");
			return;
		}

		try {
			const orderData: any = {
				customerName: selectedCustomer?.name || searchCustomerQuery || 'Khách vãng lai',
				customerId: selectedCustomer?.id || null,
				customerPhone: selectedCustomer?.phone || '',
				orderDate: orderDate,
				items: validItems.map(item => ({
					id: item.productId,
					name: item.name,
					price: Number(item.price) || 0,
					buyPrice: Number(item.buyPrice) || 0,
					qty: Number(item.qty) || 0,
					unit: item.unit || '',
					category: item.category || '',
					density: item.density || '',
					packaging: item.packaging || ''
				})),
				subTotal: Number(subTotal) || 0,
				adjustmentValue: Number(shippingFee) || 0,
				discountValue: Number(discountAmt) || 0,
				totalAmount: Number(finalTotal) || 0,
				totalWeight: Number(totalWeight) || 0,
				note: orderNote,
				status: orderStatus,
				createdBy: auth.currentUser?.uid || '',
				createdByEmail: auth.currentUser?.email || ''
			};

			if (id) {
				// If editing, we might need complex logic to revert old stock and deduct new stock. 
				// For now, let's just update the order details without changing stock to avoid inconsistencies.
				// Or, we could warn the user.
				await updateDoc(doc(db, 'orders', id), {
					...orderData,
					updatedAt: serverTimestamp()
				});
			} else {
				orderData.createdAt = serverTimestamp();

				// Batch write: Create Order + Create Notification + Deduct Stock
				const batch = writeBatch(db);

				// 1. Create Order
				const newOrderRef = doc(collection(db, 'orders'));
				batch.set(newOrderRef, orderData);

				// 2. Create Notification
				const notifRef = doc(collection(db, 'notifications'));
				batch.set(notifRef, {
					title: 'Đơn hàng mới',
					message: `Đơn hàng cho ${orderData.customerName} đã được tạo thành công: ${finalTotal.toLocaleString('vi-VN')} đ`,
					type: 'order',
					orderId: newOrderRef.id,
					userId: auth.currentUser?.uid,
					read: false,
					createdAt: serverTimestamp()
				});

				// 3. Deduct Stock
				validItems.forEach(item => {
					// Only decrement for saved products (have productId from DB)
					if (item.productId) {
						const prodRef = doc(db, 'products', item.productId);
						batch.update(prodRef, {
							stock: increment(-item.qty)
						});
					}
				});

				await batch.commit();
			}
			setShowSuccessModal(true);
		} catch (error) {
			console.error("Error saving order:", error);
			alert("Lỗi khi lưu đơn hàng: " + error);
		}
	};

	const filteredCustomers = customers.filter(c =>
		c.name?.toLowerCase().includes(searchCustomerQuery.toLowerCase()) ||
		c.phone?.includes(searchCustomerQuery)
	);

	const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

	return (
		<div className="min-h-screen bg-[#f8f9fb] dark:bg-slate-950 p-4 md:p-8 font-sans pb-32 md:pb-8 transition-colors duration-300">
			{/* TOP HEADER */}
			<div className="max-w-[1000px] mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
				<div className="flex items-center gap-4">
					<button
						onClick={() => navigate('/dashboard')}
						className="size-12 shrink-0 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-[#1A237E] dark:hover:text-indigo-400 hover:border-[#1A237E]/20 dark:hover:border-indigo-400/20 transition-all active:scale-90"
						title="Về Trang Chủ"
					>
						<RotateCcw size={20} />
					</button>
					<div>
						<h1 className="text-xl md:text-2xl font-black text-[#1c130d] dark:text-white flex items-center gap-2 uppercase tracking-tight leading-tight">
							📝 {id ? 'Chỉnh Sửa Đơn' : 'Lên Đơn Hàng Mới'}
						</h1>
						<p className="text-slate-500 dark:text-slate-400 text-[10px] md:text-sm font-medium mt-1">Hoàn tất thông tin đơn hàng mới</p>
					</div>
				</div>

				<div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-none pt-4 md:pt-0 border-slate-100 dark:border-slate-800">
					<div className="flex items-center gap-3">
						<span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">GỬI EMAIL:</span>
						<button
							onClick={() => setSendEmail(!sendEmail)}
							className={`w-10 h-5 md:w-12 md:h-6 rounded-full transition-colors relative ${sendEmail ? 'bg-[#ffcc00]' : 'bg-slate-200 dark:bg-slate-700'}`}
						>
							<div className={`absolute top-0.5 md:top-1 size-4 bg-white rounded-full transition-all ${sendEmail ? 'left-5 md:left-7' : 'left-0.5 md:left-1'}`}></div>
						</button>
					</div>

					<button
						onClick={() => navigate('/orders')}
						className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-[#1c130d] dark:hover:text-white font-bold text-[11px] md:text-sm transition-colors group"
					>
						<ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
						Quay lại
					</button>
				</div>
			</div>

			<div className="max-w-[1000px] mx-auto space-y-6">

				{/* SECTION 1: CUSTOMER & STATUS */}
				<div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 md:p-8 transition-colors duration-300">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
						{/* CUSTOMER SEARCH */}
						<div className="relative" ref={customerSearchRef}>
							<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 ml-1">KHÁCH HÀNG *</label>
							<div className="relative">
								<Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" />
								<input
									type="text"
									placeholder="Nhập tên hoặc tìm khách hàng..."
									className="w-full pl-12 pr-4 h-14 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/10 focus:border-[#f27121] transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
									value={searchCustomerQuery}
									onChange={(e) => {
										setSearchCustomerQuery(e.target.value);
										setShowCustomerResults(true);
									}}
									onFocus={() => setShowCustomerResults(true)}
								/>
							</div>
							{showCustomerResults && searchCustomerQuery && (
								<div className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl max-h-60 overflow-y-auto">
									{filteredCustomers.map(c => (
										<button
											key={c.id}
											className="w-full px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center justify-between border-b border-slate-50 dark:border-slate-700 last:border-none group"
											onClick={() => {
												setSelectedCustomer(c);
												setSearchCustomerQuery(c.name);
												setShowCustomerResults(false);
											}}
										>
											<div>
												<p className="font-black text-sm uppercase text-slate-800 dark:text-slate-200 group-hover:text-[#f27121]">{c.name}</p>
												<p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{c.phone}</p>
											</div>
											<CheckCircle size={18} className="text-slate-100 dark:text-slate-700 group-hover:text-[#f27121]" />
										</button>
									))}
									<button
										className="w-full px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 border-t border-slate-50 dark:border-slate-700 text-[#f27121]"
										onClick={() => setShowCustomerResults(false)}
									>
										<Plus size={16} /> <span className="text-xs font-bold uppercase tracking-wider">Khách vãng lai mới</span>
									</button>
								</div>
							)}
						</div>

						{/* STATUS SELECT */}
						<div>
							<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 ml-1">TRẠNG THÁI ĐƠN</label>
							<div className="relative">
								<select
									className="w-full px-5 h-14 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/10 appearance-none transition-all"
									value={orderStatus}
									onChange={(e) => setOrderStatus(e.target.value)}
								>
									<option value="Đơn chốt">Đơn chốt</option>
									<option value="Đơn nháp">Đơn nháp</option>
									<option value="Đang giao">Đang giao</option>
								</select>
								<ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
							</div>
						</div>

						{/* NOTE */}
						<div className="md:col-span-2">
							<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 ml-1">GHI CHÚ ĐƠN HÀNG</label>
							<textarea
								rows={2}
								placeholder="Yêu cầu giao hàng sớm..."
								className="w-full p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/10 resize-none min-h-[100px] placeholder:text-slate-300 dark:placeholder:text-slate-600"
								value={orderNote}
								onChange={(e) => setOrderNote(e.target.value)}
							/>
						</div>
					</div>
				</div>

				{/* SECTION 2: PRODUCT LIST */}
				<div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
					<div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
						<h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">DANH SÁCH SẢN PHẨM</h3>
					</div>

					<div className="p-4 md:p-8 overflow-x-auto no-scrollbar">
						<table className="w-full min-w-[1000px]">
							<thead>
								<tr className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px] border-b border-slate-50 dark:border-slate-800">
									<th className="pb-4 text-left font-black w-[200px]">NGÀNH HÀNG</th>
									<th className="pb-4 text-left font-black w-[350px]">SẢN PHẨM</th>
									<th className="pb-4 text-center font-black w-24">SỐ LƯỢNG</th>
									<th className="pb-4 text-center font-black w-32">ĐƠN GIÁ</th>
									<th className="pb-4 text-center font-black w-20">KIỆN</th>
									<th className="pb-4 text-right font-black w-32">THÀNH TIỀN</th>
									<th className="pb-4 w-12"></th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-50 dark:divide-slate-800">
								{lineItems.map((item, index) => (
									<tr key={index} className="group transition-colors">
										<td className="py-6">
											<div className="relative group/select">
												<select
													className="w-full h-12 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 text-xs font-bold text-slate-900 dark:text-white appearance-none hover:border-[#f27121] transition-colors"
													value={item.category}
													onChange={(e) => updateLineItem(index, 'category', e.target.value)}
												>
													<option value="">Tìm ngành...</option>
													{categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
												</select>
												<ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
											</div>
										</td>
										<td className="py-6 pl-4">
											<div className="relative">
												<select
													className="w-full h-12 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 text-xs font-bold text-slate-900 dark:text-white appearance-none hover:border-[#f27121] transition-colors"
													value={item.productId}
													onChange={(e) => updateLineItem(index, 'productId', e.target.value)}
												>
													<option value="">Tìm SP...</option>
													{products
														.filter(p => !item.category || p.category === item.category)
														.map(p => (
															<option key={p.id} value={p.id} disabled={p.stock <= 0}>
																{p.name} {p.stock !== undefined ? `(Tồn: ${p.stock})` : ''}
															</option>
														))
													}
												</select>
												<ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
											</div>
										</td>
										<td className="py-6">
											<div className="flex justify-center px-4">
												<input
													type="number"
													className="w-16 h-12 text-center bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-[#f27121]"
													value={item.qty === 0 ? '' : item.qty}
													onChange={(e) => updateLineItem(index, 'qty', e.target.value === '' ? 0 : Number(e.target.value))}
													placeholder="0"
												/>
											</div>
										</td>
										<td className="py-6">
											<div className="flex justify-center px-2">
												<input
													type="number"
													className="w-full h-12 text-center bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-[10px] font-black text-slate-400 dark:text-slate-500"
													value={item.price === 0 ? '' : item.price}
													onChange={(e) => updateLineItem(index, 'price', e.target.value === '' ? 0 : Number(e.target.value))}
													placeholder="0"
												/>
											</div>
										</td>
										<td className="py-6 text-center">
											<span className="text-xs font-bold text-slate-900 dark:text-white">{item.packaging || '0'}</span>
										</td>
										<td className="py-6 text-right">
											<span className="text-xs font-black text-[#f27121]">{(item.price * item.qty).toLocaleString('vi-VN')} đ</span>
										</td>
										<td className="py-6 text-right pl-4">
											<button
												onClick={() => removeLineItem(index)}
												className="size-8 rounded-lg flex items-center justify-center text-rose-200 hover:bg-rose-50 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
											>
												<X size={16} />
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>

						<button
							onClick={addLineItem}
							className="w-full py-4 mt-6 border-2 border-dashed border-orange-100 dark:border-orange-900/30 rounded-2xl text-[#f27121] font-black text-xs uppercase tracking-[2px] flex items-center justify-center gap-2 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all active:scale-[0.99]"
						>
							<Plus size={16} strokeWidth={3} />
							+ THÊM SẢN PHẨM
						</button>
					</div>
				</div>

				{/* SECTION 3: ADJUSTMENTS & SUMMARY */}
				<div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm p-6 md:p-10 transition-colors duration-300">
					<div className="flex flex-col md:flex-row gap-8 md:gap-12">
						{/* ADJUSTMENTS LEFT */}
						<div className="flex-1 space-y-6">
							<h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">ĐIỀU CHỈNH ĐƠN HÀNG</h4>
							<div className="space-y-4">
								<div>
									<label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Phí vận chuyển (+)</label>
									<input
										type="number"
										placeholder="0"
										className="w-full h-14 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl px-6 text-sm font-bold text-slate-900 dark:text-white focus:ring-[#f27121]"
										value={shippingFee === 0 ? '' : shippingFee}
										onChange={(e) => setShippingFee(e.target.value === '' ? 0 : Number(e.target.value))}
									/>
								</div>
								<div>
									<label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Chiết khấu (-)</label>
									<input
										type="number"
										placeholder="0"
										className="w-full h-14 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl px-6 text-sm font-bold text-slate-900 dark:text-white focus:ring-[#f27121]"
										value={discountAmt === 0 ? '' : discountAmt}
										onChange={(e) => setDiscountAmt(e.target.value === '' ? 0 : Number(e.target.value))}
									/>
								</div>
							</div>
						</div>

						{/* SUMMARY RIGHT */}
						<div className="flex-1">
							<div className="space-y-4 text-right mb-10">
								<div className="flex justify-end gap-12">
									<span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase">Tiền hàng:</span>
									<span className="text-sm font-black text-slate-900 dark:text-white w-32 tabular-nums">{subTotal.toLocaleString('vi-VN')} đ</span>
								</div>
								{Number(shippingFee) > 0 && (
									<div className="flex justify-end gap-12">
										<span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase">Phí vận chuyển:</span>
										<span className="text-sm font-black text-slate-900 dark:text-white w-32 tabular-nums">+{Number(shippingFee).toLocaleString('vi-VN')} đ</span>
									</div>
								)}
								{Number(discountAmt) > 0 && (
									<div className="flex justify-end gap-12">
										<span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase">Chiết khấu:</span>
										<span className="text-sm font-black text-rose-600 w-32 tabular-nums">-{Number(discountAmt).toLocaleString('vi-VN')} đ</span>
									</div>
								)}
								<div className="flex justify-end gap-12">
									<span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase">Tổng trọng lượng:</span>
									<span className="text-sm font-black text-[#1a237e] dark:text-indigo-400 w-32 tabular-nums">{totalWeight.toFixed(2)} kg</span>
								</div>
							</div>

							<div className="text-right">
								<div className="text-4xl md:text-[56px] font-black text-[#00a859] leading-none mb-6 md:mb-8 tracking-tighter tabular-nums">
									{finalTotal.toLocaleString('vi-VN')} đ
								</div>
								<button
									onClick={handleConfirmOrder}
									className="w-full md:w-[350px] ml-auto h-16 bg-[#ffcc00] text-slate-900 rounded-2xl font-black text-sm uppercase tracking-[2px] shadow-xl shadow-yellow-500/10 hover:bg-[#fbc02d] transition-all active:scale-[0.98]"
								>
									XÁC NHẬN LÊN ĐƠN
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* STICKY BOTTOM BAR FOR MOBILE */}
			<div className="fixed bottom-24 left-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-100 dark:border-slate-800 p-4 flex items-center justify-between md:hidden z-[1001] shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-3xl animate-in slide-in-from-bottom-5 duration-700">
				<div className="flex flex-col">
					<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">TỔNG CỘNG:</span>
					<span className="text-xl font-black text-[#00a859] leading-none">{finalTotal.toLocaleString('vi-VN')} đ</span>
				</div>
				<button
					onClick={handleConfirmOrder}
					className="bg-[#ffcc00] text-slate-900 h-14 px-8 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-yellow-500/20 active:scale-95 transition-all"
				>
					LÊN ĐƠN
				</button>
			</div>

			<style dangerouslySetInnerHTML={{
				__html: `
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                select { background-image: none !important; }
            `}} />

			{/* SUCCESS MODAL */}
			{showSuccessModal && (
				<div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
					<div
						className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
						onClick={() => navigate('/orders')}
					></div>
					<div className="bg-white dark:bg-slate-900 rounded-[3rem] w-full max-w-md p-10 relative z-10 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
						<div className="flex flex-col items-center text-center">
							<div className="size-24 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-8 relative">
								<div className="absolute inset-0 bg-green-100 dark:bg-green-900/30 rounded-full animate-ping opacity-20"></div>
								<div className="size-16 bg-[#00a859] rounded-full flex items-center justify-center text-white shadow-lg shadow-green-200 dark:shadow-green-900/50">
									<CheckCircle size={32} strokeWidth={3} />
								</div>
							</div>

							<h3 className="text-3xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Thành Công!</h3>
							<p className="text-slate-500 dark:text-slate-400 font-medium mb-10 leading-relaxed px-4">
								{id ? 'Đơn hàng đã được cập nhật thay đổi thành công.' : 'Đơn hàng mới của bạn đã được ghi nhận vào hệ thống.'}
							</p>

							<div className="w-full space-y-3">
								<button
									onClick={() => navigate('/orders')}
									className="w-full h-14 bg-[#1A237E] dark:bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-900 dark:hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-indigo-900/20"
								>
									Xem danh sách đơn
								</button>
								<button
									onClick={() => {
										setShowSuccessModal(false);
										if (!id) {
											window.location.reload();
										}
									}}
									className="w-full h-14 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-300 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
								>
									{id ? 'Đóng thông báo' : 'Lên đơn mới'}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default QuickOrder;
