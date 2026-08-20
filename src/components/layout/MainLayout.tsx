import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import NotificationBell from '../NotificationBell';
import SystemAlertManager from '../SystemAlertManager';
import { useScroll } from '../../context/ScrollContext';
import { useNavigationConfig } from '../../hooks/useNavigationConfig';
import { useOwner } from '../../hooks/useOwner';
import { X, AlertTriangle, Share, PlusSquare, Info, AlertCircle, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MainLayoutProps {
	children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
	const { isNavVisible, handleScroll } = useScroll();
	const { subscriptionStatus, subscriptionExpiresAt, manualLockOrders, manualLockDebts, manualLockSheets, manualLockAi } = useOwner();
	const allLocked = manualLockOrders && manualLockDebts && manualLockSheets && manualLockAi;
	const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
		const saved = localStorage.getItem('sidebar-visible');
		return saved === null ? true : saved === 'true';
	});
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [showPinGuide, setShowPinGuide] = useState(false);
	const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

	useEffect(() => {
		localStorage.setItem('sidebar-visible', String(isSidebarVisible));
	}, [isSidebarVisible]);

	useEffect(() => {
		const handleBeforeInstallPrompt = (e: any) => {
			e.preventDefault();
			setDeferredPrompt(e);
		};
		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
		return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
	}, []);

	useEffect(() => {
		const handlePinEvent = () => {
			if (deferredPrompt) {
				deferredPrompt.prompt();
				deferredPrompt.userChoice.then((choiceResult: any) => {
					if (choiceResult.outcome === 'accepted') {
						setDeferredPrompt(null);
					}
				});
			} else {
				setShowPinGuide(true);
			}
		};
		window.addEventListener('pin-app', handlePinEvent);
		return () => window.removeEventListener('pin-app', handlePinEvent);
	}, [deferredPrompt]);

	return (
		<div className="bg-[#f8f9fa] dark:bg-slate-950 text-slate-900 dark:text-slate-100 h-screen w-full overflow-hidden flex flex-col lg:flex-row font-['Manrope'] transition-colors duration-300">
			<div className="hidden lg:block">
				{isSidebarVisible && <Sidebar onToggle={() => setIsSidebarVisible(false)} />}
			</div>
			<SystemAlertManager />

			<main className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900 relative transition-colors duration-300 print:overflow-visible print:h-auto print:block">
				{/* ⚠️ SUBSCRIPTION EXPIRED / LOCKED BANNER */}
				{allLocked && (
					<div className="flex items-center justify-between px-4 py-2.5 bg-rose-600 text-white text-sm font-bold shadow-lg z-50 print:hidden animate-pulse">
						<div className="flex items-center gap-2">
							<AlertTriangle size={16} />
							<span>{subscriptionStatus === 'expired' 
								? '🔒 GÓI CƯỚC ĐÃ HẾT HẠN — Tất cả tính năng đã bị khoá. Vui lòng gia hạn để tiếp tục sử dụng.'
								: '🔒 TÀI KHOẢN BỊ KHOÁ — Tất cả tính năng đã bị khoá. Vui lòng liên hệ admin.'}</span>
							{subscriptionExpiresAt && (
								<span className="text-rose-200 text-xs">
									(Hết hạn: {new Date(subscriptionExpiresAt?.toDate?.() || subscriptionExpiresAt).toLocaleDateString('vi-VN')})
								</span>
							)}
						</div>
						<button onClick={() => window.open('https://dunvex.com/upgrade', '_blank')} className="bg-white text-rose-600 px-4 py-1.5 rounded-lg text-xs font-black uppercase hover:bg-rose-50 transition">
							Gia hạn ngay
						</button>
					</div>
				)}
				{/* MOBILE TOP BAR - Premium Glassmorphism */}
				{!window.location.pathname.includes('/price-list') && (
					<header
						className="lg:hidden flex items-center justify-between px-6 h-14 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl fixed top-0 left-0 right-0 z-[60] shadow-sm print:hidden"
						style={{ WebkitBackdropFilter: 'blur(20px)' }}
					>
						<div className="flex items-center gap-2">
							<div className="size-8 bg-gradient-to-br from-[#FF6D00] to-[#FF9100] rounded-xl flex items-center justify-center shadow-md shadow-orange-500/20">
								<span className="material-symbols-outlined text-white text-lg font-bold">architecture</span>
							</div>
							<h1 className="text-[15px] font-black uppercase tracking-tight text-slate-800 dark:text-white">
								Dunvex<span className="text-[#FF6D00]">Build</span>
							</h1>
						</div>

						<div className="flex items-center gap-2">
							<NotificationBell />
							<button
								onClick={() => setMobileMenuOpen(true)}
								className="size-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500"
							>
								<span className="material-symbols-outlined text-xl">menu</span>
							</button>
						</div>
					</header>
				)}

				{!isSidebarVisible && (
					<button
						onClick={() => setIsSidebarVisible(true)}
						className="fixed top-5 left-5 z-[60] size-10 bg-[#1A237E] text-white rounded-xl shadow-xl hover:scale-110 active:scale-95 transition-all hidden lg:flex items-center justify-center group print:hidden"
						title="Hiện Menu"
					>
						<span className="material-symbols-outlined text-2xl group-hover:rotate-90 transition-transform">menu</span>
					</button>
				)}

				<div
					onScroll={handleScroll}
					className={`flex-1 overflow-y-auto no-scrollbar lg:pt-0 ${window.location.pathname.includes('/price-list') ? 'pt-0' : 'pt-20'} print:overflow-visible print:h-auto print:block print:pt-0`}
				>
					<div className="min-h-full print:block print:h-auto w-full max-w-[1920px] mx-auto px-4 md:px-6 lg:px-8 2xl:px-12 transition-all">
					<div className="animate-[fadeIn_0.3s_ease-out] motion-reduce:animate-none" key={window.location.pathname}>
						{children}
					</div>
				</div>

					{/* Footer Spacer & Branding */}
					<footer className="py-12 px-6 text-center border-t border-slate-50 dark:border-slate-800/50 mt-auto pb-32 md:pb-12 transition-colors duration-300">
						<div className="flex flex-col items-center gap-2 opacity-30 dark:opacity-20 hover:opacity-100 transition-opacity duration-500">
							<div className="size-8 bg-slate-400 dark:bg-slate-500 rounded-lg flex items-center justify-center mb-1">
								<span className="material-symbols-outlined text-white text-lg">architecture</span>
							</div>
							<p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
								Dunvex<span className="text-slate-900 dark:text-white">Build</span> Management System
							</p>
							<p className="text-[8px] font-bold text-slate-400">© 2026 Developed by Antigravity AI Engine</p>
						</div>
					</footer>
				</div>

				<MobileNav />
			{/* Mobile Menu Drawer */}
			{mobileMenuOpen && (
				<div className="fixed inset-0 z-[110] lg:hidden">
					<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
					<div className="absolute right-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-900 shadow-2xl animate-in slide-in-from-right duration-200 flex flex-col">
						<div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
							<h3 className="text-sm font-black text-slate-800 dark:text-white uppercase">Menu</h3>
							<button onClick={() => setMobileMenuOpen(false)} className="size-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
								<X size={16} className="text-slate-500" />
							</button>
						</div>
						<div className="flex-1 overflow-y-auto p-2">
							<MobileDrawerItems onClose={() => setMobileMenuOpen(false)} />
						</div>
					</div>
				</div>
			)}
			{showPinGuide && (
				<PinAppGuideModal onClose={() => setShowPinGuide(false)} />
			)}
		</main>
	</div>
	);
};

const MobileDrawerItems = ({ onClose }: { onClose: () => void }) => {
	const navigate = useNavigate();
	const { sidebarItems, currentPath } = useNavigationConfig();
	const hasPermission = (key?: string) => {
		if (!key) return true;
		return true; // Simplified — permission handled by useNavigationConfig
	};

	return (
		<div className="space-y-1">
			{sidebarItems.map((item, idx) => {
				const isActive = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));
				return (
					<button
						key={`drawer-${idx}`}
						onClick={() => {
							if (item.path.startsWith('event:')) {
								window.dispatchEvent(new CustomEvent(item.path.split(':')[1]));
							} else {
								navigate(item.path);
							}
							onClose();
						}}
						className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
							isActive
								? 'bg-indigo-50 dark:bg-indigo-900/20 text-[#1A237E] dark:text-indigo-400'
								: 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
						}`}
					>
						<span
							className={`material-symbols-outlined text-xl ${isActive ? 'filled' : ''}`}
							style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
						>
							{item.icon}
						</span>
						<span className="text-xs font-bold uppercase tracking-wide">{item.label}</span>
					</button>
				);
			})}
			{/* Nút Pin ứng dụng */}
			<button
				onClick={() => {
					window.dispatchEvent(new CustomEvent('pin-app'));
					onClose();
				}}
				className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-t border-dashed border-slate-100 dark:border-slate-800/80 mt-2 cursor-pointer animate-[pulse_2s_infinite]"
			>
				<span className="material-symbols-outlined text-xl text-indigo-500">install_mobile</span>
				<span className="text-xs font-bold uppercase tracking-wide">Pin ứng dụng</span>
			</button>
		</div>
	);
};

const PinAppGuideModal = ({ onClose }: { onClose: () => void }) => {
	const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

	return (
		<div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
			<div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2rem] sm:rounded-[2.5rem] p-6 shadow-2xl border border-white/20 dark:border-slate-800 flex flex-col gap-5 animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="material-symbols-outlined text-2xl text-[#FF6D00]">install_mobile</span>
						<h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Ghim ứng dụng</h3>
					</div>
					<button onClick={onClose} className="size-8 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-colors">
						<X size={18} />
					</button>
				</div>

				{/* Content based on OS */}
				<div className="space-y-4 text-slate-700 dark:text-slate-300 text-sm overflow-y-auto max-h-[60vh] pr-1 custom-scrollbar">
					{isIOS ? (
						<>
							<p className="text-xs font-semibold text-slate-500 mb-2">Hướng dẫn ghim trên thiết bị Apple iOS (iPhone/iPad):</p>
							<div className="space-y-3.5">
								<div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl">
									<div className="size-8 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0 font-black text-sm">1</div>
									<div>
										<p className="font-bold text-slate-800 dark:text-white">Nhấp nút Chia sẻ (Share)</p>
										<p className="text-xs text-slate-500 mt-0.5">Nhấp biểu tượng <Share size={14} className="inline-block mx-1 text-indigo-500" /> (ô vuông có mũi tên chỉ lên) trên thanh công cụ dưới cùng của trình duyệt Safari.</p>
									</div>
								</div>
								
								<div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl">
									<div className="size-8 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0 font-black text-sm">2</div>
									<div>
										<p className="font-bold text-slate-800 dark:text-white">Chọn "Thêm vào MH chính"</p>
										<p className="text-xs text-slate-500 mt-0.5">Cuộn danh sách menu xuống và nhấp vào mục <PlusSquare size={14} className="inline-block mx-1 text-emerald-500" /> <b>"Thêm vào MH chính"</b> (Add to Home Screen).</p>
									</div>
								</div>

								<div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl">
									<div className="size-8 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0 font-black text-sm">3</div>
									<div>
										<p className="font-bold text-slate-800 dark:text-white">Nhấn ghim</p>
										<p className="text-xs text-slate-500 mt-0.5">Nhấp nút <b>"Thêm"</b> (Add) ở góc trên bên phải để hoàn tất ghim app ra màn hình chính.</p>
									</div>
								</div>
							</div>

							{/* iOS PWA Login Warning */}
							<div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl p-3.5 flex gap-3 mt-4">
								<AlertCircle size={20} className="text-rose-500 shrink-0 mt-0.5" />
								<div>
									<h4 className="font-black text-rose-700 dark:text-rose-400 uppercase text-xs tracking-tight">💡 Cảnh báo Đăng nhập Google (iOS PWA)</h4>
									<p className="text-xs text-rose-600/90 dark:text-rose-350/90 mt-1 leading-relaxed">
										Do Apple chặn chia sẻ phiên (session/cookie) của Google Sign-in khi chạy dưới dạng PWA đã ghim, đăng nhập Google sẽ bị lỗi văng lại.
									</p>
									<p className="text-xs font-bold text-rose-750 dark:text-rose-400 mt-2">
										👉 Giải pháp: Vui lòng sử dụng tính năng "Đăng nhập bằng Email & Mật khẩu" trên ứng dụng đã ghim. Hoặc mở trực tiếp trên web Safari nếu muốn đăng nhập bằng Google.
									</p>
								</div>
							</div>
						</>
					) : (
						<>
							<p className="text-xs font-semibold text-slate-500 mb-2">Hướng dẫn ghim trên thiết bị Android hoặc Khác:</p>
							<div className="space-y-3.5">
								<div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl">
									<div className="size-8 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0 font-black text-sm">1</div>
									<div>
										<p className="font-bold text-slate-800 dark:text-white">Nhấp Menu Trình Duyệt</p>
										<p className="text-xs text-slate-500 mt-0.5">Nhấp biểu tượng <b>3 dấu chấm dọc</b> ở góc trên bên phải của Google Chrome / Cốc Cốc.</p>
									</div>
								</div>

								<div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl">
									<div className="size-8 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0 font-black text-sm">2</div>
									<div>
										<p className="font-bold text-slate-800 dark:text-white">Chọn "Cài đặt ứng dụng"</p>
										<p className="text-xs text-slate-500 mt-0.5">Nhấp chọn mục <b>"Cài đặt ứng dụng"</b> hoặc <b>"Thêm vào Màn hình chính"</b>.</p>
									</div>
								</div>

								<div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl">
									<div className="size-8 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0 font-black text-sm">3</div>
									<div>
										<p className="font-bold text-slate-800 dark:text-white">Xác nhận</p>
										<p className="text-xs text-slate-500 mt-0.5">Nhấp nút cài đặt để hoàn tất đưa biểu tượng ứng dụng ra màn hình chính.</p>
									</div>
								</div>
							</div>
						</>
					)}
				</div>

				<button onClick={onClose} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl active:scale-[0.98] transition-all shadow-md mt-2">
					Đã hiểu, đóng hướng dẫn
				</button>
			</div>
		</div>
	);
};

export default MainLayout;
