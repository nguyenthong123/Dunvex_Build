import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '../services/firebase';
import { setSQLiteSession } from '../services/sqliteSession';
import { apiUrl, setApiCredentials } from '../services/apiClient';
import { isNativeApp } from '../utils/platform';
import {
	Building2,
	Mail,
	UserCog,
	ChevronRight,
	LogIn,
	HelpCircle,
	Lock,
	Eye,
	EyeOff,
	KeyRound,
	ArrowLeft,
	CheckCircle2,
	RefreshCw,
	X,
	Fingerprint,
	ScanFace,
	ShieldCheck,
	Download
} from 'lucide-react';
import { useToast } from '../components/shared/Toast';
import { biometricAuth } from '../services/biometricAuthService';

const Login = () => {
	const navigate = useNavigate();
	const isProcessingRef = useRef(false);
	const [isLoggingIn, setIsLoggingIn] = useState(false);
	const [loginStatus, setLoginStatus] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [isRegistering, setIsRegistering] = useState(false);
	const [supportsBiometrics, setSupportsBiometrics] = useState(false);
	const [hasSavedBiometrics, setHasSavedBiometrics] = useState(false);
	const [biometricLabel, setBiometricLabel] = useState('Vân tay (Touch ID)');
	const [biometryType, setBiometryType] = useState('none');
	const [rememberAccount, setRememberAccount] = useState(true);
	const { showToast } = useToast();

	// Check biometric support and load remembered account
	useEffect(() => {
		biometricAuth.getBiometricDetails().then(details => {
			setSupportsBiometrics(details.available);
			setBiometricLabel(details.label);
			setBiometryType(details.biometryType);
		});
		const saved = biometricAuth.hasBiometricProfile();
		setHasSavedBiometrics(saved);

		// Tự động nạp tài khoản và mật khẩu đã ghi nhớ
		const creds = biometricAuth.getSavedCredentials();
		if (creds && creds.email) {
			setEmail(creds.email);
			if (creds.password) {
				setPassword(creds.password);
			}
			setRememberAccount(true);
		} else {
			const savedEmail = biometricAuth.getSavedBiometricEmail() || biometricAuth.getRememberedEmail();
			if (savedEmail) setEmail(savedEmail);
		}
	}, []);

	const handleEmailChange = (val: string) => {
		setEmail(val);
		const creds = biometricAuth.getSavedCredentials(val.trim());
		if (creds && creds.password) {
			setPassword(creds.password);
			setRememberAccount(true);
		}
	};

	const handleBiometricLogin = async () => {
		setIsLoggingIn(true);
		setLoginStatus(`Đang xác thực ${biometricLabel}...`);
		try {
			const res = await biometricAuth.authenticate(`Đăng nhập vào Dunvex Build bằng ${biometricLabel}`);
			if (res.success) {
				if (res.profile && res.profile.userSession) {
					setSQLiteSession(res.profile.userSession, res.profile.token || '');
					setLoginStatus(`Xác thực ${biometricLabel} thành công! Đang vào hệ thống...`);
					showToast(`Đăng nhập bằng ${biometricLabel} thành công!`, 'success');
					await processUserLogin(res.profile.userSession);
					return;
				}

				// Nếu có thông tin email/mật khẩu đã lưu trên máy
				const targetEmail = email.trim() || res.profile?.email || biometricAuth.getRememberedEmail();
				const creds = res.savedCredential || biometricAuth.getSavedCredentials(targetEmail);
				if (creds && creds.email && creds.password) {
					setEmail(creds.email);
					setPassword(creds.password);
					setLoginStatus(`${biometricLabel} hợp lệ! Đang vào hệ thống...`);
					showToast(`Xác thực ${biometricLabel} thành công!`, 'success');
					await executeLogin(creds.email, creds.password);
					return;
				}

				setIsLoggingIn(false);
				setLoginStatus('');
				showToast(`${biometricLabel} hợp lệ! Vui lòng nhập mật khẩu lần đầu để hoàn tất ghi nhớ.`, 'info');
			} else {
				setIsLoggingIn(false);
				setLoginStatus('');
				showToast(res.error || `Xác thực ${biometricLabel} không thành công`, 'error');
			}
		} catch (err: any) {
			setIsLoggingIn(false);
			setLoginStatus('');
			showToast(err.message || `Lỗi xác thực ${biometricLabel}`, 'error');
		}
	};

	const processUserLogin = async (user: any) => {
		if (isProcessingRef.current) return;
		isProcessingRef.current = true;
		try {
			const ownerId = user.ownerId || user.uid;
			if (!user.uid || !ownerId) throw new Error('Hồ sơ SQLite thiếu mã người dùng hoặc owner.');

			const sessionObj = {
				...user,
				ownerId,
				displayName: user.displayName || user.email?.split('@')[0],
			};
			setApiCredentials('', ownerId);
			localStorage.setItem('dunvex_user_session', JSON.stringify(sessionObj));
			window.dispatchEvent(new CustomEvent('dunvex_login', { detail: sessionObj }));
			
			// Tải và cài đặt chứng chỉ bản quyền (offline-proof license) ngay khi đăng nhập
			try {
				const { licenseService } = await import('../services/licenseService');
				await licenseService.refreshLicense(true);
			} catch (licErr) {
				console.warn('[Login] License refresh:', licErr);
			}

			setLoginStatus('Thành công! Đang vào hệ thống...');
			navigate('/', { replace: true });
		} catch (err: any) {
			setIsLoggingIn(false);
			setLoginStatus('Không tải được dữ liệu tài khoản. Phiên đăng nhập chưa được mở.');
			showToast(err.message || 'Không thể mở phiên SQLite.', 'error');
		} finally {
			isProcessingRef.current = false;
		}
	};

	// Lắng nghe đăng nhập thành công để chuyển hướng mượt mà
	useEffect(() => {
		let isMounted = true;
		const unsubscribe = auth.onAuthStateChanged((user) => {
			if (user && isMounted && !isProcessingRef.current) {
				setIsLoggingIn(true);
				setLoginStatus('Đăng nhập thành công! Đang vào hệ thống...');
				processUserLogin(user);
			}
		});

		return () => {
			isMounted = false;
			unsubscribe();
		};
	}, [navigate]);

	// State cho Modal Đăng ký mới qua OTP
	const [showRegisterOtpModal, setShowRegisterOtpModal] = useState(false);
	const [registerOtp, setRegisterOtp] = useState('');
	const [registerOtpCountdown, setRegisterOtpCountdown] = useState(0);
	const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);

	useEffect(() => {
		if (registerOtpCountdown <= 0) return;
		const timer = setInterval(() => {
			setRegisterOtpCountdown(prev => (prev > 0 ? prev - 1 : 0));
		}, 1000);
		return () => clearInterval(timer);
	}, [registerOtpCountdown]);

	const handleRequestRegisterOtp = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		if (!email || !email.includes('@')) {
			showToast("Vui lòng nhập địa chỉ email hợp lệ", "error");
			return;
		}
		if (!password || password.length < 6) {
			showToast("Mật khẩu phải có ít nhất 6 ký tự", "error");
			return;
		}

		try {
			setIsSubmittingRegister(true);
			const res = await fetch(apiUrl('/api/auth/send-otp'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: email.trim(), type: 'register' })
			});
			const data = await res.json();
			if (!res.ok || data.error) {
				throw new Error(data.error || 'Gửi mã OTP xác thực đăng ký thất bại');
			}

			setRegisterOtp('');
			setRegisterOtpCountdown(60);
			setShowRegisterOtpModal(true);
			showToast(data.message || `Đã gửi mã OTP đến ${email.trim()}`, "success");
		} catch (err: any) {
			showToast(err.message || "Lỗi gửi mã xác thực", "error");
		} finally {
			setIsSubmittingRegister(false);
		}
	};

	const handleVerifyAndRegister = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!registerOtp || registerOtp.trim().length !== 6) {
			showToast("Vui lòng nhập đúng 6 chữ số mã OTP", "error");
			return;
		}

		try {
			setIsSubmittingRegister(true);
			setLoginStatus('Đang xác thực OTP & khởi tạo tài khoản...');
			const res = await fetch(apiUrl('/api/auth/verify-register'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: email.trim(),
					otp: registerOtp.trim(),
					password: password
				})
			});
			const data = await res.json();
			if (!res.ok || data.error) {
				throw new Error(data.error || 'Xác thực đăng ký thất bại');
			}

			if (data.sessionToken && data.user) {
				setSQLiteSession(data.user, data.sessionToken);
				setShowRegisterOtpModal(false);
				showToast("Đăng ký tài khoản thành công!", "success");
				setLoginStatus('Đang vào hệ thống...');
				await processUserLogin(data.user);
				return;
			}
			setShowRegisterOtpModal(false);
			setIsRegistering(false);
			showToast("Đăng ký thành công! Vui lòng đăng nhập với mật khẩu vừa tạo.", "success");
		} catch (err: any) {
			showToast(err.message || "Lỗi xác thực đăng ký", "error");
		} finally {
			setIsSubmittingRegister(false);
			setLoginStatus('');
		}
	};

	const executeLogin = async (loginEmail: string, loginPassword: string) => {
		try {
			setIsLoggingIn(true);
			setLoginStatus('Đang xác thực tài khoản...');
			
			const response = await fetch(apiUrl('/api/auth/login'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword })
			});

			const data = await response.json();
			if (!response.ok || data.error) {
				throw new Error(data.error || 'Đăng nhập thất bại. Vui lòng thử lại.');
			}
			if (!data.sessionToken || !data.user) {
				throw new Error('Máy chủ chưa cấp được phiên đăng nhập. Vui lòng thử lại sau.');
			}
			setSQLiteSession(data.user, data.sessionToken);

			// Ghi nhớ tài khoản & mật khẩu trên thiết bị này
			if (rememberAccount) {
				biometricAuth.saveCredentials(loginEmail.trim(), loginPassword);
			} else {
				biometricAuth.removeSavedCredentials(loginEmail.trim());
			}

			setLoginStatus('Đăng nhập thành công! Đang vào hệ thống...');
			await processUserLogin(data.user);
		} catch (error: any) {
			setIsLoggingIn(false);
			setLoginStatus('');
			if (error instanceof TypeError) {
				showToast('Không kết nối được máy chủ. Vui lòng kiểm tra mạng hoặc thử lại.', 'error');
			} else {
				showToast(error.message || "Email hoặc mật khẩu không chính xác", "error");
			}
		}
	};

	const handleEmailLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!email || !password) {
			showToast("Vui lòng nhập đầy đủ email và mật khẩu", "error");
			return;
		}
		if (password.length < 6) {
			showToast("Mật khẩu phải có ít nhất 6 ký tự", "error");
			return;
		}

		// Nếu đang ở chế độ đăng ký: Bắt buộc gửi mã OTP về email để xác thực email thật
		if (isRegistering) {
			await handleRequestRegisterOtp();
			return;
		}

		await executeLogin(email, password);
	};

	// State cho Modal Quên mật khẩu qua OTP
	const [showForgotModal, setShowForgotModal] = useState(false);
	const [forgotEmail, setForgotEmail] = useState('');
	const [forgotOtp, setForgotOtp] = useState('');
	const [forgotNewPass, setForgotNewPass] = useState('');
	const [forgotConfirmPass, setForgotConfirmPass] = useState('');
	const [showForgotPass, setShowForgotPass] = useState(false);
	const [forgotStep, setForgotStep] = useState<1 | 2>(1);
	const [otpCountdown, setOtpCountdown] = useState(0);
	const [isSubmittingForgot, setIsSubmittingForgot] = useState(false);

	useEffect(() => {
		if (otpCountdown <= 0) return;
		const timer = setInterval(() => {
			setOtpCountdown(prev => (prev > 0 ? prev - 1 : 0));
		}, 1000);
		return () => clearInterval(timer);
	}, [otpCountdown]);

	const handleOpenForgotModal = () => {
		setForgotEmail(email.trim());
		setForgotOtp('');
		setForgotNewPass('');
		setForgotConfirmPass('');
		setForgotStep(1);
		setShowForgotModal(true);
	};

	const handleSendOtp = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		if (!forgotEmail || !forgotEmail.includes('@')) {
			showToast("Vui lòng nhập địa chỉ email hợp lệ", "error");
			return;
		}
		try {
			setIsSubmittingForgot(true);
			const res = await fetch(apiUrl('/api/auth/send-otp'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: forgotEmail.trim(), type: 'reset_password' })
			});
			const data = await res.json();
			if (!res.ok || data.error) {
				throw new Error(data.error || 'Gửi mã OTP thất bại');
			}
			setForgotStep(2);
			setOtpCountdown(60);
			showToast(data.message || "Đã gửi mã OTP đến email của bạn", "success");
		} catch (err: any) {
			showToast(err.message || "Lỗi gửi mã OTP", "error");
		} finally {
			setIsSubmittingForgot(false);
		}
	};

	const handleVerifyAndResetPassword = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!forgotOtp || forgotOtp.trim().length !== 6) {
			showToast("Vui lòng nhập đúng 6 chữ số mã OTP", "error");
			return;
		}
		if (!forgotNewPass || forgotNewPass.length < 6) {
			showToast("Mật khẩu mới phải có ít nhất 6 ký tự", "error");
			return;
		}
		if (forgotNewPass !== forgotConfirmPass) {
			showToast("Mật khẩu xác nhận không khớp", "error");
			return;
		}
		try {
			setIsSubmittingForgot(true);
			const res = await fetch(apiUrl('/api/auth/verify-reset-password'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: forgotEmail.trim(),
					otp: forgotOtp.trim(),
					newPassword: forgotNewPass
				})
			});
			const data = await res.json();
			if (!res.ok || data.error) {
				throw new Error(data.error || 'Đặt lại mật khẩu thất bại');
			}
			showToast("Đổi mật khẩu thành công!", "success");

			if (data.sessionToken && data.user) {
				setSQLiteSession(data.user, data.sessionToken);
				setShowForgotModal(false);
				setLoginStatus('Đăng nhập thành công! Đang vào hệ thống...');
				await processUserLogin(data.user);
				return;
			}
			setShowForgotModal(false);
			setPassword('');
			showToast("Vui lòng đăng nhập với mật khẩu mới.", "success");
		} catch (err: any) {
			showToast(err.message || "Lỗi đặt lại mật khẩu", "error");
		} finally {
			setIsSubmittingForgot(false);
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
					{!isNativeApp() && (
						<Link
							to="/download"
							className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-all shadow-sm border border-indigo-100 dark:border-slate-700"
						>
							<Download size={13} />
							<span>Tải ứng dụng</span>
						</Link>
					)}
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

						<div className="space-y-4">
							{/* Nút đăng nhập sinh trắc học: CHỈ hiển thị khi máy hỗ trợ VÀ người dùng đã bật trong Cài Đặt */}
							{supportsBiometrics && hasSavedBiometrics && (
								<div className="space-y-3">
									<button
										type="button"
										onClick={handleBiometricLogin}
										disabled={isLoggingIn}
										className="w-full h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-3 group"
									>
										<div className="p-2 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
											{biometryType === 'faceID' ? (
												<ScanFace className="w-5 h-5 text-white" />
											) : (
												<Fingerprint className="w-5 h-5 text-white" />
											)}
										</div>
										<span>Đăng nhập bằng {biometricLabel}</span>
									</button>

									<div className="flex items-center gap-3 my-4">
										<div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
										<span className="text-xs font-bold text-slate-400 uppercase">Hoặc đăng nhập mật khẩu</span>
										<div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
									</div>
								</div>
							)}

							<form onSubmit={handleEmailLogin} className="space-y-4 animate-in fade-in slide-in-from-top-2">
									<div className="space-y-3">
										<input
											type="email"
											placeholder="Nhập email của bạn"
											value={email}
											autoComplete="username"
											onChange={(e) => handleEmailChange(e.target.value)}
											className="w-full h-14 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
											disabled={isLoggingIn}
										/>
										<div className="relative">
											<input
												type={showPassword ? "text" : "password"}
												placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
												value={password}
												autoComplete="current-password"
												onChange={(e) => setPassword(e.target.value)}
												className="w-full h-14 px-4 pr-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
												disabled={isLoggingIn}
											/>
											<button
												type="button"
												onClick={() => setShowPassword(!showPassword)}
												className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg focus:outline-none transition-colors"
												title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
											>
												{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
											</button>
										</div>

										<div className="flex items-center justify-between px-1 pt-1">
											<label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
												<input
													type="checkbox"
													checked={rememberAccount}
													onChange={(e) => setRememberAccount(e.target.checked)}
													className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
												/>
												<span>Ghi nhớ tài khoản & mật khẩu</span>
											</label>

											{!isRegistering && (
												<button
													type="button"
													onClick={handleOpenForgotModal}
													disabled={isLoggingIn}
													className="text-xs font-bold text-[#1A237E] dark:text-indigo-400 hover:underline focus:outline-none"
												>
													Quên mật khẩu?
												</button>
											)}
										</div>
									</div>
									<div>
										<button
											type="submit"
											disabled={isLoggingIn || !email || !password}
											className="w-full h-14 rounded-xl bg-[#1A237E] hover:bg-[#283593] text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
										>
											{isRegistering ? 'Đăng ký ngay' : 'Đăng nhập'}
										</button>
									</div>
									<div className="text-center mt-4">
										<p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
											{isRegistering ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
											<button 
												type="button" 
												onClick={() => setIsRegistering(!isRegistering)}
												className="ml-1 text-[#1A237E] dark:text-indigo-400 font-bold hover:underline focus:outline-none"
												disabled={isLoggingIn}
											>
												{isRegistering ? 'Đăng nhập' : 'Tạo tài khoản mới'}
											</button>
										</p>
									</div>
							</form>
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

			{/* Modal Đặt lại Mật khẩu qua OTP từ dunvex.green@gmail.com */}
			{showForgotModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
					<div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 p-6 sm:p-8 overflow-hidden">
						{/* Nút đóng */}
						<button
							type="button"
							onClick={() => setShowForgotModal(false)}
							className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
						>
							<X size={20} />
						</button>

						{/* Header Modal */}
						<div className="flex items-center gap-3 mb-6">
							<div className="size-12 rounded-2xl bg-[#1A237E]/10 dark:bg-indigo-900/30 text-[#1A237E] dark:text-indigo-400 flex items-center justify-center">
								<KeyRound size={24} />
							</div>
							<div>
								<h3 className="text-lg font-black text-slate-900 dark:text-white">Đặt lại mật khẩu</h3>
								<p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
									Gửi mã OTP từ <span className="font-bold text-[#1A237E] dark:text-indigo-400">dunvex.green@gmail.com</span>
								</p>
							</div>
						</div>

						{/* BƯỚC 1: Nhập Email để nhận mã OTP */}
						{forgotStep === 1 && (
							<form onSubmit={handleSendOtp} className="space-y-4">
								<div>
									<label className="block text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
										Email tài khoản
									</label>
									<div className="relative">
										<Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
										<input
											type="email"
											required
											value={forgotEmail}
											onChange={(e) => setForgotEmail(e.target.value)}
											placeholder="tenban@gmail.com"
											disabled={isSubmittingForgot}
											className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A237E] transition-all text-sm font-semibold"
										/>
									</div>
									<p className="text-[11px] text-slate-400 mt-2">
										Mã xác thực 6 chữ số có hiệu lực trong 5 phút sẽ được gửi đến email này.
									</p>
								</div>

								<div className="pt-2 flex gap-3">
									<button
										type="button"
										onClick={() => setShowForgotModal(false)}
										disabled={isSubmittingForgot}
										className="h-12 px-5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
									>
										Đóng
									</button>
									<button
										type="submit"
										disabled={isSubmittingForgot || !forgotEmail}
										className="flex-1 h-12 rounded-xl bg-[#1A237E] hover:bg-[#283593] text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
									>
										{isSubmittingForgot ? (
											<>
												<div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
												<span>Đang gửi mã...</span>
											</>
										) : (
											<span>Gửi mã OTP</span>
										)}
									</button>
								</div>
							</form>
						)}

						{/* BƯỚC 2: Nhập OTP và Mật khẩu mới */}
						{forgotStep === 2 && (
							<form onSubmit={handleVerifyAndResetPassword} className="space-y-4">
								<div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 flex items-center justify-between">
									<div className="text-xs">
										<span className="text-slate-500 dark:text-slate-400">Đã gửi mã đến: </span>
										<span className="font-bold text-[#1A237E] dark:text-indigo-400">{forgotEmail}</span>
									</div>
									<button
										type="button"
										onClick={() => setForgotStep(1)}
										className="text-[11px] font-bold text-[#FF6D00] hover:underline"
									>
										Đổi email
									</button>
								</div>

								<div>
									<label className="block text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
										Mã xác thực OTP (6 chữ số)
									</label>
									<input
										type="text"
										required
										maxLength={6}
										value={forgotOtp}
										onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
										placeholder="------"
										disabled={isSubmittingForgot}
										className="w-full h-14 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-slate-50 dark:bg-slate-950 text-center font-mono text-2xl font-black tracking-[0.4em] text-[#1A237E] dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-[#1A237E] transition-all"
									/>
									<div className="flex items-center justify-between mt-2">
										<span className="text-[11px] text-slate-400">Hiệu lực 5 phút</span>
										{otpCountdown > 0 ? (
											<span className="text-[11px] font-bold text-slate-400">
												Gửi lại mã sau {otpCountdown}s
											</span>
										) : (
											<button
												type="button"
												onClick={() => handleSendOtp()}
												disabled={isSubmittingForgot}
												className="text-[11px] font-bold text-[#1A237E] dark:text-indigo-400 hover:underline flex items-center gap-1"
											>
												<RefreshCw size={12} />
												<span>Gửi lại mã OTP</span>
											</button>
										)}
									</div>
								</div>

								<div>
									<label className="block text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
										Mật khẩu mới (tối thiểu 6 ký tự)
									</label>
									<div className="relative">
										<Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
										<input
											type={showForgotPass ? "text" : "password"}
											required
											value={forgotNewPass}
											onChange={(e) => setForgotNewPass(e.target.value)}
											placeholder="Nhập mật khẩu mới"
											disabled={isSubmittingForgot}
											className="w-full h-12 pl-11 pr-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A237E] transition-all text-sm font-semibold"
										/>
										<button
											type="button"
											onClick={() => setShowForgotPass(!showForgotPass)}
											className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
										>
											{showForgotPass ? <EyeOff size={18} /> : <Eye size={18} />}
										</button>
									</div>
								</div>

								<div>
									<label className="block text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
										Xác nhận mật khẩu mới
									</label>
									<div className="relative">
										<Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
										<input
											type={showForgotPass ? "text" : "password"}
											required
											value={forgotConfirmPass}
											onChange={(e) => setForgotConfirmPass(e.target.value)}
											placeholder="Nhập lại mật khẩu mới"
											disabled={isSubmittingForgot}
											className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A237E] transition-all text-sm font-semibold"
										/>
									</div>
								</div>

								<div className="pt-2 flex gap-3">
									<button
										type="button"
										onClick={() => setForgotStep(1)}
										disabled={isSubmittingForgot}
										className="h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5"
									>
										<ArrowLeft size={16} />
										<span>Quay lại</span>
									</button>
									<button
										type="submit"
										disabled={isSubmittingForgot || !forgotOtp || !forgotNewPass || !forgotConfirmPass}
										className="flex-1 h-12 rounded-xl bg-gradient-to-r from-[#1A237E] to-indigo-700 hover:opacity-95 text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
									>
										{isSubmittingForgot ? (
											<>
												<div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
												<span>Đang xác nhận...</span>
											</>
										) : (
											<span>Xác nhận & Đăng nhập</span>
										)}
									</button>
								</div>
							</form>
						)}
					</div>
				</div>
			)}

			{/* Modal Xác thực OTP Đăng ký tài khoản mới */}
			{showRegisterOtpModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
					<div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 p-6 sm:p-8 overflow-hidden">
						{/* Nút đóng */}
						<button
							type="button"
							onClick={() => setShowRegisterOtpModal(false)}
							className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
						>
							<X size={20} />
						</button>

						{/* Header Modal */}
						<div className="flex items-center gap-3 mb-6">
							<div className="size-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
								<ShieldCheck size={26} />
							</div>
							<div>
								<h3 className="text-lg font-black text-slate-900 dark:text-white">Xác thực đăng ký</h3>
								<p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
									Mã OTP từ <span className="font-bold text-[#1A237E] dark:text-indigo-400">dunvex.green@gmail.com</span>
								</p>
							</div>
						</div>

						<form onSubmit={handleVerifyAndRegister} className="space-y-4">
							<div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-100 dark:border-emerald-800/60 flex items-center justify-between">
								<div className="text-xs">
									<span className="text-slate-500 dark:text-slate-400">Xác thực email: </span>
									<span className="font-bold text-emerald-700 dark:text-emerald-300">{email}</span>
								</div>
								<button
									type="button"
									onClick={() => setShowRegisterOtpModal(false)}
									className="text-[11px] font-bold text-emerald-600 hover:underline"
								>
									Sửa email
								</button>
							</div>

							<div>
								<label className="block text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
									Nhập mã OTP (6 chữ số)
								</label>
								<input
									type="text"
									required
									maxLength={6}
									autoFocus
									value={registerOtp}
									onChange={(e) => setRegisterOtp(e.target.value.replace(/\D/g, ''))}
									placeholder="------"
									disabled={isSubmittingRegister}
									className="w-full h-14 rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-slate-50 dark:bg-slate-950 text-center font-mono text-2xl font-black tracking-[0.4em] text-emerald-700 dark:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
								/>
								<div className="flex items-center justify-between mt-2">
									<span className="text-[11px] text-slate-400">Hiệu lực trong 5 phút</span>
									{registerOtpCountdown > 0 ? (
										<span className="text-[11px] font-bold text-slate-400">
											Gửi lại mã sau {registerOtpCountdown}s
										</span>
									) : (
										<button
											type="button"
											onClick={() => handleRequestRegisterOtp()}
											disabled={isSubmittingRegister}
											className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
										>
											<RefreshCw size={12} />
											<span>Gửi lại mã OTP</span>
										</button>
									)}
								</div>
							</div>

							<div className="pt-2 flex gap-3">
								<button
									type="button"
									onClick={() => setShowRegisterOtpModal(false)}
									disabled={isSubmittingRegister}
									className="h-12 px-5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
								>
									Hủy
								</button>
								<button
									type="submit"
									disabled={isSubmittingRegister || registerOtp.length !== 6}
									className="flex-1 h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:opacity-95 text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
								>
									{isSubmittingRegister ? (
										<>
											<div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
											<span>Đang kích hoạt...</span>
										</>
									) : (
										<span>Kích hoạt tài khoản</span>
									)}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
};

export default Login;
