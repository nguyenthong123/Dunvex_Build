import React from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const ReloadPrompt: React.FC = () => {
	const {
		offlineReady: [offlineReady, setOfflineReady],
		needRefresh: [needRefresh, setNeedRefresh],
		updateServiceWorker,
	} = useRegisterSW({
		onRegistered(r: ServiceWorkerRegistration | undefined) {
			console.log('SW Registered: ', r)
		},
		onRegisterError(error: any) {
			console.log('SW registration error', error)
		},
	})

	const close = () => {
		setOfflineReady(false)
		setNeedRefresh(false)
	}

	return (
		<div className="fixed bottom-20 right-4 z-[200]">
			{(offlineReady || needRefresh) && (
				<div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 animate-in slide-in-from-bottom-5 duration-300">
					<div className="mb-4">
						<p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
							{offlineReady ? 'Ứng dụng đã sẵn sàng chạy Offline' : 'Đã có bản cập nhật mới'}
						</p>
					</div>
					<div className="flex gap-2">
						{needRefresh && (
							<button
								onClick={() => updateServiceWorker(true)}
								className="px-5 py-2.5 bg-[#1A237E] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/10"
							>
								Cập nhật ngay
							</button>
						)}
						<button
							onClick={() => close()}
							className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
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
