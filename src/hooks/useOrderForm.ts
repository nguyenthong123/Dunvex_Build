import { useState, useEffect, useRef, useMemo } from 'react';
import { shouldExcludeFromProfit } from '../utils/profitUtils';
import { db, auth } from '../services/firebase';
import { collection, query, onSnapshot, doc, getDoc, serverTimestamp, where, getDocs, limit, Timestamp, runTransaction, increment } from '../services/firebase';
import { useProducts } from './useProducts';
import { useCustomers } from './useCustomers';
import { usePayments } from './usePayments';
import { sendTelegramNotification } from '../utils/telegramNotify';

interface UseOrderFormParams {
	owner: any;
	showToast: (msg: string, type: 'success' | 'warning' | 'error') => void;
	editId?: string;
	location: any;
}

export function useOrderForm({ owner, showToast, editId, location }: UseOrderFormParams) {
	// ── Normalization Helpers ──
	const normalizeText = (text: any) => text ? String(text).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase() : '';
	const removeAccents = (str: any) => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
	const normalizeSmart = (text: any) => removeAccents(normalizeText(text));
	const vibrate = (pattern: number | number[]) => {
		if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
			window.navigator.vibrate(pattern);
		}
	};
	const isMatch = (target: string, query: string) => {
		const t = normalizeText(target);
		const q = normalizeText(query);
		return t.includes(q) || removeAccents(t).includes(removeAccents(q));
	};

	// ── Data Hooks (products, customers, payments) ──
	const { products: hookProducts } = useProducts({ ownerId: owner.ownerId, enabled: !owner.loading && !!owner.ownerId });
	const { customers: hookCustomers } = useCustomers({ ownerId: owner.ownerId, enabled: !owner.loading && !!owner.ownerId });
	const { payments: hookPayments } = usePayments({ ownerId: owner.ownerId, enabled: !owner.loading && !!owner.ownerId });

	// ── Core Data State ──
	const [products, setProducts] = useState<any[]>([]);
	const [customers, setCustomers] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [fetchingOrder, setFetchingOrder] = useState(false);
	const [originalOrder, setOriginalOrder] = useState<any>(null);
	const [allOrders, setAllOrders] = useState<any[]>([]);
	const [allPayments, setAllPayments] = useState<any[]>([]);

	useEffect(() => { setProducts(hookProducts); }, [hookProducts]);
	useEffect(() => { setCustomers(hookCustomers); }, [hookCustomers]);
	useEffect(() => { setAllPayments(hookPayments); }, [hookPayments]);

	// ── Form State ──
	const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
	const [searchCustomerQuery, setSearchCustomerQuery] = useState('');
	const [showCustomerResults, setShowCustomerResults] = useState(false);
	const [orderStatus, setOrderStatus] = useState('Đơn chốt');
	const [orderNote, setOrderNote] = useState('');
	const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
	const [deliveryLocation, setDeliveryLocation] = useState('');
	const [parsedLocation, setParsedLocation] = useState<{lat: number, lng: number} | null>(null);

	// ── Line Items State ──
	const [lineItems, setLineItems] = useState<any[]>([
		{ id: crypto.randomUUID(), category: '', productId: '', name: '', serialNumber: '', qty: '', price: 0, buyPrice: 0, unit: '', packaging: '', density: '', maxStock: 0 }
	]);
	const [overheadRate, setOverheadRate] = useState(8.5);

	// ── Đọc hệ số chi phí từ settings ──
	useEffect(() => {
		if (!owner.ownerId) return;
		const unsub = onSnapshot(doc(db, 'settings', owner.ownerId), (snap) => {
			if (snap.exists() && snap.data().overheadRate != null) {
				setOverheadRate(Number(snap.data().overheadRate) || 8.5);
			}
		});
		return () => unsub();
	}, [owner.ownerId]);

	// ── Adjustments ──
	const [shippingFee, setShippingFee] = useState(0);
	const [discountAmt, setDiscountAmt] = useState(0);
	const [couponCode, setCouponCode] = useState('');

	// ── Dropdown State ──
	const customerSearchRef = useRef<HTMLDivElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const [activeRow, setActiveRow] = useState<number | null>(null);
	const [activeField, setActiveField] = useState<'category' | 'productId' | null>(null);
	const [lineSearchQuery, setLineSearchQuery] = useState('');
	const [showProfitPreview, setShowProfitPreview] = useState(false);

	// ── Success / Submit State ──
	const [showSuccessModal, setShowSuccessModal] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showScanner, setShowScanner] = useState(false);

	const isAdmin = owner.role?.toLowerCase() === 'admin' || !owner.isEmployee;
	const hasOrderPermission = owner.role === 'admin' || (owner.accessRights?.orders_create ?? true);

	// ── Outside Click Handler ──
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setActiveRow(null);
				setActiveField(null);
			}
			if (customerSearchRef.current && !customerSearchRef.current.contains(event.target as Node)) {
				setShowCustomerResults(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	// ── Fetch Orders (Snapshot) ──
	useEffect(() => {
		if (owner.loading || !owner.ownerId) return;
		const qOrders = query(collection(db, 'orders'), where('ownerId', '==', owner.ownerId), where('status', '==', 'Đơn chốt'));
		const unsubOrders = onSnapshot(qOrders, (snap) => {
			setAllOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		});
		setLoading(false);
		return () => { unsubOrders(); };
	}, [owner.loading, owner.ownerId, owner.role, owner.isEmployee]);

	// ── Fetch Order for Editing ──
	useEffect(() => {
		if (editId && owner.ownerId && customers.length > 0 && products.length > 0) {
			const fetchOrder = async () => {
				setFetchingOrder(true);
				try {
					const orderRef = doc(db, 'orders', editId);
					const orderSnap = await getDoc(orderRef);
					if (orderSnap.exists()) {
						const data = orderSnap.data();
						setOriginalOrder(data);

						setLineItems((data.items || []).map((item: any) => {
							const currentProduct = products.find(p => p.id === (item.id || item.productId));
							
							const historicalBuyPrice = item.buyPrice !== undefined && item.buyPrice !== null 
								? Number(item.buyPrice) 
								: Number(currentProduct?.priceImport || 0);

							return {
								id: Math.random(),
								productId: item.productId || item.id || currentProduct?.id || '',
								sku: item.sku || currentProduct?.sku || '',
								name: item.name || currentProduct?.name || 'Sản phẩm đã xóa',
								category: item.category || currentProduct?.category || '',
								qty: item.qty || 0,
								price: item.price !== undefined ? Number(item.price) : 0,
								buyPrice: historicalBuyPrice,
								unit: item.unit || currentProduct?.unit || '',
								packaging: item.packaging || currentProduct?.packaging || '',
								density: item.density || currentProduct?.density || '',
								specification: item.specification || currentProduct?.specification || '',
								serialNumber: item.serialNumber || '',
								imageUrl: item.imageUrl || currentProduct?.imageUrl || '',
								maxStock: currentProduct ? (Number(currentProduct.stock) || 0) : 0
							};
						}));

						const formattedDate = (data.orderDate || new Date().toISOString()).split('T')[0];
						setOrderDate(formattedDate);
						setOrderStatus(data.status || 'Đơn chốt');
						setOrderNote(data.note || '');
						setShippingFee(data.adjustmentValue || 0);
						setDiscountAmt(data.discountValue || 0);

						setDeliveryLocation(data.rawDeliveryLocation || '');
						if (data.deliveryLocation && typeof data.deliveryLocation === 'object' && data.deliveryLocation.lat && data.deliveryLocation.lng) {
							setParsedLocation({ lat: Number(data.deliveryLocation.lat), lng: Number(data.deliveryLocation.lng) });
						} else {
							setParsedLocation(null);
						}

						const foundCust = customers.find(c => c.id === data.customerId);
						if (foundCust) {
							setSelectedCustomer(foundCust);
							setSearchCustomerQuery(foundCust.name);
						} else {
							setSearchCustomerQuery(data.customerName || '');
						}
					}
				} catch (err) {
					// Silent fail
				} finally {
					setFetchingOrder(false);
				}
			};
			fetchOrder();
		}
	}, [editId, owner.ownerId, customers.length, products.length]);

	// ── Debt Map ──
	const debtMap = useMemo(() => {
		const map: Record<string, number> = {};
		allOrders.forEach(o => {
			if (o.customerId && o.status === 'Đơn chốt') {
				map[o.customerId] = (map[o.customerId] || 0) + (o.totalAmount || 0);
			}
		});
		allPayments.forEach(p => {
			if (p.customerId) {
				map[p.customerId] = (map[p.customerId] || 0) - (p.amount || 0);
			}
		});
		return map;
	}, [allOrders, allPayments]);

	// ── Smart Packaging Sync ──
	useEffect(() => {
		if (loading || products.length === 0 || fetchingOrder) return;
		
		const syncPackaging = () => {
			let hasLocalChange = false;
			const updatedItems = lineItems.map(item => {
				if (!item.name && !item.productId) return item;
				
				const parseVNNumber = (val: any) => {
					if (typeof val === 'number') return val;
					if (!val) return 0;
					const cleaned = String(val).replace(/[^0-9,.-]/g, '').replace(',', '.');
					return parseFloat(cleaned) || 0;
				};
				const currentPkg = parseVNNumber(item.packaging);
				
				const candidates = products.filter(p => 
					p.id === item.productId || 
					(p.sku && item.sku && normalizeText(p.sku) === normalizeText(item.sku)) ||
					(normalizeSmart(p.name) === normalizeSmart(item.name))
				);
				
				const bestMatch = candidates.find(p => normalizeSmart(p.category) === normalizeSmart(item.category)) || candidates[0];
				
				if (bestMatch && bestMatch.packaging) {
					const masterPkg = parseVNNumber(bestMatch.packaging);
					if (masterPkg > 0 && Math.abs(masterPkg - currentPkg) > 0.001) {
						hasLocalChange = true;
						return { ...item, packaging: bestMatch.packaging, validated: true };
					} else if (masterPkg > 0 && !item.validated) {
						hasLocalChange = true;
						return { ...item, validated: true };
					}
				}
				return item;
			});

			if (hasLocalChange) {
				setLineItems(updatedItems);
			}
		};

		const timer = setTimeout(syncPackaging, 1000);
		return () => clearTimeout(timer);
	}, [lineItems.length, products, loading, fetchingOrder]);

	// ── Prefill Data (from location.state) ──
	useEffect(() => {
		if (loading || fetchingOrder || products.length === 0 || customers.length === 0) return;
		if (location.state?.prefill && !editId) {
			const data = location.state.prefill;
			let isCustomerFound = false;

			if (data.customer?.name) {
				const queryName = normalizeSmart(data.customer.name);
				const queryWords = queryName.split(' ').filter(Boolean);
				let foundCust = customers.find(c => {
					if (data.customer.phone && c.phone === data.customer.phone) return true;
					const cName = normalizeSmart(c.name);
					const cBusiness = normalizeSmart(c.name || '');
					return cName === queryName || cBusiness === queryName;
				});

				if (!foundCust) {
					foundCust = customers.find(c => {
						const cName = normalizeSmart(c.name);
						const cBusiness = normalizeSmart(c.name || '');
						
						if (data.customer.phone && c.phone === data.customer.phone) return true;
						
						const matchName = cName && (cName.includes(queryName) || queryName.includes(cName));
						const matchBusiness = cBusiness && (cBusiness.includes(queryName) || queryName.includes(cBusiness));
						const matchWords = queryWords.length > 0 && queryWords.every(w => (cName && cName.includes(w)) || (cBusiness && cBusiness.includes(w)));
						
						return matchName || matchBusiness || matchWords;
					});
				}
				if (foundCust) {
					setSelectedCustomer(foundCust);
					setSearchCustomerQuery(foundCust.name);
					isCustomerFound = true;
				} else {
					setSearchCustomerQuery(data.customer.name);
				}
			}

			if (data.notes) {
				setOrderNote(data.notes);
			}

			if (data.shipping_fee) {
				setShippingFee(data.shipping_fee);
			}
			
			if (data.discount_amount) {
				setDiscountAmt(data.discount_amount);
			}

			setOrderStatus('Đơn nháp');

			if (data.products && data.products.length > 0) {
				const mappedItems = data.products.map((p: any) => {
					const prodQuery = normalizeSmart(p.name);
					const prodWords = prodQuery.split(' ').filter(Boolean);
					const rawCat = p.category || data.order_category || '';
					const catQuery = rawCat ? normalizeSmart(rawCat) : '';

					let foundProd = null;

					if (catQuery) {
						foundProd = products.find(prod => 
							normalizeSmart(prod.name) === prodQuery && 
							prod.category && normalizeSmart(prod.category).includes(catQuery)
						);
					}

					if (!foundProd) {
						foundProd = products.find(prod => normalizeSmart(prod.name) === prodQuery);
					}

					if (!foundProd && catQuery) {
						foundProd = products.find(prod => {
							const prodNameNormalized = normalizeSmart(prod.name);
							const isStrictWordMatch = prodWords.every(w => {
								if (/\d/.test(w)) {
									const parts = prodNameNormalized.split(' ');
									return parts.some(p => p === w || p.startsWith(w + 'x') || p.startsWith(w + '*'));
								}
								return prodNameNormalized.includes(w);
							});

							const nameMatch = prodNameNormalized === prodQuery ||
											  prodNameNormalized.includes(prodQuery) || 
											  prodQuery.includes(prodNameNormalized) ||
											  isStrictWordMatch ||
											  (prod.sku && normalizeSmart(prod.sku).includes(prodQuery));
											  
							if (!nameMatch) return false;
							return prod.category && normalizeSmart(prod.category).includes(catQuery);
						});
					}

					if (!foundProd) {
						foundProd = products.find(prod => {
							const prodNameNormalized = normalizeSmart(prod.name);
							const isStrictWordMatch = prodWords.every(w => {
								if (/\d/.test(w)) {
									const parts = prodNameNormalized.split(' ');
									return parts.some(p => p === w || p.startsWith(w + 'x') || p.startsWith(w + '*'));
								}
								return prodNameNormalized.includes(w);
							});

							return prodNameNormalized === prodQuery ||
								   prodNameNormalized.includes(prodQuery) || 
								   prodQuery.includes(prodNameNormalized) ||
								   isStrictWordMatch ||
								   (prod.sku && normalizeSmart(prod.sku).includes(prodQuery));
						});
					}

					if (foundProd) {
						return {
							id: Math.random(),
							productId: foundProd.id,
							name: foundProd.name,
							sku: foundProd.sku || '',
							category: foundProd.category || '',
							qty: p.quantity || 1,
							price: foundProd.priceSell,
							buyPrice: foundProd.priceImport || 0,
							unit: p.unit || foundProd.unit || '',
							packaging: foundProd.packaging || '',
							density: foundProd.density || '',
							serialNumber: foundProd.serialNumber || '',
							imageUrl: foundProd.imageUrl || '',
							maxStock: getEffectiveStock(foundProd)
						};
					}

					return {
						id: Math.random(),
						productId: p.productId || '',
						name: p.name,
						qty: p.quantity || 1,
						price: p.price || 0,
						buyPrice: p.buyPrice || 0,
						unit: p.unit || '',
						category: rawCat,
						packaging: '',
						density: '',
						maxStock: 0
					};
				});
				setLineItems(mappedItems);
			}

			showToast("Đã nhập dữ liệu thành công!", "success");

			window.history.replaceState({}, document.title);
		}
	}, [location.state, products.length, customers.length, loading, fetchingOrder]);

	// ── Helper: getEffectiveStock ──
	const getEffectiveStock = (prod: any) => {
		if (!prod) return 0;
		if (prod.linkedProductId) {
			const linked = products.find(p => p.id === prod.linkedProductId);
			return linked?.stock || 0;
		}
		const cleanSku = normalizeText(prod.sku);
		if (cleanSku) {
			const skuMasterProducts = products.filter(p =>
				normalizeText(p.sku) === cleanSku &&
				!p.linkedProductId
			);
			const totalStock = skuMasterProducts.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
			return totalStock;
		}
		return prod.stock || 0;
	};

	// ── Helper: getEffectiveCost ──
	const getEffectiveCost = (item: any) => {
		const buyPrice = Number(item.buyPrice) || 0;
		const product = products.find(p => p.id === item.productId);
		const hasOverhead = product?.applyOverheadCost === true;
		if (hasOverhead && overheadRate > 0) {
			return buyPrice * (1 + overheadRate / 100);
		}
		return buyPrice;
	};

	// ── Line Item Actions ──
	const addLineItem = () => {
		setLineItems([...lineItems, { id: crypto.randomUUID(), category: '', productId: '', sku: '', name: '', imageUrl: '', serialNumber: '', qty: '', price: 0, buyPrice: 0, unit: '', packaging: '', density: '', maxStock: 0 }]);
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
				newItems[index].sku = prod.sku || '';
				newItems[index].serialNumber = prod.serialNumber || '';
				newItems[index].price = prod.priceSell;
				newItems[index].buyPrice = prod.priceImport || 0;
				newItems[index].unit = prod.unit;
				newItems[index].category = prod.category;
				newItems[index].packaging = prod.packaging;
				newItems[index].specification = prod.specification || '';
				newItems[index].density = prod.density;
				newItems[index].imageUrl = prod.imageUrl || '';
				newItems[index].maxStock = getEffectiveStock(prod);
			}
		}
		setLineItems(newItems);
	};

	// ── QR Scan Handler ──
	const handleQRScan = (productId: string) => {
		const product = products.find(p => p.id === productId);
		if (product) {
			vibrate(50);
			const emptyIdx = lineItems.findIndex(item => !item.productId);
			if (emptyIdx !== -1) {
				updateLineItem(emptyIdx, 'productId', product.id);
			} else {
				setLineItems([
					...lineItems,
					{
						id: crypto.randomUUID(),
						category: product.category || '',
						productId: product.id,
						sku: product.sku || '',
						name: product.name,
						qty: 1,
						price: product.priceSell,
						buyPrice: product.priceImport || 0,
						unit: product.unit,
						packaging: product.packaging,
						density: product.density,
						imageUrl: product.imageUrl || '',
						serialNumber: product.serialNumber || '',
						maxStock: getEffectiveStock(product)
					}
				]);
			}
		} else {
			showToast(`Không tìm thấy sản phẩm với mã ID: ${productId}`, "warning");
		}
	};

	// ── Coupon Handler ──
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

	// ── Confirm Order Handler ── (the big one)
	const handleConfirmOrder = async () => {
		const validItems = lineItems.filter(item => item.productId && Number(item.qty) > 0);
		if (validItems.length === 0) {
			showToast("Vui lòng thêm sản phẩm vào đơn hàng", "warning");
			return;
		}

		setIsSubmitting(true);
		try {
			const processedItems: any[] = [];
			const stockDeletions: any[] = [];

			validItems.forEach(item => {
				let remainingQty = Number(item.qty);

				const sourceProduct = products.find(p => p.id === item.productId);
				const cleanSku = normalizeText(sourceProduct?.sku);

				let stockCandidates: any[] = [];
				if (sourceProduct?.linkedProductId) {
					const linked = products.find(p => p.id === sourceProduct.linkedProductId);
					if (linked) stockCandidates = [linked];
				} else if (cleanSku) {
					stockCandidates = products
						.filter(p => normalizeText(p.sku) === cleanSku && !p.linkedProductId)
						.sort((a: any, b: any) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
				}
				if (stockCandidates.length === 0 && sourceProduct) {
					stockCandidates = [sourceProduct];
				}

				const exactBuyPrice = item.buyPrice !== undefined && item.buyPrice !== null
					? Number(item.buyPrice)
					: Number(sourceProduct?.priceImport || 0);

				for (const cand of stockCandidates) {
					if (remainingQty <= 0) break;
					const available = Number(cand.stock) || 0;
					if (available <= 0) continue;

					const take = Math.min(remainingQty, available);
					stockDeletions.push({
						originProductId: item.productId,
						productId: cand.id,
						qty: take,
						productName: cand.name,
						buyPrice: cand.priceImport || 0
					});
					remainingQty -= take;
				}

				if (remainingQty > 0) {
					const mainCand = stockCandidates[0] || sourceProduct;
					if (mainCand) {
						stockDeletions.push({
							originProductId: item.productId,
							productId: mainCand.id,
							qty: remainingQty,
							productName: mainCand.name,
							buyPrice: mainCand.priceImport || 0,
							isMissing: true
						});
					}
				}

				processedItems.push({
					id: item.productId,
					sku: item.sku || '',
					name: item.name || sourceProduct?.name || 'Sản phẩm đã xóa',
					price: item.price !== undefined ? Number(item.price) : 0,
					buyPrice: exactBuyPrice,
					qty: Number(item.qty) || 0,
					unit: item.unit || '',
					category: item.category || '',
					density: item.density || '',
					packaging: item.packaging || '',
					specification: item.specification || sourceProduct?.specification || '',
					imageUrl: item.imageUrl || '',
					serialNumber: item.serialNumber || ''
				});
			});

			let finalCustomer = selectedCustomer;
			if (!finalCustomer && searchCustomerQuery) {
				const queryNorm = normalizeSmart(searchCustomerQuery);
				const matched = customers.find(c => 
					normalizeSmart(c.name) === queryNorm || 
					normalizeSmart(c.name || '') === queryNorm ||
					c.phone === searchCustomerQuery
				);
				if (matched) finalCustomer = matched;
			}

			const profitProcessedItems = processedItems.filter(it => {
				const prod = products.find(p => p.id === it.id);
				return !shouldExcludeFromProfit(prod?.name || '', prod?.excludeProfit);
			});
			const totalCostFinal = processedItems.reduce((sum, it) => {
				const prod = products.find(p => p.id === it.id);
				let effectiveCost = Number(it.buyPrice) || 0;
				if (prod?.applyOverheadCost && overheadRate > 0) {
					effectiveCost = effectiveCost * (1 + overheadRate / 100);
				}
				return sum + effectiveCost * (Number(it.qty) || 0);
			}, 0);
			const profitSubTotalFinal = profitProcessedItems.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
			const profitCostFinal = profitProcessedItems.reduce((sum, it) => {
				const prod = products.find(p => p.id === it.id);
				let effectiveCost = Number(it.buyPrice) || 0;
				if (prod?.applyOverheadCost && overheadRate > 0) {
					effectiveCost = effectiveCost * (1 + overheadRate / 100);
				}
				return sum + effectiveCost * (Number(it.qty) || 0);
			}, 0);
			const totalProfitFinal = profitSubTotalFinal - profitCostFinal - Number(discountAmt);

			let staffPhone = '';
			try {
				const profileRef = doc(db, 'profiles', auth.currentUser?.uid || '');
				const profileSnap = await getDoc(profileRef);
				if (profileSnap.exists()) {
					staffPhone = profileSnap.data().phone || '';
				}
			} catch (e: any) {
				console.error('📱 Profile fetch error:', e.message || e);
			}

			const orderData: any = {
				customerName: finalCustomer?.name || searchCustomerQuery || 'Khách vãng lai',
				customerId: finalCustomer?.id || null,
				customerPhone: finalCustomer?.phone || '',
				customerBusinessName: finalCustomer?.name || '',
				deliveryLocation: parsedLocation,
				rawDeliveryLocation: deliveryLocation,
				orderDate: orderDate,
				items: processedItems,
				subTotal: Number(subTotal) || 0,
				adjustmentValue: Number(shippingFee) || 0,
				discountValue: Number(discountAmt) || 0,
				totalAmount: Number(finalTotal) || 0,
				totalWeight: Number(totalWeight) || 0,
				totalCost: Number(totalCostFinal) || 0,
				totalProfit: Number(totalProfitFinal) || 0,
				note: orderNote,
				status: orderStatus,
				couponCode: couponCode || null,
				ownerId: owner.ownerId,
				ownerEmail: owner.ownerEmail,
				createdBy: auth.currentUser?.uid || '',
				createdByEmail: owner.userEmail || auth.currentUser?.email || '',
				createdByDisplayName: owner.userDisplayName || auth.currentUser?.displayName || 'Nhân viên',
				createdByPhone: staffPhone,
			};

			if (editId) {
				await runTransaction(db, async (transaction) => {
					const productIds = new Set(stockDeletions.map((d: any) => d.productId));
					const freshProducts: Record<string, any> = {};
					for (const pid of productIds) {
						const prodSnap = await transaction.get(doc(db, 'products', pid));
						if (prodSnap.exists()) {
							freshProducts[pid] = { id: prodSnap.id, ...prodSnap.data() };
						}
					}

					if (orderStatus === 'Đơn chốt') {
						const originalQtys: Record<string, number> = {};
						if (editId && originalOrder?.items) {
							(originalOrder.items as any[]).forEach((origItem: any) => {
								const origPid = origItem.id || origItem.productId || '';
								if (origPid) {
									originalQtys[origPid] = (originalQtys[origPid] || 0) + Number(origItem.qty || 0);
								}
							});
						}

						for (const del of stockDeletions) {
							const fp = freshProducts[del.productId];
							if (fp) {
								const origQty = originalQtys[del.originProductId] || 0;
								const effectiveNeed = Math.max(0, del.qty - origQty);
								const currentStock = Number(fp.stock) || 0;
								if (effectiveNeed > 0 && currentStock < effectiveNeed && !del.isMissing) {
									throw new Error(`Tồn kho "${fp.name}" không đủ: còn ${currentStock}, cần thêm ${effectiveNeed}`);
								}
							}
						}
					}

					const oldCustomerId = originalOrder?.customerId || '';
					const customerChanged = !!oldCustomerId && oldCustomerId !== orderData.customerId;
					const oldTotal = originalOrder?.status === 'Đơn chốt' ? Number(originalOrder.totalAmount || 0) : 0;
					const newTotal = orderStatus === 'Đơn chốt' ? Number(finalTotal || 0) : 0;
					const diffDebt = newTotal - oldTotal;
					let custExists = false;
					let oldCustExists = false;
					if (newTotal > 0 && orderData.customerId) {
						const custSnap = await transaction.get(doc(db, 'customers', orderData.customerId));
						custExists = custSnap.exists();
					}
					if (customerChanged && oldTotal > 0) {
						const oldCustSnap = await transaction.get(doc(db, 'customers', oldCustomerId));
						oldCustExists = oldCustSnap.exists();
					}

					transaction.update(doc(db, 'orders', editId), {
						...orderData,
						updatedAt: serverTimestamp()
					});

					if (customerChanged && oldTotal > 0 && oldCustExists) {
						const oldDebtRef = doc(collection(db, 'debts'));
						transaction.set(oldDebtRef, {
							customerId: oldCustomerId,
							customerName: originalOrder?.customerName || '',
							type: 'payment',
							amount: oldTotal,
							orderId: editId,
							note: `Chuyển nợ sang: ${orderData.customerName}`,
							ownerId: owner.ownerId || '',
							createdBy: auth.currentUser?.uid || '',
							createdAt: serverTimestamp()
						});
					}
					if (diffDebt !== 0 || customerChanged) {
						const debtRef = doc(collection(db, 'debts'));
						transaction.set(debtRef, {
							customerId: orderData.customerId,
							customerName: orderData.customerName,
							type: (customerChanged || diffDebt > 0) ? 'debt_increase' : 'payment',
							amount: customerChanged ? newTotal : Math.abs(diffDebt),
							orderId: editId,
							note: customerChanged ? `Đổi khách từ ${originalOrder?.customerName || '?'}` : (diffDebt > 0 ? `Cập nhật đơn hàng tăng nợ` : `Cập nhật đơn hàng giảm nợ`),
							ownerId: owner.ownerId || '',
							createdBy: auth.currentUser?.uid || '',
							createdAt: serverTimestamp()
						});
					}
					const existingLogsQ = query(
						collection(db, 'inventory_logs'),
						where('ownerId', '==', owner.ownerId),
						where('orderId', '==', editId)
					);
					const existingLogsSnap = await getDocs(existingLogsQ);

					for (const logDoc of existingLogsSnap.docs) {
						const logData = logDoc.data();
						if (logData.productId && logData.qty) {
							const productExists = products.some((p: any) => p.id === logData.productId);
							if (productExists) {
								transaction.update(doc(db, 'products', logData.productId), {
									stock: increment(logData.qty)
								});
							}
						}
						transaction.delete(logDoc.ref);
					}

					if (orderStatus === 'Đơn chốt') {
						stockDeletions.forEach((del: any) => {
							const productExists = products.some((p: any) => p.id === del.productId);
							if (productExists) {
								transaction.update(doc(db, 'products', del.productId), {
									stock: increment(-del.qty)
								});
							}
							const invLogRef = doc(collection(db, 'inventory_logs'));
							transaction.set(invLogRef, {
								productId: del.productId,
								orderId: editId,
								customerName: orderData.customerName,
								productName: del.productName,
								type: 'out',
								qty: del.qty,
								note: `Cập nhật đơn hàng (FIFO) cho ${orderData.customerName}`,
								ownerId: owner.ownerId || '',
								user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
								createdAt: serverTimestamp()
							});
						});
					}

					const auditRef = doc(collection(db, 'audit_logs'));
					transaction.set(auditRef, {
						action: 'Cập nhật đơn hàng',
						user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
						userId: auth.currentUser?.uid || '',
						ownerId: owner.ownerId || '',
						details: `Đã cập nhật đơn hàng: ${orderData.customerName} - Tổng: ${finalTotal.toLocaleString('vi-VN')} đ`,
						createdAt: serverTimestamp()
					});
				});

				if (orderStatus === 'Đơn chốt') {
					sendTelegramNotification(owner.ownerId, `✏️ <b>ĐƠN HÀNG ĐÃ SỬA</b>
- Khách hàng: <b>${orderData.customerName}</b>
- Tổng tiền: <b>${finalTotal.toLocaleString('vi-VN')} đ</b>
- Nhân viên: ${owner.userDisplayName || auth.currentUser?.displayName || 'Admin'}`);
				}
			} else {
				orderData.createdAt = Timestamp.now();
				let newOrderId = '';

				await runTransaction(db, async (transaction) => {
					const productIds = new Set(stockDeletions.map((d: any) => d.productId));
					const freshProducts: Record<string, any> = {};
					for (const pid of productIds) {
						const prodSnap = await transaction.get(doc(db, 'products', pid));
						if (prodSnap.exists()) {
							freshProducts[pid] = { id: prodSnap.id, ...prodSnap.data() };
						}
					}

					if (orderStatus === 'Đơn chốt') {
						for (const del of stockDeletions) {
							const fp = freshProducts[del.productId];
							if (fp) {
								const currentStock = Number(fp.stock) || 0;
								if (currentStock < del.qty && !del.isMissing) {
									throw new Error(`Tồn kho "${fp.name}" không đủ: còn ${currentStock}, cần ${del.qty}`);
								}
							}
						}
					}

					let custExists = false;
					if (orderStatus === 'Đơn chốt' && orderData.customerId) {
						const custSnap = await transaction.get(doc(db, 'customers', orderData.customerId));
						custExists = custSnap.exists();
					}

					const newOrderRef = doc(collection(db, 'orders'));
					newOrderId = newOrderRef.id;
					transaction.set(newOrderRef, orderData);

					if (orderStatus === 'Đơn chốt' && orderData.customerId && custExists) {
						const debtRef = doc(collection(db, 'debts'));
						transaction.set(debtRef, {
							customerId: orderData.customerId,
							customerName: orderData.customerName,
							type: 'debt_increase',
							amount: Number(finalTotal || 0),
							orderId: newOrderRef.id,
							note: `Tạo đơn hàng mới`,
							ownerId: owner.ownerId || '',
							createdBy: auth.currentUser?.uid || '',
							createdAt: serverTimestamp()
						});
					}

					const notifRef = doc(collection(db, 'notifications'));
					transaction.set(notifRef, {
						title: 'Đơn hàng mới',
						message: `Đơn hàng cho ${orderData.customerName} đã được tạo thành công: ${finalTotal.toLocaleString('vi-VN')} đ`,
						type: 'order',
						orderId: newOrderRef.id,
						userId: owner.ownerId,
						read: false,
						createdAt: serverTimestamp()
					});

					if (orderStatus === 'Đơn chốt') {
						stockDeletions.forEach((del: any) => {
							const productExists = products.some((p: any) => p.id === del.productId);
							if (productExists) {
								transaction.update(doc(db, 'products', del.productId), {
									stock: increment(-del.qty)
								});
							}

							const invLogRef = doc(collection(db, 'inventory_logs'));
							transaction.set(invLogRef, {
								productId: del.productId,
								orderId: newOrderRef.id,
								customerName: orderData.customerName,
								productName: del.productName,
								type: 'out',
								qty: del.qty,
								note: `Xuất đơn hàng (FIFO) cho ${orderData.customerName}`,
								ownerId: owner.ownerId || '',
								user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
								createdAt: serverTimestamp()
							});
						});
					}

					if (couponCode) {
						const couponQ = query(
							collection(db, 'coupons'),
							where('ownerId', '==', owner.ownerId),
							where('code', '==', couponCode.toUpperCase().trim()),
							limit(1)
						);
						const couponSnap = await getDocs(couponQ);
						if (!couponSnap.empty) {
							transaction.update(doc(db, 'coupons', couponSnap.docs[0].id), {
								usageCount: increment(1)
							});
						}
					}

					const logRef = doc(collection(db, 'audit_logs'));
					transaction.set(logRef, {
						action: 'Lên đơn hàng mới',
						user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
						userId: auth.currentUser?.uid || '',
						ownerId: owner.ownerId || '',
						details: `Đã tạo đơn hàng cho ${orderData.customerName} - Tổng tiền: ${finalTotal.toLocaleString('vi-VN')} đ${couponCode ? ` (Mã: ${couponCode})` : ''}`,
						createdAt: serverTimestamp()
					});
				});

				if (orderStatus === 'Đơn chốt') {
					sendTelegramNotification(owner.ownerId, `📦 <b>ĐƠN HÀNG MỚI (CHỐT)</b>
- Khách hàng: <b>${orderData.customerName}</b>
- Tổng tiền: <b>${finalTotal.toLocaleString('vi-VN')} đ</b>
- Nhân viên lên đơn: ${owner.userDisplayName || auth.currentUser?.displayName || 'Admin'}`);
				}
			}
			vibrate([100, 50, 100]);
			setShowSuccessModal(true);
		} catch (error) {
			showToast("Lỗi khi lưu đơn hàng: " + error, "error");
		} finally {
			setIsSubmitting(false);
		}
	};

	// ── Format Helpers ──
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

	// ── Derived Values ──
	const subTotal = lineItems.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0), 0);
	const finalTotal = subTotal + Number(shippingFee) - Number(discountAmt);

	const totalWeight = lineItems.reduce((sum, item) => {
		const unit = item.unit?.toLowerCase();
		const parseVNNumber = (val: any) => {
			if (typeof val === 'number') return val;
			if (!val) return 0;
			const cleaned = String(val).replace(/[^0-9,.-]/g, '').replace(',', '.');
			return parseFloat(cleaned) || 0;
		};
		const density = parseVNNumber(item.density);
		const qty = Number(item.qty) || 0;
		if (unit === 'kg') return sum + qty;
		return sum + (qty * density);
	}, 0);

	const totalCostActual = lineItems.reduce((sum, item) => {
		const qty = Number(item.qty) || 0;
		const cost = getEffectiveCost(item);
		return sum + (qty * cost);
	}, 0);

	const profitItems = lineItems.filter(item => {
		const prod = products.find(p => p.id === item.productId);
		return !shouldExcludeFromProfit(prod?.name || '', prod?.excludeProfit);
	});
	const profitSubTotal = profitItems.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0), 0);
	const profitCostTotal = profitItems.reduce((sum, item) => {
		const qty = Number(item.qty) || 0;
		const cost = getEffectiveCost(item);
		return sum + (qty * cost);
	}, 0);
	const totalProfitActual = profitSubTotal - profitCostTotal - Number(discountAmt);

	const hasOverheadItems = lineItems.some(item => {
		if (!item.productId) return false;
		const prod = products.find(p => p.id === item.productId);
		return prod?.applyOverheadCost === true && overheadRate > 0;
	});

	// ── Filtered Customers ──
	const filteredCustomers = customers.filter(c =>
		isMatch(c.name || '', searchCustomerQuery) ||
		isMatch(c.name || '', searchCustomerQuery) ||
		isMatch(c.phone || '', searchCustomerQuery)
	);

	// ── Categories ──
	const categories = Array.from(new Map([
		'Tôn lợp', 'Xà gồ', 'Sắt hộp', 'Phụ kiện', 'Inox',
		...products.map(p => p.category)
	].filter(Boolean).map(cat => [normalizeText(cat), cat])).values()).sort((a: any, b: any) => String(a).localeCompare(String(b)));

	// ── Return ──
	return {
		// Data
		products,
		customers,
		allPayments,
		allOrders,
		loading,
		fetchingOrder,
		originalOrder,

		// Form state
		selectedCustomer, setSelectedCustomer,
		searchCustomerQuery, setSearchCustomerQuery,
		showCustomerResults, setShowCustomerResults,
		orderStatus, setOrderStatus,
		orderNote, setOrderNote,
		orderDate, setOrderDate,
		deliveryLocation, setDeliveryLocation,
		parsedLocation, setParsedLocation,

		// Line items
		lineItems, setLineItems,
		overheadRate,

		// Adjustments
		shippingFee, setShippingFee,
		discountAmt, setDiscountAmt,
		couponCode, setCouponCode,

		// Dropdown state
		activeRow, setActiveRow,
		activeField, setActiveField,
		lineSearchQuery, setLineSearchQuery,
		showProfitPreview, setShowProfitPreview,

		// Success state
		showSuccessModal, setShowSuccessModal,
		isSubmitting,
		showScanner, setShowScanner,

		// Functions
		addLineItem,
		removeLineItem,
		updateLineItem,
		handleApplyCoupon,
		handleConfirmOrder,
		handleQRScan,

		// Calculations
		subTotal,
		finalTotal,
		totalWeight,
		totalCostActual,
		totalProfitActual,
		hasOverheadItems,
		debtMap,

		// Helpers
		formatPrice,
		copyToClipboard,
		getEffectiveStock,
		getEffectiveCost,
		normalizeText,
		normalizeSmart,
		isMatch,
		filteredCustomers,
		categories,
		isAdmin,
		hasOrderPermission,

		// Refs
		customerSearchRef,
		dropdownRef,
	};
}
