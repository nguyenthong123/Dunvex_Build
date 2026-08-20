import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../services/firebase';
import { useOrders } from '../hooks/useOrders';
import { usePayments } from '../hooks/usePayments';
import { useCustomers } from '../hooks/useCustomers';
import { Filter, Download, Printer, X, Lock, Crown, Image as ImageIcon, Copy, CheckCircle2 } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import UpgradeModal from '../components/UpgradeModal';
import { DebtKPIs } from '../components/debts/DebtKPIs';
import { PaymentDetailModal } from '../components/debts/PaymentDetailModal';
import { DebtCustomerTable } from '../components/debts/DebtCustomerTable';
import { DebtHistoryTable } from '../components/debts/DebtHistoryTable';
import { PaymentFormModal } from '../components/debts/PaymentFormModal';

import { useOwner } from '../hooks/useOwner';
import { useScroll } from '../context/ScrollContext';
import { useToast } from '../components/shared/Toast';
import { useDebtCalculations } from '../hooks/useDebtCalculations';
import { useDebtFilters } from '../hooks/useDebtFilters';
import { useDebtPayments } from '../hooks/useDebtPayments';
import { useDebtStatement } from '../hooks/useDebtStatement';

// ── Types ──────────────────────────────────────────────────
interface DataRow {
	id: string;
	initials: string;
	avatarBg: string;
	avatarText: string;
	name: string;
	invoiceId: string;
	amount: string;
	lastTransaction: string;
	dueDate: string;
	riskLevel: string;
	riskColor: string;
	riskBg: string;
}

// ── Component ──────────────────────────────────────────────
const Debts: React.FC = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const owner = useOwner();
	const { isNavVisible } = useScroll();
	const { showToast } = useToast();

	const [activeTab, setActiveTab] = useState<'customers' | 'history'>('customers');

	// ── Data hooks ────────────────────────────────────────
	const { orders } = useOrders({
		ownerId: owner.ownerId,
		enabled: !owner.loading && !!owner.ownerId,
		maxResults: 99999,
	});
	const { payments } = usePayments({
		ownerId: owner.ownerId,
		enabled: !owner.loading && !!owner.ownerId,
		maxResults: 99999,
	});
	const { customers, loading } = useCustomers({
		ownerId: owner.ownerId,
		enabled: !owner.loading && !!owner.ownerId,
	});

	// ── Filters (search, dates, pagination, notifications) ─
	const enhancedPayments = useMemo(
		() =>
			payments.map((p: any) => {
				const realCustomer =
					p.customerId && !p.customerId.startsWith('guest_')
						? customers.find((c: any) => c.id === p.customerId)
						: null;
				return {
					...p,
					displayCustomerName: realCustomer
						? realCustomer.name
						: (p.customerName || 'Khách vãng lai'),
				};
			}),
		[payments, customers],
	);

	const {
		searchTerm,
		setSearchTerm,
		showMobileSearch,
		setShowMobileSearch,
		searchRef,
		fromDate,
		setFromDate,
		toDate,
		setToDate,
		statusFilter,
		showFilterOptions,
		setShowFilterOptions,
		currentPage,
		setCurrentPage,
		historyCurrentPage,
		setHistoryCurrentPage,
		ITEMS_PER_PAGE,
		normalizeText,
		removeAccents,
		isMatch,
		unreadCount,
		markAllAsRead,
		filteredHistory,
		historyTotalPages,
		paginatedHistory,
		getHistoryPageNumbers,
		// useDebtFilters takes enhancedPayments — computed inside useDebtCalculations
	} = useDebtFilters({
		enhancedPayments,
	});

	// ── Calculations (KPI, aggregated data, helpers) ──────
	const {
		currentTime,
		formatPrice,
		formatDate,
		getImageUrl,
		aggregatedData,
		paginatedData,
		totalPages,
		totalWaitedAll,
		totalPaidAll,
		totalUnpaidAll,
		getPageNumbers,
	} = useDebtCalculations({
		orders,
		payments,
		customers,
		searchTerm,
		fromDate,
		toDate,
		statusFilter,
		currentPage,
		itemsPerPage: ITEMS_PER_PAGE,
	});

	// ── Payments (form, CRUD, image upload) ───────────────
	const {
		showPaymentForm,
		setShowPaymentForm,
		showPaymentDetail,
		setShowPaymentDetail,
		paymentData,
		setPaymentData,
		isSubmitting,
		uploadingPaymentImage,
		showPaymentCustomerResults,
		setShowPaymentCustomerResults,
		paymentCustomerSearchQuery,
		setPaymentCustomerSearchQuery,
		paymentCustomerRef,
		editingPaymentId,
		setEditingPaymentId,
		selectedPayment,
		setSelectedPayment,
		handleRecordPayment,
		handleDeletePayment,
		handlePaymentImageUpload,
	} = useDebtPayments({
		ownerId: owner.ownerId,
		ownerEmail: owner.ownerEmail,
		payments,
		customers,
		showToast,
		setHistoryCurrentPage,
	});

	// ── Statement (detail modal, print) ───────────────────
	const {
		showStatement,
		setShowStatement,
		selectedCustomer,
		setSelectedCustomer,
		statementFromDate,
		setStatementFromDate,
		statementToDate,
		setStatementToDate,
		statementScale,
		statementZoom,
		setStatementZoom,
		statementTx,
		loadingStatementTx,
		openStatement,
		handlePrintStatement,
		companyInfo,
	} = useDebtStatement({
		ownerId: owner.ownerId,
		fromDate,
		toDate,
		showToast,
	});

	const [isSavingImage, setIsSavingImage] = useState(false);
	const [capturedImage, setCapturedImage] = useState<string | null>(null);
	const [showCopySuccess, setShowCopySuccess] = useState(false);

	const handleSaveStatementImage = async () => {
		if (!selectedCustomer) return;
		const node = document.getElementById('debt-statement-container');
		if (!node) return;

		setIsSavingImage(true);
		try {
			const targetWidth = 420;
			const canvas = await html2canvas(node, {
				backgroundColor: '#ffffff',
				width: targetWidth,
				scale: 2,
				useCORS: true,
				allowTaint: false,
				logging: false,
			});
			const dataUrl = canvas.toDataURL('image/png');

			const link = document.createElement('a');
			link.download = `cong_no_${selectedCustomer.name?.replace(/\s+/g, '_')}.png`;
			link.href = dataUrl;
			link.click();
		} catch (error) {
			console.error("Lỗi tạo hình ảnh:", error);
			alert("Không thể tạo hình ảnh phiếu công nợ: " + (error instanceof Error ? error.message : String(error)));
		} finally {
			setIsSavingImage(false);
		}
	};

	const handleDirectCopyStatementImage = async () => {
		if (!selectedCustomer) return;
		const node = document.getElementById('debt-statement-container');
		if (!node) return;

		setIsSavingImage(true);
		let generatedUrl = '';
		try {
			const targetWidth = 420;

			if (!navigator.clipboard || !window.ClipboardItem) {
				throw new Error("Trình duyệt không hỗ trợ Clipboard API hoặc kết nối HTTP không bảo mật");
			}

			const blobPromise = (async () => {
				const canvas = await html2canvas(node, {
					backgroundColor: '#ffffff',
					width: targetWidth,
					scale: 2,
					useCORS: true,
					allowTaint: false,
					logging: false,
				});
				const dataUrl = canvas.toDataURL('image/png');
				generatedUrl = dataUrl;
				const response = await fetch(dataUrl);
				if (!response.ok) throw new Error(`HTTP status ${response.status}`);
				return await response.blob();
			})();

			await navigator.clipboard.write([
				new ClipboardItem({
					'image/png': blobPromise
				})
			]);
			setShowCopySuccess(true);
			setTimeout(() => setShowCopySuccess(false), 2500);
		} catch (error) {
			console.error("Lỗi sao chép hình ảnh:", error);
			if (generatedUrl) {
				setCapturedImage(generatedUrl);
				alert("Sao chép trực tiếp thất bại. Hệ thống đã tự động tạo ảnh phía dưới, bạn hãy NHẤN GIỮ VÀO ẢNH để Sao chép hoặc Lưu lại nhé!");
			} else {
				alert("Không thể tạo hình ảnh phiếu công nợ: " + (error instanceof Error ? error.message : String(error)));
			}
		} finally {
			setIsSavingImage(false);
		}
	};

	const handleCopyStatementCapturedImage = async () => {
		if (!capturedImage) return;
		try {
			const response = await fetch(capturedImage);
			const blob = await response.blob();
			await navigator.clipboard.write([
				new ClipboardItem({
					[blob.type]: blob
				})
			]);
			setShowCopySuccess(true);
			setTimeout(() => setShowCopySuccess(false), 2500);
		} catch (error) {
			console.error("Lỗi sao chép hình ảnh:", error);
			alert("Thiết bị hoặc trình duyệt không hỗ trợ sao chép trực tiếp. Bạn vui lòng nhấn giữ hình ảnh để Sao chép!");
		}
	};


	// Track modal state for back button
	const showStatementRef = useRef(showStatement);
	const showPaymentFormRef = useRef(showPaymentForm);
	useEffect(() => { showStatementRef.current = showStatement; }, [showStatement]);
	useEffect(() => { showPaymentFormRef.current = showPaymentForm; }, [showPaymentForm]);

	// Handle browser back button — close modal
	useEffect(() => {
		const handlePopState = () => {
			if (showStatementRef.current) {
				setShowStatement(false);
			}
			if (showPaymentFormRef.current) {
				setShowPaymentForm(false);
			}
		};
		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	}, []);

	// ── Cross-hook listeners ──────────────────────────────
	// open-mobile-add event (coordinates statement + payments)
	useEffect(() => {
		const handleOpenAdd = () => {
			setSelectedCustomer(null);
			setShowPaymentForm(true);
			navigate(window.location.pathname + window.location.search, { state: { modalOpen: true } });
		};
		window.addEventListener('open-mobile-add', handleOpenAdd);
		return () => window.removeEventListener('open-mobile-add', handleOpenAdd);
	}, []);

	// Tab switching from URL params
	useEffect(() => {
		const params = new URLSearchParams(location.search);
		const tabParam = params.get('tab');
		if (tabParam === 'history') {
			setActiveTab('history');
		} else if (tabParam === 'customers') {
			setActiveTab('customers');
		}
	}, [location]);

	// ── Permission & lock checks ──────────────────────────
	const hasPermission = owner.role === 'admin' || (owner.accessRights?.debts_manage ?? true);

	if (owner.loading) return null;

	if (!hasPermission) {
		return (
			<div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-slate-950 items-center justify-center text-center p-8 min-h-screen">
				<div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-full text-orange-500 mb-4">
					<span className="material-symbols-outlined text-5xl">payments</span>
				</div>
				<h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase mb-2">
					Quyền hạn hạn chế
				</h2>
				<p className="text-slate-500 dark:text-slate-400 max-w-md">
					Bạn không có quyền xem hoặc nhập công nợ. Vui lòng liên hệ Admin.
				</p>
				<button
					onClick={() => (window.history.length > 2 ? navigate(-1) : navigate('/'))}
					className="mt-6 bg-[#1A237E] text-white px-6 py-2 rounded-xl font-bold"
				>
					Quay lại
				</button>
			</div>
		);
	}

	if (owner.manualLockDebts) {
		return (
			<div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-slate-950 items-center justify-center p-8 min-h-screen">
				<div className="bg-red-500/10 p-6 rounded-full text-red-500 mb-6 border border-red-500/20">
					<Lock size={64} />
				</div>
				<h1 className="text-2xl md:text-4xl font-black uppercase tracking-tighter mb-4 text-[#1A237E] dark:text-indigo-400 text-center">
					Tính Năng Bị Khóa
				</h1>
				<p className="text-slate-500 dark:text-slate-400 text-center max-w-md font-medium text-sm md:text-base leading-relaxed mb-8">
					Tài khoản của bạn đã bị khóa tính năng Công Nợ. Vui lòng nâng cấp gói hoặc
					liên hệ Quản trị viên để mở khóa.
				</p>
				<button
					onClick={() => navigate('/pricing')}
					className="bg-[#1A237E] dark:bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest shadow-xl shadow-blue-900/20 md:hover:bg-blue-800 transition-all flex items-center gap-2"
				>
					<Crown size={20} />
					Nâng Cấp Ngay
				</button>
			</div>
		);
	}

	// ── Render ──────────────────────────────────────────────
	return (
		<div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-slate-950 transition-colors duration-300">
			{/* Header */}
			<header className="h-16 md:h-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0 transition-colors duration-300 print:hidden">
				<div className="flex items-center gap-4">
					<div className="flex flex-col">
						<h2 className="text-slate-900 dark:text-indigo-400 text-lg md:text-2xl font-black uppercase tracking-tight">
							Quản Lý Công Nợ
						</h2>
						<p className="text-[10px] text-slate-500 dark:text-slate-500 font-black uppercase tracking-widest hidden md:block">
							Cập nhật lúc:{' '}
							{currentTime.toLocaleTimeString('vi-VN', {
								hour: '2-digit',
								minute: '2-digit',
							})}{' '}
							— {currentTime.toLocaleDateString('vi-VN')}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-3 md:gap-6">
					<div className="hidden lg:flex items-center bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-2 w-64 lg:w-96 border border-transparent focus-within:border-[#FF6D00]/50 transition-all shadow-inner">
						<span className="material-symbols-outlined text-slate-400">search</span>
						<input
							ref={searchRef}
							className="bg-transparent border-none focus:ring-0 text-sm w-full text-slate-700 dark:text-slate-200 ml-2 font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500"
							placeholder="Tìm kiếm đối tác..."
							type="text"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					</div>

					<div className="flex items-center gap-2">
						<button
							onClick={markAllAsRead}
							className="p-2 relative text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors group"
						>
							<span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">
								notifications
							</span>
							{unreadCount > 0 && (
								<span className="absolute top-2 right-2 size-4 bg-[#FF6D00] text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 animate-bounce">
									{unreadCount}
								</span>
							)}
						</button>
						<button
							onClick={() => {
								setShowPaymentForm(true);
								navigate(window.location.pathname + window.location.search, { state: { modalOpen: true } });
							}}
							className="hidden md:flex items-center justify-center gap-2 bg-[#1A237E] dark:bg-indigo-600 hover:bg-[#0D47A1] dark:hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-900/20 dark:shadow-indigo-900/20 transition-all active:scale-95"
						>
							<span className="material-symbols-outlined text-xl">add_card</span>
							<span>Ghi nhận thu nợ</span>
						</button>
					</div>
				</div>
			</header>

			{/* Content Area */}
			<div className="flex-1 p-4 md:p-8 print:hidden">
				{showMobileSearch && (
					<div className="lg:hidden mb-6 animate-in slide-in-from-top duration-300">
						<div className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800">
							<span className="material-symbols-outlined text-slate-400">search</span>
							<input
								ref={searchRef}
								type="text"
								placeholder="Tìm kiếm đối tác..."
								className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-slate-900 dark:text-white"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
							/>
							{searchTerm && (
								<button
									onClick={() => setSearchTerm('')}
									className="text-slate-300"
								>
									<span className="material-symbols-outlined text-lg">cancel</span>
								</button>
							)}
							<button
								onClick={() => setShowMobileSearch(false)}
								className="text-blue-500 font-bold text-xs"
							>
								Đóng
							</button>
						</div>
					</div>
				)}
				<div className="max-w-7xl mx-auto flex flex-col gap-6 md:gap-8">
					{/* KPI Cards Section */}
					<DebtKPIs
						totalWaitedAll={totalWaitedAll}
						totalPaidAll={totalPaidAll}
						totalUnpaidAll={totalUnpaidAll}
						formatPrice={formatPrice}
						customersWithDebtCount={
							aggregatedData.filter((i) => i.currentDebt > 0).length
						}
					/>

					{/* View Toggle Tabs */}
					<div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-fit mb-2">
						<button
							onClick={() => setActiveTab('customers')}
							className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
								activeTab === 'customers'
									? 'bg-white dark:bg-slate-700 text-[#1A237E] dark:text-indigo-400 shadow-sm'
									: 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
							}`}
						>
							Bảng công nợ
						</button>
						<button
							onClick={() => setActiveTab('history')}
							className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
								activeTab === 'history'
									? 'bg-white dark:bg-slate-700 text-[#1A237E] dark:text-indigo-400 shadow-sm'
									: 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
							}`}
						>
							Lịch sử thu nợ
						</button>
					</div>

					{activeTab === 'customers' ? (
						<>
							{/* Filters */}
							<div className="flex flex-col gap-4">
								<div className="flex justify-end gap-4">
									<div className="flex items-center gap-2 w-full md:w-auto">
										<button
											onClick={() => setShowFilterOptions(!showFilterOptions)}
											className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
												showFilterOptions
													? 'bg-[#1A237E] dark:bg-indigo-600 text-white'
													: 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 shadow-sm'
											}`}
										>
											<Filter size={16} /> Lọc thời gian
										</button>
										<button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FF6D00] rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/20">
											<Download size={16} /> Xuất File
										</button>
									</div>
								</div>

								{showFilterOptions && (
									<div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-300 transition-colors duration-300">
										<div>
											<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
												Từ ngày
											</label>
											<input
												type="date"
												className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#1A237E]/20 dark:focus:ring-indigo-500/20"
												value={fromDate}
												onChange={(e) => setFromDate(e.target.value)}
											/>
										</div>
										<div>
											<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
												Đến ngày
											</label>
											<input
												type="date"
												className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#1A237E]/20 dark:focus:ring-indigo-500/20"
												value={toDate}
												onChange={(e) => setToDate(e.target.value)}
											/>
										</div>
									</div>
								)}
							</div>

							<DebtCustomerTable
								loading={loading}
								paginatedData={paginatedData}
								openStatement={openStatement}
								formatPrice={formatPrice}
								formatDate={formatDate}
								setPaymentData={setPaymentData}
								paymentData={paymentData}
								setShowPaymentForm={setShowPaymentForm}
								totalPages={totalPages}
								currentPage={currentPage}
								setCurrentPage={setCurrentPage}
								aggregatedData={aggregatedData}
								ITEMS_PER_PAGE={ITEMS_PER_PAGE}
								getPageNumbers={getPageNumbers}
							/>
						</>
					) : (
						<DebtHistoryTable
							loading={loading}
							paginatedHistory={paginatedHistory}
							formatPrice={formatPrice}
							formatDate={formatDate}
							setSelectedPayment={setSelectedPayment}
							setShowPaymentDetail={setShowPaymentDetail}
							setEditingPaymentId={setEditingPaymentId}
							setPaymentData={setPaymentData}
							setShowPaymentForm={(val) => {
								setShowPaymentForm(val);
								if (val) navigate(window.location.pathname + window.location.search, { state: { modalOpen: true } });
							}}
							handleDeletePayment={handleDeletePayment}
							historyTotalPages={historyTotalPages}
							historyCurrentPage={historyCurrentPage}
							setHistoryCurrentPage={setHistoryCurrentPage}
							filteredHistory={filteredHistory}
							ITEMS_PER_PAGE={ITEMS_PER_PAGE}
							getHistoryPageNumbers={getHistoryPageNumbers}
						/>
					)}
				</div>
			</div>

			{/* PAYMENT FORM MODAL */}
			<PaymentFormModal
				showPaymentForm={showPaymentForm}
				setShowPaymentForm={(val) => {
					if (!val) {
						window.history.back();
					} else {
						setShowPaymentForm(true);
						navigate(window.location.pathname + window.location.search, { state: { modalOpen: true } });
					}
				}}
				editingPaymentId={editingPaymentId}
				setEditingPaymentId={setEditingPaymentId}
				handleRecordPayment={handleRecordPayment}
				paymentCustomerRef={paymentCustomerRef}
				paymentData={paymentData}
				setPaymentData={setPaymentData}
				paymentCustomerSearchQuery={paymentCustomerSearchQuery}
				setPaymentCustomerSearchQuery={setPaymentCustomerSearchQuery}
				showPaymentCustomerResults={showPaymentCustomerResults}
				setShowPaymentCustomerResults={setShowPaymentCustomerResults}
				aggregatedData={aggregatedData}
				isMatch={isMatch}
				formatPrice={formatPrice}
				uploadingPaymentImage={uploadingPaymentImage}
				handlePaymentImageUpload={handlePaymentImageUpload}
				getImageUrl={getImageUrl}
				isSubmitting={isSubmitting}
			/>

			{showStatement && selectedCustomer &&
				(owner.isPro || !owner.systemConfig.lock_free_debts) &&
				!owner.manualLockDebts ? (
				<div
					id="debt-statement-modal"
					className="fixed inset-0 z-[150] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-start overflow-hidden print:hidden animate-in fade-in duration-200"
				>
					{/* Controls bar */}
					<div className="w-full flex items-center justify-between p-3 bg-slate-950/80 backdrop-blur-lg border-b border-white/5 z-[160] no-print">
						<span className="text-white text-xs font-black uppercase tracking-wider pl-2 hidden lg:inline">Chi tiết công nợ khách hàng</span>

						{/* Date Range Filters */}
						<div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15 text-white">
							<span className="text-[10px] font-black uppercase tracking-wider text-white/60">Từ:</span>
							<input
								type="date"
								value={statementFromDate}
								onChange={(e) => setStatementFromDate(e.target.value)}
								className="bg-transparent text-white text-xs font-bold outline-none border-none [color-scheme:dark] max-w-[110px]"
							/>
							<span className="text-[10px] font-black uppercase tracking-wider text-white/60">Đến:</span>
							<input
								type="date"
								value={statementToDate}
								onChange={(e) => setStatementToDate(e.target.value)}
								className="bg-transparent text-white text-xs font-bold outline-none border-none [color-scheme:dark] max-w-[110px]"
							/>
						</div>

						{/* Desktop buttons (Hidden on Mobile) */}
						<div className="hidden md:flex bg-white/10 backdrop-blur-md rounded-full p-1 border border-white/20 gap-2 shrink-0">
							<button
								onClick={handlePrintStatement}
								className="px-3.5 py-1.5 bg-white text-slate-900 rounded-full text-xs font-black uppercase tracking-wider transition-all hover:bg-slate-100 flex items-center gap-1"
							>
								<Printer size={14} /> In Phiếu
							</button>
							<button
								onClick={handleSaveStatementImage}
								disabled={isSavingImage}
								className="px-3.5 py-1.5 bg-emerald-500 text-white rounded-full text-xs font-black uppercase tracking-wider transition-all hover:bg-emerald-600 flex items-center gap-1 disabled:opacity-50"
							>
								<ImageIcon size={14} /> {isSavingImage ? 'Đang tạo...' : 'Lưu Ảnh'}
							</button>
							<button
								onClick={handleDirectCopyStatementImage}
								disabled={isSavingImage}
								className="px-3.5 py-1.5 bg-blue-500 text-white rounded-full text-xs font-black uppercase tracking-wider transition-all hover:bg-blue-600 flex items-center gap-1 disabled:opacity-50"
							>
								<Copy size={14} /> {isSavingImage ? 'Đang copy...' : 'Copy Ảnh'}
							</button>
						</div>

						{/* Close button */}
						<button
							onClick={() => { setShowStatement(false); }}
							className="size-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/20 transition-all font-bold text-xs active:scale-95"
							title="Đóng"
						>
							<X size={18} />
						</button>
					</div>

					{/* SCROLLABLE DOCUMENT AREA */}
					<div className="w-full h-full overflow-y-auto pt-6 pb-28 md:pb-10 flex flex-col items-center justify-start p-4 custom-scrollbar">
						{loadingStatementTx ? (
							<div className="my-auto flex flex-col items-center justify-center text-slate-400 py-20">
								<div className="size-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mb-4"></div>
								<p className="font-bold text-sm uppercase tracking-wider">
									Đang tải dữ liệu công nợ...
								</p>
							</div>
						) : (
							<div
								className="my-auto flex flex-col items-center"
								style={{
									zoom: statementZoom,
									transformOrigin: 'top center',
								}}
							>
								{/* The ticket layout */}
								{(() => {
									const getNormDate = (tx: any) => {
										if (tx.orderDate && typeof tx.orderDate === 'string')
											return tx.orderDate;
										if (tx.date && typeof tx.date === 'string') return tx.date;
										let d;
										if (tx.orderDate?.seconds)
											d = new Date(tx.orderDate.seconds * 1000);
										else if (tx.date?.seconds)
											d = new Date(tx.date.seconds * 1000);
										else if (tx.createdAt?.seconds)
											d = new Date(tx.createdAt.seconds * 1000);
										else if (tx.createdAt) d = new Date(tx.createdAt);
										else return '';
										if (isNaN(d.getTime())) return '';
										return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
									};

									const sortedTx = [...statementTx].sort((a, b) => {
										const da = getNormDate(a);
										const db = getNormDate(b);
										if (da !== db) return da.localeCompare(db);
										return (
											(a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
										);
									});

									let openingBalance = 0;
									if (statementFromDate) {
										const beforeOrders = sortedTx
											.filter((t) => t.txType === 'order' && getNormDate(t) && getNormDate(t) < statementFromDate)
											.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
										const beforePayments = sortedTx
											.filter((t) => t.txType === 'payment' && getNormDate(t) && getNormDate(t) < statementFromDate)
											.reduce((sum, p) => sum + Number(p.amount || 0), 0);
										openingBalance = beforeOrders - beforePayments;
									}

									const cycleTx = sortedTx.filter((t) => {
										const dateStr = getNormDate(t);
										if ((statementFromDate || statementToDate) && !dateStr) return false;

										if (statementFromDate && dateStr < statementFromDate) return false;
										if (statementToDate && dateStr > statementToDate) return false;
										return true;
									});

									const totalOrders = cycleTx
										.filter((t) => t.txType === 'order')
										.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
									const totalPayments = cycleTx
										.filter((t) => t.txType === 'payment')
										.reduce((sum, p) => sum + Number(p.amount || 0), 0);
									const closingBalance = openingBalance + totalOrders - totalPayments;

									return (
										<div
											id="debt-statement-container"
											className="bg-white text-black font-sans mx-auto text-left shadow-2xl relative border border-slate-200"
											style={{
												width: '420px',
												padding: '24px',
												boxSizing: 'border-box'
											}}
										>
											{/* Shop Header */}
											<div className="flex items-center gap-4 mb-4">
												{companyInfo?.logoUrl ? (
													<div className="w-16 h-16 rounded-full border border-slate-200 overflow-hidden bg-white shrink-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
														<img src={companyInfo.logoUrl} alt="Logo" className="w-full h-full object-cover" />
													</div>
												) : (
													<div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center text-white shrink-0 font-bold text-xl">
														{(companyInfo?.name || 'D').slice(0, 1).toUpperCase()}
													</div>
												)}
												<div className="text-left min-w-0">
													<h2 className="text-xl font-black uppercase leading-tight tracking-tight text-black break-words">
														{companyInfo?.name || 'DUNVEX'}
													</h2>
													<div className="text-[11px] text-slate-600 font-semibold space-y-0.5 mt-1 leading-snug">
														<p className="truncate">{companyInfo?.address || 'XÃ KIẾN ĐỨC , LÂM ĐỒNG'}</p>
														<p>SĐT: {companyInfo?.phone || '0988765444'}</p>
													</div>
												</div>
											</div>

											{/* Bill Title */}
											<div className="text-center border-t border-b border-dashed border-slate-400 py-2 my-3">
												<h1 className="text-base font-black uppercase tracking-wider">CHI TIẾT CÔNG NỢ</h1>
												<p className="text-[10px] text-slate-500 font-bold mt-0.5">#{selectedCustomer.id?.slice(-6).toUpperCase()}</p>
											</div>

											{/* Bill Metadata */}
											<div className="space-y-1.5 text-xs text-slate-800 font-semibold mb-4 leading-normal">
												<div className="flex justify-between items-start gap-3">
													<span className="shrink-0 text-slate-500">Khách hàng:</span>
													<span className="font-bold text-black uppercase text-right">{selectedCustomer.name}</span>
												</div>
												{(statementFromDate || statementToDate) && (
													<div className="flex justify-between items-start gap-3">
														<span className="shrink-0 text-slate-500">Kỳ lọc:</span>
														<span className="text-right font-bold text-slate-800">
															{statementFromDate && `Từ ${formatDate(statementFromDate)}`}
															{statementToDate && ` đến ${formatDate(statementToDate)}`}
														</span>
													</div>
												)}
												<div className="flex justify-between items-start gap-3">
													<span className="shrink-0 text-slate-500">Tổng tiền nhập hàng:</span>
													<span className="text-right font-bold">{formatPrice(totalOrders)}</span>
												</div>
												<div className="flex justify-between items-start gap-3">
													<span className="shrink-0 text-slate-500">Tổng tiền trả:</span>
													<span className="text-right font-bold text-emerald-600">-{formatPrice(totalPayments)}</span>
												</div>
												<div className="flex justify-between items-start gap-3">
													<span className="shrink-0 text-slate-500">Số tiền công nợ còn lại:</span>
													<span className="text-right font-black text-red-600">{formatPrice(closingBalance)}</span>
												</div>
											</div>

											{/* Purchases Section */}
											<div className="mt-4">
												<div className="border-t border-dashed border-slate-400 pt-2 font-bold text-xs text-slate-500 flex justify-between uppercase">
													<span>DANH SÁCH ĐƠN MUA</span>
													<span>Số tiền</span>
												</div>
												<div className="divide-y divide-dashed divide-slate-200 mt-1">
													{(() => {
														const ordersTx = cycleTx.filter((t) => t.txType === 'order');
														if (ordersTx.length === 0) {
															return <div className="py-3 text-center text-xs text-slate-400 italic">Không có đơn mua hàng nào</div>;
														}
														return ordersTx.map((tx: any, idx: number) => {
															const txDate = formatDate(tx.orderDate || tx.createdAt);
															const txName = `Mua đơn #${tx.id?.slice(0, 8).toUpperCase()}`;
															const txAmount = `+${formatPrice(tx.totalAmount)}`;
															return (
																<div key={idx} className="py-2.5 space-y-1 border-b border-dashed border-slate-200">
																	<div className="flex items-start gap-2.5 font-extrabold text-black uppercase leading-tight text-sm">
																		<span className="shrink-0 pt-0.5">{idx + 1}.</span>
																		<span className="min-w-0 break-words pt-0.5">{txName}</span>
																	</div>
																	<div className="flex justify-between items-center text-xs font-bold text-slate-700">
																		<span className="whitespace-nowrap">Ngày: {txDate}</span>
																		<span className="text-black text-sm font-black whitespace-nowrap">{txAmount}</span>
																	</div>
																</div>
															);
														});
													})()}
												</div>
											</div>

											{/* Payments Section */}
											<div className="mt-4">
												<div className="border-t border-dashed border-slate-400 pt-2 font-bold text-xs text-slate-500 flex justify-between uppercase">
													<span>ĐÃ THANH TOÁN</span>
													<span>Số tiền</span>
												</div>
												<div className="divide-y divide-dashed divide-slate-200 mt-1">
													{(() => {
														const paymentsTx = cycleTx.filter((t) => t.txType === 'payment');
														if (paymentsTx.length === 0) {
															return <div className="py-3 text-center text-xs text-slate-400 italic">Chưa có giao dịch thanh toán nào</div>;
														}
														return paymentsTx.map((tx: any, idx: number) => {
															const txDate = formatDate(tx.date || tx.createdAt);
															const txName = `Trả nợ [${tx.paymentMethod || 'Chuyển khoản'}]`;
															const txAmount = `-${formatPrice(tx.amount)}`;
															return (
																<div key={idx} className="py-2.5 space-y-1 border-b border-dashed border-slate-200">
																	<div className="flex items-start gap-2.5 font-extrabold text-black uppercase leading-tight text-sm">
																		<span className="shrink-0 pt-0.5">{idx + 1}.</span>
																		<span className="min-w-0 break-words pt-0.5">{txName}</span>
																	</div>
																	<div className="flex justify-between items-center text-xs font-bold text-slate-700">
																		<span className="whitespace-nowrap">Ngày: {txDate}</span>
																		<span className="text-emerald-600 text-sm font-black whitespace-nowrap">{txAmount}</span>
																	</div>
																</div>
															);
														});
													})()}
												</div>
											</div>

											{/* Totals Section */}
											<div className="border-t border-dashed border-slate-400 pt-3 space-y-2 text-xs font-bold text-slate-700">
												{(statementFromDate && openingBalance !== 0) && (
													<div className="flex justify-between items-center gap-4">
														<span className="shrink-0">Dư nợ đầu kỳ:</span>
														<span className="text-black whitespace-nowrap">{formatPrice(openingBalance)}</span>
													</div>
												)}
												<div className="flex justify-between items-center gap-4">
													<span className="shrink-0">Tổng mua trong kỳ (+):</span>
													<span className="text-black whitespace-nowrap">{formatPrice(totalOrders)}</span>
												</div>
												<div className="flex justify-between items-center gap-4">
													<span className="shrink-0">Đã thanh toán trong kỳ (-):</span>
													<span className="text-emerald-600 whitespace-nowrap">-{formatPrice(totalPayments)}</span>
												</div>

												<div className="border-t border-slate-950 pt-2 flex justify-between items-center font-black text-base text-black uppercase gap-4 border-t border-slate-950 border-double">
													<span className="shrink-0">Dư nợ cuối kỳ:</span>
													<span className="text-lg whitespace-nowrap">{formatPrice(closingBalance)}</span>
												</div>
											</div>

											{/* Signatures */}
											<div className="border-t border-dashed border-slate-400 mt-6 pt-4 grid grid-cols-2 gap-4 text-center text-[10px] font-bold text-slate-500 uppercase leading-normal">
												<div>
													<p className="mb-10">Đại diện khách hàng</p>
													<div className="mx-auto h-px w-16 bg-slate-300"></div>
												</div>
												<div>
													<p className="mb-10">Người lập phiếu</p>
													<span className="text-black font-extrabold">{auth.currentUser?.displayName || 'Nhân viên'}</span>
												</div>
											</div>

											<div className="text-center text-[10px] text-slate-400 font-bold mt-8 italic leading-snug">
												Cảm ơn quý khách đã tin tưởng và hợp tác cùng Dunvex Build!
											</div>
										</div>
									);
								})()}
							</div>
						)}
					</div>

					{/* Zoom toolbar */}
					<div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-md rounded-full p-1.5 border border-white/10 flex items-center gap-2 z-[160] no-print">
						<button
							onClick={() => setStatementZoom((prev) => Math.max(0.5, prev - 0.05))}
							className="size-8 rounded-full hover:bg-white/10 text-white flex items-center justify-center transition-all"
							title="Thu nhỏ"
						>
							<span className="material-symbols-outlined text-base">zoom_out</span>
						</button>
						<span className="text-[11px] font-black text-white w-12 text-center tabular-nums">
							{Math.round(statementZoom * 100)}%
						</span>
						<button
							onClick={() => setStatementZoom((prev) => Math.min(2, prev + 0.05))}
							className="size-8 rounded-full hover:bg-white/10 text-white flex items-center justify-center transition-all"
							title="Phóng to"
						>
							<span className="material-symbols-outlined text-base">zoom_in</span>
						</button>
						<div className="w-px h-4 bg-white/20 mx-1"></div>
						<button
							onClick={() => setStatementZoom(1)}
							className="px-2 py-1 rounded-lg hover:bg-white/10 text-white text-[10px] font-black uppercase transition-all"
						>
							100%
						</button>
					</div>

					{/* MOBILE BOTTOM ACTION BAR FOR STATEMENT */}
					<div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-955/90 backdrop-blur-xl border-t border-white/10 z-[160] flex items-center justify-around gap-3 md:hidden no-print" onClick={e => e.stopPropagation()}>
						<button
							onClick={handleSaveStatementImage}
							disabled={isSavingImage}
							className="flex-1 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center border border-emerald-500/30 shadow-lg transition-all font-extrabold text-[11px] uppercase tracking-wider active:scale-95 hover:bg-emerald-700 disabled:opacity-50 gap-1.5"
						>
							<ImageIcon size={16} />
							<span>{isSavingImage ? 'Đang tạo...' : 'Lưu ảnh'}</span>
						</button>

						<button
							onClick={handleDirectCopyStatementImage}
							disabled={isSavingImage}
							className="flex-1 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center border border-blue-500/30 shadow-lg transition-all font-extrabold text-[11px] uppercase tracking-wider active:scale-95 hover:bg-blue-700 disabled:opacity-50 gap-1.5"
						>
							<Copy size={16} />
							<span>{isSavingImage ? 'Đang copy...' : 'Copy ảnh'}</span>
						</button>

						<button
							onClick={handlePrintStatement}
							className="w-12 h-12 rounded-xl bg-slate-800 text-white flex items-center justify-center border border-slate-700 shadow-lg transition-all active:scale-95 hover:bg-black"
							title="In phiếu"
						>
							<Printer size={16} />
						</button>
					</div>
				</div>
			) : showStatement ? (
				<UpgradeModal
					onClose={() => setShowStatement(false)}
					featureName="Chi tiết công nợ khách hàng"
				/>
			) : null}

			{/* PAYMENT DETAIL MODAL */}
			<PaymentDetailModal
				showPaymentDetail={showPaymentDetail}
				selectedPayment={selectedPayment}
				setShowPaymentDetail={setShowPaymentDetail}
				setSelectedPayment={setSelectedPayment}
				formatDate={formatDate}
				formatPrice={formatPrice}
				getImageUrl={getImageUrl}
			/>

			{/* CAPTURED IMAGE PREVIEW MODAL */}
			{capturedImage && (
				<div className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-xl flex flex-col justify-between p-4 animate-in fade-in duration-200" onClick={() => setCapturedImage(null)}>
					<div className="w-full flex items-center justify-between p-2 border-b border-slate-800 shrink-0" onClick={e => e.stopPropagation()}>
						<span className="text-white font-black text-sm uppercase tracking-wider">ẢNH PREVIEW PHIẾU CÔNG NỢ</span>
						<button
							onClick={() => setCapturedImage(null)}
							className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
						>
							<X size={20} />
						</button>
					</div>

					<div className="py-3 text-center shrink-0" onClick={e => e.stopPropagation()}>
						<p className="text-xs sm:text-sm font-extrabold text-[#FF6D00] bg-orange-500/10 py-2.5 px-4 rounded-xl inline-block leading-snug">
							👉 Nhấn giữ vào ảnh bên dưới, chọn "Lưu ảnh" hoặc "Chia sẻ" trực tiếp sang Zalo / Facebook!
						</p>
					</div>

					<div className="flex-1 overflow-y-auto min-h-0 bg-white rounded-2xl border border-slate-800 p-2 flex justify-center items-start shadow-inner" onClick={e => e.stopPropagation()}>
						<img 
							src={capturedImage} 
							alt="Phiếu Công Nợ" 
							className="max-w-full h-auto rounded-lg select-all" 
						/>
					</div>

					<div className="pt-4 border-t border-slate-800 shrink-0 flex gap-2" onClick={e => e.stopPropagation()}>
						<button
							onClick={handleCopyStatementCapturedImage}
							className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl active:scale-95 transition-all text-[11px] uppercase tracking-wider hover:bg-emerald-700"
						>
							Sao chép ảnh
						</button>
						<button
							onClick={() => {
								const link = document.createElement('a');
								link.download = `cong_no_${selectedCustomer?.name?.replace(/\s+/g, '_') || 'khach_hang'}.png`;
								link.href = capturedImage;
								link.click();
							}}
							className="flex-1 py-3 bg-[#FF6D00] text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all text-[11px] uppercase tracking-wider hover:bg-[#e66200]"
						>
							Tải về
						</button>
						<button
							onClick={() => setCapturedImage(null)}
							className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl active:scale-95 transition-all text-[11px] uppercase tracking-wider hover:bg-slate-700"
						>
							Đóng
						</button>
					</div>
				</div>
			)}

			{/* COPY SUCCESS DIALOG OVERLAY */}
			{showCopySuccess && (
				<div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col items-center gap-4 text-center max-w-sm mx-4 animate-in zoom-in-95 duration-200 shadow-2xl">
						<div className="size-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.25)] animate-bounce">
							<CheckCircle2 size={36} className="stroke-[2.5]" />
						</div>
						<div>
							<h4 className="text-white font-black text-base uppercase tracking-wider mb-1">Sao chép thành công!</h4>
							<p className="text-slate-400 text-xs leading-relaxed">Đã sao chép ảnh phiếu công nợ vào khay nhớ tạm. Bạn có thể dán (Paste) gửi ngay sang Zalo / Facebook!</p>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default Debts;
