import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider, db } from '../services/firebase';
import { signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
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
					displayName: user.displayName,
					email: user.email,
					photoURL: user.photoURL,
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
					displayName: user.displayName,
					email: user.email,
					photoURL: user.photoURL,
					role: 'admin',
					ownerId: user.uid,
					ownerEmail: user.email,
					createdAt: new Date().toISOString()
				});
			} else {
				setLoginStatus('Cập nhật thông tin đăng nhập...');
				await setDoc(userRef, {
					displayName: user.displayName,
					photoURL: user.photoURL,
					lastLogin: serverTimestamp()
				}, { merge: true });
			}
			setLoginStatus('Thành công! Đang chuyển hướng...');
			setTimeout(() => {
				if (window.location.pathname === '/login') {
					navigate('/');
				}
			}, 800);
		} catch (err: any) {
			console.error("processUserLogin error:", err);
			setLoginStatus('Lỗi đồng bộ: ' + (err.code || err.message));
			setIsLoggingIn(false);
		}
	};

	// Kiểm tra kết quả redirect khi component mount
	useEffect(() => {
		let isMounted = true;

		const checkRedirectResult = async () => {
			try {
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

		// Dự phòng: Nếu Firebase Auth đã có user (vừa redirect xong và auth state đã kịp update)
		const unsubscribe = auth.onAuthStateChanged((user) => {
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
			setLoginStatus('Đang kết nối với Google...');

			// Detect if mobile (especially in-app browsers)
			const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
			const isInAppBrowser = /FBAN|FBAV|Instagram|Zalo|Line/i.test(navigator.userAgent);

			if (isMobile || isInAppBrowser) {
				setLoginStatus('Vui lòng đợi chuyển hướng...');
				await signInWithRedirect(auth, googleProvider);
			} else {
				const result = await signInWithPopup(auth, googleProvider);
				if (result.user) {
					await processUserLogin(result.user);
				}
			}
		} catch (error: any) {
			console.error("Login trigger error:", error);
			setIsLoggingIn(false);
			setLoginStatus('');

			const errorMsg = error.message || "Lỗi không xác định";
			const errorCode = error.code || "no-code";

			if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
				alert(`Đăng nhập thất bại.\nMã lỗi: ${errorCode}\nChi tiết: ${errorMsg}`);
			}
		}
	};

	return (
		<div className="min-h-screen w-full bg-[#F8FAFC] dark:bg-slate-950 flex flex-col md:flex-row overflow-x-hidden transition-colors duration-300">
			{/* Desktop Left Side - Hero Section */}
			<div className="hidden md:flex md:w-1/2 lg:w-[60%] relative overflow-hidden bg-[#1A237E]">
				<img
					alt="Construction Site"
					className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-multiply"
					src="https://images.unsplash.com/photo-1541888946425-d81bb19480c5?auto=format&fit=crop&q=80&w=2070"
				/>
				<div className="relative z-10 flex flex-col justify-center px-12 lg:px-24 text-white">
					<div className="flex items-center gap-3 mb-6">
						<div className="p-2 bg-[#FF6D00] rounded-lg shadow-lg">
							<span className="material-symbols-outlined text-white text-3xl">architecture</span>
						</div>
						<h1 className="text-4xl font-extrabold tracking-tight">Dunvex Build</h1>
					</div>
					<h2 className="text-3xl font-bold mb-4">Hệ thống quản lý bán hàng <br />ngành xây dựng hiện đại</h2>
					<p className="text-lg text-slate-300 max-w-lg leading-relaxed">
						Tối ưu quy trình, quản lý tinh gọn và bứt phá doanh thu cùng giải pháp công nghệ chuyên biệt cho doanh nghiệp xây dựng.
					</p>
					<div className="mt-12 flex gap-8">
						<div className="flex flex-col">
							<span className="text-2xl font-bold text-[#FF6D00]">500+</span>
							<span className="text-sm text-slate-400">Dự án triển khai</span>
						</div>
						<div className="flex flex-col">
							<span className="text-2xl font-bold text-[#FF6D00]">99%</span>
							<span className="text-sm text-slate-400">Tỉ lệ hài lòng</span>
						</div>
					</div>
				</div>
				<div className="absolute inset-0 pointer-events-none opacity-5 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]"></div>
			</div>

			{/* Login Form Section */}
			<div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 lg:p-24 bg-white dark:bg-slate-900 md:bg-transparent md:dark:bg-transparent transition-colors duration-300">
				<div className="w-full max-w-md bg-white dark:bg-slate-900 p-8 md:p-10 rounded-2xl md:shadow-2xl md:border md:border-slate-100 dark:md:border-slate-800 flex flex-col items-center transition-colors duration-300">
					{/* Mobile Logo */}
					<div className="md:hidden flex flex-col items-center mb-8">
						<div className="w-20 h-20 bg-[#1A237E] rounded-2xl flex items-center justify-center shadow-xl mb-4">
							<span className="material-symbols-outlined text-white text-5xl">apartment</span>
						</div>
						<h1 className="text-2xl font-black text-[#1A237E] dark:text-white tracking-tight">DUNVEX BUILD</h1>
					</div>

					<div className="w-full text-center md:text-left mb-10">
						<h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Chào mừng bạn trở lại</h2>
						<p className="text-slate-500 dark:text-slate-400 text-sm">Vui lòng đăng nhập bằng Google để truy cập hệ thống.</p>
					</div>

					<div className="w-full space-y-4">
						<button
							onClick={handleGoogleLogin}
							disabled={isLoggingIn}
							className={`w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-800 border-2 border-[#1A237E]/10 dark:border-slate-700 hover:border-[#1A237E] dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold h-14 rounded-xl transition-all duration-300 group shadow-sm ${isLoggingIn ? 'opacity-70 cursor-not-allowed border-indigo-500' : ''}`}
						>
							{isLoggingIn ? (
								<div className="w-5 h-5 border-2 border-[#1A237E] border-t-transparent rounded-full animate-spin"></div>
							) : (
								<svg className="w-6 h-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
									<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
									<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
									<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05"></path>
									<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1c-4.75 0-8.77 2.84-10.57 6.94l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
								</svg>
							)}
							<span>{isLoggingIn ? (loginStatus || 'Đang xử lý...') : 'Đăng nhập với Google'}</span>
						</button>

						{loginStatus && (
							<p className="text-center text-[11px] font-bold text-indigo-600 dark:text-indigo-400 animate-pulse bg-indigo-50 dark:bg-indigo-900/20 py-2 rounded-lg border border-indigo-100 dark:border-indigo-800">
								{loginStatus}
							</p>
						)}

						<div className="relative flex py-4 items-center">
							<div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
							<span className="flex-shrink-0 mx-4 text-slate-400 dark:text-slate-500 text-[11px] font-bold uppercase tracking-widest">DUNVEX</span>
							<div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
						</div>

						<p className="text-center text-slate-400 dark:text-slate-500 text-xs">Phần mềm quản lý VLXD chuyên biệt</p>
					</div>

					<div className="mt-10 p-4 rounded-xl bg-[#FF6D00]/5 dark:bg-[#FF6D00]/10 border border-[#FF6D00]/20 dark:border-[#FF6D00]/30 flex gap-3 items-start">
						<span className="material-symbols-outlined text-[#FF6D00] text-[20px] mt-0.5">verified_user</span>
						<p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed text-left">
							Dữ liệu được lưu trữ bảo mật trên hệ thống Cloud của <span className="font-bold text-[#1A237E] dark:text-indigo-400">Firebase (Google)</span>.
						</p>
					</div>

					<div className="mt-auto pt-10 w-full">
						<div className="flex flex-col items-center justify-center border-t border-slate-100 dark:border-slate-800 pt-6">
							<p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-3">Hỗ trợ kỹ thuật 24/7</p>
							<a className="flex items-center gap-3 group" href="tel:0909123456">
								<div className="w-10 h-10 rounded-full bg-[#1A237E]/5 dark:bg-indigo-500/10 group-hover:bg-[#1A237E] dark:group-hover:bg-indigo-600 transition-colors flex items-center justify-center">
									<span className="material-symbols-outlined text-[#1A237E] dark:text-indigo-400 group-hover:text-white text-[20px]">support_agent</span>
								</div>
								<span className="text-sm font-bold text-[#1A237E] dark:text-indigo-400">0909 123 456</span>
							</a>
						</div>
					</div>
				</div>

				<p className="mt-8 text-[11px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-[2px]">
					© 2024 Dunvex Build Technology Solutions
				</p>
			</div>

			{/* Online Status Badge (LG only) */}
			<div className="hidden lg:flex fixed bottom-6 right-6 bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 rounded-full py-2 px-6 items-center gap-3 hover:scale-105 transition-transform cursor-pointer">
				<div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
				<span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Hệ thống hoạt động ổn định</span>
			</div>
		</div>
	);
};

export default Login;
