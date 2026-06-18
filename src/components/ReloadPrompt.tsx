import React, { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const ReloadPrompt: React.FC = () => {
	const {
		offlineReady: [offlineReady, setOfflineReady],
		needRefresh: [needRefresh, setNeedRefresh],
		updateServiceWorker,
	} = useRegisterSW({
		onRegistered(r: ServiceWorkerRegistration | undefined) {
			console.log('SW Registered: ', r)
			// 🔄 Kiểm tra bản cập nhật mỗi 5 phút (thay vì 1 giờ)
			if (r) {
				setInterval(() => {
					r.update().catch(console.error);
				}, 5 * 60 * 1000);
				// Kiểm tra ngay lập tức sau khi register
				setTimeout(() => r.update().catch(console.error), 3000);
			}
		},
		onRegisterError(error: any) {
			console.log('SW registration error', error)
		},
	})

	// 📱 iOS Safari fallback: tự kiểm tra version bằng fetch
	const [iosUpdateAvailable, setIosUpdateAvailable] = useState(false);
	const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

	// Lưu bundle hash hiện tại khi load trang
	const getCurrentBundleHash = () => {
		const scripts = Array.from(document.querySelectorAll('script[src]'))
			.map(s => s.getAttribute('src') || '')
			.filter(src => src.includes('/assets/index-'));
		return scripts[0] || '';
	};

	useEffect(() => {
		// Lưu hash hiện tại vào localStorage lần đầu
		const currentHash = getCurrentBundleHash();
		if (currentHash) {
			const storedHash = localStorage.getItem('pwa_current_bundle');
			if (storedHash !== currentHash) {
				localStorage.setItem('pwa_current_bundle', currentHash);
			}
		}

		const checkVersion = async () => {
			try {
				const res = await fetch('/index.html?t=' + Date.now(), { cache: 'no-store' });
				const html = await res.text();
				const match = html.match(/assets\/index-[\w-]+\.js/);
				if (match && match[0]) {
					const deployedBundle = match[0];
					const storedBundle = localStorage.getItem('pwa_current_bundle');
					// Chỉ báo update nếu deployed KHÁC stored (đã lưu từ lần load trước)
					if (storedBundle && deployedBundle !== storedBundle && !needRefresh) {
						console.log('📱 New version! Stored:', storedBundle, 'Deployed:', deployedBundle);
						setIosUpdateAvailable(true);
					}
				}
			} catch (e) { /* ignore */ }
		};

		if (isIOS) {
			checkVersion();
			const interval = setInterval(checkVersion, 2 * 60 * 1000);
			return () => clearInterval(interval);
		}
	}, [isIOS, needRefresh]);

	// Tự động cập nhật thông minh (Smart Auto-Update)
	useEffect(() => {
		if (needRefresh) {
			const handleVisibilityChange = () => {
				// Nếu người dùng tắt màn hình, hoặc chuyển tab, app vào chế độ ngủ (hidden)
				if (document.visibilityState === 'hidden') {
					// Đợi 5 giây để chắc chắn không phải họ lỡ tay vuốt ra rồi vuốt lại
					setTimeout(() => {
						if (document.visibilityState === 'hidden') {
							console.log('App is hidden, silently updating...');
							updateServiceWorker(true);
						}
					}, 5000);
				}
			};

			document.addEventListener('visibilitychange', handleVisibilityChange);

			// Vẫn giữ cơ chế 12h đêm: Nếu tới 12h đêm mà người dùng ĐANG mở màn hình, 
			// thì nó không F5 ngang. Nếu họ tắt màn hình, nó sẽ F5 ngay.
			const now = new Date();
			const midnight = new Date();
			midnight.setHours(24, 0, 0, 0); 
			
			let timeToMidnight = midnight.getTime() - now.getTime();
			
			const timer = setTimeout(() => {
				if (document.visibilityState === 'hidden') {
					updateServiceWorker(true);
				}
			}, timeToMidnight);

			return () => {
				document.removeEventListener('visibilitychange', handleVisibilityChange);
				clearTimeout(timer);
			};
		}
	}, [needRefresh, updateServiceWorker]);

	const close = () => {
		setOfflineReady(false)
		setNeedRefresh(false)
	}

	const [isUpdating, setIsUpdating] = React.useState(false);

	const handleUpdate = () => {
		setIsUpdating(true);
		// 📱 iOS: force bỏ cache trước khi reload
		if (isIOS) {
			// Lưu hash deployed vào localStorage trước khi reload
			localStorage.setItem('pwa_updated', 'true');
			// Xoá SW cache nếu có
			if ('caches' in window) {
				caches.keys().then(names => {
					names.forEach(name => caches.delete(name));
				});
			}
			// Force reload bypass cache
			setTimeout(() => {
				window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
			}, 500);
			return;
		}
		updateServiceWorker(true);
		// Fallback: Ép tải lại trang sau 1.5s nếu Service Worker bị kẹt không tự reload
		setTimeout(() => {
			window.location.reload();
		}, 1500);
	};

	return (
		<div className="fixed bottom-20 right-4 z-[200]">
			{(offlineReady || needRefresh || iosUpdateAvailable) && (
				<div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 animate-in slide-in-from-bottom-5 duration-300">
					<div className="mb-4">
						<p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
							{offlineReady ? 'Ứng dụng đã sẵn sàng chạy Offline' : 'Đã có bản cập nhật mới'}
						</p>
						{iosUpdateAvailable && (
							<p className="text-[10px] text-slate-400 mt-1">📱 Phiên bản mới đã được phát hiện. Vui lòng cập nhật.</p>
						)}
					</div>
					<div className="flex gap-2">
						{(needRefresh || iosUpdateAvailable) && (
							<button
								onClick={handleUpdate}
								disabled={isUpdating}
								className={`px-5 py-2.5 bg-[#1A237E] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/10 ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
							>
								{isUpdating ? 'Đang xử lý...' : 'Cập nhật ngay'}
							</button>
						)}
						<button
							onClick={() => { close(); setIosUpdateAvailable(false); }}
							disabled={isUpdating}
							className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
						>
							Đóng
						</button>
					</div>
				</div>
			)}
		</div>
	)
}

export default ReloadPrompt
