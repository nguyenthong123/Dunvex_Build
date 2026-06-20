import React, { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const ReloadPrompt: React.FC = () => {
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
				setInterval(() => r.update().catch(() => {}), 60 * 60 * 1000);
			}
		},
		onRegisterError() {},
	})

	const [iosUpdateAvailable, setIosUpdateAvailable] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);
	const [dismissed, setDismissed] = useState(false);

	// 📱 iOS version check
	useEffect(() => {
		if (!isIOS) return;

		const getCurrentHash = () => {
			const scripts = Array.from(document.querySelectorAll('script[src]'))
				.map(s => s.getAttribute('src') || '')
				.filter(src => src.includes('/assets/index-'));
			return scripts[0] || '';
		};

		const currentHash = getCurrentHash();
		if (currentHash && !localStorage.getItem('pwa_bundle')) {
			localStorage.setItem('pwa_bundle', currentHash);
		}

		const checkVersion = async () => {
			if (sessionStorage.getItem('pwa_update_dismissed')) return;
			try {
				const res = await fetch('/index.html?t=' + Date.now(), { cache: 'no-store' });
				const html = await res.text();
				const match = html.match(/assets\/index-[\w-]+\.js/);
				if (match && match[0]) {
					const deployed = match[0];
					const stored = localStorage.getItem('pwa_bundle');
					if (stored && deployed !== stored) {
						setIosUpdateAvailable(true);
					}
				}
			} catch {}
		};

		checkVersion();
		const interval = setInterval(checkVersion, 60 * 60 * 1000);
		return () => clearInterval(interval);
	}, [isIOS]);

	// 🟢 offlineReady: tự động biến mất sau 3 giây
	useEffect(() => {
		if (offlineReady && !sessionStorage.getItem('pwa_offline_shown')) {
			sessionStorage.setItem('pwa_offline_shown', '1');
			const t = setTimeout(() => setOfflineReady(false), 3000);
			return () => clearTimeout(t);
		}
		if (offlineReady && sessionStorage.getItem('pwa_offline_shown')) {
			setOfflineReady(false);
		}
	}, [offlineReady, setOfflineReady]);

	const handleUpdate = () => {
		setIsUpdating(true);
		if ('caches' in window) {
			caches.keys().then(names => names.forEach(name => caches.delete(name)));
		}
		const url = window.location.href.split('?')[0];
		window.location.href = url + '?v=' + Date.now();
	};

	const handleDismiss = () => {
		sessionStorage.setItem('pwa_update_dismissed', '1');
		setDismissed(true);
		setNeedRefresh(false);
		setIosUpdateAvailable(false);
	};

	const showUpdate = (needRefresh || iosUpdateAvailable) && !dismissed;
	if (!showUpdate && !offlineReady) return null;

	// offlineReady chỉ hiện toast nhỏ, không có overlay
	if (offlineReady && !showUpdate) {
		return (
			<div className="fixed bottom-24 left-4 right-4 z-[200] flex justify-center pointer-events-none">
				<div className="bg-green-600 text-white px-5 py-3 rounded-2xl shadow-lg text-xs font-bold uppercase tracking-wider animate-in slide-in-from-bottom-5 duration-300">
					✅ Sẵn sàng offline
				</div>
			</div>
		);
	}

	return (
		<div className="fixed inset-0 z-[200] flex items-end justify-center pb-24 bg-black/30" onClick={handleDismiss}>
			<div className="bg-white dark:bg-slate-900 mx-4 p-6 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-sm" onClick={e => e.stopPropagation()}>
				<div className="mb-4">
					<p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
						🔄 Đã có bản cập nhật mới
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
