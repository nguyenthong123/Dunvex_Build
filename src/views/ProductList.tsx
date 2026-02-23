import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, where, writeBatch, increment } from 'firebase/firestore';
import BulkImport from '../components/shared/BulkImport';
import QRScanner from '../components/shared/QRScanner';
import { QRCodeCanvas } from 'qrcode.react';
import { useOwner } from '../hooks/useOwner';


const ProductList = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const owner = useOwner();

	const [products, setProducts] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [showAddForm, setShowAddForm] = useState(false);
	const [showImport, setShowImport] = useState(false);
	const [showEditForm, setShowEditForm] = useState(false);
	const [showDetail, setShowDetail] = useState(false);
	const [selectedProduct, setSelectedProduct] = useState<any>(null);
	const [searchTerm, setSearchTerm] = useState('');
	const [uploading, setUploading] = useState(false);
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<'products' | 'logs'>('products');
	const [inventoryLogs, setInventoryLogs] = useState<any[]>([]);
	const [currentPage, setCurrentPage] = useState(1);
	const [showMobileSearch, setShowMobileSearch] = useState(false);
	const [showScanner, setShowScanner] = useState(false);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const itemsPerPage = 10;
	const searchRef = useRef<HTMLInputElement>(null);
	const qrRef = useRef<HTMLCanvasElement>(null);

	const [formData, setFormData] = useState({
		name: '',
		sku: '',
		category: 'Tôn lợp',
		priceBuy: 0,
		priceSell: 0,
		stock: 0,
		unit: 'm2',
		imageUrl: '',
		note: '',
		status: 'Kinh doanh',
		specification: '',
		packaging: '',
		density: '',
		linkedProductId: ''
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
			where('ownerId', '==', owner.ownerId)
		);
		const unsubscribe = onSnapshot(q, (snapshot: any) => {
			const docs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
			const sortedDocs = [...docs].sort((a, b) => {
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
	}, [owner.loading, owner.ownerId, activeTab]);

	const { search } = useLocation();
	useEffect(() => {
		const params = new URLSearchParams(search);
		if (params.get('new') === 'true') {
			setShowAddForm(true);
			navigate('/inventory', { replace: true });
		} else if (params.get('tab') === 'logs') {
			setActiveTab('logs');
			navigate('/inventory', { replace: true });
		} else if (params.get('import') === 'true') {
			setShowImport(true);
			navigate('/inventory', { replace: true });
		} else if (params.get('search') === 'focus') {
			setShowMobileSearch(true);
			setActiveTab('products');
			setTimeout(() => searchRef.current?.focus(), 200);
			navigate('/inventory', { replace: true });
		}
	}, [search, navigate]);

	useEffect(() => {
		setCurrentPage(1);
	}, [searchTerm]);

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
			} else {
				alert("Lỗi upload Cloudinary: " + (data.error?.message || "Không xác định"));
			}

		} catch (error: any) {
			alert(`Lỗi upload: ${error.message}`);
		} finally {
			setUploading(false);
		}
	};

	// Helper to compute stats from logs
	const getProductInventoryStats = (productId: string) => {
		const logs = inventoryLogs.filter(l => l.productId === productId);

		const totalImport = logs
			.filter(l => l.type === 'init' || (l.type === 'audit' && l.diffType === 'increase'))
			.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

		const totalExport = logs
			.filter(l => l.type === 'out' || (l.type === 'audit' && l.diffType === 'decrease'))
			.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

		return { import: totalImport, export: totalExport };
	};

	const handleAddProduct = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			if (!formData.name) {
				alert("Vui lòng nhập tên sản phẩm");
				return;
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
				userId: auth.currentUser?.uid,
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
					qty: formData.stock,
					note: formData.linkedProductId ? `Khởi tạo & Cộng vào kho nguồn` : 'Khởi tạo số dư đầu kỳ',
					ownerId: owner.ownerId,
					user: auth.currentUser?.displayName || auth.currentUser?.email,
					createdAt: serverTimestamp()
				});
			}

			setShowAddForm(false);
			resetForm();
		} catch (error) {
			alert("Lỗi khi thêm sản phẩm");
		}
	};

	const handleUpdateProduct = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedProduct) return;
		try {
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
					qty: Math.abs(stockDiff),
					note: `Chỉnh sửa thủ công: ${oldStock} -> ${newStock}`,
					ownerId: owner.ownerId,
					user: auth.currentUser?.displayName || auth.currentUser?.email,
					createdAt: serverTimestamp()
				});
			}

			// Log Audit Trail
			const auditTrailRef = doc(collection(db, 'audit_logs'));
			batch.set(auditTrailRef, {
				action: 'Cập nhật sản phẩm',
				user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
				userId: auth.currentUser?.uid,
				ownerId: owner.ownerId,
				details: `Đã cập nhật sản phẩm: ${formData.name}${stockDiff !== 0 ? ` (Điều chỉnh kho: ${stockDiff})` : ''}`,
				createdAt: serverTimestamp()
			});

			await batch.commit();
			setShowEditForm(false);
			resetForm();
		} catch (error) {
			alert("Lỗi khi cập nhật sản phẩm");
		}
	};

	const handleDeleteProduct = async (id: string, bypassConfirm = false) => {
		if (bypassConfirm || window.confirm("Bạn có chắc chắn muốn xóa sản phẩm này không?")) {
			try {
				await deleteDoc(doc(db, 'products', id));
				setSelectedIds(prev => prev.filter(item => item !== id));
			} catch (error) {
				alert("Lỗi khi xóa sản phẩm");
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
				userId: auth.currentUser?.uid,
				ownerId: owner.ownerId,
				details: `Đã xóa ${selectedIds.length} sản phẩm`,
				createdAt: serverTimestamp()
			});

			await batch.commit();
			setSelectedIds([]);
			alert(`Đã xóa ${selectedIds.length} sản phẩm thành công`);
		} catch (error) {
			alert("Lỗi khi xóa hàng loạt sản phẩm");
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

	const generateSKU = () => {
		const prefix = 'DV';
		const randomPart = Math.floor(100000 + Math.random() * 900000).toString();
		return `${prefix}-${randomPart}`;
	};

	const resetForm = () => {
		setFormData({
			name: '',
			sku: generateSKU(),
			category: 'Tôn lợp',
			priceBuy: 0,
			priceSell: 0,
			stock: 0,
			unit: 'm2',
			imageUrl: '',
			note: '',
			status: 'Kinh doanh',
			specification: '',
			packaging: '',
			density: '',
			linkedProductId: ''
		});
		setSelectedProduct(null);
	};


	const openEdit = (product: any) => {
		setSelectedProduct(product);
		setFormData({
			name: product.name,
			sku: product.sku || '',
			category: product.category || 'Tôn lợp',
			priceBuy: product.priceBuy || 0,
			priceSell: product.priceSell || 0,
			stock: product.stock || 0,
			unit: product.unit || 'm2',
			imageUrl: product.imageUrl || '',
			note: product.note || '',
			status: product.status || 'Kinh doanh',
			specification: product.specification || '',
			packaging: product.packaging || '',
			density: product.density || '',
			linkedProductId: product.linkedProductId || ''
		});
		setShowEditForm(true);
	};

	const openDetail = (product: any) => {
		setSelectedProduct(product);
		setShowDetail(true);
	};

	const filteredProducts = products.filter(product =>
		String(product.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
		String(product.sku || '').toLowerCase().includes(searchTerm.toLowerCase())
	);

	const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
	const paginatedProducts = filteredProducts.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage
	);

	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
	};

	const printQRLabel = (product: any) => {
		const printWindow = window.open('', '_blank');
		if (!printWindow) {
			alert("Vui lòng cho phép mở popup để in tem.");
			return;
		}

		// Use the canvas from the modal to get the data URL
		const qrDataURL = qrRef.current?.toDataURL('image/png') || '';

		printWindow.document.write(`
			<html>
				<head>
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
			alert(`Không tìm thấy sản phẩm với mã ID: ${productId}`);
		}
	};

	// Helper to handle Cloudinary and legacy Drive image URLs
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

	const hasViewPermission = owner.role === 'admin' || (owner.accessRights?.inventory_view ?? true);
	const hasManagePermission = owner.role === 'admin' || (owner.accessRights?.inventory_manage ?? true);

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
					<h2 className="text-lg md:text-xl font-black text-[#1A237E] dark:text-indigo-400 uppercase tracking-tight">Sản Phẩm & Tồn Kho</h2>
				</div>

				<div className="flex items-center gap-4">
					<div className="hidden md:flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-800">
						<button
							onClick={() => setActiveTab('products')}
							className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${activeTab === 'products' ? 'bg-white dark:bg-slate-700 text-[#1A237E] dark:text-indigo-400 shadow-sm' : 'text-slate-400'}`}
						>
							TỒN KHO CHI TIẾT
						</button>
						<button
							onClick={() => setActiveTab('logs')}
							className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${activeTab === 'logs' ? 'bg-white dark:bg-slate-700 text-[#1A237E] dark:text-indigo-400 shadow-sm' : 'text-slate-400'}`}
						>
							LỊCH SỬ KHO
						</button>
					</div>

					<div className="hidden md:flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-2 w-64 border border-slate-200 dark:border-transparent focus-within:border-[#FF6D00] focus-within:bg-white dark:focus-within:bg-slate-900 transition-all">
						<span className="material-symbols-outlined text-slate-500 text-lg">search</span>
						<input
							ref={searchRef}
							type="text"
							placeholder="Tìm tên, mã SKU..."
							className="bg-transparent border-none outline-none w-full text-sm font-black text-slate-900 dark:text-slate-200 placeholder:text-slate-500"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					</div>

					{hasManagePermission && (
						<div className="flex items-center gap-2">
							{selectedIds.length > 0 && (
								<button
									onClick={handleBulkDelete}
									className="flex bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-4 py-2.5 rounded-xl font-bold border border-rose-100 dark:border-rose-900/50 active:scale-95 transition-all items-center gap-2 hover:bg-rose-100"
								>
									<span className="material-symbols-outlined">delete_sweep</span>
									<span>Xóa ({selectedIds.length})</span>
								</button>
							)}
							<button
								onClick={() => setShowScanner(true)}
								className="md:flex bg-[#1A237E] text-white px-4 py-2.5 rounded-xl font-bold border border-[#1A237E] active:scale-95 transition-all items-center gap-2 hover:bg-indigo-700"
							>
								<span className="material-symbols-outlined">qr_code_scanner</span>
								<span className="hidden md:inline">Quét Mã QR</span>
							</button>
							<button
								onClick={() => setShowImport(true)}
								className="hidden md:flex bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-4 py-2.5 rounded-xl font-bold border border-slate-200 dark:border-slate-800 active:scale-95 transition-all items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700"
							>
								<span className="material-symbols-outlined">file_upload</span>
								<span>Nhập Excel</span>
							</button>
							<button
								onClick={() => setShowAddForm(true)}
								className="hidden md:flex bg-[#FF6D00] hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-all items-center gap-2"
							>
								<span className="material-symbols-outlined text-xl">add</span>
								<span>Thêm Mới</span>
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
				{showMobileSearch && activeTab === 'products' && (
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
				{activeTab === 'products' ? (
					<>
						{/* Table - Desktop */}
						<div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
							<table className="w-full text-left">
								<thead>
									<tr className="bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
										<th className="py-4 px-6 w-10">
											<input
												type="checkbox"
												className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
												checked={paginatedProducts.length > 0 && paginatedProducts.every(p => selectedIds.includes(p.id))}
												onChange={toggleSelectAll}
											/>
										</th>
										<th className="py-4 px-2 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest">Mã SKU / Code</th>
										<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest">Tên sản phẩm</th>
										<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest text-center">Nhập kho</th>
										<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest text-center">Xuất kho</th>
										<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest text-center">Còn lại</th>
										<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest text-right">Hành động</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-100 dark:divide-slate-800">
									{loading ? (
										<tr><td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500">Đang tải dữ liệu...</td></tr>
									) : paginatedProducts.length === 0 ? (
										<tr><td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500">Không tìm thấy sản phẩm nào</td></tr>
									) : (
										paginatedProducts.map((product) => (
											<tr key={product.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer ${selectedIds.includes(product.id) ? 'bg-indigo-50/30' : ''}`} onClick={() => openDetail(product)}>
												<td className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
													<input
														type="checkbox"
														className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
														checked={selectedIds.includes(product.id)}
														onChange={() => toggleSelect(product.id)}
													/>
												</td>
												<td className="py-4 px-2">
													<span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
														{product.sku || '#' + product.id.slice(-6).toUpperCase()}
													</span>
												</td>
												<td className="py-4 px-6">
													<div className="font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-indigo-400 transition-colors">
														{product.name}
													</div>
													<div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-0.5 opacity-60">
														{product.category}
													</div>
												</td>
												<td className="py-4 px-6 text-center bg-slate-50/50 dark:bg-slate-800/30">
													<div className="flex flex-col items-center">
														<span className="text-sm font-black text-slate-600 dark:text-slate-300">
															{getProductInventoryStats(product.id).import}
														</span>
														<span className="text-[9px] text-slate-400 uppercase font-black tracking-widest">{product.unit}</span>
													</div>
												</td>
												<td className="py-4 px-6 text-center">
													<div className="flex flex-col items-center">
														<span className="text-sm font-black text-orange-600 dark:text-orange-400">
															{getProductInventoryStats(product.id).export}
														</span>
														<span className="text-[9px] text-slate-400 uppercase font-black tracking-widest">{product.unit}</span>
													</div>
												</td>
												<td className="py-4 px-6 text-center bg-indigo-50/30 dark:bg-indigo-900/10">
													<div className="flex flex-col items-center">
														<span className={`text-base font-black ${product.stock <= 5 ? 'text-rose-500' : 'text-[#1A237E] dark:text-indigo-400'}`}>
															{product.stock}
														</span>
														<span className="text-[9px] text-slate-400 uppercase font-black tracking-widest">{product.unit}</span>
													</div>
												</td>
												<td className="py-4 px-6 text-right">
													{hasManagePermission && (
														<div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
															{deleteConfirmId === product.id ? (
																<div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-900/20 p-1 rounded-lg border border-rose-100 dark:border-rose-900/30 animate-in fade-in zoom-in duration-200">
																	<button
																		onClick={() => setDeleteConfirmId(null)}
																		className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-white dark:bg-slate-800 rounded shadow-sm"
																	>
																		Hủy
																	</button>
																	<button
																		onClick={() => {
																			handleDeleteProduct(product.id, true);
																			setDeleteConfirmId(null);
																		}}
																		className="px-2 py-1 text-[10px] font-bold text-white bg-rose-500 hover:bg-rose-600 rounded shadow-sm"
																	>
																		Xác nhận
																	</button>
																</div>
															) : (
																<>
																	<button onClick={() => openEdit(product)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-[#1A237E] dark:hover:text-indigo-400 transition-colors">
																		<span className="material-symbols-outlined text-[20px]">edit</span>
																	</button>
																	<button onClick={() => setDeleteConfirmId(product.id)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
																		<span className="material-symbols-outlined text-[20px]">delete</span>
																	</button>
																</>
															)}
														</div>
													)}
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>

						{/* Grid - Mobile */}
						<div className="md:hidden grid grid-cols-1 gap-4 pb-4">
							{paginatedProducts.map((product) => (
								<div key={product.id} className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-slate-800" onClick={() => openDetail(product)}>
									<div className="flex justify-between items-start mb-4">
										<div className="flex items-center gap-3">
											<div className="size-14 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 flex items-center justify-center overflow-hidden border border-gray-100 dark:border-slate-700">
												{product.imageUrl ? (
													<img
														src={getImageUrl(product.imageUrl)}
														alt={product.name}
														className="size-full object-cover"
														referrerPolicy="no-referrer"
													/>
												) : (
													<span className="material-symbols-outlined text-2xl">package_2</span>
												)}
											</div>
											<div>
												<h3 className="font-bold text-[#1A237E] dark:text-indigo-400 leading-tight">{product.name}</h3>
												<div className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest mt-0.5">
													{product.category}
												</div>
												<p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{product.sku || 'Không có mã'}</p>
											</div>
										</div>
										<div className="flex flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
											<span className="px-2 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-[10px] font-bold rounded uppercase">{product.category}</span>
											<div className="flex gap-1">
												<button onClick={() => openEdit(product)} className="p-1 text-[#1A237E] dark:text-indigo-400"><span className="material-symbols-outlined text-sm">edit</span></button>
												<button onClick={() => handleDeleteProduct(product.id)} className="p-1 text-red-500 dark:text-red-400"><span className="material-symbols-outlined text-sm">delete</span></button>
											</div>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50 dark:border-slate-800">
										<div>
											<p className="text-[10px] uppercase text-gray-400 dark:text-slate-500 font-bold">Giá bán</p>
											<p className="text-[#1A237E] dark:text-indigo-400 font-black">{formatPrice(product.priceSell)}</p>
										</div>
										<div className="text-right">
											<p className="text-[10px] uppercase text-gray-400 dark:text-slate-500 font-bold">Tồn kho</p>
											<p className={`font-black ${product.stock <= 5 ? 'text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>{product.stock} {product.unit}</p>
										</div>
									</div>
								</div>
							))}
						</div>

						{/* Pagination Controls */}
						{totalPages > 1 && (
							<div className="mt-8 mb-12 flex flex-col md:flex-row items-center justify-between gap-4">
								<p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
									Hiển thị {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredProducts.length)} trên tổng {filteredProducts.length} sản phẩm
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
						)}
					</>
				) : (
					/* LOGS VIEW */
					<div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
						<div className="overflow-x-auto">
							<table className="w-full text-left">
								<thead>
									<tr className="bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
										<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest">Thời gian</th>
										<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest">Loại</th>
										<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest">Sản phẩm</th>
										<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest">Số lượng</th>
										<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest">Chi tiết</th>
										<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest">Người thực hiện</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-100 dark:divide-slate-800">
									{inventoryLogs.length === 0 ? (
										<tr><td colSpan={6} className="py-12 text-center text-slate-400">Chưa có lịch sử giao dịch kho</td></tr>
									) : (
										inventoryLogs.map((log) => (
											<tr key={log.id} className="text-sm">
												<td className="py-4 px-6 font-medium text-slate-500">
													{log.createdAt ? new Date(log.createdAt.seconds * 1000).toLocaleString('vi-VN') : '...'}
												</td>
												<td className="py-4 px-6">
													<span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${log.type === 'in' ? 'bg-green-50 text-green-600' :
														log.type === 'out' ? 'bg-orange-50 text-orange-600' :
															log.type === 'transfer' ? 'bg-blue-50 text-blue-600' :
																log.type === 'audit' ? 'bg-purple-50 text-purple-600' :
																	'bg-slate-50 text-slate-600'
														}`}>
														{log.type === 'in' ? 'Nhập kho' :
															log.type === 'out' ? 'Xuất đơn' :
																log.type === 'audit' ? (log.diffType === 'increase' ? 'Nhập thêm' : 'Điều chỉnh giảm') : 'Khởi tạo'}
													</span>
												</td>
												<td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
													{log.productName}
												</td>
												<td className={`py-4 px-6 font-black ${log.type === 'in' || (log.type === 'audit' && log.diffType === 'increase') ? 'text-green-600' : 'text-orange-600'
													}`}>
													{log.type === 'in' || (log.type === 'audit' && log.diffType === 'increase') ? '+' : '-'}{log.qty}
												</td>
												<td className="py-4 px-6 text-slate-500 italic max-w-xs truncate">{log.note}</td>
												<td className="py-4 px-6 font-bold text-[#1A237E] dark:text-indigo-400">{log.user}</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>
				)}

				{/* ADD/EDIT MODAL */}
				{(showAddForm || showEditForm) && (
					<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md transition-all duration-500" style={{ WebkitBackdropFilter: 'blur(12px)' }}>
						<div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[85vh] border border-white/20 dark:border-slate-800 transition-all duration-300">
							<div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between sticky top-0 z-10 transition-colors duration-300">
								<h3 className="text-xl font-black text-[#1A237E] dark:text-indigo-400">
									{showEditForm ? 'Cập Nhật Sản Phẩm' : 'Thêm Sản Phẩm Mới'}
								</h3>
								<button
									onClick={() => { setShowAddForm(false); setShowEditForm(false); resetForm(); }}
									className="size-8 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-colors"
								>
									<span className="material-symbols-outlined">close</span>
								</button>
							</div>

							<form onSubmit={showEditForm ? handleUpdateProduct : handleAddProduct} className="flex-1 overflow-y-auto p-6 space-y-6 text-left pb-10 custom-scrollbar">
								<div className="space-y-6">
									{/* Image Upload Area */}
									<div className="flex flex-col items-center">
										<div className="relative size-32 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 flex items-center justify-center overflow-hidden group">
											{formData.imageUrl ? (
												<img
													src={getImageUrl(formData.imageUrl)}
													className="size-full object-cover"
													referrerPolicy="no-referrer"
												/>
											) : (
												<div className="text-center p-2">
													<span className="material-symbols-outlined text-gray-300 dark:text-slate-600 text-3xl group-hover:text-[#FF6D00] transition-colors">cloud_upload</span>
													<p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold mt-1 group-hover:text-[#FF6D00] transition-colors">Tải ảnh lên Drive</p>
												</div>
											)}
											{uploading && (
												<div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex items-center justify-center z-10">
													<div className="size-8 border-2 border-[#FF6D00] border-t-transparent rounded-full animate-spin"></div>
												</div>
											)}
											<input
												type="file"
												accept="image/*"
												onChange={handleImageUpload}
												className="absolute inset-0 opacity-0 cursor-pointer z-20"
												disabled={uploading}
											/>
										</div>
										<p className="text-[10px] text-gray-400 dark:text-slate-500 mt-2 italic text-center">
											* Tải ảnh lên Google Drive<br />
											(Tự động lấy link)
										</p>

										{/* Manual Link Input (Still available as backup) */}
										<div className="w-full mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
											<input
												type="text"
												placeholder="Hoặc dán link ảnh trực tiếp..."
												className="w-full bg-slate-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-lg py-2 px-3 text-xs text-slate-600 dark:text-slate-300 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-orange-500/20"
												onChange={(e) => {
													let url = e.target.value;
													setFormData({ ...formData, imageUrl: getImageUrl(url) });
												}}
											/>
										</div>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div className="md:col-span-2">
											<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Tên sản phẩm *</label>
											<input
												required
												type="text"
												placeholder="VD: Tôn lạnh màu xanh ngọc 0.45"
												className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
												value={formData.name}
												onChange={(e) => setFormData({ ...formData, name: e.target.value })}
											/>
										</div>
										<div>
											<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Mã SKU / Code</label>
											<div className="relative">
												<input
													type="text"
													placeholder="Tự động tạo..."
													className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-4 pr-12 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
													value={formData.sku}
													onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
												/>
												<button
													type="button"
													className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full text-slate-400 hover:text-orange-500 transition-all"
													title="Tạo mã mới"
													onClick={() => setFormData(prev => ({ ...prev, sku: generateSKU() }))}
												>
													<span className="material-symbols-outlined text-xl">autorenew</span>
												</button>
											</div>
										</div>
										<div>
											<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Đơn vị tính</label>
											<input
												list="product-units"
												placeholder="Chọn hoặc nhập mới..."
												className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
												value={formData.unit}
												onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
											/>
											<datalist id="product-units">
												{units.map(u => <option key={u} value={u} />)}
											</datalist>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Giá nhập</label>
											<input
												type="number"
												className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
												value={formData.priceBuy === 0 ? '' : formData.priceBuy}
												onChange={(e) => setFormData({ ...formData, priceBuy: e.target.value === '' ? 0 : Number(e.target.value) })}
											/>
										</div>
										<div>
											<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Giá bán</label>
											<input
												type="number"
												className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-blue-600 dark:text-blue-400 font-black focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
												value={formData.priceSell === 0 ? '' : formData.priceSell}
												onChange={(e) => setFormData({ ...formData, priceSell: e.target.value === '' ? 0 : Number(e.target.value) })}
											/>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Số lượng tồn</label>
											<input
												type="number"
												className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
												value={formData.stock === 0 ? '' : formData.stock}
												onChange={(e) => setFormData({ ...formData, stock: e.target.value === '' ? 0 : Number(e.target.value) })}
											/>
										</div>
										<div>
											<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Danh mục</label>
											<input
												list="product-categories"
												className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
												value={formData.category}
												onChange={(e) => setFormData({ ...formData, category: e.target.value })}
											/>
											<datalist id="product-categories">
												{categories.map(cat => <option key={cat} value={cat} />)}
											</datalist>
										</div>
									</div>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">

										<div>
											<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Quy cách</label>
											<input
												list="product-specs"
												placeholder="VD: 1.2 x 2.4m"
												className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
												value={formData.specification}
												onChange={(e) => setFormData({ ...formData, specification: e.target.value })}
											/>
											<datalist id="product-specs">
												{specifications.map(s => <option key={s} value={s} />)}
											</datalist>
										</div>
										<div>
											<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Đóng gói</label>
											<input
												list="product-packs"
												placeholder="VD: Kiện 50 tấm"
												className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
												value={formData.packaging}
												onChange={(e) => setFormData({ ...formData, packaging: e.target.value })}
											/>
											<datalist id="product-packs">
												{packagings.map(p => <option key={p} value={p} />)}
											</datalist>
										</div>
										<div>
											<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Trọng lượng</label>
											<input
												list="product-weights"
												placeholder="VD: 25kg/tấm"
												className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
												value={formData.density}
												onChange={(e) => setFormData({ ...formData, density: e.target.value })}
											/>
											<datalist id="product-weights">
												{densities.map(d => <option key={d} value={d} />)}
											</datalist>
										</div>
									</div>

									<div>
										<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Ghi chú sản phẩm</label>
										<textarea
											rows={3}
											placeholder="..."
											className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
											value={formData.note}
											onChange={(e) => setFormData({ ...formData, note: e.target.value })}
										></textarea>
									</div>
								</div>

								<div className="pt-4 sticky bottom-0 bg-white dark:bg-slate-900">
									<button
										type="submit"
										className="w-full bg-[#FF6D00] text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-orange-500/30 active:scale-[0.98] transition-all hover:bg-orange-600 disabled:opacity-50"
									>
										{showEditForm ? 'CẬP NHẬT SẢN PHẨM' : 'LƯU SẢN PHẨM'}
									</button>
								</div>
							</form>
						</div>
					</div>
				)}

				{/* DETAIL MODAL */}
				{showDetail && selectedProduct && (
					<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#1A237E]/80 dark:bg-black/80 backdrop-blur-sm">
						<div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[85vh] transition-colors duration-300">
							<div className="px-6 py-4 bg-[#1A237E] dark:bg-indigo-900 text-white flex items-center justify-between sticky top-0 z-10">
								<h3 className="text-xl font-black">Chi Tiết Sản Phẩm</h3>
								<button onClick={() => setShowDetail(false)} className="size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
									<span className="material-symbols-outlined">close</span>
								</button>
							</div>

							<div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
								<div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
									<div className="size-24 rounded-2xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 flex items-center justify-center overflow-hidden border border-gray-100 dark:border-slate-700 shadow-inner shrink-0 leading-none">
										{selectedProduct.imageUrl ? (
											<img
												src={getImageUrl(selectedProduct.imageUrl)}
												alt={selectedProduct.name}
												className="size-full object-cover"
												referrerPolicy="no-referrer"
											/>
										) : (
											<span className="material-symbols-outlined text-4xl">inventory_2</span>
										)}
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">{selectedProduct.category}</p>
										<h2 className="text-xl font-black text-[#1A237E] dark:text-indigo-400 leading-tight break-words">{selectedProduct.name}</h2>
										<p className="text-xs font-bold text-gray-400 dark:text-slate-500 mt-1">SKU: {selectedProduct.sku || '---'}</p>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
										<p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Giá bán công bố</p>
										<p className="text-blue-600 dark:text-blue-400 font-black text-lg">{formatPrice(selectedProduct.priceSell)}</p>
									</div>
									<div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
										<p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Tồn kho hiện tại</p>
										<p className="text-[#1A237E] dark:text-indigo-400 font-black text-lg">{selectedProduct.stock} <span className="text-xs">{selectedProduct.unit}</span></p>
									</div>
								</div>

								<div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border-l-4 border-orange-500">
									<p className="text-[10px] font-bold text-orange-400 uppercase mb-1">Lợi nhuận gộp ước tính</p>
									<p className="text-green-600 dark:text-green-400 font-black text-xl">{formatPrice(selectedProduct.priceSell - selectedProduct.priceBuy)}</p>
									<p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">Giá nhập: {formatPrice(selectedProduct.priceBuy)}</p>
								</div>

								<div className="grid grid-cols-3 gap-3">
									<div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
										<p className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Quy cách</p>
										<p className="text-xs font-black text-[#1A237E] dark:text-indigo-300">{selectedProduct.specification || '---'}</p>
									</div>
									<div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
										<p className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Đóng gói</p>
										<p className="text-xs font-black text-[#1A237E] dark:text-indigo-300">{selectedProduct.packaging || '---'}</p>
									</div>
									<div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
										<p className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Trọng lượng</p>
										<p className="text-xs font-black text-[#1A237E] dark:text-indigo-300">{selectedProduct.density || '---'}</p>
									</div>
								</div>

								<div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6">
									<div className="flex-1">
										<p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Mô tả / Ghi chú</p>
										<p className="text-slate-600 dark:text-slate-300 italic whitespace-pre-wrap">{selectedProduct.note || 'Không có ghi chú'}</p>
										<div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
											<p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Người tạo</p>
											<p className="text-[10px] text-blue-500 font-bold truncate max-w-[200px]">{selectedProduct.createdByEmail || 'N/A'}</p>
										</div>
									</div>
									<div className="flex flex-col items-center p-4 bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700 shrink-0">
										<QRCodeCanvas
											ref={qrRef}
											value={selectedProduct.id}
											size={300}
											level="H"
											includeMargin={false}
											className="rounded-lg"
											style={{ width: 120, height: 120 }}
										/>
										<p className="text-[9px] font-black text-slate-400 uppercase mt-3 tracking-widest">QR ID Sản phẩm</p>
										<button
											onClick={() => printQRLabel(selectedProduct)}
											className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg text-[10px] font-black uppercase hover:bg-orange-100 transition-all border border-orange-100 dark:border-orange-800"
										>
											<span className="material-symbols-outlined text-sm">print</span>
											In Tem QR
										</button>
									</div>
								</div>

								<div className="flex gap-3 pt-2 pb-6">
									<button
										onClick={() => { setShowDetail(false); openEdit(selectedProduct); }}
										className="flex-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
									>
										<span className="material-symbols-outlined text-lg">edit</span> Chỉnh sửa
									</button>
									<button
										onClick={() => { setShowDetail(false); handleDeleteProduct(selectedProduct.id); }}
										className="flex-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
									>
										<span className="material-symbols-outlined text-lg">delete</span> Xóa sản phẩm
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
						title="Tìm nhanh sản phẩm"
					/>
				)}
			</div>
		</div>
	);
};

export default ProductList;
