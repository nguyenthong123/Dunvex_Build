import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Plus, Search, Trash, X, ArrowLeft, CheckCircle2, Package, History, MessageCircle, Send, Loader } from 'lucide-react';
import { useOwner } from '../hooks/useOwner';
import { useSuppliers } from '../hooks/useSuppliers';
import { useProducts } from '../hooks/useProducts';
import { usePurchaseOrders } from '../hooks/usePurchaseOrders';
import { useSupplierDebts } from '../hooks/useSupplierDebts';
import { useToast } from '../components/shared/Toast';
import { serverTimestamp, runTransaction, doc, collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import { inventoryService } from '../services/dataAccess';
import { parseSupplyMessage } from '../services/supplyBotService';

const PurchaseOrders = () => {
	const navigate = useNavigate();
	const owner = useOwner();
	const { showToast } = useToast();
	
	const { suppliers, updateSupplier } = useSuppliers();
	const { products, update, create } = useProducts({ ownerId: owner.ownerId, enabled: !!owner.ownerId });
	const { purchaseOrders, loading, addPurchaseOrder, deletePurchaseOrder, updatePurchaseOrder } = usePurchaseOrders();
	const { addDebt } = useSupplierDebts();

	const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
	const [searchTerm, setSearchTerm] = useState('');

	const searchInputRef = useRef<HTMLInputElement>(null);

	// ─── Supply Bot Chat State ───
	const [chatOpen, setChatOpen] = useState(false);
	const [chatInput, setChatInput] = useState('');
	const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([
		{ role: 'bot', text: '👋 Chào anh! Tôi là trợ lý nhập hàng. Tôi có thể giúp anh:\n• Tạo nhà cung cấp mới\n• Tạo đơn nhập hàng\n• Ghi nhận trả nợ NCC\n• Nhập hàng từ Google Sheet' }
	]);
	const [chatLoading, setChatLoading] = useState(false);
	const chatEndRef = useRef<HTMLDivElement>(null);

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

		try {
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

	// P1 #4: Huỷ đơn nhập hàng + rollback stock/debt trong transaction
	const handleCancelPO = async (po: any) => {
		if (!confirm(`Xác nhận huỷ đơn nhập hàng từ ${po.supplierName}?\nThao tác này sẽ hoàn trả tồn kho và xoá công nợ liên quan.`)) return;

		try {
			await runTransaction(db, async (transaction) => {
				// Đọc PO hiện tại
				const poRef = doc(db, 'purchase_orders', po.id);
				const poSnap = await transaction.get(poRef);
				if (!poSnap.exists()) throw new Error('PO không tồn tại');

				// Rollback stock từng SP
				for (const item of (po.items || [])) {
					const productRef = doc(db, 'products', item.productId);
					const productSnap = await transaction.get(productRef);
					if (productSnap.exists()) {
						const currentStock = Number(productSnap.data().stock) || 0;
						const rollbackStock = Math.max(0, currentStock - Number(item.qty));
						transaction.update(productRef, { stock: rollbackStock });
					}
				}

				// Xoá debt records liên quan đến PO này
				// Query debts trong transaction không khả thi (cần query collection group)
				// Thay vào đó: tạo 1 debt payment để offset
				if ((po.debtAmount || 0) > 0) {
					const debtRef = doc(collection(db, 'supplier_debts'));
					transaction.set(debtRef, {
						ownerId: owner.ownerId,
						supplierId: po.supplierId,
						supplierName: po.supplierName,
						type: 'payment',
						amount: po.debtAmount,
						note: `Huỷ đơn nhập hàng - PO #${po.id.slice(0, 8)}`,
						orderId: po.id,
						createdBy: owner.ownerId,
						createdAt: serverTimestamp()
					});
				}

				// Xoá PO
				transaction.delete(poRef);
			});

			showToast('Đã huỷ phiếu nhập kho và hoàn trả tồn kho', 'success');
		} catch (error) {
			console.error(error);
			showToast('Lỗi khi huỷ đơn nhập hàng', 'error');
		}
	};

	// ─── Supply Bot: Xử lý chat nhập hàng ───
	const handleSupplyChat = async () => {
		const msg = chatInput.trim();
		if (!msg) return;

		setChatMessages(prev => [...prev, { role: 'user', text: msg }]);
		setChatInput('');
		setChatLoading(true);

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
			const product = products.find(p => p.name.toLowerCase() === item.productName.toLowerCase());
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
					const oldStock = Number(snaps[i].data().stock) || 0;
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
		setChatMessages(prev => [...prev, { role: 'bot', text: `🔗 Đang xử lý Google Sheet...\n${sheet.url}\n\n⚠️ Tính năng đang phát triển. Vui lòng gửi nội dung sheet để tôi tạo đơn.` }]);
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
							<div key={po.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm group">
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
										<button
											onClick={(e) => { e.stopPropagation(); handleCancelPO(po); }}
											className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
											title="Huỷ đơn nhập hàng"
										>
											<Trash size={16} />
										</button>
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
		</>
	);
};

export default PurchaseOrders;
