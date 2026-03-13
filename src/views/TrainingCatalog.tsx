import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Award, Clock, Play, CheckCircle, Star, BrainCircuit, ShieldHalf, Trophy, Medal, Crown, Youtube, Plus, Lock, Settings, Trash2, Edit2, Save, X, Mail, ExternalLink, RefreshCcw } from 'lucide-react';
import { db, auth } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, orderBy } from 'firebase/firestore';
import { useOwner } from '../hooks/useOwner';
import { useToast } from '../components/shared/Toast';

const labs = [
	{
		id: 'lab-01',
		title: 'Làm quen với Dunvex Build',
		description: 'Hướng dẫn các thao tác cơ bản để quản lý dữ liệu trong hệ thống.',
		duration: '20 phút',
		points: 100,
		difficulty: 'Cơ bản',
		icon: <BrainCircuit className="text-blue-500" size={32} />,
		tasks: 3
	},
	{
		id: 'lab-02',
		title: 'Quản lý Tồn kho Chuyên sâu',
		description: 'Kỹ năng nhập kho, xuất kho và đối soát số lượng tồn thực tế.',
		duration: '15 phút',
		points: 100,
		difficulty: 'Nâng cao',
		icon: <CheckCircle className="text-emerald-500" size={32} />,
		tasks: 3
	},
	{
		id: 'lab-03',
		title: 'Vận hành chuyên sâu & Đồng bộ',
		description: 'Thực địa chuyên nghiệp với Check-in và đồng bộ hóa hàng loạt qua Google Sheets.',
		duration: '30 phút',
		points: 150,
		difficulty: 'Chuyên gia',
		icon: <Star className="text-amber-500" size={32} />,
		tasks: 4
	},
	{
		id: 'lab-04',
		title: 'Đối soát & Tài chính',
		description: 'Ghi nhận thu nợ, đồng bộ và kiểm tra dữ liệu thực tế trên Google Sheets.',
		duration: '25 phút',
		points: 150,
		difficulty: 'Chuyên gia',
		icon: <CheckCircle className="text-indigo-500" size={32} />,
		tasks: 6
	}
];

const TrainingCatalog = () => {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const owner = useOwner();
	const { showToast } = useToast();
	const [userPoints, setUserPoints] = useState(0);
	const [labProgress, setLabProgress] = useState<Record<string, any>>({});
	const [activeTab, setActiveTab] = useState<'labs' | 'videos'>('labs');
	const [customLabs, setCustomLabs] = useState<any[]>([]);
	const [generatingAI, setGeneratingAI] = useState(false);

	// Video state
	const [videos, setVideos] = useState<any[]>([]);
	const [loadingVideos, setLoadingVideos] = useState(true);
	const [showVideoForm, setShowVideoForm] = useState(false);
	const [isVerifying, setIsVerifying] = useState(false);
	const [playingVideo, setPlayingVideo] = useState<any>(null);
	const [inputPasscode, setInputPasscode] = useState('');
	const [generatedCode, setGeneratedCode] = useState('');
	const [sendingCode, setSendingCode] = useState(false);

	// Video Form state
	const [editingVideo, setEditingVideo] = useState<any>(null);
	const [videoTitle, setVideoTitle] = useState('');
	const [videoUrl, setVideoUrl] = useState('');
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (owner.loading || !owner.ownerId) return;

		const q = query(collection(db, 'training_progress'), where('ownerId', '==', owner.ownerId));
		const unsubscribe = onSnapshot(q, (snapshot) => {
			const progress: Record<string, any> = {};
			let total = 0;
			snapshot.forEach(doc => {
				const data = doc.data();
				progress[data.labId] = data;
				total += (data.points || 0);
			});
			setLabProgress(progress);
			setUserPoints(total);
		});

		return () => unsubscribe();
	}, [owner.loading, owner.ownerId]);

	useEffect(() => {
		const q = query(collection(db, 'training_labs'), orderBy('createdAt', 'desc'));
		const unsubscribe = onSnapshot(q, (snapshot) => {
			const list: any[] = [];
			snapshot.forEach(doc => {
				list.push({ id: doc.id, ...doc.data(), isAI: true });
			});
			setCustomLabs(list);
		});
		return () => unsubscribe();
	}, []);

	useEffect(() => {
		const q = query(collection(db, 'tutorial_videos'), orderBy('createdAt', 'desc'));
		const unsubscribe = onSnapshot(q, (snapshot) => {
			const videoList: any[] = [];
			snapshot.forEach(doc => {
				videoList.push({ id: doc.id, ...doc.data() });
			});
			setVideos(videoList);
			setLoadingVideos(false);
		});

		return () => unsubscribe();
	}, []);

	useEffect(() => {
		const action = searchParams.get('action');
		const tab = searchParams.get('tab');

		if (action === 'update_video') {
			setActiveTab('videos');
			setIsVerifying(true);
			const newParams = new URLSearchParams(searchParams);
			newParams.delete('action');
			setSearchParams(newParams, { replace: true });
		} else if (tab === 'videos') {
			setActiveTab('videos');
		} else if (tab === 'labs') {
			setActiveTab('labs');
		}
	}, [searchParams]);

	const handleSendCode = async () => {
		setSendingCode(true);
		const code = Math.floor(100000 + Math.random() * 900000).toString();
		setGeneratedCode(code);

		try {
			// Trigger Email notification through GAS 
			await fetch('https://script.google.com/macros/s/AKfycbwIup8ysoKT4E_g8GOVrBiQxXw7SOtqhLWD2b0GOUT54MuoXgTtxP42XSpFR_3aoXAG7g/exec', {
				method: 'POST',
				mode: 'no-cors',
				headers: {
					'Content-Type': 'text/plain;charset=utf-8',
				},
				body: JSON.stringify({
					action: 'training_verification',
					email: auth.currentUser?.email || 'N/A',
					targetEmail: 'dunvex.green@gmail.com',
					subject: 'MÃ XÁC MINH CẬP NHẬT VIDEO HƯỚNG DẪN',
					message: `Dãy số xác minh của bạn là: ${code}. Vui lòng nhập dãy số này để mở khóa form cập nhật video.`
				})
			});
			showToast("Đã gửi mã xác minh về email dunvex.green@gmail.com", "success");
		} catch (err) {
			console.error("Failed to send verification email:", err);
			showToast("Lỗi khi gửi mã xác minh.", "error");
		} finally {
			setSendingCode(false);
		}
	};

	const handleVerifyPasscode = () => {
		if (inputPasscode === generatedCode && generatedCode !== '') {
			setIsVerifying(false);
			setShowVideoForm(true);
			showToast("Xác thực thành công!", "success");
		} else {
			showToast("Mã xác minh không chính xác.", "error");
		}
	};

	const getYoutubeId = (url: string) => {
		const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
		const match = url.match(regExp);
		return (match && match[2].length === 11) ? match[2] : null;
	};

	const handleSaveVideo = async () => {
		if (!videoTitle || !videoUrl) {
			showToast("Vui lòng nhập đầy đủ thông tin", "error");
			return;
		}

		const youtubeId = getYoutubeId(videoUrl);
		if (!youtubeId) {
			showToast("Link YouTube không hợp lệ", "error");
			return;
		}

		setIsSaving(true);
		try {
			const videoData = {
				title: videoTitle,
				url: videoUrl,
				youtubeId,
				thumbnail: `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`,
				updatedAt: serverTimestamp(),
				createdBy: auth.currentUser?.email
			};

			if (editingVideo) {
				await updateDoc(doc(db, 'tutorial_videos', editingVideo.id), videoData);
				showToast("Đã cập nhật video", "success");
			} else {
				await addDoc(collection(db, 'tutorial_videos'), {
					...videoData,
					createdAt: serverTimestamp()
				});
				showToast("Đã thêm video mới", "success");
			}

			resetForm();
		} catch (error) {
			console.error("Error saving video:", error);
			showToast("Lỗi khi lưu video", "error");
		} finally {
			setIsSaving(false);
		}
	};

	const handleDeleteVideo = async (id: string) => {
		if (!window.confirm("Bạn có chắc chắn muốn xóa video này?")) return;
		try {
			await deleteDoc(doc(db, 'tutorial_videos', id));
			showToast("Đã xóa video", "success");
		} catch (error) {
			console.error("Error deleting video:", error);
			showToast("Lỗi khi xóa video", "error");
		}
	};

	const resetForm = () => {
		setEditingVideo(null);
		setVideoTitle('');
		setVideoUrl('');
		setShowVideoForm(false);
		setInputPasscode('');
		setGeneratedCode('');
	};

	const handleGenerateAITraining = async () => {
		const topic = window.prompt("Nhập chủ đề bạn muốn AI tạo bài học (ví dụ: Quản lý nợ, Tối ưu kho...):", "Quản lý kinh doanh");
		if (!topic) return;

		setGeneratingAI(true);
		showToast("Nexus AI đang biên soạn giáo án...", "info");

		try {
			const response = await fetch('https://script.google.com/macros/s/AKfycbwIup8ysoKT4E_g8GOVrBiQxXw7SOtqhLWD2b0GOUT54MuoXgTtxP42XSpFR_3aoXAG7g/exec', {
				method: 'POST',
				mode: 'no-cors',
				headers: { 'Content-Type': 'text/plain;charset=utf-8' },
				body: JSON.stringify({ action: 'ai_generate_training', topic })
			});

			// Since no-cors, we can't read response directly easily in current setup without proxy or proper CORS
			// But the user's GAS script handles it. For now, I'll use a polling or the standard ai_chat if needed.
			// Re-evaluating: standard fetch for GAS results in opaque response with no-cors.
			// I'll assume standard fetch with JSON response if the user has correct CORS.
			// If not, I'll use the existing handleAIChat style.

			const res = await (await fetch('https://script.google.com/macros/s/AKfycbwIup8ysoKT4E_g8GOVrBiQxXw7SOtqhLWD2b0GOUT54MuoXgTtxP42XSpFR_3aoXAG7g/exec', {
				method: 'POST',
				body: JSON.stringify({ action: 'ai_generate_training', topic })
			})).json();

			if (res.status === 'success') {
				const labData = JSON.parse(res.data);
				await addDoc(collection(db, 'training_labs'), {
					...labData,
					ownerId: owner.ownerId,
					createdAt: serverTimestamp(),
					createdBy: auth.currentUser?.email
				});
				showToast("Đã tạo bài học AI mới thành công!", "success");
			}
		} catch (err) {
			console.error(err);
			showToast("Lỗi khi tạo bài học AI.", "error");
		} finally {
			setGeneratingAI(false);
		}
	};

	const handleDeleteLab = async (id: string, e: React.MouseEvent) => {
		e.stopPropagation();
		if (!window.confirm("Bạn có chắc chắn muốn xóa bài học này?")) return;
		try {
			await deleteDoc(doc(db, 'training_labs', id));
			showToast("Đã xóa bài học", "success");
		} catch (error) {
			console.error("Error deleting lab:", error);
			showToast("Lỗi khi xóa bài học", "error");
		}
	};

	return (
		<div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-slate-950 transition-colors duration-300">
			<header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-8 shrink-0">
				<div className="flex items-center gap-4">
					<div className="bg-indigo-50 dark:bg-indigo-900/20 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400">
						<BookOpen size={24} />
					</div>
					<div>
						<h2 className="text-[#1A237E] dark:text-indigo-400 text-xl font-black uppercase tracking-tight">Trung tâm Đào tạo</h2>
						<p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Học tập và thực hành thực tế</p>
					</div>
				</div>
				<div className="flex items-center gap-6">
					<div className="hidden md:flex flex-col items-end">
						<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Điểm kỹ năng</span>
						<span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{userPoints.toLocaleString()} PTS</span>
					</div>
					<div className="size-10 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center text-amber-500 shadow-sm shadow-amber-200/50">
						<Award size={20} />
					</div>
				</div>
			</header>

			{/* Tab Switcher */}
			<div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-8">
				<div className="flex items-center gap-8 max-w-6xl mx-auto">
					<button
						onClick={() => setActiveTab('labs')}
						className={`py-4 text-[10px] font-black uppercase tracking-[2px] transition-all relative ${activeTab === 'labs' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
					>
						<div className="flex items-center gap-2">
							<BrainCircuit size={16} /> Thực hành Lab
						</div>
						{activeTab === 'labs' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full"></div>}
					</button>
					<button
						onClick={() => setActiveTab('videos')}
						className={`py-4 text-[10px] font-black uppercase tracking-[2px] transition-all relative ${activeTab === 'videos' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
					>
						<div className="flex items-center gap-2">
							<Youtube size={16} /> Video Hướng dẫn
						</div>
						{activeTab === 'videos' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full"></div>}
					</button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-4 md:p-10">
				<div className="max-w-6xl mx-auto">
					{activeTab === 'labs' ? (
						<>
							{/* Certifications Section - Replaces Hero */}
							<div className="mb-12">
								<div className="flex items-center justify-between mb-6">
									<div>
										<h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-[4px]">Hệ thống Chứng chỉ</h3>
										<p className="text-xs text-slate-400 font-medium">Tích lũy điểm kỹ năng để mở khóa các danh hiệu cao cấp.</p>
									</div>
									<div className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
										Cấp độ: {userPoints >= 500 ? 'Bậc thầy' : userPoints >= 400 ? 'Chuyên gia' : userPoints >= 250 ? 'Thành thạo' : 'Nhập môn'}
									</div>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
									{[
										{ id: 1, name: 'Nhập môn', points: 100, icon: <ShieldHalf size={24} />, color: 'blue' },
										{ id: 2, name: 'Thành thạo', points: 250, icon: <Medal size={24} />, color: 'emerald' },
										{ id: 3, name: 'Chuyên gia', points: 400, icon: <Trophy size={24} />, color: 'amber' },
										{ id: 4, name: 'Bậc thầy', points: 500, icon: <Crown size={24} />, color: 'indigo' }
									].sort((a, b) => {
										const aAchieved = userPoints >= a.points;
										const bAchieved = userPoints >= b.points;
										if (aAchieved && !bAchieved) return -1;
										if (!aAchieved && bAchieved) return 1;
										return a.points - b.points;
									}).map((cert) => {
										const isAchieved = userPoints >= cert.points;
										return (
											<div
												key={cert.id}
												className={`relative p-6 rounded-[2rem] border transition-all duration-500 overflow-hidden ${isAchieved
													? 'bg-white dark:bg-slate-900 border-indigo-500/30 shadow-lg shadow-indigo-500/5'
													: 'bg-slate-50/50 dark:bg-slate-900/30 border-transparent opacity-40 grayscale'}`}
											>
												<div className={`size-12 rounded-2xl flex items-center justify-center mb-4 ${isAchieved ? `bg-indigo-600 text-white` : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>
													{cert.icon}
												</div>
												<h4 className="font-black text-sm dark:text-white uppercase tracking-tight mb-1">{cert.name}</h4>
												<p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
													{isAchieved ? 'ĐÃ ĐẠT ĐƯỢC' : `CẦN ${cert.points} PTS`}
												</p>
												{isAchieved && (
													<div className="absolute top-4 right-4 text-emerald-500 scale-75 animate-in zoom-in duration-500">
														<CheckCircle size={20} />
													</div>
												)}
											</div>
										);
									})}
								</div>
							</div>

							<div className="flex items-center justify-between mb-8">
								<h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-[4px]">Danh sách bài thi</h3>
								{auth.currentUser?.email === 'dunvex.green@gmail.com' && (
									<button
										onClick={handleGenerateAITraining}
										disabled={generatingAI}
										className="flex items-center gap-2 bg-slate-900 dark:bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50"
									>
										{generatingAI ? <RefreshCcw className="animate-spin" size={16} /> : <BrainCircuit size={16} />} 
										Tạo bài thi AI mới
									</button>
								)}
							</div>

							{/* Labs List */}
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
								{[...labs, ...customLabs].map((lab) => (
									<div
										key={lab.id}
										className="group bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 hover:shadow-2xl hover:border-indigo-500/30 transition-all duration-500 cursor-pointer flex flex-col"
										onClick={() => navigate(`/khoa-dao-tao/${lab.id}`)}
									>
										<div className="size-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-inner">
											{lab.isAI ? <BrainCircuit className="text-indigo-600" size={32} /> : (lab.icon || <CheckCircle size={32} />)}
										</div>
										<h3 className="text-xl font-black text-slate-800 dark:text-white mb-3 tracking-tight group-hover:text-indigo-600 transition-colors">{lab.title}</h3>
										<p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-6 flex-1">{lab.description}</p>

										<div className="flex items-center gap-4 mb-8 pt-6 border-t border-slate-50 dark:border-slate-800">
											<div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
												<Clock size={14} />
												<span className="text-[10px] font-black uppercase">{lab.duration}</span>
											</div>
											<div className="flex items-center gap-1.5 text-emerald-500">
												<Award size={14} />
												<span className="text-[10px] font-black uppercase">{labProgress[lab.id]?.points || 0}/{lab.points} PTS</span>
											</div>
											<div className="ml-auto bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
												{lab.difficulty}
											</div>
										</div>

										<div className="flex items-center justify-between">
											<div className="flex -space-x-3">
												{[1, 2, 3].map(i => (
													<div key={i} className="size-8 rounded-full border-2 border-white dark:border-slate-900 bg-indigo-50 dark:bg-slate-800 overflow-hidden shadow-sm">
														<img
															src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${lab.id}${i}&backgroundColor=b6e3f4,c0aede,d1d4f9`}
															alt="user"
															className="size-full object-cover"
														/>
													</div>
												))}
												<div className="size-8 rounded-full border-2 border-white dark:border-slate-900 bg-indigo-600 text-[9px] font-black text-white flex items-center justify-center shadow-sm z-10">+12</div>
											</div>
											<div className="flex items-center gap-3">
												{lab.isAI && auth.currentUser?.email?.toLowerCase() === 'dunvex.green@gmail.com' && (
													<button 
														onClick={(e) => handleDeleteLab(lab.id, e)}
														className="p-2.5 text-slate-400 hover:text-white hover:bg-rose-500 rounded-xl transition-all duration-300 shadow-sm hover:shadow-rose-500/30 group/trash"
														title="Xóa bài học"
													>
														<Trash2 size={18} className="group-hover/trash:scale-110 transition-transform" />
													</button>
												)}
												<div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-widest group-hover:translate-x-2 transition-transform">
													Bắt đầu Lab <Play size={14} fill="currentColor" />
												</div>
											</div>
										</div>
									</div>
								))}
							</div>
						</>
					) : (
						<div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
							<div className="flex items-center justify-between mb-8">
								<div>
									<h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-[4px]">Video Hướng dẫn</h3>
									<p className="text-xs text-slate-400 font-medium">Học cách sử dụng Dunvex Build qua các video chi tiết.</p>
								</div>
								{!showVideoForm && !isVerifying && (
									<button
										onClick={() => setIsVerifying(true)}
										className="flex items-center gap-2 bg-[#1A237E] text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition-all"
									>
										<Settings size={16} /> Cập nhật Video
									</button>
								)}
							</div>

							{isVerifying ? (
								<div className="max-w-md mx-auto bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-10 shadow-xl">
									<div className="flex flex-col items-center text-center mb-8">
										<div className="size-16 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center text-amber-500 mb-6">
											<Lock size={32} />
										</div>
										<h4 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2">Xác thực quyền hạn</h4>
										<p className="text-xs font-medium text-slate-500 leading-relaxed">
											Bạn đang truy cập vào khu vực quản trị nội dung quốc tế. Vui lòng lấy mã xác minh từ email hệ thống để tiếp tục.
										</p>
									</div>

									<div className="space-y-6">
										{!generatedCode ? (
											<button
												onClick={handleSendCode}
												disabled={sendingCode}
												className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
											>
												{sendingCode ? 'Đang gửi...' : <><Mail size={16} /> Gửi mã về dunvex.green@gmail.com</>}
											</button>
										) : (
											<>
												<div className="space-y-2">
													<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nhập mã 6 chữ số</label>
													<input
														type="text"
														maxLength={6}
														value={inputPasscode}
														onChange={(e) => setInputPasscode(e.target.value.replace(/\D/g, ''))}
														className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-6 py-4 text-center text-2xl font-black tracking-[1em] text-indigo-600 focus:border-indigo-500 outline-none transition-all placeholder:tracking-normal placeholder:text-slate-300"
														placeholder="••••••"
													/>
												</div>
												<div className="flex gap-4">
													<button
														onClick={() => { setIsVerifying(false); resetForm(); }}
														className="flex-1 py-4 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all hover:bg-slate-100"
													>
														Hủy
													</button>
													<button
														onClick={handleVerifyPasscode}
														className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all"
													>
														Xác thực
													</button>
												</div>
											</>
										)}
									</div>
								</div>
							) : showVideoForm ? (
								<div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-indigo-500/30 p-8 mb-12 shadow-xl animate-in zoom-in-95 duration-300">
									<div className="flex items-center justify-between mb-8">
										<h4 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">
											{editingVideo ? 'Chỉnh sửa Video' : 'Thêm Video Hướng dẫn Mới'}
										</h4>
										<button onClick={resetForm} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
											<X size={24} />
										</button>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
										<div className="space-y-2">
											<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tiêu đề video</label>
											<input
												type="text"
												value={videoTitle}
												onChange={(e) => setVideoTitle(e.target.value)}
												className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-6 py-4 text-sm font-bold text-slate-800 dark:text-white focus:border-indigo-500 outline-none transition-all"
												placeholder="Ví dụ: Cách chốt đơn hàng nhanh"
											/>
										</div>
										<div className="space-y-2">
											<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Link YouTube</label>
											<input
												type="text"
												value={videoUrl}
												onChange={(e) => setVideoUrl(e.target.value)}
												className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-6 py-4 text-sm font-bold text-slate-800 dark:text-white focus:border-indigo-500 outline-none transition-all"
												placeholder="https://www.youtube.com/watch?v=..."
											/>
										</div>
									</div>

									<div className="flex justify-end gap-4">
										<button
											onClick={resetForm}
											className="px-8 py-4 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all hover:bg-slate-100"
										>
											Hủy bỏ
										</button>
										<button
											onClick={handleSaveVideo}
											disabled={isSaving}
											className="px-10 py-4 bg-[#1A237E] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition-all flex items-center gap-2 disabled:opacity-50"
										>
											{isSaving ? 'Đang lưu...' : <><Save size={18} /> {editingVideo ? 'Cập nhật' : 'Đăng video'}</>}
										</button>
									</div>
								</div>
							) : null}

							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
								{videos.map((video) => (
									<div
										key={video.id}
										className="group bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500"
									>
										<div className="relative aspect-video overflow-hidden">
											<img
												src={video.thumbnail}
												alt={video.title}
												className="size-full object-cover group-hover:scale-110 transition-transform duration-700"
											/>
											<div
												onClick={() => setPlayingVideo(video)}
												className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-black text-xs uppercase tracking-widest cursor-pointer"
											>
												<Play size={32} fill="white" /> Xem Video
											</div>
											{showVideoForm && (
												<div className="absolute top-4 right-4 flex gap-2">
													<button
														onClick={(e) => {
															e.stopPropagation();
															setEditingVideo(video);
															setVideoTitle(video.title);
															setVideoUrl(video.url);
															setShowVideoForm(true);
														}}
														className="size-10 bg-white dark:bg-slate-800 rounded-xl shadow-lg flex items-center justify-center text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all transform hover:scale-110"
													>
														<Edit2 size={18} />
													</button>
													<button
														onClick={(e) => {
															e.stopPropagation();
															handleDeleteVideo(video.id);
														}}
														className="size-10 bg-white dark:bg-slate-800 rounded-xl shadow-lg flex items-center justify-center text-rose-500 hover:bg-rose-500 hover:text-white transition-all transform hover:scale-110"
													>
														<Trash2 size={18} />
													</button>
												</div>
											)}
										</div>
										<div className="p-6">
											<div className="flex items-start justify-between gap-4 mb-2">
												<h5 className="font-black text-slate-800 dark:text-white leading-tight group-hover:text-indigo-600 transition-colors uppercase tracking-tight line-clamp-2">
													{video.title}
												</h5>
												<div className="text-slate-400">
													<ExternalLink size={16} />
												</div>
											</div>
											<div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
												<Youtube size={12} className="text-rose-500" /> YouTube Video
											</div>
										</div>
									</div>
								))}

								{videos.length === 0 && !loadingVideos && (
									<div className="col-span-full py-20 bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center text-center">
										<div className="size-20 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center text-slate-300 mb-6">
											<Youtube size={40} />
										</div>
										<h4 className="text-lg font-black text-slate-400 uppercase tracking-widest">Chưa có video hướng dẫn</h4>
										<p className="text-xs font-medium text-slate-400">Vui lòng quay lại sau hoặc liên hệ quản trị viên.</p>
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Video Player Modal */}
			{playingVideo && (
				<div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
					<div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setPlayingVideo(null)}></div>
					<div className="relative w-full max-w-5xl aspect-video bg-black rounded-[2rem] md:rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 border border-white/10">
						<button
							onClick={() => setPlayingVideo(null)}
							className="absolute top-4 right-4 md:top-8 md:right-8 z-10 size-10 md:size-14 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white transition-all transform hover:rotate-90"
						>
							<X size={28} />
						</button>
						<iframe
							src={`https://www.youtube.com/embed/${playingVideo.youtubeId}?autoplay=1`}
							className="size-full border-none"
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
							allowFullScreen
						></iframe>
					</div>
				</div>
			)}
		</div>
	);
};

export default TrainingCatalog;
