import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider, db } from '../services/firebase';
import { signInWithPopup, signInWithRedirect, getRedirectResult, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

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
		<div className="min-h-screen w-full bg-[#FAFBFE] dark:bg-slate-950 flex flex-col md:flex-row overflow-hidden transition-colors duration-300 relative font-['Manrope']">
			{/* Desktop Left Side - Hero Section */}
			<div className="hidden md:flex md:w-[55%] relative overflow-hidden bg-[#1A237E]">
				<img
					alt="Construction Management"
					className="absolute inset-0 w-full h-full object-cover scale-110 opacity-40 mix-blend-overlay"
					src="https://images.unsplash.com/photo-1541888946425-d81bb19480c5?auto=format&fit=crop&q=80&w=2070"
				/>
				<div className="absolute inset-0 bg-gradient-to-br from-[#1A237E]/95 via-[#1A237E]/80 to-transparent"></div>

				<div className="relative z-10 flex flex-col justify-center px-16 lg:px-24 text-white max-w-4xl">
					<div className="flex items-center gap-4 mb-8">
						<div className="p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl">
							<span className="material-symbols-outlined text-white text-4xl">architecture</span>
						</div>
						<h1 className="text-4xl lg:text-5xl font-black tracking-tight leading-none">DUNVEX <span className="text-orange-400">BUILD</span></h1>
					</div>

					<h2 className="text-4xl lg:text-6xl font-black mb-8 leading-[1.1] tracking-tight">
						Chuyển đổi số<br />
						<span className="text-orange-400">Ngành Xây dựng</span>
					</h2>

					<p className="text-xl text-slate-300 max-w-xl leading-relaxed font-medium mb-12 opacity-90">
						Giải pháp quản trị bán hàng và công nợ tập trung dành riêng cho các doanh nghiệp vật liệu và thi công công trình.
					</p>

					<div className="flex items-center gap-12 pt-8 border-t border-white/10">
						<div className="flex flex-col">
							<span className="text-3xl font-black text-white">500+</span>
							<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Dự án kích hoạt</span>
						</div>
						<div className="flex flex-col">
							<span className="text-3xl font-black text-white">24/7</span>
							<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Hỗ trợ kỹ thuật</span>
						</div>
						<div className="flex flex-col">
							<span className="text-3xl font-black text-white">99%</span>
							<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Độ tin cậy</span>
						</div>
					</div>
				</div>
				<div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
				<div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-orange-500/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl"></div>
			</div>

			{/* Login Action Section */}
			<div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative bg-white dark:bg-slate-900 overflow-y-auto">
				{/* Decorative Background Elements for Right Side */}
				<div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05] hidden md:block">
					<div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(#1A237E_1px,transparent_1px)] [background-size:32px_32px]"></div>
				</div>

				<div className="w-full max-w-lg flex flex-col items-center relative z-10">
					{/* Mobile/Small Screen Branding */}
					<div className="md:hidden flex flex-col items-center mb-12">
						<div className="w-20 h-20 bg-[#1A237E] rounded-[2rem] flex items-center justify-center shadow-2xl mb-6 transform rotate-3">
							<span className="material-symbols-outlined text-white text-5xl">apartment</span>
						</div>
						<h1 className="text-3xl font-black text-[#1A237E] dark:text-white tracking-widest">DUNVEX BUILD</h1>
					</div>

					{/* Welcome Header */}
					<div className="text-center md:text-left w-full mb-12">
						<span className="inline-block py-1 px-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-full mb-4">
							Xác thực bảo mật
						</span>
						<h2 className="text-4xl font-black text-slate-900 dark:text-white mb-4 leading-tight">Chào mừng bạn trở lại</h2>
						<p className="text-slate-500 dark:text-slate-400 text-base font-medium">Bắt đầu quản trị doanh nghiệp của bạn một cách chuyên nghiệp.</p>
					</div>

					{/* Google Login Button - Primary Focus */}
					<div className="w-full space-y-6">
						<button
							onClick={handleGoogleLogin}
							disabled={isLoggingIn}
							className={`w-full flex items-center justify-center gap-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 hover:border-indigo-600 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-black h-16 rounded-[2rem] transition-all duration-500 group shadow-xl shadow-slate-200/50 dark:shadow-none ${isLoggingIn ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-1'}`}
						>
							<div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
								<svg className="w-6 h-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
									<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
									<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
									<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05"></path>
									<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1c-4.75 0-8.77 2.84-10.57 6.94l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
								</svg>
							</div>
							<span className="text-sm tracking-widest uppercase">{isLoggingIn ? 'Đang xác thực...' : 'Tiếp tục với Google'}</span>
						</button>

						{loginStatus && (
							<div className="flex items-center justify-center gap-3 py-4 px-6 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-500">
								<div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
								<p className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest">{loginStatus}</p>
							</div>
						)}
					</div>

					{/* Support Info */}
					<div className="mt-16 pt-8 w-full border-t border-slate-100 dark:border-slate-800">
						<div className="flex flex-col items-center md:items-start">
							<p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.2em] mb-4">Hỗ trợ đối tác 24/7</p>
							<div className="flex gap-4">
								<a className="flex items-center gap-3 px-6 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl group hover:bg-[#1A237E] transition-all duration-300 border border-slate-100 dark:border-slate-800" href="tel:0909123456">
									<span className="material-symbols-outlined text-[#1A237E] dark:text-indigo-400 group-hover:text-white text-xl">support_agent</span>
									<span className="text-sm font-black text-[#1A237E] dark:text-indigo-400 group-hover:text-white">0909 123 456</span>
								</a>
								<div className="hidden sm:flex items-center gap-3 px-6 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
									<span className="material-symbols-outlined text-slate-400 text-xl">security</span>
									<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TLS 1.3 Encryption</span>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Diagnostic Info Footer - Fixed bottom of right content */}
				<div className="mt-auto pt-12 text-[9px] text-slate-400 dark:text-slate-600 font-mono text-center flex flex-col gap-1 opacity-40">
					<p>© 2024 Dunvex Build Technology Solutions</p>
					<p>Domain: {window.location.hostname} • Auth: Google • SSL: Active</p>
					<p>Build: 2.0.4-PRO • Security Level: High</p>
				</div>
			</div>

			{/* Online Status Badge (LG only) */}
			<div className="hidden lg:flex fixed bottom-8 right-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-2xl border border-white dark:border-slate-800 rounded-2xl py-3 px-6 items-center gap-4 hover:-translate-y-1 transition-all cursor-pointer z-50 group">
				<div className="relative">
					<div className="w-3 h-3 rounded-full bg-emerald-500"></div>
					<div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-500 animate-ping opacity-75"></div>
				</div>
				<span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">Hệ thống đang Online</span>
			</div>
		</div>
	);
};

export default Login;
