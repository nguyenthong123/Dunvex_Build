import { useState, useEffect, useRef, useMemo } from 'react';
import { smartSearchMatch, calculateSearchScore } from '../utils/searchUtils';
import { calculateCouponDiscount } from '../utils/couponUtils';
import { findValidCustomerRebate } from '../utils/rebateUtils';
import { shouldExcludeFromProfit } from '../utils/profitUtils';
import { db, auth } from '../services/firebase';
import { collection, query, onSnapshot, doc, getDoc, serverTimestamp, where, getDocs, limit, Timestamp, runTransaction, increment } from '../services/firebase';
import { customerRebateService } from '../services/dataAccess';
import { useProducts } from './useProducts';
import { useCustomers } from './useCustomers';
import { sendTelegramNotification } from '../utils/telegramNotify';

interface UseOrderFormParams {
	owner: any;
	showToast: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
	editId?: string;
	location: any;
}

// ── Top-level Stable Normalization Helpers (không tạo lại mỗi render) ──
const normalizeText = (text: any) => text ? String(text).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase() : '';
const removeAccents = (str: any) => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
const normalizeSmart = (text: any) => removeAccents(normalizeText(text));
const parseVNQty = (val: any): number => {
	if (typeof val === 'number') return isNaN(val) ? 0 : val;
	if (!val) return 0;
	const cleaned = String(val).replace(/[^0-9,.-]/g, '').replace(',', '.');
	const parsed = parseFloat(cleaned);
	return isNaN(parsed) ? 0 : parsed;
};
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

export function useOrderForm({ owner, showToast, editId, location }: UseOrderFormParams) {
	// ── Data Hooks (products, customers) ──
	const { products: hookProducts } = useProducts({ ownerId: owner.ownerId, enabled: !owner.loading && !!owner.ownerId });
	const { customers: hookCustomers } = useCustomers({ ownerId: owner.ownerId, enabled: !owner.loading && !!owner.ownerId });

	// ── Core Data State ──
	const [products, setProducts] = useState<any[]>([]);
	const [customers, setCustomers] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [fetchingOrder, setFetchingOrder] = useState(false);
	const [originalOrder, setOriginalOrder] = useState<any>(null);
	const hasFetchedOrderRef = useRef<string | null>(null);

	useEffect(() => {
		setProducts(hookProducts.filter(p => !p.approvalStatus || p.approvalStatus === 'approved'));
		setLoading(false);
	}, [hookProducts]);
	useEffect(() => {
		setCustomers(hookCustomers.filter(c => !c.approvalStatus || c.approvalStatus === 'approved'));
	}, [hookCustomers]);

	// ── SKU Stock Map (Tra cứu O(1) giải phóng CPU, không bị duyệt lặp O(N^2)) ──
	const skuStockMap = useMemo(() => {
		const map = new Map<string, number>();
		products.forEach(p => {
			if (!p.linkedProductId) {
				const cleanSku = normalizeText(p.sku);
				if (cleanSku) {
					map.set(cleanSku, (map.get(cleanSku) || 0) + (Number(p.stock) || 0));
				}
			}
		});
		return map;
	}, [products]);

	const getEffectiveStock = (prod: any) => {
		if (!prod) return 0;
		if (prod.linkedProductId) {
			const linked = products.find(p => p.id === prod.linkedProductId);
			return linked?.stock || 0;
		}
		const cleanSku = normalizeText(prod.sku);
		if (cleanSku && skuStockMap.has(cleanSku)) {
			return skuStockMap.get(cleanSku) || 0;
		}
		return Number(prod.stock) || 0;
	};

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
		{ rowId: crypto.randomUUID(), id: crypto.randomUUID(), category: '', productId: '', name: '', serialNumber: '', qty: '', price: 0, buyPrice: 0, unit: '', packaging: '', density: '', maxStock: 0 }
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
	const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
	const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
	const [availableRebates, setAvailableRebates] = useState<any[]>([]);
	const [appliedRebate, setAppliedRebate] = useState<any>(null);
	const userManuallyClearedCoupon = useRef(false);
	const userManuallyClearedRebate = useRef(false);

	// Load active coupons for store
	useEffect(() => {
		if (owner.loading || !owner.ownerId) return;
		const q = query(
			collection(db, 'coupons'),
			where('ownerId', '==', owner.ownerId),
			where('status', '==', 'active')
		);
		const unsub = onSnapshot(q, (snap) => {
			const today = new Date().toISOString().split('T')[0];
			const active = snap.docs
				.map(d => ({ id: d.id, ...d.data() }))
				.filter((c: any) => !c.expiry || c.expiry >= today);
			setAvailableCoupons(active);
		}, (err) => console.error("Error fetching coupons:", err));
		return () => unsub();
	}, [owner.loading, owner.ownerId]);

	// Load active customer rebates for store
	useEffect(() => {
		if (owner.loading || !owner.ownerId) return;
		const unsub = customerRebateService.listenByOwner(
			owner.ownerId,
			(data) => {
				setAvailableRebates(data);
			},
			(err) => console.error("Error fetching customer rebates:", err)
		);
		return () => unsub();
	}, [owner.loading, owner.ownerId]);

	// Prefill coupon from URL search param if present (e.g., /quick-order?coupon=WJDKSAJZ)
	useEffect(() => {
		if (!location?.search || availableCoupons.length === 0) return;
		const params = new URLSearchParams(location.search);
		const codeParam = params.get('coupon');
		if (codeParam && !appliedCoupon) {
			const found = availableCoupons.find((c: any) => c.code?.toUpperCase() === codeParam.toUpperCase().trim());
			if (found) {
				setAppliedCoupon(found);
				setCouponCode(found.code);
			}
		}
	}, [location?.search, availableCoupons, appliedCoupon]);

	// ── Helper: getEffectiveCost ──
	function getEffectiveCost(item: any) {
		const buyPrice = Number(item.buyPrice) || 0;
		const product = products.find(p => p.id === item.productId);
		const hasOverhead = product?.applyOverheadCost === true;
		if (hasOverhead && overheadRate > 0) {
			return buyPrice * (1 + overheadRate / 100);
		}
		return buyPrice;
	}

	// ── Derived Values ──
	const subTotal = useMemo(() => {
		return lineItems.reduce((sum, item) => sum + (Number(item.price) || 0) * parseVNQty(item.qty), 0);
	}, [lineItems]);

	const finalTotal = useMemo(() => {
		return subTotal + Number(shippingFee) - Number(discountAmt);
	}, [subTotal, shippingFee, discountAmt]);

	const totalWeight = useMemo(() => {
		return lineItems.reduce((sum, item) => {
			const unit = item.unit?.toLowerCase();
			const density = parseVNQty(item.density);
			const qty = parseVNQty(item.qty);
			if (unit === 'kg') return sum + qty;
			return sum + (qty * density);
		}, 0);
	}, [lineItems]);

	const totalCostActual = useMemo(() => {
		return lineItems.reduce((sum, item) => {
			const qty = parseVNQty(item.qty);
			const cost = getEffectiveCost(item);
			return sum + (qty * cost);
		}, 0);
	}, [lineItems, products, overheadRate]);

	const profitItems = useMemo(() => {
		return lineItems.filter(item => {
			const prod = products.find(p => p.id === item.productId);
			return !shouldExcludeFromProfit(prod?.name || '', prod?.excludeProfit);
		});
	}, [lineItems, products]);

	const profitSubTotal = useMemo(() => {
		return profitItems.reduce((sum, item) => sum + (Number(item.price) || 0) * parseVNQty(item.qty), 0);
	}, [profitItems]);

	const profitCostTotal = useMemo(() => {
		return profitItems.reduce((sum, item) => {
			const qty = parseVNQty(item.qty);
			const cost = getEffectiveCost(item);
			return sum + (qty * cost);
		}, 0);
	}, [profitItems, products, overheadRate]);

	const totalProfitActual = useMemo(() => {
		return profitSubTotal - profitCostTotal - Number(discountAmt);
	}, [profitSubTotal, profitCostTotal, discountAmt]);

	const hasOverheadItems = useMemo(() => {
		return lineItems.some(item => {
			if (!item.productId) return false;
			const prod = products.find(p => p.id === item.productId);
			return prod?.applyOverheadCost === true && overheadRate > 0;
		});
	}, [lineItems, products, overheadRate]);

	// Tự động tính toán tổng chiết khấu (Chiết khấu SP / Coupon + Chiết khấu trả sau của khách hàng)
	useEffect(() => {
		let couponDisc = 0;
		if (appliedCoupon) {
			const res = calculateCouponDiscount(appliedCoupon, lineItems, subTotal, shippingFee);
			couponDisc = res.totalDiscount;
		} else if (!userManuallyClearedCoupon.current && availableCoupons.length > 0 && lineItems.some(i => i.productId && Number(i.qty) > 0)) {
			let bestCoupon: any = null;
			let maxDiscount = 0;

			for (const c of availableCoupons) {
				const res = calculateCouponDiscount(c, lineItems, subTotal, shippingFee);
				if (res.totalDiscount > maxDiscount) {
					maxDiscount = res.totalDiscount;
					bestCoupon = c;
				}
			}

			if (bestCoupon && maxDiscount > 0) {
				setAppliedCoupon(bestCoupon);
				setCouponCode(bestCoupon.code || '');
				couponDisc = maxDiscount;
				showToast(`✨ Tự động áp dụng chiết khấu sản phẩm [${bestCoupon.code}]: -${maxDiscount.toLocaleString('vi-VN')}đ`, "success");
			}
		}

		let rebateDisc = 0;
		if (appliedRebate) {
			rebateDisc = Number(appliedRebate.rebateAmount) || 0;
		}

		const totalDisc = couponDisc + rebateDisc;
		setDiscountAmt(totalDisc);
	}, [appliedCoupon, appliedRebate, availableCoupons, lineItems, subTotal, shippingFee, showToast]);

	const handleSelectCoupon = (coupon: any) => {
		userManuallyClearedCoupon.current = false;
		setAppliedCoupon(coupon);
		setCouponCode(coupon.code || '');
		const res = calculateCouponDiscount(coupon, lineItems, subTotal, shippingFee);
		const rebDisc = appliedRebate ? (Number(appliedRebate.rebateAmount) || 0) : 0;
		setDiscountAmt(res.totalDiscount + rebDisc);
		showToast(`Đã áp dụng: ${coupon.title || coupon.code} (-${res.totalDiscount.toLocaleString('vi-VN')}đ)`, "success");
	};

	const handleRemoveCoupon = () => {
		userManuallyClearedCoupon.current = true;
		setAppliedCoupon(null);
		setCouponCode('');
		const rebDisc = appliedRebate ? (Number(appliedRebate.rebateAmount) || 0) : 0;
		setDiscountAmt(rebDisc);
		showToast("Đã gỡ mã giảm giá", "info");
	};

	// ── Tự động nhận diện & áp dụng Chiết khấu trả sau theo Khách hàng ──
	useEffect(() => {
		if (userManuallyClearedRebate.current) return;
		const custId = selectedCustomer?.id;
		const custName = selectedCustomer?.name || searchCustomerQuery;
		if (!custId && !custName) {
			if (appliedRebate) {
				setAppliedRebate(null);
			}
			return;
		}

		const dateToCheck = orderDate || new Date().toISOString().split('T')[0];
		const validRebate = findValidCustomerRebate(availableRebates, custId, custName, dateToCheck);

		if (validRebate && (!appliedRebate || appliedRebate.id !== validRebate.id)) {
			setAppliedRebate(validRebate);
			const rebDisc = Number(validRebate.rebateAmount) || 0;
			showToast(`✨ Áp dụng chiết khấu trả sau của [${validRebate.customerName}]: -${rebDisc.toLocaleString('vi-VN')}đ (Thời hạn: ${validRebate.startDate || '...'} → ${validRebate.endDate || '...'})`, "success");
		} else if (!validRebate && appliedRebate) {
			setAppliedRebate(null);
		}
	}, [selectedCustomer, searchCustomerQuery, orderDate, availableRebates, appliedRebate]);

	const handleSelectRebate = (rebate: any) => {
		userManuallyClearedRebate.current = false;
		setAppliedRebate(rebate);
		const rebDisc = Number(rebate.rebateAmount) || 0;
		let couponDisc = 0;
		if (appliedCoupon) {
			const res = calculateCouponDiscount(appliedCoupon, lineItems, subTotal, shippingFee);
			couponDisc = res.totalDiscount;
		}
		setDiscountAmt(couponDisc + rebDisc);
		showToast(`Đã áp dụng chiết khấu của ${rebate.customerName}: -${rebDisc.toLocaleString('vi-VN')}đ`, "success");
	};

	const handleRemoveRebate = () => {
		userManuallyClearedRebate.current = true;
		setAppliedRebate(null);
		let couponDisc = 0;
		if (appliedCoupon) {
			const res = calculateCouponDiscount(appliedCoupon, lineItems, subTotal, shippingFee);
			couponDisc = res.totalDiscount;
		}
		setDiscountAmt(couponDisc);
		showToast("Đã gỡ chiết khấu trả sau của khách hàng", "info");
	};

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

	// Reset fetched ref khi editId thay đổi hoặc trở về tạo đơn mới
	useEffect(() => {
		if (!editId) {
			hasFetchedOrderRef.current = null;
			setOriginalOrder(null);
		}
	}, [editId]);

	// ── Fetch Order for Editing (Chạy ngay khi có editId & ownerId, không chờ customers/products) ──
	useEffect(() => {
		if (!editId || !owner.ownerId) return;
		if (hasFetchedOrderRef.current === editId) return;

		const fetchOrder = async () => {
			setFetchingOrder(true);
			try {
				const orderRef = doc(db, 'orders', editId);
				const orderSnap = await getDoc(orderRef);
				if (orderSnap.exists()) {
					hasFetchedOrderRef.current = editId;
					const data = orderSnap.data();
					setOriginalOrder(data);

					const rawItems = Array.isArray(data.items) ? data.items : (Array.isArray((data as any).products) ? (data as any).products : []);
					if (rawItems.length > 0) {
						setLineItems(rawItems.map((item: any) => {
							const currentProduct = products.find(p => p.id === (item.productId || item.id));
							
							const historicalBuyPrice = item.buyPrice !== undefined && item.buyPrice !== null 
								? Number(item.buyPrice) 
								: Number(currentProduct?.priceImport || 0);

							const newRowId = crypto.randomUUID();
							return {
								rowId: newRowId,
								id: newRowId,
								productId: item.productId || item.id || currentProduct?.id || '',
								sku: item.sku || currentProduct?.sku || '',
								name: item.name || currentProduct?.name || 'Sản phẩm đã xóa',
								category: item.category || currentProduct?.category || '',
								qty: item.qty != null ? item.qty : '',
								price: item.price !== undefined ? Number(item.price) : 0,
								buyPrice: historicalBuyPrice,
								unit: item.unit || currentProduct?.unit || '',
								packaging: item.packaging || currentProduct?.packaging || '',
								density: item.density || currentProduct?.density || '',
								specification: item.specification || currentProduct?.specification || '',
								serialNumber: item.serialNumber || '',
								imageUrl: item.imageUrl || currentProduct?.imageUrl || '',
								maxStock: currentProduct ? (Number(currentProduct.stock) || 0) : 0,
								validated: true
							};
						}));
					}

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
						setSearchCustomerQuery(foundCust.name || '');
					} else if (data.customerId || data.customerName) {
						setSelectedCustomer({
							id: data.customerId || '',
							name: data.customerName || '',
							phone: data.customerPhone || '',
							businessName: data.customerBusinessName || data.customerName || '',
							address: data.customerAddress || ''
						});
						setSearchCustomerQuery(data.customerName || '');
					}
				}
			} catch (err) {
				console.error("fetchOrder error:", err);
			} finally {
				setFetchingOrder(false);
			}
		};
		fetchOrder();
	}, [editId, owner.ownerId]);

	// Khi danh sách khách hàng load xong, bổ sung thông tin chi tiết cho selectedCustomer nếu đang dùng fallback
	useEffect(() => {
		if (selectedCustomer?.id && customers.length > 0 && !selectedCustomer.creditLimit) {
			const realCust = customers.find(c => c.id === selectedCustomer.id);
			if (realCust) {
				setSelectedCustomer(realCust);
			}
		}
	}, [customers, selectedCustomer?.id]);

	// Khi danh sách sản phẩm load xong, đồng bộ maxStock & name cho các mặt hàng vừa fetch từ đơn cũ
	useEffect(() => {
		if (products.length > 0) {
			setLineItems(prev => {
				let changed = false;
				const updated = prev.map(item => {
					if (!item.productId) return item;
					const prod = products.find(p => p.id === item.productId);
					if (prod) {
						const currentMax = Number(prod.stock) || 0;
						if (item.maxStock !== currentMax || (item.name === 'Sản phẩm đã xóa' && prod.name)) {
							changed = true;
							return {
								...item,
								name: item.name === 'Sản phẩm đã xóa' ? prod.name : item.name,
								maxStock: currentMax,
								sku: item.sku || prod.sku || '',
								unit: item.unit || prod.unit || '',
								category: item.category || prod.category || ''
							};
						}
					}
					return item;
				});
				return changed ? updated : prev;
			});
		}
	}, [products]);

	// ── Debt Map (Đọc trực tiếp từ danh sách khách hàng, không tải hàng ngàn đơn cũ gây lag) ──
	const debtMap = useMemo(() => {
		const map: Record<string, number> = {};
		customers.forEach(c => {
			if (c.id) {
				map[c.id] = Number(c.debt ?? c.totalDebt ?? 0);
			}
		});
		return map;
	}, [customers]);

	// ── Smart Packaging Sync (An toàn, cập nhật packaging mà KHÔNG BAO GIỜ chạm vào qty của người dùng) ──
	useEffect(() => {
		if (loading || products.length === 0 || fetchingOrder) return;
		
		setLineItems(prev => {
			let hasLocalChange = false;
			const updated = prev.map(item => {
				if (!item.name && !item.productId) return item;
				if (item.validated && item.packaging) return item;

				const matchedProd = products.find(p => 
					p.id === item.productId || 
					(p.sku && item.sku && normalizeText(p.sku) === normalizeText(item.sku)) ||
					(normalizeSmart(p.name) === normalizeSmart(item.name))
				);

				if (matchedProd && matchedProd.packaging && item.packaging !== matchedProd.packaging) {
					hasLocalChange = true;
					return { ...item, packaging: matchedProd.packaging, validated: true };
				}
				return item;
			});

			return hasLocalChange ? updated : prev;
		});
	}, [products, loading, fetchingOrder]);

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

					const newRowId = crypto.randomUUID();
					if (foundProd) {
						return {
							rowId: newRowId,
							id: newRowId,
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
						rowId: newRowId,
						id: newRowId,
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

	// ── Line Item Actions (Cập nhật bất biến, bảo toàn số lượng chính xác tuyệt đối) ──
	const addLineItem = () => {
		const newRowId = crypto.randomUUID();
		setLineItems(prev => [
			...prev,
			{ rowId: newRowId, id: newRowId, category: '', productId: '', sku: '', name: '', imageUrl: '', serialNumber: '', qty: '', price: 0, buyPrice: 0, unit: '', packaging: '', density: '', maxStock: 0 }
		]);
	};

	const removeLineItem = (indexOrId: number | string) => {
		setLineItems(prev => {
			if (prev.length <= 1) return prev;
			return prev.filter((item, i) => {
				if (typeof indexOrId === 'number') return i !== indexOrId;
				return (item.rowId ? item.rowId !== indexOrId : item.id !== indexOrId);
			});
		});
	};

	const updateLineItem = (indexOrId: number | string, field: string, value: any) => {
		setLineItems(prev => prev.map((item, i) => {
			const isTarget = typeof indexOrId === 'number'
				? i === indexOrId
				: ((item.rowId && item.rowId === indexOrId) || item.id === indexOrId);
			if (!isTarget) return item;

			const updated = { ...item, [field]: value };

			if (field === 'productId') {
				const prod = products.find(p => p.id === value);
				if (prod) {
					updated.name = prod.name;
					updated.sku = prod.sku || '';
					updated.serialNumber = prod.serialNumber || '';
					updated.price = prod.priceSell;
					updated.buyPrice = prod.priceImport || 0;
					updated.unit = prod.unit;
					updated.category = prod.category;
					updated.packaging = prod.packaging;
					updated.specification = prod.specification || '';
					updated.density = prod.density;
					updated.imageUrl = prod.imageUrl || '';
					updated.maxStock = getEffectiveStock(prod);
					updated.validated = true;
				}
			}
			return updated;
		}));
	};

	// ── QR Scan Handler ──
	const handleQRScan = (productId: string) => {
		const product = products.find(p => p.id === productId);
		if (product) {
			vibrate(50);
			setLineItems(prev => {
				const emptyIdx = prev.findIndex(item => !item.productId);
				if (emptyIdx !== -1) {
					return prev.map((item, i) => {
						if (i !== emptyIdx) return item;
						return {
							...item,
							category: product.category || '',
							productId: product.id,
							sku: product.sku || '',
							name: product.name,
							qty: item.qty || 1,
							price: product.priceSell,
							buyPrice: product.priceImport || 0,
							unit: product.unit,
							packaging: product.packaging,
							density: product.density,
							imageUrl: product.imageUrl || '',
							serialNumber: product.serialNumber || '',
							maxStock: getEffectiveStock(product),
							validated: true
						};
					});
				}

				const newRowId = crypto.randomUUID();
				return [
					...prev,
					{
						rowId: newRowId,
						id: newRowId,
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
						maxStock: getEffectiveStock(product),
						validated: true
					}
				];
			});
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

			const couponSnap = querySnapshot.docs[0];
			const coupon = { id: couponSnap.id, ...couponSnap.data() };

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

			const res = calculateCouponDiscount(coupon, lineItems, subTotal, shippingFee);

			if (coupon.scope === 'product' && res.appliedCount === 0) {
				showToast(`Mã "${coupon.code}" áp dụng cho sản phẩm khác, đơn hàng hiện chưa có sản phẩm được chiết khấu`, "warning");
			}

			setAppliedCoupon(coupon);
			setDiscountAmt(res.totalDiscount);

			if (coupon.scope === 'product') {
				showToast(`Đã áp dụng: ${coupon.title} (${res.appliedCount} sản phẩm khớp chiết khấu -${res.totalDiscount.toLocaleString('vi-VN')}đ)`, "success");
			} else {
				showToast(`Đã áp dụng: ${coupon.title} (-${res.totalDiscount.toLocaleString('vi-VN')}đ)`, "success");
			}

		} catch (error) {
			showToast("Lỗi khi áp dụng mã: " + error, "error");
		}
	};

	// ── Confirm Order Handler ── (the big one)
	const handleConfirmOrder = async () => {
		const validItems = lineItems.filter(item => item.productId && parseVNQty(item.qty) > 0);
		if (validItems.length === 0) {
			showToast("Vui lòng thêm sản phẩm vào đơn hàng", "warning");
			return;
		}

		setIsSubmitting(true);
		try {
			const processedItems: any[] = [];
			const stockDeletions: any[] = [];
			// Tracking tồn kho ảo giữa các dòng trong cùng 1 đơn hàng tránh trừ trùng
			const virtualStock = new Map<string, number>();
			products.forEach(p => virtualStock.set(p.id, Number(p.stock) || 0));

			validItems.forEach(item => {
				const itemQty = parseVNQty(item.qty);
				let remainingQty = itemQty;

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
					const available = virtualStock.get(cand.id) ?? (Number(cand.stock) || 0);
					if (available <= 0) continue;

					const take = Math.min(remainingQty, available);
					stockDeletions.push({
						originProductId: item.productId,
						productId: cand.id,
						qty: take,
						productName: cand.name,
						buyPrice: cand.priceImport || 0
					});
					virtualStock.set(cand.id, available - take);
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
					productId: item.productId,
					rowId: item.rowId || crypto.randomUUID(),
					sku: item.sku || '',
					name: item.name || sourceProduct?.name || 'Sản phẩm đã xóa',
					price: item.price !== undefined ? Number(item.price) : 0,
					buyPrice: exactBuyPrice,
					qty: itemQty,
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
				rebateId: appliedRebate?.id || null,
				rebateAmount: appliedRebate ? (Number(appliedRebate.rebateAmount) || 0) : 0,
				rebateCustomerName: appliedRebate?.customerName || null,
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
						transaction.update(doc(db, 'customers', oldCustomerId), {
							debt: increment(-oldTotal),
							totalDebt: increment(-oldTotal),
							totalOrdersAmount: increment(-oldTotal),
							updatedAt: serverTimestamp()
						});
					}
					if (customerChanged) {
						if (custExists && orderData.customerId && newTotal > 0) {
							const debtRef = doc(collection(db, 'debts'));
							transaction.set(debtRef, {
								customerId: orderData.customerId,
								customerName: orderData.customerName,
								type: 'debt_increase',
								amount: newTotal,
								orderId: editId,
								note: `Đổi khách từ ${originalOrder?.customerName || '?'}`,
								ownerId: owner.ownerId || '',
								createdBy: auth.currentUser?.uid || '',
								createdAt: serverTimestamp()
							});
							transaction.update(doc(db, 'customers', orderData.customerId), {
								debt: increment(newTotal),
								totalDebt: increment(newTotal),
								totalOrdersAmount: increment(newTotal),
								updatedAt: serverTimestamp()
							});
						}
					} else if (diffDebt !== 0) {
						const debtRef = doc(collection(db, 'debts'));
						transaction.set(debtRef, {
							customerId: orderData.customerId,
							customerName: orderData.customerName,
							type: diffDebt > 0 ? 'debt_increase' : 'payment',
							amount: Math.abs(diffDebt),
							orderId: editId,
							note: diffDebt > 0 ? `Cập nhật đơn hàng tăng nợ` : `Cập nhật đơn hàng giảm nợ`,
							ownerId: owner.ownerId || '',
							createdBy: auth.currentUser?.uid || '',
							createdAt: serverTimestamp()
						});
						if (custExists && orderData.customerId) {
							transaction.update(doc(db, 'customers', orderData.customerId), {
								debt: increment(diffDebt),
								totalDebt: increment(diffDebt),
								totalOrdersAmount: increment(diffDebt),
								updatedAt: serverTimestamp()
							});
						}
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
- Nhân viên: ${owner.userDisplayName || auth.currentUser?.displayName || 'Admin'}`, 'order', {
						customerName: orderData.customerName,
						totalAmount: finalTotal,
						status: 'Đã sửa đơn',
						actorName: owner.userDisplayName || auth.currentUser?.displayName || 'Admin'
					});
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
						transaction.update(doc(db, 'customers', orderData.customerId), {
							debt: increment(Number(finalTotal || 0)),
							totalDebt: increment(Number(finalTotal || 0)),
							totalOrdersAmount: increment(Number(finalTotal || 0)),
							updatedAt: serverTimestamp()
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

					// Trừ 1 lượt chiết khấu trả sau của khách hàng CHỈ KHI trạng thái là Đơn chốt
					if (orderStatus === 'Đơn chốt' && appliedRebate?.id) {
						const rebateRef = doc(db, 'customer_rebates', appliedRebate.id);
						const rebateSnap = await transaction.get(rebateRef);
						if (rebateSnap.exists()) {
							const rData = rebateSnap.data();
							const curUsed = Number(rData.usedCount) || 0;
							const maxU = Number(rData.maxUsage) || 1;
							const curOrders = Array.isArray(rData.usedOrderIds) ? rData.usedOrderIds : [];
							const nextUsed = curUsed + 1;
							transaction.update(rebateRef, {
								usedCount: nextUsed,
								usedOrderIds: [...curOrders, newOrderRef.id],
								status: nextUsed >= maxU ? 'used' : 'active',
								updatedAt: serverTimestamp()
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
- Nhân viên lên đơn: ${owner.userDisplayName || auth.currentUser?.displayName || 'Admin'}`, 'order', {
						customerName: orderData.customerName,
						totalAmount: finalTotal,
						status: 'Đơn chốt mới',
						actorName: owner.userDisplayName || auth.currentUser?.displayName || 'Admin'
					});
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

	// ── Filtered Customers (useMemo + pre-scored sort để phản hồi tức thì, không gây lag) ──
	const filteredCustomers = useMemo(() => {
		const q = searchCustomerQuery?.trim() || '';
		if (!q) return customers.slice(0, 40);

		const matches = customers.filter(c =>
			smartSearchMatch([
				c.name || '',
				c.businessName || '',
				c.phone || '',
				c.address || '',
				c.taxCode || '',
				c.route || '',
				c.note || ''
			], q)
		);

		const scored = matches.map(c => ({
			item: c,
			score: calculateSearchScore(c, q, { primary: ['name', 'businessName', 'phone'] })
		}));
		scored.sort((a, b) => {
			if (a.score !== b.score) return b.score - a.score;
			return (a.item.name || '').localeCompare(b.item.name || '');
		});
		return scored.slice(0, 40).map(s => s.item);
	}, [customers, searchCustomerQuery]);

	// ── Categories (useMemo để không parse lại từ đầu mỗi khi re-render) ──
	const categories = useMemo(() => {
		return Array.from(new Map([
			'Tôn lợp', 'Xà gồ', 'Sắt hộp', 'Phụ kiện', 'Inox',
			...products.map(p => p.category)
		].filter(Boolean).map(cat => [normalizeText(cat), cat])).values()).sort((a: any, b: any) => String(a).localeCompare(String(b)));
	}, [products]);

	// ── Return ──
	return {
		// Data
		products,
		customers,
		allPayments: [] as any[],
		allOrders: [] as any[],
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
		appliedCoupon,
		availableCoupons,
		handleSelectCoupon,
		handleRemoveCoupon,

		// Customer Rebate state
		appliedRebate,
		availableRebates,
		handleSelectRebate,
		handleRemoveRebate,

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
