import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import {
	collection, query, where, onSnapshot, doc, getDoc,
	setDoc, serverTimestamp, updateDoc, addDoc, orderBy, limit
} from 'firebase/firestore';
import { useOwner } from '../hooks/useOwner';
import {
	Clock, MapPin, CheckCircle, AlertCircle, Calendar,
	Smartphone, ArrowLeft, LogOut, Coffee, FileText, Send, X
} from 'lucide-react';
import { useToast } from '../components/shared/Toast';
import LeaveCalendar from '../components/shared/LeaveCalendar';
import { createAdminNotification, createUserNotification } from '../utils/notifications';

const Attendance = () => {
	const navigate = useNavigate();
	const { search } = useLocation();
	const owner = useOwner();
	const { showToast } = useToast();

	const [companySettings, setCompanySettings] = useState<any>(null);
	const [todayLog, setTodayLog] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
	const [distance, setDistance] = useState<number | null>(null);
	const [checking, setChecking] = useState(false);
	const [deviceId, setDeviceId] = useState('');
	const [showRequestModal, setShowRequestModal] = useState(false);
	const [requestData, setRequestData] = useState({ type: 'leave', note: '', selectedDates: [] as string[] });

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
			if (!snap.empty) {
				setTodayLog({ id: snap.docs[0].id, ...snap.docs[0].data() });
			} else {
				setTodayLog(null);
			}
			setLoading(false);
		});

		// 3. Keep tracking user location
		const watchId = navigator.geolocation.watchPosition(
			(pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
			(err) => console.error(err),
			{ enableHighAccuracy: true }
		);

		return () => {
			unsubscribe();
			navigator.geolocation.clearWatch(watchId);
		};
	}, [owner.loading, owner.ownerId]);

	// Calculate distance when location or settings changes
	useEffect(() => {
		if (location && companySettings?.lat && companySettings?.lng) {
			const d = getDistance(
				location.lat, location.lng,
				companySettings.lat, companySettings.lng
			);
			setDistance(d);
		}
	}, [location, companySettings]);

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

	const handleCheckIn = async () => {
		if (!location || !distance || !owner.ownerId || !auth.currentUser) return;
		if (distance > (companySettings.geofenceRadius || 100)) {
			showToast(`Bạn ở quá xa văn phòng (${Math.round(distance)}m).`, "warning");
			return;
		}

		setChecking(true);
		try {
			const today = new Date().toISOString().split('T')[0];
			const now = new Date();

			// Simple status check
			let status = 'on-time';
			if (companySettings.workStart) {
				const [h, m] = companySettings.workStart.split(':').map(Number);
				const workStart = new Date();
				workStart.setHours(h, m, 0);
				if (now > workStart) status = 'late';
			}

			await addDoc(collection(db, 'attendance_logs'), {
				ownerId: owner.ownerId,
				userId: auth.currentUser.uid,
				userName: auth.currentUser.displayName || auth.currentUser.email,
				userEmail: auth.currentUser.email,
				date: today,
				checkInAt: serverTimestamp(),
				location: location,
				deviceId: deviceId,
				deviceInfo: navigator.userAgent,
				status: status,
				createdAt: serverTimestamp()
			});

			showToast("Chấm công VÀO thành công!", "success");
		} catch (error) {
			showToast("Lỗi khi chấm công: " + error, "error");
		} finally {
			setChecking(false);
		}
	};

	const handleCheckOut = async () => {
		if (!todayLog || !location) return;

		setChecking(true);
		try {
			await updateDoc(doc(db, 'attendance_logs', todayLog.id), {
				checkOutAt: serverTimestamp(),
				checkOutLocation: location,
				updatedAt: serverTimestamp()
			});
			showToast("Chấm công RA thành công!", "success");
		} catch (error) {
			showToast("Lỗi khi chấm công: " + error, "error");
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

	const isWithinRange = distance !== null && distance <= (companySettings?.geofenceRadius || 100);

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

					{/* Location Tracking */}
					<div className={`rounded-[2.5rem] p-6 border transition-all duration-500 ${isWithinRange ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800/50' : 'bg-rose-50/50 border-rose-200 dark:bg-rose-900/10 dark:border-rose-800/50'}`}>
						<div className="flex items-center gap-4">
							<div className={`p-3 rounded-2xl ${isWithinRange ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
								<MapPin size={24} />
							</div>
							<div className="flex-1">
								<p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Vị trí của bạn</p>
								<h4 className={`text-sm font-black ${isWithinRange ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
									{isWithinRange ? 'Đã vào khu vực văn phòng' : 'Ngoài khu vực văn phòng'}
								</h4>
								<p className="text-[10px] font-bold text-slate-500 mt-1">Khoảng cách: {distance !== null ? `${Math.round(distance)}m` : 'Đang định vị...'}</p>
							</div>
							{isWithinRange ? <CheckCircle size={24} className="text-emerald-500" /> : <AlertCircle size={24} className="text-rose-500 animate-pulse" />}
						</div>
					</div>

					{/* Action Buttons */}
					<div className="space-y-4">
						{!todayLog ? (
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
								disabled={!isWithinRange || checking}
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

					<div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl">
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
