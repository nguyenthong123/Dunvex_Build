import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Plus, Search, Trash, X, ArrowLeft, CheckCircle2, Package, History, MessageCircle, Send, Loader, Edit3, Printer, Image as ImageIcon, Copy } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { useOwner } from '../hooks/useOwner';
import { useSuppliers } from '../hooks/useSuppliers';
import { useProducts } from '../hooks/useProducts';
import { usePurchaseOrders } from '../hooks/usePurchaseOrders';
import { useSupplierDebts } from '../hooks/useSupplierDebts';
import { useToast } from '../components/shared/Toast';
import { serverTimestamp, runTransaction, doc, collection, writeBatch, increment, addDoc, getDoc, setDoc, updateDoc, getDocs, query, where, deleteDoc } from '../services/firebase';
import { db, auth } from '../services/firebase';
import { inventoryService } from '../services/dataAccess';
import { getOptimizedImageUrl } from '../utils/validation';
import { SupplierSelection } from '../components/purchase/SupplierSelection';
import { ProductSearchTable } from '../components/purchase/ProductSearchTable';
import { PurchaseOrderSummary } from '../components/purchase/PurchaseOrderSummary';




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

	const [detailPO, setDetailPO] = useState<any | null>(null);
	const [poZoom, setPoZoom] = useState(1);
	const [deletingPO, setDeletingPO] = useState<string | null>(null); // PO đang chờ xác nhận xoá
	const [cancellingPO, setCancellingPO] = useState<string | null>(null); // PO đang được xoá (loading)
	const [editingPO, setEditingPO] = useState<any>(null); // PO đang được chỉnh sửa
	const [isSavingProduct, setIsSavingProduct] = useState(false);

	const [companyInfo, setCompanyInfo] = useState<any>(null);
	const [isSavingImage, setIsSavingImage] = useState(false);
	const [capturedImage, setCapturedImage] = useState<string | null>(null);
	const [showCopySuccess, setShowCopySuccess] = useState(false);

	const getTicketImageUrl = (url: string) => {
		const optimized = getOptimizedImageUrl(url);
		if (!optimized) return '';
		return optimized + (optimized.includes('?') ? '&' : '?') + 'nocache=1';
	};

	useEffect(() => {
		if (!owner.ownerId) return;
		const fetchSettings = async () => {
			const settingsRef = doc(db, 'settings', owner.ownerId);
			const settingsSnap = await getDoc(settingsRef);
			if (settingsSnap.exists()) {
				setCompanyInfo(settingsSnap.data());
			}
		};
		fetchSettings();
	}, [owner.ownerId]);


	useEffect(() => {
		const handleOpenSearch = () => {
			if (showCreateForm) setShowCreateForm(false);
			setTimeout(() => searchInputRef.current?.focus(), 200);
		};
		window.addEventListener('open-mobile-search', handleOpenSearch);
		return () => window.removeEventListener('open-mobile-search', handleOpenSearch);
	}, [showCreateForm]);

	// Handle browser back button — close PO detail modal
	// Track modal state for back button
	const detailPORef = useRef(detailPO);
	useEffect(() => { detailPORef.current = detailPO; }, [detailPO]);

	// Handle browser back button — close modal
	useEffect(() => {
		const handlePopState = () => {
			if (detailPORef.current) {
				setDetailPO(null); setPoZoom(1);
			}
		};
		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, []);

	const handlePrint = () => {
		if (!detailPO) return;
		const printContent = document.getElementById('purchase-order-ticket-bill');
		if (!printContent) return;

		const printWindow = window.open('', '_blank', 'width=1200,height=1000');
		if (!printWindow) {
			alert("Vui lòng cho phép trình duyệt mở popup để in!");
			return;
		}

		let styles = '';
		try {
			for (const sheet of document.styleSheets) {
				try {
					if (sheet.cssRules) {
						for (const rule of sheet.cssRules) {
							styles += rule.cssText + '\n';
						}
					}
				} catch (e) {
					if (sheet.href) {
						styles += `@import url("${sheet.href}");\n`;
					}
				}
			}
		} catch (err) {
			console.warn("Could not inline all styles directly", err);
		}

		let fallbackTags = '';
		document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
			fallbackTags += node.outerHTML;
		});

		printWindow.document.write(`
			<html>
				<head>
					<base href="${window.location.origin}/">
					<title>In Phiếu Nhập Hàng - ${detailPO.id || ''}</title>
					<link rel="preconnect" href="https://fonts.googleapis.com">
					<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
					<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Manrope:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
					<style>${styles}</style>
					${fallbackTags}
					<style>
						@page { size: 80mm auto; margin: 0; }
						body {
							width: 80mm !important;
							margin: 0 auto !important;
							padding: 0 !important;
							background: white !important;
							font-family: 'Inter', 'Manrope', sans-serif !important;
						}
						#purchase-order-ticket-bill {
							width: 80mm !important;
							max-width: 80mm !important;
							padding: 10px 14px !important;
							box-shadow: none !important;
							border: none !important;
							background: white !important;
							visibility: visible !important;
							display: block !important;
							box-sizing: border-box !important;
						}
						#purchase-order-ticket-bill .border-slate-950 span {
							font-size: 14px !important;
						}
						#purchase-order-ticket-bill .border-slate-950 .text-lg {
							font-size: 16px !important;
						}
						* {
							box-sizing: border-box !important;
							-webkit-print-color-adjust: exact !important;
							print-color-adjust: exact !important;
						}
					</style>
				</head>
				<body>
					<div style="width: 80mm;">
						${printContent.outerHTML}
					</div>
					<script>
						function checkStylesAndPrint() {
							const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
							let loadedCount = 0;
							
							const printAndClose = () => {
								if (window.hasPrinted) return;
								window.hasPrinted = true;
								
								if (document.fonts && document.fonts.ready) {
									document.fonts.ready.then(() => {
										setTimeout(() => {
											window.print();
											if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
												window.close();
											}
										}, 250);
									}).catch(() => {
										setTimeout(() => {
											window.print();
											if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
												window.close();
											}
										}, 250);
									});
								} else {
									setTimeout(() => {
										window.print();
										if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
											window.close();
										}
									}, 250);
								}
							};

							if (links.length === 0) {
								printAndClose();
								return;
							}
							
							links.forEach(link => {
								if (link.sheet) {
									loadedCount++;
									if (loadedCount === links.length) {
										printAndClose();
									}
								} else {
									link.onload = () => {
										loadedCount++;
										if (loadedCount === links.length) {
											printAndClose();
										}
									};
									link.onerror = () => {
										loadedCount++;
										if (loadedCount === links.length) {
											printAndClose();
										}
									};
								}
							});
							
							setTimeout(printAndClose, 1200);
						}
						
						if (document.readyState === 'complete') {
							checkStylesAndPrint();
						} else {
							window.onload = checkStylesAndPrint;
						}
					</script>
				</body>
			</html>
		`);
		printWindow.document.close();
	};

	const handleSaveImage = async () => {
		if (!detailPO) return;
		const node = document.getElementById('purchase-order-ticket-bill');
		if (!node) return;

		setIsSavingImage(true);
		try {
			const targetWidth = 420;
			const canvas = await html2canvas(node, {
				backgroundColor: '#ffffff',
				width: targetWidth,
				scale: 2,
				useCORS: true,
				allowTaint: false,
				logging: false,
			});
			const dataUrl = canvas.toDataURL('image/png');

			const link = document.createElement('a');
			link.download = `phieu_nhap_hang_\${detailPO.id?.slice(0, 8).toUpperCase()}.png`;
			link.href = dataUrl;
			link.click();
		} catch (error) {
			console.error("Lỗi tạo hình ảnh:", error);
			alert("Không thể tạo hình ảnh phiếu nhập hàng: " + (error instanceof Error ? error.message : String(error)));
		} finally {
			setIsSavingImage(false);
		}
	};

	const handleCopyImage = async () => {
		if (!capturedImage) return;
		try {
			const response = await fetch(capturedImage);
			const blob = await response.blob();
			await navigator.clipboard.write([
				new ClipboardItem({
					[blob.type]: blob
				})
			]);
			setShowCopySuccess(true);
			setTimeout(() => setShowCopySuccess(false), 2500);
		} catch (error) {
			console.error("Lỗi sao chép hình ảnh:", error);
			alert("Thiết bị hoặc trình duyệt không hỗ trợ sao chép trực tiếp. Bạn vui lòng nhấn giữ hình ảnh để Sao chép!");
		}
	};

	const handleDirectCopyImage = async () => {
		if (!detailPO) return;
		const node = document.getElementById('purchase-order-ticket-bill');
		if (!node) return;

		setIsSavingImage(true);
		let generatedUrl = '';
		try {
			const targetWidth = 420;

			if (!navigator.clipboard || !window.ClipboardItem) {
				throw new Error("Trình duyệt không hỗ trợ Clipboard API hoặc kết nối HTTP không bảo mật");
			}
			// Sử dụng Promise bên trong ClipboardItem để bảo toàn quyền user gesture trong sự kiện click
			const blobPromise = (async () => {
				const canvas = await html2canvas(node, {
					backgroundColor: '#ffffff',
					width: targetWidth,
					scale: 2,
					useCORS: true,
					allowTaint: false,
					logging: false,
				});
				const dataUrl = canvas.toDataURL('image/png');
				generatedUrl = dataUrl;
				const response = await fetch(dataUrl);
				if (!response.ok) throw new Error(`HTTP status ${response.status}`);
				return await response.blob();
			})();

			await navigator.clipboard.write([
				new ClipboardItem({
					'image/png': blobPromise
				})
			]);
			setShowCopySuccess(true);
			setTimeout(() => setShowCopySuccess(false), 2500);
		} catch (error) {
			console.error("Lỗi sao chép hình ảnh:", error);
			if (generatedUrl) {
				setCapturedImage(generatedUrl);
				alert("Sao chép trực tiếp thất bại (do thiết bị, trình duyệt, hoặc do bạn truy cập web bằng liên kết HTTP không bảo mật). Hệ thống đã tự động tạo ảnh phía dưới, bạn hãy NHẤN GIỮ VÀO ẢNH để Sao chép hoặc Lưu lại nhé!");
			} else {
				alert("Không thể tạo hình ảnh phiếu nhập hàng: " + (error instanceof Error ? error.message : String(error)));
			}
		} finally {
			setIsSavingImage(false);
		}
	};


	// Create PO Form State
	const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
	const [orderNote, setOrderNote] = useState('');
	const [items, setItems] = useState<any[]>([{ id: crypto.randomUUID(), category: 'Tất cả', productId: '', name: '', qty: '', priceImport: 0 }]);
	const [paidAmount, setPaidAmount] = useState('');
	const [shippingFee, setShippingFee] = useState('');

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
					if (data.shippingFee) setShippingFee(data.shippingFee);
					setShowCreateForm(true);
					formRestored.current = true;
				}
			}
		} catch {}
	}, []);

	// Tự động lưu form state mỗi khi có thay đổi (bỏ qua lần đầu nếu vừa restore)
		const saveTimer = useRef<number>(0);
	useEffect(() => {
		if (formRestored.current) { formRestored.current = false; return; }
		clearTimeout(saveTimer.current);
		if (!showCreateForm) {
			sessionStorage.removeItem(PO_DRAFT_KEY);
			return;
		}
		// Debounce 500ms để tránh ghi sessionStorage liên tục khi đang gõ
		saveTimer.current = window.setTimeout(() => {
			try {
				sessionStorage.setItem(PO_DRAFT_KEY, JSON.stringify({
					showCreateForm,
					editingPO,
					selectedSupplier,
					orderNote,
					items,
					paidAmount,
					shippingFee,
				}));
			} catch {}
		}, 500);
		return () => clearTimeout(saveTimer.current);
	}, [showCreateForm, editingPO, selectedSupplier, orderNote, items, paidAmount, shippingFee]);

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

	const calculateSubTotal = () => {
		return items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.priceImport) || 0), 0);
	};

	const subTotal = calculateSubTotal();
	const shipFeeNum = Number(shippingFee.replace(/\D/g, '')) || 0;
	const totalAmount = subTotal + shipFeeNum;
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
		if (isSavingProduct) return;
		try {
			setIsSavingProduct(true);
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
		} finally {
			setIsSavingProduct(false);
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
			subTotal,
			shippingFee: shipFeeNum,
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

					const oldTotal = editingPO.totalAmount || 0;
					const oldPaid = editingPO.paidAmount || 0;
					const newTotal = totalAmount;
					const newPaid = paidNum;

					const totalDiff = newTotal - oldTotal;
					const paidDiff = newPaid - oldPaid;
					
					const oldDebt = editingPO.debtAmount || 0;
					const debtDiff = unpaidAmount - oldDebt;

					if (debtDiff !== 0) {
						transaction.update(supplierRef, {
							totalDebt: (supplierData.totalDebt || 0) + debtDiff
						});
					}

					if (totalDiff !== 0) {
						const debtRef = doc(collection(db, 'supplier_debts'));
						transaction.set(debtRef, {
							ownerId: owner.ownerId, supplierId: selectedSupplier.id, supplierName: selectedSupplier.name,
							type: totalDiff > 0 ? 'debt_increase' : 'cancellation', 
							amount: Math.abs(totalDiff),
							note: `Điều chỉnh tổng tiền - sửa PO #${editingPO.id.slice(0, 8)}`,
							orderId: editingPO.id, createdBy: owner.ownerId, createdAt: serverTimestamp()
						});
					}

					if (paidDiff !== 0) {
						const payRef = doc(collection(db, 'supplier_debts'));
						transaction.set(payRef, {
							ownerId: owner.ownerId, supplierId: selectedSupplier.id, supplierName: selectedSupplier.name,
							type: paidDiff > 0 ? 'payment' : 'debt_increase',
							amount: Math.abs(paidDiff),
							note: `Điều chỉnh thanh toán - sửa PO #${editingPO.id.slice(0, 8)}`,
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

				// 4. Tạo công nợ + Cập nhật totalDebt của NCC
				// Luôn ghi nhận tổng tiền đơn hàng (totalAmount) là tăng nợ
				if (totalAmount > 0) {
					const debtRef = doc(collection(db, 'supplier_debts'));
					transaction.set(debtRef, {
						ownerId: owner.ownerId,
						supplierId: selectedSupplier.id,
						supplierName: selectedSupplier.name,
						type: 'debt_increase',
						amount: totalAmount,
						note: `Nhập hàng - PO #${poId.slice(0, 8)}`,
						orderId: poId,
						createdBy: owner.ownerId,
						createdAt: serverTimestamp()
					});
				}

				// Nếu có thanh toán ngay lúc nhập hàng -> Ghi nhận thanh toán
				if (paidNum > 0) {
					const paymentRef = doc(collection(db, 'supplier_debts'));
					transaction.set(paymentRef, {
						ownerId: owner.ownerId,
						supplierId: selectedSupplier.id,
						supplierName: selectedSupplier.name,
						type: 'payment',
						amount: paidAmount,
						note: `Thanh toán ngay lúc nhập hàng - PO #${poId.slice(0, 8)}`,
						orderId: poId,
						createdBy: owner.ownerId,
						createdAt: serverTimestamp()
					});
				}

				if (unpaidAmount !== 0) {
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
		setShippingFee('');
		setShowCreateForm(false);
	};

	// P1 #4.5: Chỉnh sửa đơn nhập hàng → chuyển sang tab Tạo đơn với dữ liệu cũ
	const handleEditPO = (po: any) => {
		setEditingPO(po);
		setSelectedSupplier({ id: po.supplierId, name: po.supplierName, phone: po.supplierPhone });
		setOrderNote(po.note || '');
		setPaidAmount(po.paidAmount ? po.paidAmount.toLocaleString('vi-VN') : '0');
		setShippingFee(po.shippingFee ? po.shippingFee.toLocaleString('vi-VN') : '0');
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
							onClick={() => { setDetailPO(po); navigate(window.location.pathname + window.location.search, { state: { modalOpen: true } }); }}
							className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm group cursor-pointer hover:border-[#FF6D00]/30 hover:shadow-md transition-all">
								<div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
									<div>
										<h4 className="font-black text-slate-800 dark:text-white text-base">{po.supplierName}</h4>
										<div className="text-xs text-slate-500 mt-1">{new Date(po.orderDate).toLocaleString('vi-VN')}</div>
									</div>
									<div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
										<div className="text-left sm:text-right">
											<div className="font-black text-[#FF6D00] text-base">{formatCurrency(po.totalAmount)} đ</div>
										</div>
									{deletingPO === po.id ? (
										<div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
											<span className="text-xs text-red-500 font-bold mr-1">Xoá?</span>
											<button onClick={() => handleCancelPO(po)}
												className="px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600">✓ Có</button>
											<button onClick={() => setDeletingPO(null)}
												className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-xs rounded-lg hover:bg-slate-300">✕</button>
										</div>
									) : cancellingPO === po.id ? (
										<div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
											<Loader size={14} className="animate-spin text-red-500" />
											<span className="text-xs text-red-500">Đang xoá...</span>
										</div>
									) : (
										<div className="flex items-center gap-2">
											<button
												onClick={(e) => { e.stopPropagation(); handleEditPO(po); }}
												className="p-2 md:opacity-0 md:group-hover:opacity-100 opacity-100 text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/40 rounded-xl transition-all shadow-sm cursor-pointer"
												title="Chỉnh sửa đơn nhập hàng"
											>
												<Edit3 size={16} />
											</button>
											<button
												onClick={(e) => { e.stopPropagation(); handleCancelPO(po); }}
												className="p-2 md:opacity-0 md:group-hover:opacity-100 opacity-100 text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/40 rounded-xl transition-all shadow-sm cursor-pointer"
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
		<div className="fixed inset-0 z-[100] flex items-end sm:items-start justify-center sm:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto" onClick={() => { if (!editingPO) resetEditForm(); }}>
			<div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-t-[2rem] sm:rounded-[2.5rem] h-[92vh] sm:h-auto shadow-2xl border border-white/20 dark:border-slate-800 flex flex-col" onClick={e => e.stopPropagation()}>
				<div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between sticky top-0 z-10 rounded-t-[2rem] sm:rounded-t-[2.5rem]">
					<h3 className="text-xl font-black text-[#1A237E] dark:text-indigo-400">
						{editingPO ? 'Chỉnh Sửa Đơn Nhập' : 'Tạo Đơn Nhập Hàng'}
					</h3>
					<button onClick={resetEditForm} className="size-8 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-colors">
						<X size={18} />
					</button>
				</div>
				<div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
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
					<SupplierSelection
						selectedSupplier={selectedSupplier} setSelectedSupplier={setSelectedSupplier}
						supplierSearchRef={supplierSearchRef} supplierSearchQuery={supplierSearchQuery}
						setSupplierSearchQuery={setSupplierSearchQuery} showSupplierResults={showSupplierResults}
						setShowSupplierResults={setShowSupplierResults} filteredSuppliers={filteredSuppliers}
					/>

					{/* Nhập Sản Phẩm */}
					<ProductSearchTable
						items={items} categories={categories} filteredProducts={filteredProducts}
						activeRow={activeRow} setActiveRow={setActiveRow} productDropdownRef={productDropdownRef}
						productSearchQuery={productSearchQuery} setProductSearchQuery={setProductSearchQuery}
						handleRemoveRow={handleRemoveRow} updateRow={updateRow} handleSelectProduct={handleSelectProduct}
						handleQuickAddProduct={handleQuickAddProduct} handleAddRow={handleAddRow} formatCurrency={formatCurrency}
					/>

					{/* Thanh Toán & Hoàn Thành */}
					<PurchaseOrderSummary
						orderNote={orderNote} setOrderNote={setOrderNote}
						subTotal={subTotal} shippingFee={shippingFee} setShippingFee={setShippingFee}
						totalAmount={totalAmount} paidAmount={paidAmount} setPaidAmount={setPaidAmount}
						unpaidAmount={unpaidAmount} handleSubmit={handleSubmit} editingPO={editingPO}
						formatCurrency={formatCurrency}
					/>
					</div>
					</div>
				</div>
			)}
		</div>



		{detailPO && (
			<div className="fixed inset-0 z-[150] bg-slate-955/95 backdrop-blur-xl animate-in fade-in duration-200 print:hidden" onClick={() => { setDetailPO(null); setPoZoom(1); }}>
				{/* Controls bar */}
				<div className="fixed top-0 left-0 right-0 flex items-center justify-between p-3 bg-slate-950/80 backdrop-blur-lg border-b border-white/5 z-[160] no-print" onClick={e => e.stopPropagation()}>
					<span className="text-white text-xs font-black uppercase tracking-wider pl-2">Chi tiết phiếu nhập</span>
					
					{/* Desktop buttons (Hidden on Mobile) */}
					<div className="hidden md:flex bg-white/10 backdrop-blur-md rounded-full p-1 border border-white/20 gap-2 shrink-0">
						<button
							onClick={handlePrint}
							className="px-3.5 py-1.5 bg-white text-slate-900 rounded-full text-xs font-black uppercase tracking-wider transition-all hover:bg-slate-100 flex items-center gap-1"
						>
							<Printer size={14} /> In Phiếu
						</button>
						<button
							onClick={handleSaveImage}
							disabled={isSavingImage}
							className="px-3.5 py-1.5 bg-emerald-500 text-white rounded-full text-xs font-black uppercase tracking-wider transition-all hover:bg-emerald-600 flex items-center gap-1 disabled:opacity-50"
						>
							{isSavingImage ? <Loader size={14} className="animate-spin" /> : <ImageIcon size={14} />} Lưu Ảnh
						</button>
						<button
							onClick={handleDirectCopyImage}
							disabled={isSavingImage}
							className="px-3.5 py-1.5 bg-blue-500 text-white rounded-full text-xs font-black uppercase tracking-wider transition-all hover:bg-blue-600 flex items-center gap-1 disabled:opacity-50"
						>
							{isSavingImage ? <Loader size={14} className="animate-spin" /> : <Copy size={14} />} Copy Ảnh
						</button>
					</div>

					{/* Close button - always visible */}
					<button
						onClick={() => { setDetailPO(null); setPoZoom(1); }}
						className="size-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/20 transition-all font-bold text-xs active:scale-95"
						title="Đóng"
					>
						<X size={18} />
					</button>
				</div>
				{/* SCROLLABLE WRAPPER FOR TICKET CONTENT */}
				<div className="w-full h-full overflow-y-auto pt-20 pb-28 md:pt-16 md:pb-10 flex flex-col items-center justify-start p-4 custom-scrollbar">
					<div className="my-auto flex flex-col items-center" style={{ zoom: poZoom, transformOrigin: 'top center' }} onClick={e => e.stopPropagation()}>
					<div
						id="purchase-order-ticket-bill"
						className="bg-white text-black font-sans mx-auto text-left shadow-2xl relative border border-slate-200"
						style={{
							width: '420px',
							padding: '24px',
							boxSizing: 'border-box'
						}}
					>
						<main className="bg-white text-black text-sm">
							{/* Company Header */}
							<div className="flex items-center gap-4 mb-4">
								{companyInfo?.logoUrl ? (
									<div className="w-16 h-16 rounded-full border border-slate-200 overflow-hidden bg-white shrink-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
										<img src={getTicketImageUrl(companyInfo.logoUrl)} alt="Logo" className="w-full h-full object-cover" loading="lazy" crossOrigin="anonymous" />
									</div>
								) : (
									<div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center text-white shrink-0">
										<Package size={28} />
									</div>
								)}
								<div className="text-left min-w-0">
									<h2 className="text-xl font-black uppercase leading-tight tracking-tight text-black break-words">
										{companyInfo?.name || 'DUNVEX'}
									</h2>
									<div className="text-[11px] text-slate-600 font-semibold space-y-0.5 mt-1 leading-snug">
										<p className="truncate">{companyInfo?.address || 'XÃ KIẾN ĐỨC , LÂM ĐỒNG'}</p>
										<p>SĐT: {companyInfo?.phone || '0988765444'}</p>
									</div>
								</div>
							</div>

							{/* Bill Title */}
							<div className="text-center border-t border-b border-dashed border-slate-400 py-2 my-3">
								<h1 className="text-base font-black uppercase tracking-wider">PHIẾU NHẬP HÀNG</h1>
								<p className="text-[10px] text-slate-500 font-bold mt-0.5">#{detailPO.id?.slice(0, 12).toUpperCase()}</p>
							</div>

							{/* Bill Metadata */}
							<div className="space-y-1.5 text-xs text-slate-800 font-semibold mb-4 leading-normal">
								<div className="flex justify-between items-start gap-3">
									<span className="shrink-0 text-slate-500">Ngày nhập:</span>
									<span className="text-right">{new Date(detailPO.orderDate).toLocaleString('vi-VN')}</span>
								</div>
								<div className="flex justify-between items-start gap-3">
									<span className="shrink-0 text-slate-500">Nhà cung cấp:</span>
									<span className="font-bold text-black uppercase text-right">{detailPO.supplierName}</span>
								</div>
								<div className="flex justify-between items-start gap-3">
									<span className="shrink-0 text-slate-500">Người lập phiếu:</span>
									<span className="text-right">{auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên'}</span>
								</div>
							</div>

							{/* Items Header */}
							<div className="border-t border-dashed border-slate-400 pt-2 font-bold text-xs text-slate-500 flex justify-between uppercase">
								<span>Tên sản phẩm</span>
								<span>Thành tiền</span>
							</div>

							{/* Items List */}
							<div className="divide-y divide-dashed divide-slate-200 mt-1">
								{(detailPO.items || []).map((item: any, idx: number) => {
									const productImage = products.find(p => p.id === item.productId)?.imageUrl;
									return (
										<div key={idx} className="py-2.5 space-y-1">
											<div className="flex items-start gap-2.5 font-extrabold text-black uppercase leading-tight text-sm">
												<span className="shrink-0 pt-0.5">{idx + 1}.</span>
												{productImage && (
													<div className="w-8 h-8 rounded-full border border-slate-200 overflow-hidden bg-white shrink-0 shadow-sm flex justify-center items-center">
														<img 
															src={getTicketImageUrl(productImage)} 
															alt={item.name} 
															className="w-full h-full object-cover rounded-full" 
															loading="lazy"
															crossOrigin="anonymous"
															onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
														/>
													</div>
												)}
												<span className="min-w-0 break-words pt-0.5">{item.name}</span>
											</div>
											<div className="flex justify-between items-center text-xs font-bold text-slate-700">
												<span className="whitespace-nowrap">
													SL: <strong className="text-black text-sm">{item.qty}</strong> x {formatCurrency(item.priceImport)}
												</span>
												<span className="text-black text-sm font-black whitespace-nowrap">
													{formatCurrency((item.qty || 0) * (item.priceImport || 0))} đ
												</span>
											</div>
										</div>
									);
								})}
							</div>

							{/* Ghi chú */}
							{detailPO.note && (
								<div className="border-t border-dashed border-slate-400 py-3 text-xs">
									<p className="font-bold text-slate-400 uppercase tracking-wider mb-1">Ghi chú đơn hàng:</p>
									<p className="font-medium text-slate-800 italic leading-relaxed">"{detailPO.note}"</p>
								</div>
							)}

							{/* Totals Section */}
							<div className="border-t border-dashed border-slate-400 pt-3 space-y-2 text-xs font-bold text-slate-700">
								<div className="flex justify-between items-center gap-4">
									<span className="shrink-0">Cộng tiền hàng:</span>
									<span className="text-black whitespace-nowrap">{formatCurrency(detailPO.subTotal || (detailPO.totalAmount - (detailPO.shippingFee || 0)))} đ</span>
								</div>

								{detailPO.shippingFee > 0 && (
									<div className="flex justify-between items-center gap-4">
										<span className="shrink-0">Phí vận chuyển (+):</span>
										<span className="text-black whitespace-nowrap">+{formatCurrency(detailPO.shippingFee)} đ</span>
									</div>
								)}

								<div className="border-t border-slate-950 pt-2 flex justify-between items-center font-black text-base text-black uppercase gap-4">
									<span className="shrink-0">Tổng thanh toán:</span>
									<span className="text-lg whitespace-nowrap">{formatCurrency(detailPO.totalAmount)} đ</span>
								</div>
							</div>

							{/* Signatures */}
							<div className="border-t border-dashed border-slate-400 mt-6 pt-4 grid grid-cols-2 gap-4 text-center text-[10px] font-bold text-slate-500 uppercase leading-normal">
								<div>
									<p className="mb-10">Người giao (NCC)</p>
									<div className="mx-auto h-px w-16 bg-slate-300"></div>
								</div>
								<div>
									<p className="mb-10">Người nhận (Lập phiếu)</p>
									<span className="text-black font-extrabold">{auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên'}</span>
								</div>
							</div>

							<div className="text-center text-[10px] text-slate-400 font-bold mt-8 italic leading-snug">
								Cảm ơn quý đối tác đã tin tưởng Dunvex Build!
							</div>
						</main>
					</div>

					{/* Zoom Controls */}
					<div className="mt-4 flex justify-center w-full no-print">
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

		{/* Mobile Image Sharing / Long Press Helper Modal */}
		{capturedImage && (
			<div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
				<div className="relative w-full max-w-lg flex flex-col bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 overflow-hidden max-h-[90vh]">
					<div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
						<div className="flex items-center gap-2">
							<span className="material-symbols-outlined text-[#FF6D00] text-xl animate-pulse">download_done</span>
							<h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">Ảnh Phiếu Nhập Hàng</h3>
						</div>
						<button 
							onClick={() => setCapturedImage(null)} 
							className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
						>
							<X size={20} />
						</button>
					</div>

					<div className="py-3 text-center shrink-0">
						<p className="text-xs sm:text-sm font-extrabold text-[#FF6D00] bg-orange-500/10 py-2.5 px-4 rounded-xl inline-block leading-snug">
							👉 Nhấn giữ vào ảnh bên dưới, chọn "Lưu ảnh" hoặc "Chia sẻ" trực tiếp sang Zalo / Facebook!
						</p>
					</div>

					<div className="flex-1 overflow-y-auto min-h-0 bg-white rounded-2xl border border-slate-800 p-2 flex justify-center items-start shadow-inner">
						<img 
							src={capturedImage} 
							alt="Phiếu Nhập Hàng" 
							className="max-w-full h-auto rounded-lg select-all" 
						/>
					</div>

					<div className="pt-4 border-t border-slate-800 shrink-0 flex gap-2">
						<button
							onClick={handleCopyImage}
							className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl active:scale-95 transition-all text-[11px] uppercase tracking-wider hover:bg-emerald-700"
						>
							Sao chép ảnh
						</button>
						<button
							onClick={() => {
								const link = document.createElement('a');
								link.download = `phieu_nhap_hang_${detailPO.id?.slice(0, 8).toUpperCase()}.png`;
								link.href = capturedImage;
								link.click();
							}}
							className="flex-1 py-3 bg-[#FF6D00] text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all text-[11px] uppercase tracking-wider hover:bg-[#e66200]"
						>
							Tải về
						</button>
						<button
							onClick={() => setCapturedImage(null)}
							className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl active:scale-95 transition-all text-[11px] uppercase tracking-wider hover:bg-slate-700"
						>
							Đóng
						</button>
					</div>
				</div>
			</div>
		)}

				{/* MOBILE BOTTOM ACTION BAR FOR PO */}
				<div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-955/90 backdrop-blur-xl border-t border-white/10 z-[160] flex items-center justify-around gap-3 md:hidden no-print" onClick={e => e.stopPropagation()}>
					<button
						onClick={handleSaveImage}
						disabled={isSavingImage}
						className="flex-1 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center border border-emerald-500/30 shadow-lg transition-all font-extrabold text-[11px] uppercase tracking-wider active:scale-95 hover:bg-emerald-700 disabled:opacity-50 gap-1.5"
					>
						<ImageIcon size={16} />
						<span>{isSavingImage ? 'Đang tạo...' : 'Lưu ảnh'}</span>
					</button>

					<button
						onClick={handleDirectCopyImage}
						disabled={isSavingImage}
						className="flex-1 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center border border-blue-500/30 shadow-lg transition-all font-extrabold text-[11px] uppercase tracking-wider active:scale-95 hover:bg-blue-700 disabled:opacity-50 gap-1.5"
					>
						<Copy size={16} />
						<span>{isSavingImage ? 'Đang copy...' : 'Copy ảnh'}</span>
					</button>

					<button
						onClick={handlePrint}
						className="w-12 h-12 rounded-xl bg-slate-800 text-white flex items-center justify-center border border-slate-700 shadow-lg transition-all active:scale-95 hover:bg-black"
						title="In phiếu"
					>
						<Printer size={16} />
					</button>
				</div>
			</div>
		)}

		{showCopySuccess && (
			<div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
				<div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col items-center gap-4 text-center max-w-sm mx-4 animate-in zoom-in-95 duration-200 shadow-2xl">
					<div className="size-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.25)] animate-bounce">
						<CheckCircle2 size={36} className="stroke-[2.5]" />
					</div>
					<div>
						<h4 className="text-white font-black text-base uppercase tracking-wider mb-1">Sao chép thành công!</h4>
						<p className="text-slate-400 text-xs leading-relaxed">Đã sao chép ảnh phiếu nhập hàng vào khay nhớ tạm. Bạn có thể dán (Paste) gửi ngay sang Zalo / Facebook!</p>
					</div>
				</div>
			</div>
		)}

		</>
	);
};

export default PurchaseOrders;
