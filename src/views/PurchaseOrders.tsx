import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Plus, Search, Trash, X, ArrowLeft, CheckCircle2, Package, History, MessageCircle, Send, Loader, Edit3 } from 'lucide-react';
import { useOwner } from '../hooks/useOwner';
import { useSuppliers } from '../hooks/useSuppliers';
import { useProducts } from '../hooks/useProducts';
import { usePurchaseOrders } from '../hooks/usePurchaseOrders';
import { useSupplierDebts } from '../hooks/useSupplierDebts';
import { useToast } from '../components/shared/Toast';
import { serverTimestamp, runTransaction, doc, collection, writeBatch, increment, addDoc, getDoc, setDoc, updateDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { inventoryService } from '../services/dataAccess';
import { parseSupplyMessage } from '../services/supplyBotService';

// 🔍 Chuẩn hóa tiếng Việt để tìm kiếm chính xác (bỏ dấu, lowercase, NFC)
function normalizeVN(text: string): string {
    return text
        .normalize('NFC')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\s]+/g, '')
        .trim();
}

// 🔍 Fuzzy match sản phẩm (copy từ SaleBot)
function findMatchingProduct(name: string, allProducts: any[]): any | null {
    const searchName = (name || '').toLowerCase().trim();
    const searchNameVN = normalizeVN(name || '');
    
    // 1: Khớp chính xác tên
    let found = allProducts.find(p => (p.name || '').toLowerCase() === searchName);
    if (found) return found;
    
    // 2: DB name contains search name
    found = allProducts.find(p => (p.name || '').toLowerCase().includes(searchName));
    if (found) return found;
    
    // 3: Search name contains DB name
    found = allProducts.find(p => searchName.includes((p.name || '').toLowerCase()));
    if (found) return found;
    
    // 4: Fuzzy Vietnamese match
    if (searchNameVN.length >= 2) {
        found = allProducts.find(p => normalizeVN(p.name || '').includes(searchNameVN));
        if (found) return found;
        
        found = allProducts.find(p => {
            const dbVN = normalizeVN(p.name || '');
            return dbVN.length >= 2 && searchNameVN.includes(dbVN);
        });
        if (found) return found;
    }
    
    return null;
}

const PurchaseOrders = () => {
	const navigate = useNavigate();
	const owner = useOwner();
	const { showToast } = useToast();
	
	const { suppliers, updateSupplier } = useSuppliers();
	const { products, update, create } = useProducts({ ownerId: owner.ownerId, enabled: !!owner.ownerId });
	const { purchaseOrders, loading, addPurchaseOrder, deletePurchaseOrder, updatePurchaseOrder } = usePurchaseOrders();
	const { addDebt } = useSupplierDebts();

	const [showCreateForm, setShowCreateForm] = useState(false);
	const [searchTerm, setSearchTerm] = useState('');

	const searchInputRef = useRef<HTMLInputElement>(null);

	// ─── Supply Bot Chat State ───
	const [chatOpen, setChatOpen] = useState(false);
	const [chatInput, setChatInput] = useState('');
	const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([
		{ role: 'bot', text: '👋 Chào anh! Tôi là trợ lý nhập hàng. Tôi có thể giúp anh:\n• Tạo nhà cung cấp mới\n• Tạo đơn nhập hàng\n• Ghi nhận trả nợ NCC\n• Nhập hàng từ Google Sheet' }
	]);
	const [chatLoading, setChatLoading] = useState(false);
	const chatInitialLoad = useRef(true);

	// 🔄 Lưu & tải lịch sử chat từ Firestore
	const supplyChatDocId = owner.ownerId && auth.currentUser?.uid ? `supply_bot_${owner.ownerId}_${auth.currentUser.uid}` : null;

	useEffect(() => {
		if (!supplyChatDocId) return;
		const loadChat = async () => {
			try {
				const snap = await getDoc(doc(db, 'supply_bot_chats', supplyChatDocId));
				if (snap.exists()) {
					const data = snap.data();
					if (data.messages && data.messages.length > 0) {
						setChatMessages(data.messages);
					}
				}
			} catch (err) {
				console.error('Load supply chat error:', err);
			} finally {
				setTimeout(() => { chatInitialLoad.current = false; }, 200);
			}
		};
		loadChat();
	}, [supplyChatDocId]);

	useEffect(() => {
		if (chatInitialLoad.current || !supplyChatDocId) return;
		const recent = chatMessages.slice(-30);
		setDoc(doc(db, 'supply_bot_chats', supplyChatDocId), {
			ownerId: owner.ownerId,
			userId: auth.currentUser?.uid,
			messages: recent,
			updatedAt: serverTimestamp()
		}, { merge: true }).catch(err => console.error('Save supply chat error:', err));
	}, [chatMessages, supplyChatDocId, owner.ownerId]);
	const [pendingSheetOrder, setPendingSheetOrder] = useState<{ items: any[]; total: number; notFound: string[] } | null>(null);
	const [detailPO, setDetailPO] = useState<any | null>(null);
	const [poZoom, setPoZoom] = useState(1);
	const [deletingPO, setDeletingPO] = useState<string | null>(null); // PO đang chờ xác nhận xoá
	const [cancellingPO, setCancellingPO] = useState<string | null>(null); // PO đang được xoá (loading)
	const [editingPO, setEditingPO] = useState<any>(null); // PO đang được chỉnh sửa
	const chatEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleOpenSearch = () => {
			if (showCreateForm) setShowCreateForm(false);
			setTimeout(() => searchInputRef.current?.focus(), 200);
		};
		window.addEventListener('open-mobile-search', handleOpenSearch);
		return () => window.removeEventListener('open-mobile-search', handleOpenSearch);
	}, [showCreateForm]);

	// Create PO Form State
	const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
	const [orderNote, setOrderNote] = useState('');
	const [items, setItems] = useState<any[]>([{ id: crypto.randomUUID(), category: 'Tất cả', productId: '', name: '', qty: '', priceImport: 0 }]);
	const [paidAmount, setPaidAmount] = useState('');

	// 💾 Persist form state to sessionStorage (chống mất form khi tab bị reload/logout)
	const PO_DRAFT_KEY = 'po_form_draft';
	const formRestored = useRef(false);

	// Khôi phục form khi mount/reload
	useEffect(() => {
		try {
			const saved = sessionStorage.getItem(PO_DRAFT_KEY);
			if (saved) {
				const data = JSON.parse(saved);
				if (data.showCreateForm) {
					if (data.editingPO) setEditingPO(data.editingPO);
					if (data.selectedSupplier) setSelectedSupplier(data.selectedSupplier);
					if (data.orderNote) setOrderNote(data.orderNote);
					if (data.items?.length) setItems(data.items);
					if (data.paidAmount) setPaidAmount(data.paidAmount);
					setShowCreateForm(true);
					formRestored.current = true;
				}
			}
		} catch {}
	}, []);

	// Tự động lưu form state mỗi khi có thay đổi (bỏ qua lần đầu nếu vừa restore)
	useEffect(() => {
		if (formRestored.current) { formRestored.current = false; return; }
		try {
			if (showCreateForm) {
				sessionStorage.setItem(PO_DRAFT_KEY, JSON.stringify({
					showCreateForm,
					editingPO,
					selectedSupplier,
					orderNote,
					items,
					paidAmount,
				}));
			} else {
				sessionStorage.removeItem(PO_DRAFT_KEY);
			}
		} catch {}
	}, [showCreateForm, editingPO, selectedSupplier, orderNote, items, paidAmount]);

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
	
	const categories = Array.from(new Set([
		'Tất cả',
		...products.map(p => (p as any).category).filter(Boolean)
	])).sort((a: any, b: any) => {
		if (a === 'Tất cả') return -1;
		if (b === 'Tất cả') return 1;
		return String(a).localeCompare(String(b));
	});

	const activeCategory = activeRow !== null ? items[activeRow]?.category : null;
	const filteredProducts = products.filter(p => {
		const matchSearch = isMatch(p.name, productSearchQuery) || isMatch(p.sku, productSearchQuery);
		const matchCategory = !activeCategory || activeCategory === 'Tất cả' || (p as any).category === activeCategory;
		return matchSearch && matchCategory;
	}).slice(0, 20);

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
			setItems([{ id: crypto.randomUUID(), category: 'Tất cả', productId: '', name: '', qty: '', priceImport: 0 }]);
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

		const orderData = {
			supplierId: selectedSupplier.id,
			supplierName: selectedSupplier.name,
			items: validItems,
			totalAmount,
			paidAmount: paidNum,
			debtAmount: unpaidAmount,
			note: orderNote,
			status: 'Hoàn thành',
			orderDate: editingPO ? editingPO.orderDate : new Date().toISOString()
		};

		try {
			// 🔄 CHỈNH SỬA ĐƠN: Cập nhật thay vì tạo mới
			if (editingPO) {
				// Tính chênh lệch tồn kho
				const oldItems: Record<string, number> = {};
				(editingPO.items || []).forEach((item: any) => {
					if (item.productId) oldItems[item.productId] = (oldItems[item.productId] || 0) + Number(item.qty || 0);
				});
				const newItems: Record<string, number> = {};
				validItems.forEach(item => {
					newItems[item.productId] = (newItems[item.productId] || 0) + Number(item.qty);
				});

				const allProductIds = [...new Set([...Object.keys(oldItems), ...Object.keys(newItems)])];

				// Atomic transaction: PHẢI ĐỌC TẤT CẢ trước khi ghi bất kỳ gì
				await runTransaction(db, async (transaction) => {
					// ── BƯỚC 1: ĐỌC TẤT CẢ DOCS (bắt buộc trước mọi write) ──
					const productRefs = allProductIds.map(id => doc(db, 'products', id));
					const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));

					const supplierRef = doc(db, 'suppliers', selectedSupplier.id);
					const supplierSnap = await transaction.get(supplierRef);
					const supplierData = supplierSnap.exists() ? (supplierSnap.data() || {}) : {};

					const poRef = doc(db, 'purchase_orders', editingPO.id);

					// ── BƯỚC 2: GHI TẤT CẢ (sau khi đọc xong) ──
					for (let i = 0; i < allProductIds.length; i++) {
						const pid = allProductIds[i];
						const snap = productSnaps[i];
						if (!snap.exists()) continue;
						const oldQty = oldItems[pid] || 0;
						const newQty = newItems[pid] || 0;
						const diff = newQty - oldQty;
						if (diff !== 0) {
							const data = snap.data();
							const currentStock = Number(data.stock) || 0;
							transaction.update(productRefs[i], {
								stock: currentStock + diff,
								priceImport: newItems[pid] > 0 ? (validItems.find(v => v.productId === pid)?.priceImport ?? data.priceImport) : data.priceImport
							});
						}
					}

					const oldDebt = editingPO.debtAmount || 0;
					const debtDiff = unpaidAmount - oldDebt;
					if (debtDiff !== 0) {
						transaction.update(supplierRef, {
							totalDebt: (supplierData.totalDebt || 0) + debtDiff
						});
					}
					if (debtDiff > 0) {
						const debtRef = doc(collection(db, 'supplier_debts'));
						transaction.set(debtRef, {
							ownerId: owner.ownerId, supplierId: selectedSupplier.id, supplierName: selectedSupplier.name,
							type: 'debt_increase', amount: debtDiff,
							note: `Điều chỉnh nợ - sửa PO #${editingPO.id.slice(0, 8)}`,
							orderId: editingPO.id, createdBy: owner.ownerId, createdAt: serverTimestamp()
						});
					}

					transaction.update(poRef, {
						...orderData,
						updatedAt: serverTimestamp()
					});
				});

				// Ghi inventory logs cho chênh lệch (ngoài transaction)
				await Promise.all(allProductIds.map(async (pid) => {
					const oldQty = oldItems[pid] || 0;
					const newQty = newItems[pid] || 0;
					const diff = newQty - oldQty;
					if (diff === 0) return;
					const item = validItems.find(v => v.productId === pid);
					await inventoryService.addLog({
						ownerId: owner.ownerId,
						productId: pid,
						productName: item?.name || pid,
						type: diff > 0 ? 'import' : 'export',
						change: Math.abs(diff),
						note: `Sửa đơn nhập - PO #${editingPO.id.slice(0, 8)} (chênh lệch ${diff > 0 ? '+' : ''}${diff})`,
						priceImport: Number(item?.priceImport || 0),
					}).catch(e => console.warn('Inventory log failed:', e));
				}));

				resetEditForm();
				showToast("Đã cập nhật phiếu nhập kho", "success");
				return;
			}

			// ─── P0 FIX: Atomic Firestore transaction ───
			// Tất cả các bước (tạo PO + update stock + tạo debt + update totalDebt) chạy trong 1 transaction
			const orderId = await runTransaction(db, async (transaction) => {
				// Đọc tất cả product docs + supplier doc trước khi ghi (yêu cầu của Firestore transaction)
				const productRefs = validItems.map(item => doc(db, 'products', item.productId));
				const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));

				const supplierRef = doc(db, 'suppliers', selectedSupplier.id);
				const supplierSnap = await transaction.get(supplierRef);
				const supplierData = supplierSnap.data() || {};

				// 1. Tạo Purchase Order document
				const poRef = doc(collection(db, 'purchase_orders'));
				const poId = poRef.id;
				transaction.set(poRef, {
					...orderData,
					ownerId: owner.ownerId,
					createdAt: serverTimestamp(),
					createdBy: owner.ownerId
				});

				// 2. Cập nhật Tồn kho + Giá nhập từng SP
				for (let i = 0; i < validItems.length; i++) {
					const item = validItems[i];
					const snap = productSnaps[i];
					if (!snap.exists()) continue;
					const productData = snap.data();
					const oldStock = Number(productData.stock) || 0;
					const newStock = oldStock + Number(item.qty);
					transaction.update(productRefs[i], {
						stock: newStock,
						priceImport: Number(item.priceImport)
					});

					// 3. P1: Ghi inventory_logs (không atomic được vì transaction ko hỗ trợ addDoc trực tiếp)
					// Sẽ ghi sau transaction
				}

				// 4. Tạo công nợ + Cập nhật totalDebt của NCC (nếu có nợ)
				if (unpaidAmount > 0) {
					const debtRef = doc(collection(db, 'supplier_debts'));
					transaction.set(debtRef, {
						ownerId: owner.ownerId,
						supplierId: selectedSupplier.id,
						supplierName: selectedSupplier.name,
						type: 'debt_increase',
						amount: unpaidAmount,
						note: `Nợ đơn nhập hàng ngày ${new Date().toLocaleDateString('vi-VN')}`,
						orderId: poId,
						createdBy: owner.ownerId,
						createdAt: serverTimestamp()
					});
					transaction.update(supplierRef, {
						totalDebt: (supplierData.totalDebt || 0) + unpaidAmount
					});
				}

				return poId;
			});

			// P1 #3: Ghi inventory_logs sau transaction (không thể trong transaction)
			const logPromises = validItems.map(async (item) => {
				const product = products.find(p => p.id === item.productId);
				await inventoryService.addLog({
					ownerId: owner.ownerId,
					productId: item.productId,
					productName: item.name,
					type: 'import',
					change: Number(item.qty),
					note: `Nhập hàng từ ${selectedSupplier.name} - PO #${orderId.slice(0, 8)}`,
					priceImport: Number(item.priceImport),
					beforeStock: product?.stock || 0,
					afterStock: (product?.stock || 0) + Number(item.qty),
				});
			});
			// Fire-and-forget inventory logs (non-critical)
			Promise.all(logPromises).catch(e => console.warn('Inventory logs failed:', e));

			// If paidAmount > 0, we should record a payment transaction too, but to keep it simple, it's just "tiền trả ngay".

			resetEditForm();
			showToast("Đã hoàn thành phiếu nhập kho", "success");
		} catch (error: any) {
			console.error('Submit PO error:', error);
			showToast(`Có lỗi xảy ra: ${error?.message || 'Không xác định'}`, "error");
		}
	};

	// Reset form sau khi tạo hoặc sửa đơn
	const resetEditForm = () => {
		setEditingPO(null);
		setSelectedSupplier(null);
		setOrderNote('');
		setItems([{ id: crypto.randomUUID(), category: 'Tất cả', productId: '', name: '', qty: '', priceImport: 0 }]);
		setPaidAmount('');
		setShowCreateForm(false);
	};

	// P1 #4.5: Chỉnh sửa đơn nhập hàng → chuyển sang tab Tạo đơn với dữ liệu cũ
	const handleEditPO = (po: any) => {
		setEditingPO(po);
		setSelectedSupplier({ id: po.supplierId, name: po.supplierName, phone: po.supplierPhone });
		setOrderNote(po.note || '');
		setPaidAmount(po.paidAmount ? po.paidAmount.toLocaleString('vi-VN') : '0');
		const mappedItems = (po.items || []).map((item: any) => ({
			id: crypto.randomUUID(),
			category: 'Tất cả',
			productId: item.productId || '',
			name: item.name || '',
			qty: String(item.qty || ''),
			priceImport: Number(item.priceImport || 0)
		}));
		setItems(mappedItems);
		if ((po.items || []).length === 0) {
			setItems([{ id: crypto.randomUUID(), category: 'Tất cả', productId: '', name: '', qty: '', priceImport: 0 }]);
		}
		setShowCreateForm(true);
	};

	// P1 #4: Huỷ đơn nhập hàng + rollback stock + xoá hẳn công nợ (không offset)
	const handleCancelPO = async (po: any) => {
		// Bước 1: Hiện nút xác nhận inline
		if (deletingPO !== po.id) {
			setDeletingPO(po.id);
			return;
		}
		// Bước 2: Đã xác nhận → xoá
		setDeletingPO(null);
		setCancellingPO(po.id); // Hiện loading ngay

		try {
			// 1. Xoá PO NGAY LẬP TỨC
			await deletePurchaseOrder(po.id);
			setCancellingPO(null);
			showToast('✅ Đã huỷ đơn nhập hàng', 'success');

			// 2+3. Rollback stock + xoá công nợ gốc chạy ngầm (không block UI)
			const validItems = (po.items || []).filter((item: any) => item.productId);
			
			// Stock rollback ngầm
			if (validItems.length > 0) {
				for (let i = 0; i < validItems.length; i += 500) {
					const batch = writeBatch(db);
					const chunk = validItems.slice(i, i + 500);
					for (const item of chunk) {
						batch.update(doc(db, 'products', item.productId), { stock: increment(-Number(item.qty || 0)) });
					}
					batch.commit().catch(e => console.warn('Stock rollback failed:', e));
				}
			}
			
			// Xoá công nợ gốc (thay vì tạo offset payment/cancellation như cũ)
			if ((po.debtAmount || 0) > 0 && po.supplierId) {
				try {
					// Tìm bản ghi nợ gốc theo orderId
					const debtQuery = query(
						collection(db, 'supplier_debts'),
						where('ownerId', '==', owner.ownerId),
						where('orderId', '==', po.id),
						where('type', '==', 'debt_increase')
					);
					const debtSnapshot = await getDocs(debtQuery);
					
					// Xoá tất cả bản ghi nợ liên quan đến PO này
					const deletePromises = debtSnapshot.docs.map(d => deleteDoc(d.ref));
					await Promise.all(deletePromises);
					
					// Cập nhật totalDebt của NCC
					const supplierRef = doc(db, 'suppliers', po.supplierId);
					await updateDoc(supplierRef, {
						totalDebt: increment(-po.debtAmount)
					});
				} catch (e) {
					console.warn('Debt cleanup failed:', e);
				}
			}
		} catch (error: any) {
			setCancellingPO(null);
			console.error('Cancel PO error:', error);
			showToast(`Lỗi khi huỷ: ${error.message || 'Không xác định'}`, 'error');
		}
	};

	// ─── Supply Bot: Xử lý chat nhập hàng ───
	const handleSupplyChat = async () => {
		const msg = chatInput.trim();
		if (!msg) return;

		setChatMessages(prev => [...prev, { role: 'user', text: msg }]);
		setChatInput('');
		setChatLoading(true);

		// Nếu có pending sheet order → user đang nhập tên NCC để xác nhận
		if (pendingSheetOrder) {
			try {
				const supplier = suppliers.find(s => s.name.toLowerCase() === msg.toLowerCase());
				if (!supplier) {
					setChatMessages(prev => [...prev, { role: 'bot',
						text: `❌ Không tìm thấy NCC "${msg}". Hãy tạo NCC trước hoặc nhập đúng tên.` }]);
					setChatLoading(false);
					return;
				}

				const items = pendingSheetOrder.items;
				const totalAmount = pendingSheetOrder.total;

				await runTransaction(db, async (transaction) => {
					const productRefs = items.map(i => doc(db, 'products', i.productId));
					const snaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));
					const supplierRef = doc(db, 'suppliers', supplier.id);
					const supplierSnap = await transaction.get(supplierRef);
					const supplierData = supplierSnap.data() || {};

					const poRef = doc(collection(db, 'purchase_orders'));
					const poId = poRef.id;
					transaction.set(poRef, {
						ownerId: owner.ownerId,
						supplierId: supplier.id,
						supplierName: supplier.name,
						items: items,
						totalAmount, paidAmount: 0, debtAmount: totalAmount,
						note: 'Tạo từ Google Sheet (AI)',
						status: 'Hoàn thành',
						orderDate: new Date().toISOString(),
						createdAt: serverTimestamp(),
						createdBy: owner.ownerId
					});

					for (let i = 0; i < items.length; i++) {
						if (snaps[i].exists()) {
							const oldStock = Number(snaps[i].data()?.stock) || 0;
							transaction.update(productRefs[i], { stock: oldStock + Number(items[i].qty), priceImport: Number(items[i].priceImport) });
						}
					}

					if (totalAmount > 0) {
						const debtRef = doc(collection(db, 'supplier_debts'));
						transaction.set(debtRef, {
							ownerId: owner.ownerId, supplierId: supplier.id, supplierName: supplier.name,
							type: 'debt_increase', amount: totalAmount,
							note: `Nợ đơn nhập hàng (AI Sheet) ${new Date().toLocaleDateString('vi-VN')}`,
							orderId: poId, createdBy: owner.ownerId, createdAt: serverTimestamp()
						});
						transaction.update(supplierRef, { totalDebt: (supplierData.totalDebt || 0) + totalAmount });
					}
				});

				const itemsSummary = items.map(i =>
					`• ${i.name} x${i.qty} = ${(Number(i.qty) * Number(i.priceImport)).toLocaleString('vi-VN')}đ`
				).join('\n');

				setChatMessages(prev => [...prev, { role: 'bot',
					text: `✅ Đã tạo đơn nhập hàng từ Google Sheet!\n\n🏭 NCC: **${supplier.name}**\n${itemsSummary}\n💰 Tổng: **${totalAmount.toLocaleString('vi-VN')}đ**\n📋 Nợ NCC: ${totalAmount.toLocaleString('vi-VN')}đ` }]);

				setPendingSheetOrder(null);
			} catch (err: any) {
				console.error('pendingSheetOrder error:', err);
				setChatMessages(prev => [...prev, { role: 'bot', text: `❌ Lỗi: ${err.message || 'Không xác định'}` }]);
			} finally {
				setChatLoading(false);
			}
			return;
		}

		// 📊 Pre-check: Google Sheet link → parse trực tiếp (giống SaleBot)
		const sheetMatch = msg.match(/https?:\/\/docs\.google\.com\/spreadsheets\/[^\s]+/);
		if (sheetMatch) {
			setChatLoading(true);
			await importFromSheet(sheetMatch[0]);
			setChatLoading(false);
			return;
		}

		try {
			const ctx = {
				suppliers: suppliers.map(s => `${s.name} (nợ: ${(s.totalDebt||0).toLocaleString('vi-VN')}đ)`).join('\n'),
				products: products.slice(0, 50).map(p => `${p.name} (tồn: ${p.stock||0}, giá nhập: ${(p.priceImport||0).toLocaleString('vi-VN')}đ)`).join('\n'),
			};

			const result = await parseSupplyMessage(msg, ctx);

			// ─── Thực thi intent ───
			switch (result.intent) {
				case 'CREATE_SUPPLIER': {
					if (!result.supplier?.name) {
						setChatMessages(prev => [...prev, { role: 'bot', text: '⚠️ Vui lòng cung cấp tên nhà cung cấp.' }]);
						break;
					}
					await addSupplierFromBot(result.supplier);
					break;
				}
				case 'CREATE_PURCHASE_ORDER': {
					if (!result.purchase_order?.supplierName || !result.purchase_order?.items?.length) {
						setChatMessages(prev => [...prev, { role: 'bot', text: '⚠️ Cần tên NCC và ít nhất 1 sản phẩm để tạo đơn nhập hàng.' }]);
						break;
					}
					await createPOFromBot(result.purchase_order);
					break;
				}
				case 'RECORD_SUPPLIER_PAYMENT': {
					if (!result.supplier_payment?.supplierName || !result.supplier_payment?.amount) {
						setChatMessages(prev => [...prev, { role: 'bot', text: '⚠️ Cần tên NCC và số tiền để ghi nhận trả nợ.' }]);
						break;
					}
					await recordPaymentFromBot(result.supplier_payment);
					break;
				}
				case 'IMPORT_GOOGLE_SHEET': {
					if (!result.google_sheet?.url) {
						setChatMessages(prev => [...prev, { role: 'bot', text: '⚠️ Vui lòng gửi link Google Sheet.' }]);
						break;
					}
					await importFromSheet(result.google_sheet);
					break;
				}
				default: {
					setChatMessages(prev => [...prev, { role: 'bot', text: result.response_message || 'Xin lỗi, tôi chưa hiểu yêu cầu.' }]);
				}
			}
		} catch (error) {
			console.error('SupplyBot error:', error);
			setChatMessages(prev => [...prev, { role: 'bot', text: '❌ Có lỗi xảy ra, vui lòng thử lại.' }]);
		} finally {
			setChatLoading(false);
		}
	};

	// ─── Bot Action Handlers ───
	const addSupplierFromBot = async (s: any) => {
		const { addDoc: addDocFn, collection: colFn } = await import('firebase/firestore');
		await addDocFn(colFn(db, 'suppliers'), {
			ownerId: owner.ownerId,
			name: s.name,
			phone: s.phone || '',
			address: s.address || '',
			category: s.category || 'Vật liệu khác',
			note: s.note || '',
			totalDebt: 0,
			createdAt: serverTimestamp(),
		});
		setChatMessages(prev => [...prev, { role: 'bot', text: `✅ Đã tạo nhà cung cấp **${s.name}** thành công!` }]);
	};

	const createPOFromBot = async (po: any) => {
		const supplier = suppliers.find(s => s.name.toLowerCase() === po.supplierName.toLowerCase());
		if (!supplier) {
			setChatMessages(prev => [...prev, { role: 'bot', text: `❌ Không tìm thấy NCC "${po.supplierName}". Hãy tạo NCC trước.` }]);
			return;
		}

		const validItems: any[] = [];
		for (const item of (po.items || [])) {
			const product = findMatchingProduct(item.productName, products);
			if (!product) {
				setChatMessages(prev => [...prev, { role: 'bot', text: `❌ SP "${item.productName}" chưa có trong kho. Hãy tạo SP trước.` }]);
				return;
			}
			validItems.push({ productId: product.id, name: product.name, qty: item.qty, priceImport: item.priceImport });
		}

		const totalAmount = validItems.reduce((sum, i) => sum + (Number(i.qty) * Number(i.priceImport)), 0);
		const paidNum = Number(po.paidAmount) || 0;
		const unpaidAmount = totalAmount - paidNum;

		await runTransaction(db, async (transaction) => {
			const productRefs = validItems.map(i => doc(db, 'products', i.productId));
			const snaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));
			const supplierRef = doc(db, 'suppliers', supplier.id);
			const supplierSnap = await transaction.get(supplierRef);
			const supplierData = supplierSnap.data() || {};

			const poRef = doc(collection(db, 'purchase_orders'));
			const poId = poRef.id;
			transaction.set(poRef, {
				ownerId: owner.ownerId,
				supplierId: supplier.id,
				supplierName: supplier.name,
				items: validItems,
				totalAmount, paidAmount: paidNum, debtAmount: unpaidAmount,
				note: po.note || 'Tạo bởi AI',
				status: 'Hoàn thành',
				orderDate: new Date().toISOString(),
				createdAt: serverTimestamp(),
				createdBy: owner.ownerId
			});

			for (let i = 0; i < validItems.length; i++) {
				if (snaps[i].exists()) {
					const oldStock = Number(snaps[i].data()?.stock) || 0;
					transaction.update(productRefs[i], { stock: oldStock + Number(validItems[i].qty), priceImport: Number(validItems[i].priceImport) });
				}
			}

			if (unpaidAmount > 0) {
				const debtRef = doc(collection(db, 'supplier_debts'));
				transaction.set(debtRef, {
					ownerId: owner.ownerId, supplierId: supplier.id, supplierName: supplier.name,
					type: 'debt_increase', amount: unpaidAmount,
					note: `Nợ đơn nhập hàng (AI) ${new Date().toLocaleDateString('vi-VN')}`,
					orderId: poId, createdBy: owner.ownerId, createdAt: serverTimestamp()
				});
				transaction.update(supplierRef, { totalDebt: (supplierData.totalDebt || 0) + unpaidAmount });
			}
		});

		setChatMessages(prev => [...prev, { role: 'bot', text: `✅ Đã tạo đơn nhập hàng từ **${supplier.name}**\n📦 ${validItems.length} SP • 💰 ${totalAmount.toLocaleString('vi-VN')}đ • 📋 Nợ: ${unpaidAmount.toLocaleString('vi-VN')}đ` }]);
	};

	const recordPaymentFromBot = async (payment: any) => {
		const supplier = suppliers.find(s => s.name.toLowerCase() === payment.supplierName.toLowerCase());
		if (!supplier) {
			setChatMessages(prev => [...prev, { role: 'bot', text: `❌ Không tìm thấy NCC "${payment.supplierName}".` }]);
			return;
		}

		const { addDoc: addDocFn, collection: colFn } = await import('firebase/firestore');
		await addDocFn(colFn(db, 'supplier_debts'), {
			ownerId: owner.ownerId,
			supplierId: supplier.id,
			supplierName: supplier.name,
			type: 'payment',
			amount: payment.amount,
			method: payment.method || 'Tiền mặt',
			note: payment.note || `Trả nợ (AI) ${new Date().toLocaleDateString('vi-VN')}`,
			createdBy: owner.ownerId,
			createdAt: serverTimestamp()
		});

		setChatMessages(prev => [...prev, { role: 'bot', text: `✅ Đã ghi nhận trả nợ **${payment.amount.toLocaleString('vi-VN')}đ** cho ${supplier.name}` }]);
	};

	const importFromSheet = async (sheet: any) => {
		const url = typeof sheet === 'string' ? sheet : sheet?.url;
		if (!url) {
			setChatMessages(prev => [...prev, { role: 'bot', text: '⚠️ Vui lòng gửi link Google Sheet.' }]);
			return;
		}

		setChatMessages(prev => [...prev, { role: 'bot', text: '⏳ Đang đọc danh sách sản phẩm từ Google Sheet...' }]);

		try {
			let csvUrl = url;
			const match = csvUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
			if (!match) {
				setChatMessages(prev => [...prev, { role: 'bot', text: '❌ Link Google Sheet không đúng định dạng.' }]);
				return;
			}
			const sheetId = match[1];
			const gidMatch = csvUrl.match(/gid=(\d+)/);
			const gid = gidMatch ? gidMatch[1] : '0';
			csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

			const res = await fetch(csvUrl);
			if (!res.ok) {
				setChatMessages(prev => [...prev, { role: 'bot', text: '❌ Không đọc được Sheet. Sheet cần được chia sẻ công khai (Anyone with link).' }]);
				return;
			}

			const csvText = await res.text();
			const lines = csvText.split('\n').filter(l => l.trim());
			if (lines.length < 2) {
				setChatMessages(prev => [...prev, { role: 'bot', text: '❌ Sheet trống hoặc không có dữ liệu.' }]);
				return;
			}

			const parseCSVLine = (line: string): string[] => {
				const result: string[] = [];
				let current = ''; let inQuotes = false;
				for (const ch of line) {
					if (ch === '"') { inQuotes = !inQuotes; continue; }
					if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
					current += ch;
				}
				result.push(current.trim());
				return result;
			};

			const headersRaw = parseCSVLine(lines[0]);
			const headers = headersRaw.map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
			
			// Tên SP: ưu tiên cột có "tên" hoặc "sản phẩm"
			const nameColIdx = headers.findIndex((h: string) =>
				(h.includes('ten') && !h.includes('ncc') && !h.includes('ghichu')) || h.includes('sanpham') || h.includes('product') || h.includes('name'));
			
			// Số lượng: ưu tiên "số lượng" hoặc "SL" (đứng riêng)
			let qtyColIdx = headers.findIndex((h: string) => h === 'sl' || h === 'so luong' || h === 'soluong');
			if (qtyColIdx < 0) qtyColIdx = headers.findIndex((h: string) =>
				h.includes('soluong') || h.includes('qty') || h.includes('quantity'));
			
			// Giá: ưu tiên "đơn giá" > "giá bán" > "giá nhập" > "giá" > "dongia" > "price"
			const priceCandidates = [
				{ match: (h: string) => h.includes('dongia') || h.includes('don gia'), label: 'đơn giá' },
				{ match: (h: string) => h.includes('gianhap') || h.includes('gia nhap') || h.startsWith('nhap') || h.includes('import'), label: 'giá nhập' },
				{ match: (h: string) => h.includes('giaban') || h.includes('gia ban') || h.startsWith('ban'), label: 'giá bán' },
				{ match: (h: string) => h.includes('price'), label: 'price' },
				{ match: (h: string) => h.includes('gia') && !h.includes('ghichu') && !h.includes('danhgia') && !h.includes('thanh'), label: 'giá' },
			];
			let priceColIdx = -1; let priceColLabel = '';
			for (const c of priceCandidates) {
				const idx = headers.findIndex(h => c.match(h));
				if (idx >= 0) { priceColIdx = idx; priceColLabel = c.label; break; }
			}

			// Debug: hiện headers + cột đã detect + sample dữ liệu dòng đầu
			const sampleRows: string[] = [];
			for (let i = 1; i < Math.min(lines.length, 5); i++) {
				const cols = parseCSVLine(lines[i]);
				const name = (cols[nameColIdx] || '').trim();
				if (!name) continue;
				const rawQty = qtyColIdx >= 0 ? (cols[qtyColIdx] || '').trim() : 'N/A';
				const rawPrice = priceColIdx >= 0 ? (cols[priceColIdx] || '').trim() : 'N/A';
				const parsedQty = qtyColIdx >= 0 ? (parseInt(rawQty.replace(/[^\d]/g, ''), 10) || 1) : 1;
				const matchedProduct = findMatchingProduct(name, products);
				const dbPrice = matchedProduct ? Number(matchedProduct.priceImport) || 0 : 0;
				const finalPrice = priceColIdx >= 0 ? parseFloat(rawPrice.replace(/[^\d.,]/g, '').replace(/,/g, '')) || 0 : (dbPrice || 0);
				const subtotal = parsedQty * finalPrice;
				sampleRows.push(`  ▸ ${name}: SL="${rawQty}"→${parsedQty} Giá="${rawPrice}" DB=${dbPrice.toLocaleString('vi-VN')}đ →${finalPrice.toLocaleString('vi-VN')}đ (${subtotal.toLocaleString('vi-VN')}đ)`);
			}
			const sampleInfo = sampleRows.length > 0 ? `\n\n📋 **Dữ liệu đọc được (dòng đầu):**\n${sampleRows.join('\n')}` : '';

			const debugInfo = `📊 **Các cột phát hiện:**\n• Tên SP: cột ${nameColIdx + 1} (${headersRaw[nameColIdx] || '?'})\n• Số lượng: ${qtyColIdx >= 0 ? `cột ${qtyColIdx + 1} (${headersRaw[qtyColIdx]})` : '❌ KHÔNG TÌM THẤY (mặc định = 1)'}\n• Giá: ${priceColIdx >= 0 ? `cột ${priceColIdx + 1} (${headersRaw[priceColIdx]}) → loại: ${priceColLabel}` : '❌ KHÔNG TÌM THẤY (mặc định = giá nhập trong kho)'}\n\n📋 Tất cả cột: ${headersRaw.join(' | ')}${sampleInfo}`;

			if (nameColIdx < 0) {
				setChatMessages(prev => [...prev, { role: 'bot',
					text: `❌ Không tìm thấy cột "Tên sản phẩm". Các cột: ${headers.join(', ')}` }]);
				return;
			}

			const orderItems: any[] = [];
			const notFound: string[] = [];

			for (let i = 1; i < lines.length; i++) {
				const cols = parseCSVLine(lines[i]);
				const rowName = (cols[nameColIdx] || '').trim();
				if (!rowName) continue;

				const rawQty = (cols[qtyColIdx] || '').trim();
				const rowQty = qtyColIdx >= 0 ? (parseInt(rawQty.replace(/[^\d]/g, ''), 10) || 1) : 1;
				const rawPrice = (cols[priceColIdx] || '0').replace(/[^\d.,-]/g, '').trim();
				let rowPrice = 0;
				if (rawPrice) {
					// Xử lý format tiếng Việt: dấu , là phân cách hàng nghìn, . là thập phân (nếu có)
					// VD: "79,000" → 79000, "1,234.56" → 1234.56, "1.234,56" → 1234.56
					if (rawPrice.includes('.') && rawPrice.includes(',')) {
						const lastDot = rawPrice.lastIndexOf('.');
						const lastComma = rawPrice.lastIndexOf(',');
						if (lastDot > lastComma) {
							rowPrice = parseFloat(rawPrice.replace(/,/g, '')) || 0;
						} else {
							rowPrice = parseFloat(rawPrice.replace(/\./g, '').replace(',', '.')) || 0;
						}
					} else if (rawPrice.includes(',')) {
						const afterComma = rawPrice.split(',').pop() || '';
						if (afterComma.length <= 2 && !/,\d{3}$/.test(rawPrice)) {
							rowPrice = parseFloat(rawPrice.replace(',', '.')) || 0;
						} else {
							rowPrice = parseFloat(rawPrice.replace(/,/g, '')) || 0;
						}
					} else {
						rowPrice = parseFloat(rawPrice) || 0;
					}
				}

				const product = findMatchingProduct(rowName, products);
				if (product) {
					// Nếu sheet có cột giá và giá = 0 (KM/tặng) → giữ 0, không fallback DB
					const finalPrice = priceColIdx >= 0 ? rowPrice : (rowPrice || Number(product.priceImport) || 0);
					orderItems.push({ productId: product.id, name: product.name, qty: rowQty, priceImport: finalPrice });
				} else {
					notFound.push(rowName);
				}
			}

			if (orderItems.length === 0) {
				setChatMessages(prev => [...prev, { role: 'bot',
					text: `❌ Không tìm thấy sản phẩm nào khớp.\nDanh sách: ${notFound.join(', ')}` }]);
				return;
			}

			const supplierName = sheet?.supplierName || '';
			const totalAmount = orderItems.reduce((sum, it) => sum + (Number(it.qty) * Number(it.priceImport)), 0);
			const itemsSummary = orderItems.map(it =>
				`• ${it.name} x${it.qty} = ${(Number(it.qty) * Number(it.priceImport)).toLocaleString('vi-VN')}đ`
			).join('\n');

			const confirmMsg = `${debugInfo}\n\n📦 **Đơn Nhập Hàng từ Sheet**\n\n${itemsSummary}\n\n💰 Tổng tiền nhập: **${totalAmount.toLocaleString('vi-VN')}đ**${supplierName ? '\n🏭 NCC: ' + supplierName : ''}${notFound.length > 0 ? '\n\n⚠️ Không tìm thấy: ' + notFound.join(', ') : ''}\n\nVui lòng nhập **tên nhà cung cấp** để tạo đơn:`;

			setChatMessages(prev => [...prev, { role: 'bot', text: confirmMsg }]);

			// Lưu pending order để xử lý khi user nhập tên NCC
			setPendingSheetOrder({ items: orderItems, total: totalAmount, notFound });
		} catch (err: any) {
			console.error('importFromSheet error:', err);
			setChatMessages(prev => [...prev, { role: 'bot', text: `❌ Lỗi: ${err.message || 'Không xác định'}` }]);
		}
	};

	const formatCurrency = (val: any) => Number(val || 0).toLocaleString('vi-VN');

	if (loading) {
		return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1A237E]"></div></div>;
	}

	return (
		<>
		<div className="h-full flex flex-col relative pb-24 lg:pb-0">
			{/* Header */}
			<div className="sticky top-0 z-40 bg-[#f8f9fa] dark:bg-slate-950 pb-4">
				<div className="flex flex-col gap-4">
					<div className="flex items-center justify-between">
						<h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3">
							<span className="material-symbols-outlined text-[#1A237E] dark:text-[#FF6D00] text-3xl">local_shipping</span>
							Nhập Kho
						</h1>
					<button onClick={() => { resetEditForm(); setShowCreateForm(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6D00] text-white font-bold rounded-xl shadow-lg shadow-orange-500/30 hover:bg-[#E66000] active:scale-95 transition-all text-sm">
						<Plus size={20} /> Tạo Đơn Nhập
					</button>
					</div>
				</div>
			</div>

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
							<div key={po.id} 
							onClick={() => setDetailPO(po)}
							className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm group cursor-pointer hover:border-[#FF6D00]/30 hover:shadow-md transition-all">
								<div className="flex justify-between items-start mb-2">
									<div>
										<h4 className="font-bold text-slate-800 dark:text-white">{po.supplierName}</h4>
										<div className="text-xs text-slate-500 mt-1">{new Date(po.orderDate).toLocaleString('vi-VN')}</div>
									</div>
									<div className="flex items-center gap-2">
										<div className="text-right">
											<div className="font-black text-slate-800 dark:text-white">{formatCurrency(po.totalAmount)} đ</div>
											{po.debtAmount > 0 && <div className="text-xs text-red-500 font-bold mt-1">Nợ: {formatCurrency(po.debtAmount)} đ</div>}
										</div>
									{deletingPO === po.id ? (
										<div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
											<span className="text-xs text-red-500 font-bold mr-1">Xoá?</span>
											<button onClick={() => handleCancelPO(po)}
												className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600">✓ Có</button>
											<button onClick={() => setDeletingPO(null)}
												className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-xs rounded-lg hover:bg-slate-300">✕</button>
										</div>
									) : cancellingPO === po.id ? (
										<div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
											<Loader size={14} className="animate-spin text-red-500" />
											<span className="text-xs text-red-500">Đang xoá...</span>
										</div>
									) : (
										<div className="flex items-center gap-1">
											<button
												onClick={(e) => { e.stopPropagation(); handleEditPO(po); }}
												className="p-2 text-slate-300 hover:text-[#FF6D00] hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
												title="Chỉnh sửa đơn nhập hàng"
											>
												<Edit3 size={16} />
											</button>
											<button
												onClick={(e) => { e.stopPropagation(); handleCancelPO(po); }}
												className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
												title="Huỷ đơn nhập hàng"
											>
												<Trash size={16} />
											</button>
										</div>
									)}
									</div>
								</div>
								<div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-400">
									{po.items?.length || 0} sản phẩm • {po.note || 'Không có ghi chú'}
									<span className="ml-2 text-[#FF6D00] text-xs font-bold">📋 Xem phiếu</span>
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
			{showCreateForm && (
		<div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-20 bg-slate-900/60 backdrop-blur-md overflow-y-auto" onClick={() => { if (!editingPO) resetEditForm(); }}>
			<div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-slate-800" onClick={e => e.stopPropagation()}>
				<div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between sticky top-0 z-10 rounded-t-[2.5rem]">
					<h3 className="text-xl font-black text-[#1A237E] dark:text-indigo-400">
						{editingPO ? 'Chỉnh Sửa Đơn Nhập' : 'Tạo Đơn Nhập Hàng'}
					</h3>
					<button onClick={resetEditForm} className="size-8 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-colors">
						<X size={18} />
					</button>
				</div>
				<div className="max-h-[70vh] overflow-y-auto p-6 space-y-6">
					{/* Banner khi đang sửa đơn */}
					{editingPO && (
						<div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-4 flex items-center justify-between">
							<div className="flex items-center gap-3">
								<Edit3 size={18} className="text-[#FF6D00]" />
								<div>
									<div className="font-black text-[#FF6D00] text-sm uppercase">Đang chỉnh sửa đơn #{editingPO.id.slice(0, 8).toUpperCase()}</div>
									<div className="text-xs text-slate-500 mt-0.5">{editingPO.supplierName} • {editingPO.items?.length || 0} SP</div>
								</div>
							</div>
							<button
								onClick={resetEditForm}
								className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 hover:text-red-500 transition-colors"
							>
								Huỷ chỉnh sửa
							</button>
						</div>
					)}

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


								{/* Category Filter */}
								{categories.length > 1 && (
									<div className="mb-3">
										<label className="block text-xs font-bold text-slate-500 uppercase mb-1">Danh mục</label>
										<select
											value={item.category || 'Tất cả'}
											onChange={(e) => { updateRow(item.id, 'category', e.target.value); setActiveRow(index); }}
											className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white text-sm font-medium"
										>
											{categories.map((cat: string) => (
												<option key={cat} value={cat}>{cat}</option>
											))}
										</select>
									</div>
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

							<button type="button"
								onClick={handleSubmit}
								className="w-full mt-6 py-4 bg-[#FF6D00] text-white font-black rounded-xl shadow-lg shadow-orange-500/30 hover:bg-[#E66000] active:scale-[0.98] transition-all flex justify-center items-center gap-2 uppercase tracking-wide text-lg"
							>
								<CheckCircle2 size={24} /> {editingPO ? 'Cập Nhật Đơn Nhập' : 'Hoàn Thành Nhập Kho'}
							</button>
						</div>
					</div>
					</div>
					</div>
				</div>
			)}
		</div>

		{/* ─── Supply Bot FAB + Chat Panel ─── */}
		{!chatOpen && (
			<button
				onClick={() => setChatOpen(true)}
				className="fixed bottom-24 right-6 z-50 bg-[#FF6D00] text-white w-14 h-14 rounded-full shadow-xl shadow-orange-500/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
				title="Trợ lý nhập hàng AI"
			>
				<MessageCircle size={24} />
			</button>
		)}

		{chatOpen && (
			<div className="fixed bottom-20 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden" style={{ height: '480px', maxHeight: '70vh' }}>
				<div className="flex items-center justify-between px-4 py-3 bg-[#FF6D00] text-white shrink-0">
					<div className="flex items-center gap-2">
						<MessageCircle size={18} />
						<span className="font-black text-sm uppercase">Trợ lý Nhập Hàng</span>
					</div>
					<button onClick={() => setChatOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition-all"><X size={18} /></button>
				</div>
				<div className="flex-1 overflow-y-auto p-4 space-y-3">
					{chatMessages.map((m, i) => (
						<div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
							<div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
								m.role === 'user' 
									? 'bg-[#FF6D00] text-white rounded-br-md' 
									: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md'
							}`}>
								{m.text}
							</div>
						</div>
					))}
					{chatLoading && (
						<div className="flex justify-start">
							<div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
								<Loader size={16} className="animate-spin text-[#FF6D00]" />
							</div>
						</div>
					)}
					<div ref={chatEndRef} />
				</div>
				<div className="p-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
					<div className="flex gap-2">
						<input
							type="text"
							value={chatInput}
							onChange={e => setChatInput(e.target.value)}
							onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSupplyChat()}
							placeholder="VD: Nhập 10 tấm thạch cao từ NCC Xi măng Hà Tiên, giá 85k..."
							className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white outline-none focus:ring-2 focus:ring-[#FF6D00]/30"
						/>
						<button
							onClick={handleSupplyChat}
							disabled={chatLoading || !chatInput.trim()}
							className="p-2.5 bg-[#FF6D00] text-white rounded-xl hover:bg-[#E66000] disabled:opacity-40 transition-all"
						>
							<Send size={18} />
						</button>
					</div>
				</div>
			</div>
		)}

		{/* 🧾 PHIẾU CHI TIẾT ĐƠN NHẬP HÀNG */}
		{detailPO && (
			<div className="fixed inset-0 z-[150] flex flex-col items-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto custom-scrollbar" onClick={() => { setDetailPO(null); setPoZoom(1); }}>
				<div className="my-auto w-full max-w-2xl flex flex-col" style={{ zoom: poZoom, transformOrigin: 'top center' }}>
					<div className="bg-white dark:bg-slate-900 w-full rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white/20 dark:border-slate-800 transition-colors duration-300" onClick={e => e.stopPropagation()}>
						{/* Header */}
						<div className="px-6 py-5 bg-gradient-to-r from-[#FF6D00] to-[#E65100] text-white flex items-center justify-between shrink-0">
							<div>
								<h2 className="text-lg font-black uppercase tracking-tight">Phiếu Nhập Hàng</h2>
								<p className="text-white/70 text-xs mt-0.5">#{detailPO.id?.slice(0, 12).toUpperCase()}</p>
							</div>
							<button onClick={() => { setDetailPO(null); setPoZoom(1); }} className="size-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
								<X size={20} />
							</button>
						</div>

						{/* Info */}
						<div className="px-6 py-4 bg-orange-50/50 dark:bg-orange-900/10 border-b border-orange-100 dark:border-orange-900/20 shrink-0">
							<div className="grid grid-cols-2 gap-3 text-sm">
								<div>
									<span className="text-[10px] font-bold text-slate-400 uppercase">Nhà cung cấp</span>
									<p className="font-black text-slate-800 dark:text-white mt-0.5">{detailPO.supplierName}</p>
								</div>
								<div>
									<span className="text-[10px] font-bold text-slate-400 uppercase">Ngày nhập</span>
									<p className="font-black text-slate-800 dark:text-white mt-0.5">{new Date(detailPO.orderDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
								</div>
							</div>
							{detailPO.note && (
								<div className="mt-2 pt-2 border-t border-orange-200 dark:border-orange-900/30">
									<span className="text-[10px] font-bold text-slate-400 uppercase">Ghi chú</span>
									<p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 italic">{detailPO.note}</p>
								</div>
							)}
						</div>

						{/* Table */}
						<div className="flex-1 px-6 py-4">
							<table className="w-full text-left border-collapse">
								<thead>
									<tr className="border-b-2 border-slate-200 dark:border-slate-700">
										<th className="py-3 px-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center w-10">STT</th>
										<th className="py-3 px-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">Tên sản phẩm</th>
										<th className="py-3 px-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right w-28">Giá</th>
										<th className="py-3 px-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center w-16">SL</th>
										<th className="py-3 px-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right w-32">Thành tiền</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
									{(detailPO.items || []).map((item: any, idx: number) => (
										<tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
											<td className="py-3 px-2 text-xs font-bold text-slate-500 text-center">{idx + 1}</td>
											<td className="py-3 px-2 text-sm font-semibold text-slate-800 dark:text-white">{item.name}</td>
											<td className="py-3 px-2 text-xs text-slate-600 dark:text-slate-400 text-right font-medium">{formatCurrency(item.priceImport)} đ</td>
											<td className="py-3 px-2 text-xs font-bold text-slate-700 dark:text-slate-300 text-center">{item.qty}</td>
											<td className="py-3 px-2 text-sm font-black text-slate-800 dark:text-white text-right">{formatCurrency((item.qty || 0) * (item.priceImport || 0))} đ</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{/* Footer - Tổng tiền */}
						<div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t-2 border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
							<span className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase">Tổng tiền</span>
							<span className="text-2xl font-black text-[#E65100]">{formatCurrency(detailPO.totalAmount)} đ</span>
						</div>
					</div>
					
					{/* Zoom Controls */}
					<div className="mt-4 flex justify-center w-full" onClick={e => e.stopPropagation()}>
						<div className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-2 py-1.5 rounded-xl border border-white/20">
							<button onClick={() => setPoZoom(prev => Math.max(0.5, prev - 0.05))} className="size-8 sm:size-10 rounded-lg hover:bg-white/20 text-white transition-all flex items-center justify-center" title="Thu nhỏ">
								<span className="material-symbols-outlined text-lg sm:text-xl">zoom_out</span>
							</button>
							<span className="text-xs sm:text-sm font-black w-12 sm:w-14 text-center text-white tabular-nums">{Math.round(poZoom * 100)}%</span>
							<button onClick={() => setPoZoom(prev => Math.min(2, prev + 0.05))} className="size-8 sm:size-10 rounded-lg hover:bg-white/20 text-white transition-all flex items-center justify-center" title="Phóng to">
								<span className="material-symbols-outlined text-lg sm:text-xl">zoom_in</span>
							</button>
							<div className="w-px h-6 bg-white/20 mx-1"></div>
							<button onClick={() => setPoZoom(1)} className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-white/20 text-white text-[10px] sm:text-xs font-black uppercase transition-all">100%</button>
						</div>
					</div>
				</div>
			</div>
		)}

		</>
	);
};

export default PurchaseOrders;
