import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { collection, query, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, where, getDocs, writeBatch } from '../services/firebase';
import BulkImport from '../components/shared/BulkImport';
import CustomerMap from '../components/CustomerMap';

import { useOwner } from '../hooks/useOwner';
import { useCustomers } from '../hooks/useCustomers';
import { useScroll } from '../context/ScrollContext';
import { useToast } from '../components/shared/Toast';
import { CustomerSchema, getOptimizedImageUrl } from '../utils/validation';

import { CustomerHeader } from '../components/customers/CustomerHeader';
import { CustomerDesktopTable } from '../components/customers/CustomerDesktopTable';
import { CustomerPagination } from '../components/customers/CustomerPagination';
import { CustomerMobileList } from '../components/customers/CustomerMobileList';
import { CustomerFormModal } from '../components/customers/CustomerFormModal';
import { CustomerDetailModal } from '../components/customers/CustomerDetailModal';

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
	const [showTaxDetail, setShowTaxDetail] = useState(false);
	const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
	const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem('customers_searchTerm') || '');
	const [selectedRoute, setSelectedRoute] = useState(() => sessionStorage.getItem('customers_selectedRoute') || 'All');
	const [showMobileSearch, setShowMobileSearch] = useState(false);
	const searchInputRef = React.useRef<HTMLInputElement>(null!);
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState(() => Number(sessionStorage.getItem('customers_currentPage')) || 1);
	const ITEMS_PER_PAGE = 20;

	useEffect(() => {
		sessionStorage.setItem('customers_searchTerm', searchTerm);
		sessionStorage.setItem('customers_selectedRoute', selectedRoute);
		sessionStorage.setItem('customers_currentPage', currentPage.toString());
	}, [searchTerm, selectedRoute, currentPage]);

	useEffect(() => {
		const handleOpenSearch = () => {
			setShowMobileSearch(true);
			setTimeout(() => searchInputRef.current?.focus(), 200);
		};
		window.addEventListener('open-mobile-search', handleOpenSearch);
		return () => window.removeEventListener('open-mobile-search', handleOpenSearch);
	}, []);

	useEffect(() => {
		const handleOpenAdd = () => {
			setSelectedCustomer(undefined);
			setShowAddForm(true);
		};
		window.addEventListener('open-mobile-add', handleOpenAdd);
		return () => window.removeEventListener('open-mobile-add', handleOpenAdd);
	}, []);

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
		createdByEmail: '',
		lat: null as number | null,
		lng: null as number | null,
		licenseUrls: [] as string[],
		additionalImages: [] as string[],
		taxName: '',
		taxCode: '',
		taxAddress: '',
		taxPhone: '',
		creditLimit: 0
	});
	const [showTaxInfo, setShowTaxInfo] = useState(false);

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

	const handleGetLocation = async () => {
		setGettingLocation(true);

		const processCoordinates = async (latitude: number, longitude: number) => {
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
				setFormData(prev => ({ ...prev, address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` }));
			} finally {
				setGettingLocation(false);
				showToast("Đã lấy vị trí hiện tại thành công!", "success");
			}
		};

		// 1. Try Capacitor Geolocation plugin if running in Capacitor App
		const CapGeo = (window as any).Capacitor?.Plugins?.Geolocation;
		if (CapGeo) {
			try {
				const pos = await CapGeo.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
				if (pos?.coords) {
					await processCoordinates(pos.coords.latitude, pos.coords.longitude);
					return;
				}
			} catch (capErr: any) {
				console.warn('Capacitor Geolocation failed, fallback to Web Geolocation API:', capErr);
			}
		}

		if (!navigator.geolocation) {
			showToast("Trình duyệt không hỗ trợ định vị", "error");
			setGettingLocation(false);
			return;
		}

		// 2. Try Web Geolocation API with high accuracy
		navigator.geolocation.getCurrentPosition(
			(position) => {
				processCoordinates(position.coords.latitude, position.coords.longitude);
			},
			(error) => {
				// 3. Fallback: try low accuracy (Wi-Fi / IP) if high accuracy timed out or failed indoors
				navigator.geolocation.getCurrentPosition(
					(position) => {
						processCoordinates(position.coords.latitude, position.coords.longitude);
					},
					(errFallback) => {
						setGettingLocation(false);
						let msg = "Không thể lấy vị trí. Vui lòng bật vị trí GPS/Wi-Fi trong cài đặt trình duyệt.";
						if (errFallback.code === 1) msg = "Trình duyệt đã bị từ chối quyền vị trí. Vui lòng cho phép truy cập vị trí trên thanh địa chỉ trình duyệt.";
						else if (errFallback.code === 2) msg = "Không tìm thấy tín hiệu vị trí.";
						else if (errFallback.code === 3) msg = "Hết thời gian lấy vị trí.";
						showToast(msg, "warning");
					},
					{ enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
				);
			},
			{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
		);
	};

	const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'license' | 'additional') => {
		const files = e.target.files;
		if (!files || files.length === 0) return;

		if (type === 'license') setUploadingLicense(true);
		else setUploadingImages(true);

		try {
			const { uploadImageToVPS } = await import('../utils/vpsUpload');
			const uploadPromises = Array.from(files).map(async (file) => {
				return await uploadImageToVPS(file);
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

	const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
	
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearchTerm(searchTerm);
			setCurrentPage(1); // Reset page on search change
		}, 300);
		return () => clearTimeout(timer);
	}, [searchTerm]);

	// 🔧 REFACTOR: Sử dụng useCustomers hook thay vì raw onSnapshot
	const { customers: hookCustomers, totalItems, totalPages, loading: hookLoading, error: hookError } = useCustomers({
		ownerId: owner.ownerId,
		enabled: !owner.loading && !!owner.ownerId,
		isPaginated: true,
		page: currentPage,
		pageSize: ITEMS_PER_PAGE,
		searchKeyword: debouncedSearchTerm
	});

	// Sync hook data to local state
	useEffect(() => {
		setCustomers(hookCustomers);
		setLoading(hookLoading);
	}, [hookCustomers, hookLoading]);

	// Show error toast when hook fails
	useEffect(() => {
		if (hookError) {
			console.error("Lỗi khi tải dữ liệu khách hàng:", hookError);
			showToast("Không thể tải dữ liệu: " + hookError.message, "error");
		}
	}, [hookError]);

	const { search, state } = useLocation();
	useEffect(() => {
		const params = new URLSearchParams(search);
		if (params.get('new') === 'true') {
			resetForm();
			
			
			if (state?.prefill) {
				const data = state.prefill;
				setFormData(prev => ({
					...prev,
					name: data.name || '',
					phone: data.phone || '',
					address: data.address || ''
				}));
				showToast("Đã nhập thông tin khách!", "success");
			}
			
			setShowAddForm(true);
			navigate(window.location.pathname + window.location.search, { state: { modalOpen: true } });
			// Xóa param và state khỏi URL để tránh lặp lại khi refresh
			navigate('/customers', { replace: true, state: {} });
		}
		if (params.get('search') === 'true' || params.get('search') === 'focus') {
			setShowMobileSearch(true);
			setTimeout(() => searchInputRef.current?.focus(), 200);
			navigate('/customers', { replace: true, state: {} });
		}
		if (params.get('map') === 'true') {
			setShowMap(true);
			navigate(window.location.pathname + window.location.search, { state: { modalOpen: true } });
			navigate('/customers', { replace: true, state: {} });
		}
		if (params.get('import') === 'true') {
			setShowImport(true);
			navigate(window.location.pathname + window.location.search, { state: { modalOpen: true } });
			navigate('/customers', { replace: true, state: {} });
		}
	}, [search, state, navigate]);

	useEffect(() => {
		if (showMobileSearch && searchInputRef.current) {
			searchInputRef.current.focus();
		}
	}, [showMobileSearch]);

	useEffect(() => {
		setCurrentPage(1);
	}, [searchTerm, selectedRoute]);

	// Track modal state for back button
	const showDetailRef = useRef(showDetail);
	const showAddFormRef = useRef(showAddForm);
	const showEditFormRef = useRef(showEditForm);
	const showImportRef = useRef(showImport);
	const showMapRef = useRef(showMap);

	useEffect(() => { showDetailRef.current = showDetail; }, [showDetail]);
	useEffect(() => { showAddFormRef.current = showAddForm; }, [showAddForm]);
	useEffect(() => { showEditFormRef.current = showEditForm; }, [showEditForm]);
	useEffect(() => { showImportRef.current = showImport; }, [showImport]);
	useEffect(() => { showMapRef.current = showMap; }, [showMap]);

	// Handle browser back button — close modal
	useEffect(() => {
		const handlePopState = () => {
			if (showDetailRef.current) {
				setShowDetail(false);
			}
			if (showAddFormRef.current) {
				setShowAddForm(false);
			}
			if (showEditFormRef.current) {
				setShowEditForm(false);
			}
			if (showImportRef.current) {
				setShowImport(false);
			}
			if (showMapRef.current) {
				setShowMap(false);
			}
		};
		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	}, []);

	// Auto-reset form state when form is closed
	useEffect(() => {
		if (!showAddForm && !showEditForm) {
			resetForm();
		}
	}, [showAddForm, showEditForm]);

	const handleAddCustomer = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const validationData = {
				...formData,
				ownerId: owner.ownerId,
				createdByEmail: formData.createdByEmail || auth.currentUser?.email || ''
			};

			const result = CustomerSchema.safeParse(validationData);
			if (!result.success) {
				console.warn("Customer validation failed:", result.error.format());
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
				userId: auth.currentUser?.uid || "",
				ownerId: owner.ownerId,
				details: `Đã thêm khách hàng: ${formData.name} - SĐT: ${formData.phone}`,
				createdAt: serverTimestamp()
			});

			window.history.back();
			showToast("Thêm khách hàng thành công", "success");
		} catch (error: any) {
			console.error("Add customer error:", error);
			showToast("Lỗi khi thêm khách hàng: " + (error.message || ""), "error");
		}
	};

	const handleUpdateCustomer = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedCustomer) return;
		try {
			const validationData = {
				...formData,
				ownerId: owner.ownerId,
				createdByEmail: formData.createdByEmail || selectedCustomer.createdByEmail || auth.currentUser?.email || ''
			};

			const result = CustomerSchema.safeParse(validationData);
			if (!result.success) {
				const firstError = result.error.issues[0]?.message || "Dữ liệu không hợp lệ";
				showToast(firstError, "warning");
				return;
			}

			const validatedData = result.data;

			// Đảm bảo các trường tax luôn có giá trị (tránh undefined)
			const updatePayload = {
				...validatedData,
				taxName: validatedData.taxName || '',
				taxCode: validatedData.taxCode || '',
				taxAddress: validatedData.taxAddress || '',
				taxPhone: validatedData.taxPhone || '',
				updatedAt: serverTimestamp(),
				updatedBy: auth.currentUser?.uid
			};

			await updateDoc(doc(db, 'customers', selectedCustomer.id), updatePayload);

			// Log Update Customer
			await addDoc(collection(db, 'audit_logs'), {
				action: 'Cập nhật khách hàng',
				user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
				userId: auth.currentUser?.uid || "",
				ownerId: owner.ownerId,
				details: `Đã cập nhật thông tin khách hàng: ${formData.name}`,
				createdAt: serverTimestamp()
			});

			window.history.back();
			showToast("Cập nhật thành công", "success");
		} catch (error: any) {
			console.error("Update customer error:", error);
			showToast("Lỗi khi cập nhật: " + (error.message || "Vui lòng kiểm tra lại dữ liệu"), "error");
		}
	};

	const handleDeleteCustomer = async (id: string, bypassConfirm = false) => {
		if (bypassConfirm || window.confirm("Bạn có chắc chắn muốn xóa khách hàng này không? (Lịch sử thu nợ liên quan cũng sẽ được dọn dẹp)")) {
			try {
				const customer = customers.find(c => c.id === id);
				const customerName = customer?.name || 'Khách hàng';

				// 1. Xóa doc khách hàng
				await deleteDoc(doc(db, 'customers', id));

				// 2. Tìm và dọn dẹp các phiếu thu tiền và công nợ liên quan của khách hàng này
				try {
					const [paySnap, debtSnap] = await Promise.all([
						getDocs(query(collection(db, 'payments'), where('ownerId', '==', owner.ownerId), where('customerId', '==', id))),
						getDocs(query(collection(db, 'debts'), where('ownerId', '==', owner.ownerId), where('customerId', '==', id)))
					]);

					const batch = writeBatch(db);
					paySnap.docs.forEach((d: any) => batch.delete(d.ref));
					debtSnap.docs.forEach((d: any) => batch.delete(d.ref));
					await batch.commit();
				} catch (cleanErr) {
					console.warn("Lỗi dọn dẹp phiếu thu phụ:", cleanErr);
				}

				// Log Delete Customer
				await addDoc(collection(db, 'audit_logs'), {
					action: 'Xóa khách hàng',
					user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
					userId: auth.currentUser?.uid || "",
					ownerId: owner.ownerId,
					details: `Đã xóa khách hàng: ${customerName}`,
					createdAt: serverTimestamp()
				});

				setShowDetail(false);
				showToast("Đã xóa khách hàng và dọn dẹp lịch sử thu nợ liên quan", "success");
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
			createdByEmail: '',
			lat: null,
			lng: null,
			licenseUrls: [],
			additionalImages: [],
			taxName: '',
			taxCode: '',
			taxAddress: '',
			taxPhone: '',
			creditLimit: 0
		});
		setShowTaxInfo(false);
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
			createdByEmail: customer.createdByEmail || '',
			lat: customer.lat || null,
			lng: customer.lng || null,
			licenseUrls: customer.licenseUrls || (customer.licenseUrl ? [customer.licenseUrl] : []),
			additionalImages: customer.additionalImages || [],
			taxName: customer.taxName || '',
			taxCode: customer.taxCode || '',
			taxAddress: customer.taxAddress || '',
			taxPhone: customer.taxPhone || '',
			creditLimit: customer.creditLimit || 0
		});
		setShowTaxInfo(!!(customer.taxName || customer.taxCode || customer.taxAddress || customer.taxPhone));
		setShowEditForm(true);
		navigate(window.location.pathname + window.location.search, { state: { modalOpen: true } });
	};

	const openDetail = (customer: any) => {
		setSelectedCustomer(customer);
		setShowTaxDetail(false);
		setShowDetail(true);
		navigate(window.location.pathname + window.location.search, { state: { modalOpen: true } });
	};

	const filteredCustomers = customers.filter(c => {
		const matchesRoute = selectedRoute === 'All' || c.route === selectedRoute;
		return matchesRoute;
	});

	const paginatedCustomers = filteredCustomers;

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
				<button onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/')} className="mt-6 bg-[#1A237E] text-white px-6 py-2 rounded-xl font-bold">Quay lại</button>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-slate-950 transition-colors duration-300">
			<CustomerHeader 
				showMobileSearch={showMobileSearch}
				setShowMobileSearch={setShowMobileSearch}
				selectedRoute={selectedRoute}
				setSelectedRoute={setSelectedRoute}
				salesRoutes={salesRoutes}
				searchTerm={searchTerm}
				setSearchTerm={setSearchTerm}
				searchInputRef={searchInputRef}
				setShowImport={(val) => {
					setShowImport(val);
					if (val) navigate(window.location.pathname + window.location.search, { state: { modalOpen: true } });
				}}
				setShowMap={(val) => {
					setShowMap(val);
					if (val) navigate(window.location.pathname + window.location.search, { state: { modalOpen: true } });
				}}
				resetForm={resetForm}
				setShowAddForm={(val) => {
					setShowAddForm(val);
					if (val) navigate(window.location.pathname + window.location.search, { state: { modalOpen: true } });
				}}
			/>

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
				<div className="grid grid-cols-2 gap-4 mb-8">
					<StatCard icon="group" label="Tổng khách" value={totalItems.toString()} color="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" />
					<StatCard icon="person_add" label="Khách mới trong tháng" value={(() => {
						const now = new Date();
						const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
						return customers.filter(c => {
							const created = c.createdAt?.seconds ? c.createdAt.seconds * 1000 : c.createdAt ? new Date(c.createdAt).getTime() : 0;
							return created >= monthStart;
						}).length.toString();
					})()} color="bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400" />
				</div>

				<CustomerDesktopTable
					loading={loading}
					paginatedCustomers={paginatedCustomers}
					openDetail={openDetail}
					deleteConfirmId={deleteConfirmId}
					setDeleteConfirmId={setDeleteConfirmId}
					handleDeleteCustomer={handleDeleteCustomer}
					openEdit={openEdit}
				/>

                <CustomerPagination
                    loading={loading}
                    totalPages={totalPages}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                    getPageNumbers={getPageNumbers}
                    filteredCustomersLength={totalItems}
                    ITEMS_PER_PAGE={ITEMS_PER_PAGE}
                />

				<CustomerMobileList
					loading={loading}
					paginatedCustomers={paginatedCustomers}
					openDetail={openDetail}
				/>
			</div>

			<CustomerFormModal
				showAddForm={showAddForm}
				showEditForm={showEditForm}
				setShowAddForm={(val) => {
					if (!val) window.history.back();
					else setShowAddForm(val);
				}}
				setShowEditForm={(val) => {
					if (!val) window.history.back();
					else setShowEditForm(val);
				}}
				formData={formData}
				setFormData={setFormData}
				handleAddCustomer={handleAddCustomer}
				handleUpdateCustomer={handleUpdateCustomer}
				customerTypes={customerTypes}
				uploadingLicense={uploadingLicense}
				uploadingImages={uploadingImages}
				handleImageUpload={handleImageUpload}
				removeLicense={removeLicense}
				removeImage={removeImage}
				gettingLocation={gettingLocation}
				handleGetLocation={handleGetLocation}
				showTaxInfo={showTaxInfo}
				setShowTaxInfo={setShowTaxInfo}
				getImageUrl={getImageUrl}
			/>

			<CustomerDetailModal
				showDetail={showDetail}
				setShowDetail={(val) => {
					if (!val) window.history.back();
					else setShowDetail(val);
				}}
				selectedCustomer={selectedCustomer}
				showTaxDetail={showTaxDetail}
				setShowTaxDetail={setShowTaxDetail}
				openEdit={openEdit}
				handleDeleteCustomer={handleDeleteCustomer}
				showToast={showToast as any}
			/>

			{showMap && <CustomerMap customers={customers} onClose={() => window.history.back()} />}
		</div>
	);
};

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
