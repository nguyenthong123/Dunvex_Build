import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, where } from 'firebase/firestore';
import BulkImport from '../components/shared/BulkImport';

import { useOwner } from '../hooks/useOwner';

const CustomerList = () => {
	const navigate = useNavigate();
	const owner = useOwner();

	const [customers, setCustomers] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [showAddForm, setShowAddForm] = useState(false);
	const [showImport, setShowImport] = useState(false);
	const [showEditForm, setShowEditForm] = useState(false);
	const [showDetail, setShowDetail] = useState(false);
	const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
	const [searchTerm, setSearchTerm] = useState('');
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
		lat: null as number | null,
		lng: null as number | null
	});

	const [gettingLocation, setGettingLocation] = useState(false);


	// Get unique types from existing customers for the suggestions
	const customerTypes = Array.from(new Set([
		'Chủ nhà', 'Nhà thầu', 'Kiến trúc sư', 'Đại lý',
		...customers.map(c => c.type).filter(Boolean)
	]));

	const handleGetLocation = () => {
		setGettingLocation(true);
		if (!navigator.geolocation) {
			alert("Trình duyệt của bạn không hỗ trợ định vị");
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
			alert("Không thể lấy vị trí. Vui lòng cấp quyền truy cập GPS.");
			setGettingLocation(false);
		});
	};

	useEffect(() => {
		if (owner.loading || !owner.ownerId) return;

		const q = query(
			collection(db, 'customers'),
			where('ownerId', '==', owner.ownerId)
		);
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
	}, [owner.loading, owner.ownerId]);

	const { search } = useLocation();
	useEffect(() => {
		const params = new URLSearchParams(search);
		if (params.get('new') === 'true') {
			resetForm();
			setShowAddForm(true);
			navigate('/customers', { replace: true });
		}
	}, [search, navigate]);

	const handleAddCustomer = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			if (!formData.name || !formData.phone) {
				alert("Vui lòng nhập tên và số điện thoại");
				return;
			}
			await addDoc(collection(db, 'customers'), {
				...formData,
				createdAt: serverTimestamp(),
				ownerId: owner.ownerId,
				ownerEmail: owner.ownerEmail,
				createdBy: auth.currentUser?.uid,
				createdByEmail: auth.currentUser?.email
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
		} catch (error) {
			alert("Lỗi khi thêm khách hàng");
		}
	};

	const handleUpdateCustomer = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedCustomer) return;
		try {
			await updateDoc(doc(db, 'customers', selectedCustomer.id), {
				...formData,
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
		} catch (error) {
			alert("Lỗi khi cập nhật khách hàng");
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
			} catch (error) {
				alert("Lỗi khi xóa khách hàng");
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
			lat: null,
			lng: null
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
			lat: customer.lat || null,
			lng: customer.lng || null
		});
		setShowEditForm(true);
	};

	const openDetail = (customer: any) => {
		setSelectedCustomer(customer);
		setShowDetail(true);
	};

	const filteredCustomers = customers.filter(c =>
		String(c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
		String(c.phone || '').includes(searchTerm) ||
		String(c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
	);

	const hasManagePermission = owner.role === 'admin' || (owner.accessRights?.customers_manage ?? true);

	if (owner.loading) return null;

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
			<header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 h-16 md:h-20 flex items-center justify-between px-4 md:px-8 shrink-0 transition-colors duration-300">
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
				<div className="flex items-center gap-4">
					<div className="hidden md:relative md:block">
						<span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">search</span>
						<input
							type="text"
							placeholder="Tìm khách hàng..."
							className="pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#FF6D00]/30 w-64 transition-all text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					</div>
					<button
						onClick={() => setShowImport(true)}
						className="hidden md:flex bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-4 py-2.5 rounded-xl font-bold border border-slate-200 dark:border-slate-800 transition-all items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700"
					>
						<span className="material-symbols-outlined">file_upload</span>
						<span className="hidden sm:inline">Nhập Excel</span>
					</button>
					<button
						onClick={() => { resetForm(); setShowAddForm(true); }}
						className="bg-[#FF6D00] hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2"
					>
						<span className="material-symbols-outlined">person_add</span>
						<span className="hidden sm:inline">Thêm mới</span>
					</button>
				</div>
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
			<div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">
				{/* Stats Cards */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
					<StatCard icon="group" label="Tổng khách" value={customers.length.toString()} color="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" />
					<StatCard icon="person_add" label="Khách mới" value="12" color="bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400" />
					<StatCard icon="verified" label="VIP" value="5" color="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400" />
					<StatCard icon="location_on" label="Vị trí" value="8" color="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" />
				</div>

				{/* Desktop Table */}
				<div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
					<table className="w-full text-left">
						<thead>
							<tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
								<th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">Khách hàng</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">Liên hệ</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">Phân loại</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-center">Trạng thái</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-right">Hành động</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100 dark:divide-slate-800">
							{loading ? (
								<tr><td colSpan={5} className="py-8 text-center text-slate-400 dark:text-slate-500 font-medium">Đang tải dữ liệu...</td></tr>
							) : filteredCustomers.length === 0 ? (
								<tr><td colSpan={5} className="py-12 text-center text-slate-400 dark:text-slate-500 font-medium tracking-wide">Không tìm thấy khách hàng nào</td></tr>
							) : filteredCustomers.map((customer) => (
								<tr key={customer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => openDetail(customer)}>
									<td className="py-4 px-6">
										<div className="flex items-center gap-3">
											<div className="size-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-black text-xs border border-blue-200 dark:border-blue-800">
												{(customer.name?.[0] || 'K').toUpperCase()}
											</div>
											<div>
												<div className="font-black text-slate-900 dark:text-indigo-400 uppercase tracking-tight">{customer.name}</div>
												<div className="text-[10px] text-slate-500 dark:text-slate-500 font-black tracking-widest">#{customer.id.slice(-6)}</div>
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

				{/* Mobile List */}
				<div className="md:hidden space-y-4 pb-24">
					{filteredCustomers.map((customer) => (
						<div key={customer.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-800" onClick={() => openDetail(customer)}>
							<div className="flex justify-between items-start mb-3">
								<div className="flex items-center gap-3">
									<div className="size-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold">
										{(customer.name?.[0] || 'K').toUpperCase()}
									</div>
									<div>
										<div className="font-black text-[#1A237E] dark:text-indigo-400">{customer.name}</div>
										<div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{customer.phone}</div>
									</div>
								</div>
								<span className="px-2 py-1 rounded-lg text-[9px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 uppercase">
									{customer.status}
								</span>
							</div>
							<div className="flex justify-between items-center pt-2 border-t border-gray-50 dark:border-slate-800">
								<span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded uppercase tracking-wider">{customer.type}</span>
								<span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">#{customer.id.slice(-6)}</span>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* ADD/EDIT MODAL */}
			{/* ADD/EDIT MODAL */}
			{(showAddForm || showEditForm) && (
				<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#1A237E]/80 dark:bg-black/80 backdrop-blur-sm">
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
								<div className="grid grid-cols-2 gap-4">
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
			)}

			{/* DETAIL MODAL */}
			{showDetail && selectedCustomer && (
				<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#1A237E]/80 dark:bg-black/80 backdrop-blur-sm">
					<div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden transition-colors duration-300">
						<div className="px-8 py-10 flex flex-col items-center text-center relative overflow-hidden">
							<div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-50/50 dark:from-blue-900/20 to-transparent"></div>
							<button onClick={() => setShowDetail(false)} className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 transition-all">
								<span className="material-symbols-outlined">close</span>
							</button>

							<div className="size-24 rounded-full bg-[#1A237E] dark:bg-indigo-600 text-white flex items-center justify-center text-3xl font-black mb-4 shadow-xl ring-4 ring-white dark:ring-slate-800 relative z-10">
								{(selectedCustomer.name?.[0] || 'K').toUpperCase()}
							</div>
							<h3 className="text-2xl font-black text-[#1A237E] dark:text-indigo-400 mb-1 relative z-10">{selectedCustomer.name}</h3>
							{selectedCustomer.businessName && (
								<p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 relative z-10">🏢 {selectedCustomer.businessName}</p>
							)}
							<div className="px-4 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-[#FF6D00] dark:text-orange-400 text-[10px] font-black rounded-full uppercase tracking-widest mb-6 relative z-10">
								{selectedCustomer.type}
							</div>

							<div className="w-full grid grid-cols-2 gap-4 mb-8">
								<div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col items-center">
									<p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1 tracking-widest">Liên hệ</p>
									<p className="font-bold text-[#1A237E] dark:text-indigo-300">{selectedCustomer.phone}</p>
								</div>
								<div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col items-center">
									<p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1 tracking-widest">Trạng thái</p>
									<p className="font-bold text-green-600 dark:text-green-400">{selectedCustomer.status}</p>
								</div>
							</div>

							<div className="w-full space-y-4 text-left">
								<div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 relative group">
									<p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Địa chỉ công trình</p>
									<p className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-relaxed">{selectedCustomer.address || 'Chưa cung cấp'}</p>
								</div>

								{selectedCustomer.note && (
									<div className="bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100/50 dark:border-blue-900/30">
										<p className="text-[10px] font-black text-blue-400 uppercase mb-2 tracking-widest">Ghi chú nhu cầu</p>
										<p className="text-sm font-bold text-blue-800 dark:text-blue-300 leading-relaxed italic">"{selectedCustomer.note}"</p>
									</div>
								)}

								<div className="grid grid-cols-2 gap-3 pt-6">
									<button onClick={() => { setShowDetail(false); openEdit(selectedCustomer); }} className="flex-1 bg-[#1A237E] dark:bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
										<span className="material-symbols-outlined text-sm">edit_square</span> Sửa hồ sơ
									</button>
									<button onClick={() => handleDeleteCustomer(selectedCustomer.id)} className="flex-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-100 dark:hover:bg-red-900/30 transition-all active:scale-95 flex items-center justify-center gap-2">
										<span className="material-symbols-outlined text-sm">delete</span> Xóa khách
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

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
