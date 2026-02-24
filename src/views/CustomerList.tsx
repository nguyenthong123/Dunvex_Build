import React, { useState, useEffect } from 'react';
import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, where, limit } from 'firebase/firestore';
import BulkImport from '../components/shared/BulkImport';
import CustomerMap from '../components/CustomerMap';
import { Camera, Plus, Trash, X, FileText, Image as ImageIcon, Mail } from 'lucide-react';

import { useOwner } from '../hooks/useOwner';
import { useScroll } from '../context/ScrollContext';
import { useToast } from '../components/shared/Toast';
import { CustomerSchema, getOptimizedImageUrl } from '../utils/validation';

const CustomerList = () => {
	const navigate = useNavigate();
	const owner = useOwner();
	const { isNavVisible } = useScroll();
	const { showToast } = useToast();

	const getImageUrl = (url: string) => getOptimizedImageUrl(url);

	const [customers, setCustomers] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [showAddForm, setShowAddForm] = useState(false);
	const [showImport, setShowImport] = useState(false);
	const [showEditForm, setShowEditForm] = useState(false);
	const [showDetail, setShowDetail] = useState(false);
	const [showMap, setShowMap] = useState(false);
	const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
	const [searchTerm, setSearchTerm] = useState('');
	const [selectedRoute, setSelectedRoute] = useState('All');
	const [showMobileSearch, setShowMobileSearch] = useState(false);
	const searchInputRef = React.useRef<HTMLInputElement>(null);
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState(1);
	const ITEMS_PER_PAGE = 10;

	// Form state
	const [formData, setFormData] = useState({
		name: '',
		businessName: '',
		phone: '',
		email: '',
		type: 'Chủ nhà',
		address: '',
		note: '',
		status: 'Hoạt động',
		route: '',
		lat: null as number | null,
		lng: null as number | null,
		licenseUrls: [] as string[],
		additionalImages: [] as string[]
	});

	const [uploadingLicense, setUploadingLicense] = useState(false);
	const [uploadingImages, setUploadingImages] = useState(false);

	const [gettingLocation, setGettingLocation] = useState(false);


	// Get unique types from existing customers for the suggestions
	const baseTypes = [
		'Chủ nhà', 'Thầu Thợ', 'Cửa Hàng', 'Cửa hàng nhựa',
		'Cửa hàng weber', 'Cửa hàng keo dán gach', 'Cửa hàng kim khí',
		'Cửa hàng điện nước', 'Nhà Máy Tôn', 'Nhà Phân Phối',
		'Nhà phân phối nhôm kính', 'Kho đá hoa cương', 'Kho phân phối nhôm',
		'Đối Thủ', 'Area Sales Representative'
	];

	const dynamicTypes = Array.isArray(customers)
		? Array.from(new Set(customers.map(c => c.type))).filter(t => t && !baseTypes.includes(t))
		: [];

	const customerTypes = [...baseTypes, ...dynamicTypes];

	// Extract unique sales routes
	const salesRoutes = Array.isArray(customers)
		? Array.from(new Set(customers.map(c => c.route).filter(Boolean)))
		: [];

	const handleGetLocation = () => {
		setGettingLocation(true);
		if (!navigator.geolocation) {
			showToast("Trình duyệt không hỗ trợ định vị", "error");
			setGettingLocation(false);
			return;
		}

		navigator.geolocation.getCurrentPosition(async (position) => {
			const { latitude, longitude } = position.coords;
			setFormData(prev => ({ ...prev, lat: latitude, lng: longitude }));

			try {
				const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, {
					headers: { 'Accept-Language': 'vi' }
				});
				const data = await res.json();
				if (data.display_name) {
					setFormData(prev => ({ ...prev, address: data.display_name }));
				}
			} catch (err) {
				// Silent fail or handle appropriately
			} finally {
				setGettingLocation(false);
			}
		}, (error) => {
			showToast("Không thể lấy vị trí. Vui lòng cấp quyền GPS.", "warning");
			setGettingLocation(false);
		});
	};

	const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'license' | 'additional') => {
		const files = e.target.files;
		if (!files || files.length === 0) return;

		if (type === 'license') setUploadingLicense(true);
		else setUploadingImages(true);

		try {
			const uploadPromises = Array.from(files).map(async (file) => {
				const data = new FormData();
				data.append('file', file);
				data.append('upload_preset', 'dunvexbuil');
				data.append('folder', 'dunvex_customers');

				const response = await fetch(
					`https://api.cloudinary.com/v1_1/dtx0uvb4e/image/upload`,
					{ method: 'POST', body: data }
				);
				const result = await response.json();
				return result.secure_url;
			});

			const urls = await Promise.all(uploadPromises);

			if (type === 'license') {
				setFormData(prev => ({
					...prev,
					licenseUrls: [...(prev.licenseUrls || []), ...urls]
				}));
			} else {
				setFormData(prev => ({
					...prev,
					additionalImages: [...(prev.additionalImages || []), ...urls]
				}));
			}
		} catch (error) {
			showToast("Lỗi upload Cloudinary", "error");
		} finally {
			setUploadingLicense(false);
			setUploadingImages(false);
		}
	};

	const removeLicense = (index: number) => {
		setFormData(prev => ({
			...prev,
			licenseUrls: prev.licenseUrls.filter((_, i) => i !== index)
		}));
	};

	const removeImage = (index: number) => {
		setFormData(prev => ({
			...prev,
			additionalImages: prev.additionalImages.filter((_, i) => i !== index)
		}));
	};

	useEffect(() => {
		if (owner.loading || !owner.ownerId) return;

		const isAdmin = owner.role?.toLowerCase() === 'admin' || !owner.isEmployee;

		let q;
		if (isAdmin) {
			q = query(
				collection(db, 'customers'),
				where('ownerId', '==', owner.ownerId),
				orderBy('createdAt', 'desc'),
				limit(100)
			);
		} else {
			q = query(
				collection(db, 'customers'),
				where('ownerId', '==', owner.ownerId),
				where('createdByEmail', '==', auth.currentUser?.email),
				orderBy('createdAt', 'desc'),
				limit(100)
			);
		}

		const unsubscribe = onSnapshot(q, (snapshot: any) => {
			const docs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
			const sortedDocs = [...docs].sort((a, b) => {
				const dateA = a.createdAt?.seconds || 0;
				const dateB = b.createdAt?.seconds || 0;
				return dateB - dateA;
			});
			setCustomers(sortedDocs);
			setLoading(false);
		});
		return unsubscribe;
	}, [owner.loading, owner.ownerId, owner.role, owner.isEmployee]);

	const { search } = useLocation();
	useEffect(() => {
		const params = new URLSearchParams(search);
		if (params.get('new') === 'true') {
			resetForm();
			setShowAddForm(true);
			navigate('/customers', { replace: true });
		}
		if (params.get('search') === 'true') {
			setShowMobileSearch(true);
		}
		if (params.get('map') === 'true') {
			setShowMap(true);
			navigate('/customers', { replace: true });
		}
		if (params.get('import') === 'true') {
			setShowImport(true);
			navigate('/customers', { replace: true });
		}
	}, [search, navigate]);

	useEffect(() => {
		if (showMobileSearch && searchInputRef.current) {
			searchInputRef.current.focus();
		}
	}, [showMobileSearch]);

	useEffect(() => {
		setCurrentPage(1);
	}, [searchTerm, selectedRoute]);

	const handleAddCustomer = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const validationData = {
				...formData,
				ownerId: owner.ownerId,
				createdByEmail: auth.currentUser?.email || ''
			};

			const result = CustomerSchema.safeParse(validationData);
			if (!result.success) {
				const firstError = result.error.issues[0]?.message || "Dữ liệu không hợp lệ";
				showToast(firstError, "warning");
				return;
			}

			const validatedData = result.data;
			await addDoc(collection(db, 'customers'), {
				...validatedData,
				createdAt: serverTimestamp(),
				ownerEmail: owner.ownerEmail,
				createdBy: auth.currentUser?.uid,
			});

			// Log Add Customer
			await addDoc(collection(db, 'audit_logs'), {
				action: 'Thêm khách hàng mới',
				user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
				userId: auth.currentUser?.uid,
				ownerId: owner.ownerId,
				details: `Đã thêm khách hàng: ${formData.name} - SĐT: ${formData.phone}`,
				createdAt: serverTimestamp()
			});

			setShowAddForm(false);
			resetForm();
			showToast("Thêm khách hàng thành công", "success");
		} catch (error) {
			showToast("Lỗi khi thêm khách hàng", "error");
		}
	};

	const handleUpdateCustomer = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedCustomer) return;
		try {
			const validationData = {
				...formData,
				ownerId: owner.ownerId,
				createdByEmail: selectedCustomer.createdByEmail || auth.currentUser?.email || ''
			};

			const result = CustomerSchema.safeParse(validationData);
			if (!result.success) {
				const firstError = result.error.issues[0]?.message || "Dữ liệu không hợp lệ";
				showToast(firstError, "warning");
				return;
			}

			const validatedData = result.data;
			await updateDoc(doc(db, 'customers', selectedCustomer.id), {
				...validatedData,
				updatedAt: serverTimestamp(),
				updatedBy: auth.currentUser?.uid
			});

			// Log Update Customer
			await addDoc(collection(db, 'audit_logs'), {
				action: 'Cập nhật khách hàng',
				user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
				userId: auth.currentUser?.uid,
				ownerId: owner.ownerId,
				details: `Đã cập nhật thông tin khách hàng: ${formData.name}`,
				createdAt: serverTimestamp()
			});

			setShowEditForm(false);
			resetForm();
			showToast("Cập nhật thành công", "success");
		} catch (error) {
			showToast("Lỗi khi cập nhật khách hàng", "error");
		}
	};

	const handleDeleteCustomer = async (id: string, bypassConfirm = false) => {
		if (bypassConfirm || window.confirm("Bạn có chắc chắn muốn xóa khách hàng này không?")) {
			try {
				const customerName = customers.find(c => c.id === id)?.name || 'Khách hàng';
				await deleteDoc(doc(db, 'customers', id));

				// Log Delete Customer
				await addDoc(collection(db, 'audit_logs'), {
					action: 'Xóa khách hàng',
					user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
					userId: auth.currentUser?.uid,
					ownerId: owner.ownerId,
					details: `Đã xóa khách hàng: ${customerName}`,
					createdAt: serverTimestamp()
				});

				setShowDetail(false);
				showToast("Đã xóa khách hàng", "success");
			} catch (error) {
				showToast("Lỗi khi xóa khách hàng", "error");
			}
		}
	};

	const resetForm = () => {
		setFormData({
			name: '',
			businessName: '',
			phone: '',
			email: '',
			type: 'Chủ nhà',
			address: '',
			note: '',
			status: 'Hoạt động',
			route: '',
			lat: null,
			lng: null,
			licenseUrls: [],
			additionalImages: []
		});
	};

	const openEdit = (customer: any) => {
		setSelectedCustomer(customer);
		setFormData({
			name: customer.name || '',
			businessName: customer.businessName || '',
			phone: customer.phone || '',
			email: customer.email || '',
			type: customer.type || 'Chủ nhà',
			address: customer.address || '',
			note: customer.note || '',
			status: customer.status || 'Hoạt động',
			route: customer.route || '',
			lat: customer.lat || null,
			lng: customer.lng || null,
			licenseUrls: customer.licenseUrls || (customer.licenseUrl ? [customer.licenseUrl] : []),
			additionalImages: customer.additionalImages || []
		});
		setShowEditForm(true);
	};

	const openDetail = (customer: any) => {
		setSelectedCustomer(customer);
		setShowDetail(true);
	};

	const filteredCustomers = customers.filter(c => {
		const matchesSearch = String(c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
			String(c.businessName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
			String(c.phone || '').includes(searchTerm) ||
			String(c.route || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
			String(c.email || '').toLowerCase().includes(searchTerm.toLowerCase());

		const matchesRoute = selectedRoute === 'All' || c.route === selectedRoute;

		return matchesSearch && matchesRoute;
	});

	const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
	const paginatedCustomers = filteredCustomers.slice(
		(currentPage - 1) * ITEMS_PER_PAGE,
		currentPage * ITEMS_PER_PAGE
	);

	const getPageNumbers = () => {
		const pages: (number | string)[] = [];
		const radius = 1;

		for (let i = 1; i <= totalPages; i++) {
			if (
				i === 1 ||
				i === totalPages ||
				(i >= currentPage - radius && i <= currentPage + radius) ||
				i <= 3 ||
				i >= totalPages - 2
			) {
				pages.push(i);
			}
		}

		const uniquePages = [...new Set(pages)].sort((a, b) => (a as number) - (b as number));
		const withEllipsis: (number | string)[] = [];

		for (let i = 0; i < uniquePages.length; i++) {
			if (i > 0 && (uniquePages[i] as number) - (uniquePages[i - 1] as number) > 1) {
				withEllipsis.push('...');
			}
			withEllipsis.push(uniquePages[i]);
		}
		return withEllipsis;
	};

	const hasManagePermission = owner.role === 'admin' || (owner.accessRights?.customers_manage ?? true);

	if (owner.loading) return <PageSkeleton />;

	if (!hasManagePermission) {
		return (
			<div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-slate-950 items-center justify-center text-center p-8 min-h-screen">
				<div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-full text-indigo-500 mb-4">
					<span className="material-symbols-outlined text-5xl">group</span>
				</div>
				<h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase mb-2">Quyền hạn hạn chế</h2>
				<p className="text-slate-500 dark:text-slate-400 max-w-md">
					Bạn không có quyền quản lý danh sách khách hàng. Vui lòng liên hệ Admin.
				</p>
				<button onClick={() => navigate('/')} className="mt-6 bg-[#1A237E] text-white px-6 py-2 rounded-xl font-bold">Quay lại</button>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-slate-950 transition-colors duration-300">
			<header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 h-16 md:h-20 flex items-center justify-between px-4 md:px-8 shrink-0 transition-colors duration-300 relative">
				{!showMobileSearch ? (
					<>
						<div className="flex items-center gap-3">
							<button
								onClick={() => navigate('/')}
								className="size-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-[#1A237E] dark:hover:text-indigo-400 transition-all group"
								title="Về Trang Chủ"
							>
								<span className="material-symbols-outlined text-xl group-hover:rotate-[-45deg] transition-transform">home</span>
							</button>
							<div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
							<h2 className="text-lg md:text-xl font-black text-[#1A237E] dark:text-indigo-400 uppercase tracking-tight">Khách Hàng</h2>
						</div>
						<div className="flex items-center gap-2 md:gap-4">
							{/* Route & Search on Desktop */}
							<div className="hidden md:flex items-center gap-2">
								<div className="relative">
									<select
										className="pl-4 pr-10 py-2.5 bg-indigo-50 dark:bg-slate-800 border-none rounded-xl text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500/30 appearance-none transition-all cursor-pointer"
										value={selectedRoute}
										onChange={(e) => setSelectedRoute(e.target.value)}
									>
										<option value="All">Tốt cả Tuyến</option>
										{salesRoutes.map(r => <option key={r} value={r}>{r}</option>)}
									</select>
									<span className="material-symbols-outlined absolute right-3 top-2 text-indigo-300 pointer-events-none text-lg">expand_more</span>
								</div>

								<div className="relative">
									<span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">search</span>
									<input
										type="text"
										placeholder="Tìm khách hàng..."
										className="pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#FF6D00]/30 w-64 transition-all text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
										value={searchTerm}
										onChange={(e) => setSearchTerm(e.target.value)}
									/>
								</div>
							</div>

							{/* Search Trigger for Mobile */}
							<button
								onClick={() => setShowMobileSearch(true)}
								className="md:hidden size-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400"
							>
								<span className="material-symbols-outlined">search</span>
							</button>

							<button
								onClick={() => setShowImport(true)}
								className="hidden md:flex bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-4 py-2.5 rounded-xl font-bold border border-slate-200 dark:border-slate-800 transition-all items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700"
							>
								<span className="material-symbols-outlined">file_upload</span>
								<span className="hidden sm:inline">Nhập Excel</span>
							</button>
							<button
								onClick={() => setShowMap(true)}
								className="size-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-[#FF6D00] hover:bg-[#FF6D00] hover:text-white transition-all shadow-lg shadow-orange-500/10"
								title="Xem bản đồ"
							>
								<span className="material-symbols-outlined">map</span>
							</button>
							<div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
							<button
								onClick={() => { resetForm(); setShowAddForm(true); }}
								className="bg-[#FF6D00] hover:bg-orange-600 text-white px-3 md:px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2"
							>
								<span className="material-symbols-outlined">person_add</span>
								<span className="hidden md:inline">Thêm mới</span>
							</button>
						</div>
					</>
				) : (
					<div className="flex items-center gap-3 w-full animate-in slide-in-from-right-4 duration-300">
						<div className="relative flex-1">
							<span className="material-symbols-outlined absolute left-3 top-2.5 text-[#FF6D00]">search</span>
							<input
								ref={searchInputRef}
								type="text"
								placeholder="Nhập tên, SĐT hoặc cơ sở..."
								className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/30"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
							/>
						</div>
						<button
							onClick={() => {
								setShowMobileSearch(false);
								setSearchTerm('');
								navigate('/customers', { replace: true });
							}}
							className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold"
						>
							Đóng
						</button>
					</div>
				)}
			</header>

			{showImport && (
				<BulkImport
					type="customers"
					ownerId={owner.ownerId}
					ownerEmail={owner.ownerEmail}
					onClose={() => setShowImport(false)}
					onSuccess={() => {
						// Optional: refresh data or show success message
					}}
				/>
			)}

			{/* CONTENT */}
			<div className="flex-1 p-4 md:p-8">
				{/* Stats Cards */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
					<StatCard icon="group" label="Tổng khách" value={customers.length.toString()} color="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" />
					<StatCard icon="person_add" label="Khách mới" value="12" color="bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400" />
					<StatCard icon="verified" label="VIP" value="5" color="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400" />
					<div onClick={() => setShowMap(true)} className="cursor-pointer">
						<StatCard icon="location_on" label="Vị trí" value={customers.filter(c => c.lat && c.lng).length.toString()} color="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" />
					</div>
				</div>

				{/* Desktop Table */}
				<div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
					<table className="w-full text-left">
						<thead>
							<tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
								<th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">Khách hàng</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">Liên hệ</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">Phân loại</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-center">Tuyến</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-center">Trạng thái</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-right">Hành động</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100 dark:divide-slate-800">
							{loading ? (
								<TableSkeleton />
							) : paginatedCustomers.length === 0 ? (
								<tr><td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500 font-medium tracking-wide">Không tìm thấy khách hàng nào</td></tr>
							) : paginatedCustomers.map((customer) => (
								<tr key={customer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => openDetail(customer)}>
									<td className="py-4 px-6">
										<div className="flex items-center gap-3">
											<div className="size-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-black text-xs border border-blue-200 dark:border-blue-800">
												{(customer.businessName || customer.name || 'K')[0].toUpperCase()}
											</div>
											<div>
												<div className="font-black text-slate-900 dark:text-indigo-400 uppercase tracking-tight">{customer.businessName || customer.name}</div>
												<div className="text-[10px] text-slate-500 dark:text-slate-500 font-black tracking-widest">
													{customer.businessName ? customer.name : `#${customer.id.slice(-6)}`}
												</div>
											</div>
										</div>
									</td>
									<td className="py-4 px-6 font-medium text-slate-600 dark:text-slate-300">{customer.phone}</td>
									<td className="py-4 px-6">
										<span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-50 dark:bg-orange-900/20 text-[#FF6D00] dark:text-orange-400 uppercase tracking-wider">
											{customer.type}
										</span>
									</td>
									<td className="py-4 px-6 text-center">
										{customer.route ? (
											<span className="px-2 py-0.5 text-[9px] font-black bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg uppercase border border-indigo-100 dark:border-indigo-800">
												{customer.route}
											</span>
										) : (
											<span className="text-[9px] font-bold text-slate-300 dark:text-slate-700 italic">--</span>
										)}
									</td>
									<td className="py-4 px-6 text-center">
										<span className="px-2 py-0.5 text-[10px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded uppercase">
											{customer.status}
										</span>
									</td>
									<td className="py-4 px-6 text-right">
										<div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
											{deleteConfirmId === customer.id ? (
												<div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-900/20 p-1 rounded-lg border border-rose-100 dark:border-rose-900/30 animate-in fade-in zoom-in duration-200">
													<button
														onClick={() => setDeleteConfirmId(null)}
														className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-white dark:bg-slate-800 rounded shadow-sm"
													>
														Hủy
													</button>
													<button
														onClick={() => {
															handleDeleteCustomer(customer.id, true);
															setDeleteConfirmId(null);
														}}
														className="px-2 py-1 text-[10px] font-bold text-white bg-rose-500 hover:bg-rose-600 rounded shadow-sm"
													>
														Xác nhận
													</button>
												</div>
											) : (
												<>
													<button onClick={() => openEdit(customer)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
														<span className="material-symbols-outlined text-[20px]">edit</span>
													</button>
													<button onClick={() => setDeleteConfirmId(customer.id)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
														<span className="material-symbols-outlined text-[20px]">delete</span>
													</button>
												</>
											)}
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* Pagination UI - Desktop */}
				{!loading && totalPages > 1 && (
					<div className="hidden md:flex items-center justify-between mt-6 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800">
						<div className="text-xs font-bold text-slate-500 p-2">
							Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredCustomers.length)} của {filteredCustomers.length} khách hàng
						</div>
						<div className="flex gap-2">
							<button
								disabled={currentPage === 1}
								onClick={() => setCurrentPage(prev => prev - 1)}
								className="size-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 disabled:opacity-30 transition-all hover:bg-slate-100 dark:hover:bg-slate-700"
							>
								<span className="material-symbols-outlined">chevron_left</span>
							</button>
							{getPageNumbers().map((page, idx) => (
								<button
									key={idx}
									onClick={() => typeof page === 'number' && setCurrentPage(page)}
									disabled={page === '...'}
									className={`size-10 rounded-xl font-black text-xs transition-all ${page === currentPage
										? 'bg-[#1A237E] text-white shadow-lg shadow-blue-500/20'
										: page === '...'
											? 'text-slate-400 cursor-default'
											: 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
										}`}
								>
									{page}
								</button>
							))}
							<button
								disabled={currentPage === totalPages}
								onClick={() => setCurrentPage(prev => prev + 1)}
								className="size-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 disabled:opacity-30 transition-all hover:bg-slate-100 dark:hover:bg-slate-700"
							>
								<span className="material-symbols-outlined">chevron_right</span>
							</button>
						</div>
					</div>
				)}

				{/* Mobile List Virtualized */}
				<div className="md:hidden h-[600px] pb-24 relative">
					{loading ? (
						<div className="space-y-4">
							{[1, 2, 3, 4, 5].map(i => (
								<div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-slate-800 space-y-4 animate-pulse">
									<div className="flex justify-between">
										<div className="flex items-center gap-3">
											<div className="size-10 rounded-full skeleton" />
											<div className="w-32 h-4 skeleton" />
										</div>
										<div className="w-20 h-6 rounded-full skeleton" />
									</div>
									<div className="w-full h-4 skeleton" />
								</div>
							))}
						</div>
					) : paginatedCustomers.length === 0 ? (
						<div className="py-12 text-center text-slate-400 font-medium">Không tìm thấy khách hàng nào</div>
					) : (
						<AutoSizer renderProp={({ height, width }) => (
							<List
								style={{ height: height || 600, width: width || '100%' }}
								rowCount={paginatedCustomers.length}
								rowHeight={160}
								rowProps={{}}
								className="no-scrollbar"
								rowComponent={({ index, style }) => {
									const customer = paginatedCustomers[index];
									if (!customer) return null;
									return (
										<div style={{ ...style, padding: '0 4px 16px 4px' }}>
											<div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-md border border-gray-100 dark:border-slate-800 h-full flex flex-col justify-between" onClick={() => openDetail(customer)}>
												<div className="flex justify-between items-start">
													<div className="flex items-center gap-3">
														<div className="size-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold">
															{(customer.name?.[0] || 'K').toUpperCase()}
														</div>
														<div>
															<div className="font-black text-[#1A237E] dark:text-indigo-400 uppercase truncate max-w-[150px]">{customer.name}</div>
															<div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{customer.phone}</div>
														</div>
													</div>
													<div className="flex flex-col items-end gap-1">
														<span className="px-2 py-1 rounded-lg text-[9px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 uppercase">
															{customer.route || 'Mặc định'}
														</span>
														<span className="px-2 py-1 rounded-lg text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">
															{customer.status}
														</span>
													</div>
												</div>
												<div className="flex justify-between items-center pt-2 border-t border-gray-50 dark:border-slate-800 mt-2">
													<span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded uppercase tracking-wider">{customer.type}</span>
													<span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">#{customer.id.slice(-6)}</span>
												</div>
											</div>
										</div>
									);
								}}
							/>
						)} />
					)}
				</div>

				{/* Pagination UI - Mobile */}
				{totalPages > 1 && (
					<div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 mt-4 md:hidden">
						<button
							disabled={currentPage === 1}
							onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => prev - 1); window.scrollTo(0, 0); }}
							className="size-12 flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-500 disabled:opacity-30"
						>
							<span className="material-symbols-outlined">chevron_left</span>
						</button>
						<div className="text-sm font-black text-[#1A237E] dark:text-indigo-400">
							Trang {currentPage} / {totalPages}
						</div>
						<button
							disabled={currentPage === totalPages}
							onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => prev + 1); window.scrollTo(0, 0); }}
							className="size-12 flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-500 disabled:opacity-30"
						>
							<span className="material-symbols-outlined">chevron_right</span>
						</button>
					</div>
				)}
			</div>

			{/* ADD/EDIT MODAL */}
			{
				(showAddForm || showEditForm) && (
					<div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[#1A237E]/80 dark:bg-black/80 backdrop-blur-sm">
						<div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-300">
							<div className="px-8 py-6 bg-[#1A237E] dark:bg-indigo-900 text-white flex items-center justify-between">
								<h3 className="text-xl font-black uppercase tracking-tight">{showAddForm ? 'Thêm Khách Hàng' : 'Cập Nhật Hồ Sơ'}</h3>
								<button onClick={() => { setShowAddForm(false); setShowEditForm(false); }} className="size-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
									<span className="material-symbols-outlined">close</span>
								</button>
							</div>
							<form onSubmit={showAddForm ? handleAddCustomer : handleUpdateCustomer} className="p-8 space-y-5 overflow-y-auto custom-scrollbar">
								<div className="grid grid-cols-1 gap-4">
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Họ và Tên *</label>
											<input
												type="text" required
												className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
												value={formData.name}
												onChange={(e) => setFormData({ ...formData, name: e.target.value })}
											/>
										</div>
										<div>
											<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Tên cơ sở kinh doanh</label>
											<input
												type="text"
												className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
												placeholder="VD: Cửa hàng VLXD Hưng Thịnh"
												value={formData.businessName}
												onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
											/>
										</div>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Số điện thoại *</label>
											<input
												type="tel" required
												className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
												value={formData.phone}
												onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
											/>
										</div>
										<div>
											<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Email khách hàng</label>
											<input
												type="email"
												className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
												placeholder="VD: customer@example.com"
												value={formData.email}
												onChange={(e) => setFormData({ ...formData, email: e.target.value })}
											/>
										</div>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Phân loại</label>
											<input
												list="customer-types"
												className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
												value={formData.type}
												placeholder="VD: Chủ nhà, Thợ..."
												onChange={(e) => setFormData({ ...formData, type: e.target.value })}
											/>
											<datalist id="customer-types">
												{customerTypes.map(t => <option key={t} value={t} />)}
											</datalist>
										</div>
										<div>
											<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Tuyến bán hàng (Zoning)</label>
											<input
												type="text"
												className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
												placeholder="VD: Tuyến Thứ 2, Khu vực A..."
												value={formData.route}
												onChange={(e) => setFormData({ ...formData, route: e.target.value })}
											/>
										</div>
									</div>

									<div>
										<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Giấy phép kinh doanh / GPKD</label>
										<div className="space-y-3">
											<button
												type="button"
												onClick={() => document.getElementById('license-upload')?.click()}
												disabled={uploadingLicense}
												className="w-full h-14 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 text-slate-400 hover:text-indigo-500 hover:border-indigo-500 transition-all"
											>
												{uploadingLicense ? (
													<span className="animate-spin material-symbols-outlined">sync</span>
												) : (
													<>
														<FileText size={18} />
														<span className="text-[10px] font-black uppercase tracking-widest">Tải lên GPKD</span>
													</>
												)}
											</button>
											<input id="license-upload" type="file" className="hidden" multiple accept="image/*,application/pdf" onChange={(e) => handleImageUpload(e, 'license')} />

											{formData.licenseUrls && formData.licenseUrls.length > 0 && (
												<div className="grid grid-cols-4 gap-2">
													{formData.licenseUrls.map((url, idx) => (
														<div key={idx} className="aspect-square rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 relative group">
															<img src={getImageUrl(url)} className="w-full h-full object-cover" alt={`License ${idx}`} />
															<button
																type="button"
																onClick={() => removeLicense(idx)}
																className="absolute top-1 right-1 size-6 bg-red-500 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
															>
																<X size={12} />
															</button>
														</div>
													))}
												</div>
											)}
										</div>
									</div>

									{/* Additional Images Upload */}
									<div>
										<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Hình ảnh khác / Công trình</label>
										<div className="space-y-3">
											<button
												type="button"
												onClick={() => document.getElementById('images-upload')?.click()}
												disabled={uploadingImages}
												className="w-full h-14 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 text-slate-400 hover:text-orange-500 hover:border-orange-500 transition-all"
											>
												{uploadingImages ? (
													<span className="animate-spin material-symbols-outlined">sync</span>
												) : (
													<>
														<ImageIcon size={18} />
														<span className="text-[10px] font-black uppercase tracking-widest">Thêm hình ảnh</span>
													</>
												)}
											</button>
											<input id="images-upload" type="file" className="hidden" multiple accept="image/*" onChange={(e) => handleImageUpload(e, 'additional')} />

											{formData.additionalImages && formData.additionalImages.length > 0 && (
												<div className="grid grid-cols-4 gap-2">
													{formData.additionalImages.map((url, idx) => (
														<div key={idx} className="aspect-square rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 relative group">
															<img src={getImageUrl(url)} className="w-full h-full object-cover" alt={`Img ${idx}`} />
															<button
																type="button"
																onClick={() => removeImage(idx)}
																className="absolute top-1 right-1 size-6 bg-red-500 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
															>
																<X size={12} />
															</button>
														</div>
													))}
												</div>
											)}
										</div>
									</div>
									<div>
										<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Địa chỉ</label>
										<div className="flex gap-2">
											<textarea
												rows={2}
												className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
												value={formData.address}
												onChange={(e) => setFormData({ ...formData, address: e.target.value })}
											/>
											<button
												type="button"
												onClick={handleGetLocation}
												disabled={gettingLocation}
												className="size-14 bg-[#1A237E] dark:bg-indigo-600 text-white rounded-2xl shrink-0 flex items-center justify-center hover:bg-black dark:hover:bg-indigo-800 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-blue-500/20"
											>
												<span className="material-symbols-outlined">{gettingLocation ? 'sync' : 'location_on'}</span>
											</button>
										</div>
									</div>
									<div>
										<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Ghi chú</label>
										<textarea
											rows={3}
											className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
											value={formData.note}
											placeholder="Thông tin thêm về khách hàng..."
											onChange={(e) => setFormData({ ...formData, note: e.target.value })}
										/>
									</div>
								</div>
								<div className="pt-4">
									<button
										type="submit"
										className="w-full bg-[#FF6D00] text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-[0.98]"
									>
										{showAddForm ? 'Xác nhận tạo hồ sơ' : 'Cập nhật thông tin'}
									</button>
								</div>
							</form>
						</div>
					</div>
				)
			}

			{/* DETAIL MODAL */}
			{
				showDetail && selectedCustomer && (
					<div className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm transition-all duration-500 overflow-hidden">
						<div className="absolute inset-0" onClick={() => setShowDetail(false)}></div>
						<div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl relative z-10 transition-all duration-500 animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 max-h-[90vh] sm:max-h-[85vh] overflow-y-auto custom-scrollbar border-t sm:border border-white/20 dark:border-slate-800">
							<div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mt-4 mb-2 sm:hidden"></div>
							<div className="px-6 sm:px-10 py-6 sm:pt-10 pb-20 sm:pb-12 flex flex-col items-center text-center relative">
								<div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-[#1A237E]/5 dark:from-indigo-500/5 to-transparent pointer-events-none"></div>
								<button onClick={() => setShowDetail(false)} className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 transition-all shadow-sm">
									<span className="material-symbols-outlined text-xl">close</span>
								</button>
								<div className="size-20 sm:size-28 rounded-[2rem] bg-[#1A237E] dark:bg-indigo-600 text-white flex items-center justify-center text-3xl sm:text-4xl font-black mb-6 shadow-2xl shadow-blue-500/30 ring-8 ring-white dark:ring-slate-900 relative z-10">
									{(selectedCustomer.name?.[0] || 'K').toUpperCase()}
								</div>
								<div className="space-y-1 mb-2 relative z-10">
									<h3 className="text-2xl sm:text-3xl font-black text-[#1A237E] dark:text-indigo-400 uppercase tracking-tight">{selectedCustomer.name}</h3>
									{selectedCustomer.businessName && (
										<p className="text-sm font-black text-slate-500 dark:text-slate-400 mb-2 relative z-10 flex items-center justify-center gap-1.5 uppercase">
											<span className="material-symbols-outlined text-base">domain</span>
											{selectedCustomer.businessName}
										</p>
									)}
								</div>
								<div className="w-full grid grid-cols-2 gap-3 sm:gap-4 mb-3 text-center">
									<div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col items-center shadow-sm">
										<p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest">Tuyến bán hàng</p>
										<p className="font-black text-indigo-600 dark:text-indigo-400 text-sm italic uppercase">{selectedCustomer.route || 'Chưa phân tuyến'}</p>
									</div>
									<div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col items-center shadow-sm">
										<p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest">Loại khách</p>
										<p className="font-black text-[#FF6D00] dark:text-orange-400 text-sm uppercase">{selectedCustomer.type}</p>
									</div>
								</div>
								<div className="w-full grid grid-cols-2 gap-3 sm:gap-4 mb-6 text-center">
									<div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col items-center shadow-sm">
										<p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest">Liên hệ</p>
										<a href={`tel:${selectedCustomer.phone}`} className="font-black text-[#1A237E] dark:text-indigo-300 text-sm hover:underline">{selectedCustomer.phone}</a>
									</div>
									<div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col items-center shadow-sm">
										<p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest">Trạng thái</p>
										<div className="flex items-center gap-1.5">
											<div className={`size-1.5 rounded-full ${selectedCustomer.status === 'Hoạt động' ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></div>
											<p className="font-black text-green-600 dark:text-green-400 text-sm uppercase">{selectedCustomer.status}</p>
										</div>
									</div>
								</div>
								<div className="w-full space-y-4 text-left">
									<div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 relative group">
										<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
											<div>
												<p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest flex items-center gap-1.5">
													<span className="material-symbols-outlined text-sm">location_on</span>
													Địa chỉ công trình
												</p>
												<p className="text-sm font-bold text-slate-700 dark:text-white leading-relaxed">{selectedCustomer.address || 'Chưa cung cấp'}</p>
											</div>
											{selectedCustomer.email && (
												<div>
													<p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest flex items-center gap-1.5">
														<span className="material-symbols-outlined text-sm">mail</span>
														Email khách hàng
													</p>
													<p className="text-sm font-bold text-slate-700 dark:text-white leading-relaxed truncate">{selectedCustomer.email}</p>
												</div>
											)}
										</div>
									</div>
									{/* Actions */}
									<div className="flex flex-wrap gap-3 pt-4 pb-2">
										{!!(selectedCustomer.lat && selectedCustomer.lng) && (
											<button onClick={() => { setShowDetail(false); setShowMap(true); }} className="flex-1 min-w-[140px] bg-green-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-green-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 h-14">
												<span className="material-symbols-outlined text-lg">map</span> Xem vị trí
											</button>
										)}
										<button onClick={() => { setShowDetail(false); openEdit(selectedCustomer); }} className="flex-1 min-w-[140px] bg-[#1A237E] dark:bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 h-14">
											<span className="material-symbols-outlined text-lg">edit_square</span> Sửa hồ sơ
										</button>
										<button onClick={() => handleDeleteCustomer(selectedCustomer.id)} className="flex-1 min-w-[140px] bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all active:scale-95 flex items-center justify-center gap-2 h-14">
											<span className="material-symbols-outlined text-lg">delete</span> Xóa khách
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				)
			}
			{showMap && <CustomerMap customers={customers} onClose={() => setShowMap(false)} />}
		</div >
	);
};

const TableSkeleton = () => (
	<>
		{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
			<tr key={i} className="animate-pulse">
				<td className="py-4 px-6">
					<div className="flex items-center gap-3">
						<div className="size-10 rounded-full skeleton" />
						<div className="space-y-2">
							<div className="w-40 h-4 skeleton" />
							<div className="w-20 h-3 skeleton opacity-50" />
						</div>
					</div>
				</td>
				<td className="py-4 px-6">
					<div className="w-24 h-4 skeleton" />
				</td>
				<td className="py-4 px-6">
					<div className="w-20 h-6 rounded-full skeleton" />
				</td>
				<td className="py-4 px-6">
					<div className="w-16 h-4 skeleton mx-auto" />
				</td>
				<td className="py-4 px-6">
					<div className="w-16 h-4 skeleton mx-auto opacity-50" />
				</td>
				<td className="py-4 px-6">
					<div className="flex justify-end gap-2">
						<div className="w-8 h-8 rounded-lg skeleton" />
						<div className="w-8 h-8 rounded-lg skeleton" />
					</div>
				</td>
			</tr>
		))}
	</>
);

const PageSkeleton = () => (
	<div className="min-h-screen bg-[#f8f9fb] dark:bg-slate-950 p-4 md:p-8 animate-pulse">
		<div className="max-w-[1400px] mx-auto space-y-8">
			<div className="flex justify-between items-center bg-white dark:bg-slate-900 h-20 px-8 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
				<div className="flex items-center gap-4">
					<div className="w-10 h-10 rounded-xl skeleton" />
					<div className="w-48 h-6 skeleton" />
				</div>
				<div className="flex gap-3">
					<div className="w-32 h-10 rounded-xl skeleton" />
					<div className="w-32 h-10 rounded-xl skeleton" />
				</div>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				{[1, 2, 3].map(i => <div key={i} className="h-32 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 skeleton" />)}
			</div>
			<div className="h-96 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 skeleton opacity-20" />
		</div>
	</div>
);

const StatCard = ({ icon, label, value, color }: any) => (
	<div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
		<div className={`p-2 ${color} w-fit rounded-lg mb-2`}>
			<span className="material-symbols-outlined text-lg">{icon}</span>
		</div>
		<p className="text-slate-500 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest">{label}</p>
		<h3 className="text-xl font-black text-slate-900 dark:text-indigo-400 leading-none mt-1">{value}</h3>
	</div>
);

export default CustomerList;
