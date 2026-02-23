import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
	Clock, ChevronRight, CheckCircle2, AlertCircle, Play,
	ExternalLink, Award, Trophy, Info, Key, User,
	ArrowLeft, RefreshCcw, Star
} from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc, limit, setDoc, serverTimestamp } from 'firebase/firestore';
import { useOwner } from '../hooks/useOwner';
import { useToast } from '../components/shared/Toast';

// Lab Task definitions
const labData: Record<string, any> = {
	'lab-01': {
		title: 'Làm quen với Dunvex Build',
		duration: 600, // 10 minutes for real practice
		practiceArea: 'Môi trường cá nhân',
		tasks: [
			{
				id: 1,
				type: 'count',
				title: 'Tạo 5 khách hàng mới',
				description: 'Hãy thao tác trực tiếp trên mã doanh nghiệp của bạn. Khởi tạo đúng 5 khách hàng mới trong danh sách khách hàng.',
				target: 5,
				field: 'customers',
				points: 30,
				instructions: 'Truy cập tab "Khách hàng", nhấn nút "Thêm mới" và điền thông tin cho 5 khách hàng khác nhau.'
			},
			{
				id: 2,
				type: 'count',
				title: 'Tạo 5 sản phẩm mới',
				description: 'Thêm 5 mặt hàng vào kho hàng của bạn để bắt đầu kinh doanh.',
				target: 5,
				field: 'products',
				points: 30,
				instructions: 'Truy cập tab "Kho hàng", chọn "Thêm sản phẩm" và nhập thông tin cơ bản cho 5 sản phẩm.'
			},
			{
				id: 3,
				type: 'count',
				title: 'Lên 2 đơn hàng mới',
				description: 'Thực hành tạo 2 đơn hàng (Quick Order) cho các khách hàng bạn vừa tạo trên chính hệ thống của bạn.',
				target: 2,
				field: 'orders',
				points: 40,
				instructions: 'Sử dụng chức năng "Lên đơn nhanh" tại trang chủ hoặc danh sách khách hàng.'
			}
		]
	},
	'lab-02': {
		title: 'Quản lý Tồn kho Chuyên sâu',
		duration: 900,
		practiceArea: 'Môi trường cá nhân',
		tasks: [
			{
				id: 1,
				type: 'stock_check',
				title: 'Thiết lập tồn kho ban đầu',
				description: 'Cập nhật số lượng tồn kho cho ít nhất 5 sản phẩm, mỗi sản phẩm có 100 cái trong kho.',
				target: 5,
				field: 'products',
				target_value: 100,
				points: 30,
				instructions: 'Vào danh sách Sản phẩm, nhấn Edit từng món và chỉnh "Tồn kho" thành 100.'
			},
			{
				id: 2,
				type: 'count',
				title: 'Xuất kho chốt đơn',
				description: 'Tạo 1 đơn hàng mới với tổng số lượng sản phẩm là 50 cái.',
				target: 1,
				field: 'orders',
				points: 30,
				instructions: 'Dùng chức năng Lên đơn, chọn khách hàng và nhập số lượng 50 cho các sản phẩm.'
			},
			{
				id: 3,
				type: 'quiz',
				title: 'Đối soát tồn thực tế',
				description: 'Dựa trên nghiệp vụ vừa thực hiện (Tồn 100, bán 50), số lượng tồn kho còn lại của sản phẩm đó trên lý thuyết là bao nhiêu?',
				field: 'none',
				points: 40,
				quiz: {
					question: 'Số lượng tồn kho còn lại là:',
					options: ['100 cái', '50 cái', '150 cái', '0 cái'],
					answer: '50 cái'
				},
				instructions: 'Chọn đáp án đúng nhất dựa trên các bước thực hành trên.'
			}
		]
	},
	'lab-03': {
		title: 'Vận hành chuyên sâu & Đồng bộ',
		duration: 1200,
		practiceArea: 'Môi trường cá nhân',
		tasks: [
			{
				id: 1,
				type: 'checkin_complex',
				title: 'Thực địa chuyên nghiệp',
				description: 'Thực hiện 5 lượt check-in với đủ các loại: 3 Khách mới, 1 Viếng thăm, 1 Khiếu nại. Yêu cầu tất cả phải có ảnh và ghi chú.',
				target: 5,
				field: 'checkins',
				points: 40,
				instructions: 'Vào menu Check-in, chọn khách hàng, chọn đúng loại mục đích, chụp ảnh và viết ghi chú trước khi nhấn Lưu.'
			},
			{
				id: 2,
				type: 'setting_link_check',
				title: 'Thiết lập Báo giá thông minh',
				description: 'Tạo 1 Google Sheet báo giá và cập nhật liên kết vào hệ thống để kích hoạt tính năng báo giá tự động.',
				field: 'quotation_sheet_url',
				points: 20,
				instructions: 'Truy cập Cài đặt Quản trị > Đồng bộ dữ liệu, dán link Google Sheet báo giá của bạn vào ô tương ứng.'
			},
			{
				id: 3,
				type: 'setting_link_check',
				title: 'Đồng bộ Khách hàng hàng loạt',
				description: 'Tạo 1 Google Sheet khách hàng và cập nhật liên kết để quản lý tập trung.',
				field: 'customer_sheet_url',
				points: 20,
				instructions: 'Truy cập Cài đặt Quản trị, dán link Google Sheet chứa danh sách khách hàng của bạn.'
			},
			{
				id: 4,
				type: 'setting_link_check',
				title: 'Quản lý Sản phẩm hàng loạt',
				description: 'Kết nối Google Sheet sản phẩm để cập nhật giá và tồn kho nhanh chóng.',
				field: 'product_sheet_url',
				points: 20,
				instructions: 'Truy cập Cài đặt Quản trị, dán link Google Sheet sản phẩm của bạn.'
			}
		]
	},
	'lab-04': {
		title: 'Đối soát & Tài chính',
		duration: 1500,
		practiceArea: 'Môi trường cá nhân',
		tasks: [
			{
				id: 1,
				type: 'count',
				title: 'Ghi nhận thu nợ',
				description: 'Thực hiện 1 phiếu thu cho khách hàng để ghi nhận việc thu hồi công nợ.',
				target: 1,
				field: 'payments',
				points: 30,
				instructions: 'Truy cập tab "Công nợ", chọn khách hàng và nhấn "Thu nợ", nhập số tiền đã thu.'
			},
			{
				id: 2,
				type: 'sync_check',
				title: 'Đẩy dữ liệu về Sheet',
				description: 'Vào trang quản trị và đồng bộ dữ liệu thực tế về Google Sheets.',
				points: 20,
				instructions: 'Vào Cài đặt Quản trị > Tổng quan, nhấn nút "Cập nhật dữ liệu ngay".'
			},
			{
				id: 3,
				type: 'quiz_data',
				title: 'Câu 2.1: Đối tác lên đơn',
				description: 'Trong dữ liệu bạn vừa đồng bộ, bạn đã lên đơn hàng cho ai?',
				field: 'orders',
				quiz_type: 'customer_name',
				points: 10,
				instructions: 'Kiểm tra cột "Tên khách hàng" trong sheet Orders.'
			},
			{
				id: 4,
				type: 'quiz_data',
				title: 'Câu 2.2: Sản phẩm lưu kho',
				description: 'Sản phẩm nào hiện đang được lưu trong danh mục sản phẩm của bạn?',
				field: 'products',
				quiz_type: 'product_name',
				points: 10,
				instructions: 'Kiểm tra sheet Products.'
			},
			{
				id: 5,
				type: 'quiz_data',
				title: 'Câu 2.3: Khách hàng lưu trữ',
				description: 'Khách hàng nào hiện đang có trong danh sách của bạn?',
				field: 'customers',
				quiz_type: 'customer_name',
				points: 10,
				instructions: 'Kiểm tra sheet Customers.'
			},
			{
				id: 6,
				type: 'quiz_data',
				title: 'Câu 2.4: Số lượng đơn hàng',
				description: 'Có bao nhiêu đơn hàng đã được ghi nhận trong hệ thống (Sheet Orders)?',
				field: 'orders',
				quiz_type: 'count_check',
				points: 20,
				instructions: 'Đếm số dòng dữ liệu trong sheet Orders (không tính tiêu đề).'
			}
		]
	}
};

const TrainingLab = () => {
	const { id } = useParams();
	const navigate = useNavigate();
	const owner = useOwner();
	const { showToast } = useToast();
	const lab = labData[id || 'lab-01'] || labData['lab-01'];

	const [timeLeft, setTimeLeft] = useState(lab.duration);
	const [taskStatus, setTaskStatus] = useState<Record<number, { completed: boolean, count: number, points: number, selectedAnswer?: string }>>({});
	const [checking, setChecking] = useState<number | null>(null);
	const [totalPoints, setTotalPoints] = useState(0);
	const [labCompleted, setLabCompleted] = useState(false);
	const [quizOptions, setQuizOptions] = useState<Record<number, string[]>>({});

	// Auto-save progress to Firestore
	useEffect(() => {
		if (!owner.ownerId || !id || totalPoints === 0) return;

		const saveProgress = async () => {
			try {
				const progressRef = doc(db, 'training_progress', `${owner.ownerId}_${id}`);
				await setDoc(progressRef, {
					ownerId: owner.ownerId,
					labId: id,
					labTitle: lab.title,
					points: totalPoints,
					completed: labCompleted,
					updatedAt: serverTimestamp()
				}, { merge: true });
			} catch (err) {
				console.error("Auto-save failed:", err);
			}
		};

		const timeoutId = setTimeout(saveProgress, 1000); // 1s Debounce to avoid excessive writes
		return () => clearTimeout(timeoutId);
	}, [totalPoints, labCompleted, owner.ownerId, id]);

	useEffect(() => {
		const loadDynamicQuizzes = async () => {
			if (!owner.ownerId || !lab.tasks) return;

			const newOptions: Record<number, string[]> = {};
			for (const task of lab.tasks) {
				if (task.type === 'quiz_data') {
					try {
						if (task.quiz_type === 'count_check') {
							const qAll = query(collection(db, task.field), where('ownerId', '==', owner.ownerId));
							const snapAll = await getDocs(qAll);
							const count = snapAll.docs.length;
							const options = [count.toString(), (count + 2).toString(), (count + 1).toString(), '0'];
							newOptions[task.id] = options.sort(() => Math.random() - 0.5);
						} else {
							const q = query(collection(db, task.field), where('ownerId', '==', owner.ownerId), limit(1));
							const snap = await getDocs(q);
							const realName = snap.docs.length > 0 ? (snap.docs[0].data().name || snap.docs[0].data().customerName || 'Dữ liệu thực tế') : 'Chưa có data';
							const options = [realName, 'Khách hàng Test', 'Mặt hàng mẫu', 'Hệ thống giả lập'];
							newOptions[task.id] = options.sort(() => Math.random() - 0.5);
						}
					} catch (e) { console.error(e); }
				}
			}
			setQuizOptions(newOptions);
		};
		loadDynamicQuizzes();
	}, [owner.ownerId, id]);

	useEffect(() => {
		if (timeLeft > 0 && !labCompleted) {
			const timer = setInterval(() => setTimeLeft((prev: number) => prev - 1), 1000);
			return () => clearInterval(timer);
		}
	}, [timeLeft, labCompleted]);

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	};

	const checkProgress = async (taskId: number) => {
		const task = lab.tasks.find((t: any) => t.id === taskId);
		if (!task || !owner.ownerId) return;

		setChecking(taskId);
		try {
			let count = 0;
			let isCorrect = false;

			if (task.type === 'quiz' || task.type === 'quiz_data') {
				const currentSelection = taskStatus[taskId]?.selectedAnswer;

				if (task.type === 'quiz_data') {
					if (task.quiz_type === 'count_check') {
						const q = query(collection(db, task.field), where('ownerId', '==', owner.ownerId));
						const snap = await getDocs(q);
						isCorrect = currentSelection === snap.docs.length.toString();
					} else {
						const fieldName = task.quiz_type === 'customer_name' ? 'customerName' : 'name';
						// Also check 'name' for customers just in case
						const q1 = query(collection(db, task.field), where('ownerId', '==', owner.ownerId), where('name', '==', currentSelection));
						const q2 = query(collection(db, task.field), where('ownerId', '==', owner.ownerId), where('customerName', '==', currentSelection));
						const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
						isCorrect = s1.docs.length > 0 || s2.docs.length > 0;
					}
				} else {
					isCorrect = currentSelection === task.quiz.answer;
				}

				if (isCorrect) {
					count = 1;
				} else {
					showToast("Đáp án chưa chính xác. Vui lòng kiểm tra lại dữ liệu trong Sheet!", "warning");
					setChecking(null);
					return;
				}
			} else if (task.type === 'stock_check') {
				const q = query(
					collection(db, 'products'),
					where('ownerId', '==', owner.ownerId),
					where('stock', '>=', task.target_value)
				);
				const snap = await getDocs(q);
				count = snap.docs.length;
				isCorrect = count >= task.target;
			} else if (task.type === 'checkin_complex') {
				const q = query(
					collection(db, 'checkins'),
					where('ownerId', '==', owner.ownerId)
				);
				const snap = await getDocs(q);
				const data = snap.docs.map(d => d.data());

				const newCount = data.filter(d => d.purpose === 'Khách mới' && d.imageUrl && d.note).length;
				const visitCount = data.filter(d => d.purpose === 'Viếng thăm' && d.imageUrl && d.note).length;
				const complaintCount = data.filter(d => d.purpose === 'Khiếu nại' && d.imageUrl && d.note).length;

				isCorrect = newCount >= 3 && visitCount >= 1 && complaintCount >= 1;
				count = data.length;
			} else if (task.type === 'setting_link_check') {
				const settingsRef = doc(db, 'settings', owner.ownerId);
				const settingsSnap = await getDoc(settingsRef);
				if (settingsSnap.exists()) {
					const val = settingsSnap.data()[task.field];
					isCorrect = !!val && (val.includes('google.com/spreadsheets') || val.startsWith('http'));
					count = isCorrect ? 1 : 0;
				}
			} else if (task.type === 'sync_check') {
				const settingsRef = doc(db, 'settings', owner.ownerId);
				const settingsSnap = await getDoc(settingsRef);
				if (settingsSnap.exists()) {
					const lastSync = settingsSnap.data().lastSyncAt;
					isCorrect = !!lastSync;
					count = isCorrect ? 1 : 0;
				}
			} else {
				// Default 'count'
				const q = query(collection(db, task.field), where('ownerId', '==', owner.ownerId));
				const snap = await getDocs(q);
				count = snap.docs.length;
				isCorrect = count >= task.target;
			}

			// Calculate score
			const earnedPoints = isCorrect ? task.points : Math.floor(Math.min(count, (task.target || 1)) * (task.points / (task.target || 1)));

			setTaskStatus(prev => {
				const newStatus = {
					...prev,
					[taskId]: {
						...prev[taskId],
						completed: isCorrect,
						count,
						points: earnedPoints
					}
				};

				const newTotal = Object.values(newStatus).reduce((sum, s) => sum + s.points, 0);
				setTotalPoints(newTotal);

				const allDone = lab.tasks.every((t: any) => newStatus[t.id]?.completed);
				if (allDone) setLabCompleted(true);

				return newStatus;
			});
		} catch (err) {
			console.error("Verification error:", err);
			showToast("Lỗi khi kiểm tra: " + err, "error");
		} finally {
			setChecking(null);
		}
	};

	return (
		<div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 overflow-hidden font-['Manrope']">
			{/* Sidebar Instructions */}
			<div className="w-full md:w-[450px] h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shadow-2xl z-20 overflow-y-auto no-scrollbar shrink-0">
				<header className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800">
					<button onClick={() => navigate('/khoa-dao-tao')} className="text-slate-400 hover:text-indigo-600 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-4 md:mb-6 transition-colors">
						<ArrowLeft size={16} /> Quay lại catalog
					</button>
					<h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-2 leading-tight uppercase">{lab.title}</h2>
					<div className="flex items-center gap-4">
						<div className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
							{id === 'lab-01' ? 'Mở đầu' : 'Nâng cao'}
						</div>
						<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GSP-001</p>
					</div>
				</header>

				<div className="p-8 space-y-10">
					{/* Real Environment Instructions */}
					<section className="space-y-4">
						<h3 className="font-black text-xs uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-2">
							<Play size={16} className="text-emerald-500" /> Thực hành thực tế
						</h3>
						<div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-6 space-y-4">
							<p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 leading-relaxed uppercase">
								Hệ thống đang kết nối trực tiếp với tài khoản của bạn:
							</p>
							<div className="space-y-2">
								<CredentialItem icon={<User size={14} />} label="Tài khoản" value={owner.ownerEmail || 'Đang xác thực...'} />
								<CredentialItem icon={<Info size={14} />} label="ID Doanh nghiệp" value={owner.ownerId || 'N/A'} />
							</div>
							<p className="text-[10px] text-slate-400 font-medium italic">
								* Mọi thao tác bạn thực hiện trong ứng dụng sẽ được ghi nhận để chấm điểm ngay lập tức.
							</p>
							<button
								onClick={() => window.open(window.location.origin + '/', '_blank')}
								className="w-full bg-indigo-600 text-white h-12 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
							>
								Mở Bảng Điều Khiển <ExternalLink size={14} />
							</button>
						</div>
					</section>

					{/* Task List */}
					<section className="space-y-6">
						<h3 className="font-black text-xs uppercase tracking-widest text-slate-800 dark:text-slate-200">Danh sách nhiệm vụ</h3>
						<div className="space-y-4">
							{lab.tasks.map((task: any) => (
								<div key={task.id} className="group">
									<div className={`p-6 rounded-[2rem] border transition-all duration-300 ${taskStatus[task.id]?.completed ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30' : 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800'}`}>
										<div className="flex items-start justify-between gap-3 mb-4">
											<div className="flex items-center gap-3">
												<div className={`size-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${taskStatus[task.id]?.completed ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
													{task.id}
												</div>
												<h4 className="font-black text-xs md:text-sm dark:text-white uppercase tracking-tight leading-tight">{task.title}</h4>
											</div>
											{taskStatus[task.id]?.completed && <CheckCircle2 size={20} className="text-emerald-500 animate-in zoom-in shrink-0" />}
										</div>
										<div className="space-y-4">
											<p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{task.description}</p>

											{(task.type === 'quiz' || task.type === 'quiz_data') && !taskStatus[task.id]?.completed && (
												<div className="grid grid-cols-2 gap-3 mt-4">
													{(task.type === 'quiz_data' ? (quizOptions[task.id] || []) : task.quiz.options).map((option: string) => (
														<button
															key={option}
															onClick={() => setTaskStatus(prev => ({ ...prev, [task.id]: { ...prev[task.id], selectedAnswer: option } }))}
															className={`p-3 text-[10px] font-bold rounded-xl border transition-all text-left ${taskStatus[task.id]?.selectedAnswer === option ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-800 hover:border-indigo-300'}`}
														>
															{option}
														</button>
													))}
												</div>
											)}
										</div>

										<div className="flex items-center justify-between mt-6">
											<div className="flex items-center gap-2">
												{!(task.type === 'quiz' || task.type === 'quiz_data') && (
													<>
														<div className="h-1.5 w-24 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
															<div
																className="h-full bg-emerald-500 transition-all duration-1000"
																style={{ width: `${Math.min((taskStatus[task.id]?.count || 0) / task.target * 100, 100)}%` }}
															></div>
														</div>
														<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{taskStatus[task.id]?.count || 0}/{task.target}</span>
													</>
												)}
											</div>
											<button
												onClick={() => checkProgress(task.id)}
												disabled={checking === task.id || taskStatus[task.id]?.completed || ((task.type === 'quiz' || task.type === 'quiz_data') && !taskStatus[task.id]?.selectedAnswer)}
												className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${taskStatus[task.id]?.completed ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 disabled:opacity-50'}`}
											>
												{checking === task.id ? <RefreshCcw size={14} className="animate-spin" /> : (task.type === 'quiz' || task.type === 'quiz_data') ? 'Xác nhận' : 'Kiểm tra'}
											</button>
										</div>
									</div>
								</div>
							))}
						</div>
					</section>
				</div>
			</div>

			{/* Main Content (Preview & Score) */}
			<div className="flex-1 flex flex-col relative overflow-hidden">
				<header className="h-24 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-10 flex items-center justify-between shrink-0">
					<div className="flex items-center gap-10">
						<div className="flex flex-col">
							<span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Thời gian còn lại</span>
							<div className={`text-3xl font-black tabular-nums ${timeLeft < 60 ? 'text-rose-500 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
								{formatTime(timeLeft)}
							</div>
						</div>
						<div className="w-px h-10 bg-slate-100 dark:border-slate-800"></div>
						<div className="flex flex-col">
							<span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Tổng điểm tích lũy</span>
							<div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
								{totalPoints.toString().padStart(3, '0')} <span className="text-sm">PTS</span>
							</div>
						</div>
					</div>

					<div className="flex items-center gap-4">
						<div className="bg-slate-100 dark:bg-slate-800 px-6 py-3 rounded-2xl flex items-center gap-3">
							<div className="size-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center text-amber-500 shadow-sm">
								<Award size={24} />
							</div>
							<div>
								<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-60">Thứ hạng Lab</p>
								<p className="text-sm font-black dark:text-white">Professional Expert</p>
							</div>
						</div>
						<button onClick={() => navigate('/khoa-dao-tao')} className="h-14 px-8 bg-rose-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-600 shadow-xl shadow-rose-500/20 active:scale-95 transition-all">Kết thúc Lab</button>
					</div>
				</header>

				<div className="flex-1 overflow-y-auto p-12 no-scrollbar bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]">
					{labCompleted ? (
						<div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 text-center animate-in zoom-in duration-700">
							<div className="size-32 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-8 relative">
								<Trophy size={64} className="text-amber-500" strokeWidth={1.5} />
								<div className="absolute inset-0 bg-amber-200 rounded-full animate-ping opacity-20"></div>
							</div>
							<h2 className="text-4xl font-black text-slate-900 dark:text-white mb-4 uppercase tracking-tight">Cung Hỉ! Bạn đã hoàn thành Lab</h2>
							<p className="text-slate-500 dark:text-slate-400 font-medium text-lg leading-relaxed mb-10">
								Bạn đã hoàn thành bài thực hành một cách xuất sắc trên chính hệ thống của mình. Hãy nhận chứng chỉ kỹ năng ngay!
							</p>

							<div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 mb-10">
								<div className="flex justify-around">
									<ScoreMetric label="Tổng Điểm" value={totalPoints} suffix="pts" />
									<ScoreMetric label="Ước tính" value="Top 1%" suffix="" />
									<ScoreMetric label="Kỹ năng" value="+15" suffix="Level" />
								</div>
							</div>

							<button className="w-full h-16 bg-[#1A237E] text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-900 shadow-2xl shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3">
								<Award size={20} /> NHẬN CHỨNG CHỈ DIGITAL
							</button>
						</div>
					) : (
						<div className="max-w-4xl mx-auto space-y-12">
							<div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm">
								<div className="flex items-center gap-3 mb-6">
									<div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg text-blue-600 dark:text-blue-400">
										<Info size={20} />
									</div>
									<h4 className="font-black text-slate-800 dark:text-white uppercase text-xs tracking-widest">Gợi ý dành cho bạn</h4>
								</div>
								<div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 font-medium leading-loose">
									<p>Trong khoá đào tạo này, bạn sẽ thực hành trực tiếp trên chính mã doanh nghiệp của mình.
										Hệ thống Dunvex Build sẽ ghi nhận mọi thao tác của bạn trong thời gian thực.</p>
									<ul className="space-y-4 list-none pl-0">
										<li className="flex gap-4">
											<div className="size-6 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center shrink-0">1</div>
											<span>Mở <b>Bảng điều khiển</b> (Dashboard) bằng nút ở Sidebar bên trái.</span>
										</li>
										<li className="flex gap-4">
											<div className="size-6 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center shrink-0">2</div>
											<span>Thực hiện các thao tác quản trị như yêu cầu của từng nhiệm vụ.</span>
										</li>
										<li className="flex gap-4">
											<div className="size-6 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center shrink-0">3</div>
											<span>Quay lại đây và nhấn <b>Kiểm tra</b> để hệ thống chấm điểm dựa trên dữ liệu thật bạn vừa tạo.</span>
										</li>
									</ul>
								</div>
							</div>

							{/* Dynamic Task Breakdown Visual */}
							<div className="grid grid-cols-2 gap-8">
								<div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white flex flex-col justify-between shadow-xl shadow-indigo-500/30">
									<Star size={32} fill="white" className="mb-4 opacity-50" />
									<div>
										<p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Mục tiêu hiện tại</p>
										<h5 className="text-xl font-black uppercase leading-tight">Hoàn thành ít nhất 80% nhiệm vụ để đạt chứng chỉ PASS</h5>
									</div>
								</div>
								<div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 flex flex-col justify-between shadow-sm">
									<div className="flex items-center gap-2 mb-4">
										<div className="size-3 bg-emerald-500 rounded-full animate-pulse"></div>
										<span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Monitor System Online</span>
									</div>
									<p className="text-sm font-bold text-slate-700 dark:text-slate-300">Dunvex Build Training Engine đang theo dõi ID: <code className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-indigo-600">{owner.ownerId || 'Detecting...'}</code></p>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

const CredentialItem = ({ icon, label, value }: any) => (
	<div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-slate-800 px-4 py-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm gap-2">
		<div className="flex items-center gap-3">
			<span className="text-indigo-500 shrink-0">{icon}</span>
			<span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</span>
		</div>
		<span className="text-xs font-black text-slate-800 dark:text-gray-200 font-mono tracking-tight break-all text-right sm:max-w-[200px]">{value}</span>
	</div>
);

const ScoreMetric = ({ label, value, suffix }: any) => (
	<div className="text-center">
		<p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{label}</p>
		<p className="text-2xl font-black text-slate-900 dark:text-white uppercase tabular-nums">
			{value} <span className="text-xs lowercase">{suffix}</span>
		</p>
	</div>
);

export default TrainingLab;
