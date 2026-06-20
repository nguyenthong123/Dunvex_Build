import React, { useEffect, useState, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const ReloadPrompt: React.FC = () => {
	// 🏠 Tắt trong dev mode
	if (import.meta.env.DEV) return null;

	const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

	const {
		offlineReady: [offlineReady, setOfflineReady],
		needRefresh: [needRefresh, setNeedRefresh],
		updateServiceWorker,
	} = useRegisterSW({
		onRegistered(r: ServiceWorkerRegistration | undefined) {
			if (r && !isIOS) {
				// Trên non-iOS: kiểm tra update mỗi 30 phút
				setInterval(() => r.update().catch(() => {}), 30 * 60 * 1000);
			}
		},
		onRegisterError() {},
	})

	const [iosUpdateAvailable, setIosUpdateAvailable] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);
	const deployedHashRef = useRef<string>('');

	// 📱 iOS: tự kiểm tra version bằng fetch (SW update không hoạt động tốt trên iOS)
	useEffect(() => {
		if (!isIOS) return;

		const getCurrentHash = () => {
			const scripts = Array.from(document.querySelectorAll('script[src]'))
				.map(s => s.getAttribute('src') || '')
				.filter(src => src.includes('/assets/index-'));
			return scripts[0] || '';
		};

		// Lưu hash hiện tại
		const currentHash = getCurrentHash();
		if (currentHash && !localStorage.getItem('pwa_current_bundle')) {
			localStorage.setItem('pwa_current_bundle', currentHash);
		}

		const checkVersion = async () => {
			try {
				const res = await fetch('/index.html?t=' + Date.now(), { cache: 'no-store' });
				const html = await res.text();
				const match = html.match(/assets\/index-[\w-]+\.js/);
				if (match && match[0]) {
					const deployed = match[0];
					deployedHashRef.current = deployed;
					const stored = localStorage.getItem('pwa_current_bundle');
					const dismissed = localStorage.getItem('pwa_dismissed_bundle');

					if (stored && deployed !== stored && deployed !== dismissed) {
						console.log('📱 New version deployed:', deployed);
						setIosUpdateAvailable(true);
					}
				}
			} catch {}
		};

		checkVersion();
		const interval = setInterval(checkVersion, 30 * 60 * 1000);
		return () => clearInterval(interval);
	}, [isIOS]);

	// 🔄 Cập nhật ngay
	const handleUpdate = () => {
		setIsUpdating(true);
		// Xóa tất cả cache
		localStorage.removeItem('pwa_dismissed_bundle');
		if ('caches' in window) {
			caches.keys().then(names => names.forEach(name => caches.delete(name)));
		}
		// Force reload với cache-busting
		const url = window.location.href.split('?')[0];
		window.location.href = url + '?v=' + Date.now();
	};

	// ❌ Đóng = reload trang (không thể dismiss vì SW sẽ báo lại sau 5-30p)
	const handleDismiss = () => {
		setIsUpdating(true);
		// Xóa cache + reload
		if ('caches' in window) {
			caches.keys().then(names => names.forEach(name => caches.delete(name)));
		}
		const url = window.location.href.split('?')[0];
		window.location.href = url + '?v=' + Date.now();
	};

	const showPopup = offlineReady || needRefresh || iosUpdateAvailable;
	if (!showPopup) return null;

	return (
		<div className="fixed inset-0 z-[200] flex items-end justify-center pb-24 bg-black/30" onClick={handleDismiss}>
			<div className="bg-white dark:bg-slate-900 mx-4 p-6 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-sm" onClick={e => e.stopPropagation()}>
				<div className="mb-4">
					<p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
						{offlineReady ? '✅ Ứng dụng đã sẵn sàng Offline' : '🔄 Đã có bản cập nhật mới'}
					</p>
					<p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
						Bấm <strong>Cập nhật ngay</strong> để tải phiên bản mới nhất.
					</p>
				</div>
				<div className="flex gap-3">
					<button
						onClick={handleDismiss}
						disabled={isUpdating}
						className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
					>
						Để sau
					</button>
					<button
						onClick={handleUpdate}
						disabled={isUpdating}
						className="flex-1 px-4 py-3 bg-[#1A237E] text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
					>
						{isUpdating ? 'Đang tải...' : 'Cập nhật ngay'}
					</button>
				</div>
			</div>
		</div>
	)
}

export default ReloadPrompt
