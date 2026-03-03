import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search, Plus, Minus, Trash2, ShoppingCart, User, Package, MapPin, Truck, FileText, ChevronDown, X, Layers, CheckCircle, Mail, RotateCcw, QrCode, Ticket, Tag } from 'lucide-react';
import QRScanner from '../components/shared/QRScanner';
import { useNavigate, useParams } from 'react-router-dom';
import { db, auth } from '../services/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, getDoc, serverTimestamp, where, increment, writeBatch, getDocs, limit } from 'firebase/firestore';
import { useOwner } from '../hooks/useOwner';
import { useToast } from '../components/shared/Toast';

const QuickOrder = () => {
	const navigate = useNavigate();
	const { id } = useParams();
	const owner = useOwner();
	const { showToast } = useToast();
	const normalizeText = (text: string) => text ? text.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase() : '';
	const vibrate = (pattern: number | number[]) => {
		if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
			window.navigator.vibrate(pattern);
		}
	};
	const removeAccents = (str: string) => {
		return str.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/đ/g, 'd')
			.replace(/Đ/g, 'D');
	};
	const isMatch = (target: string, query: string) => {
		const t = normalizeText(target);
		const q = normalizeText(query);
		return t.includes(q) || removeAccents(t).includes(removeAccents(q));
	};
	const [products, setProducts] = useState<any[]>([]);
	const [customers, setCustomers] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [fetchingOrder, setFetchingOrder] = useState(false);
	const [sendEmail, setSendEmail] = useState(false);
	const [showSuccessModal, setShowSuccessModal] = useState(false);
	const [showScanner, setShowScanner] = useState(false);

	// Form state
	const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
	const [searchCustomerQuery, setSearchCustomerQuery] = useState('');
	const [showCustomerResults, setShowCustomerResults] = useState(false);
	const [orderStatus, setOrderStatus] = useState('Đơn chốt');
	const [orderNote, setOrderNote] = useState('');
	const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);

	// Line items state
	const [lineItems, setLineItems] = useState<any[]>([
		{ id: Date.now(), category: '', productId: '', name: '', qty: '', price: 0, buyPrice: 0, unit: '', packaging: '', density: '', maxStock: 0 }
	]);

	// Adjustments
	const [shippingFee, setShippingFee] = useState(0);
	const [discountAmt, setDiscountAmt] = useState(0);
	const [couponCode, setCouponCode] = useState('');

	const customerSearchRef = useRef<HTMLDivElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);

	// Custom Dropdown State
	const [activeRow, setActiveRow] = useState<number | null>(null);
	const [activeField, setActiveField] = useState<'category' | 'productId' | null>(null);
	const [lineSearchQuery, setLineSearchQuery] = useState('');

	// Handle outside click for custom dropdowns
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setActiveRow(null);
				setActiveField(null);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);
	// Fetch Data (Products & Customers) based on Owner
	useEffect(() => {
		if (owner.loading || !owner.ownerId) return;

		const isAdmin = owner.role?.toLowerCase() === 'admin' || !owner.isEmployee;

		const qProds = query(collection(db, 'products'), where('ownerId', '==', owner.ownerId));
		const unsubProds = onSnapshot(qProds, (snap) => {
			setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		});

		let qCusts;
		if (isAdmin) {
			qCusts = query(
				collection(db, 'customers'),
				where('ownerId', '==', owner.ownerId)
			);
		} else {
			qCusts = query(
				collection(db, 'customers'),
				where('ownerId', '==', owner.ownerId),
				where('createdByEmail', '==', auth.currentUser?.email)
			);
		}

		const unsubCusts = onSnapshot(qCusts, (snap) => {
			setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		});

		setLoading(false);
		return () => {
			unsubProds();
			unsubCusts();
		};
	}, [owner.loading, owner.ownerId, owner.role, owner.isEmployee]);

	// Fetch Order for Editing
	useEffect(() => {
		if (id && owner.ownerId && customers.length > 0) {
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

						setOrderDate(data.orderDate || new Date().toISOString().split('T')[0]);
						setOrderStatus(data.status || 'Đơn chốt');
						setOrderNote(data.note || '');
						setShippingFee(data.adjustmentValue || 0);
						setDiscountAmt(data.discountValue || 0);

						// Set Customer
						const foundCust = customers.find(c => c.id === data.customerId);
						if (foundCust) {
							setSelectedCustomer(foundCust);
							setSearchCustomerQuery(foundCust.name);
						} else {
							setSearchCustomerQuery(data.customerName || '');
						}
					}
				} catch (err) {
					// Silent fail or handle appropriately
				} finally {
					setFetchingOrder(false);
				}
			};
			fetchOrder();
		}
	}, [id, owner.ownerId, customers.length]);

	const addLineItem = () => {
		setLineItems([...lineItems, { id: Date.now(), category: '', productId: '', sku: '', name: '', qty: '', price: 0, buyPrice: 0, unit: '', packaging: '', density: '', maxStock: 0 }]);
	};

	const removeLineItem = (index: number) => {
		if (lineItems.length > 1) {
			setLineItems(lineItems.filter((_, i) => i !== index));
		}
	};

	const getEffectiveStock = (prod: any) => {
		if (!prod) return 0;
		// 1. Prioritize explicit manual link
		if (prod.linkedProductId) {
			const linked = products.find(p => p.id === prod.linkedProductId);
			return linked?.stock || 0;
		}
		// 2. Fallback to SKU-based link (Sum all products with same SKU that have no linkedProductId)
		if (prod.sku && String(prod.sku).trim()) {
			const sku = String(prod.sku).trim().toLowerCase();
			const skuMasterProducts = products.filter(p =>
				p.sku &&
				String(p.sku).trim().toLowerCase() === sku &&
				!p.linkedProductId
			);
			const totalStock = skuMasterProducts.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
			return totalStock;
		}
		return prod.stock || 0;
	};

	// Helper to find the best source of stock for a given product when deducting
	const getStockSourceId = (sourceProductId: string) => {
		const sourceProduct = products.find(p => p.id === sourceProductId);
		if (sourceProduct?.linkedProductId) {
			return sourceProduct.linkedProductId;
		}
		if (sourceProduct?.sku && String(sourceProduct.sku).trim()) {
			const sku = String(sourceProduct.sku).trim().toLowerCase();
			// Find all potential masters for this SKU (exclude those explicitly linked elsewhere)
			const masters = products.filter(p =>
				p.sku &&
				String(p.sku).trim().toLowerCase() === sku &&
				!p.linkedProductId
			);
			// Pick the one with the CURRENT MOST stock as the official source to deduct from
			if (masters.length > 0) {
				const bestMaster = [...masters].sort((a, b) => (Number(b.stock) || 0) - (Number(a.stock) || 0))[0];
				return bestMaster.id;
			}
		}
		return sourceProductId;
	};

	const updateLineItem = (index: number, field: string, value: any) => {
		const newItems = [...lineItems];
		newItems[index][field] = value;

		if (field === 'productId') {
			const prod = products.find(p => p.id === value);
			if (prod) {
				newItems[index].name = prod.name;
				newItems[index].sku = prod.sku || '';
				newItems[index].price = prod.priceSell;
				newItems[index].buyPrice = prod.priceBuy || 0; // Capture current buy price
				newItems[index].unit = prod.unit;
				newItems[index].category = prod.category;
				newItems[index].packaging = prod.packaging;
				newItems[index].density = prod.density;
				newItems[index].maxStock = getEffectiveStock(prod);
			}
		}
		setLineItems(newItems);
	};


	const handleQRScan = (productId: string) => {
		const product = products.find(p => p.id === productId);
		if (product) {
			vibrate(50); // Short tap feedback
			// Find first empty item or add new one
			const emptyIdx = lineItems.findIndex(item => !item.productId);
			if (emptyIdx !== -1) {
				updateLineItem(emptyIdx, 'productId', product.id);
			} else {
				setLineItems([
					...lineItems,
					{
						id: Date.now(),
						category: product.category || '',
						productId: product.id,
						sku: product.sku || '',
						name: product.name,
						qty: 1,
						price: product.priceSell,
						buyPrice: product.priceBuy || 0,
						unit: product.unit,
						packaging: product.packaging,
						density: product.density,
						maxStock: getEffectiveStock(product)
					}
				]);
			}
		} else {
			showToast(`Không tìm thấy sản phẩm với mã ID: ${productId}`, "warning");
		}
	};

	const handleApplyCoupon = async () => {
		if (!couponCode) {
			showToast("Vui lòng nhập mã giảm giá", "warning");
			return;
		}

		try {
			const q = query(
				collection(db, 'coupons'),
				where('ownerId', '==', owner.ownerId),
				where('code', '==', couponCode.toUpperCase().trim()),
				limit(1)
			);
			const querySnapshot = await getDocs(q);

			if (querySnapshot.empty) {
				showToast("Mã giảm giá không tồn tại hoặc không hợp lệ", "error");
				return;
			}

			const coupon = querySnapshot.docs[0].data();

			// Validation
			if (coupon.status !== 'active') {
				showToast("Mã giảm giá này hiện không khả dụng", "warning");
				return;
			}

			const today = new Date().toISOString().split('T')[0];
			if (coupon.expiry && coupon.expiry < today) {
				showToast("Mã giảm giá đã hết hạn sử dụng", "warning");
				return;
			}

			if (coupon.usageLimit > 0 && (coupon.usageCount || 0) >= coupon.usageLimit) {
				showToast("Mã giảm giá đã đạt giới hạn lượt sử dụng", "warning");
				return;
			}

			// Calculate Discount
			let discount = 0;
			const discountVal = parseFloat(coupon.discount) || 0;

			if (coupon.type === 'percentage') {
				discount = subTotal * (discountVal / 100);
			} else if (coupon.type === 'fixed') {
				discount = discountVal;
			} else if (coupon.type === 'shipping') {
				discount = Number(shippingFee);
			}

			setDiscountAmt(discount);
			showToast(`Đã áp dụng: ${coupon.title}`, "success");

		} catch (error) {
			showToast("Lỗi khi áp dụng mã: " + error, "error");
		}
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

	const formatPrice = (num: number) => {
		return new Intl.NumberFormat('vi-VN').format(num || 0);
	};

	const copyToClipboard = (text: string, label: string = 'mã') => {
		if (!text || text === 'N/A' || text === '---') return;
		navigator.clipboard.writeText(text).then(() => {
			showToast(`Đã copy ${label}: ${text}`, "success");
		}).catch(() => {
			showToast("Không thể copy. Vui lòng thử lại.", "error");
		});
	};

	const handleConfirmOrder = async () => {
		const validItems = lineItems.filter(item => item.productId && item.qty > 0);
		if (validItems.length === 0) {
			showToast("Vui lòng thêm sản phẩm vào đơn hàng", "warning");
			return;
		}

		try {
			const orderData: any = {
				customerName: selectedCustomer?.name || searchCustomerQuery || 'Khách vãng lai',
				customerId: selectedCustomer?.id || null,
				customerPhone: selectedCustomer?.phone || '',
				customerBusinessName: selectedCustomer?.businessName || '',
				orderDate: orderDate,
				items: validItems.map(item => ({
					id: item.productId,
					sku: item.sku || '',
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
				couponCode: couponCode || null,
				// NEW FIELDS FOR OWNER TRACKING
				ownerId: owner.ownerId,
				ownerEmail: owner.ownerEmail,
				createdBy: auth.currentUser?.uid || '',
				createdByEmail: auth.currentUser?.email || '',
			};

			if (id) {
				const batch = writeBatch(db);

				// 1. Update Order
				batch.update(doc(db, 'orders', id), {
					...orderData,
					updatedAt: serverTimestamp()
				});

				// 2. Sync Inventory: Revert old logs and apply new ones
				// Since we can't query inside a batch, we fetch existing logs first
				const existingLogsQ = query(
					collection(db, 'inventory_logs'),
					where('orderId', '==', id)
				);
				const existingLogsSnap = await getDocs(existingLogsQ);

				// Revert previous stock changes (from all previous logs)
				for (const logDoc of existingLogsSnap.docs) {
					const logData = logDoc.data();
					if (logData.productId && logData.qty) {
						const oldProdRef = doc(db, 'products', logData.productId);
						const oldProdSnap = await getDoc(oldProdRef);
						if (oldProdSnap.exists()) {
							batch.update(oldProdRef, {
								stock: increment(logData.qty) // Revert the deduction
							});
						}
					}
					batch.delete(logDoc.ref);
				}

				// Apply NEW stock changes ONLY IF status is 'Đơn chốt' or 'Đang giao'
				if (orderStatus === 'Đơn chốt' || orderStatus === 'Đang giao') {
					validItems.forEach(item => {
						if (item.productId) {
							const stockProductId = getStockSourceId(item.productId);

							const prodRef = doc(db, 'products', stockProductId);
							batch.update(prodRef, {
								stock: increment(-item.qty)
							});

							const invLogRef = doc(collection(db, 'inventory_logs'));
							batch.set(invLogRef, {
								productId: stockProductId,
								orderId: id,
								customerName: orderData.customerName,
								productName: item.name,
								type: 'out',
								qty: item.qty,
								note: `Cập nhật đơn hàng cho ${orderData.customerName}`,
								ownerId: owner.ownerId,
								user: auth.currentUser?.displayName || auth.currentUser?.email,
								createdAt: serverTimestamp()
							});
						}
					});
				}

				// 3. Log Audit
				const auditRef = doc(collection(db, 'audit_logs'));
				batch.set(auditRef, {
					action: 'Cập nhật đơn hàng',
					user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
					userId: auth.currentUser?.uid,
					ownerId: owner.ownerId,
					details: `Đã cập nhật đơn hàng: ${orderData.customerName} - Tổng: ${finalTotal.toLocaleString('vi-VN')} đ`,
					createdAt: serverTimestamp()
				});

				await batch.commit();
			}
			else {
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
					userId: owner.ownerId, // Notify the Owner
					read: false,
					createdAt: serverTimestamp()
				});

				// 3. Deduct Stock & Create Inventory Logs ONLY IF status is 'Đơn chốt' or 'Đang giao'
				if (orderStatus === 'Đơn chốt' || orderStatus === 'Đang giao') {
					validItems.forEach(item => {
						// Only decrement for saved products (have productId from DB)
						if (item.productId) {
							// Determine stock source using standardized helper
							const stockProductId = getStockSourceId(item.productId);

							const prodRef = doc(db, 'products', stockProductId);
							batch.update(prodRef, {
								stock: increment(-item.qty)
							});

							// Add Inventory Log
							const invLogRef = doc(collection(db, 'inventory_logs'));
							batch.set(invLogRef, {
								productId: stockProductId,
								orderId: newOrderRef.id,
								customerName: orderData.customerName,
								productName: item.name,
								type: 'out',
								qty: item.qty,
								note: `Xuất đơn hàng cho ${orderData.customerName}`,
								ownerId: owner.ownerId,
								user: auth.currentUser?.displayName || auth.currentUser?.email,
								createdAt: serverTimestamp()
							});
						}
					});
				}

				// 4. Update Coupon Usage if applicable
				if (couponCode) {
					const couponQ = query(
						collection(db, 'coupons'),
						where('ownerId', '==', owner.ownerId),
						where('code', '==', couponCode.toUpperCase().trim()),
						limit(1)
					);
					const couponSnap = await getDocs(couponQ);
					if (!couponSnap.empty) {
						batch.update(doc(db, 'coupons', couponSnap.docs[0].id), {
							usageCount: increment(1)
						});
					}
				}

				// 5. Log Audit
				const logRef = doc(collection(db, 'audit_logs'));
				batch.set(logRef, {
					action: 'Lên đơn hàng mới',
					user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
					userId: auth.currentUser?.uid,
					ownerId: owner.ownerId,
					details: `Đã tạo đơn hàng cho ${orderData.customerName} - Tổng tiền: ${finalTotal.toLocaleString('vi-VN')} đ${couponCode ? ` (Mã: ${couponCode})` : ''}`,
					createdAt: serverTimestamp()
				});

				await batch.commit();
			}
			// 6. Show Success
			vibrate([100, 50, 100]); // Victory pattern
			setShowSuccessModal(true);
		} catch (error) {
			showToast("Lỗi khi lưu đơn hàng: " + error, "error");
		}
	};

	const filteredCustomers = customers.filter(c =>
		String(c.name || '').toLowerCase().includes(searchCustomerQuery.toLowerCase()) ||
		String(c.businessName || '').toLowerCase().includes(searchCustomerQuery.toLowerCase()) ||
		String(c.phone || '').includes(searchCustomerQuery)
	);

	const categories = Array.from(new Map([
		'Tôn lợp', 'Xà gồ', 'Sắt hộp', 'Phụ kiện', 'Inox',
		...products.map(p => p.category)
	].filter(Boolean).map(cat => [normalizeText(cat), cat])).values()).sort((a: any, b: any) => String(a).localeCompare(String(b)));

	const hasOrderPermission = owner.role === 'admin' || (owner.accessRights?.orders_create ?? true);

	if (owner.loading) return null;

	if (!hasOrderPermission) {
		return (
			<div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-slate-950 items-center justify-center text-center p-8 min-h-screen">
				<div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-full text-red-500 mb-4">
					<ShoppingCart size={48} />
				</div>
				<h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase mb-2">Quyền hạn hạn chế</h2>
				<p className="text-slate-500 dark:text-slate-400 max-w-md">
					Bạn không có quyền thực hiện thao tác Lên đơn hàng / Cập nhật đơn hàng. Vui lòng liên hệ Admin.
				</p>
				<button onClick={() => navigate(-1)} className="mt-6 bg-[#1A237E] text-white px-6 py-2 rounded-xl font-bold">Quay lại</button>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#f8f9fb] dark:bg-slate-950 p-4 md:p-8 font-sans pb-32 md:pb-8 transition-colors duration-300">
			{/* TOP HEADER */}
			<div className="max-w-[1000px] mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
				<div className="flex items-center gap-4">
					<button
						onClick={() => navigate('/')}
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
									autoComplete="one-time-code"
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
								<div className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl max-h-60 overflow-y-auto overscroll-contain custom-scrollbar">
									{filteredCustomers.map(c => (
										<button
											key={c.id}
											className="w-full px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center justify-between border-b border-slate-50 dark:border-slate-700 last:border-none group"
											onClick={() => {
												setSelectedCustomer(c);
												setSearchCustomerQuery(c.businessName || c.name);
												setShowCustomerResults(false);
											}}
										>
											<div>
												<p className="font-black text-sm uppercase text-slate-800 dark:text-slate-200 group-hover:text-[#f27121]">
													{c.businessName || c.name}
												</p>
												{c.businessName && (
													<p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 uppercase">
														<span className="material-symbols-outlined text-[12px]">person</span>
														{c.name}
													</p>
												)}
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

						{/* ORDER DATE */}
						<div>
							<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 ml-1">NGÀY LÊN ĐƠN</label>
							<input
								type="date"
								className="w-full px-5 h-14 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/10 appearance-none transition-all"
								value={orderDate}
								onChange={(e) => setOrderDate(e.target.value)}
							/>
						</div>

						{/* NOTE */}
						<div className="md:col-span-2">
							<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 ml-1">GHI CHÚ ĐƠN HÀNG</label>
							<textarea
								rows={2}
								autoComplete="off"
								placeholder="Yêu cầu giao hàng sớm..."
								className="w-full p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/10 resize-none min-h-[100px] placeholder:text-slate-300 dark:placeholder:text-slate-600"
								value={orderNote}
								onChange={(e) => setOrderNote(e.target.value)}
							/>
						</div>
					</div>
				</div>

				{/* SECTION 2: PRODUCT LIST */}
				<div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300 relative z-10">
					<div className="px-8 py-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
						<h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">DANH SÁCH SẢN PHẨM</h3>
					</div>
					<div className="p-4 md:p-8">
						{/* DESKTOP HEADER - HIDDEN ON MOBILE */}
						<div className="hidden md:grid grid-cols-[180px_1fr_100px_150px_60px_120px_40px] gap-4 mb-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-50 dark:border-slate-800 pb-4">
							<div>DANH MỤC</div>
							<div>SẢN PHẨM</div>
							<div className="text-center">SỐ LƯỢNG</div>
							<div className="text-center">ĐƠN GIÁ</div>
							<div className="text-center">KIỆN</div>
							<div className="text-right">THÀNH TIỀN</div>
							<div></div>
						</div>

						{/* LIST OF ITEMS */}
						<div className="space-y-6 md:space-y-0">
							{lineItems.map((item, index) => (
								<div key={index} className="group relative bg-[#fcfdfe] dark:bg-slate-800/30 md:bg-transparent rounded-[2rem] md:rounded-none p-5 md:p-0 border border-slate-100 dark:border-slate-800/50 md:border-t-0 md:border-x-0 md:border-b md:dark:border-slate-800 md:grid md:grid-cols-[180px_1fr_100px_150px_60px_120px_40px] md:gap-4 md:items-center md:py-6 transition-all">

									{/* SELECTION AREA (CATEGORY & PRODUCT) */}
									<div className="grid grid-cols-1 md:contents gap-4">
										{/* CATEGORY SELECT */}
										<div className="relative" ref={activeRow === index && activeField === 'category' ? dropdownRef : null}>
											<label className="md:hidden text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px] mb-2 block ml-1">DANH MỤC</label>
											<div
												className="w-full h-12 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 flex items-center justify-between cursor-pointer hover:border-[#f27121] transition-all"
												onClick={() => {
													setActiveRow(index);
													setActiveField('category');
													setLineSearchQuery('');
												}}
											>
												<span className={`text-[12px] font-bold truncate ${item.category ? 'text-slate-900 dark:text-white' : 'text-slate-300 dark:text-slate-600'}`}>
													{item.category || 'Tìm danh mục...'}
												</span>
												<ChevronDown size={14} className="text-slate-300 shrink-0" />
											</div>

											{activeRow === index && activeField === 'category' && (
												<div className="absolute z-[100] top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden min-w-[280px]">
													<div className="p-2 border-b border-slate-50 dark:border-slate-700">
														<input
															autoFocus
															type="text"
															placeholder="Gõ để tìm nhanh..."
															className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-xs font-bold focus:ring-0"
															value={lineSearchQuery}
															onChange={(e) => setLineSearchQuery(e.target.value)}
														/>
													</div>
													<div className="max-h-64 overflow-y-auto py-2 overscroll-contain custom-scrollbar border-b border-slate-50 dark:border-slate-700/50">
														<div
															className="px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-xs font-bold text-slate-400 border-b border-slate-50 dark:border-slate-700"
															onClick={() => {
																updateLineItem(index, 'category', '');
																setActiveRow(null);
																setActiveField(null);
															}}
														>
															-- Tất cả danh mục --
														</div>
														{categories
															.filter(cat => String(cat).toLowerCase().includes(lineSearchQuery.toLowerCase()))
															.map(cat => (
																<div
																	key={cat}
																	className="px-5 py-4 hover:bg-[#f27121]/5 dark:hover:bg-[#f27121]/10 hover:text-[#f27121] cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between transition-colors"
																	onClick={() => {
																		updateLineItem(index, 'category', cat);
																		setActiveRow(null);
																		setActiveField(null);
																	}}
																>
																	{cat}
																	{item.category === cat && <CheckCircle size={14} className="text-[#f27121]" />}
																</div>
															))}
													</div>
												</div>
											)}
										</div>

										{/* PRODUCT SELECT */}
										<div className="relative md:pl-0" ref={activeRow === index && activeField === 'productId' ? dropdownRef : null}>
											<label className="md:hidden text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px] mb-2 block ml-1">SẢN PHẨM</label>
											<div
												className="w-full h-12 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 flex items-center justify-between cursor-pointer hover:border-[#f27121] transition-all"
												onClick={() => {
													setActiveRow(index);
													setActiveField('productId');
													setLineSearchQuery('');
												}}
											>
												<div className="flex flex-col">
													<span className={`text-[12px] font-bold truncate ${item.name ? 'text-slate-900 dark:text-white' : 'text-slate-300 dark:text-slate-600'} mr-2`}>
														{item.name || 'Tìm sản phẩm...'}
													</span>
													{item.sku && (
														<span
															className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1 hover:text-[#f27121] transition-colors"
															onClick={(e) => { e.stopPropagation(); copyToClipboard(item.sku, 'mã SKU'); }}
															title="Copy SKU"
														>
															{item.sku}
															<span className="material-symbols-outlined text-[10px]">content_copy</span>
														</span>
													)}
												</div>
												<ChevronDown size={14} className="text-slate-300 shrink-0" />
											</div>

											{activeRow === index && activeField === 'productId' && (
												<div className="absolute z-[100] top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden min-w-[320px] md:min-w-[400px]">
													<div className="p-2 border-b border-slate-50 dark:border-slate-700">
														<input
															autoFocus
															type="text"
															placeholder="Tìm theo tên hoặc SKU..."
															className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-xs font-bold focus:ring-0"
															value={lineSearchQuery}
															onChange={(e) => setLineSearchQuery(e.target.value)}
														/>
													</div>
													<div className="max-h-80 overflow-y-auto py-2 overscroll-contain custom-scrollbar border-b border-slate-50 dark:border-slate-700/50">
														{(() => {
															const normalizedSearch = normalizeText(lineSearchQuery);
															const currentCategory = normalizeText(item.category);

															// Step 1: Search within the current category if one is selected
															let matches = products.filter(p => {
																const isCatMatch = !item.category || normalizeText(p.category) === currentCategory;
																const isProductMatch = isMatch(p.name, lineSearchQuery) || (p.sku && isMatch(p.sku, lineSearchQuery));
																return isCatMatch && isProductMatch;
															});

															// Step 2: Fallback to global search ONLY IF there are no matches in the selected category 
															// AND the user has actually typed something (don't show everything by default)
															if (matches.length === 0 && lineSearchQuery) {
																matches = products.filter(p => isMatch(p.name, lineSearchQuery) || (p.sku && isMatch(p.sku, lineSearchQuery)));
															}

															return matches
																.sort((a, b) => {
																	const aStarts = normalizeText(a.name).startsWith(normalizedSearch);
																	const bStarts = normalizeText(b.name).startsWith(normalizedSearch);
																	if (aStarts && !bStarts) return -1;
																	if (!aStarts && bStarts) return 1;
																	return a.name.localeCompare(b.name);
																})
																.slice(0, 50)
																.map(p => {
																	const effStock = getEffectiveStock(p);
																	return (
																		<div
																			key={p.id}
																			className={`px-5 py-4 hover:bg-[#1A237E]/5 dark:hover:bg-indigo-500/10 cursor-pointer border-b border-slate-50 dark:border-slate-700/50 last:border-none transition-all flex items-center justify-between group/prod ${effStock <= 0 ? 'opacity-50 grayscale' : ''}`}
																			onClick={() => {
																				if (effStock > 0) {
																					updateLineItem(index, 'productId', p.id);
																					setActiveRow(null);
																					setActiveField(null);
																				}
																			}}
																		>
																			<div className="flex flex-col gap-1 max-w-[70%]">
																				<span className="text-xs font-black text-slate-800 dark:text-slate-200 group-hover/prod:text-[#1A237E] dark:group-hover/prod:text-indigo-400 transition-colors uppercase leading-tight line-clamp-2">{p.name}</span>
																				<div className="flex items-center gap-2">
																					<div
																						className="flex items-center gap-1 cursor-pointer group/sku"
																						onClick={(e) => {
																							e.stopPropagation();
																							copyToClipboard(p.sku, 'mã SKU');
																						}}
																						title="Copy mã SKU"
																					>
																						<span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[9px] font-black text-slate-500 uppercase group-hover/sku:bg-indigo-100 dark:group-hover/sku:bg-indigo-900/40 group-hover/sku:text-indigo-600 transition-colors">
																							{p.sku || 'N/A'}
																						</span>
																						{p.sku && <span className="material-symbols-outlined text-[10px] text-slate-300 opacity-0 group-hover/sku:opacity-100 transition-opacity">content_copy</span>}
																					</div>
																					<span className="text-[9px] font-bold text-slate-400">{p.unit}</span>
																				</div>
																			</div>
																			<div className="text-right">
																				<div className="text-xs font-black text-[#f27121] mb-0.5">{p.priceSell.toLocaleString('vi-VN')} đ</div>
																				<div className={`text-[9px] font-black uppercase tracking-widest ${effStock > 0 ? 'text-green-500' : 'text-rose-500'}`}>
																					{effStock > 0 ? `TỒN: ${effStock}` : 'HẾT HÀNG'}
																				</div>
																			</div>
																		</div>
																	);
																});
														})()}
													</div>
												</div>
											)}
										</div>
									</div>

									{/* NUMERIC AREA (QTY & PRICE) */}
									<div className="grid grid-cols-2 md:contents gap-4 mt-4 md:mt-0">
										{/* QUANTITY */}
										<div className="flex flex-col md:items-center">
											<label className="md:hidden text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px] mb-2 block ml-1">SỐ LƯỢNG</label>
											<div className="relative w-full md:w-24">
												<input
													type="number"
													step="any"
													className="w-full h-12 text-center bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/10 focus:border-[#f27121] transition-all"
													value={item.qty}
													onChange={(e) => updateLineItem(index, 'qty', e.target.value)}
													placeholder="0"
												/>
											</div>
										</div>

										{/* PRICE */}
										<div className="flex flex-col md:items-center">
											<label className="md:hidden text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px] mb-2 block ml-1">ĐƠN GIÁ</label>
											<div className="relative w-full md:w-32">
												<input
													type="number"
													className="w-full h-12 text-center bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-[11px] font-black text-slate-500 dark:text-slate-400 focus:ring-2 focus:ring-[#f27121]/10 focus:border-[#f27121] transition-all"
													value={item.price === 0 ? '' : item.price}
													onChange={(e) => updateLineItem(index, 'price', e.target.value === '' ? 0 : Number(e.target.value))}
													placeholder="Giá bán"
												/>
											</div>
										</div>

										{/* PACKAGING - DESKTOP ONLY INFOS */}
										<div className="hidden md:flex flex-col items-center">
											<span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
												{(() => {
													const pkg = parseFloat(item.packaging) || 0;
													if (pkg <= 0) return '0';
													return (Number(item.qty) / pkg).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
												})()}
											</span>
											<span className="text-[9px] font-bold text-slate-300 uppercase">KIỆN</span>
										</div>

										{/* TOTAL PER ITEM */}
										<div className="col-span-2 md:col-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-none border-slate-100 dark:border-slate-800 flex items-center justify-between md:justify-end">
											<div className="md:hidden flex flex-col">
												<span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">THÀNH TIỀN</span>
												<span className="text-[10px] font-bold text-slate-300 uppercase">
													Kiện: {(() => {
														const pkg = parseFloat(item.packaging) || 0;
														if (pkg <= 0) return '0';
														return (Number(item.qty) / pkg).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
													})()} KIỆN
												</span>
											</div>
											<span className="text-base md:text-sm font-black text-[#f27121] tabular-nums">
												{(Number(item.price) * Number(item.qty || 0)).toLocaleString('vi-VN')} đ
											</span>
										</div>
									</div>

									{/* REMOVE BUTTON */}
									<div className="absolute top-2 right-2 md:static md:flex md:justify-end">
										<button
											onClick={() => removeLineItem(index)}
											className="size-9 md:size-10 rounded-xl flex items-center justify-center text-rose-500 bg-rose-50 dark:bg-rose-900/20 md:bg-transparent md:text-slate-200 md:dark:text-slate-700 md:hover:bg-rose-50 md:dark:hover:bg-rose-900/20 md:hover:text-rose-500 transition-all active:scale-90"
											title="Xóa dòng"
										>
											<Trash2 size={16} />
										</button>
									</div>
								</div>
							))}
						</div>

						{/* ADD BUTTONS */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
							<button
								onClick={addLineItem}
								className="group relative h-16 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center gap-3 transition-all hover:border-[#f27121] hover:bg-orange-50/30 dark:hover:bg-orange-950/10 active:scale-[0.98]"
							>
								<div className="size-8 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-[#f27121] group-hover:scale-110 transition-transform">
									<Plus size={18} strokeWidth={3} />
								</div>
								<span className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Thêm Sản Phẩm</span>
							</button>

							<button
								onClick={() => setShowScanner(true)}
								className="group relative h-16 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center gap-3 transition-all hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-950/10 active:scale-[0.98]"
							>
								<div className="size-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
									<QrCode size={18} strokeWidth={3} />
								</div>
								<span className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Quét Mã QR</span>
							</button>
						</div>
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
									<label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Mã giảm giá / Voucher</label>
									<div className="flex gap-2">
										<div className="relative flex-1">
											<Ticket size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
											<input
												type="text"
												autoComplete="off"
												placeholder="Nhập mã..."
												className="w-full h-14 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl pl-12 pr-4 text-sm font-black text-indigo-600 uppercase focus:ring-indigo-500 transition-all"
												value={couponCode}
												onChange={(e) => setCouponCode(e.target.value)}
											/>
										</div>
										<button
											onClick={handleApplyCoupon}
											className="px-6 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-slate-900 transition-all active:scale-95"
										>
											ÁP DỤNG
										</button>
									</div>
								</div>
								<div>
									<label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Phí vận chuyển (+)</label>
									<input
										type="number"
										autoComplete="off"
										placeholder="0"
										className="w-full h-14 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl px-6 text-sm font-bold text-slate-900 dark:text-white focus:ring-[#f27121]"
										value={shippingFee === 0 ? '' : shippingFee}
										onChange={(e) => setShippingFee(e.target.value === '' ? 0 : Number(e.target.value))}
									/>
								</div>
								<div>
									<label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Số tiền Chiết khấu (-)</label>
									<input
										type="number"
										autoComplete="off"
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
									className="hidden md:flex items-center justify-center w-[350px] ml-auto h-16 bg-[#ffcc00] text-slate-900 rounded-2xl font-black text-sm uppercase tracking-[2px] shadow-xl shadow-yellow-500/10 hover:bg-[#fbc02d] transition-all active:scale-[0.98]"
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

			{showScanner && (
				<QRScanner
					onScan={handleQRScan}
					onClose={() => setShowScanner(false)}
				/>
			)}
		</div>
	);
};

export default QuickOrder;
