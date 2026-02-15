import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Award, Clock, Play, CheckCircle, Star, BrainCircuit, ShieldHalf, Trophy, Medal, Crown } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useOwner } from '../hooks/useOwner';

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
	const owner = useOwner();
	const [userPoints, setUserPoints] = useState(0);
	const [labProgress, setLabProgress] = useState<Record<string, any>>({});

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

			<div className="flex-1 overflow-y-auto p-4 md:p-10">
				<div className="max-w-6xl mx-auto">
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

						<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

					{/* Labs List */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
						{labs.map((lab) => (
							<div
								key={lab.id}
								className="group bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 hover:shadow-2xl hover:border-indigo-500/30 transition-all duration-500 cursor-pointer flex flex-col"
								onClick={() => navigate(`/khoa-dao-tao/${lab.id}`)}
							>
								<div className="size-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-inner">
									{lab.icon}
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
									<div className="flex -space-x-2">
										{[1, 2, 3].map(i => (
											<div key={i} className="size-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-800 overflow-hidden">
												<img src={`https://i.pravatar.cc/150?u=${lab.id}${i}`} alt="user" className="size-full object-cover" />
											</div>
										))}
										<div className="size-8 rounded-full border-2 border-white dark:border-slate-900 bg-indigo-600 text-[10px] font-black text-white flex items-center justify-center">+12</div>
									</div>
									<div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest group-hover:translate-x-2 transition-transform">
										Bắt đầu Lab <Play size={14} fill="currentColor" />
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
};

export default TrainingCatalog;
