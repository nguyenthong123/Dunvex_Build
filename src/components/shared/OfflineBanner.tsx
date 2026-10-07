import React, { useState, useEffect, useRef } from 'react';
import { WifiOff, RefreshCw, X } from 'lucide-react';

const OfflineBanner = () => {
	const [isOnline, setIsOnline] = useState(navigator.onLine);
	const [show, setShow] = useState(!navigator.onLine);
	const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const showTemporarily = (duration: number) => {
			if (hideTimer.current) clearTimeout(hideTimer.current);
			hideTimer.current = setTimeout(() => {
				setShow(false);
				hideTimer.current = null;
			}, duration);
		};

		const handleOnline = () => {
			setIsOnline(true);
			setShow(true);
			showTemporarily(3000);
		};
		const handleOffline = () => {
			setIsOnline(false);
			setShow(true);
			showTemporarily(5000);
		};

		if (!navigator.onLine) showTemporarily(5000);
		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			if (hideTimer.current) clearTimeout(hideTimer.current);
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	}, []);

	if (!show) return null;

	return (
		<div className={`fixed bottom-24 left-4 right-4 z-[9999] md:left-auto md:right-8 md:bottom-8 md:w-80 animate-in slide-in-from-bottom-10 duration-500`}>
			<div className={`${isOnline ? 'bg-emerald-500' : 'bg-rose-500'} text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/20 backdrop-blur-md`}>
				<div className="size-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
					{isOnline ? (
						<RefreshCw className="size-5 animate-spin" />
					) : (
						<WifiOff className="size-5 animate-pulse" />
					)}
				</div>
				<div className="flex-1 min-w-0">
					<p className="text-sm font-black uppercase tracking-wider leading-none mb-1">
						{isOnline ? 'Đã kết nối lại' : 'Mất kết nối'}
					</p>
					<p className="text-[10px] font-bold opacity-90 truncate">
						{isOnline ? 'Hệ thống đang đồng bộ dữ liệu...' : 'Đang sử dụng dữ liệu ngoại tuyến'}
					</p>
				</div>
				<button
					onClick={() => {
						if (hideTimer.current) clearTimeout(hideTimer.current);
						hideTimer.current = null;
						setShow(false);
					}}
					aria-label="Đóng thông báo kết nối"
					className="size-8 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors shrink-0"
				>
					<X className="size-4" />
				</button>
			</div>
		</div>
	);
};

export default OfflineBanner;
