import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import {
	collection, query, where, onSnapshot, doc, getDoc,
	setDoc, serverTimestamp, updateDoc, addDoc, orderBy, limit
} from '../services/firebase';
import { useOwner } from '../hooks/useOwner';
import {
	Clock, MapPin, CheckCircle, AlertCircle, Calendar,
	Smartphone, ArrowLeft, LogOut, Coffee, FileText, Send, X, Building, ChevronDown
} from 'lucide-react';
import { useToast } from '../components/shared/Toast';
import LeaveCalendar from '../components/shared/LeaveCalendar';
import MonthlyAttendanceCalendar from '../components/shared/MonthlyAttendanceCalendar';
import { createAdminNotification, createUserNotification } from '../utils/notifications';
import { useCustomers } from '../hooks/useCustomers';
import { notifyAttendanceEvent, notifySiteCheckinEvent, notifyLeaveRequestEvent } from '../utils/telegramNotify';
import { getGeolocationErrorMessage, getOfficeCoordinates } from '../utils/attendanceLocation';
import { getAppPlatformName, isAndroidNativeApp } from '../utils/platform';


const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
	const R = 6371e3; // meters
	const φ1 = lat1 * Math.PI / 180;
	const φ2 = lat2 * Math.PI / 180;
	const Δφ = (lat2 - lat1) * Math.PI / 180;
	const Δλ = (lon2 - lon1) * Math.PI / 180;
	const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
		Math.cos(φ1) * Math.cos(φ2) *
		Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const Attendance = () => {
	const navigate = useNavigate();
	const { search } = useLocation();
	const owner = useOwner();
	const { showToast } = useToast();

	const [companySettings, setCompanySettings] = useState<any>(null);
	const [todayLogs, setTodayLogs] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
	const [locationError, setLocationError] = useState<string | null>(null);
	const [distance, setDistance] = useState<number | null>(null);
	const [checking, setChecking] = useState(false);
	const [deviceId, setDeviceId] = useState('');
	const [showRequestModal, setShowRequestModal] = useState(false);
	const [requestData, setRequestData] = useState({ type: 'leave', note: '', selectedDates: [] as string[] });
	const supportedNativeLocationApp = isAndroidNativeApp() || getAppPlatformName().startsWith('macOS Native');

	const updateLocation = useCallback((position: GeolocationPosition) => {
		setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
		setLocationError(null);
	}, []);

	const requestLocation = useCallback(() => {
		if (!navigator.geolocation) {
			setLocationError('Thiết bị hoặc ứng dụng không hỗ trợ định vị.');
			return;
		}

		setLocationError(null);
		navigator.geolocation.getCurrentPosition(
			updateLocation,
			(error) => setLocationError(getGeolocationErrorMessage(error)),
			supportedNativeLocationApp
				? { enableHighAccuracy: false, timeout: 30000, maximumAge: 120000 }
				: { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
		);
	}, [supportedNativeLocationApp, updateLocation]);

	// GPS Attendance based on Customer / Project coordinates
	const [attendanceType, setAttendanceType] = useState<'store' | 'customer'>('store');
	const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
	const [customerQuery, setCustomerQuery] = useState('');
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const dropdownRef = React.useRef<HTMLDivElement>(null);

	const todayOfficeLog = todayLogs.find(l => l.type === 'store' || !l.type);
	const activeCustomerLog = todayLogs.find(l => l.type === 'customer' && !l.checkOutAt);
	const hasAnyCheckInToday = todayLogs.some(l => l.type === 'store' || !l.type || l.type === 'customer');
	const todayLog = attendanceType === 'customer' ? activeCustomerLog : todayOfficeLog;

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsDropdownOpen(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const { customers: rawCustomers } = useCustomers({
		ownerId: owner.ownerId || '',
		enabled: !owner.loading && !!owner.ownerId
	});

	const removeAccents = (str: string) => {
		return str
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/đ/g, 'd')
			.replace(/Đ/g, 'D');
	};

	const customersWithGps = React.useMemo(() => {
		return rawCustomers.map((c: any) => {
			const lat = typeof c.lat === 'number' ? c.lat : (c.lat ? parseFloat(c.lat) : null);
			const lng = typeof c.lng === 'number' ? c.lng : (c.lng ? parseFloat(c.lng) : null);
			return {
				...c,
				parsedLat: (lat !== null && !isNaN(lat)) ? lat : null,
				parsedLng: (lng !== null && !isNaN(lng)) ? lng : null,
			};
		}).filter((c: any) => c.parsedLat !== null && c.parsedLng !== null);
	}, [rawCustomers]);

	const distanceToSelectedCustomer = React.useMemo(() => {
		if (location && selectedCustomer) {
			const cLat = selectedCustomer.parsedLat ?? (typeof selectedCustomer.lat === 'number' ? selectedCustomer.lat : parseFloat(selectedCustomer.lat));
			const cLng = selectedCustomer.parsedLng ?? (typeof selectedCustomer.lng === 'number' ? selectedCustomer.lng : parseFloat(selectedCustomer.lng));
			if (!isNaN(cLat) && !isNaN(cLng)) {
				return getDistance(location.lat, location.lng, cLat, cLng);
			}
		}
		return null;
	}, [location, selectedCustomer]);

	const sortedCustomers = React.useMemo(() => {
		if (customersWithGps.length === 0) return [];
		if (location) {
			return [...customersWithGps]
				.map((c: any) => {
					const d = getDistance(location.lat, location.lng, c.parsedLat, c.parsedLng);
					return { ...c, distance: d };
				})
				.sort((a: any, b: any) => a.distance - b.distance);
		}
		// Khi chưa có vị trí GPS (đang định vị hoặc đang xin quyền), vẫn hiển thị đầy đủ danh sách khách hàng để người dùng chọn
		return [...customersWithGps].sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
	}, [location, customersWithGps]);

	const filteredSortedCustomers = React.useMemo(() => {
		if (!customerQuery) return sortedCustomers;
		const query = removeAccents(customerQuery).toLowerCase();
		return sortedCustomers.filter((c: any) => 
			removeAccents(c.name || '').toLowerCase().includes(query) ||
			(c.phone && c.phone.includes(query))
		);
	}, [sortedCustomers, customerQuery]);

	useEffect(() => {
		if (filteredSortedCustomers.length > 0 && !selectedCustomer) {
			setSelectedCustomer(filteredSortedCustomers[0]);
		}
	}, [filteredSortedCustomers, selectedCustomer]);

	useEffect(() => {
		if (filteredSortedCustomers.length > 0 && !todayLog) {
			const stillExists = filteredSortedCustomers.some(c => c.id === selectedCustomer?.id);
			if (!stillExists) {
				setSelectedCustomer(filteredSortedCustomers[0]);
			}
		}
	}, [filteredSortedCustomers, selectedCustomer, todayLog]);

	useEffect(() => {
		if (todayLog) {
			if (todayLog.type === 'customer') {
				if (todayLog.customerId && rawCustomers.length > 0) {
					const matched = rawCustomers.find(c => c.id === todayLog.customerId);
					if (matched) {
						setSelectedCustomer(matched);
					}
				}
				setAttendanceType('customer');
			} else {
				setAttendanceType('store');
			}
		}
	}, [todayLog, rawCustomers]);

	// Initialize Device ID
	useEffect(() => {
		let id = localStorage.getItem('dunvex_device_id');
		if (!id) {
			id = crypto.randomUUID();
			localStorage.setItem('dunvex_device_id', id);
		}
		setDeviceId(id);
	}, []);

	// Load Settings & Today's Log
	useEffect(() => {
		if (owner.loading || !owner.ownerId || !auth.currentUser) return;

		// 1. Fetch Company Settings (Location & Work Hours)
		const fetchSettings = async () => {
			const snap = await getDoc(doc(db, 'settings', owner.ownerId));
			if (snap.exists()) setCompanySettings(snap.data());
		};
		fetchSettings();

		// 2. Fetch Today's Log for current user
		const today = new Date().toISOString().split('T')[0];
		const q = query(
			collection(db, 'attendance_logs'),
			where('ownerId', '==', owner.ownerId),
			where('userId', '==', auth.currentUser.uid),
			where('date', '==', today)
		);

		const unsubscribe = onSnapshot(q, (snap) => {
			const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
			setTodayLogs(logs);
			setLoading(false);
		});

		// Native WebViews may issue a location permission request for each geolocation call.
		if (supportedNativeLocationApp) {
			requestLocation();
			return () => unsubscribe();
		}

		if ('geolocation' in navigator) {
			navigator.geolocation.getCurrentPosition(
				updateLocation,
				(err) => {
					console.warn('[Geolocation] getCurrentPosition error:', err.message);
					navigator.geolocation.getCurrentPosition(
						updateLocation,
						(e) => console.warn('[Geolocation] fallback error:', e.message),
						{ enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
					);
				},
				{ enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
			);

			const watchId = navigator.geolocation.watchPosition(
				updateLocation,
				(err) => console.warn('[Geolocation] watchPosition warning:', err.message),
				{ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
			);

			return () => {
				unsubscribe();
				navigator.geolocation.clearWatch(watchId);
			};
		}

		return () => {
			unsubscribe();
		};
	}, [owner.loading, owner.ownerId, requestLocation, updateLocation, supportedNativeLocationApp]);

	// Calculate distance when location or settings changes
	const officeCoordinates = supportedNativeLocationApp ? getOfficeCoordinates(companySettings) : null;
	useEffect(() => {
		if (location && supportedNativeLocationApp && officeCoordinates) {
			const d = getDistance(
				location.lat, location.lng,
				officeCoordinates.lat, officeCoordinates.lng
			);
			setDistance(d);
		} else if (location && !supportedNativeLocationApp && companySettings?.lat && companySettings?.lng) {
			setDistance(getDistance(location.lat, location.lng, companySettings.lat, companySettings.lng));
		} else {
			setDistance(null);
		}
	}, [location, supportedNativeLocationApp, officeCoordinates?.lat, officeCoordinates?.lng, companySettings?.lat, companySettings?.lng]);

	const hasCompanyGps = supportedNativeLocationApp
		? officeCoordinates !== null
		: companySettings && typeof companySettings.lat === 'number' && typeof companySettings.lng === 'number';
	const effectiveStoreDistance = hasCompanyGps ? distance : 0;
	const activeDistance = attendanceType === 'customer' ? distanceToSelectedCustomer : effectiveStoreDistance;
	const activeAllowedRadius = attendanceType === 'customer' ? 100 : (companySettings?.geofenceRadius || 500);

	const isWithinRange = activeDistance !== null && activeDistance <= activeAllowedRadius;
	const isLocationPending = supportedNativeLocationApp && !location && !locationError;
	const isWithinCheckOutRange = attendanceType === 'customer'
		? (distanceToSelectedCustomer !== null && distanceToSelectedCustomer <= 100)
		: (supportedNativeLocationApp && hasCompanyGps
			? distance !== null && distance <= ((companySettings?.geofenceRadius || 500) * 1.5)
			: ((distance !== null ? distance : 0) <= ((companySettings?.geofenceRadius || 500) * 1.5)));

	const handleCheckIn = async () => {
		if (!auth.currentUser) {
			showToast("Vui lòng đăng nhập lại để thực hiện chấm công", "warning");
			return;
		}
		if (!owner.ownerId) {
			showToast("Đang tải dữ liệu doanh nghiệp... Vui lòng thử lại sau vài giây", "warning");
			return;
		}
		if (!location) {
			showToast(supportedNativeLocationApp ? "Vui lòng cấp quyền định vị và bật Dịch vụ vị trí trên thiết bị để chấm công." : "Vui lòng bật định vị GPS trên thiết bị di động để chấm công!", "warning");
			return;
		}
		if (attendanceType === 'customer' && !selectedCustomer) {
			showToast("Vui lòng chọn khách hàng / công trình để chấm công", "warning");
			return;
		}
		if (activeDistance === null) {
			showToast("Đang xác định vị trí khoảng cách GPS, vui lòng bấm lại sau 2 giây", "warning");
			return;
		}
		if (hasCompanyGps && activeDistance > activeAllowedRadius) {
			showToast(`Bạn ở quá xa địa điểm chấm công (${Math.round(activeDistance)}m). Bán kính cho phép: ${activeAllowedRadius}m`, "warning");
			return;
		}

		setChecking(true);
		try {
			const now = new Date();
			const today = now.toISOString().split('T')[0];
			const localTimeStr = now.toLocaleTimeString('vi-VN', { hour12: false }) + ' ' + now.toLocaleDateString('vi-VN');

			let status = 'on-time';
			if (companySettings?.workStart) {
				const [h, m] = companySettings.workStart.split(':').map(Number);
				const workStart = new Date();
				workStart.setHours(h, m, 0);
				if (now > workStart) status = 'late';
			}

			const logData: any = {
				ownerId: owner.ownerId,
				userId: auth.currentUser.uid,
				userName: auth.currentUser.displayName || auth.currentUser.email,
				userEmail: auth.currentUser.email,
				date: today,
				clientCheckInAt: now.getTime(),
				checkInTimeStr: localTimeStr,
				checkInAt: now,
				location: location,
				deviceId: deviceId,
				deviceInfo: navigator.userAgent,
				status: status,
				type: attendanceType,
				createdAt: now
			};

			if (attendanceType === 'customer' && selectedCustomer) {
				logData.customerId = selectedCustomer.id;
				logData.customerName = selectedCustomer.name;
				logData.checkInDistance = Math.round(activeDistance || 0);
			} else {
				logData.checkInDistance = Math.round(activeDistance || 0);
			}

			await addDoc(collection(db, 'attendance_logs'), logData);

			// Gửi thông báo Telegram & n8n
			if (attendanceType === 'customer') {
				notifySiteCheckinEvent(owner.ownerId, {
					userName: auth.currentUser.displayName || auth.currentUser.email || 'Nhân viên',
					customerName: selectedCustomer?.name,
					time: localTimeStr,
					distance: Math.round(activeDistance),
					location: location,
					note: `Check-in tại công trình / khách hàng: ${selectedCustomer?.name}`
				}).catch(() => {});
			} else {
				notifyAttendanceEvent(owner.ownerId, {
					userName: auth.currentUser.displayName || auth.currentUser.email || 'Nhân viên',
					userEmail: auth.currentUser.email || '',
					action: 'checkin',
					time: localTimeStr,
					distance: Math.round(activeDistance),
					location: location,
					status: status
				}).catch(() => {});
			}

			showToast("Chấm công VÀO thành công!", "success");
		} catch (error: any) {
			showToast(error.message || "Lỗi khi chấm công", "error");
		} finally {
			setChecking(false);
		}
	};

	const handleCheckOut = async () => {
		if (!todayLog) {
			showToast("Không tìm thấy ca làm việc hôm nay để ra ca", "warning");
			return;
		}
		if (!location) {
			showToast(supportedNativeLocationApp ? "Vui lòng cấp quyền định vị và bật Dịch vụ vị trí trên thiết bị để thực hiện ra ca." : "Vui lòng bật định vị GPS trên thiết bị di động để thực hiện ra ca!", "warning");
			return;
		}

		setChecking(true);
		try {
			const now = new Date();
			const localTimeStr = now.toLocaleTimeString('vi-VN', { hour12: false }) + ' ' + now.toLocaleDateString('vi-VN');

			const updateData: any = {
				clientCheckOutAt: now.getTime(),
				checkOutTimeStr: localTimeStr,
				checkOutAt: now,
				checkOutLocation: location,
				updatedAt: now
			};

			let activeDist = distance !== null ? Math.round(distance) : undefined;
			if (todayLog.type === 'customer' && selectedCustomer) {
				const dist = getDistance(location.lat, location.lng, selectedCustomer.lat, selectedCustomer.lng);
				activeDist = Math.round(dist);
				updateData.checkOutDistance = activeDist;
			} else if (distance !== null) {
				updateData.checkOutDistance = activeDist;
			}

			await updateDoc(doc(db, 'attendance_logs', todayLog.id), updateData);

			// Gửi thông báo Telegram & n8n khi ra ca
			notifyAttendanceEvent(owner.ownerId, {
				userName: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
				userEmail: auth.currentUser?.email || '',
				action: 'checkout',
				time: localTimeStr,
				distance: activeDist,
				location: location,
				status: 'Đã hoàn thành ca làm việc'
			}).catch(() => {});

			showToast("Chấm công RA thành công!", "success");
		} catch (error: any) {
			showToast(error.message || "Lỗi khi chấm công", "error");
		} finally {
			setChecking(false);
		}
	};

	const handleRequestSubmit = async () => {
		if (requestData.type === 'leave' && requestData.selectedDates.length === 0) {
			return showToast("Vui lòng chọn ít nhất 1 ngày nghỉ trên lịch", "warning");
		}
		if (!requestData.note) return showToast("Vui lòng nhập lý do", "warning");
		setChecking(true);
		try {
			const today = new Date().toISOString().split('T')[0];
			const userName = auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên';
			const userEmail = auth.currentUser?.email || '';
			const userId = auth.currentUser?.uid || '';

			await addDoc(collection(db, 'attendance_logs'), {
				ownerId: owner.ownerId,
				userId,
				userName,
				userEmail,
				date: today,
				type: 'request',
				requestType: requestData.type,
				note: requestData.note,
				dates: requestData.type === 'leave' ? requestData.selectedDates : [today],
				status: 'pending',
				createdAt: serverTimestamp()
			});

			// Gửi thông báo Telegram & n8n
			notifyLeaveRequestEvent(owner.ownerId, {
				userName,
				userEmail,
				requestType: requestData.type as 'leave' | 'late',
				dates: requestData.type === 'leave' ? requestData.selectedDates : today,
				note: requestData.note
			}).catch(() => {});

			// Gửi thông báo cho admin
			const leaveLabel = requestData.type === 'leave' ? 'NGHỈ PHÉP' : 'ĐI MUỘN';
			const dateInfo = requestData.type === 'leave'
				? `${requestData.selectedDates.length} ngày (${requestData.selectedDates.join(', ')})`
				: `ngày ${today}`;

			await createAdminNotification(owner.ownerId, {
				title: `📋 Yêu cầu ${leaveLabel} mới`,
				body: `${userName} đã đăng ký ${leaveLabel} ${dateInfo}\nLý do: ${requestData.note}`,
				type: 'attendance_request',
				priority: 'high'
			});

			// Gửi thông báo xác nhận cho người gửi
			await createUserNotification(userId, {
				title: `✅ Đã gửi yêu cầu ${leaveLabel}`,
				body: `Yêu cầu ${leaveLabel.toLowerCase()} ${dateInfo} đã được gửi. Vui lòng chờ admin phê duyệt.`,
				type: 'attendance_request',
				priority: 'normal'
			});

			showToast("Gửi yêu cầu thành công! Admin sẽ được thông báo.", "success");
			setShowRequestModal(false);
			setRequestData({ type: 'leave', note: '', selectedDates: [] });
		} catch (error) {
			showToast("Lỗi khi gửi yêu cầu: " + error, "error");
		} finally {
			setChecking(false);
		}
	};


	// Handle URL Actions
	useEffect(() => {
		const params = new URLSearchParams(search);
		const action = params.get('action');
		if (action === 'checkin' && !loading && !checking && !todayLog) {
			handleCheckIn();
			navigate('/attendance', { replace: true });
		} else if (action === 'request' && !loading) {
			setShowRequestModal(true);
			navigate('/attendance', { replace: true });
		}
	}, [search, loading, todayLog, checking]);

	if (loading) return <div className="p-10 text-center font-bold">ĐANG TẢI...</div>;

	return (
		<div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-slate-950 transition-colors duration-300">
			<header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-8 shrink-0">
				<div className="flex items-center gap-4">
					<button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
						<ArrowLeft size={20} className="text-slate-500" />
					</button>
					<div>
						<h2 className="text-[#1A237E] dark:text-indigo-400 text-xl font-black uppercase tracking-tight">Chấm công Di động</h2>
						<p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dành cho nhân viên văn phòng</p>
					</div>
				</div>
				<div className="hidden md:flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
					<Smartphone size={16} className="text-indigo-600" />
					<span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Thiết bị: {deviceId.slice(0, 8)}</span>
				</div>
			</header>

			<div className="flex-1 overflow-y-auto p-4 md:p-10">
				<div className="max-w-md mx-auto space-y-6">

					{/* Status Card */}
					<div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm text-center">
						<div className="size-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto mb-6">
							<Clock size={40} />
						</div>
						<h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">{new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</h3>
						<p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

						<div className="grid grid-cols-2 gap-4">
							<div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
								<p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 text-left">Giờ vào</p>
								<p className="text-lg font-black text-emerald-600 text-left">{todayLog?.checkInAt ? new Date(todayLog.checkInAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
							</div>
							<div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
								<p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 text-left">Giờ ra</p>
								<p className="text-lg font-black text-orange-600 text-left">{todayLog?.checkOutAt ? new Date(todayLog.checkOutAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
							</div>
						</div>
					</div>

					{/* Attendance Type Selector */}
					<div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-1.5 grid grid-cols-2 gap-2">
						<button
							onClick={() => setAttendanceType('store')}
							className={`py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
								attendanceType === 'store'
									? 'bg-white text-[#1A237E] dark:bg-slate-700 dark:text-white shadow-sm'
									: 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
							}`}
						>
							🏢 Tại cửa hàng / VP
						</button>
						<button
							onClick={() => setAttendanceType('customer')}
							className={`py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
								attendanceType === 'customer'
									? 'bg-white text-[#1A237E] dark:bg-slate-700 dark:text-white shadow-sm'
									: 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
							}`}
						>
							🏗️ Tại Công trình / Khách
						</button>
					</div>

					{attendanceType === 'customer' && (
						<div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
							<div className="relative" ref={dropdownRef}>
								<label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 ml-1">Chọn Khách hàng / Công trình</label>
								
								<button
									type="button"
									disabled={!!todayLog}
									onClick={() => setIsDropdownOpen(!isDropdownOpen)}
									className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-75"
								>
									<span className="truncate">
										{selectedCustomer 
											? `${selectedCustomer.name} (${selectedCustomer.distance !== undefined ? `${Math.round(selectedCustomer.distance)}m` : 'Đang tính...'})`
											: 'Chọn Khách hàng / Công trình'
										}
									</span>
									<ChevronDown size={20} className="text-slate-400 shrink-0 ml-2" />
								</button>

								{isDropdownOpen && !todayLog && (
									<div className="absolute top-24 left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden flex flex-col">
										<div className="p-2 border-b border-slate-100 dark:border-slate-700">
											<input
												type="text"
												placeholder="🔍 Nhập tên hoặc SĐT để tìm..."
												value={customerQuery}
												onChange={(e) => setCustomerQuery(e.target.value)}
												className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-950 dark:text-white outline-none placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500"
											/>
										</div>
										<div className="overflow-y-auto max-h-48">
											{filteredSortedCustomers.length > 0 ? (
												filteredSortedCustomers.map((c: any) => (
													<button
														key={c.id}
														type="button"
														onClick={() => {
															setSelectedCustomer(c);
															setIsDropdownOpen(false);
														}}
														className={`w-full px-4 py-3 text-left text-xs font-bold transition-colors flex items-center justify-between border-b border-slate-50 dark:border-slate-700 last:border-b-0 ${
															selectedCustomer?.id === c.id
																? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
																: 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750'
														}`}
													>
														<span className="truncate mr-2">{c.name}</span>
														<span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
															{c.distance !== undefined ? `${Math.round(c.distance)}m` : 'Đang tính...'}
														</span>
													</button>
												))
											) : (
												<div className="p-4 text-center text-xs text-slate-400 font-bold">
													Không tìm thấy công trình phù hợp.
												</div>
											)}
										</div>
									</div>
								)}
							</div>
						</div>
					)}

					{/* Location Tracking */}
					<div className={`rounded-[2.5rem] p-6 border transition-all duration-500 ${isWithinRange ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800/50' : isLocationPending ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/50' : 'bg-rose-50/50 border-rose-200 dark:bg-rose-900/10 dark:border-rose-800/50'}`}>
						<div className="flex items-center gap-4">
							<div className={`p-3 rounded-2xl ${isWithinRange ? 'bg-emerald-500 text-white' : isLocationPending ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'}`}>
								{attendanceType === 'customer' ? <Building size={24} /> : <MapPin size={24} />}
							</div>
							<div className="flex-1">
								<p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Vị trí của bạn</p>
								<h4 className={`text-sm font-black ${isWithinRange ? 'text-emerald-700 dark:text-emerald-400' : isLocationPending ? 'text-amber-700 dark:text-amber-400' : 'text-rose-700 dark:text-rose-400'}`}>
									{supportedNativeLocationApp && !location
										? locationError ? 'Chưa lấy được vị trí GPS' : 'Đang xác định vị trí GPS'
										: isWithinRange
										? (attendanceType === 'customer' ? 'Phạm vi chấm công hợp lệ (<=100m)' : 'Đã vào khu vực văn phòng') 
										: (attendanceType === 'customer' ? 'Ngoài phạm vi công trình (>100m)' : 'Ngoài khu vực văn phòng')}
								</h4>
								<p className="text-[10px] font-bold text-slate-500 mt-1">
									{supportedNativeLocationApp && !location && locationError
										? locationError
										: attendanceType === 'customer' && selectedCustomer
										? `Khoảng cách tới ${selectedCustomer.name}: ${activeDistance !== null ? `${Math.round(activeDistance)}m` : 'Đang định vị...'}`
										: `Khoảng cách tới văn phòng: ${activeDistance !== null ? `${Math.round(activeDistance)}m` : 'Đang định vị...'}`
									}
								</p>
							</div>
							{supportedNativeLocationApp && !location ? (
								<button
									type="button"
									onClick={requestLocation}
									className="shrink-0 rounded-xl bg-white/80 p-2 text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-300"
									aria-label="Thử lấy lại vị trí GPS"
								>
									<MapPin size={20} />
								</button>
							) : isWithinRange ? (
								<CheckCircle size={24} className="text-emerald-500" />
							) : (
								<AlertCircle size={24} className="text-rose-500 animate-pulse" />
							)}
						</div>
					</div>

					{/* Action Buttons */}
					<div className="space-y-4">
						{/* Case: Đang ở tab Công trình nhưng có ca Cửa hàng chưa checkout */}
						{attendanceType === 'customer' && todayOfficeLog && !todayOfficeLog.checkOutAt && !activeCustomerLog ? (
							<div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-amber-200 dark:border-amber-800 text-center space-y-3">
								<p className="text-amber-600 font-black uppercase text-sm mb-1">Bạn đang có ca tại Cửa hàng / VP chưa checkout</p>
								<button
									onClick={() => setAttendanceType('store')}
									className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all"
								>
									<LogOut size={18} /> Chuyển về tab Cửa hàng để Checkout
								</button>
							</div>
						) : attendanceType === 'customer' && todayOfficeLog && todayOfficeLog.checkOutAt && !activeCustomerLog ? (
							/* Đã checkout cửa hàng xong → cho phép checkin công trình */
							<button
								onClick={handleCheckIn}
								disabled={!isWithinRange || checking || !selectedCustomer}
								className="w-full h-16 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-[2px] shadow-xl shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3"
							>
								{checking ? 'Đang xử lý...' : <><CheckCircle size={24} /> CHẤM CÔNG VÀO (Công trình)</>}
							</button>
						) : attendanceType === 'store' && activeCustomerLog ? (
							/* Đang ở tab Cửa hàng nhưng có ca Công trình chưa checkout */
							<div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-amber-200 dark:border-amber-800 text-center space-y-3">
								<p className="text-amber-600 font-black uppercase text-sm mb-1">Bạn đang có ca tại Công trình chưa checkout</p>
								<p className="text-xs text-slate-400 font-bold">Công trình: {activeCustomerLog.customerName || 'Không rõ'}</p>
								<button
									onClick={() => setAttendanceType('customer')}
									className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all"
								>
									<LogOut size={18} /> Chuyển về tab Công trình để Checkout
								</button>
							</div>
						) : attendanceType === 'store' && todayLogs.some(l => l.type === 'customer' && l.checkOutAt) && !todayOfficeLog ? (
							/* Đã checkout công trình xong → cho phép checkin cửa hàng */
							<button
								onClick={handleCheckIn}
								disabled={!isWithinRange || checking}
								className="w-full h-16 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-[2px] shadow-xl shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3"
							>
								{checking ? 'Đang xử lý...' : <><CheckCircle size={24} /> CHẤM CÔNG VÀO (Cửa hàng)</>}
							</button>
						) : !todayLog ? (
							<button
								onClick={handleCheckIn}
								disabled={!isWithinRange || checking}
								className="w-full h-16 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-[2px] shadow-xl shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3"
							>
								{checking ? 'Đang xử lý...' : <><CheckCircle size={24} /> CHẤM CÔNG VÀO</>}
							</button>
						) : !todayLog.checkOutAt ? (
							<button
								onClick={handleCheckOut}
								disabled={checking}
								className="w-full h-16 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black uppercase tracking-[2px] shadow-xl shadow-orange-500/20 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3"
							>
								{checking ? 'Đang xử lý...' : <><LogOut size={24} /> CHẤM CÔNG RA</>}
							</button>
						) : (
							<div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
								<p className="text-emerald-600 font-black uppercase text-sm mb-1">Đã hoàn thành chấm công ngày hôm nay</p>
								<p className="text-xs text-slate-400 font-bold">Hẹn gặp lại bạn vào ngày mai!</p>
							</div>
						)}

						<button
							onClick={() => setShowRequestModal(true)}
							className="w-full h-14 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black uppercase tracking-widest text-xs border border-slate-100 dark:border-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
						>
							<Coffee size={18} /> Đăng ký nghỉ / Đi muộn
						</button>

						{/* List of customer check-ins today */}
						{(() => {
							const todayCustomerLogs = todayLogs.filter(l => l.type === 'customer');
							if (attendanceType === 'customer' && todayCustomerLogs.length > 0) {
								return (
									<div className="bg-white dark:bg-slate-900 rounded-[2rem] p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3 mt-4">
										<h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block ml-1">Các điểm đã đi hôm nay ({todayCustomerLogs.length})</h4>
										<div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
											{todayCustomerLogs.map((log, index) => (
												<div key={index} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 px-4 py-3 rounded-xl border border-slate-150/20">
													<div className="flex-1 min-w-0 pr-2">
														<p className="text-xs font-black text-slate-800 dark:text-white truncate">{log.customerName || 'Công trình'}</p>
														<p className="text-[9px] text-slate-400 font-semibold mt-0.5">
															Vào: {log.checkInAt ? (log.checkInAt.toDate ? log.checkInAt.toDate() : new Date(log.checkInAt.seconds * 1000)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
															{log.checkOutAt && ` - Ra: ${(log.checkOutAt.toDate ? log.checkOutAt.toDate() : new Date(log.checkOutAt.seconds * 1000)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
														</p>
													</div>
													<span className={`text-[9px] font-black px-2 py-0.5 rounded ${log.checkOutAt ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 animate-pulse'}`}>
														{log.checkOutAt ? 'Đã hoàn thành' : 'Đang ở điểm'}
													</span>
												</div>
											))}
										</div>
									</div>
								);
							}
							return null;
						})()}
					</div>

					{/* Request Modal */}
					{showRequestModal && (
						<div className="fixed inset-0 z-[2000] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4">
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								onClick={() => setShowRequestModal(false)}
								className="absolute inset-0 bg-[#1A237E]/80 dark:bg-black/90 backdrop-blur-md"
							/>
							<motion.div
								initial={{ y: "100%", scale: 0.95 }}
								animate={{ y: 0, scale: 1 }}
								exit={{ y: "100%", scale: 0.95 }}
								transition={{ type: "spring", damping: 25, stiffness: 300 }}
								className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[3rem] md:rounded-[3rem] shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh] overflow-hidden relative z-10"
							>
								<div className="px-8 py-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0">
									<h4 className="text-xl font-black text-[#1A237E] dark:text-indigo-400 uppercase tracking-tight">ĐĂNG KÝ MỚI</h4>
									<button onClick={() => setShowRequestModal(false)} className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-all">
										<X size={18} />
									</button>
								</div>

								<div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar">
									{/* Type Selection */}
									<div>
										<label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px] mb-3 block">LOẠI ĐĂNG KÝ</label>
										<div className="grid grid-cols-2 gap-3">
											<button
												onClick={() => setRequestData({ ...requestData, type: 'leave' })}
												className={`py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
													requestData.type === 'leave'
														? 'bg-[#1A237E] dark:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
														: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
												}`}
											>
												NGHỈ PHÉP
											</button>
											<button
												onClick={() => setRequestData({ ...requestData, type: 'late' })}
												className={`py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
													requestData.type === 'late'
														? 'bg-[#1A237E] dark:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
														: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
												}`}
											>
												ĐI MUỘN
											</button>
										</div>
									</div>

									{/* Calendar - only for leave */}
									{requestData.type === 'leave' && (
										<motion.div
											initial={{ opacity: 0, height: 0 }}
											animate={{ opacity: 1, height: 'auto' }}
											exit={{ opacity: 0, height: 0 }}
										>
											<label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px] mb-3 block">CHỌN NGÀY NGHỈ</label>
											<div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
												<LeaveCalendar
													selectedDates={requestData.selectedDates}
													onDatesChange={(dates) => setRequestData(prev => ({ ...prev, selectedDates: dates }))}
												/>
											</div>
										</motion.div>
									)}

									{/* Reason */}
									<div>
										<label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px] mb-3 block">LÝ DO CỤ THỂ</label>
										<textarea
											className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 text-sm font-bold dark:text-white min-h-[100px] outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400 resize-none"
											placeholder="Nhập lý do..."
											value={requestData.note}
											onChange={(e) => setRequestData({ ...requestData, note: e.target.value })}
										/>
									</div>
								</div>

								{/* Submit Button */}
								<div className="px-6 md:px-8 pb-6 md:pb-8 pt-2 shrink-0">
									<button
										onClick={handleRequestSubmit}
										disabled={checking}
										className="w-full py-4 bg-[#FF6D00] hover:bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-[0.98]"
									>
										<Send size={18} /> {checking ? 'ĐANG GỬI...' : 'GỬI YÊU CẦU'}
									</button>
								</div>
							</motion.div>
						</div>
					)}

					<div className="mt-8">
						<MonthlyAttendanceCalendar ownerId={owner.ownerId} userId={auth.currentUser?.uid || ''} />
					</div>

					<div className="p-4 mt-8 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl">
						<p className="text-[9px] text-amber-700 dark:text-amber-500 leading-relaxed font-bold">
							* Lưu ý: Hệ thống khóa chấm công theo thiết bị. Vui lòng không thay đổi điện thoại hoặc trình duyệt khi đã bắt đầu ca làm việc.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Attendance;
