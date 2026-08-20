import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOwner } from '../hooks/useOwner';
import { useSuppliers } from '../hooks/useSuppliers';
import { useSupplierDebts } from '../hooks/useSupplierDebts';
import { usePurchaseOrders } from '../hooks/usePurchaseOrders';
import { useToast } from '../components/shared/Toast';
import { Search, X, Plus, Trash2, Edit2, ChevronLeft, ChevronRight, Package, FileText, Printer, Image as ImageIcon, Copy, CheckCircle2 } from 'lucide-react';
import { serverTimestamp, Timestamp, db, getDoc, doc, auth } from '../services/firebase';
import html2canvas from 'html2canvas-pro';

// ─── Helpers ────────────────────────────────────────────
const fmt = (n: number) => Number(n || 0).toLocaleString('vi-VN');
const fmtDate = (d: any) => {
	if (!d) return '';
	if (d?.seconds) d = new Date(d.seconds * 1000);
	const dt = new Date(d);
	return dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const fmtDateTime = (d: any) => {
	if (!d) return '';
	if (d?.seconds) d = new Date(d.seconds * 1000);
	const dt = new Date(d);
	return dt.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Chuẩn hoá ngày về chuỗi 'YYYY-MM-DD' để so sánh khi lọc khoảng thời gian
const normDate = (tx: any) => {
	const d = tx?.createdAt?.seconds ? new Date(tx.createdAt.seconds * 1000) : tx?.createdAt ? new Date(tx.createdAt) : null;
	if (!d || isNaN(d.getTime())) return '';
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ─── Pagination ──────────────────────────────────────────
const Pagination = ({ page, total, perPage, onChange }: any) => {
	const totalPages = Math.ceil(total / perPage);
	if (totalPages <= 1) return null;
	const pages = [];
	for (let i = 1; i <= totalPages; i++) pages.push(i);
	return (
		<div className="flex items-center justify-center gap-1 mt-4">
			<button disabled={page <= 1} onClick={() => onChange(page - 1)}
				className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-semibold text-sm disabled:opacity-30 hover:bg-slate-50 transition">‹ Trước</button>
			{pages.map(p => (
				<button key={p} onClick={() => onChange(p)}
					className={`w-9 h-9 rounded-lg text-sm font-bold transition ${p === page ? 'bg-[#FF6D00] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{p}</button>
			))}
			<button disabled={page >= totalPages} onClick={() => onChange(page + 1)}
				className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-semibold text-sm disabled:opacity-30 hover:bg-slate-50 transition">Sau ›</button>
		</div>
	);
};

// ─── Main Component ──────────────────────────────────────
const SupplierDebts = () => {
	const owner = useOwner();
	const navigate = useNavigate();
	const { showToast } = useToast();
	const { suppliers } = useSuppliers();
	const { debts, addDebt, removeDebt, updateDebt } = useSupplierDebts();
	const { purchaseOrders } = usePurchaseOrders();

	const [activeTab, setActiveTab] = useState<'debts' | 'history'>('debts');
	const [searchTerm, setSearchTerm] = useState('');
	const [historySearchTerm, setHistorySearchTerm] = useState('');
	const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
	const [showDetail, setShowDetail] = useState(false);
	const [companyInfo, setCompanyInfo] = useState<any>(null);
	const [statementZoom, setStatementZoom] = useState(1);
	const [statementFromDate, setStatementFromDate] = useState('');
	const [statementToDate, setStatementToDate] = useState('');

	const [isSavingImage, setIsSavingImage] = useState(false);
	const [capturedImage, setCapturedImage] = useState<string | null>(null);
	const [showCopySuccess, setShowCopySuccess] = useState(false);

	const handleSaveStatementImage = async () => {
		if (!selectedSupplier) return;
		const node = document.getElementById('supplier-debt-print-bill');
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
			link.download = `cong_no_ncc_${selectedSupplier.name?.replace(/\s+/g, '_')}.png`;
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
		if (!selectedSupplier) return;
		const node = document.getElementById('supplier-debt-print-bill');
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

	useEffect(() => {
		const fetchSettings = async () => {
			try {
				const settingsSnap = await getDoc(doc(db, 'settings', owner.ownerId));
				if (settingsSnap.exists()) {
					setCompanyInfo(settingsSnap.data());
				}
			} catch (err) {
				console.warn('Error fetching settings for printing:', err);
			}
		};
		if (owner.ownerId) {
			fetchSettings();
		}
	}, [owner.ownerId]);

	const openDetail = (supplier: any, tab: 'po' | 'payments') => {
		setSelectedSupplier(supplier);
		setShowDetail(true);
		setDetailTab(tab);
		setStatementFromDate('');
		setStatementToDate('');
		navigate(window.location.pathname + window.location.search, { state: { modalOpen: true } });
	};


	// Pagination
	const [debtPage, setDebtPage] = useState(1);
	const [historyPage, setHistoryPage] = useState(1);
	const [detailTab, setDetailTab] = useState<'po' | 'payments'>('po');
	const PER_PAGE = 10;

	// Payment form
	const [showPaymentForm, setShowPaymentForm] = useState(false);
	const [paymentAmount, setPaymentAmount] = useState('');
	const [paymentNote, setPaymentNote] = useState('');
	const [paymentDate, setPaymentDate] = useState('');

	// Edit form
	const [showEditForm, setShowEditForm] = useState(false);
	const [editingPayment, setEditingPayment] = useState<any>(null);
	const [editAmount, setEditAmount] = useState('');
	const [editNote, setEditNote] = useState('');

	// Handle browser back button — close modals
	// Track modal state for back button
	const detailRef = useRef(showDetail);
	useEffect(() => { detailRef.current = showDetail; }, [showDetail]);
	const paymentRef = useRef(showPaymentForm);
	useEffect(() => { paymentRef.current = showPaymentForm; }, [showPaymentForm]);

	// Handle browser back button — close modal
	useEffect(() => {
		const handlePopState = () => {
			if (detailRef.current || paymentRef.current) {
				setShowDetail(false);
				setShowPaymentForm(false);
			}
		};
		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	}, []);

	// ─── Tính toán REAL-TIME từ PO + Payments ──────────
	// Chỉ tính PO đã hoàn thành (không tính draft/hủy)
	const completedPOs = useMemo(() =>
		purchaseOrders.filter((po: any) =>
			po.status !== 'Hủy' && po.status !== 'Đơn nháp' && po.status !== 'Draft'
		),
	[purchaseOrders]);

	// Tổng PO cho mỗi supplier
	const supplierPOTotals = useMemo(() => {
		const map: Record<string, { total: number; count: number }> = {};
		completedPOs.forEach((po: any) => {
			if (!po.supplierId) return;
			if (!map[po.supplierId]) map[po.supplierId] = { total: 0, count: 0 };
			map[po.supplierId].total += Number(po.totalAmount || po.total || 0);
			map[po.supplierId].count += 1;
		});
		return map;
	}, [completedPOs]);

	// Tổng payment cho mỗi supplier (chỉ lấy type === 'payment')
	const payments = useMemo(() =>
		debts.filter((d: any) => d.type === 'payment'),
	[debts]);

	const supplierPaymentTotals = useMemo(() => {
		const map: Record<string, number> = {};
		payments.forEach((p: any) => {
			if (!p.supplierId) return;
			map[p.supplierId] = (map[p.supplierId] || 0) + Number(p.amount || 0);
		});
		return map;
	}, [payments]);

	// ─── Statement (phiếu chi tiết công nợ NCC): lọc ngày + dư nợ đầu kỳ ───
	const statement = useMemo(() => {
		if (!selectedSupplier) return null;
		const pos = completedPOs.filter((po: any) => po.supplierId === selectedSupplier.id);
		const pays = payments.filter((p: any) => p.supplierId === selectedSupplier.id);

		const sorted = [
			...pos.map((po: any) => ({ ...po, txType: 'po' })),
			...pays.map((p: any) => ({ ...p, txType: 'payment' })),
		].sort((a: any, b: any) => {
			const da = normDate(a);
			const db = normDate(b);
			if (da !== db) return da.localeCompare(db);
			return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
		});

		let openingBalance = 0;
		if (statementFromDate) {
			const beforePO = sorted
				.filter((t: any) => t.txType === 'po' && normDate(t) && normDate(t) < statementFromDate)
				.reduce((sum: number, o: any) => sum + Number(o.totalAmount || o.total || 0), 0);
			const beforePay = sorted
				.filter((t: any) => t.txType === 'payment' && normDate(t) && normDate(t) < statementFromDate)
				.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
			openingBalance = beforePO - beforePay;
		}

		const cycleTx = sorted.filter((t: any) => {
			const d = normDate(t);
			if (statementFromDate && (!d || d < statementFromDate)) return false;
			if (statementToDate && (!d || d > statementToDate)) return false;
			return true;
		});

		const totalOrders = cycleTx
			.filter((t: any) => t.txType === 'po')
			.reduce((sum: number, o: any) => sum + Number(o.totalAmount || o.total || 0), 0);
		const totalPayments = cycleTx
			.filter((t: any) => t.txType === 'payment')
			.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
		const closingBalance = openingBalance + totalOrders - totalPayments;

		return { sorted, cycleTx, openingBalance, totalOrders, totalPayments, closingBalance };
	}, [selectedSupplier, completedPOs, payments, statementFromDate, statementToDate]);

	// Danh sách NCC có giao dịch (PO hoặc payment)
	const suppliersWithActivity = useMemo(() => {
		return suppliers.filter((s: any) =>
			supplierPOTotals[s.id] || supplierPaymentTotals[s.id]
		);
	}, [suppliers, supplierPOTotals, supplierPaymentTotals]);

	// Tìm kiếm
	const filteredSuppliers = suppliersWithActivity.filter((s: any) =>
		s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
		(s.phone && s.phone.includes(searchTerm))
	);

	// Stats tổng quát
	const totalPOAll = Object.values(supplierPOTotals).reduce((s, v) => s + v.total, 0);
	const totalPaidAll = Object.values(supplierPaymentTotals).reduce((s, v) => s + v, 0);
	const totalRemainingAll = totalPOAll - totalPaidAll;

	// ─── History (tất cả payment + PO mới nhất) ──
	const historyList = useMemo(() => {
		const items: any[] = [];

		// Payments
		payments.forEach((p: any) => {
			items.push({
				id: p.id,
				type: 'payment',
				supplierId: p.supplierId,
				supplierName: p.supplierName || 'Không rõ',
				amount: Number(p.amount || 0),
				note: p.note || '',
				date: p.createdAt,
			});
		});

		// Purchase Orders
		completedPOs.forEach((po: any) => {
			items.push({
				id: po.id,
				type: 'po',
				poNumber: po.poNumber || po.id?.substring(0, 8),
				supplierId: po.supplierId,
				supplierName: po.supplierName || 'Không rõ',
				amount: Number(po.totalAmount || po.total || 0),
				status: po.status,
				date: po.createdAt,
			});
		});

		// Lọc search
		const filtered = items.filter((item: any) => {
			if (!historySearchTerm) return true;
			const term = historySearchTerm.toLowerCase();
			return (item.supplierName || '').toLowerCase().includes(term) ||
				   (item.note || '').toLowerCase().includes(term) ||
				   (item.poNumber || '').toLowerCase().includes(term);
		});

		// Sort mới nhất trước
		filtered.sort((a: any, b: any) => {
			const da = a.date?.seconds ? a.date.seconds * 1000 : new Date(a.date || 0).getTime();
			const db = b.date?.seconds ? b.date.seconds * 1000 : new Date(b.date || 0).getTime();
			return db - da;
		});

		return filtered;
	}, [payments, completedPOs, historySearchTerm]);

	// ─── Handlers ─────────────────────────────────────────
	const handlePayDebt = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedSupplier || !paymentAmount) return;
		const amountNum = parseFloat(paymentAmount.replace(/\D/g, ''));
		if (isNaN(amountNum) || amountNum <= 0) { showToast("Số tiền không hợp lệ", "error"); return; }
		try {
			let finalCreatedAt: any = serverTimestamp();
			if (paymentDate) finalCreatedAt = Timestamp.fromDate(new Date(paymentDate));
			await addDebt({
				supplierId: selectedSupplier.id,
				supplierName: selectedSupplier.name,
				type: 'payment',
				amount: amountNum,
				method: 'Chuyển khoản',
				note: paymentNote || 'Ghi nhận trả nợ',
				createdBy: owner.ownerId,
				createdAt: finalCreatedAt
			});
			showToast("Thanh toán thành công", "success");
			setShowPaymentForm(false);
			setPaymentAmount(''); setPaymentNote(''); setPaymentDate('');
		} catch (error) { console.error(error); showToast("Lỗi thanh toán", "error"); }
	};

	const handleSaveEdit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingPayment || !editAmount) return;
		const amountNum = parseFloat(editAmount.replace(/\D/g, ''));
		if (isNaN(amountNum) || amountNum <= 0) { showToast("Số tiền không hợp lệ", "error"); return; }
		try {
			await updateDebt(editingPayment.id, { amount: amountNum, note: editNote || '' });
			showToast("Cập nhật thành công", "success");
			setShowEditForm(false); setEditingPayment(null);
		} catch (error) { console.error(error); showToast("Lỗi cập nhật", "error"); }
	};

	const handleDeletePayment = async (payment: any) => {
		if (!window.confirm(`Xoá khoản thanh toán ${fmt(payment.amount)}đ của ${payment.supplierName}?`)) return;
		try { await removeDebt(payment.id); showToast("Đã xoá", "success"); }
		catch (error: any) { showToast(`Lỗi: ${error.message || 'Không xác định'}`, "error"); }
	};

	const handlePrint = () => {
		if (!selectedSupplier) return;
		const printWindow = window.open('', '_blank', 'width=1200,height=1000');
		if (!printWindow) {
			alert('Vui lòng cho phép trình duyệt mở popup để in!');
			return;
		}

		let styles = '';
		try {
			for (const sheet of document.styleSheets) {
				try {
					if (sheet.cssRules) {
						for (const rule of sheet.cssRules) {
							styles += rule.cssText + '\n';
						}
					}
				} catch (e) {
					if (sheet.href) {
						styles += `@import url("${sheet.href}");\n`;
					}
				}
			}
		} catch (err) {
			console.warn('Could not inline all styles directly', err);
		}

		let fallbackTags = '';
		document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
			fallbackTags += node.outerHTML;
		});

		const s = statement;
		const combinedTx = s?.cycleTx || [];
		const openingBalance = s?.openingBalance || 0;
		const poTotal = s?.totalOrders || 0;
		const paidTotal = s?.totalPayments || 0;
		const remaining = s?.closingBalance ?? 0;

		const formatPriceLocal = (val: number) => Number(val || 0).toLocaleString('vi-VN');
		const formatDateLocal = (dateStr: any) => {
			if (!dateStr) return '';
			const d = new Date(dateStr.seconds ? dateStr.seconds * 1000 : dateStr);
			if (isNaN(d.getTime())) return '';
			return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
		};

		const ordersTx = combinedTx.filter((t) => t.txType === 'po');
		let ordersRows = '';
		ordersTx.forEach((tx, idx) => {
			const txDate = formatDateLocal(tx.createdAt);
			const txName = `Nhập đơn #${tx.poNumber || tx.id?.substring(0, 8).toUpperCase()}`;
			const txAmount = `+${formatPriceLocal(tx.totalAmount || tx.total)}`;
			ordersRows += `
				<div class="py-2.5 space-y-1 border-b border-dashed border-slate-200">
					<div class="flex items-start gap-2.5 font-extrabold text-black uppercase leading-tight text-sm">
						<span class="shrink-0 pt-0.5">${idx + 1}.</span>
						<span class="min-w-0 break-words pt-0.5">${txName}</span>
					</div>
					<div class="flex justify-between items-center text-xs font-bold text-slate-700">
						<span class="whitespace-nowrap">Ngày: ${txDate}</span>
						<span class="text-black text-sm font-black whitespace-nowrap">${txAmount} đ</span>
					</div>
				</div>
			`;
		});
		if (ordersTx.length === 0) {
			ordersRows = `<div class="py-3 text-center text-xs text-slate-400 italic">Không có đơn nhập hàng nào</div>`;
		}

		const paymentsTx = combinedTx.filter((t) => t.txType === 'payment');
		let paymentsRows = '';
		paymentsTx.forEach((tx, idx) => {
			const txDate = formatDateLocal(tx.createdAt);
			const txName = `Trả nợ`;
			const txAmount = `-${formatPriceLocal(tx.amount)}`;
			paymentsRows += `
				<div class="py-2.5 space-y-1 border-b border-dashed border-slate-200">
					<div class="flex items-start gap-2.5 font-extrabold text-black uppercase leading-tight text-sm">
						<span class="shrink-0 pt-0.5">${idx + 1}.</span>
						<span class="min-w-0 break-words pt-0.5">${txName}</span>
					</div>
					<div class="flex justify-between items-center text-xs font-bold text-slate-700">
						<span class="whitespace-nowrap">Ngày: ${txDate}</span>
						<span class="text-emerald-600 text-sm font-black whitespace-nowrap">${txAmount} đ</span>
					</div>
				</div>
			`;
		});
		if (paymentsTx.length === 0) {
			paymentsRows = `<div class="py-3 text-center text-xs text-slate-400 italic">Chưa có giao dịch thanh toán nào</div>`;
		}

		const getTicketImageUrl = (url: string) => {
			if (!url) return '';
			if (url.startsWith('data:') || url.startsWith('http')) return url;
			return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
		};

		const companyLogoHtml = companyInfo?.logoUrl 
			? `<div class="w-16 h-16 rounded-full border border-slate-200 overflow-hidden bg-white shrink-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
					<img src="${getTicketImageUrl(companyInfo.logoUrl)}" alt="Logo" class="w-full h-full object-cover" crossorigin="anonymous" />
				 </div>`
			: `<div class="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center text-white shrink-0 font-bold text-xl">
					${(companyInfo?.name || 'D').slice(0, 1).toUpperCase()}
				 </div>`;

		printWindow.document.write(`
			<html>
				<head>
					<base href="${window.location.origin}/">
					<title>In Công Nợ NCC - ${selectedSupplier.name}</title>
					<link rel="preconnect" href="https://fonts.googleapis.com">
					<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
					<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Manrope:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
					<style>${styles}</style>
					${fallbackTags}
					<style>
						@page { size: 80mm auto; margin: 0; }
						body {
							width: 80mm !important;
							margin: 0 auto !important;
							padding: 0 !important;
							background: white !important;
							font-family: 'Inter', 'Manrope', sans-serif !important;
						}
						#supplier-debt-print-bill {
							width: 80mm !important;
							max-width: 80mm !important;
							padding: 10px 14px !important;
							box-shadow: none !important;
							border: none !important;
							background: white !important;
							visibility: visible !important;
							display: block !important;
							box-sizing: border-box !important;
						}
						#supplier-debt-print-bill .border-slate-950 span {
							font-size: 14px !important;
						}
						#supplier-debt-print-bill .border-slate-950 .text-lg {
							font-size: 16px !important;
						}
						* {
							box-sizing: border-box !important;
							-webkit-print-color-adjust: exact !important;
							print-color-adjust: exact !important;
						}
					</style>
				</head>
				<body>
					<div id="supplier-debt-print-bill">
						<main class="bg-white text-black text-sm">
							<!-- Company Header -->
							<div class="flex items-center gap-4 mb-4">
								${companyLogoHtml}
								<div class="text-left min-w-0">
									<h2 class="text-xl font-black uppercase leading-tight tracking-tight text-black break-words">
										${companyInfo?.name || 'DUNVEX'}
									</h2>
									<div class="text-[11px] text-slate-600 font-semibold space-y-0.5 mt-1 leading-snug">
										<p class="truncate">${companyInfo?.address || 'XÃ KIẾN ĐỨC , LÂM ĐỒNG'}</p>
										<p>SĐT: ${companyInfo?.phone || '0988765444'}</p>
									</div>
								</div>
							</div>

							<!-- Bill Title -->
							<div class="text-center border-t border-b border-dashed border-slate-400 py-2 my-3">
								<h1 class="text-base font-black uppercase tracking-wider">CÔNG NỢ NHÀ CUNG CẤP</h1>
								<p class="text-[10px] text-slate-500 font-bold mt-0.5">#${selectedSupplier.id?.slice(-6).toUpperCase()}</p>
							</div>

							<!-- Bill Metadata -->
							<div class="space-y-1.5 text-xs text-slate-800 font-semibold mb-4 leading-normal">
								<div class="flex justify-between items-start gap-3">
									<span class="shrink-0 text-slate-500">Nhà cung cấp:</span>
									<span class="font-bold text-black uppercase text-right">${selectedSupplier.name}</span>
								</div>
								${(statementFromDate || statementToDate) ? `
								<div class="flex justify-between items-start gap-3">
									<span class="shrink-0 text-slate-500">Kỳ lọc:</span>
									<span class="text-right font-bold text-slate-800">${statementFromDate ? `Từ ${formatDateLocal(statementFromDate)}` : ''}${statementToDate ? ` đến ${formatDateLocal(statementToDate)}` : ''}</span>
								</div>
								` : ''}
								<div class="flex justify-between items-start gap-3">
									<span class="shrink-0 text-slate-500">Tổng tiền nhập hàng:</span>
									<span class="text-right font-bold">${formatPriceLocal(poTotal)} đ</span>
								</div>
								<div class="flex justify-between items-start gap-3">
									<span class="shrink-0 text-slate-500">Tổng tiền trả:</span>
									<span class="text-right font-bold text-emerald-600">-${formatPriceLocal(paidTotal)} đ</span>
								</div>
								<div class="flex justify-between items-start gap-3">
									<span class="shrink-0 text-slate-500">Số tiền công nợ còn lại:</span>
									<span class="text-right font-black text-red-600">${formatPriceLocal(remaining)} đ</span>
								</div>
							</div>

							<!-- Purchases Section -->
							<div class="mt-4">
								<div class="border-t border-dashed border-slate-400 pt-2 font-bold text-xs text-slate-500 flex justify-between uppercase">
									<span>DANH SÁCH ĐƠN MUA</span>
									<span>Số tiền</span>
								</div>
								<div class="divide-y divide-dashed divide-slate-200 mt-1">
									${ordersRows}
								</div>
							</div>

							<!-- Payments Section -->
							<div class="mt-4">
								<div class="border-t border-dashed border-slate-400 pt-2 font-bold text-xs text-slate-500 flex justify-between uppercase">
									<span>ĐÃ THANH TOÁN</span>
									<span>Số tiền</span>
								</div>
								<div class="divide-y divide-dashed divide-slate-200 mt-1">
									${paymentsRows}
								</div>
							</div>

							<!-- Totals Section -->
							<div class="border-t border-dashed border-slate-400 pt-3 space-y-2 text-xs font-bold text-slate-700">
								${(statementFromDate && openingBalance !== 0) ? `
								<div class="flex justify-between items-center gap-4">
									<span class="shrink-0">Dư nợ đầu kỳ:</span>
									<span class="text-black whitespace-nowrap">${formatPriceLocal(openingBalance)} đ</span>
								</div>
								` : ''}
								<div class="flex justify-between items-center gap-4">
									<span class="shrink-0">Tổng nhập (+):</span>
									<span class="text-black whitespace-nowrap">${formatPriceLocal(poTotal)} đ</span>
								</div>
								<div class="flex justify-between items-center gap-4">
									<span class="shrink-0">Đã thanh toán (-):</span>
									<span class="text-emerald-600 whitespace-nowrap">-${formatPriceLocal(paidTotal)} đ</span>
								</div>

								<div class="border-t border-slate-950 pt-2 flex justify-between items-center font-black text-base text-black uppercase gap-4 border-t border-slate-950 border-double">
									<span class="shrink-0">Dư nợ cần trả:</span>
									<span class="text-lg whitespace-nowrap">${formatPriceLocal(remaining)} đ</span>
								</div>
							</div>

							<!-- Signatures -->
							<div class="border-t border-dashed border-slate-400 mt-6 pt-4 grid grid-cols-2 gap-4 text-center text-[10px] font-bold text-slate-500 uppercase leading-normal">
								<div>
									<p class="mb-10">Người nhận (NCC)</p>
									<div class="mx-auto h-px w-16 bg-slate-300"></div>
								</div>
								<div>
									<p class="mb-10">Người lập phiếu</p>
									<span class="text-black font-extrabold">${auth.currentUser?.displayName || 'Nhân viên'}</span>
								</div>
							</div>

							<div class="text-center text-[10px] text-slate-400 font-bold mt-8 italic leading-snug">
								Cảm ơn quý đối tác đã tin tưởng và hợp tác cùng Dunvex Build!
							</div>
						</main>
					</div>
					<script>
						function checkStylesAndPrint() {
							const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
							let loadedCount = 0;

							const printAndClose = () => {
								if (window.hasPrinted) return;
								window.hasPrinted = true;

								if (document.fonts && document.fonts.ready) {
									document.fonts.ready.then(() => {
										setTimeout(() => {
											window.print();
											if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
												window.close();
											}
										}, 250);
									}).catch(() => {
										setTimeout(() => {
											window.print();
											if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
												window.close();
											}
										}, 250);
									});
								} else {
									setTimeout(() => {
										window.print();
										if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
											window.close();
										}
									}, 250);
								}
							};

							if (links.length === 0) {
								printAndClose();
								return;
							}

							links.forEach(link => {
								if (link.sheet) {
									loadedCount++;
									if (loadedCount === links.length) {
										printAndClose();
									}
								} else {
									link.onload = () => {
										loadedCount++;
										if (loadedCount === links.length) {
											printAndClose();
										}
									};
									link.onerror = () => {
										loadedCount++;
										if (loadedCount === links.length) {
											printAndClose();
										}
									};
								}
							});

							setTimeout(printAndClose, 1200);
						}

						if (document.readyState === 'complete') {
							checkStylesAndPrint();
						} else {
							window.onload = checkStylesAndPrint;
						}
					</script>
				</body>
			</html>
		`);
		printWindow.document.close();
	};

	// ─── Render ───────────────────────────────────────────
	return (
		<div className="h-full flex flex-col pb-24 lg:pb-0">
			{/* Header */}
			<div className="sticky top-0 z-40 bg-[#f8f9fa] dark:bg-slate-950 pb-4">
				<div className="flex flex-col gap-4">
					<div className="flex items-center justify-between">
						<h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3">
							<Package size={28} className="text-[#FF6D00]" />
							Công Nợ Nhà Cung Cấp
						</h1>
					</div>

					{/* Tabs */}
					<div className="flex border-b border-slate-200 dark:border-slate-800">
						<button onClick={() => { setActiveTab('debts'); setDebtPage(1); }}
							className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'debts' ? 'border-[#FF6D00] text-[#FF6D00]' : 'border-transparent text-slate-500'}`}>
							Cần Thanh Toán
						</button>
						<button onClick={() => { setActiveTab('history'); setHistoryPage(1); }}
							className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'history' ? 'border-[#FF6D00] text-[#FF6D00]' : 'border-transparent text-slate-500'}`}>
							Lịch Sử
						</button>
					</div>
				</div>
			</div>

			{/* ── TAB: Cần Thanh Toán ── */}
			{activeTab === 'debts' && (
				<div className="mt-4">
					{/* Summary Cards */}
					<div className="grid grid-cols-3 gap-3 mb-5">
						<div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
							<div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tổng nhập hàng</div>
							<div className="text-xl font-black text-red-600">{fmt(totalPOAll)}đ</div>
							<div className="text-xs text-slate-400 mt-1">{completedPOs.length} đơn</div>
						</div>
						<div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
							<div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Đã thanh toán</div>
							<div className="text-xl font-black text-emerald-600">{fmt(totalPaidAll)}đ</div>
							<div className="text-xs text-slate-400 mt-1">{payments.length} giao dịch</div>
						</div>
						<div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
							<div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Còn nợ</div>
							<div className={`text-xl font-black ${totalRemainingAll > 0 ? 'text-[#FF6D00]' : 'text-emerald-600'}`}>{fmt(Math.max(0, totalRemainingAll))}đ</div>
							<div className="text-xs text-slate-400 mt-1">{filteredSuppliers.length} NCC</div>
						</div>
					</div>

					{/* Search */}
					<div className="mb-4 relative">
						<Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
						<input type="text" placeholder="Tìm theo tên hoặc số điện thoại..."
							value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setDebtPage(1); }}
							className="w-full h-12 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all text-sm" />
					</div>

					{/* Supplier list */}
					<div className="space-y-2">
						{filteredSuppliers
							.sort((a: any, b: any) => {
								const debtA = (supplierPOTotals[a.id]?.total || 0) - (supplierPaymentTotals[a.id] || 0);
								const debtB = (supplierPOTotals[b.id]?.total || 0) - (supplierPaymentTotals[b.id] || 0);
								return debtB - debtA;
							})
							.slice((debtPage - 1) * PER_PAGE, debtPage * PER_PAGE)
							.map((supplier: any) => {
								const poTotal = supplierPOTotals[supplier.id]?.total || 0;
								const paidTotal = supplierPaymentTotals[supplier.id] || 0;
								const remaining = poTotal - paidTotal;
								const poCount = supplierPOTotals[supplier.id]?.count || 0;
								return (
									<div key={supplier.id}
										onClick={() => openDetail(supplier, 'po')}
										className="bg-white border border-slate-200 rounded-2xl p-4 cursor-pointer hover:border-[#FF6D00]/30 hover:shadow-md transition-all">
										<div className="flex items-center justify-between mb-3">
											<div>
												<h3 className="font-bold text-slate-800">{supplier.name}</h3>
												{supplier.phone && <p className="text-xs text-slate-400 mt-0.5">{supplier.phone}</p>}
											</div>
											{remaining > 0 && (
												<button onClick={(e) => { e.stopPropagation(); setSelectedSupplier(supplier); setShowPaymentForm(true); }}
													className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all flex items-center gap-2 text-sm shrink-0">
													💰 Trả Nợ
												</button>
											)}
											{remaining <= 0 && (
												<span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">✅ Đã xong</span>
											)}
										</div>
										<div className="grid grid-cols-3 gap-4">
											<div>
												<div className="text-xs text-slate-400 mb-0.5">Nhập hàng</div>
												<div className="font-bold text-red-600">{fmt(poTotal)}đ</div>
												<div className="text-xs text-slate-400">{poCount} đơn</div>
											</div>
											<div>
												<div className="text-xs text-slate-400 mb-0.5">Đã trả</div>
												<div className="font-bold text-emerald-600">{fmt(paidTotal)}đ</div>
											</div>
											<div>
												<div className="text-xs text-slate-400 mb-0.5">Còn nợ</div>
												<div className={`font-bold ${remaining > 0 ? 'text-[#FF6D00]' : 'text-emerald-600'}`}>
													{fmt(Math.max(0, remaining))}đ
												</div>
											</div>
										</div>
									</div>
								);
							})}
						{filteredSuppliers.length === 0 && (
							<div className="py-16 text-center text-slate-400 bg-white/50 rounded-2xl border border-dashed border-slate-200">
								<div className="text-4xl mb-3">📭</div>
								<div className="font-semibold">Không có nhà cung cấp nào</div>
							</div>
						)}
					</div>
					<Pagination page={debtPage} total={filteredSuppliers.length} perPage={PER_PAGE} onChange={setDebtPage} />
				</div>
			)}

			{/* ── TAB: Lịch Sử ── */}
			{activeTab === 'history' && (
				<div className="mt-4">
					<div className="mb-4 relative">
						<Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
						<input type="text" placeholder="Tìm theo tên NCC, mã đơn..."
							value={historySearchTerm} onChange={(e) => { setHistorySearchTerm(e.target.value); setHistoryPage(1); }}
							className="w-full h-12 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all text-sm" />
					</div>

					<div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
						<div className="bg-slate-50 px-4 py-3 grid grid-cols-[1fr_2fr_1fr_auto] gap-3 text-xs font-black text-slate-400 uppercase tracking-wider">
							<span>Thời gian</span>
							<span>NCC / Diễn giải</span>
							<span className="text-right">Số tiền</span>
							<span className="text-right w-16">Xoá</span>
						</div>
						{historyList.slice((historyPage - 1) * PER_PAGE, historyPage * PER_PAGE).map((item: any) => {
							const isPO = item.type === 'po';
							return (
								<div key={item.id + item.type} className="px-4 py-3 grid grid-cols-[1fr_2fr_1fr_auto] gap-3 items-center border-t border-slate-100 text-sm hover:bg-slate-50 transition">
									<span className="text-xs text-slate-500">{fmtDateTime(item.date)}</span>
									<div>
										<div className="font-semibold text-slate-700 truncate">{item.supplierName}</div>
										<div className="flex items-center gap-2">
											{isPO ? (
												<span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold">📦 Đơn Nhập #{item.poNumber}</span>
											) : (
												<span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">💰 Trả nợ</span>
											)}
										</div>
										{item.note && <div className="text-xs text-slate-400 truncate mt-0.5 italic">{item.note}</div>}
									</div>
									<span className={`text-right font-bold ${isPO ? 'text-red-600' : 'text-emerald-600'}`}>
										{isPO ? '+' : '-'}{fmt(item.amount)}đ
									</span>
									<span className="flex justify-end w-16">
										{!isPO && (
											<div className="flex gap-1">
												<button onClick={() => { setEditingPayment(item); setEditAmount(item.amount.toString()); setEditNote(item.note || ''); setShowEditForm(true); }}
													className="p-1.5 text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-lg transition shadow-sm cursor-pointer"><Edit2 size={14} /></button>
												<button onClick={() => handleDeletePayment(item)}
													className="p-1.5 text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition shadow-sm cursor-pointer"><Trash2 size={14} /></button>
											</div>
										)}
									</span>
								</div>
							);
						})}
						{historyList.length === 0 && (
							<div className="py-16 text-center text-slate-400">
								<div className="text-4xl mb-3">📭</div>
								<div className="font-semibold">Chưa có giao dịch nào</div>
							</div>
						)}
					</div>
					<Pagination page={historyPage} total={historyList.length} perPage={PER_PAGE} onChange={setHistoryPage} />
				</div>
			)}

			{/* ── MODAL: Chi tiết NCC ── */}
			{showDetail && selectedSupplier && (() => {
				const s = statement;
				const openingBalance = s?.openingBalance || 0;
				const totalOrders = s?.totalOrders || 0;
				const totalPayments = s?.totalPayments || 0;
				const closingBalance = s?.closingBalance ?? 0;
				const cycleTx = s?.cycleTx || [];
				const poTx = cycleTx.filter((t: any) => t.txType === 'po');
				const paymentTx = cycleTx.filter((t: any) => t.txType === 'payment');

				return (
					<div className="fixed inset-0 z-[150] bg-slate-955/95 backdrop-blur-xl flex flex-col items-center justify-start overflow-hidden print:hidden animate-in fade-in duration-200"
						onClick={() => { setShowDetail(false); setStatementZoom(1); }}>
						{/* Controls bar */}
						<div className="w-full flex items-center justify-between p-3 bg-slate-950/80 backdrop-blur-lg border-b border-white/5 z-[160] no-print" onClick={e => e.stopPropagation()}>
							<span className="text-white text-xs font-black uppercase tracking-wider pl-2 hidden lg:inline">Chi tiết công nợ nhà cung cấp</span>

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
									onClick={handlePrint}
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
								onClick={() => { setShowDetail(false); setStatementZoom(1); }}
								className="size-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/20 transition-all font-bold text-xs active:scale-95"
								title="Đóng"
							>
								<X size={18} />
							</button>
						</div>

						{/* SCROLLABLE DOCUMENT AREA */}
						<div className="w-full h-full overflow-y-auto pt-6 pb-28 md:pb-10 flex flex-col items-center justify-start p-4 custom-scrollbar" onClick={() => { setShowDetail(false); setStatementZoom(1); }}>
							<div
								className="my-auto flex flex-col items-center"
								style={{
									zoom: statementZoom,
									transformOrigin: 'top center',
								}}
								onClick={e => e.stopPropagation()}
							>
								{/* The ticket sheet */}
								<div
									id="supplier-debt-print-bill"
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
										<h1 className="text-base font-black uppercase tracking-wider">CÔNG NỢ NHÀ CUNG CẤP</h1>
										<p className="text-[10px] text-slate-500 font-bold mt-0.5">#{selectedSupplier.id?.slice(-6).toUpperCase()}</p>
									</div>

									{/* Bill Metadata */}
									<div className="space-y-1.5 text-xs text-slate-800 font-semibold mb-4 leading-normal">
										<div className="flex justify-between items-start gap-3">
											<span className="shrink-0 text-slate-500">Nhà cung cấp:</span>
											<span className="font-bold text-black uppercase text-right">{selectedSupplier.name}</span>
										</div>
										{(statementFromDate || statementToDate) && (
											<div className="flex justify-between items-start gap-3">
												<span className="shrink-0 text-slate-500">Kỳ lọc:</span>
												<span className="text-right font-bold text-slate-800">
													{statementFromDate && `Từ ${fmtDate(statementFromDate)}`}
													{statementToDate && ` đến ${fmtDate(statementToDate)}`}
												</span>
											</div>
										)}
										<div className="flex justify-between items-start gap-3">
											<span className="shrink-0 text-slate-500">Tổng tiền nhập hàng:</span>
											<span className="text-right font-bold">{fmt(totalOrders)} đ</span>
										</div>
										<div className="flex justify-between items-start gap-3">
											<span className="shrink-0 text-slate-500">Tổng tiền trả:</span>
											<span className="text-right font-bold text-emerald-600">-{fmt(totalPayments)} đ</span>
										</div>
										<div className="flex justify-between items-start gap-3">
											<span className="shrink-0 text-slate-500">Số tiền công nợ còn lại:</span>
											<span className="text-right font-black text-red-600">{fmt(closingBalance)} đ</span>
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
												const ordersTx = poTx;
												if (ordersTx.length === 0) {
													return <div className="py-3 text-center text-xs text-slate-400 italic">Không có đơn nhập hàng nào</div>;
												}
												return ordersTx.map((tx: any, idx: number) => {
													const txDate = fmtDate(tx.createdAt);
													const txName = `Nhập đơn #${tx.poNumber || tx.id?.substring(0, 8).toUpperCase()}`;
													const txAmount = `+${fmt(tx.totalAmount || tx.total)}`;
													return (
														<div key={idx} className="py-2.5 space-y-1 border-b border-dashed border-slate-200">
															<div className="flex items-start gap-2.5 font-extrabold text-black uppercase leading-tight text-sm">
																<span className="shrink-0 pt-0.5">{idx + 1}.</span>
																<span className="min-w-0 break-words pt-0.5">{txName}</span>
															</div>
															<div className="flex justify-between items-center text-xs font-bold text-slate-700">
																<span className="whitespace-nowrap">Ngày: {txDate}</span>
																<span className="text-black text-sm font-black whitespace-nowrap">{txAmount} đ</span>
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
												const paymentsTx = paymentTx;
												if (paymentsTx.length === 0) {
													return <div className="py-3 text-center text-xs text-slate-400 italic">Chưa có thanh toán nào</div>;
												}
												return paymentsTx.map((tx: any, idx: number) => {
													const txDate = fmtDate(tx.createdAt);
													const txName = `Trả nợ`;
													const txAmount = `-${fmt(tx.amount)}`;
													return (
														<div key={idx} className="py-2.5 space-y-1 border-b border-dashed border-slate-200">
															<div className="flex items-start gap-2.5 font-extrabold text-black uppercase leading-tight text-sm">
																<span className="shrink-0 pt-0.5">{idx + 1}.</span>
																<span className="min-w-0 break-words pt-0.5">{txName}</span>
															</div>
															<div className="flex justify-between items-center text-xs font-bold text-slate-700">
																<span className="whitespace-nowrap">Ngày: {txDate}</span>
																<span className="text-emerald-600 text-sm font-black whitespace-nowrap">{txAmount} đ</span>
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
												<span className="text-black whitespace-nowrap">{fmt(openingBalance)} đ</span>
											</div>
										)}
										<div className="flex justify-between items-center gap-4">
											<span className="shrink-0">Tổng nhập (+):</span>
											<span className="text-black whitespace-nowrap">{fmt(totalOrders)} đ</span>
										</div>
										<div className="flex justify-between items-center gap-4">
											<span className="shrink-0">Đã thanh toán (-):</span>
											<span className="text-emerald-600 whitespace-nowrap">-{fmt(totalPayments)} đ</span>
										</div>

										<div className="border-t border-slate-950 pt-2 flex justify-between items-center font-black text-base text-black uppercase gap-4 border-t border-slate-950 border-double">
											<span className="shrink-0">Dư nợ cần trả:</span>
											<span className="text-lg whitespace-nowrap">{fmt(closingBalance)} đ</span>
										</div>
									</div>

									{/* Signatures */}
									<div className="border-t border-dashed border-slate-400 mt-6 pt-4 grid grid-cols-2 gap-4 text-center text-[10px] font-bold text-slate-500 uppercase leading-normal">
										<div>
											<p className="mb-10">Người nhận (NCC)</p>
											<div className="mx-auto h-px w-16 bg-slate-300"></div>
										</div>
										<div>
											<p className="mb-10">Người lập phiếu</p>
											<span className="text-black font-extrabold">{auth.currentUser?.displayName || 'Nhân viên'}</span>
										</div>
									</div>

									<div className="text-center text-[10px] text-slate-400 font-bold mt-8 italic leading-snug">
										Cảm ơn quý đối tác đã tin tưởng và hợp tác cùng Dunvex Build!
									</div>
								</div>
							</div>
						</div>

						{/* Zoom toolbar */}
						<div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-md rounded-full p-1.5 border border-white/10 flex items-center gap-2 z-[160] no-print" onClick={e => e.stopPropagation()}>
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
								onClick={handlePrint}
								className="w-12 h-12 rounded-xl bg-slate-800 text-white flex items-center justify-center border border-slate-700 shadow-lg transition-all active:scale-95 hover:bg-black"
								title="In phiếu"
							>
								<Printer size={16} />
							</button>
						</div>
					</div>
				);
			})()}

			{/* ── MODAL: Trả Nợ ── */}
			{showPaymentForm && selectedSupplier && (() => {
				const poTotal = supplierPOTotals[selectedSupplier.id]?.total || 0;
				const paidTotal = supplierPaymentTotals[selectedSupplier.id] || 0;
				const remaining = Math.max(0, poTotal - paidTotal);
				return (
					<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
						onClick={() => setShowPaymentForm(false)}>
						<div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
							<div className="flex items-center justify-between p-4 border-b border-slate-100">
								<h3 className="font-black text-lg text-slate-800">Thanh Toán Trả Nợ</h3>
								<button onClick={() => setShowPaymentForm(false)}
									className="p-2 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition"><X size={20} /></button>
							</div>
							<div className="p-5">
								<div className="bg-slate-50 rounded-xl p-4 mb-5">
									<div className="text-sm text-slate-500">Thanh toán cho:</div>
									<div className="font-bold text-slate-800">{selectedSupplier.name}</div>
									<div className="grid grid-cols-2 gap-3 mt-3">
										<div>
											<div className="text-xs text-slate-400">Nhập hàng</div>
											<div className="font-bold text-red-600">{fmt(poTotal)}đ</div>
										</div>
										<div>
											<div className="text-xs text-slate-400">Còn nợ</div>
											<div className="font-bold text-[#FF6D00]">{fmt(remaining)}đ</div>
										</div>
									</div>
								</div>
								<form id="payDebtForm" onSubmit={handlePayDebt} className="space-y-4">
									<div>
										<label className="block text-xs font-bold text-slate-400 uppercase mb-2">Số Tiền <span className="text-red-500">*</span></label>
										<input type="text" required value={paymentAmount}
											onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setPaymentAmount(v ? Number(v).toLocaleString('vi-VN') : ''); }}
											className="w-full h-12 px-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg text-right" placeholder="0" />
									</div>
									<div>
										<label className="block text-xs font-bold text-slate-400 uppercase mb-2">Ghi chú</label>
										<textarea rows={2} value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)}
											className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none text-sm" placeholder="Nhập ghi chú..." />
									</div>
									<div>
										<label className="block text-xs font-bold text-slate-400 uppercase mb-2">Ngày thanh toán</label>
										<input type="datetime-local" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
											className="w-full h-12 px-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium" />
									</div>
								</form>
							</div>
							<div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
								<button onClick={() => setShowPaymentForm(false)}
									className="flex-1 py-3 border border-slate-200 bg-white rounded-xl font-bold text-slate-600">Huỷ</button>
								<button type="submit" form="payDebtForm"
									className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/30 transition">Xác Nhận Trả</button>
							</div>
						</div>
					</div>
				);
			})()}

			{/* ── MODAL: Sửa Payment ── */}
			{showEditForm && editingPayment && (
				<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
					onClick={() => setShowEditForm(false)}>
					<div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
						<div className="flex items-center justify-between p-4 border-b border-slate-100">
							<h3 className="font-black text-lg text-slate-800">Chỉnh Sửa Thanh Toán</h3>
							<button onClick={() => setShowEditForm(false)}
								className="p-2 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition"><X size={20} /></button>
						</div>
						<div className="p-5">
							<div className="bg-slate-50 rounded-xl p-3 mb-4">
								<div className="text-sm font-semibold text-slate-700">{editingPayment.supplierName}</div>
							</div>
							<form id="editPaymentForm" onSubmit={handleSaveEdit} className="space-y-4">
								<div>
									<label className="block text-xs font-bold text-slate-400 uppercase mb-2">Số Tiền <span className="text-red-500">*</span></label>
									<input type="text" required value={editAmount}
										onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setEditAmount(v ? Number(v).toLocaleString('vi-VN') : ''); }}
										className="w-full h-12 px-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg text-right" placeholder="0" />
								</div>
								<div>
									<label className="block text-xs font-bold text-slate-400 uppercase mb-2">Ghi chú</label>
									<textarea rows={2} value={editNote} onChange={(e) => setEditNote(e.target.value)}
										className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm" />
								</div>
							</form>
						</div>
						<div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
							<button onClick={() => setShowEditForm(false)}
								className="flex-1 py-3 border border-slate-200 bg-white rounded-xl font-bold text-slate-600">Huỷ</button>
							<button type="submit" form="editPaymentForm"
								className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 transition">Lưu</button>
						</div>
					</div>
				</div>
			)}

			{/* CAPTURED IMAGE PREVIEW MODAL */}
			{capturedImage && (
				<div className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-xl flex flex-col justify-between p-4 animate-in fade-in duration-200" onClick={() => setCapturedImage(null)}>
					<div className="w-full flex items-center justify-between p-2 border-b border-slate-800 shrink-0" onClick={e => e.stopPropagation()}>
						<span className="text-white font-black text-sm uppercase tracking-wider">ẢNH PREVIEW PHIẾU CÔNG NỢ NCC</span>
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
							alt="Phiếu Công Nợ Nhà Cung Cấp" 
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
								link.download = `cong_no_ncc_${selectedSupplier?.name?.replace(/\s+/g, '_') || 'ncc'}.png`;
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
							<p className="text-slate-400 text-xs leading-relaxed">Đã sao chép ảnh phiếu công nợ nhà cung cấp vào khay nhớ tạm. Bạn có thể dán (Paste) gửi ngay sang Zalo / Facebook!</p>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default SupplierDebts;
