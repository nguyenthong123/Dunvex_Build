import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, where } from 'firebase/firestore';

const ProductList = () => {
	const navigate = useNavigate();
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
		if (!auth.currentUser) return;

		const q = query(
			collection(db, 'products'),
			where('createdBy', '==', auth.currentUser.uid)
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
	}, [auth.currentUser]);

	const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setUploading(true);
		try {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = async () => {
				const base64Data = (reader.result as string).split(',')[1];

				try {
					const response = await fetch('https://script.google.com/macros/s/AKfycby6Bm4e2rkzn7y6Skkl9eYKqclc927iJo1as-fBP7lsnvG1eC7sSh8Albak4fmy59w2FA/exec', {
						method: 'POST',
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
						alert("Lỗi từ Drive: " + (data.message || "Không xác định"));
					}
				} catch (err: any) {
					console.error("Fetch Error:", err);
					// GAS often has CORS issues. If we can't read JSON, it might still have uploaded.
					// But usually, we need the URL back.
					alert("Lỗi kết nối đến Google Drive. Vui lòng kiểm tra cấu hình Script.");
				} finally {
					setUploading(false);
				}
			};
		} catch (error: any) {
			console.error("Reader error:", error);
			alert("Lỗi khi xử lý tệp ảnh.");
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
				createdBy: auth.currentUser?.uid,
				createdByEmail: auth.currentUser?.email
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

	const resetForm = () => {
		setFormData({
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

	return (
		<>
			<header className="h-16 md:h-20 bg-white border-b border-gray-100 flex items-center justify-between px-4 md:px-8 shrink-0">
				<div className="flex items-center gap-3">
					<button
						onClick={() => navigate('/dashboard')}
						className="size-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-[#1A237E] transition-all group"
						title="Về Trang Chủ"
					>
						<span className="material-symbols-outlined text-xl group-hover:rotate-[-45deg] transition-transform">home</span>
					</button>
					<div className="h-6 w-px bg-slate-200 mx-1"></div>
					<h2 className="text-lg md:text-xl font-black text-[#1A237E] uppercase tracking-tight">Kho Hàng</h2>
				</div>

				<div className="flex items-center gap-4">
					<div className="hidden md:flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 w-64 border border-transparent focus-within:border-blue-500 focus-within:bg-white transition-all">
						<span className="material-symbols-outlined text-slate-400">search</span>
						<input
							type="text"
							placeholder="Tìm kiếm sản phẩm..."
							className="bg-transparent border-none outline-none w-full text-sm font-medium text-slate-700 placeholder:text-slate-400"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					</div>

					<button
						onClick={() => setShowAddForm(true)}
						className="hidden md:flex bg-[#FF6D00] hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-all items-center gap-2"
					>
						<span className="material-symbols-outlined text-xl">add</span>
						<span>Thêm Mới</span>
					</button>
				</div>
			</header>

			{/* CONTENT */}
			<div className="flex-1 p-4 md:p-8">
				{/* Stats */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
					<ProdStatCard icon="inventory_2" label="Tổng sản phẩm" value={products.length.toString()} color="bg-blue-50 text-blue-600" />
					<ProdStatCard icon="production_quantity_limits" label="Sắp hết hàng" value={products.filter(p => p.stock <= 5).length.toString()} color="bg-orange-50 text-orange-600" />
					<ProdStatCard icon="category" label="Danh mục" value={categories.length.toString()} color="bg-purple-50 text-purple-600" />
					<ProdStatCard icon="attach_money" label="Giá trị kho" value="N/A" color="bg-green-50 text-green-600" />
				</div>

				{/* Table - Desktop */}
				<div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
					<table className="w-full text-left">
						<thead>
							<tr className="bg-gray-50 border-b border-gray-100">
								<th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase">Sản phẩm</th>
								<th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase">Giá bán</th>
								<th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase">Tồn kho</th>
								<th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase">Danh mục</th>
								<th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase text-right">Hành động</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100">
							{loading ? (
								<tr><td colSpan={5} className="py-8 text-center text-slate-400">Đang tải dữ liệu...</td></tr>
							) : filteredProducts.length === 0 ? (
								<tr><td colSpan={5} className="py-8 text-center text-slate-400">Không tìm thấy sản phẩm nào</td></tr>
							) : (
								filteredProducts.map((product) => (
									<tr key={product.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => openDetail(product)}>
										<td className="py-4 px-6">
											<div className="flex items-center gap-3">
												<div className="size-12 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-sm overflow-hidden border border-gray-100">
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
													<div className="font-bold text-[#1A237E]">{product.name}</div>
													<div className="text-[10px] text-gray-400 uppercase tracking-wider">{product.sku || '#' + product.id.slice(-6).toUpperCase()}</div>
												</div>
											</div>
										</td>
										<td className="py-4 px-6 font-bold text-blue-600">{formatPrice(product.priceSell)}</td>
										<td className="py-4 px-6">
											<div className="flex items-center gap-2">
												<span className={`font-black ${product.stock <= 5 ? 'text-red-500' : 'text-[#1A237E]'}`}>
													{product.stock}
												</span>
												<span className="text-[10px] text-gray-400 font-bold uppercase">{product.unit}</span>
											</div>
										</td>
										<td className="py-4 px-6">
											<span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-600 uppercase">
												{product.category}
											</span>
										</td>
										<td className="py-4 px-6 text-right">
											<div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
												<button onClick={() => openEdit(product)} className="p-2 text-slate-300 hover:text-[#1A237E] transition-colors">
													<span className="material-symbols-outlined text-[20px]">edit</span>
												</button>
												<button onClick={() => handleDeleteProduct(product.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
													<span className="material-symbols-outlined text-[20px]">delete</span>
												</button>
											</div>
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
						<div key={product.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200" onClick={() => openDetail(product)}>
							<div className="flex justify-between items-start mb-4">
								<div className="flex items-center gap-3">
									<div className="size-14 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center overflow-hidden border border-gray-100">
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
										<h3 className="font-bold text-[#1A237E]">{product.name}</h3>
										<p className="text-xs text-slate-400">{product.sku || 'Không có mã'}</p>
									</div>
								</div>
								<div className="flex flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
									<span className="px-2 py-1 bg-purple-50 text-purple-600 text-[10px] font-bold rounded uppercase">{product.category}</span>
									<div className="flex gap-1">
										<button onClick={() => openEdit(product)} className="p-1 text-[#1A237E]"><span className="material-symbols-outlined text-sm">edit</span></button>
										<button onClick={() => handleDeleteProduct(product.id)} className="p-1 text-red-500"><span className="material-symbols-outlined text-sm">delete</span></button>
									</div>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
								<div>
									<p className="text-[10px] uppercase text-gray-400 font-bold">Giá bán</p>
									<p className="text-[#1A237E] font-black">{formatPrice(product.priceSell)}</p>
								</div>
								<div className="text-right">
									<p className="text-[10px] uppercase text-gray-400 font-bold">Tồn kho</p>
									<p className={`font-black ${product.stock <= 5 ? 'text-red-500' : 'text-slate-700'}`}>{product.stock} {product.unit}</p>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* ADD/EDIT MODAL */}
			{(showAddForm || showEditForm) && (
				<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#1A237E]/80 backdrop-blur-sm">
					<div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[85vh]">
						<div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
							<h3 className="text-xl font-black text-[#1A237E]">
								{showEditForm ? 'Cập Nhật Sản Phẩm' : 'Thêm Sản Phẩm Mới'}
							</h3>
							<button
								onClick={() => { setShowAddForm(false); setShowEditForm(false); resetForm(); }}
								className="size-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
							>
								<span className="material-symbols-outlined">close</span>
							</button>
						</div>

						<form onSubmit={showEditForm ? handleUpdateProduct : handleAddProduct} className="flex-1 overflow-y-auto p-6 space-y-6 text-left pb-10">
							<div className="space-y-6">
								{/* Image Upload Area */}
								<div className="flex flex-col items-center">
									<div className="relative size-32 bg-slate-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden group">
										{formData.imageUrl ? (
											<img
												src={getImageUrl(formData.imageUrl)}
												className="size-full object-cover"
												referrerPolicy="no-referrer"
											/>
										) : (
											<div className="text-center p-2">
												<span className="material-symbols-outlined text-gray-300 text-3xl group-hover:text-[#FF6D00] transition-colors">cloud_upload</span>
												<p className="text-[10px] text-gray-400 font-bold mt-1 group-hover:text-[#FF6D00] transition-colors">Tải ảnh lên Drive</p>
											</div>
										)}
										{uploading && (
											<div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
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
									<p className="text-[10px] text-gray-400 mt-2 italic text-center">
										* Tải ảnh lên Google Drive<br />
										(Tự động lấy link)
									</p>

									{/* Manual Link Input (Still available as backup) */}
									<div className="w-full mt-4 pt-4 border-t border-gray-100">
										<input
											type="text"
											placeholder="Hoặc dán link ảnh trực tiếp..."
											className="w-full bg-slate-50 border-gray-200 rounded-lg py-2 px-3 text-xs text-slate-600 focus:bg-white focus:ring-1 focus:ring-orange-500/20"
											onChange={(e) => {
												let url = e.target.value;
												setFormData({ ...formData, imageUrl: getImageUrl(url) });
											}}
										/>
									</div>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="md:col-span-2">
										<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tên sản phẩm *</label>
										<input
											required
											type="text"
											placeholder="VD: Tôn lạnh màu xanh ngọc 0.45"
											className="w-full bg-slate-50 border-gray-200 rounded-xl py-3 px-4 text-[#1A237E] font-medium focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
											value={formData.name}
											onChange={(e) => setFormData({ ...formData, name: e.target.value })}
										/>
									</div>
									<div>
										<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mã SKU / Code</label>
										<input
											type="text"
											placeholder="VD: TL-XN-045"
											className="w-full bg-slate-50 border-gray-200 rounded-xl py-3 px-4 text-[#1A237E] font-medium focus:bg-white focus:ring-2 focus:ring-orange-500/20"
											value={formData.sku}
											onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
										/>
									</div>
									<div>
										<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Đơn vị tính</label>
										<input
											type="text"
											placeholder="VD: m2, tấm, cây..."
											className="w-full bg-slate-50 border-gray-200 rounded-xl py-3 px-4 text-[#1A237E] font-medium focus:bg-white focus:ring-2 focus:ring-orange-500/20"
											value={formData.unit}
											onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
										/>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Giá nhập</label>
										<input
											type="number"
											className="w-full bg-slate-50 border-gray-200 rounded-xl py-3 px-4 text-[#1A237E] font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/20"
											value={formData.priceBuy === 0 ? '' : formData.priceBuy}
											onChange={(e) => setFormData({ ...formData, priceBuy: e.target.value === '' ? 0 : Number(e.target.value) })}
										/>
									</div>
									<div>
										<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Giá bán</label>
										<input
											type="number"
											className="w-full bg-slate-50 border-gray-200 rounded-xl py-3 px-4 text-blue-600 font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/20"
											value={formData.priceSell === 0 ? '' : formData.priceSell}
											onChange={(e) => setFormData({ ...formData, priceSell: e.target.value === '' ? 0 : Number(e.target.value) })}
										/>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Số lượng tồn</label>
										<input
											type="number"
											className="w-full bg-slate-50 border-gray-200 rounded-xl py-3 px-4 text-[#1A237E] font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/20"
											value={formData.stock === 0 ? '' : formData.stock}
											onChange={(e) => setFormData({ ...formData, stock: e.target.value === '' ? 0 : Number(e.target.value) })}
										/>
									</div>
									<div>
										<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Danh mục</label>
										<input
											list="product-categories"
											className="w-full bg-slate-50 border-gray-200 rounded-xl py-3 px-4 text-[#1A237E] font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/20"
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
										<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Quy cách</label>
										<input
											type="text"
											placeholder="VD: 1.2 x 2.4m"
											className="w-full bg-slate-50 border-gray-200 rounded-xl py-3 px-4 text-[#1A237E] font-medium focus:bg-white focus:ring-2 focus:ring-orange-500/20"
											value={formData.specification}
											onChange={(e) => setFormData({ ...formData, specification: e.target.value })}
										/>
									</div>
									<div>
										<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Đóng gói</label>
										<input
											type="text"
											placeholder="VD: Kiện 50 tấm"
											className="w-full bg-slate-50 border-gray-200 rounded-xl py-3 px-4 text-[#1A237E] font-medium focus:bg-white focus:ring-2 focus:ring-orange-500/20"
											value={formData.packaging}
											onChange={(e) => setFormData({ ...formData, packaging: e.target.value })}
										/>
									</div>
									<div>
										<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Trọng lượng</label>
										<input
											type="text"
											placeholder="VD: 25kg/tấm"
											className="w-full bg-slate-50 border-gray-200 rounded-xl py-3 px-4 text-[#1A237E] font-medium focus:bg-white focus:ring-2 focus:ring-orange-500/20"
											value={formData.density}
											onChange={(e) => setFormData({ ...formData, density: e.target.value })}
										/>
									</div>
								</div>

								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Ghi chú sản phẩm</label>
									<textarea
										rows={3}
										placeholder="..."
										className="w-full bg-slate-50 border-gray-200 rounded-xl py-3 px-4 text-[#1A237E] font-medium focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
										value={formData.note}
										onChange={(e) => setFormData({ ...formData, note: e.target.value })}
									></textarea>
								</div>
							</div>

							<div className="pt-4 sticky bottom-0 bg-white">
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
				<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#1A237E]/80 backdrop-blur-sm">
					<div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[85vh]">
						<div className="px-6 py-4 bg-[#1A237E] text-white flex items-center justify-between sticky top-0 z-10">
							<h3 className="text-xl font-black">Chi Tiết Sản Phẩm</h3>
							<button onClick={() => setShowDetail(false)} className="size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
								<span className="material-symbols-outlined">close</span>
							</button>
						</div>

						<div className="p-6 space-y-6 overflow-y-auto">
							<div className="flex items-center gap-4 border-b border-slate-100 pb-6">
								<div className="size-24 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center overflow-hidden border border-gray-100 shadow-inner shrink-0 leading-none">
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
									<p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{selectedProduct.category}</p>
									<h2 className="text-xl font-black text-[#1A237E] leading-tight break-words">{selectedProduct.name}</h2>
									<p className="text-xs font-bold text-gray-400 mt-1">SKU: {selectedProduct.sku || '---'}</p>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="bg-slate-50 p-4 rounded-2xl">
									<p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Giá bán công bố</p>
									<p className="text-blue-600 font-black text-lg">{formatPrice(selectedProduct.priceSell)}</p>
								</div>
								<div className="bg-slate-50 p-4 rounded-2xl">
									<p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Tồn kho hiện tại</p>
									<p className="text-[#1A237E] font-black text-lg">{selectedProduct.stock} <span className="text-xs">{selectedProduct.unit}</span></p>
								</div>
							</div>

							<div className="bg-slate-50 p-4 rounded-2xl border-l-4 border-orange-500">
								<p className="text-[10px] font-bold text-orange-400 uppercase mb-1">Lợi nhuận gộp ước tính</p>
								<p className="text-green-600 font-black text-xl">{formatPrice(selectedProduct.priceSell - selectedProduct.priceBuy)}</p>
								<p className="text-[10px] text-gray-400 font-medium">Giá nhập: {formatPrice(selectedProduct.priceBuy)}</p>
							</div>

							<div className="grid grid-cols-3 gap-3">
								<div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
									<p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Quy cách</p>
									<p className="text-xs font-black text-[#1A237E]">{selectedProduct.specification || '---'}</p>
								</div>
								<div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
									<p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Đóng gói</p>
									<p className="text-xs font-black text-[#1A237E]">{selectedProduct.packaging || '---'}</p>
								</div>
								<div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
									<p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Trọng lượng</p>
									<p className="text-xs font-black text-[#1A237E]">{selectedProduct.density || '---'}</p>
								</div>
							</div>

							<div className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center">
								<div>
									<p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Mô tả / Ghi chú</p>
									<p className="text-slate-600 italic whitespace-pre-wrap">{selectedProduct.note || 'Không có ghi chú'}</p>
								</div>
								<div className="text-right border-l pl-4 border-slate-200">
									<p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Người tạo</p>
									<p className="text-[10px] text-blue-500 font-bold truncate max-w-[100px]">{selectedProduct.createdByEmail || 'N/A'}</p>
								</div>
							</div>

							<div className="flex gap-3 pt-2 pb-6">
								<button
									onClick={() => { setShowDetail(false); openEdit(selectedProduct); }}
									className="flex-1 bg-blue-50 text-blue-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
								>
									<span className="material-symbols-outlined text-lg">edit</span> Chỉnh sửa
								</button>
								<button
									onClick={() => { setShowDetail(false); handleDeleteProduct(selectedProduct.id); }}
									className="flex-1 bg-red-50 text-red-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
								>
									<span className="material-symbols-outlined text-lg">delete</span> Xóa sản phẩm
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	);
};

const ProdStatCard = ({ icon, label, value, color }: any) => (
	<div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
		<div className={`p-2 ${color} w-fit rounded-lg mb-2`}>
			<span className="material-symbols-outlined text-lg">{icon}</span>
		</div>
		<p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">{label}</p>
		<h3 className="text-xl font-black text-[#1A237E]">{value}</h3>
	</div>
);

export default ProductList;
