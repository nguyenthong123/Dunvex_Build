import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider, db } from '../services/firebase';
import { signInWithPopup, signInWithRedirect, getRedirectResult, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import {
	Building2,
	Mail,
	UserCog,
	ChevronRight,
	LogIn,
	HelpCircle,
	Lock
} from 'lucide-react';

const Login = () => {
	const navigate = useNavigate();
	const [isLoggingIn, setIsLoggingIn] = useState(false);
	const [loginStatus, setLoginStatus] = useState('');

	// Tách logic xử lý User vào một hàm dùng chung
	const processUserLogin = async (user: any) => {
		try {
			setLoginStatus('Đang đồng bộ dữ liệu hệ thống...');
			const userRef = doc(db, 'users', user.uid);
			const inviteRef = doc(db, 'permissions', user.email || 'unknown');

			const [userSnap, inviteSnap] = await Promise.all([
				getDoc(userRef),
				getDoc(inviteRef)
			]);

			if (inviteSnap.exists()) {
				setLoginStatus('Phát hiện lời mời tham gia...');
				const inviteData = inviteSnap.data();
				await setDoc(userRef, {
					uid: user.uid,
					displayName: user.displayName || user.email?.split('@')[0] || 'User',
					email: user.email,
					photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${user.email}&background=random`,
					role: inviteData.role || 'sale',
					ownerId: inviteData.ownerId,
					ownerEmail: inviteData.ownerEmail,
					lastLogin: serverTimestamp(),
					createdAt: userSnap.exists() ? userSnap.data().createdAt : new Date().toISOString()
				}, { merge: true });
				await deleteDoc(inviteRef);
			} else if (!userSnap.exists()) {
				setLoginStatus('Khởi tạo tài khoản Admin mới...');
				await setDoc(userRef, {
					uid: user.uid,
					displayName: user.displayName || user.email?.split('@')[0] || 'Admin',
					email: user.email,
					photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${user.email}&background=random`,
					role: 'admin',
					ownerId: user.uid,
					ownerEmail: user.email,
					createdAt: new Date().toISOString()
				});
			} else {
				setLoginStatus('Cập nhật thông tin đăng nhập...');
				await setDoc(userRef, {
					lastLogin: serverTimestamp()
				}, { merge: true });
			}
			setLoginStatus('Thành công! Đang vào hệ thống...');
			navigate('/');
			setTimeout(() => {
				if (window.location.pathname.includes('/login')) {
					window.location.href = '/';
				}
			}, 500);
		} catch (err: any) {
			console.error("processUserLogin error:", err);
			setLoginStatus('Đăng nhập thành công (Cảnh báo: Lỗi đồng bộ DB)');
			navigate('/');
		}
	};

	// Kiểm tra kết quả redirect khi component mount
	useEffect(() => {
		let isMounted = true;
		const checkRedirectResult = async () => {
			try {
				await setPersistence(auth, browserLocalPersistence);
				const result = await getRedirectResult(auth);
				if (result?.user && isMounted) {
					setIsLoggingIn(true);
					await processUserLogin(result.user);
				}
			} catch (error: any) {
				console.error("Redirect check error:", error);
			}
		};
		checkRedirectResult();

		const unsubscribe = auth.onIdTokenChanged((user) => {
			if (user && !isLoggingIn && isMounted) {
				setIsLoggingIn(true);
				processUserLogin(user);
			}
		});

		return () => {
			isMounted = false;
			unsubscribe();
		};
	}, [isLoggingIn]);

	const handleGoogleLogin = async () => {
		try {
			setIsLoggingIn(true);
			setLoginStatus('Đang mở đăng nhập Google...');
			try {
				const result = await signInWithPopup(auth, googleProvider);
				if (result.user) await processUserLogin(result.user);
			} catch (popupError: any) {
				if (popupError.code === 'auth/popup-blocked') {
					await signInWithRedirect(auth, googleProvider);
				} else {
					throw popupError;
				}
			}
		} catch (error: any) {
			setIsLoggingIn(false);
			alert(`Lỗi đăng nhập: ${error.code}`);
			setLoginStatus('');
		}
	};

	return (
		<div className="min-h-screen w-full bg-white dark:bg-slate-950 flex font-['Manrope'] overflow-hidden">
			{/* Left Side - Hero Section */}
			<div className="hidden lg:flex lg:w-[60%] relative overflow-hidden bg-[#0A0E2E]">
				{/* Background Image with Monochromatic Filter */}
				<div
					className="absolute inset-0 bg-cover bg-center mix-blend-luminosity opacity-40 grayscale"
					style={{ backgroundImage: 'url("/assets/images/login-hero.png")' }}
				></div>

				{/* Gradient Overlays for depth */}
				<div className="absolute inset-0 bg-gradient-to-tr from-[#0A0E2E] via-[#0A0E2E]/60 to-transparent"></div>
				<div className="absolute inset-0 bg-[#1A237E]/20 pointer-events-none"></div>

				<div className="relative z-10 flex flex-col justify-end p-16 lg:p-24 h-full w-full">
					<div className="space-y-8 max-w-2xl transform transition-all duration-1000 animate-in fade-in slide-in-from-bottom-8">
						{/* Worker Icon */}
						<div className="size-16 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white shadow-2xl">
							<UserCog size={32} />
						</div>

						{/* Slogan */}
						<div className="space-y-6">
							<h1 className="text-5xl lg:text-6xl font-black text-white leading-[1.1] tracking-tight">
								Giải pháp quản lý <br />
								<span className="text-white">thực chiến cho <br />ngành xây dựng</span>
							</h1>
							<p className="text-lg lg:text-xl text-slate-300 font-medium max-w-xl leading-relaxed opacity-80">
								Tối ưu quy trình bán hàng, quản lý kho bãi và tiến độ thi công ngay trên thiết bị của bạn.
							</p>
						</div>

						{/* Decorative Line */}
						<div className="w-24 h-1 bg-white/30 rounded-full"></div>
					</div>
				</div>

				{/* Decorative Ambient Lights */}
				<div className="absolute top-24 right-24 size-96 bg-indigo-500/10 rounded-full blur-[120px]"></div>
				<div className="absolute bottom-24 left-24 size-64 bg-blue-600/10 rounded-full blur-[100px]"></div>
			</div>

			{/* Right Side - Login Action */}
			<div className="flex-1 flex flex-col relative z-20">
				{/* Corporate Header */}
				<div className="p-8 lg:p-12 flex justify-between items-center">
					<div className="flex items-center gap-3 group">
						<div className="size-10 bg-[#1A237E] rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
							<Building2 size={20} />
						</div>
						<span className="text-lg font-black tracking-tight text-[#1A237E] dark:text-white uppercase font-['Manrope']">Dunvex Build</span>
					</div>
				</div>

				{/* Main Content Form */}
				<div className="flex-1 flex flex-col items-center justify-center px-8 lg:px-24">
					<div className="w-full max-w-md space-y-12 animate-in fade-in zoom-in-95 duration-700">
						<div className="space-y-4">
							<h2 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-tight">
								Chào mừng bạn quay lại
							</h2>
							<p className="text-slate-500 dark:text-slate-400 font-medium">
								Đăng nhập để quản lý công việc ngay hôm nay.
							</p>
						</div>

						<div className="space-y-6">
							{/* Google Button */}
							<button
								onClick={handleGoogleLogin}
								disabled={isLoggingIn}
								className={`w-full group relative flex items-center justify-center h-16 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-600 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-300 ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-1 shadow-md hover:shadow-indigo-100 dark:hover:shadow-none'}`}
							>
								<div className="absolute left-6">
									<svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
										<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
										<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
										<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05"></path>
										<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1c-4.75 0-8.77 2.84-10.57 6.94l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
									</svg>
								</div>
								<span className="text-sm font-bold text-slate-700 dark:text-slate-200 tracking-wide">Tiếp tục với Google</span>
							</button>

							{/* Separator */}
							<div className="relative flex items-center gap-4">
								<div className="flex-1 h-px bg-slate-100 dark:bg-slate-800"></div>
								<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hoặc</span>
								<div className="flex-1 h-px bg-slate-100 dark:bg-slate-800"></div>
							</div>

							{/* Email Button */}
							<button className="w-full h-16 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold text-sm flex items-center justify-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
								<Mail size={18} />
								<span>Đăng nhập bằng Email</span>
							</button>
						</div>

						{loginStatus && (
							<div className="flex items-center gap-3 p-4 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100/50 dark:border-indigo-800/30 animate-pulse">
								<div className="size-2 bg-indigo-600 rounded-full animate-ping"></div>
								<p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">{loginStatus}</p>
							</div>
						)}
					</div>
				</div>

				{/* Footer - Support Section */}
				<div className="p-8 lg:p-12 mt-auto">
					<div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 border border-slate-100 dark:border-slate-800">
						<div className="flex items-center gap-4">
							<div className="size-12 bg-[#1A237E]/10 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-[#1A237E] dark:text-indigo-400">
								<HelpCircle size={24} />
							</div>
							<div>
								<p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Cần hỗ trợ kỹ thuật?</p>
								<a href="mailto:dunvex.green@gmail.com" className="text-sm font-black text-[#1A237E] dark:text-indigo-300 hover:underline">
									dunvex.green@gmail.com
								</a>
							</div>
						</div>
						<div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
							<Lock size={12} className="text-slate-300" />
							<span>Protected by Enterprise Security</span>
						</div>
					</div>

					<p className="mt-8 text-center text-[10px] text-slate-400 dark:text-slate-600 font-medium">
						© 2026 Dunvex Build • All Rights Reserved
					</p>
				</div>
			</div>
		</div>
	);
};

export default Login;
