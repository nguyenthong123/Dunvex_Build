import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { useScroll } from '../../context/ScrollContext';
import { useNavigationConfig } from '../../hooks/useNavigationConfig';
import { useOwner } from '../../hooks/useOwner';
import { X, AlertTriangle, Trash2, ShieldCheck, Search, RefreshCw, Clock } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { licenseService, type LicenseStatus } from '../../services/licenseService';
import { isAndroidNativeApp, isNativeApp } from '../../utils/platform';
import { SyncSidebarButton } from '../shared/SyncSidebarButton';
import { preloadNativeRoute } from '../../routeModules';

interface MainLayoutProps {
	children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
	const isAndroidNative = isAndroidNativeApp();
	const navigate = useNavigate();
	const location = useLocation();
	const { isNavVisible, handleScroll } = useScroll();
	const owner = useOwner();
	const { subscriptionStatus, subscriptionExpiresAt, manualLockOrders, manualLockDebts, manualLockSheets, manualLockAi } = owner;
	const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>(() => licenseService.getStatus());
	const [isRefreshingLicense, setIsRefreshingLicense] = useState(false);

	useEffect(() => {
		const unsub = licenseService.subscribe((status) => {
			setLicenseStatus(status);
		});
		return unsub;
	}, []);

	const allLocked = manualLockOrders && manualLockDebts && manualLockSheets && manualLockAi;

	const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
		const saved = localStorage.getItem('sidebar-visible');
		return saved === null ? true : saved === 'true';
	});

	const [isDesktopScreen, setIsDesktopScreen] = useState(() => {
		if (typeof window === 'undefined') return true;
		const isStandaloneApp = (window as any).webkit?.messageHandlers !== undefined ||
								(window as any).chrome?.webview !== undefined ||
								window.location.port === '41738';
		return isStandaloneApp || window.innerWidth >= 768;
	});

	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	useEffect(() => {
		localStorage.setItem('sidebar-visible', String(isSidebarVisible));
	}, [isSidebarVisible]);

	useEffect(() => {
		const handleResize = () => {
			const isStandaloneApp = (window as any).webkit?.messageHandlers !== undefined ||
									(window as any).chrome?.webview !== undefined ||
									window.location.port === '41738';
			setIsDesktopScreen(isStandaloneApp || window.innerWidth >= 768);
		};
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	// Desktop Global Keyboard Shortcuts (F1, F2, F3, F4, Ctrl/Cmd + K, Ctrl/Cmd + N)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

			if (e.key === 'F1') {
				e.preventDefault();
				navigate('/');
			} else if (e.key === 'F2' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n')) {
				if (!isTyping || e.metaKey || e.ctrlKey) {
					e.preventDefault();
					navigate('/quick-order');
				}
			} else if (e.key === 'F3' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b')) {
				if (!isTyping || e.metaKey || e.ctrlKey) {
					e.preventDefault();
					navigate('/debts');
				}
			} else if (e.key === 'F4' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i')) {
				if (!isTyping || e.metaKey || e.ctrlKey) {
					e.preventDefault();
					navigate('/inventory');
				}
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [navigate]);


	return (
		<div className={`bg-[#f8f9fa] dark:bg-slate-950 text-slate-900 dark:text-slate-100 h-screen w-full overflow-hidden flex flex-row font-['Manrope'] ${isAndroidNative ? '' : 'transition-colors duration-300'}`}>
			{/* Desktop / Tablet Sidebar */}
			{isDesktopScreen && isSidebarVisible && (
				<Sidebar onToggle={() => setIsSidebarVisible(false)} />
			)}

			<main className={`flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900 relative ${isAndroidNative ? '' : 'transition-colors duration-300'} print:overflow-visible print:h-auto print:block`}>
				{/* ⚠️ SUBSCRIPTION / OFFLINE LICENSE EXPIRED OR CLOCK TAMPERED BANNER */}
				{(allLocked || licenseStatus.isExpired || licenseStatus.isClockTampered) && (
					<div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-rose-600 text-white text-xs md:text-sm font-bold shadow-lg z-50 print:hidden animate-pulse">
						<div className="flex items-center gap-2">
							<AlertTriangle size={18} className="shrink-0 text-amber-300" />
							{licenseStatus.isClockTampered ? (
								<span>
									⚠️ <strong>CẢNH BÁO ĐỒNG HỒ:</strong> Phát hiện thời gian thiết bị bị chỉnh lùi. Ứng dụng đã tự động khoá offline. Vui lòng kết nối mạng hoặc chỉnh lại giờ chuẩn để mở khoá.
								</span>
							) : (
								<span>
									🔒 <strong>{subscriptionStatus === 'expired' || licenseStatus.isExpired ? 'BẢN QUYỀN HẾT HẠN' : 'TÀI KHOẢN BỊ KHOÁ'}:</strong> Tất cả tính năng ghi chép đã tự động khoá trên thiết bị này. Vui lòng gia hạn để tiếp tục sử dụng.
									{subscriptionExpiresAt && (
										<span className="ml-2 text-rose-200 text-xs font-normal">
											(Hết hạn: {new Date(subscriptionExpiresAt?.toDate?.() || subscriptionExpiresAt).toLocaleDateString('vi-VN')})
										</span>
									)}
								</span>
							)}
						</div>
						<div className="flex items-center gap-2 shrink-0">
							<button
								onClick={async () => {
									setIsRefreshingLicense(true);
									try {
										await licenseService.refreshLicense(true);
									} finally {
										setIsRefreshingLicense(false);
									}
								}}
								disabled={isRefreshingLicense}
								className="bg-rose-700 hover:bg-rose-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
								title="Kiểm tra mở khoá tự động từ hệ thống VPS"
							>
								<RefreshCw size={12} className={isRefreshingLicense ? 'animate-spin' : ''} />
								<span>Kiểm tra mở khoá</span>
							</button>
							<button onClick={() => navigate('/pricing')} className="bg-white text-rose-600 px-4 py-1.5 rounded-lg text-xs font-black uppercase hover:bg-rose-50 transition cursor-pointer">
								Gia hạn ngay
							</button>
						</div>
					</div>
				)}

				{/* MOBILE TOP BAR - Only shown on actual mobile screens */}
				{!isDesktopScreen && !location.pathname.includes('/price-list') && (
					<header
						className={`flex items-center justify-between px-5 border-b border-slate-100 dark:border-slate-800 fixed top-0 left-0 right-0 z-[60] shadow-sm print:hidden ${
							isAndroidNative ? 'bg-white dark:bg-slate-900' : 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl'
						}`}
						style={{
							...(isAndroidNative ? {} : { WebkitBackdropFilter: 'blur(20px)' }),
							paddingTop: 'env(safe-area-inset-top, 0px)',
							height: 'calc(3.5rem + env(safe-area-inset-top, 0px))'
						}}
					>
						<div className="flex items-center gap-2">
							<div className="size-8 bg-gradient-to-br from-[#FF6D00] to-[#FF9100] rounded-xl flex items-center justify-center shadow-md shadow-orange-500/20">
								<span className="material-symbols-outlined text-white text-lg font-bold">architecture</span>
							</div>
							<h1 className="text-[15px] font-black uppercase tracking-tight text-slate-800 dark:text-white">
								Dunvex<span className="text-[#FF6D00]">Build</span>
							</h1>
						</div>

						<div className="flex items-center gap-1.5">
							<button
								onClick={() => navigate('/trash')}
								className="size-9 flex items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all"
								title="Thùng rác"
							>
								<Trash2 size={18} />
							</button>
							{(!owner.isEmployee || owner.role === 'admin') && (
								<button
									onClick={() => navigate('/admin?tab=approvals')}
									className="size-9 flex items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white transition-all"
									title="Duyệt yêu cầu"
								>
									<ShieldCheck size={18} />
								</button>
							)}
							<button
								onClick={() => setMobileMenuOpen(true)}
								className="size-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500"
							>
								<span className="material-symbols-outlined text-xl">menu</span>
							</button>
						</div>
					</header>
				)}

				{/* Floating Re-open Sidebar button for Desktop when hidden */}
				{isDesktopScreen && !isSidebarVisible && (
					<button
						onClick={() => setIsSidebarVisible(true)}
						className="fixed top-4 left-4 z-[60] size-9 bg-[#1A237E] text-white rounded-xl shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center group print:hidden"
						title="Hiện Menu điều hướng (Sidebar)"
					>
						<span className="material-symbols-outlined text-xl group-hover:rotate-90 transition-transform">menu</span>
					</button>
				)}

				{/* Main Content Area */}
				<div
					onScroll={handleScroll}
					className={`flex-1 overflow-y-auto no-scrollbar print:overflow-visible print:h-auto print:block print:pt-0 ${
						isDesktopScreen ? 'pt-0' : (location.pathname.includes('/price-list') ? 'pt-0' : 'main-content-container')
					}`}
				>
					<div className={`min-h-full print:block print:h-auto w-full flex flex-col flex-1 ${isAndroidNative ? '' : 'transition-all'}`}>
						<div className={`flex-1 flex flex-col ${isAndroidNative ? '' : 'animate-[fadeIn_0.2s_ease-out] motion-reduce:animate-none'}`} key={location.pathname}>
							{children}
						</div>
					</div>

					{/* Footer Spacer & Branding */}
					<footer className="py-8 px-6 text-center border-t border-slate-100 dark:border-slate-800/50 mt-auto pb-24 md:pb-8 transition-colors duration-300">
						<div className="flex flex-col items-center gap-1.5 opacity-30 dark:opacity-20 hover:opacity-100 transition-opacity duration-500">
							<p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
								Dunvex<span className="text-slate-900 dark:text-white">Build</span> POS & Production System
							</p>
							<p className="text-[8px] font-bold text-slate-400">© 2026 High-Performance Native Architecture</p>
						</div>
					</footer>
				</div>

				{/* Mobile Navigation bar only on actual small screens */}
				{!isDesktopScreen && <MobileNav />}

				{/* Mobile Menu Drawer */}
				{mobileMenuOpen && !isDesktopScreen && (
					<div className="fixed inset-0 z-[110]">
						<div
							className={`absolute inset-0 bg-black/60 ${isAndroidNative ? '' : 'backdrop-blur-sm'}`}
							onClick={() => setMobileMenuOpen(false)}
						/>
						<div className="absolute right-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-900 shadow-2xl animate-in slide-in-from-right duration-200 flex flex-col">
							<div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
								<h3 className="text-sm font-black text-slate-800 dark:text-white uppercase">Menu điều hướng</h3>
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
			</main>
		</div>
	);
};

const MobileDrawerItems = ({ onClose }: { onClose: () => void }) => {
	const isAndroidNative = isAndroidNativeApp();
	const navigate = useNavigate();
	const { sidebarItems, currentPath } = useNavigationConfig();

	return (
		<div className="space-y-1">
			{isNativeApp() && (
				<div className="mb-3 px-1">
					<SyncSidebarButton />
				</div>
			)}
			{sidebarItems.map((item, idx) => {
				const isActive = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));
				return (
					<button
						key={`drawer-${idx}`}
						onPointerEnter={() => !isAndroidNative && preloadNativeRoute(item.path)}
						onFocus={() => !isAndroidNative && preloadNativeRoute(item.path)}
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
								? 'bg-indigo-50 dark:bg-indigo-900/20 text-[#1A237E] dark:text-indigo-400 font-bold'
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
		</div>
	);
};

export default MainLayout;
