import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, where } from 'firebase/firestore';

import { useOwner } from '../hooks/useOwner';

const ProductList = () => {
	const navigate = useNavigate();
	const owner = useOwner();

	const [products, setProducts] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [showAddForm, setShowAddForm] = useState(false);
	const [showEditForm, setShowEditForm] = useState(false);
	const [showDetail, setShowDetail] = useState(false);
	const [selectedProduct, setSelectedProduct] = useState<any>(null);
	const [searchTerm, setSearchTerm] = useState('');
	const [uploading, setUploading] = useState(false);

	// Form state
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
		density: ''
	});


	// Get unique categories for suggestions
	const categories = Array.from(new Set([
		'Tôn lợp', 'Xà gồ', 'Sắt hộp', 'Phụ kiện', 'Inox',
		...products.map(p => p.category).filter(Boolean)
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
				const dateA = a.createdAt?.seconds || 0;
				const dateB = b.createdAt?.seconds || 0;
				return dateB - dateA;
			});
			setProducts(sortedDocs);
			setLoading(false);
		});
		return unsubscribe;
	}, [owner.loading, owner.ownerId]);

	const { search } = useLocation();
	useEffect(() => {
		const params = new URLSearchParams(search);
		if (params.get('new') === 'true') {
			setShowAddForm(true);
			// Optional: clean up URL
			navigate('/inventory', { replace: true });
		}
	}, [search, navigate]);

	const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Validation: check file size (max 5MB for GAS)
		if (file.size > 5 * 1024 * 1024) {
			alert("File quá lớn. Vui lòng chọn ảnh dưới 5MB.");
			return;
		}

		setUploading(true);
		try {
			let base64Data = "";

			// Method 1: Try using arrayBuffer (Modern & Safari safe)
			// This bypasses FileReader completely
			if (file.arrayBuffer) {
				const buffer = await file.arrayBuffer();
				let binary = '';
				const bytes = new Uint8Array(buffer);
				const len = bytes.byteLength;
				for (let i = 0; i < len; i++) {
					binary += String.fromCharCode(bytes[i]);
				}
				base64Data = window.btoa(binary);
			}
			// Method 2: Fallback to manual FileReader if absolutely necessary (but we know it's broken for you)
			else {
				// @ts-ignore
				const Reader = window.FileReader || FileReader;
				if (Reader) {
					const reader = new Reader();
					base64Data = await new Promise((resolve, reject) => {
						reader.onload = () => {
							if (reader.result) resolve((reader.result as string).split(',')[1]);
							else reject(new Error("Empty result"));
						};
						reader.onerror = reject;
						reader.readAsDataURL(file);
					});
				} else {
					throw new Error("Trình duyệt không hỗ trợ đọc file.");
				}
			}

			// Perform Upload
			const response = await fetch('https://script.google.com/macros/s/AKfycbwIup8ysoKT4E_g8GOVrBiQxXw7SOtqhLWD2b0GOUT54MuoXgTtxP42XSpFR_3aoXAG7g/exec', {
				method: 'POST',
				redirect: 'follow',
				headers: {
					'Content-Type': 'text/plain;charset=utf-8',
				},
				body: JSON.stringify({
					filename: file.name,
					mimeType: file.type,
					base64Data: base64Data
				})
			});

			const data = await response.json();

			if (data.status === 'success') {
				setFormData(prev => ({ ...prev, imageUrl: data.fileUrl }));
			} else {
				console.error("GAS Error:", data);
				alert("Lỗi từ Drive: " + (data.message || "Không xác định"));
			}

		} catch (error: any) {
			console.error("Upload Error:", error);
			alert(`Lỗi upload: ${error.message}`);
		} finally {
			setUploading(false);
		}
	};

	const handleAddProduct = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			if (!formData.name) {
				alert("Vui lòng nhập tên sản phẩm");
				return;
			}
			await addDoc(collection(db, 'products'), {
				...formData,
				createdAt: serverTimestamp(),
				ownerId: owner.ownerId,
				ownerEmail: owner.ownerEmail,
				createdBy: auth.currentUser?.uid,
				createdByEmail: auth.currentUser?.email
			});

			// Log Add Product
			await addDoc(collection(db, 'audit_logs'), {
				action: 'Thêm sản phẩm mới',
				user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
				userId: auth.currentUser?.uid,
				ownerId: owner.ownerId,
				details: `Đã thêm sản phẩm: ${formData.name} - Giá bán: ${formData.priceSell}`,
				createdAt: serverTimestamp()
			});

			setShowAddForm(false);
			resetForm();
		} catch (error) {
			console.error("Error adding product:", error);
			alert("Lỗi khi thêm sản phẩm");
		}
	};

	const handleUpdateProduct = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedProduct) return;
		try {
			await updateDoc(doc(db, 'products', selectedProduct.id), {
				...formData,
				updatedAt: serverTimestamp(),
				updatedBy: auth.currentUser?.uid
			});

			// Log Update Product
			await addDoc(collection(db, 'audit_logs'), {
				action: 'Cập nhật sản phẩm',
				user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
				userId: auth.currentUser?.uid,
				ownerId: owner.ownerId,
				details: `Đã cập nhật sản phẩm: ${formData.name}`,
				createdAt: serverTimestamp()
			});
			setShowEditForm(false);
			resetForm();
		} catch (error) {
			console.error("Error updating product:", error);
			alert("Lỗi khi cập nhật sản phẩm");
		}
	};

	const handleDeleteProduct = async (id: string) => {
		if (window.confirm("Bạn có chắc chắn muốn xóa sản phẩm này không?")) {
			try {
				await deleteDoc(doc(db, 'products', id));
			} catch (error) {
				console.error("Error deleting product:", error);
				alert("Lỗi khi xóa sản phẩm");
			}
		}
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
			density: ''
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
			density: product.density || ''
		});
		setShowEditForm(true);
	};

	const openDetail = (product: any) => {
		setSelectedProduct(product);
		setShowDetail(true);
	};

	const filteredProducts = products.filter(product =>
		product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
		(product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()))
	);

	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
	};

	// Helper to handle Google Drive image URLs more reliably
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
					<h2 className="text-lg md:text-xl font-black text-[#1A237E] dark:text-indigo-400 uppercase tracking-tight">Kho Hàng</h2>
				</div>

				<div className="flex items-center gap-4">
					<div className="hidden md:flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-2 w-64 border border-transparent focus-within:border-blue-500 focus-within:bg-white dark:focus-within:bg-slate-900 transition-all">
						<span className="material-symbols-outlined text-slate-400">search</span>
						<input
							type="text"
							placeholder="Tìm kiếm sản phẩm..."
							className="bg-transparent border-none outline-none w-full text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					</div>

					{hasManagePermission && (
						<button
							onClick={() => setShowAddForm(true)}
							className="hidden md:flex bg-[#FF6D00] hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-all items-center gap-2"
						>
							<span className="material-symbols-outlined text-xl">add</span>
							<span>Thêm Mới</span>
						</button>
					)}
				</div>
			</header>

			{/* CONTENT */}
			<div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">
				{/* Stats */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
					<ProdStatCard icon="inventory_2" label="Tổng sản phẩm" value={products.length.toString()} color="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" />
					<ProdStatCard icon="production_quantity_limits" label="Sắp hết hàng" value={products.filter(p => p.stock <= 5).length.toString()} color="bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400" />
					<ProdStatCard icon="category" label="Danh mục" value={categories.length.toString()} color="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400" />
					<ProdStatCard icon="attach_money" label="Giá trị kho" value="N/A" color="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" />
				</div>

				{/* Table - Desktop */}
				<div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
					<table className="w-full text-left">
						<thead>
							<tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
								<th className="py-4 px-6 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase">Sản phẩm</th>
								<th className="py-4 px-6 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase">Giá bán</th>
								<th className="py-4 px-6 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase">Tồn kho</th>
								<th className="py-4 px-6 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase">Danh mục</th>
								<th className="py-4 px-6 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase text-right">Hành động</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100 dark:divide-slate-800">
							{loading ? (
								<tr><td colSpan={5} className="py-8 text-center text-slate-400 dark:text-slate-500">Đang tải dữ liệu...</td></tr>
							) : filteredProducts.length === 0 ? (
								<tr><td colSpan={5} className="py-8 text-center text-slate-400 dark:text-slate-500">Không tìm thấy sản phẩm nào</td></tr>
							) : (
								filteredProducts.map((product) => (
									<tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => openDetail(product)}>
										<td className="py-4 px-6">
											<div className="flex items-center gap-3">
												<div className="size-12 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-sm overflow-hidden border border-gray-100 dark:border-slate-700">
													{product.imageUrl ? (
														<img
															src={getImageUrl(product.imageUrl)}
															alt={product.name}
															className="size-full object-cover"
															referrerPolicy="no-referrer"
														/>
													) : (
														<span className="material-symbols-outlined">package_2</span>
													)}
												</div>
												<div>
													<div className="font-bold text-[#1A237E] dark:text-indigo-400">{product.name}</div>
													<div className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider">{product.sku || '#' + product.id.slice(-6).toUpperCase()}</div>
												</div>
											</div>
										</td>
										<td className="py-4 px-6 font-bold text-blue-600 dark:text-blue-400">{formatPrice(product.priceSell)}</td>
										<td className="py-4 px-6">
											<div className="flex items-center gap-2">
												<span className={`font-black ${product.stock <= 5 ? 'text-red-500 dark:text-red-400' : 'text-[#1A237E] dark:text-indigo-400'}`}>
													{product.stock}
												</span>
												<span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase">{product.unit}</span>
											</div>
										</td>
										<td className="py-4 px-6">
											<span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 uppercase">
												{product.category}
											</span>
										</td>
										<td className="py-4 px-6 text-right">
											{hasManagePermission && (
												<div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
													<button onClick={() => openEdit(product)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-[#1A237E] dark:hover:text-indigo-400 transition-colors">
														<span className="material-symbols-outlined text-[20px]">edit</span>
													</button>
													<button onClick={() => handleDeleteProduct(product.id)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
														<span className="material-symbols-outlined text-[20px]">delete</span>
													</button>
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
				<div className="md:hidden grid grid-cols-1 gap-4 pb-20">
					{filteredProducts.map((product) => (
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
										<h3 className="font-bold text-[#1A237E] dark:text-indigo-400">{product.name}</h3>
										<p className="text-xs text-slate-400 dark:text-slate-500">{product.sku || 'Không có mã'}</p>
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
			</div>

			{/* ADD/EDIT MODAL */}
			{(showAddForm || showEditForm) && (
				<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#1A237E]/80 dark:bg-black/80 backdrop-blur-sm">
					<div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[85vh] transition-colors duration-300">
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
										<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Tên sản phẩm *</label>
										<input
											required
											type="text"
											placeholder="VD: Tôn lạnh màu xanh ngọc 0.45"
											className="w-full bg-slate-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl py-3 px-4 text-[#1A237E] dark:text-indigo-300 font-medium focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
											value={formData.name}
											onChange={(e) => setFormData({ ...formData, name: e.target.value })}
										/>
									</div>
									<div>
										<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Mã SKU / Code</label>
										<div className="relative">
											<input
												type="text"
												placeholder="Tự động tạo..."
												className="w-full bg-slate-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl py-3 pl-4 pr-10 text-[#1A237E] dark:text-indigo-300 font-medium focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-orange-500/20"
												value={formData.sku}
												onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
											/>
											<button
												type="button"
												className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full text-slate-400 hover:text-[#FF6D00] hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:rotate-180"
												title="Tạo mã mới"
												onClick={() => setFormData(prev => ({ ...prev, sku: generateSKU() }))}
											>
												<span className="material-symbols-outlined text-xl">autorenew</span>
											</button>
										</div>
									</div>
									<div>
										<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Đơn vị tính</label>
										<input
											type="text"
											placeholder="VD: m2, tấm, cây..."
											className="w-full bg-slate-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl py-3 px-4 text-[#1A237E] dark:text-indigo-300 font-medium focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-orange-500/20"
											value={formData.unit}
											onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
										/>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Giá nhập</label>
										<input
											type="number"
											className="w-full bg-slate-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl py-3 px-4 text-[#1A237E] dark:text-indigo-300 font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-orange-500/20"
											value={formData.priceBuy === 0 ? '' : formData.priceBuy}
											onChange={(e) => setFormData({ ...formData, priceBuy: e.target.value === '' ? 0 : Number(e.target.value) })}
										/>
									</div>
									<div>
										<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Giá bán</label>
										<input
											type="number"
											className="w-full bg-slate-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl py-3 px-4 text-blue-600 dark:text-blue-400 font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-orange-500/20"
											value={formData.priceSell === 0 ? '' : formData.priceSell}
											onChange={(e) => setFormData({ ...formData, priceSell: e.target.value === '' ? 0 : Number(e.target.value) })}
										/>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Số lượng tồn</label>
										<input
											type="number"
											className="w-full bg-slate-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl py-3 px-4 text-[#1A237E] dark:text-indigo-300 font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-orange-500/20"
											value={formData.stock === 0 ? '' : formData.stock}
											onChange={(e) => setFormData({ ...formData, stock: e.target.value === '' ? 0 : Number(e.target.value) })}
										/>
									</div>
									<div>
										<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Danh mục</label>
										<input
											list="product-categories"
											className="w-full bg-slate-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl py-3 px-4 text-[#1A237E] dark:text-indigo-300 font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-orange-500/20"
											value={formData.category}
											onChange={(e) => setFormData({ ...formData, category: e.target.value })}
										/>
										<datalist id="product-categories">
											{categories.map(cat => <option key={cat} value={cat} />)}
										</datalist>
									</div>
								</div>
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									<div>
										<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Quy cách</label>
										<input
											type="text"
											placeholder="VD: 1.2 x 2.4m"
											className="w-full bg-slate-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl py-3 px-4 text-[#1A237E] dark:text-indigo-300 font-medium focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-orange-500/20"
											value={formData.specification}
											onChange={(e) => setFormData({ ...formData, specification: e.target.value })}
										/>
									</div>
									<div>
										<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Đóng gói</label>
										<input
											type="text"
											placeholder="VD: Kiện 50 tấm"
											className="w-full bg-slate-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl py-3 px-4 text-[#1A237E] dark:text-indigo-300 font-medium focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-orange-500/20"
											value={formData.packaging}
											onChange={(e) => setFormData({ ...formData, packaging: e.target.value })}
										/>
									</div>
									<div>
										<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Trọng lượng</label>
										<input
											type="text"
											placeholder="VD: 25kg/tấm"
											className="w-full bg-slate-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl py-3 px-4 text-[#1A237E] dark:text-indigo-300 font-medium focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-orange-500/20"
											value={formData.density}
											onChange={(e) => setFormData({ ...formData, density: e.target.value })}
										/>
									</div>
								</div>

								<div>
									<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Ghi chú sản phẩm</label>
									<textarea
										rows={3}
										placeholder="..."
										className="w-full bg-slate-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl py-3 px-4 text-[#1A237E] dark:text-indigo-300 font-medium focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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

							<div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl flex justify-between items-center">
								<div>
									<p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Mô tả / Ghi chú</p>
									<p className="text-slate-600 dark:text-slate-300 italic whitespace-pre-wrap">{selectedProduct.note || 'Không có ghi chú'}</p>
								</div>
								<div className="text-right border-l pl-4 border-slate-200 dark:border-slate-700">
									<p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Người tạo</p>
									<p className="text-[10px] text-blue-500 font-bold truncate max-w-[100px]">{selectedProduct.createdByEmail || 'N/A'}</p>
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
		</div>
	);
};

const ProdStatCard = ({ icon, label, value, color }: any) => (
	<div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 transition-colors duration-300">
		<div className={`p-2 ${color} w-fit rounded-lg mb-2`}>
			<span className="material-symbols-outlined text-lg">{icon}</span>
		</div>
		<p className="text-gray-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">{label}</p>
		<h3 className="text-xl font-black text-[#1A237E] dark:text-indigo-400">{value}</h3>
	</div>
);

export default ProductList;
