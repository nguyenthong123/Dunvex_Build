import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, Timestamp, doc, writeBatch, limit, orderBy, deleteDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Wallet, TrendingUp, TrendingDown, Receipt, Clock, BarChart3, Plus, ArrowUpRight, ArrowDownLeft, Filter, Search, Calendar, ChevronRight, Trash2, Settings2, Target, Award, Bot, Sparkles, Bell, BellOff, RefreshCcw } from 'lucide-react';
import { useOwner } from '../hooks/useOwner';
import { useToast } from '../components/shared/Toast';

import { useSearchParams } from 'react-router-dom';

const BANKS = [
	'Vietcombank', 'BIDV', 'Agribank', 'VietinBank', 'Techcombank',
	'MBBank', 'VPBank', 'ACB', 'Sacombank', 'TPBank', 'HDBank', 'VIB'
];

const LOAN_TERMS = [
	'3 tháng', '6 tháng', '12 tháng (1 năm)', '24 tháng (2 năm)', '36 tháng (3 năm)', '60 tháng (5 năm)'
];

const Finance = () => {
	const owner = useOwner();
	const { showToast } = useToast();
	const isAdmin = owner.role === 'admin' || owner.accessRights?.finance_view === true;
	const currentUserId = auth.currentUser?.uid;
	const [searchParams, setSearchParams] = useSearchParams();
	const tabParam = searchParams.get('tab') as 'cashbook' | 'aging' | 'profit' | null;
	const [activeTab, setActiveTab] = useState<'cashbook' | 'aging' | 'profit'>(tabParam || 'cashbook');
	const [cashLogs, setCashLogs] = useState<any[]>([]);
	const [orders, setOrders] = useState<any[]>([]);
	const [payments, setPayments] = useState<any[]>([]);
	const [customers, setCustomers] = useState<any[]>([]);
	const [staffs, setStaffs] = useState<any[]>([]);
	const [checkins, setCheckins] = useState<any[]>([]);
	const [products, setProducts] = useState<any[]>([]);
	const [inventoryLogs, setInventoryLogs] = useState<any[]>([]);
	const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
	const cashLogsRef = useRef<any[]>([]);
	const [commissionRate, setCommissionRate] = useState(5); // Default 5%
	const [loading, setLoading] = useState(true);
	const [currentPage, setCurrentPage] = useState(1);
	const ITEMS_PER_PAGE = 10;


	const [fromDate, setFromDate] = useState(() => {
		const now = new Date();
		return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
	});
	const [toDate, setToDate] = useState(() => {
		const now = new Date();
		return new Date(now.getFullYear(), now.getMonth() + 12, 0).toISOString().split('T')[0];
	});
	const [isSendingReminders, setIsSendingReminders] = useState(false);
	const [agingAiInsight, setAgingAiInsight] = useState<string | null>(null);
	const [agingData, setAgingData] = useState<any>({ under30: [], between30_60: [], between60_90: [], over90: [] });
	const [aiProfitInsight, setAiProfitInsight] = useState<{ id: string, insight: string, loading: boolean } | null>(null);

	// Cashbook Form
	const [showLogForm, setShowLogForm] = useState(searchParams.get('new') === 'true');
	const [editingId, setEditingId] = useState<string | null>(null);
	const [logData, setLogData] = useState({
		type: 'chi' as 'thu' | 'chi',
		amount: 0,
		category: 'Vận hành',
		note: '',
		date: new Date().toISOString().split('T')[0],
		interestRate: 0,
		bankName: '',
		loanTerm: '',
		reminderEnabled: false,
		email: '',
		parentId: ''
	});
	const [isFetchingRate, setIsFetchingRate] = useState(false);
	const interestRateManual = useRef(false);
	const [selectedNote, setSelectedNote] = useState<string | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; log: any } | null>(null);

	// Sync tab with URL
	useEffect(() => {
		if (tabParam && tabParam !== activeTab) {
			setActiveTab(tabParam);
		}
	}, [tabParam]);


	// Sync modal with URL
	useEffect(() => {
		const isNew = searchParams.get('new') === 'true';
		if (isNew !== showLogForm) {
			setShowLogForm(isNew);
		}
	}, [searchParams]);

	// 2. Debt Aging
	const getAgingData = () => {
		const today = new Date();
		// Nếu toDate là tương lai, dùng ngày hiện tại. Nếu toDate là quá khứ, dùng toDate để xem lịch sử nợ lúc đó.
		const referenceDate = (toDate && new Date(toDate) < today) ? new Date(toDate) : today;
		const agingGroups = {
			under30: [] as any[],
			between30_60: [] as any[],
			between60_90: [] as any[],
			over90: [] as any[]
		};

		customers.forEach(cust => {
			const custOrders = orders.filter(o => o.customerId === cust.id && o.status === 'Đơn chốt');
			const custPayments = payments.filter(p => p.customerId === cust.id);

			const totalBought = custOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
			const totalPaid = custPayments.reduce((s, p) => s + (p.amount || 0), 0);
			let debt = totalBought - totalPaid;

			if (debt > 0) {
				const sortedOrders = [...custOrders].sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
				let runningTotal = 0;
				let oldestUnpaidOrder = null;

				for (const o of sortedOrders) {
					runningTotal += (o.totalAmount || 0);
					if (runningTotal > totalPaid) {
						oldestUnpaidOrder = o;
						break;
					}
				}

				if (oldestUnpaidOrder) {
					const orderDate = new Date(oldestUnpaidOrder.orderDate || oldestUnpaidOrder.createdAt?.toDate() || oldestUnpaidOrder.createdAt);
					const diffDays = Math.floor((referenceDate.getTime() - orderDate.getTime()) / (1000 * 3600 * 24));

					if (diffDays >= 0) {
						const entry = { ...cust, debt, days: diffDays };
						if (diffDays < 30) agingGroups.under30.push(entry);
						else if (diffDays < 60) agingGroups.between30_60.push(entry);
						else if (diffDays < 90) agingGroups.between60_90.push(entry);
						else agingGroups.over90.push(entry);
					}
				}
			}
		});

		return agingGroups;
	};

	useEffect(() => {
		const data = getAgingData();
		setAgingData(data);
	}, [customers, orders, payments, toDate, staffs, inventoryLogs]);
	useEffect(() => {
		setCurrentPage(1);
	}, [activeTab, fromDate, toDate]);

	// BOT TỰ ĐỘNG CHẠY NGẦM
	const handleAutoGenerateBankTransactions = async (isManual = true, newLoan: any = null) => {
		const currentLogs = cashLogsRef.current;
		let loans = currentLogs.filter(l =>
			l.type === 'thu' &&
			(l.category === 'Vay ngân hàng' || l.category === 'Vay khác')
		);

		if (newLoan) {
			const exists = loans.some(l => l.id === newLoan.id);
			if (!exists) loans.push(newLoan);
		}

		// Dọn dẹp bản ghi mồ côi (parentId không tồn tại trong loans)
		const orphans = currentLogs.filter(l => 
			l.parentId && 
			l.isAutoGenerated && 
			!loans.some(loan => loan.id === l.parentId)
		);

		const batch = writeBatch(db);
		let count = 0;
		let maxDate = new Date(toDate);

		if (loans.length > 0 && currentLogs.length > 1) {
			for (const orphan of orphans) {
				console.log(`Finance Bot: Cleaning orphan record: ${orphan.note} (ParentID: ${orphan.parentId})`);
				batch.delete(doc(db, 'cash_book', orphan.id));
				count++;
			}
		}

		if (loans.length === 0) return;
		const newAutoRecords: any[] = [];
		const now = new Date();

		for (const loan of loans) {
			const startDate = new Date(loan.date);
			const termMonthsStr = loan.loanTerm.match(/\d+/)?.[0];
			const termMonths = termMonthsStr ? parseInt(termMonthsStr) : 0;
			if (termMonths === 0) continue;

			const maturityEntry = currentLogs.find(l => 
				l.parentId === loan.id && 
				(l.category === 'Nợ gốc ngân hàng' || l.category === 'Đáo hạn ngân hàng')
			);
			
			const monthlyInterest = (loan.amount * (loan.interestRate / 100)) / 12;
			const dailyInterest = monthlyInterest / 30;
			const t0 = loan.createdAt?.toDate() || new Date(); 
			const maturityTime = maturityEntry ? (maturityEntry.createdAt?.toDate() || new Date(maturityEntry.date)) : null;

			for (let i = 1; i <= termMonths; i++) {
				const simulatedDueTime = new Date(startDate);
				simulatedDueTime.setMonth(simulatedDueTime.getMonth() + i);

				// Nếu đã tất toán, không tạo lãi tháng cho thời điểm sau ngày tất toán
				if (maturityTime && simulatedDueTime > maturityTime) break;

				if (now >= simulatedDueTime) {
					const displayDate = new Date(startDate);
					displayDate.setMonth(displayDate.getMonth() + i);
					const dateStr = displayDate.toISOString().split('T')[0];

					const isDuplicate = currentLogs.some(l =>
						l.parentId === loan.id && l.monthIndex === i
					);

					if (!isDuplicate) {
						const interestRef = doc(collection(db, 'cash_book'));
						const interestData = {
							ownerId: owner.ownerId,
							type: 'chi',
							category: 'Lãi suất ngân hàng',
							amount: Math.round(monthlyInterest),
							date: dateStr,
							note: `[Tự động] Lãi vay tháng ${i}/${termMonths} - ${loan.bankName}`,
							parentId: loan.id,
							email: loan.email || '',
							bankName: loan.bankName || '',
							interestRate: loan.interestRate || 0,
							loanTerm: loan.loanTerm || '',
							reminderEnabled: loan.reminderEnabled || false,
							createdAt: new Date(),
							createdBy: currentUserId,
							isAutoGenerated: true,
							monthIndex: i
						};
						batch.set(interestRef, { ...interestData, createdAt: serverTimestamp() });
						newAutoRecords.push(interestData);
						count++;
						const d = new Date(dateStr);
						if (d > maxDate) maxDate = d;
					}

					if (i === termMonths) {
						const isDuplicatePrincipal = currentLogs.filter(l => l.parentId === loan.id).some(l => l.monthIndex === 999);

						if (!isDuplicatePrincipal) {
							const principalRef = doc(collection(db, 'cash_book'));
							const principalData = {
								ownerId: owner.ownerId,
								type: 'chi',
								category: 'Nợ gốc ngân hàng',
								amount: loan.amount,
								date: dateStr,
								note: `[Tự động] Tất toán nợ gốc - ${loan.bankName}`,
								parentId: loan.id,
								email: loan.email || '',
								bankName: loan.bankName || '',
								interestRate: loan.interestRate || 0,
								loanTerm: loan.loanTerm || '',
								reminderEnabled: loan.reminderEnabled || false,
								createdAt: new Date(),
								createdBy: currentUserId,
								isAutoGenerated: true,
								monthIndex: 999
							};
							batch.set(principalRef, { ...principalData, createdAt: serverTimestamp() });
							newAutoRecords.push(principalData);
							count++;
							const d = new Date(dateStr);
							if (d > maxDate) maxDate = d;
						}
					}
				}
			}

			// XỬ LÝ LÃI CUỐI KỲ (CHO CÁC NGÀY LẺ TRƯỚC KHI TẤT TOÁN)
			if (maturityTime && maturityEntry?.category === 'Đáo hạn ngân hàng' && !maturityEntry.isAutoGenerated) {
				const hasFinalInterest = currentLogs.some(l => 
					l.parentId === loan.id && l.isAutoGenerated && l.monthIndex === -1
				);

				if (!hasFinalInterest) {
					// Tính chính xác số ngày lẻ từ khi bắt đầu vay đến khi tất toán
					const diffTime = Math.abs(maturityTime.getTime() - startDate.getTime());
					const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
					
					// Số tháng đầy đủ đã trôi qua
					const fullMonthsPassed = Math.floor(totalDays / 30);
					const oddDays = totalDays % 30;

					if (oddDays > 0) {
						const finalInterest = dailyInterest * oddDays;
						const interestRef = doc(collection(db, 'cash_book'));
						const interestData = {
							ownerId: owner.ownerId,
							type: 'chi',
							category: 'Lãi suất ngân hàng',
							amount: Math.round(finalInterest),
							date: maturityEntry.date,
							note: `[Tự động] Lãi cuối (Lẻ ${oddDays} ngày x ${formatPrice(Math.round(dailyInterest)).replace('₫', '')}) - ${loan.bankName}`,
							parentId: loan.id,
							email: loan.email || '',
							bankName: loan.bankName || '',
							interestRate: loan.interestRate || 0,
							loanTerm: loan.loanTerm || '',
							reminderEnabled: loan.reminderEnabled || false,
							createdAt: new Date(),
							createdBy: currentUserId,
							isAutoGenerated: true,
							monthIndex: -1
						};
						batch.set(interestRef, { ...interestData, createdAt: serverTimestamp() });
						newAutoRecords.push(interestData);
						count++;
					}
				}
			}
		}

		if (count > 0) {
			try {
				await batch.commit();
				console.log(`Finance Bot: Generated ${count} transactions.`);
				
				// Tự động gửi email thông báo cho các bản ghi mới
				for (const record of newAutoRecords) {
					handleBatchSendReminders(record);
				}

				const currentToDateObj = new Date(toDate);
				if (maxDate > currentToDateObj) {
					const newToDateStr = maxDate.toISOString().split('T')[0];
					setToDate(newToDateStr);
				}
				if (isManual) showToast(`Hệ thống đả cập nhật ${count} chứng từ ngân hàng`, "success");
			} catch (error) {
				console.error("Finance Bot: Commit Error", error);
			}
		} else if (isManual) {
			showToast("Dữ liệu đã được cập nhật đầy đủ.", "info");
		}
	};

	const handleAIInterestRate = async () => {
		if (!logData.bankName || !logData.loanTerm) {
			showToast("Vui lòng chọn ngân hàng và kỳ hạn", "info");
			return;
		}

		if (!import.meta.env.VITE_GROQ_API_KEY) {
			showToast("Chưa cấu hình VITE_GROQ_API_KEY", "error");
			return;
		}

		setIsFetchingRate(true);
		try {
			const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`
				},
				body: JSON.stringify({
					model: "llama-3.3-70b-versatile",
					messages: [
						{
							role: "system",
							content: "Bạn là chuyên gia về thị trường tài chính Việt Nam. Hãy tra cứu và trả về lãi suất VAY KINH DOANH (Business Loan) chính xác cho từng kỳ hạn cụ thể của ngân hàng. Lưu ý: Lãi suất thường thay đổi theo kỳ hạn (3 tháng khác 6 tháng, 12 tháng). Chỉ trả về con số phần trăm."
						},
						{
							role: "user",
							content: `Cập nhật lãi suất VAY KINH DOANH của ngân hàng ${logData.bankName} với kỳ hạn chính xác là ${logData.loanTerm}. Phải trả về con số lãi suất thực tế đang áp dụng cho kỳ hạn này. Chỉ trả về duy nhất con số (ví dụ: 8.2).`
						}
					]
				})
			});

			const data = await response.json();
			const rateText = data.choices?.[0]?.message?.content?.trim() || "";
			const match = rateText.match(/(\d+(\.\d+)?)/);
			const rate = match ? parseFloat(match[0]) : NaN;

			if (!isNaN(rate)) {
				setLogData(prev => ({ ...prev, interestRate: rate }));
				interestRateManual.current = false;
				showToast(`Groq AI: Lãi suất ${logData.bankName} là ${rate}%`, "success");
			}
		} catch (error: any) {
			console.error("Groq AI Error:", error);
			showToast("Không thể tra cứu lãi suất. Vui lòng nhập thủ công.", "error");
		} finally {
			setIsFetchingRate(false);
		}
	};

	// Auto-fetch interest rate when bank and term are selected (only if user hasn't manually entered a rate)
	useEffect(() => {
		if (logData.type === 'thu' && logData.category === 'Vay ngân hàng' && logData.bankName && logData.loanTerm && !isFetchingRate && logData.interestRate === 0 && !interestRateManual.current) {
			handleAIInterestRate();
		}
	}, [logData.bankName, logData.loanTerm]);

	// Auto-generate AI Loan Analysis note when all conditions are met
	useEffect(() => {
		const hasCondition = logData.type === 'thu' && 
						   (logData.category === 'Vay ngân hàng' || logData.category === 'Vay khác') &&
						   logData.amount > 0 && 
						   (logData.category === 'Vay khác' || logData.bankName) && 
						   logData.loanTerm && 
						   logData.interestRate > 0;

		if (hasCondition && !isFetchingRate && !logData.note) {
			handleAILoanAnalysis();
		}
	}, [logData.amount, logData.bankName, logData.loanTerm, logData.interestRate, logData.category]);

	useEffect(() => {
		if (owner.loading || !owner.ownerId) return;

		console.log("Finance View: Fetching data for ownerId:", owner.ownerId);

		const qLogs = query(collection(db, 'cash_book'), where('ownerId', '==', owner.ownerId));
		const unsubLogs = onSnapshot(qLogs, (snap) => {
			console.log("Finance: Received cash_book snapshot, count:", snap.size);
			const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
			const sortedLogs = logs.sort((a: any, b: any) => {
				const dateA = a.date || '';
				const dateB = b.date || '';
				return dateB.localeCompare(dateA);
			});
			setCashLogs(sortedLogs);
			cashLogsRef.current = sortedLogs;
		}, (err) => {
			console.error("Finance: Firestore CashBook Error:", err);
		});

		const qOrders = query(collection(db, 'orders'), where('ownerId', '==', owner.ownerId));
		const unsubOrders = onSnapshot(qOrders, (snap) => {
			console.log("Finance: Received orders snapshot, count:", snap.size);
			setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		}, (err) => {
			console.error("Finance: Firestore Orders Error:", err);
		});

		const qPayments = query(collection(db, 'payments'), where('ownerId', '==', owner.ownerId));
		const unsubPayments = onSnapshot(qPayments, (snap) => {
			console.log("Finance: Received payments snapshot, count:", snap.size);
			setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		}, (err) => {
			console.error("Finance: Firestore Payments Error:", err);
		});

		const qCustomers = query(collection(db, 'customers'), where('ownerId', '==', owner.ownerId));
		const unsubCustomers = onSnapshot(qCustomers, (snap) => {
			console.log("Finance: Received customers snapshot, count:", snap.size);
			setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
			setLoading(false);
		}, (err) => {
			console.error("Finance: Firestore Customers Error:", err);
			setLoading(false);
		});

		const qStaffs = query(collection(db, 'users'), where('ownerId', '==', owner.ownerId));
		const unsubStaffs = onSnapshot(qStaffs, (snap) => {
			console.log("Finance: Received staffs snapshot, count:", snap.size);
			setStaffs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		});

		const qCheckins = query(collection(db, 'checkins'), where('ownerId', '==', owner.ownerId));
		const unsubCheckins = onSnapshot(qCheckins, (snap) => {
			setCheckins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		});

		const qAttendance = query(collection(db, 'attendance_logs'), where('ownerId', '==', owner.ownerId));
		const unsubAttendance = onSnapshot(qAttendance, (snap) => {
			setAttendanceLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		});

		const qProducts = query(collection(db, 'products'), where('ownerId', '==', owner.ownerId));
		const unsubProducts = onSnapshot(qProducts, (snap) => {
			setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		});

		const qInvLogs = query(collection(db, 'inventory_logs'), where('ownerId', '==', owner.ownerId));
		const unsubInvLogs = onSnapshot(qInvLogs, (snap) => {
			setInventoryLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		});

		return () => {
			unsubLogs();
			unsubOrders();
			unsubPayments();
			unsubCustomers();
			unsubStaffs();
			unsubCheckins();
			unsubAttendance();
			unsubProducts();
			unsubInvLogs();
		};
	}, [owner.loading, owner.ownerId]);

	// BOT TỰ ĐỘNG CHẠY NGẦM
	const isBotRunning = useRef(false);
	useEffect(() => {
		const interval = setInterval(() => {
			if (isBotRunning.current || loading) return;
			isBotRunning.current = true;
			handleAutoGenerateBankTransactions(false).finally(() => {
				isBotRunning.current = false;
			});
		}, 30000); 

		return () => clearInterval(interval);
	}, [owner.ownerId, loading]); 

	const handleAILoanAnalysis = async () => {
		if (!logData.amount || !logData.bankName || !logData.loanTerm || !logData.interestRate) {
			showToast("Vui lòng điền đủ Số tiền, Ngân hàng, Kỳ hạn và Lãi suất để AI phân tích", "info");
			return;
		}

		setIsFetchingRate(true);
		try {
			const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${import.meta.env.VITE_GROQ_API_KEY || ""}`
				},
				body: JSON.stringify({
					model: "llama-3.3-70b-versatile",
					messages: [
						{
							role: "system",
							content: "Bạn là chuyên gia tài chính. Hãy trả về bản tóm tắt CỰC KỲ NGẮN GỌN, vắn tắt, thuần văn bản. KHÔNG định dạng markdown, KHÔNG lời chào, KHÔNG giải thích."
						},
						{
							role: "user",
							content: `Tóm tắt khoản vay (Vắn tắt):
              - Ngân hàng: ${logData.bankName}
              - Gốc: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(logData.amount)}
              - Ngày: ${logData.date}
              - Lãi: ${logData.interestRate}%/năm
              - Kỳ hạn: ${logData.loanTerm}

              Mẫu:
              🏦 Vay [Ngân hàng] gói kinh doanh ngày [Ngày], lãi [Lãi suất]%/năm.
              🕒 Lãi tháng: [Số tiền lãi] | Lãi ngày: [Lãi tháng / 30]
              💰 Đáo hạn ([Kỳ hạn]): [Gốc] + [Lãi cuối] = [Số tiền đáo hạn]
              📈 Tổng nợ (Gốc + Lãi): [Tổng cộng]`
						}
					]
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			if (!data.choices || data.choices.length === 0) {
				throw new Error("Không nhận được phản hồi từ AI");
			}

			const analysis = data.choices[0].message.content.trim();
			setLogData(prev => ({ ...prev, note: analysis }));
			showToast("AI đã hoàn tất phân tích khoản vay", "success");
		} catch (error: any) {
			console.error("Project AI Analysis Error:", error);
			showToast(`Không thể tạo phân tích AI: ${error.message || 'Lỗi kết nối'}`, "error");
		} finally {
			setIsFetchingRate(false);
		}
	};

	const handleToggleReminder = async (id: string, currentStatus: boolean) => {
		try {
			await updateDoc(doc(db, 'cash_book', id), {
				reminderEnabled: !currentStatus,
				updatedAt: serverTimestamp()
			});
			showToast(`Đã ${!currentStatus ? 'bật' : 'tắt'} nhắc hẹn tất toán (Ngày 25 hàng tháng)`, "success");
		} catch (error) {
			console.error("Finance: Toggle Reminder Error:", error);
			showToast("Lỗi khi cập nhật nhắc hẹn", "error");
		}
	};


	const handleBatchSendReminders = async (specificLog: any = null) => {
		const reminders = specificLog ? [specificLog] : cashLogs.filter(log => log.reminderEnabled === true && log.email);
		
		if (reminders.length === 0) {
			if (!specificLog) showToast("Không có khoản vay nào đang bật chế độ nhắc hẹn.", "info");
			return;
		}

		if (!specificLog && !window.confirm(`Bạn có muốn gửi email nhắc nợ cho ${reminders.length} khoản vay này đến email hệ thống và email khách hàng (nếu có) không?`)) return;

		if (!specificLog) setIsSendingReminders(true);
		let successCount = 0;

		try {
			for (const loan of reminders) {
				try {
					await fetch('https://script.google.com/macros/s/AKfycbwIup8ysoKT4E_g8GOVrBiQxXw7SOtqhLWD2b0GOUT54MuoXgTtxP42XSpFR_3aoXAG7g/exec', {
						method: 'POST',
						mode: 'no-cors',
						headers: { 'Content-Type': 'text/plain;charset=utf-8' },
						body: JSON.stringify({
							action: 'loan_reminder',
							bankName: loan.bankName,
							amount: loan.amount,
							interestRate: loan.interestRate,
							loanTerm: loan.loanTerm,
							date: loan.date,
							clientEmail: loan.email,
							note: loan.note,
							category: loan.category,
							isAutoGenerated: loan.isAutoGenerated || false
						})
					});
					successCount++;
				} catch (err) {
					console.error("Failed to send reminder for:", loan.bankName, err);
				}
			}
			showToast(`Đã gửi ${successCount} thông báo nhắc nợ về email hệ thống thành công!`, "success");
		} catch (error) {
			showToast("Lỗi khi kết nối máy chủ gửi mail", "error");
		} finally {
			setIsSendingReminders(false);
		}
	};


	const handleAIAgingAnalysis = async () => {
		const totalDebt = Object.values(agingData).reduce((sum: number, list: any) => sum + list.reduce((s: number, c: any) => s + (Number(c.debt) || 0), 0), 0);
		if (totalDebt === 0) {
			showToast("Không có nợ quá hạn để phân tích", "info");
			return;
		}

		setIsFetchingRate(true);
		try {
			const prompt = `Phân tích tình hình công nợ hiện tại:
      - Tổng dư nợ: ${formatPrice(totalDebt)}
      - Nhóm < 30 ngày: ${agingData.under30.length} khách, Nợ: ${formatPrice(agingData.under30.reduce((s: any, c: any) => s + c.debt, 0))}
      - Nhóm 30-60 ngày: ${agingData.between30_60.length} khách, Nợ: ${formatPrice(agingData.between30_60.reduce((s: any, c: any) => s + c.debt, 0))}
      - Nhóm 60-90 ngày: ${agingData.between60_90.length} khách, Nợ: ${formatPrice(agingData.between60_90.reduce((s: any, c: any) => s + c.debt, 0))}
      - Nhóm > 90 ngày: ${agingData.over90.length} khách, Nợ: ${formatPrice(agingData.over90.reduce((s: any, c: any) => s + c.debt, 0))}

      Yêu cầu: Đưa ra nhận xét ngắn gọn (3-4 dòng) về mức độ rủi ro dòng tiền và gợi ý hành động thu hồi nợ hiệu quả nhất cho từng nhóm.`;

			const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${import.meta.env.VITE_GROQ_API_KEY || ""}`
				},
				body: JSON.stringify({
					model: "llama-3.3-70b-versatile",
					messages: [
						{
							role: "system",
							content: "Bạn là chuyên gia quản trị tài chính doanh nghiệp. Hãy cung cấp phân tích rủi ro công nợ sắc bén, ngắn gọn, đi thẳng vào vấn đề."
						},
						{
							role: "user",
							content: prompt
						}
					]
				})
			});

			const data = await response.json();
			const insight = data.choices?.[0]?.message?.content || "Không thể lấy thông tin từ AI";
			setAgingAiInsight(insight);
			showToast("AI đã hoàn tất phân tích công nợ", "success");
		} catch (error) {
			console.error("AI Aging Error:", error);
			showToast("Lỗi khi gọi AI phân tích", "error");
		} finally {
			setIsFetchingRate(false);
		}
	};

	const handleAICheckProfit = async (order: any) => {
		setAiProfitInsight({ id: order.id, insight: '', loading: true });
		try {
			const itemDetails = (order.items || []).map((item: any) => {
				const matches = products.filter(p => p.id === (item.productId || item.id) || (p.sku && item.sku && p.sku === item.sku) || (p.name && item.name && p.name.trim().toLowerCase() === item.name.trim().toLowerCase()));
				const currentProd = item.category ? (matches.find(p => p.category === item.category) || matches[0]) : matches[0];
				const activeBuyPrice = currentProd ? (Number(currentProd.priceBuy) || 0) : (Number(item.buyPrice) || 0);
				return `- Danh mục: ${item.category || 'N/A'} | SP: ${item.name} | SL: ${item.qty} | Giá bán: ${formatPrice(item.price)}/sp | Giá gốc tra cứu kết hợp AI: ${formatPrice(activeBuyPrice)}/sp`;
			}).join('\n');

			const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${import.meta.env.VITE_GROQ_API_KEY || ""}`
				},
				body: JSON.stringify({
					model: "llama-3.3-70b-versatile",
					messages: [
						{
							role: "system",
							content: "Bạn là trưởng phòng kế toán siêu việt. Hãy xem dữ liệu đơn hàng và đưa ra phân tích chi tiết về lợi nhuận.\nNhiệm vụ:\n1. Chỉ ra nguyên nhân nếu lợi nhuận sai lệch do lỗi đánh thiếu giá vốn = 0.\n2. Nếu có item Thiếu giá vốn (hoặc =0), hãy ước tính giá nhập vốn hợp lý dưạ theo tên SP, hoặc dùng 80%-85% giá bán làm giá vốn giả định.\n3. Tính toán lại cụ thể Tổng giá vốn thật và Tổng Lợi Nhuận thật.\nTRình bày sạch sẽ, CHÍNH XÁC TOÁN HỌC, dễ nhìn (khoảng 5-6 dòng)."
						},
						{
							role: "user",
							content: `Đơn hàng: ${order.invoiceId || order.id.slice(-6).toUpperCase()}
Hệ thống hiện tại đang tính: 
- Doanh thu: ${formatPrice(order.revenue)} 
- Giá vốn: ${formatPrice(order.cost)} 
- Lợi nhuận: ${formatPrice(order.profit)}
- Tổng chiết khấu cho khách: ${formatPrice(order.discountValue || 0)}

Chi tiết vật tư:
${itemDetails}

Yêu cầu tính toán chi tiết và kết luận:`
						}
					]
				})
			});

			const data = await response.json();
			const insight = data.choices?.[0]?.message?.content || "Không phản hồi được =(";
			setAiProfitInsight({ id: order.id, insight, loading: false });
		} catch (error) {
			console.error("AI Profit Error:", error);
			setAiProfitInsight({ id: order.id, insight: "Lỗi kết nối AI.", loading: false });
		}
	};

	const handleSaveLog = async (e: React.FormEvent) => {
		e.preventDefault();
		if (logData.amount <= 0) return;

		try {
			if (editingId) {
				await updateDoc(doc(db, 'cash_book', editingId), {
					...logData,
					updatedAt: serverTimestamp()
				});
				console.log("Cash log updated successfully, ID:", editingId);
				setShowLogForm(false);
				
				// Kích hoạt bot ngay lập tức với ID được chỉnh sửa
				if (logData.type === 'thu' && (logData.category === 'Vay ngân hàng' || logData.category === 'Vay khác')) {
					handleAutoGenerateBankTransactions(false);
				}
				showToast("Cập nhật ghi chú thành công", "success");
			} else {
				const docRef = await addDoc(collection(db, 'cash_book'), {
					...logData,
					ownerId: owner.ownerId,
					createdBy: auth.currentUser?.uid,
					createdByEmail: auth.currentUser?.email || '',
					createdAt: serverTimestamp()
				});
				console.log("Cash log added successfully, ID:", docRef.id);
				setShowLogForm(false);
				
				// Kích hoạt bot ngay lập tức với ID thật vừa tạo
				if (logData.type === 'thu' && (logData.category === 'Vay ngân hàng' || logData.category === 'Vay khác')) {
					handleAutoGenerateBankTransactions(false, { ...logData, id: docRef.id });
				}
				showToast("Ghi sổ quỹ thành công", "success");
			}

			setEditingId(null);
			setLogData({
				type: 'chi',
				amount: 0,
				category: 'Vận hành',
				note: '',
				date: new Date().toISOString().split('T')[0],
				interestRate: 0,
				bankName: '',
				loanTerm: '',
				reminderEnabled: false,
				email: '',
				parentId: ''
			});
		} catch (error) {
			console.error("Error saving cash log:", error);
			showToast("Lỗi khi lưu sổ quỹ", "error");
		}
	};

	const handleEditLog = (log: any) => {
		setEditingId(log.id);
		setLogData({
			type: log.type || 'chi',
			amount: log.amount || 0,
			category: log.category || 'Vận hành',
			note: log.note || '',
			date: log.date || new Date().toISOString().split('T')[0],
			interestRate: log.interestRate || 0,
			bankName: log.bankName || '',
			loanTerm: log.loanTerm || '',
			reminderEnabled: log.reminderEnabled || false,
			email: log.email || '',
			parentId: log.parentId || ''
		});
		setShowLogForm(true);
	};

	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
	};

	const getPageNumbers = (totalPages: number) => {
		const pages: (number | string)[] = [];
		const radius = 1;

		for (let i = 1; i <= totalPages; i++) {
			if (
				i === 1 ||
				i === totalPages ||
				(i >= currentPage - radius && i <= currentPage + radius) ||
				i <= 3 ||
				i >= totalPages - 2
			) {
				pages.push(i);
			}
		}

		const uniquePages = [...new Set(pages)].sort((a, b) => (a as number) - (b as number));
		const withEllipsis: (number | string)[] = [];

		for (let i = 0; i < uniquePages.length; i++) {
			if (i > 0 && (uniquePages[i] as number) - (uniquePages[i - 1] as number) > 1) {
				withEllipsis.push('...');
			}
			withEllipsis.push(uniquePages[i]);
		}
		return withEllipsis;
	};

	// No longer returning restricted access here, will handle tab-level permissions
	// --- CALCULATIONS ---

	const handleDeleteLog = async (id: string, log: any) => {
		setDeleteConfirm({ id, log });
	};

	const confirmDelete = async () => {
		if (!deleteConfirm) return;
		const { id, log } = deleteConfirm;
		setDeleteConfirm(null);

		try {
			await deleteDoc(doc(db, 'cash_book', id));
			
			// Lưu nhật ký hành động (Audit Log)
			try {
				await addDoc(collection(db, 'audit_logs'), {
					action: 'Xóa ghi chép thu chi',
					user: auth.currentUser?.displayName || auth.currentUser?.email || 'Người dùng',
					userId: auth.currentUser?.uid,
					ownerId: owner.ownerId,
					details: `Đã xóa: ${log.type === 'thu' ? '+' : '-'}${formatPrice(log.amount)} - Nội dung: ${log.note || 'Trống'}`,
					createdAt: serverTimestamp()
				});
			} catch (auditErr) {
				console.warn("Audit Log Error:", auditErr);
			}

			showToast("Đã xóa bản ghi thành công", "success");
		} catch (error: any) {
			console.error("Finance Delete Error:", error);
			showToast(`Lỗi: ${error.message}`, "error");
		}
	};

	const filterByDate = (date: any) => {
		if (!date) return false;
		const d = date.seconds ? new Date(date.seconds * 1000).toISOString().split('T')[0] : date;
		return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
	};

	const filteredLogs = cashLogs.filter(l => filterByDate(l.date));
	const filteredOrders = orders.filter(o => filterByDate(o.orderDate || o.createdAt));
	const filteredPayments = payments.filter(p => filterByDate(p.date || p.createdAt));

	const paginatedLogs = filteredLogs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
	const totalLogsPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);


	// 3. Profit breakdown
	const orderProfits = filteredOrders.filter(o => o.status === 'Đơn chốt').map(o => {
		const revenue = o.totalAmount || 0;
		const cost = o.totalCost || 0;
		const profit = o.totalProfit || (revenue - cost);
		return { ...o, revenue, cost, profit };
	}).sort((a: any, b: any) => {
		const dateA = new Date(a.orderDate || a.createdAt?.toDate() || a.createdAt).getTime();
		const dateB = new Date(b.orderDate || b.createdAt?.toDate() || b.createdAt).getTime();
		return dateB - dateA;
	});

	// 3. Profitability Totals (Calculated after orderProfits is defined)
	const totalGrossProfit = orderProfits.reduce((sum, o) => sum + (o.profit || 0), 0);
	const totalOperationalExpense = filteredLogs
		.filter(l => l.type === 'chi' && l.category !== 'Nợ gốc ngân hàng' && l.category !== 'Đáo hạn ngân hàng')
		.reduce((sum, l) => sum + (l.amount || 0), 0);
	const netBusinessProfit = totalGrossProfit - totalOperationalExpense;

	const paginatedProfits = orderProfits.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
	const totalProfitsPages = Math.ceil(orderProfits.length / ITEMS_PER_PAGE);



	if (owner && owner.loading) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#f8f9fb] dark:bg-slate-950 transition-colors duration-300">
			{/* HEADER */}
			<header className="md:h-20 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 sticky top-0 z-30">
				<div className="h-16 md:h-20 flex items-center justify-between px-4 md:px-8 border-b border-slate-50 dark:border-slate-800/50">
					<div className="flex items-center gap-3">
						<div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/20">
							<Wallet size={20} />
						</div>
						<h2 className="text-lg md:text-xl font-black text-[#1A237E] dark:text-indigo-400 uppercase tracking-tight">Quản Lý Tài Chính</h2>
					</div>

					<div className="flex bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-100/50 dark:border-slate-800/50 overflow-x-auto no-scrollbar touch-pan-x shrink-0 max-w-[calc(100vw-180px)] md:max-w-none">
						{isAdmin && (
							<>
								<button
									onClick={() => setActiveTab('cashbook')}
									className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'cashbook' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
									Sổ Quỹ
								</button>
								<button
									onClick={() => setActiveTab('aging')}
									className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'aging' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
									Tuổi Nợ
								</button>
								<button
									onClick={() => setActiveTab('profit')}
									className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'profit' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
									Lợi Nhuận
								</button>
							</>
						)}
					</div>
				</div>

				{/* Filter Bar */}
				<div className="px-4 md:px-8 py-3 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-md flex flex-wrap items-center gap-4">
					<div className="flex items-center gap-3 bg-white dark:bg-slate-800 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
						<Calendar size={16} className="text-indigo-500" />
						<div className="flex items-center gap-2">
							<input
								type="date"
								className="bg-transparent border-none p-0 text-xs font-black uppercase text-slate-700 dark:text-slate-200 focus:ring-0"
								value={fromDate}
								onChange={(e) => setFromDate(e.target.value)}
							/>
							<span className="text-slate-300 font-bold">→</span>
							<input
								type="date"
								className="bg-transparent border-none p-0 text-xs font-black uppercase text-slate-700 dark:text-slate-200 focus:ring-0"
								value={toDate}
								onChange={(e) => setToDate(e.target.value)}
							/>
						</div>
					</div>
					<div className="text-[10px] font-black text-slate-400 uppercase tracking-[2px] hidden lg:block opacity-60">
						Lọc dữ liệu theo thời gian
					</div>
				</div>
			</header>

			<main className="p-4 md:p-8 max-w-[1400px] mx-auto">

				{activeTab === 'cashbook' && (
					<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
						{/* Overview Cards */}
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							<div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
								<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Lợi nhuận gộp bán hàng</p>
								<div className="flex items-center justify-between">
									<h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">{formatPrice(totalGrossProfit)}</h3>
									<div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-lg text-emerald-600"><TrendingUp size={20} /></div>
								</div>
								<p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-tight italic opacity-70">Tổng lãi từ các đơn hàng đã chốt</p>
							</div>
							<div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
								<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Chi phí (Vận hành & Lãi)</p>
								<div className="flex items-center justify-between">
									<h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tighter">{formatPrice(totalOperationalExpense)}</h3>
									<div className="bg-rose-50 dark:bg-rose-900/20 p-2 rounded-lg text-rose-600"><ArrowDownLeft size={20} /></div>
								</div>
								<p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-tight italic opacity-70">Tổng phí vận hành & lãi suất tiền vay</p>
							</div>
							<div className="bg-indigo-600 dark:bg-indigo-900 p-6 rounded-[2rem] shadow-xl shadow-indigo-500/20 text-white relative overflow-hidden">
								<div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
								<p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-2">Lợi nhuận ròng thực tế</p>
								<div className="flex items-center justify-between">
									<h3 className="text-2xl font-black tracking-tighter">{formatPrice(netBusinessProfit)}</h3>
									<Sparkles size={24} className="text-white/40" />
								</div>
								<p className="text-[9px] font-bold text-white/50 mt-2 uppercase tracking-tight italic">Lợi nhuận cuối cùng sau khi trừ mọi chi phí</p>
							</div>
						</div>

						{/* Log List */}
						<div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden text-sm">
							<div className="p-6 border-b border-slate-50 dark:border-slate-800 flex flex-wrap gap-4 justify-between items-center">
								<h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Nhật ký thu chi nội bộ</h3>
								<div className="flex items-center gap-3">
									<button
										onClick={handleBatchSendReminders}
										disabled={isSendingReminders}
										className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 text-xs uppercase tracking-tight disabled:opacity-50"
										title="Gửi nhắc nợ hàng tháng cho các khoản vay đang bật chuông"
									>
										{isSendingReminders ? <RefreshCcw size={18} className="animate-spin" /> : <Bell size={18} />}
										Nhắc nợ
									</button>
									<button
										onClick={() => setShowLogForm(true)}
										className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 text-xs uppercase tracking-tight"
									>
										<Plus size={18} /> Ghi chú Thu/Chi
									</button>
								</div>
							</div>
							<div className="md:hidden p-4 space-y-4">
								{paginatedLogs.length === 0 ? (
									<div className="text-center py-10 text-slate-400 italic">
										Chưa có ghi chép thu chi nào cho kỳ này.
									</div>
								) : (
									paginatedLogs.map(log => (
										<div key={log.id} className="bg-white dark:bg-slate-900 p-4 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-3 relative overflow-hidden">
											<div className="flex justify-between items-start">
												<div className="space-y-1">
													<span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${log.type === 'thu' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
														{log.category}
													</span>
													<p className="text-[10px] text-slate-400 font-bold">{log.date}</p>
												</div>
												<div className="text-right">
													<p className={`text-lg font-black tracking-tighter ${log.type === 'thu' ? 'text-emerald-600' : 'text-rose-600'}`}>
														{log.type === 'thu' ? '+' : '-'}{formatPrice(log.amount)}
													</p>
												</div>
											</div>
											
											<div className="space-y-2 cursor-pointer active:opacity-70" onClick={() => setSelectedNote(log.note)}>
												<p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-snug line-clamp-3">
													{log.note}
												</p>
												{log.email && (
													<p className="text-[10px] text-indigo-500 italic font-medium flex items-center gap-1">
														<span className="material-symbols-outlined text-[12px]">mail</span> {log.email}
													</p>
												)}
												{log.bankName && (
													<div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-700/50">
														<p className="text-[9px] text-slate-500 font-black uppercase flex items-center gap-1">
															<Sparkles size={10} className="text-indigo-400" /> {log.bankName}
														</p>
														<p className="text-[8px] text-slate-400 font-medium">Lãi: {log.interestRate}% - {log.loanTerm}</p>
													</div>
												)}
											</div>

											<div className="pt-3 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
												<div className="flex items-center gap-2">
													{log.parentId ? (
														<span className="text-[10px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg">
															ID: #{log.parentId.slice(-6).toUpperCase()}
														</span>
													) : (log.category === 'Vay ngân hàng' || log.category === 'Vay khác') ? (
														<span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">
															ID: #{log.id.slice(-6).toUpperCase()}
														</span>
													) : (
														<span className="text-[8px] text-slate-300 font-bold uppercase opacity-30">Chi phí lẻ</span>
													)}
												</div>
												<div className="flex items-center gap-1">
													<button
														type="button"
														onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleEditLog(log); }}
														className="flex items-center gap-1 ps-3 pe-2 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase active:scale-95 transition-transform"
													>
														Sửa
													</button>
													<button
														type="button"
														onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteLog(log.id, log); }}
														className="flex items-center gap-1 ps-3 pe-2 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase active:scale-95 transition-transform"
													>
														Xoá <Trash2 size={12} />
													</button>
												</div>
											</div>
										</div>
									))
								)}
							</div>

							<div className="hidden md:block overflow-x-auto">
								<table className="w-full text-left">
									<thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
										<tr>
											<th className="px-6 py-4 hidden md:table-cell">Ngày</th>
											<th className="px-6 py-4">Phân loại</th>
											<th className="px-6 py-4">Nội dung</th>
											<th className="px-6 py-4 hidden sm:table-cell">Email</th>
											<th className="px-6 py-4 text-right">Số tiền</th>
											<th className="px-6 py-4 text-center hidden md:table-cell">Mã Khoản Vay</th>
											<th className="px-6 py-4 text-right">Thao tác</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-50 dark:divide-slate-800">
										{paginatedLogs.length === 0 ? (
											<tr>
												<td colSpan={7} className="px-6 py-10 text-center text-slate-400 italic">
													Chưa có ghi chép thu chi nào cho kỳ này.
												</td>
											</tr>
										) : (
											paginatedLogs.map(log => (
												<tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
													<td className="px-6 py-4 text-xs font-bold text-slate-500 whitespace-nowrap hidden md:table-cell">
														{log.date}
													</td>
													<td className="px-6 py-4 text-center">
														<span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase inline-block ${log.category === 'Vay ngân hàng' || log.type === 'thu'
															? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20'
															: log.category === 'Vận hành'
																? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20'
																: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20'
															}`}>
															{log.category}
														</span>
													</td>
													<td className="px-6 py-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors" onClick={() => setSelectedNote(log.note)}>
														<div className="flex flex-col">
															<span className="font-medium text-slate-700 dark:text-slate-300 text-xs sm:text-sm line-clamp-1">{log.note}</span>
															{log.bankName && (
																<span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight flex items-center gap-1 mt-0.5">
																	<Sparkles size={10} className="text-indigo-400" /> {log.bankName}
																</span>
															)}
														</div>
													</td>
													<td className="px-6 py-4 text-xs text-slate-500 font-medium hidden sm:table-cell">
														{log.email || '--'}
													</td>
													<td className={`px-6 py-4 text-right font-black text-sm ${log.type === 'thu' ? 'text-emerald-600' : 'text-rose-600'}`}>
														{log.type === 'thu' ? '+' : '-'}{formatPrice(log.amount)}
													</td>
													<td className="px-6 py-4 text-center hidden md:table-cell">
														{log.parentId ? (
															<span className="text-[10px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg">
																#{log.parentId.slice(-6).toUpperCase()}
															</span>
														) : (log.category === 'Vay ngân hàng' || log.category === 'Vay khác') ? (
															<span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">
																#{log.id.slice(-6).toUpperCase()}
															</span>
														) : (
															<span className="text-[8px] text-slate-300 font-bold uppercase opacity-30">--</span>
														)}
													</td>
													<td className="px-6 py-4 text-right">
														<div className="flex items-center justify-end gap-1">
															<button
																type="button"
																onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleEditLog(log); }}
																className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-[10px] font-black uppercase active:scale-95 transition-transform"
																title="Chỉnh sửa ghi chép"
															>
																Sửa
															</button>
															<button
																type="button"
																onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteLog(log.id, log); }}
																className="size-9 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all active:scale-95 cursor-pointer relative z-10"
																title="Xóa ghi chép"
															>
																<Trash2 size={16} />
															</button>
														</div>
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</div>

						{/* Pagination UI - Cash Logs */}
						{totalLogsPages > 1 && (
							<div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
								<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">
									Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredLogs.length)} của {filteredLogs.length} ghi chép
								</p>
								<div className="flex items-center gap-2">
									<button
										disabled={currentPage === 1}
										onClick={() => { setCurrentPage(prev => prev - 1); window.scrollTo(0, 0); }}
										className="size-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 disabled:opacity-30 transition-all hover:bg-slate-100 dark:hover:bg-slate-700"
									>
										<ChevronRight className="rotate-180" size={18} />
									</button>
									<div className="flex items-center gap-1">
										{getPageNumbers(totalLogsPages).map((page, idx) => (
											<button
												key={idx}
												onClick={() => typeof page === 'number' && setCurrentPage(page)}
												disabled={page === '...'}
												className={`size-10 rounded-xl font-black text-xs transition-all ${page === currentPage
													? 'bg-[#1A237E] text-white shadow-lg shadow-blue-500/20'
													: page === '...'
														? 'text-slate-400 cursor-default'
														: 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
													}`}
											>
												{page}
											</button>
										))}
									</div>
									<button
										disabled={currentPage === totalLogsPages}
										onClick={() => { setCurrentPage(prev => prev + 1); window.scrollTo(0, 0); }}
										className="size-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 disabled:opacity-30 transition-all hover:bg-slate-100 dark:hover:bg-slate-700"
									>
										<ChevronRight size={18} />
									</button>
								</div>
							</div>
						)}
					</div>
				)}

				{activeTab === 'aging' && (
					<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
						<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
							<div>
								<h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Tổng hợp tuổi nợ khách hàng</h3>
								<p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Phân tích dòng tiền và rủi ro công nợ thực tế</p>
							</div>
							<button 
								onClick={handleAIAgingAnalysis}
								disabled={isFetchingRate}
								className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200 dark:shadow-none hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50"
							>
								{isFetchingRate ? <RefreshCcw size={14} className="animate-spin" /> : <Bot size={14} />}
								AI Phân tích nợ & Thu hồi
							</button>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
							{[
								{ label: '< 30 Ngày', data: agingData.under30, color: 'emerald', desc: 'Nợ mới trong vòng 1 tháng' },
								{ label: '30 - 60 Ngày', data: agingData.between30_60, color: 'blue', desc: 'Cần bắt đầu theo dõi thanh toán' },
								{ label: '60 - 90 Ngày', data: agingData.between60_90, color: 'orange', desc: 'Nợ khó đòi, cần nhắc nhở mạnh' },
								{ label: '> 90 Ngày', data: agingData.over90, color: 'rose', desc: 'Rủi ro mất vốn cao, cần xử lý ngay' }
							].map((group, i) => (
								<div key={i} className={`bg-white dark:bg-slate-900 p-6 rounded-[2rem] border-l-4 border-${group.color}-500 shadow-sm relative overflow-hidden group`}>
									<div className={`absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity`}>
										<Clock size={48} className={`text-${group.color}-500`} />
									</div>
									<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{group.label}</p>
									<h4 className="text-2xl font-black text-slate-800 dark:text-white">{group.data.length} <span className="text-xs text-slate-400">Khách hàng</span></h4>
									<p className={`text-[10px] font-bold text-slate-400 italic mb-2 capitalize line-clamp-1`}>{group.desc}</p>
									<p className={`text-xs font-bold text-${group.color}-600 mt-2 bg-${group.color}-50 dark:bg-${group.color}-900/20 px-3 py-1.5 rounded-xl inline-block`}>
										Dư nợ: {formatPrice(group.data.reduce((s: number, c: any) => s + (Number(c.debt) || 0), 0))}
									</p>
								</div>
							))}
						</div>

						{agingAiInsight && (
							<div className="bg-indigo-50 dark:bg-indigo-900/10 p-6 rounded-[2rem] border border-indigo-100 dark:border-indigo-800/50 animate-in fade-in zoom-in duration-500">
								<div className="flex items-center gap-3 mb-3">
									<div className="size-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg">
										<Bot size={16} />
									</div>
									<h4 className="text-xs font-black text-indigo-800 dark:text-indigo-300 uppercase tracking-widest">AI Advisor: Chiến lược thu hồi nợ</h4>
								</div>
								<div className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
									{agingAiInsight}
								</div>
							</div>
						)}

						<div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
							<div className="p-6 border-b border-slate-50 dark:border-slate-800">
								<h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Chi tiết nợ quá hạn</h3>
							</div>
							<div className="divide-y divide-slate-50 dark:divide-slate-800">
								{(Object.entries(agingData).flatMap(([, list]) => list as any[])).sort((a: any, b: any) => b.days - a.days).map((item, i) => (
									<div key={i} className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
										<div className="flex items-center gap-4">
											<div className={`size-12 rounded-2xl flex items-center justify-center font-black text-white shadow-lg ${item.days > 90 ? 'bg-rose-500' : item.days > 60 ? 'bg-orange-500' : 'bg-indigo-500'}`}>
												{item.name?.[0] || 'K'}
											</div>
											<div>
												<h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">{item.name}</h4>
												<p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1 mt-1">
													<Clock size={10} /> Quá hạn {item.days} ngày
												</p>
											</div>
										</div>
										<div className="text-right">
											<p className="text-sm font-black text-rose-600 tracking-tight">{formatPrice(item.debt)}</p>
											<button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1 hover:underline">Nhắc nợ ngay</button>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				)}

				{activeTab === 'profit' && (
					<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
						<div className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-xl shadow-indigo-500/20 text-white relative overflow-hidden">
							<div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
								<div>
									<p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-2">Tổng doanh thu chốt</p>
									<p className="text-3xl font-black tracking-tighter">{formatPrice(orderProfits.reduce((s: number, o: any) => s + (o.revenue || 0), 0))}</p>
								</div>
								<div>
									<p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-2">Tổng giá vốn nhập</p>
									<p className="text-3xl font-black tracking-tighter text-white/40">{formatPrice(orderProfits.reduce((s: number, o: any) => s + (o.cost || 0), 0))}</p>
								</div>
								<div>
									<p className="text-orange-400 text-[10px] font-black uppercase tracking-widest mb-2">Lợi nhuận gộp</p>
									<div className="flex items-center gap-3">
										<p className="text-3xl font-black text-white tracking-tighter">{formatPrice(orderProfits.reduce((s: number, o: any) => s + o.profit, 0))}</p>
										<div className="bg-white/10 px-2 py-1 rounded text-[10px] font-black">
											{((orderProfits.reduce((s: number, o: any) => s + o.profit, 0) / (orderProfits.reduce((s: number, o: any) => s + o.revenue, 0) || 1)) * 100).toFixed(1)}%
										</div>
									</div>
								</div>
							</div>
						</div>

						<div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
							<div className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
								<h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Chi tiết lợi nhuận từng đơn</h3>
								<div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl text-xs font-black text-slate-500">
									<BarChart3 size={16} /> Xếp hạng lợi nhuận
								</div>
							</div>
							{/* Lớp hiển thị Desktop - Table */}
							<div className="hidden md:block overflow-x-auto">
								<table className="w-full text-left text-sm">
									<thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
										<tr>
											<th className="px-6 py-4">Đơn hàng</th>
											<th className="px-6 py-4">Khách hàng</th>
											<th className="px-6 py-4 text-right">Doanh thu</th>
											<th className="px-6 py-4 text-right">Giá vốn</th>
											<th className="px-6 py-4 text-right">Lợi nhuận</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-50 dark:divide-slate-800">
										{paginatedProfits.map((order, i) => (
											<React.Fragment key={i}>
											<tr className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
												<td className="px-6 py-4 font-black text-slate-900 dark:text-indigo-400">{order.invoiceId || order.id.slice(-6).toUpperCase()}</td>
												<td className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400">{order.customerName}</td>
												<td className="px-6 py-4 text-right font-bold text-slate-700 dark:text-slate-300">{formatPrice(order.revenue)}</td>
												<td className="px-6 py-4 text-right text-slate-400 italic">{formatPrice(order.cost)}</td>
												<td className="px-6 py-4 text-right">
													<div className="flex items-center justify-end gap-2">
														<span className={`px-2 py-1 rounded-lg font-black ${order.profit > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}>
															{formatPrice(order.profit)}
														</span>
													</div>
												</td>
											</tr>
											{aiProfitInsight?.id === order.id && (
												<tr className="bg-indigo-50/50 dark:bg-indigo-900/10 transition-all">
													<td colSpan={5} className="px-6 py-5">
														<div className="flex gap-3 animate-in fade-in slide-in-from-top-2">
															<div className="shrink-0 pt-1 text-indigo-500"><Bot size={18} /></div>
															<div className="text-xs text-indigo-900 dark:text-indigo-200 whitespace-pre-wrap leading-relaxed w-full font-medium">
																{aiProfitInsight?.loading ? 'Hệ thống AI đang tính toán lại và rà soát các bất thường...' : aiProfitInsight?.insight}
															</div>
															{!aiProfitInsight?.loading && (
																<button onClick={() => setAiProfitInsight(null)} className="shrink-0 text-slate-400 hover:text-slate-600 px-2 font-black">&times;</button>
															)}
														</div>
													</td>
												</tr>
											)}
										</React.Fragment>
										))}
									</tbody>
								</table>
							</div>

							{/* Lớp hiển thị Mobile - Cards */}
							<div className="md:hidden divide-y divide-slate-50 dark:divide-slate-800">
								{paginatedProfits.map((order, i) => (
									<div key={i} className="p-5 space-y-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
										<div className="flex justify-between items-start">
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<span className="size-2 rounded-full bg-indigo-500"></span>
													<p className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">#{order.invoiceId || order.id.slice(-6).toUpperCase()}</p>
												</div>
												<h4 className="text-sm font-black text-slate-800 dark:text-white uppercase leading-tight">{order.customerName}</h4>
											</div>
											<div className="text-right">
												<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Doanh thu</p>
												<p className="text-sm font-black text-slate-900 dark:text-white">{formatPrice(order.revenue)}</p>
											</div>
										</div>
										<div className="grid grid-cols-2 gap-3 pt-2">
											<div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100/50 dark:border-slate-700/30">
												<p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Giá vốn</p>
												<p className="text-xs font-bold text-slate-500 dark:text-slate-400 italic">{formatPrice(order.cost)}</p>
											</div>
											<div className={`p-3 rounded-2xl border shadow-sm ${order.profit > 0 ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-800/30' : 'bg-rose-50 border-rose-100 dark:bg-rose-900/10 dark:border-rose-800/30'}`}>
												<div className="flex items-center justify-between mb-1">
													<p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lợi nhuận</p>
													{order.aiFixed && <Sparkles size={10} className="text-indigo-500 animate-pulse" />}
												</div>
												<p className={`text-xs font-black ${order.profit > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
													{formatPrice(order.profit)}
												</p>
											</div>
										</div>
										<div className="pt-3">
											<button 
												onClick={() => handleAICheckProfit(order)}
												disabled={aiProfitInsight?.loading && aiProfitInsight.id === order.id}
												className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors disabled:opacity-50 shadow-sm"
											>
												{aiProfitInsight?.id === order.id && aiProfitInsight?.loading ? <Sparkles className="animate-spin" size={14} /> : <Bot size={14} />}
												{aiProfitInsight?.id === order.id && aiProfitInsight?.loading ? 'AI đang phân tích...' : 'AI Rà Soát Tính Toán'}
											</button>
											{aiProfitInsight?.id === order.id && !aiProfitInsight?.loading && (
												<div className="relative mt-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/40 text-[11px] text-indigo-900 dark:text-indigo-200 whitespace-pre-wrap leading-relaxed animate-in fade-in zoom-in-95 font-medium shadow-sm">
													<div className="absolute top-2 right-2">
														<button onClick={() => setAiProfitInsight(null)} className="text-slate-400 hover:text-slate-600 p-1 font-black">&times;</button>
													</div>
													<div className="flex items-center gap-2 mb-2 pb-2 border-b border-indigo-200 dark:border-indigo-800/50">
														<Bot size={14} className="text-indigo-500" />
														<span className="font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400">Kết luận từ AI</span>
													</div>
													{aiProfitInsight?.insight}
												</div>
											)}
										</div>
									</div>
								))}
							</div>
						</div>

						{/* Pagination UI - Profits */}
						{totalProfitsPages > 1 && (
							<div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
								<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">
									Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, orderProfits.length)} của {orderProfits.length} đơn
								</p>
								<div className="flex items-center gap-2">
									<button
										disabled={currentPage === 1}
										onClick={() => { setCurrentPage(prev => prev - 1); window.scrollTo(0, 0); }}
										className="size-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 disabled:opacity-30 transition-all hover:bg-slate-100 dark:hover:bg-slate-700"
									>
										<ChevronRight className="rotate-180" size={18} />
									</button>
									<div className="flex items-center gap-1">
										{getPageNumbers(totalProfitsPages).map((page, idx) => (
											<button
												key={idx}
												onClick={() => typeof page === 'number' && setCurrentPage(page)}
												disabled={page === '...'}
												className={`size-10 rounded-xl font-black text-xs transition-all ${page === currentPage
													? 'bg-[#1A237E] text-white shadow-lg shadow-blue-500/20'
													: page === '...'
														? 'text-slate-400 cursor-default'
														: 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
													}`}
											>
												{page}
											</button>
										))}
									</div>
									<button
										disabled={currentPage === totalProfitsPages}
										onClick={() => { setCurrentPage(prev => prev + 1); window.scrollTo(0, 0); }}
										className="size-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 disabled:opacity-30 transition-all hover:bg-slate-100 dark:hover:bg-slate-700"
									>
										<ChevronRight size={18} />
									</button>
								</div>
							</div>
						)}
					</div>
				)}

				{!isAdmin && (
					<div className="flex flex-col items-center justify-center py-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
						<div className="size-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-6">
							<Bot size={48} />
						</div>
						<h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2">Truy cập bị hạn chế</h3>
						<p className="text-sm font-bold text-slate-400 uppercase tracking-widest text-center max-w-xs">Bạn cần quyền Admin để xem các báo cáo tài chính này.</p>
					</div>
				)}
			</main>

			{/* MODAL GHI CHÚ THU CHI */}
			{
				showLogForm && (
					<div className="fixed inset-0 z-[100] bg-[#1A237E]/90 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden">
						<div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 duration-300 relative group">
							{/* HEADER CỐ ĐỊNH */}
							<div className="px-8 py-5 bg-indigo-600 text-white flex items-center justify-between shrink-0">
								<div className="flex flex-col">
									<h3 className="text-lg font-black uppercase tracking-tight leading-none">{editingId ? 'Chỉnh sửa Ghi chú' : 'Ghi chú Thu / Chi'}</h3>
									<span className="text-[9px] font-bold text-white/60 uppercase mt-1 tracking-widest">Sổ quỹ nội bộ</span>
								</div>
								<button onClick={() => {
									setShowLogForm(false);
									setEditingId(null);
									setSearchParams(prev => {
										prev.delete('new');
										return prev;
									});
								}} className="size-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all text-2xl font-light">&times;</button>
							</div>

							<form onSubmit={handleSaveLog} className="flex-1 flex flex-col overflow-hidden">
								{/* NỘI DUNG CUỘN */}
								<div className="flex-1 overflow-y-auto no-scrollbar p-6 md:p-8 space-y-5">
								<div className="flex bg-slate-50 dark:bg-slate-800 p-1 rounded-2xl">
									<button
										type="button"
										onClick={() => setLogData({ ...logData, type: 'thu', category: 'Vay ngân hàng' })}
										className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${logData.type === 'thu' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400'}`}
									>
										Thu vào (+)
									</button>
									<button
										type="button"
										onClick={() => setLogData({ ...logData, type: 'chi', category: 'Vận hành' })}
										className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${logData.type === 'chi' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-400'}`}
									>
										Chi ra (-)
									</button>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Số tiền (VNĐ)</label>
										<input
											type="number"
											className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 font-black text-indigo-600 text-lg focus:ring-2 focus:ring-indigo-500/20"
											placeholder="0"
											value={logData.amount === 0 ? '' : logData.amount}
											onChange={(e) => setLogData({ ...logData, amount: parseFloat(e.target.value) || 0 })}
											required
										/>
									</div>
									<div className="md:hidden lg:block lg:invisible"></div> {/* Placeholder for mobile grouping */}
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Hạng mục</label>
										<select
											className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 appearance-none"
											value={logData.category}
											onChange={(e) => setLogData({ ...logData, category: e.target.value })}
										>
											{logData.type === 'thu' ? (
												<>
													<option value="Vay ngân hàng">🏦 Vay ngân hàng</option>
													<option value="Vay khác">🤝 Vay khác</option>
													<option value="Chiết khấu">🎁 Chiết khấu</option>
													<option value="Tiền dư sẵn">💰 Tiền dư sẵn</option>
													<option value="Khác">✨ Khác</option>
												</>
											) : (
												<>
													<option value="Vận hành">⚙️ Vận hành</option>
													<option value="Nhập hàng">📦 Nhập hàng</option>
													<option value="Lương">👨‍🔧 Lương nhân viên</option>
													<option value="Lãi suất ngân hàng">📈 Lãi suất ngân hàng</option>
													<option value="Nợ gốc ngân hàng">🏦 Nợ gốc ngân hàng</option>
													<option value="Đáo hạn ngân hàng">⏳ Đáo hạn ngân hàng</option>
													<option value="Khác">✨ Khác</option>
												</>
											)}
										</select>
									</div>
									<div>
										<label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Ngày tháng</label>
										<input
											type="date"
											className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white"
											value={logData.date}
											onChange={(e) => setLogData({ ...logData, date: e.target.value })}
										/>
									</div>
								</div>
								{logData.type === 'thu' && (logData.category === 'Vay ngân hàng' || logData.category === 'Vay khác') && (
									<div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											{logData.category === 'Vay ngân hàng' && (
												<div>
													<label className="block text-[10px] font-black text-indigo-400 uppercase mb-1.5 ml-1">Ngân hàng</label>
													<select
														className="w-full bg-white dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
														value={logData.bankName}
														onChange={(e) => setLogData({ ...logData, bankName: e.target.value })}
													>
														<option value="">-- Chọn ngân hàng --</option>
														{BANKS.map(b => <option key={b} value={b}>{b}</option>)}
													</select>
												</div>
											)}
											<div className={logData.category !== 'Vay ngân hàng' ? 'col-span-1 md:col-span-2' : ''}>
												<label className="block text-[10px] font-black text-indigo-400 uppercase mb-1.5 ml-1">Kỳ hạn vay</label>
												<select
													className="w-full bg-white dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
													value={logData.loanTerm}
													onChange={(e) => setLogData({ ...logData, loanTerm: e.target.value })}
												>
													<option value="">-- Chọn kỳ hạn --</option>
													{LOAN_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
												</select>
											</div>
										</div>

										<div>
											<label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Lãi suất (% / năm)</label>
											<div className="flex gap-2">
												<div className="relative flex-1">
													<input
														type="number"
														step="0.1"
														className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
														placeholder="0.0"
														value={logData.interestRate === 0 ? '' : logData.interestRate}
														onChange={(e) => {
															const val = parseFloat(e.target.value) || 0;
															interestRateManual.current = val > 0;
															setLogData({ ...logData, interestRate: val });
														}}
													/>
												</div>
												{logData.category === 'Vay ngân hàng' && (
													<button
														type="button"
														onClick={handleAIInterestRate}
														disabled={isFetchingRate || !logData.bankName || !logData.loanTerm}
														className="px-6 rounded-2xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-all disabled:opacity-50 flex items-center gap-2 font-black text-[10px] uppercase shadow-sm border border-indigo-100 dark:border-indigo-800"
													>
														{isFetchingRate ? <Sparkles className="animate-spin text-indigo-400" size={14} /> : <Bot size={16} />}
														Tra cứu
													</button>
												)}
											</div>
										</div>
									</div>
								)}

								<div>
									<label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Email (Nếu có)</label>
									<input
										type="email"
										className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white"
										placeholder="example@mail.com"
										value={logData.email}
										onChange={(e) => setLogData({ ...logData, email: e.target.value })}
									/>
								</div>

								{logData.type === 'chi' && ['Lãi suất ngân hàng', 'Nợ gốc ngân hàng', 'Đáo hạn ngân hàng'].includes(logData.category) && (
									<div className="bg-rose-50/50 dark:bg-rose-900/10 p-4 rounded-2xl border border-rose-100 dark:border-rose-800/50 space-y-2 animate-in slide-in-from-top-2 duration-200">
										<label className="block text-[10px] font-black text-rose-400 uppercase mb-1.5 ml-1">Chọn khoản vay liên quan</label>
										<select
											className="w-full bg-white dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-rose-500/20 text-rose-600 shadow-sm"
											value={logData.parentId}
											onChange={(e) => {
												const selectedLoan = cashLogs.find(l => l.id === e.target.value);
												setLogData({ 
													...logData, 
													parentId: e.target.value,
													amount: logData.category !== 'Lãi suất ngân hàng' ? (selectedLoan?.amount || 0) : logData.amount,
													email: selectedLoan?.email || logData.email
												});
											}}
											required
										>
											<option value="">-- Chọn khoản vay để tất toán/đóng lãi --</option>
											{cashLogs.filter(l => l.type === 'thu' && l.category === 'Vay ngân hàng').map(loan => {
												const isPaid = cashLogs.some(l => l.parentId === loan.id && (l.category === 'Nợ gốc ngân hàng' || l.category === 'Đáo hạn ngân hàng'));
												return (
													<option key={loan.id} value={loan.id} disabled={isPaid}>
														{loan.bankName} - {formatPrice(loan.amount)} ({loan.date}) {isPaid ? '[ĐÃ TẤT TOÁN]' : ''}
													</option>
												);
											})}
										</select>
										<p className="text-[8px] text-rose-400 font-bold uppercase ml-1 opacity-70">* Phải chọn đúng khoản vay để Bot tính lãi chính xác</p>
									</div>
								)}

								<div className="space-y-3">
									<div className="flex items-center justify-between px-1">
										<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Ghi chú chi tiết</label>
										{isFetchingRate && (
											<div className="flex items-center gap-2 text-[9px] font-black text-indigo-500 animate-pulse uppercase tracking-widest">
												<Sparkles size={10} className="animate-spin" />
												Nexus AI đang lập biểu mẫu...
											</div>
										)}
									</div>
									<textarea
										className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 resize-none h-24"
										placeholder="VD: Chi tiền điện nước tháng 1..."
										value={logData.note}
										onChange={(e) => setLogData({ ...logData, note: e.target.value })}
									/>
								</div>

								</div>

								{/* NÚT XÁC NHẬN CỐ ĐỊNH Ở ĐÁY FORM */}
								<div className="p-5 md:p-8 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 shrink-0">
									<button
										type="submit"
										className="w-full bg-indigo-600 text-white py-4 md:py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-500/30 hover:bg-indigo-700 transition-all active:scale-[0.98] group"
									>
										<span className="flex items-center justify-center gap-2">
											Xác nhận ghi sổ
											<ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
										</span>
									</button>
								</div>
							</form>
						</div>
					</div>
				)
			}


			{/* Popup hiển thị chi tiết nội dung */}
			{selectedNote && (
				<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div 
						className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
							<h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Chi tiết ghi chú</h3>
							<button 
								onClick={() => setSelectedNote(null)}
								className="size-8 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-all"
							>
								<span className="material-symbols-outlined text-xl">close</span>
							</button>
						</div>
						<div className="p-8">
							<div className="bg-slate-50 dark:bg-slate-800/30 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50">
								<p className="text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-medium">
									{selectedNote}
								</p>
							</div>
						</div>
						<div className="p-6 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end">
							<button
								onClick={() => setSelectedNote(null)}
								className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
							>
								Đóng lại
							</button>
						</div>
					</div>
					<div className="absolute inset-0 -z-10" onClick={() => setSelectedNote(null)} />
				</div>
			)}

			{/* Delete Confirmation Modal */}
			{deleteConfirm && (
				<div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
					<div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in">
						<div className="p-6 text-center">
							<div className="size-16 mx-auto mb-4 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center">
								<Trash2 size={28} className="text-rose-500" />
							</div>
							<h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">Xác nhận xóa</h3>
							<p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
								Bạn có chắc chắn muốn xóa vĩnh viễn ghi chép:<br />
								<span className="font-bold text-slate-700 dark:text-slate-200">"{deleteConfirm.log.note || 'Không có tiêu đề'}"</span>
							</p>
							<p className="text-xs text-rose-400 font-bold mt-2">⚠ Hành động này không thể hoàn tác</p>
						</div>
						<div className="flex gap-3 p-6 pt-0">
							<button
								type="button"
								onClick={() => setDeleteConfirm(null)}
								className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
							>
								Hủy
							</button>
							<button
								type="button"
								onClick={confirmDelete}
								className="flex-1 py-3 px-4 bg-rose-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-600 transition-all active:scale-95 shadow-lg shadow-rose-500/25"
							>
								Xóa vĩnh viễn
							</button>
						</div>
					</div>
					<div className="absolute inset-0 -z-10" onClick={() => setDeleteConfirm(null)} />
				</div>
			)}
		</div >
	);
};

export default Finance;
