import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, where, writeBatch, increment, limit, getDoc, getDocs } from 'firebase/firestore';
import BulkImport from '../components/shared/BulkImport';
import QRScanner from '../components/shared/QRScanner';
import InventoryActionButtons from '../components/inventory/InventoryActionButtons';
import InventoryFormModal from '../components/inventory/InventoryFormModal';
import InventoryDetailModal from '../components/inventory/InventoryDetailModal';
import InventoryDesktopTable from '../components/inventory/InventoryDesktopTable';
import InventoryMobileGrid from '../components/inventory/InventoryMobileGrid';
import InventoryLogsTable from '../components/inventory/InventoryLogsTable';
import { useOwner } from '../hooks/useOwner';
import { useToast } from '../components/shared/Toast';
import { getOptimizedImageUrl } from '../utils/validation';
import InventoryActionModal from '../components/inventory/InventoryActionModal';


const InventoryPage = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const owner = useOwner();
	const { showToast } = useToast();

	const [products, setProducts] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [showAddForm, setShowAddForm] = useState(false);
	const [showImport, setShowImport] = useState(false);
	const [showEditForm, setShowEditForm] = useState(false);
	const [showDetail, setShowDetail] = useState(false);
	const [showActionModal, setShowActionModal] = useState(false);
	const [actionModalInitialProduct, setActionModalInitialProduct] = useState<any>(null);
	const [selectedProduct, setSelectedProduct] = useState<any>(null);
	const [searchTerm, setSearchTerm] = useState('');
	const [uploading, setUploading] = useState(false);
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<'inventory' | 'logs'>('inventory');
	const [inventoryLogs, setInventoryLogs] = useState<any[]>([]);
	const [orders, setOrders] = useState<any[]>([]);
	const [expandedSkus, setExpandedSkus] = useState<Set<string>>(new Set());
	const [currentPage, setCurrentPage] = useState(1);
	const [showMobileSearch, setShowMobileSearch] = useState(false);
	const [showScanner, setShowScanner] = useState(false);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [currentFilter, setCurrentFilter] = useState<string | null>(null);
	const ITEMS_PER_PAGE = 20;
	const searchRef = useRef<HTMLInputElement>(null);
	const qrRef = useRef<HTMLCanvasElement>(null);

	// Enhanced Search Functions
	const normalizeText = (text: any) => text ? String(text).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase() : '';
	const removeAccents = (str: any) => {
		return String(str || '').normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/đ/g, 'd')
			.replace(/Đ/g, 'D');
	};
	const isMatch = (target: string, query: string) => {
		if (!query) return true;
		const t = normalizeText(target);
		const q = normalizeText(query);
		return t.includes(q) || removeAccents(t).includes(removeAccents(q));
	};

	const [formData, setFormData] = useState({
		name: '',
		sku: '',
		serialNumber: '',
		category: 'Tôn lợp',
		priceImport: 0,
		priceSell: 0,
		stock: 0,
		unit: 'm2',
		imageUrl: '',
		note: '',
		status: 'Kinh doanh',
		specification: '',
		packaging: '',
		density: '',
		linkedProductId: '',
		expiryDate: ''
	});


	// Get unique categories for suggestions
	const categories = Array.from(new Set([
		'Tôn lợp', 'Xà gồ', 'Sắt hộp', 'Phụ kiện', 'Inox',
		...products.map(p => {
			// @ts-ignore
			return p.category;
		}).filter(Boolean)
	])).sort((a: any, b: any) => String(a).localeCompare(String(b)));

	// Get unique units for suggestions
	const units = Array.from(new Set([
		'm2', 'tấm', 'cây', 'bộ', 'kg', 'mét', 'cuộn',
		...products.map(p => p.unit).filter(Boolean)
	]));

	// Get unique specifications for suggestions
	const specifications = Array.from(new Set([
		...products.map(p => p.specification).filter(Boolean)
	]));

	// Get unique packagings for suggestions
	const packagings = Array.from(new Set([
		...products.map(p => p.packaging).filter(Boolean)
	]));

	// Get unique weights for suggestions
	const densities = Array.from(new Set([
		...products.map(p => p.density).filter(Boolean)
	]));

	useEffect(() => {
		if (owner.loading || !owner.ownerId) return;

		const q = query(
			collection(db, 'products'),
			where('ownerId', '==', owner.ownerId),
			limit(1000)
		);
		const unsubscribe = onSnapshot(q, (snapshot: any) => {
			let docs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

			// Check for expired products and delete them
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const validDocs: any[] = [];
			for (const p of docs) {
				if (p.expiryDate) {
					// Parse date manually to avoid UTC timezone offset (new Date('YYYY-MM-DD') parses as UTC midnight = 7am Vietnam)
					const parts = String(p.expiryDate).split('-');
					const expDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
					expDate.setHours(0, 0, 0, 0);
					if (today > expDate && p.status !== 'Hết hạn') {
						updateDoc(doc(db, 'products', p.id), { status: 'Hết hạn' }).catch(console.error);
					}
				}
				validDocs.push(p);
			}

			const sortedDocs = [...validDocs].sort((a, b) => {
				const stockA = Number(a.stock) || 0;
				const stockB = Number(b.stock) || 0;

				// Prioritize products with stock > 0
				if (stockA > 0 && stockB === 0) return -1;
				if (stockA === 0 && stockB > 0) return 1;

				const dateA = a.createdAt?.seconds || 0;
				const dateB = b.createdAt?.seconds || 0;
				return dateB - dateA;
			});
			setProducts(sortedDocs);
			setLoading(false);
		});
		return unsubscribe;
	}, [owner.loading, owner.ownerId]);

	useEffect(() => {
		if (products.length > 0) {
			const params = new URLSearchParams(location.search);
			const productId = params.get('id');
			if (productId) {
				const product = products.find(p => p.id === productId);
				if (product) {
					setSelectedProduct(product);
					setShowDetail(true);
					// Clear the param after opening
					navigate('/inventory', { replace: true });
				}
			}
		}
	}, [location.search, products]);


	// Fetch Inventory Logs (Always fetch to compute stats)
	useEffect(() => {
		if (owner.loading || !owner.ownerId) return;

		const q = query(
			collection(db, 'inventory_logs'),
			where('ownerId', '==', owner.ownerId)
		);
		const unsubscribe = onSnapshot(q, (snapshot) => {
			const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
			const sorted = [...docs].sort((a: any, b: any) => {
				const dateA = a.createdAt?.seconds || 0;
				const dateB = b.createdAt?.seconds || 0;
				return dateB - dateA;
			});
			setInventoryLogs(sorted);
		});
		return unsubscribe;
	}, [owner.loading, owner.ownerId]);


	// Fetch Orders (To filter inventory logs by status)
	useEffect(() => {
		if (owner.loading || !owner.ownerId) return;

		const q = query(
			collection(db, 'orders'),
			where('ownerId', '==', owner.ownerId),
			limit(1000)
		);
		const unsubscribe = onSnapshot(q, (snapshot) => {
			const docs = snapshot.docs.map(doc => ({ id: doc.id, status: doc.data().status }));
			setOrders(docs);
		});
		return unsubscribe;
	}, [owner.loading, owner.ownerId]);

	const { search } = useLocation();
	useEffect(() => {
		const params = new URLSearchParams(search);
		if (params.get('new') === 'true') {
			setShowAddForm(true);
			navigate('/inventory', { replace: true });
		} else if (params.get('tab') === 'inventory') {
			setActiveTab('inventory');
			navigate('/inventory', { replace: true });
		} else if (params.get('tab') === 'logs') {
			setActiveTab('logs');
			navigate('/inventory', { replace: true });
		} else if (params.get('import') === 'true') {
			setShowImport(true);
			navigate('/inventory', { replace: true });
		} else if (params.get('search') === 'focus') {
			setShowMobileSearch(true);
			setActiveTab('inventory');
			setTimeout(() => searchRef.current?.focus(), 200);
			navigate('/inventory', { replace: true });
		} else if (params.get('filter') === 'low_stock') {
			setCurrentFilter('low_stock');
			setActiveTab('inventory');
			navigate('/inventory', { replace: true });
		}
	}, [search, navigate]);

	useEffect(() => {
		setCurrentPage(1);
	}, [searchTerm]);

	useEffect(() => {
		const handleOpenSearch = () => {
			setShowMobileSearch(true);
			setActiveTab('inventory');
			setTimeout(() => searchRef.current?.focus(), 200);
		};
		window.addEventListener('open-mobile-search', handleOpenSearch);
		return () => window.removeEventListener('open-mobile-search', handleOpenSearch);
	}, []);

	useEffect(() => {
		const handleOpenAdd = () => {
			setActionModalInitialProduct(null);
			setShowActionModal(true);
		};
		window.addEventListener('open-mobile-add', handleOpenAdd);
		return () => window.removeEventListener('open-mobile-add', handleOpenAdd);
	}, []);

	const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setUploading(true);
		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('upload_preset', 'dunvexbuil');
			formData.append('folder', 'dunvex_products');

			const response = await fetch(
				`https://api.cloudinary.com/v1_1/dtx0uvb4e/image/upload`,
				{
					method: 'POST',
					body: formData,
				}
			);

			const data = await response.json();

			if (data.secure_url) {
				setFormData(prev => ({ ...prev, imageUrl: data.secure_url }));
				showToast("Tải ảnh lên thành công", "success");
			} else {
				showToast("Lỗi upload Cloudinary: " + (data.error?.message || "Không xác định"), "error");
			}

		} catch (error: any) {
			showToast(`Lỗi upload: ${error.message}`, "error");
		} finally {
			setUploading(false);
		}
	};


	// Helper to compute stats from logs (now supports SKU grouping)
	const getProductInventoryStats = (productId: string, sku?: string) => {
		let targetIds = [productId];
		if (sku && sku.trim() !== '') {
			targetIds = products.filter(p => p.sku === sku).map(p => p.id);
		}

		// Map orders to their status for filtering
		const orderStatusMap: Record<string, string> = {};
		orders.forEach(o => {
			orderStatusMap[o.id] = o.status;
		});

		const logs = inventoryLogs.filter(l => targetIds.includes(l.productId));

		const totalImport = logs
			.filter(l => l.type === 'init' || (l.type === 'audit' && l.diffType === 'increase'))
			.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

		const totalExport = logs
			.filter(l => {
				const isOutType = l.type === 'out' || (l.type === 'audit' && l.diffType === 'decrease');
				if (!isOutType) return false;

				// If it's an order (type 'out'), verify status
				if (l.type === 'out' && l.orderId) {
					const status = orderStatusMap[l.orderId];
					return status === 'Đơn chốt';
				}

				return true;
			})
			.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

		return { import: totalImport, export: totalExport };
	};

	// Group products by SKU for display and aggregate stats
	const groupedProducts = useMemo(() => {
		const groups: Record<string, any> = {};

		// Map orders to their status for filtering
		const orderStatusMap: Record<string, string> = {};
		orders.forEach(o => {
			orderStatusMap[o.id] = o.status;
		});

		// Map products to their individual stats first
		const productStats: Record<string, { import: number, export: number }> = {};
		products.forEach(p => {
			const logs = inventoryLogs.filter(l => l.productId === p.id);
			const totalImport = logs
				.filter(l => l.type === 'init' || (l.type === 'audit' && l.diffType === 'increase'))
				.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

			const totalExport = logs
				.filter(l => {
					const isOutType = l.type === 'out' || (l.type === 'audit' && l.diffType === 'decrease');
					if (!isOutType) return false;

					// If it's an order (type 'out'), verify status
					if (l.type === 'out' && l.orderId) {
						const status = orderStatusMap[l.orderId];
						// Only count 'Đơn chốt'
						return status === 'Đơn chốt';
					}

					return true; // Keep audit/manual decreases
				})
				.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

			productStats[p.id] = { import: totalImport, export: totalExport };
		});

		// Helper for smart SKU grouping (insensitive to cases and special characters)
		const normalizeSku = (s: string) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();

		products.forEach(p => {
			const key = p.sku && p.sku.trim() !== '' ? normalizeSku(p.sku) : `ID-${p.id}`;
			if (!groups[key]) {
				groups[key] = {
					...p,
					stock: Number(p.stock) || 0,
					skuImport: productStats[p.id].import,
					skuExport: productStats[p.id].export,
					memberIds: [p.id],
					groupKey: key
				};
			} else {
				groups[key].stock += (Number(p.stock) || 0);
				groups[key].skuImport += productStats[p.id].import;
				groups[key].skuExport += productStats[p.id].export;
				groups[key].memberIds.push(p.id);
				groups[key].isGrouped = true;
			}
		});

		// Final pass to calculate AI Health Scores
		return Object.values(groups).map((g: any) => {
			const turnoverRate = g.skuExport / (g.skuImport || 1);
			let aiHealth: 'hot' | 'stable' | 'stale' | 'urgent' = 'stable';

			if (g.stock <= 5 && turnoverRate > 0.2) aiHealth = 'urgent';
			else if (turnoverRate > 0.7) aiHealth = 'hot';
			else if (turnoverRate < 0.1 && g.stock > 100) aiHealth = 'stale';

			return { ...g, aiHealth };
		});
	}, [products, inventoryLogs, orders]);

	const handleAddProduct = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			if (!formData.name) {
				showToast("Vui lòng nhập tên sản phẩm", "warning");
				return;
			}

			if (!owner.ownerId) {
				showToast("Đang tải dữ liệu người dùng, vui lòng thử lại sau", "warning");
				return;
			}

			// NEW: Check if SKU exists for this Admin
			if (formData.sku) {
				const normalize = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, '').trim();
				const cleanSku = normalize(formData.sku);
				const isDuplicate = products.some(p => normalize(p.sku) === cleanSku);

				if (isDuplicate) {
					if (!window.confirm(`Mã SKU "${formData.sku}" đã tồn tại cho một sản phẩm khác. Bạn có chắc chắn muốn tạo thêm một bản ghi trùng SKU không? (Số lượng tồn kho sẽ được cộng dồn khi lên đơn)`)) {
						return;
					}
				}
			}

			// If linked, initialize stock on source or keep 0
			const finalStock = formData.linkedProductId ? 0 : formData.stock;
			const targetId = formData.linkedProductId || '';

			const newProdRef = await addDoc(collection(db, 'products'), {
				...formData,
				stock: finalStock,
				createdAt: serverTimestamp(),
				ownerId: owner.ownerId,
				ownerEmail: owner.ownerEmail,
				createdBy: auth.currentUser?.uid,
				createdByEmail: auth.currentUser?.email,
				linkedProductId: formData.linkedProductId || ''
			});

			// Log Add Product
			await addDoc(collection(db, 'audit_logs'), {
				action: 'Thêm sản phẩm mới',
				user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
				userId: auth.currentUser?.uid || "",
				ownerId: owner.ownerId,
				details: `Đã thêm sản phẩm: ${formData.name} ${formData.linkedProductId ? '(Liên kết kho)' : ''}`,
				createdAt: serverTimestamp()
			});

			// NEW: Inventory Log for Initial Stock
			if (formData.stock > 0) {
				if (formData.linkedProductId) {
					// Update Source Stock
					const sourceRef = doc(db, 'products', formData.linkedProductId);
					await updateDoc(sourceRef, {
						stock: increment(formData.stock)
					});
				}

				await addDoc(collection(db, 'inventory_logs'), {
					productId: formData.linkedProductId || newProdRef.id,
					targetProductId: formData.linkedProductId ? newProdRef.id : '',
					type: 'init',
					productName: formData.name,
					sku: formData.sku || '',
					unit: formData.unit || '',
					qty: formData.stock,
					note: formData.linkedProductId ? `Khởi tạo & Cộng vào kho nguồn` : 'Khởi tạo số dư đầu kỳ',
					ownerId: owner.ownerId,
					user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
					createdAt: serverTimestamp()
				});
			}

			setShowAddForm(false);
			resetForm();
			showToast("Thêm sản phẩm thành công", "success");
		} catch (error: any) {
			console.error("Add product error:", error);
			showToast(`Lỗi khi thêm sản phẩm: ${error?.message || 'Không xác định'}`, "error");
		}
	};

	const handleUpdateProduct = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedProduct) return;
		try {
			// NEW: Check if SKU exists for this Admin (excluding current product)
			if (formData.sku) {
				const normalize = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, '').trim();
				const cleanSku = normalize(formData.sku);
				const isDuplicate = products.some(p => p.id !== selectedProduct.id && normalize(p.sku) === cleanSku);

				if (isDuplicate) {
					if (!window.confirm(`Mã SKU "${formData.sku}" đã bị trùng với sản phẩm khác. Tiếp tục cập nhật?`)) {
						return;
					}
				}
			}
			const batch = writeBatch(db);
			const prodRef = doc(db, 'products', selectedProduct.id);

			const oldStock = Number(selectedProduct.stock) || 0;
			const newStock = Number(formData.stock) || 0;
			const stockDiff = newStock - oldStock;

			batch.update(prodRef, {
				...formData,
				updatedAt: serverTimestamp(),
				updatedBy: auth.currentUser?.uid
			});

			if (stockDiff !== 0) {
				const logRef = doc(collection(db, 'inventory_logs'));
				batch.set(logRef, {
					productId: selectedProduct.id,
					type: 'audit',
					diffType: stockDiff > 0 ? 'increase' : 'decrease',
					productName: formData.name,
					sku: formData.sku || '',
					unit: formData.unit || '',
					qty: Math.abs(stockDiff),
					note: `Chỉnh sửa thủ công: ${oldStock} -> ${newStock}`,
					ownerId: owner.ownerId,
					user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
					createdAt: serverTimestamp()
				});
			}

			// Log Audit Trail
			const auditTrailRef = doc(collection(db, 'audit_logs'));
			batch.set(auditTrailRef, {
				action: 'Cập nhật sản phẩm',
				user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
				userId: auth.currentUser?.uid || "",
				ownerId: owner.ownerId,
				details: `Đã cập nhật sản phẩm: ${formData.name}${stockDiff !== 0 ? ` (Điều chỉnh kho: ${stockDiff})` : ''}`,
				createdAt: serverTimestamp()
			});

			await batch.commit();
			setShowEditForm(false);
			resetForm();
			showToast("Cập nhật sản phẩm thành công", "success");
		} catch (error) {
			showToast("Lỗi khi cập nhật sản phẩm", "error");
		}
	};

	const handleDeleteProduct = async (id: string, bypassConfirm: boolean = false) => {
		if (bypassConfirm || window.confirm("Bạn có chắc chắn muốn xóa sản phẩm này không?")) {
			try {
				await deleteDoc(doc(db, 'products', id));
				setSelectedIds(prev => prev.filter(item => item !== id));
				showToast("Đã xóa sản phẩm", "success");
			} catch (error) {
				showToast("Lỗi khi xóa sản phẩm", "error");
			}
		}
	};

	const handleBulkDelete = async () => {
		if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} sản phẩm đã chọn không?`)) return;

		try {
			const batch = writeBatch(db);
			selectedIds.forEach(id => {
				batch.delete(doc(db, 'products', id));
			});

			// Log Bulk Delete
			await addDoc(collection(db, 'audit_logs'), {
				action: 'Xóa hàng loạt sản phẩm',
				user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
				userId: auth.currentUser?.uid || "",
				ownerId: owner.ownerId,
				details: `Đã xóa ${selectedIds.length} sản phẩm`,
				createdAt: serverTimestamp()
			});

			await batch.commit();
			setSelectedIds([]);
			showToast(`Đã xóa ${selectedIds.length} sản phẩm thành công`, "success");
		} catch (error) {
			showToast("Lỗi khi xóa hàng loạt sản phẩm", "error");
		}
	};

	const toggleSelectAll = () => {
		const allOnPageIds = paginatedProducts.map(p => p.id);
		const areAllSelected = allOnPageIds.length > 0 && allOnPageIds.every(id => selectedIds.includes(id));

		if (areAllSelected) {
			setSelectedIds(prev => prev.filter(id => !allOnPageIds.includes(id)));
		} else {
			setSelectedIds(prev => Array.from(new Set([...prev, ...allOnPageIds])));
		}
	};

	const toggleSelect = (id: string) => {
		setSelectedIds(prev =>
			prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
		);
	};

	const generateSKU = async () => {
		const prefix = 'DV';
		
		// Get local SKUs for a quick first-pass check (offline)
		const localSkus = products
			.filter(p => p.sku && p.sku.startsWith(`${prefix}-`))
			.map(p => p.sku);

		// Try lengths from 3 to 6 digits
		for (let length = 3; length <= 6; length++) {
			const min = Math.pow(10, length - 1);
			const max = Math.pow(10, length) - 1;
			
			// Try 10 random attempts globally for each length
			// Using random candidates is highly efficient for global checks in sparse ranges
			for (let attempt = 0; attempt < 10; attempt++) {
				const randomNum = Math.floor(min + Math.random() * (max - min + 1)).toString();
				const candidate = `${prefix}-${randomNum}`;
				
				// 1. Quick local check
				if (localSkus.includes(candidate)) continue;
				
				// 2. Global Check: Verify uniqueness across the ENTIRE system (all owners)
				// This prevents SKU collisions between different administrators
				const qGlobal = query(collection(db, 'products'), where('sku', '==', candidate), limit(1));
				const snap = await getDocs(qGlobal);
				
				if (snap.empty) {
					return candidate;
				}
			}
			
			// If 10 random attempts for 3-digits fail, it's likely many are taken globally.
			// We move to the next length (e.g. 4) which has 10x more capacity.
		}
		
		// Extreme fallback: 8-digit random if all shorter spaces are extremely congested
		return `${prefix}-${Math.floor(10000000 + Math.random() * 90000000)}`;
	};

	const copyToClipboard = (text: string, label: string = 'mã') => {
		if (!text || text === '---') return;
		navigator.clipboard.writeText(text).then(() => {
			showToast(`Đã copy ${label}: ${text}`, "success");
		}).catch(() => {
			showToast("Không thể copy. Vui lòng thử lại.", "error");
		});
	};

	const resetForm = async () => {
		const newSku = await generateSKU();
		setFormData({
			name: '',
			sku: newSku,
			serialNumber: '',
			category: 'Tôn lợp',
			priceImport: 0,
			priceSell: 0,
			stock: 0,
			unit: 'm2',
			imageUrl: '',
			note: '',
			status: 'Kinh doanh',
			specification: '',
			packaging: '',
			density: '',
			linkedProductId: '',
			expiryDate: ''
		});
		setSelectedProduct(null);
	};


	const openEdit = (product: any) => {
		setActionModalInitialProduct(product);
		setShowActionModal(true);
	};

	const openDetail = (product: any) => {
		setSelectedProduct(product);
		setShowDetail(true);
	};

	const sourceList = groupedProducts;

	const locationState = location.state as any;
	const missingSkus = locationState?.missingSkus as string[] | undefined;

	const filteredProducts = sourceList.filter(product => {
		// NẾU CÓ TRUYỀN DANH SÁCH SẢN PHẨM THIẾU TỪ ORDERLIST THÌ CHỈ LỌC NHỮNG SẢN PHẨM ĐÓ
		if (missingSkus && missingSkus.length > 0) {
			return missingSkus.includes(product.sku);
		}

		const matchesSearch = isMatch(product.name || '', searchTerm) ||
			isMatch(product.sku || '', searchTerm) ||
			isMatch(product.serialNumber || '', searchTerm) ||
			isMatch(product.id || '', searchTerm) ||
			isMatch(product.category || '', searchTerm) ||
			isMatch(product.note || '', searchTerm) ||
			isMatch(product.specification || '', searchTerm) ||
			isMatch(product.packaging || '', searchTerm) ||
			isMatch(product.density || '', searchTerm);

		if (currentFilter === 'low_stock') {
			return matchesSearch && (Number(product.stock) || 0) <= 10;
		}

		return matchesSearch;
	});

	const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
	const paginatedProducts = filteredProducts.slice(
		(currentPage - 1) * ITEMS_PER_PAGE,
		currentPage * ITEMS_PER_PAGE
	);

	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
	};

	const printQRLabel = (product: any) => {
		const printWindow = window.open('', '_blank');
		if (!printWindow) {
			showToast("Vui lòng cho phép mở popup để in tem.", "warning");
			return;
		}

		// Use the canvas from the modal to get the data URL
		const qrDataURL = qrRef.current?.toDataURL('image/png') || '';

		printWindow.document.write(`
			<html>
				<head>
					<base href="${window.location.origin}/">
					<title>In Tem QR - ${product.name}</title>
					<style>
						@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
						body { 
							margin: 0; 
							display: flex; 
							flex-direction: column; 
							align-items: center; 
							justify-content: center;
							font-family: 'Inter', sans-serif;
							text-align: center;
							min-height: 100vh;
							background: #f5f5f5;
						}
						.label-container {
							border: 2px solid #000;
							padding: 30px;
							width: 350px;
							background: white;
							box-shadow: 0 10px 30px rgba(0,0,0,0.1);
							border-radius: 20px;
						}
						.qr-img {
							width: 280px;
							height: 280px;
						}
						.product-name {
							font-weight: 900;
							font-size: 20px;
							margin-top: 20px;
							text-transform: uppercase;
							color: #000;
							line-height: 1.2;
						}
						.sku-details {
							font-size: 14px;
							font-weight: 700;
							color: #444;
							margin-top: 10px;
							letter-spacing: 0.5px;
						}
						.brand {
							font-size: 12px;
							font-weight: 900;
							color: #1A237E;
							margin-bottom: 15px;
							letter-spacing: 4px;
							text-transform: uppercase;
						}
						@media print {
							.no-print { display: none !important; }
							body { min-height: auto; background: white; }
							.label-container { border: none; box-shadow: none; width: 100%; padding: 0; }
						}
					</style>
				</head>
				<body>
					<div class="label-container">
						<div class="brand">DUNVEX BUILD</div>
						<img src="${qrDataURL}" class="qr-img" />
						<div class="product-name">${product.name}</div>
						<div class="sku-details">ID: ${product.id}</div>
						<div class="sku-details">SKU: ${product.sku || '---'}</div>
						<div class="sku-details" style="color: #B48C00;">SN: ${product.serialNumber || '---'}</div>
					</div>
					<div class="no-print" style="margin-top: 40px; display: flex; gap: 15px;">
						<button onclick="window.print()" style="padding: 15px 35px; background: #1A237E; color: white; border: none; border-radius: 12px; font-weight: 900; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 10px 20px rgba(26,35,126,0.2);">IN TEM NGAY</button>
						<button onclick="window.close()" style="padding: 15px 35px; background: #eeeeee; color: #666; border: none; border-radius: 12px; font-weight: 900; cursor: pointer; text-transform: uppercase; letter-spacing: 1px;">ĐÓNG</button>
					</div>
				</body>
			</html>
		`);
		printWindow.document.close();
	};

	const handleQRScan = (productId: string) => {
		const product = products.find(p => p.id === productId);
		if (product) {
			openDetail(product);
		} else {
			showToast(`Không tìm thấy sản phẩm với mã ID: ${productId}`, "error");
		}
	};

	// Helper to handle Cloudinary and legacy Drive image URLs
	const getImageUrl = (url: string) => getOptimizedImageUrl(url);

	const hasViewPermission = owner.role?.toLowerCase() === 'admin' || !owner.isEmployee || (owner.accessRights?.inventory_view ?? true);
	const hasManagePermission = owner.role?.toLowerCase() === 'admin' || !owner.isEmployee;

	if (owner.loading) return null;

	if (!hasViewPermission) {
		return (
			<div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-slate-950 items-center justify-center text-center p-8 min-h-screen">
				<div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-full text-blue-500 mb-4">
					<span className="material-symbols-outlined text-5xl">inventory_2</span>
				</div>
				<h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase mb-2">Quyền hạn hạn chế</h2>
				<p className="text-slate-500 dark:text-slate-400 max-w-md">
					Bạn không có quyền xem danh sách sản phẩm / kho. Vui lòng liên hệ Admin.
				</p>
				<button onClick={() => navigate('/')} className="mt-6 bg-[#1A237E] text-white px-6 py-2 rounded-xl font-bold">Quay lại</button>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-slate-950 transition-colors duration-300">
			<header className="h-16 md:h-20 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0 transition-colors duration-300">
				<div className="flex items-center gap-3">
					<button
						onClick={() => navigate('/')}
						className="size-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-[#1A237E] dark:hover:text-indigo-400 transition-all group"
						title="Về Trang Chủ"
					>
						<span className="material-symbols-outlined text-xl group-hover:rotate-[-45deg] transition-transform">home</span>
					</button>
					<div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
					<h2 className="text-sm lg:text-lg xl:text-xl font-black text-[#1A237E] dark:text-indigo-400 uppercase tracking-tight line-clamp-1">Quản Lý Tồn Kho</h2>
				</div>

				<div className="flex items-center gap-4">
					<div className="hidden lg:flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-800">
						<button
							onClick={() => { setActiveTab('inventory'); setCurrentFilter(null); }}
							className={`px-3 xl:px-4 py-1.5 rounded-lg text-xs font-black transition-all ${activeTab === 'inventory' ? 'bg-white dark:bg-slate-700 text-[#1A237E] dark:text-indigo-400 shadow-sm' : 'text-slate-400'}`}
						>
							<span className="xl:inline">TỒN KHO </span>GỘP
						</button>
						<button
							onClick={() => { setActiveTab('logs'); setCurrentFilter(null); }}
							className={`px-3 xl:px-4 py-1.5 rounded-lg text-xs font-black transition-all ${activeTab === 'logs' ? 'bg-white dark:bg-slate-700 text-[#1A237E] dark:text-indigo-400 shadow-sm' : 'text-slate-400'}`}
						>
							<span className="xl:inline">LỊCH SỬ </span>KHO
						</button>
					</div>

					{activeTab !== 'logs' && (
						<div className="hidden lg:flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-2 w-48 xl:w-64 border border-slate-200 dark:border-transparent focus-within:border-[#FF6D00] focus-within:bg-white dark:focus-within:bg-slate-900 transition-all">
							<span className="material-symbols-outlined text-slate-500 text-lg">search</span>
							<input
								ref={searchRef}
								type="text"
								placeholder="Tìm kiếm..."
								className="bg-transparent border-none outline-none w-full text-sm font-black text-slate-900 dark:text-slate-200 placeholder:text-slate-500"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
							/>
						</div>
					)}

					{currentFilter === 'low_stock' && (
						<div className="flex bg-orange-50 dark:bg-orange-900/20 text-[#FF6D00] px-4 py-2 rounded-xl border border-orange-100 dark:border-orange-900/50 items-center gap-3 shadow-sm animate-in fade-in slide-in-from-right-4 duration-300">
							<div className="size-2 bg-[#FF6D00] rounded-full animate-pulse shadow-[0_0_8px_rgba(255,109,0,0.6)]"></div>
							<span className="text-[11px] font-black uppercase tracking-wider">Đang xem: Tồn kho thấp</span>
							<button 
								onClick={() => setCurrentFilter(null)}
								className="size-6 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors shadow-sm"
								title="Bỏ lọc"
							>
								<span className="material-symbols-outlined text-sm font-bold">close</span>
							</button>
						</div>
					)}

					{hasManagePermission && (
						<div className="flex items-center gap-2">
							<button
								onClick={() => {
									setActionModalInitialProduct(null);
									setShowActionModal(true);
								}}
								className="hidden md:flex bg-[#FF6D00] hover:bg-orange-600 text-white px-3 xl:px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-all items-center gap-2"
							>
								<span className="material-symbols-outlined text-xl">add_box</span>
								<span className="hidden xl:inline">Tạo Phiếu Kho</span>
							</button>
						</div>
					)}
				</div>
			</header>

			{showImport && (
				<BulkImport
					type="products"
					ownerId={owner.ownerId}
					ownerEmail={owner.ownerEmail}
					onClose={() => setShowImport(false)}
					onSuccess={() => {
						// Optional: refresh data or show success message
					}}
				/>
			)}

			{/* CONTENT */}
			<div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">


				{/* Mobile Search Bar - Conditional */}
				{showMobileSearch && (
					<div className="md:hidden mb-6 animate-in slide-in-from-top duration-300">
						<div className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800">
							<span className="material-symbols-outlined text-slate-400">search</span>
							<input
								ref={searchRef}
								type="text"
								placeholder="Nhập tên hoặc mã SKU..."
								className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-slate-900 dark:text-white"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
							/>
							{searchTerm && (
								<button onClick={() => setSearchTerm('')} className="text-slate-300">
									<span className="material-symbols-outlined text-lg">cancel</span>
								</button>
							)}
							<button
								onClick={() => setShowMobileSearch(false)}
								className="text-blue-500 font-bold text-xs"
							>
								Đóng
							</button>
						</div>
					</div>
				)}

				{/* Main Content Area */}
				{activeTab !== 'logs' ? (
					<>
						{/* Table - Desktop */}
						<InventoryDesktopTable
							loading={loading}
							paginatedProducts={paginatedProducts}
							selectedIds={selectedIds}
							activeTab={activeTab}
							expandedSkus={expandedSkus}
							hasManagePermission={hasManagePermission}
							toggleSelectAll={toggleSelectAll}
							toggleSelect={toggleSelect}
							openDetail={openDetail}
							openEdit={openEdit}
							copyToClipboard={copyToClipboard}
							formatPrice={formatPrice}
							setExpandedSkus={setExpandedSkus}
							handleDeleteProduct={handleDeleteProduct}
							getProductInventoryStats={getProductInventoryStats}
							products={products}
							getImageUrl={getImageUrl}
						/>

						{/* Grid - Mobile */}
						<InventoryMobileGrid
							loading={loading}
							paginatedProducts={paginatedProducts}
							activeTab={activeTab}
							expandedSkus={expandedSkus}
							openDetail={openDetail}
							openEdit={openEdit}
							getImageUrl={getImageUrl}
							formatPrice={formatPrice}
							setExpandedSkus={setExpandedSkus}
							products={products}
							handleDeleteProduct={handleDeleteProduct}
							getProductInventoryStats={getProductInventoryStats}
							hasManagePermission={hasManagePermission}
						/>
						<div className="mt-8 mb-4">

							{missingSkus && missingSkus.length > 0 && (
								<div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-4 mb-4 flex items-center justify-between">
									<div className="flex items-center gap-3 text-amber-800 dark:text-amber-300">
										<div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
											<span className="material-symbols-outlined">warning</span>
										</div>
										<div>
											<p className="font-bold text-sm">Đang lọc mặt hàng thiếu tồn kho từ đơn hàng</p>
											<p className="text-xs opacity-80 mt-0.5">Vui lòng cập nhật số lượng tồn kho cho các sản phẩm dưới đây.</p>
										</div>
									</div>
									<button 
										onClick={() => {
											const state = { ...location.state };
											delete state.missingSkus;
											navigate('/inventory', { state, replace: true });
										}}
										className="px-4 py-2 bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 font-bold text-xs rounded-lg border border-amber-200 dark:border-amber-700/50 hover:bg-amber-50 dark:hover:bg-amber-900/40 transition-colors"
									>
										Xóa bộ lọc
									</button>
								</div>
							)}

							{/* Pagination Controls */}
							{
								totalPages > 1 && (
									<div className="mt-8 mb-12 flex flex-col md:flex-row items-center justify-between gap-4">
										<p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
											Hiển thị {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} trên tổng {filteredProducts.length} {activeTab === 'inventory' ? 'nhóm SKU' : 'lịch sử'}
										</p>
										<div className="flex items-center gap-1">
											<button
												onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
												disabled={currentPage === 1}
												className="size-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:border-blue-500 transition-all"
											>
												<span className="material-symbols-outlined">chevron_left</span>
											</button>
											<div className="flex items-center gap-1 mx-2">
												{[...Array(totalPages)].map((_, i) => {
													const pageNum = i + 1;
													// Show first, last, and pages around current
													if (
														pageNum === 1 ||
														pageNum === totalPages ||
														(pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
													) {
														return (
															<button
																key={pageNum}
																onClick={() => setCurrentPage(pageNum)}
																className={`size-10 rounded-xl font-bold text-xs transition-all border ${currentPage === pageNum
																	? 'bg-[#1A237E] text-white border-[#1A237E] shadow-lg shadow-blue-500/20'
																	: 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-blue-500'
																	}`}
															>
																{pageNum}
															</button>
														);
													} else if (
														pageNum === currentPage - 2 ||
														pageNum === currentPage + 2
													) {
														return <span key={pageNum} className="text-slate-300">...</span>;
													}
													return null;
												})}
											</div>
											<button
												onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
												disabled={currentPage === totalPages}
												className="size-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:border-blue-500 transition-all"
											>
												<span className="material-symbols-outlined">chevron_right</span>
											</button>
										</div>
									</div>
								)
							}
						</div>
					</>
				) : (
					/* LOGS VIEW */
					<InventoryLogsTable inventoryLogs={inventoryLogs} />
				)}
			</div>

			<InventoryFormModal
				show={showAddForm || showEditForm}
				onClose={() => { setShowAddForm(false); setShowEditForm(false); resetForm(); }}
				isEdit={showEditForm}
				formData={formData}
				setFormData={setFormData}
				onSubmit={showEditForm ? handleUpdateProduct : handleAddProduct}
				categories={categories}
				units={units}
				specifications={specifications}
				packagings={packagings}
				densities={densities}
				uploading={uploading}
				handleImageUpload={handleImageUpload}
				generateSKU={generateSKU}
				copyToClipboard={copyToClipboard}
				hasManagePermission={hasManagePermission}
				getImageUrl={getImageUrl}
			/>

			{/* DETAIL MODAL */}
			<InventoryDetailModal
				show={showDetail}
				onClose={() => setShowDetail(false)}
				selectedProduct={selectedProduct}
				products={products}
				hasManagePermission={hasManagePermission}
				qrRef={qrRef}
				openEdit={openEdit}
				handleDeleteProduct={handleDeleteProduct}
				copyToClipboard={copyToClipboard}
				getImageUrl={getImageUrl}
				formatPrice={formatPrice}
				printQRLabel={printQRLabel}
			/>

			<InventoryActionModal
				show={showActionModal}
				onClose={() => {
					setShowActionModal(false);
					setActionModalInitialProduct(null);
				}}
				products={products}
				owner={owner}
				initialProduct={actionModalInitialProduct}
			/>

			{
				showScanner && (
					<QRScanner
						onScan={handleQRScan}
						onClose={() => setShowScanner(false)}
						title="Tìm nhanh sản phẩm"
					/>
				)
			}
		</div>
	);
};

export default InventoryPage;
