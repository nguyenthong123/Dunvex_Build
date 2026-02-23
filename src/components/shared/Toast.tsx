import React, { useState, useEffect, createContext, useContext } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
	id: string;
	message: string;
	type: ToastType;
}

interface ToastContextType {
	showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [toasts, setToasts] = useState<Toast[]>([]);

	const showToast = (message: string, type: ToastType = 'info') => {
		const id = Math.random().toString(36).substring(2, 9);
		setToasts((prev) => [...prev, { id, message, type }]);
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id));
		}, 5000);
	};

	const removeToast = (id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	};

	return (
		<ToastContext.Provider value={{ showToast }}>
			{children}
			<div className="fixed bottom-24 left-1/2 -translate-x-1/2 md:bottom-10 md:left-auto md:right-10 md:translate-x-0 z-[9999] flex flex-col gap-3 w-[90%] md:w-auto max-w-md">
				{toasts.map((toast) => (
					<div
						key={toast.id}
						className={`
              flex items-center gap-3 p-4 rounded-2xl shadow-2xl backdrop-blur-xl border animate-in slide-in-from-bottom-5 duration-300
              ${toast.type === 'success' ? 'bg-emerald-50/90 dark:bg-emerald-900/90 border-emerald-100 dark:border-emerald-800 text-emerald-800 dark:text-emerald-100' : ''}
              ${toast.type === 'error' ? 'bg-rose-50/90 dark:bg-rose-900/90 border-rose-100 dark:border-rose-800 text-rose-800 dark:text-rose-100' : ''}
              ${toast.type === 'warning' ? 'bg-amber-50/90 dark:bg-amber-900/90 border-amber-100 dark:border-amber-800 text-amber-800 dark:text-amber-100' : ''}
              ${toast.type === 'info' ? 'bg-blue-50/90 dark:bg-blue-900/90 border-blue-100 dark:border-blue-800 text-blue-800 dark:text-blue-100' : ''}
            `}
					>
						<div className={`shrink-0 size-10 rounded-xl flex items-center justify-center ${toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-500' :
								toast.type === 'error' ? 'bg-rose-500/20 text-rose-500' :
									toast.type === 'warning' ? 'bg-amber-500/20 text-amber-500' :
										'bg-blue-500/20 text-blue-500'
							}`}>
							{toast.type === 'success' && <CheckCircle2 size={24} />}
							{toast.type === 'error' && <XCircle size={24} />}
							{toast.type === 'warning' && <AlertCircle size={24} />}
							{toast.type === 'info' && <Info size={24} />}
						</div>
						<div className="flex-1">
							<p className="text-sm font-black uppercase tracking-tight leading-tight">{toast.message}</p>
						</div>
						<button
							onClick={() => removeToast(toast.id)}
							className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
						>
							<X size={18} />
						</button>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
};

export const useToast = () => {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error('useToast must be used within a ToastProvider');
	}
	return context;
};
