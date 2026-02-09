import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search, Plus, Minus, CheckCircle, Calculator as CalcIcon, Trash2, ShoppingCart, User, Package, MapPin, Truck, FileText, ChevronDown, X, Layers } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, auth } from '../services/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, getDoc, serverTimestamp, where } from 'firebase/firestore';
import Calculator from '../components/shared/Calculator';

const QuickOrder = () => {
	const navigate = useNavigate();
	const { id } = useParams();
	const [showCalc, setShowCalc] = useState(false);
	const [products, setProducts] = useState<any[]>([]);
	const [customers, setCustomers] = useState<any[]>([]);
	const [cart, setCart] = useState<any[]>([]);
	const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [fetchingOrder, setFetchingOrder] = useState(false);
	const [orderNote, setOrderNote] = useState('');
	const [adjustmentValue, setAdjustmentValue] = useState(0);
	const [discountValue, setDiscountValue] = useState(0);
	const [orderStatus, setOrderStatus] = useState('Đơn chốt');
	const [searchProductQuery, setSearchProductQuery] = useState('');
	const [searchCustomerQuery, setSearchCustomerQuery] = useState('');
	const [activeCategory, setActiveCategory] = useState('Tất cả');
	const [showCustomerResults, setShowCustomerResults] = useState(false);
	const [deliveryAddress, setDeliveryAddress] = useState('');
	const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
	const customerSearchRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const unsubscribe = auth.onAuthStateChanged((user) => {
			if (user) {
				// Fetch products
				const qProd = query(
					collection(db, 'products'),
					where('createdBy', '==', user.uid)
				);
				const unsubProd = onSnapshot(qProd, (snapshot: any) => {
					const docs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
					setProducts(docs);
					setLoading(false);
				});

				// Fetch customers
				const qCust = query(
					collection(db, 'customers'),
					where('createdBy', '==', user.uid)
				);
				const unsubCust = onSnapshot(qCust, (snapshot: any) => {
					const docs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
					setCustomers(docs);
				});

				return () => {
					unsubProd();
					unsubCust();
				};
			} else {
				setLoading(false);
			}
		});

		return () => unsubscribe();
	}, []);

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
						// Map stored items back to local cart format
						setCart((data.items || []).map((item: any) => ({
							...item,
							priceSell: item.price // Restore UI-expected key
						})));
						setOrderNote(data.note || '');
						setAdjustmentValue(data.adjustmentValue || 0);
						setDiscountValue(data.discountValue || 0);
						setOrderStatus(data.status || 'Đơn chốt');
						setDeliveryAddress(data.deliveryAddress || '');
						if (data.orderDate) {
							// If it's a Firestore timestamp
							if (data.orderDate.seconds) {
								setOrderDate(new Date(data.orderDate.seconds * 1000).toISOString().split('T')[0]);
							} else {
								setOrderDate(data.orderDate);
							}
						}

						const customer = customers.find(c => c.id === data.customerId);
						if (customer) {
							setSelectedCustomer(customer);
							setSearchCustomerQuery(customer.name);
						} else {
							setSearchCustomerQuery(data.customerName || '');
						}
					}
				} catch (err) {
					console.error("Error fetching order:", err);
				} finally {
					setFetchingOrder(false);
				}
			};
			fetchOrder();
		}
	}, [id, auth.currentUser, customers.length > 0]);

	// Auto-fill delivery address when customer is selected
	useEffect(() => {
		if (selectedCustomer) {
			setDeliveryAddress(selectedCustomer.address || '11.993350, 107.525646');
		} else {
			setDeliveryAddress('11.993350, 107.525646');
		}
	}, [selectedCustomer]);

	// Handle clicking outside customer search
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (customerSearchRef.current && !customerSearchRef.current.contains(event.target as Node)) {
				setShowCustomerResults(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const addToCart = (product: any, qty: number) => {
		if (qty <= 0) {
			setCart(prev => prev.filter(item => item.id !== product.id));
			return;
		}
		setCart(prev => {
			const existing = prev.find(item => item.id === product.id);
			if (existing) {
				return prev.map(item => item.id === product.id ? { ...item, qty } : item);
			}
			return [...prev, { ...product, qty }];
		});
	};

	const userCategories = ['Tất cả', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

	const subTotal = cart.reduce((sum, item) => sum + (item.priceSell * item.qty), 0);
	const taxRate = 0.08;
	// VAT is included in price, so we extract it for display: (Price * 8%) / 108%
	const taxMount = (subTotal * 8) / 108;
	const finalTotal = subTotal + adjustmentValue - discountValue;

	const totalWeight = cart.reduce((sum, item) => {
		const unit = item.unit?.toLowerCase();
		const density = parseFloat(item.density) || 0;
		if (unit === 'kg') return sum + item.qty;
		return sum + (item.qty * density);
	}, 0);

	const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

	const handleConfirmOrder = async () => {
		if (cart.length === 0) {
			alert("Vui lòng thêm sản phẩm vào đơn hàng");
			return;
		}

		try {
			const orderData: any = {
				customerName: selectedCustomer?.name || 'Khách vãng lai',
				customerId: selectedCustomer?.id || null,
				customerPhone: selectedCustomer?.phone || '',
				deliveryAddress: deliveryAddress,
				orderDate: orderDate,
				items: cart.map(item => ({
					id: item.id,
					name: item.name,
					price: item.priceSell,
					qty: item.qty,
					unit: item.unit,
					category: item.category,
					density: item.density
				})),
				subTotal,
				taxAmount: taxMount,
				adjustmentValue,
				discountValue,
				totalAmount: finalTotal,
				totalWeight,
				totalItems,
				note: orderNote,
				status: orderStatus,
				createdBy: auth.currentUser?.uid,
				createdByEmail: auth.currentUser?.email
			};

			if (id) {
				await updateDoc(doc(db, 'orders', id), {
					...orderData,
					updatedAt: serverTimestamp()
				});
				alert("Cập nhật đơn hàng thành công!");
			} else {
				orderData.createdAt = serverTimestamp();
				await addDoc(collection(db, 'orders'), orderData);
				alert("Tạo đơn hàng thành công!");
			}
			navigate('/orders');
		} catch (error) {
			console.error("Error saving order:", error);
			alert("Lỗi khi lưu đơn hàng");
		}
	};

	const getImageUrl = (url: string) => {
		if (!url) return '';
		if (url.includes('drive.google.com')) {
			const match = url.match(/[-\w]{25,}/);
			if (match) {
				return `https://drive.google.com/thumbnail?id=${match[0]}&sz=w1000`;
			}
		}
		return url;
	};

	const filteredCustomers = customers.filter(c =>
		c.name?.toLowerCase().includes(searchCustomerQuery.toLowerCase()) ||
		c.phone?.includes(searchCustomerQuery)
	);

	const filteredProducts = products.filter(p => {
		const matchesQuery = !searchProductQuery ||
			p.name?.toLowerCase().includes(searchProductQuery.toLowerCase()) ||
			p.sku?.toLowerCase().includes(searchProductQuery.toLowerCase());
		const matchesCategory = activeCategory === 'Tất cả' || p.category === activeCategory;
		return matchesQuery && matchesCategory;
	});

	return (
		<div className="flex h-screen w-full bg-[#f8f7f5] font-['Inter'] text-[#1c130d]">
			{/* SIDEBAR (Desktop) */}
			<aside className="hidden lg:flex w-64 flex-col bg-white border-r border-[#e8d8ce] h-full overflow-y-auto shrink-0">
				<div className="p-8">
					<h1 className="text-xl font-bold tracking-tight text-[#1c130d]">Dunvex <span className="text-[#f27121]">Build</span></h1>
					<p className="text-[#9c6949] text-xs font-medium uppercase tracking-widest mt-1">Quản lý bán hàng</p>
				</div>
				<nav className="flex-1 px-4 space-y-1.5">
					<button onClick={() => navigate('/')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[#9c6949] hover:bg-[#f4ece7] hover:text-[#1c130d] transition-all group">
						<span className="material-symbols-outlined text-xl group-hover:text-[#f27121]">home</span>
						<span className="text-sm font-semibold">Tổng quan</span>
					</button>
					<button onClick={() => navigate('/orders')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-[#f4ece7] text-[#f27121] transition-all">
						<span className="material-symbols-outlined text-xl fill-1">shopping_cart</span>
						<span className="text-sm font-bold">Đơn hàng</span>
					</button>
					<button onClick={() => navigate('/inventory')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[#9c6949] hover:bg-[#f4ece7] hover:text-[#1c130d] transition-all group">
						<span className="material-symbols-outlined text-xl group-hover:text-[#f27121]">inventory_2</span>
						<span className="text-sm font-semibold">Sản phẩm</span>
					</button>
					<button onClick={() => navigate('/customers')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[#9c6949] hover:bg-[#f4ece7] hover:text-[#1c130d] transition-all group">
						<span className="material-symbols-outlined text-xl group-hover:text-[#f27121]">group</span>
						<span className="text-sm font-semibold">Khách hàng</span>
					</button>
				</nav>
			</aside>

			<main className="flex-1 flex flex-col h-full overflow-hidden relative">
				{fetchingOrder && (
					<div className="absolute inset-0 z-[100] bg-white/80 backdrop-blur-sm flex items-center justify-center">
						<div className="flex flex-col items-center gap-3">
							<div className="size-12 border-4 border-[#f27121] border-t-transparent rounded-full animate-spin"></div>
							<p className="text-[#f27121] font-black text-xs uppercase tracking-[3px]">Đang tải dữ liệu đơn...</p>
						</div>
					</div>
				)}
				{/* HEADER */}
				<header className="h-16 md:h-20 bg-white border-b border-[#e8d8ce] px-4 md:px-8 flex items-center justify-between sticky top-0 z-40 shrink-0">
					<div className="flex items-center gap-4">
						<button onClick={() => navigate(-1)} className="size-10 flex items-center justify-center rounded-xl hover:bg-slate-50 text-slate-400 transition-colors border border-slate-100">
							<ArrowLeft size={20} />
						</button>
						<div className="hidden md:block">
							<h2 className="text-xl font-black text-[#1c130d] uppercase tracking-tight">
								{id ? 'Chỉnh Sửa Đơn Hàng' : 'Tạo Đơn Hàng'}
							</h2>
							<div className="flex items-center gap-4 mt-0.5">
								<div className="flex items-center gap-1.5">
									<span className="text-[10px] font-black text-[#9c6949] uppercase tracking-widest opacity-60">Trọng lượng:</span>
									<span className="text-xs font-black text-[#1A237E]">{totalWeight.toLocaleString('vi-VN')} kg</span>
								</div>
								<div className="size-1 rounded-full bg-slate-200"></div>
								<div className="flex items-center gap-1.5">
									<span className="text-[10px] font-black text-[#9c6949] uppercase tracking-widest opacity-60">Đóng gói:</span>
									<span className="text-xs font-black text-[#1A237E]">{totalItems} món</span>
								</div>
							</div>
						</div>
					</div>

					<div className="hidden md:flex items-center gap-3">
						<button className="px-6 h-11 bg-slate-100 text-[#1c130d] rounded-xl font-bold text-sm transition-all hover:bg-slate-200 uppercase tracking-widest">
							Lưu nháp
						</button>
						<button
							onClick={handleConfirmOrder}
							className="px-8 h-12 bg-[#f27121] text-white rounded-2xl font-black text-sm transition-all shadow-xl shadow-orange-500/20 hover:bg-orange-600 active:scale-95 flex items-center gap-2 uppercase tracking-[1px]"
						>
							{id ? 'CẬP NHẬT ĐƠN' : 'XÁC NHẬN ĐƠN'}
						</button>
					</div>
				</header>

				<div className="flex-1 overflow-y-auto px-4 py-6 md:p-8 bg-[#f8f7f5]">
					<div className="max-w-[1500px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 pb-24 md:pb-0">

						{/* LEFT COLUMN - PRODUCT PICKER & CUSTOMER */}
						<div className="lg:col-span-8 space-y-6">

							{/* CUSTOMER PICKER */}
							<div className="bg-white rounded-2xl border border-[#e8d8ce] shadow-sm p-6 overflow-visible">
								<div className="flex items-center justify-between mb-6">
									<div className="flex items-center gap-2">
										<div className="size-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#f27121]">
											<User size={20} />
										</div>
										<h3 className="text-lg font-black uppercase tracking-tight">Thông tin khách hàng</h3>
									</div>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-5" ref={customerSearchRef}>
									<div className="md:col-span-2 relative">
										<label className="block text-[10px] font-black text-[#9c6949] uppercase tracking-widest mb-1.5 ml-1">Tìm kiếm khách hàng</label>
										<div className="relative">
											<Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
											<input
												type="text"
												placeholder="Tên, SĐT hoặc Mã khách..."
												className="w-full pl-12 pr-4 h-12 bg-[#fcf9f8] border border-[#e8d8ce] rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#f27121]/20 focus:border-[#f27121] transition-all"
												value={searchCustomerQuery}
												onChange={(e) => {
													setSearchCustomerQuery(e.target.value);
													setShowCustomerResults(true);
												}}
												onFocus={() => setShowCustomerResults(true)}
											/>
										</div>
										{showCustomerResults && searchCustomerQuery && (
											<div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-[#e8d8ce] rounded-2xl shadow-2xl max-h-60 overflow-y-auto">
												{filteredCustomers.map(c => (
													<button
														key={c.id}
														className="w-full px-6 py-4 text-left hover:bg-orange-50 flex items-center justify-between border-b border-slate-50 last:border-none group"
														onClick={() => {
															setSelectedCustomer(c);
															setSearchCustomerQuery(c.name);
															setShowCustomerResults(false);
														}}
													>
														<div>
															<p className="font-black text-sm uppercase group-hover:text-[#f27121]">{c.name}</p>
															<p className="text-xs text-slate-400 font-medium">{c.phone}</p>
														</div>
														<CheckCircle size={18} className="text-slate-200 group-hover:text-[#f27121]" />
													</button>
												))}
											</div>
										)}
									</div>
									<div className="md:col-span-1">
										<label className="block text-[10px] font-black text-[#9c6949] uppercase tracking-widest mb-1.5 ml-1">Ngày lên đơn</label>
										<input
											type="date"
											className="w-full px-4 h-12 bg-[#fcf9f8] border border-[#e8d8ce] rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#f27121]/20 focus:border-[#f27121] transition-all"
											value={orderDate}
											onChange={(e) => setOrderDate(e.target.value)}
										/>
									</div>
									<div className="md:col-span-1">
										<label className="block text-[10px] font-black text-[#9c6949] uppercase tracking-widest mb-1.5 ml-1">Trạng thái xử lý</label>
										<select
											className="w-full px-4 h-12 bg-[#fcf9f8] border border-[#e8d8ce] rounded-xl text-xs font-black focus:ring-2 focus:ring-[#f27121]/20 appearance-none transition-all"
											value={orderStatus}
											onChange={(e) => setOrderStatus(e.target.value)}
										>
											<option value="Đơn chốt">ĐƠN CHỐT</option>
											<option value="Đơn nháp">ĐƠN NHÁP</option>
										</select>
									</div>
								</div>
							</div>

							{/* PRODUCT PICKER GRID (The "Boxes" requested) */}
							<div className="bg-white rounded-3xl border border-[#e8d8ce] shadow-sm p-6 space-y-6">
								<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
									<div className="flex items-center gap-2">
										<div className="size-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#f27121]">
											<Package size={20} />
										</div>
										<h3 className="text-lg font-black uppercase tracking-tight">Chọn sản phẩm</h3>
									</div>
									<div className="flex items-center gap-2 w-full md:w-auto">
										<div className="relative flex-1 md:w-64">
											<Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
											<input
												type="text"
												placeholder="Tìm nhanh..."
												className="w-full pl-10 pr-4 h-10 bg-[#fcf9f8] border border-[#e8d8ce] rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#f27121]/10"
												value={searchProductQuery}
												onChange={(e) => setSearchProductQuery(e.target.value)}
											/>
										</div>
									</div>
								</div>

								{/* Categories Pills */}
								<div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
									{userCategories.map(cat => (
										<button
											key={cat}
											onClick={() => setActiveCategory(cat)}
											className={`px-5 h-9 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shrink-0 border ${activeCategory === cat ? 'bg-[#f27121] text-white border-[#f27121] shadow-lg shadow-orange-500/20' : 'bg-white text-slate-500 border-[#e8d8ce] hover:border-[#f27121] hover:text-[#f27121]'}`}
										>
											{cat}
										</button>
									))}
								</div>

								{/* The Grid of Boxes */}
								<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
									{filteredProducts.length > 0 ? filteredProducts.map(p => {
										const inCart = cart.find(item => item.id === p.id);
										return (
											<button
												key={p.id}
												onClick={() => addToCart(p, (inCart?.qty || 0) + 1)}
												className={`relative group p-3 md:p-4 rounded-2xl border-2 transition-all text-left flex flex-col h-full bg-[#fcf9f8] ${inCart ? 'border-[#f27121] bg-orange-50/30' : 'border-transparent hover:border-orange-200 hover:bg-white hover:shadow-xl'}`}
											>
												{inCart && (
													<div className="absolute -top-2 -right-2 size-6 rounded-full bg-[#f27121] text-white flex items-center justify-center text-[10px] font-black shadow-lg z-10 border-2 border-white">
														{inCart.qty}
													</div>
												)}
												<div className="size-full flex flex-col">
													<div className="aspect-square rounded-xl bg-white border border-slate-100 mb-3 flex items-center justify-center overflow-hidden shrink-0">
														{p.imageUrl ? <img src={getImageUrl(p.imageUrl)} className="size-full object-cover" alt={p.name} /> : <span className="material-symbols-outlined text-slate-200 text-3xl font-light">image</span>}
													</div>
													<div className="flex-1 flex flex-col">
														<p className="text-[10px] font-black text-[#9c6949] uppercase tracking-widest mb-1 opacity-60 truncate">{p.category}</p>
														<h4 className="text-xs font-black uppercase text-slate-900 leading-tight mb-2 line-clamp-2 md:group-hover:text-[#f27121] transition-colors">{p.name}</h4>
														<div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between">
															<span className="text-[11px] font-black text-[#f27121]">{p.priceSell.toLocaleString('vi-VN')} đ</span>
															<span className="text-[9px] font-black text-slate-400 uppercase">/ {p.unit}</span>
														</div>
													</div>
												</div>
											</button>
										);
									}) : (
										<div className="col-span-full py-20 text-center">
											<div className="flex flex-col items-center opacity-20">
												<Package size={48} className="mb-4" />
												<p className="font-black uppercase tracking-[3px] text-xs">Không có sản phẩm</p>
											</div>
										</div>
									)}
								</div>
							</div>

							{/* THE ORDER LIST (Cart Items) */}
							<div className="bg-white rounded-3xl border border-[#e8d8ce] shadow-sm overflow-hidden">
								<div className="p-6 border-b border-slate-50 flex items-center gap-2">
									<div className="size-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#f27121]">
										<ShoppingCart size={20} />
									</div>
									<h3 className="text-lg font-black uppercase tracking-tight text-slate-900">Chi tiết đơn hàng</h3>
									<span className="ml-auto bg-slate-100 text-slate-500 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider">{cart.length} sản phẩm</span>
								</div>

								<div className="overflow-x-auto">
									<table className="w-full text-left border-collapse">
										<thead className="bg-[#fcf9f8] border-b border-[#e8d8ce]">
											<tr>
												<th className="px-6 py-4 text-[10px] font-black text-[#9c6949] uppercase tracking-widest">Sản phẩm</th>
												<th className="px-4 py-4 text-[10px] font-black text-[#9c6949] uppercase tracking-widest text-center">ĐVT</th>
												<th className="px-6 py-4 text-[10px] font-black text-[#9c6949] uppercase tracking-widest text-center w-36">Số lượng</th>
												<th className="px-6 py-4 text-[10px] font-black text-[#9c6949] uppercase tracking-widest text-right">Thành tiền</th>
												<th className="px-5 py-4 w-10"></th>
											</tr>
										</thead>
										<tbody className="divide-y divide-slate-50">
											{cart.length === 0 ? (
												<tr>
													<td colSpan={5} className="py-20 text-center">
														<p className="text-xs font-black uppercase tracking-widest text-slate-300">Nhấp chọn sản phẩm ở trên để thêm vào đơn</p>
													</td>
												</tr>
											) : cart.map(item => (
												<tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
													<td className="px-6 py-5">
														<p className="text-sm font-black text-slate-900 uppercase leading-snug">{item.name}</p>
														<p className="text-[9px] font-bold text-[#f27121] uppercase mt-1 tracking-wider">{item.category}</p>
													</td>
													<td className="px-4 py-5 text-center">
														<span className="text-[10px] font-black text-slate-500 uppercase">{item.unit}</span>
													</td>
													<td className="px-6 py-5">
														<div className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
															<button onClick={() => addToCart(item, item.qty - 1)} className="size-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:text-red-500 transition-all"><Minus size={12} strokeWidth={3} /></button>
															<input
																type="number" step="any" className="w-12 bg-transparent border-none text-center p-0 text-xs font-black text-slate-900 focus:ring-0"
																value={item.qty === 0 ? '' : item.qty} placeholder="0" onFocus={(e) => e.target.select()} onChange={(e) => addToCart(item, parseFloat(e.target.value) || 0)}
															/>
															<button onClick={() => addToCart(item, item.qty + 1)} className="size-8 flex items-center justify-center rounded-lg bg-slate-900 text-white shadow-lg active:scale-95 transition-all"><Plus size={12} strokeWidth={3} /></button>
														</div>
													</td>
													<td className="px-6 py-5 text-right font-black text-sm tabular-nums text-slate-900">{(item.qty * item.priceSell).toLocaleString('vi-VN')}</td>
													<td className="px-5 py-5 text-center">
														<button onClick={() => addToCart(item, 0)} className="size-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						</div>

						{/* RIGHT COLUMN - SUMMARY & LOCATION */}
						<div className="lg:col-span-4 space-y-6">

							{/* DELIVERY LOCATION */}
							<div className="bg-white rounded-3xl border border-[#e8d8ce] shadow-md overflow-hidden">
								<div className="p-5 border-b border-[#e8d8ce] bg-[#fcf9f8] flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Truck size={18} className="text-[#f27121]" />
										<h3 className="text-sm font-black uppercase tracking-widest leading-none">Giao hàng</h3>
									</div>
									<div className="px-3 py-1 bg-orange-50 rounded-lg text-[10px] font-black text-[#f27121] uppercase tracking-widest">Dự kiến</div>
								</div>
								<div className="relative h-48 bg-slate-100 overflow-hidden flex items-center justify-center group">
									<MapPin size={32} className="text-red-500 drop-shadow-xl animate-bounce relative z-10" />
									<div className="absolute inset-0 bg-slate-200 opacity-40 group-hover:opacity-70 transition-opacity flex items-center justify-center font-black text-slate-400 text-[10px] tracking-[4px]">Hệ thống bản đồ</div>
								</div>
								<div className="p-6 space-y-5">
									<div>
										<label className="block text-[10px] font-black text-[#9c6949] uppercase mb-2 tracking-widest ml-1 opacity-60">Địa chỉ / Tọa độ (Lat, Long)</label>
										<div className="relative">
											<MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#f27121]" />
											<input
												type="text"
												placeholder="Nhập địa chỉ hoặc tọa độ..."
												className="w-full pl-12 pr-4 h-12 bg-white border border-[#e8d8ce] rounded-xl text-xs font-bold focus:ring-4 focus:ring-orange-500/10 focus:border-[#f27121] transition-all"
												value={deliveryAddress}
												onChange={(e) => setDeliveryAddress(e.target.value)}
											/>
										</div>
									</div>
									<div className="flex items-center justify-between text-xs pt-1">
										<span className="text-[#9c6949] font-black uppercase tracking-[1px] opacity-60 italic">Phí vận chuyển:</span>
										<div className="flex items-center gap-2 border-b-2 border-slate-100 pb-1 px-2">
											<input type="number" className="w-24 text-right bg-transparent border-none p-0 focus:ring-0 text-sm font-black text-slate-900" value={adjustmentValue || ''} placeholder="0" onChange={(e) => setAdjustmentValue(Number(e.target.value))} />
											<span className="font-black text-slate-400 text-[10px] uppercase">đ</span>
										</div>
									</div>
									<div className="flex items-center justify-between text-xs pt-1">
										<span className="text-red-400 font-black uppercase tracking-[1px] opacity-70 italic">Chiết khấu (-):</span>
										<div className="flex items-center gap-2 border-b-2 border-slate-100 pb-1 px-2">
											<input type="number" className="w-24 text-right bg-transparent border-none p-0 focus:ring-0 text-sm font-black text-red-600" value={discountValue || ''} placeholder="0" onChange={(e) => setDiscountValue(Number(e.target.value))} />
											<span className="font-black text-slate-400 text-[10px] uppercase">đ</span>
										</div>
									</div>
								</div>
							</div>

							{/* SUMMARY CARD */}
							<div className="bg-[#1c130d] rounded-3xl shadow-2xl p-8 overflow-hidden relative text-white">
								<div className="absolute top-0 right-0 w-48 h-48 bg-orange-500 rounded-full blur-[100px] -mr-24 -mt-24 opacity-30"></div>
								<div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-600 rounded-full blur-[80px] -ml-16 -mb-16 opacity-20"></div>

								<h3 className="text-lg font-black mb-8 flex items-center gap-3 relative z-10 uppercase tracking-widest">
									<FileText size={22} className="text-[#f27121]" />
									Tổng kết đơn
								</h3>

								<div className="space-y-5 mb-8 relative z-10">
									<div className="flex justify-between items-center px-1">
										<span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tạm tính (Gồm VAT)</span>
										<span className="text-sm font-black tabular-nums">{subTotal.toLocaleString('vi-VN')}</span>
									</div>
									{discountValue > 0 && (
										<div className="flex justify-between items-center px-1">
											<span className="text-xs font-bold text-red-400 uppercase tracking-widest">Chiết khấu giảm</span>
											<span className="text-sm font-black tabular-nums text-red-400">-{discountValue.toLocaleString('vi-VN')}</span>
										</div>
									)}
									{adjustmentValue > 0 && (
										<div className="flex justify-between items-center px-1">
											<span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Phí vận chuyển</span>
											<span className="text-sm font-black tabular-nums">+{adjustmentValue.toLocaleString('vi-VN')}</span>
										</div>
									)}
									<div className="flex justify-between items-center px-1 opacity-40">
										<span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">Thuế VAT (8%) [Đã bao gồm]</span>
										<span className="text-[10px] font-black tabular-nums italic">{taxMount.toLocaleString('vi-VN')}</span>
									</div>
									<div className="h-px bg-white/10 my-4"></div>
									<div className="flex flex-col gap-1 items-end px-1">
										<span className="text-[10px] font-black text-orange-500 uppercase tracking-[3px] mb-1">Tổng thanh toán</span>
										<p className="text-3xl font-black text-white leading-none tabular-nums tracking-tighter">{finalTotal.toLocaleString('vi-VN')} đ</p>
										<p className="text-[9px] font-bold text-slate-500 mt-2 uppercase tracking-widest">Đã bao gồm thuế giá trị gia tăng</p>
									</div>
								</div>

								<div className="space-y-4 relative z-10">
									<textarea
										rows={2}
										placeholder="Ghi chú đơn hàng..."
										className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-medium focus:ring-2 focus:ring-[#f27121]/50 focus:border-[#f27121] transition-all resize-none text-white placeholder-slate-600 mb-2"
										value={orderNote}
										onChange={(e) => setOrderNote(e.target.value)}
									/>
									<button
										onClick={handleConfirmOrder}
										className="w-full h-16 bg-[#f27121] text-white rounded-2xl font-black text-sm uppercase tracking-[3px] shadow-2xl shadow-orange-500/40 hover:bg-orange-600 transition-all active:scale-95 flex items-center justify-center gap-3"
									>
										XÁC NHẬN ĐƠN
										<CheckCircle size={20} strokeWidth={3} />
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* MOBILE STICKY BOTTOM BAR */}
				<div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#e8d8ce] p-4 shadow-[0_-15px_40px_rgba(0,0,0,0.08)] z-50 flex items-center gap-4">
					<div className="flex flex-col">
						<span className="text-[10px] font-black text-[#9c6949] uppercase tracking-widest leading-none mb-1 opacity-60 text-left">Thanh toán</span>
						<span className="text-xl font-black text-[#f27121] leading-none tabular-nums tracking-tight">{finalTotal.toLocaleString('vi-VN')} đ</span>
					</div>
					<button
						onClick={handleConfirmOrder}
						className="flex-1 h-14 bg-[#f27121] text-white rounded-2xl font-black text-xs uppercase tracking-[2px] shadow-xl shadow-orange-500/20 active:scale-95 transition-all"
					>
						ĐẶT HÀNG
					</button>
				</div>

				{showCalc && <Calculator onClose={() => setShowCalc(false)} onConfirm={(val) => { console.log(val); setShowCalc(false); }} />}
			</main>
		</div>
	);
};

export default QuickOrder;
