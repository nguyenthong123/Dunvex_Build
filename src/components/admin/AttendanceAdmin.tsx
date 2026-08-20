import React, { useState, useMemo, useEffect } from 'react';
import { ExternalLink, X, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

export const AttendanceAdmin = ({ logs, fieldLogs, companyInfo, setCompanyInfo, onSave, error }: { logs: any[], fieldLogs: any[], companyInfo: any, setCompanyInfo: any, onSave: any, error?: string | null }) => {
	const [viewerEmail, setViewerEmail] = useState('');
	const [startDate, setStartDate] = useState('');
	const [endDate, setEndDate] = useState('');
	const [currentPage, setCurrentPage] = useState(1);

	// Hiển thị lỗi nếu query Firestore thất bại
	if (error) {
		return (
			<div className="flex flex-col items-center justify-center p-12 text-center">
				<div className="bg-amber-500/10 p-6 rounded-full text-amber-500 mb-4 border border-amber-500/20">
					<AlertTriangle size={48} />
				</div>
				<h3 className="text-lg font-black text-slate-800 dark:text-white mb-2">Đang gặp sự cố kết nối</h3>
				<p className="text-sm text-slate-500 max-w-md mb-6">{error}</p>
				<p className="text-xs text-slate-400 mb-4">Vui lòng tạo composite index trong Firebase Console:<br/><code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-[10px]">attendance_logs: ownerId ASC, createdAt DESC</code></p>
				<button onClick={() => window.location.reload()} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm">Thử lại</button>
			</div>
		);
	}
	const rowsPerPage = 10;

	// Aggregate data by User and Date
	const aggregatedData = useMemo(() => {
		const data: any = {};

		// 1. Process Office Logs & Requests
		logs.forEach(log => {
			const key = `${log.userEmail}_${log.date}`;
			if (!data[key]) data[key] = {
				userName: log.userName,
				userEmail: log.userEmail,
				date: log.date,
				officeIn: null,
				officeOut: null,
				fieldFirst: null,
				fieldLast: null,
				requests: [],
				status: 'on-time'
			};

			if (log.type === 'request') {
				data[key].requests.push(log);
			} else {
				if (log.checkInAt) data[key].officeIn = log.checkInAt;
				if (log.checkOutAt) data[key].officeOut = log.checkOutAt;
				if (log.status === 'late') data[key].status = 'late';
			}
		});

		// 2. Process Field Checkins
		fieldLogs.forEach(f => {
			const date = f.createdAt?.seconds ? new Date(f.createdAt.seconds * 1000).toISOString().split('T')[0] : '';
			if (!date) return;
			const key = `${f.userEmail}_${date}`;

			if (!data[key]) data[key] = {
				userName: f.userName || f.userEmail,
				userEmail: f.userEmail,
				date: date,
				officeIn: null,
				officeOut: null,
				fieldFirst: f.createdAt,
				fieldLast: f.createdAt,
				requests: [],
				status: 'field-trip'
			}; else {
				if (!data[key].fieldFirst || f.createdAt.seconds < data[key].fieldFirst.seconds) data[key].fieldFirst = f.createdAt;
				if (!data[key].fieldLast || f.createdAt.seconds > data[key].fieldLast.seconds) data[key].fieldLast = f.createdAt;
			}
		});

		const result = Object.values(data).sort((a: any, b: any) => b.date.localeCompare(a.date));

		// 3. Filter by Date Range
		return result.filter((item: any) => {
			if (startDate && item.date < startDate) return false;
			if (endDate && item.date > endDate) return false;
			return true;
		});
	}, [logs, fieldLogs, startDate, endDate]);

	const totalPages = Math.ceil(aggregatedData.length / rowsPerPage);
	const paginatedData = aggregatedData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

	useEffect(() => {
		setCurrentPage(1);
	}, [startDate, endDate]);

	const addViewer = () => {
		if (!viewerEmail || !viewerEmail.includes('@')) return;
		const newList = [...(companyInfo.attendanceViewers || []), viewerEmail];
		setCompanyInfo({ ...companyInfo, attendanceViewers: newList });
		setViewerEmail('');
	};

	const removeViewer = (email: string) => {
		const newList = companyInfo.attendanceViewers.filter((e: string) => e !== email);
		setCompanyInfo({ ...companyInfo, attendanceViewers: newList });
	};

	if (error) {
		return (
			<div className="flex flex-col items-center justify-center p-12 text-center">
				<div className="bg-amber-500/10 p-6 rounded-full text-amber-500 mb-4 border border-amber-500/20">
					<AlertTriangle size={48} />
				</div>
				<h3 className="text-lg font-black text-slate-800 dark:text-white mb-2">Đang gặp sự cố kết nối</h3>
				<p className="text-sm text-slate-500 max-w-md mb-6">{error}</p>
				<p className="text-xs text-slate-400 mb-4">Vui lòng tạo composite index trong Firebase Console:<br/><code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-[10px]">attendance_logs: ownerId ASC, createdAt DESC</code></p>
				<button onClick={() => window.location.reload()} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm">Thử lại</button>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Sharing Header */}
			<div className="bg-white dark:bg-slate-900 rounded-[2rem] p-4 md:p-6 shadow-sm border border-slate-100 dark:border-slate-800">
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
					<div>
						<h3 className="font-bold dark:text-white uppercase text-[10px] md:text-sm tracking-widest flex items-center gap-2">
							<ExternalLink size={18} className="text-indigo-600" /> Chia sẻ bảng công
						</h3>
						<p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Cho phép Kế toán/Quản lý truy cập</p>
					</div>
					<div className="flex flex-col sm:flex-row gap-2">
						<input
							type="email"
							placeholder="Email người xem..."
							className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2.5 text-xs font-bold outline-none ring-2 ring-transparent focus:ring-indigo-500/20 flex-1 md:w-64"
							value={viewerEmail}
							onChange={(e) => setViewerEmail(e.target.value)}
						/>
						<div className="flex gap-2">
							<button onClick={addViewer} className="flex-1 sm:flex-none bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all">Thêm</button>
							<button onClick={onSave} className="flex-1 sm:flex-none bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all">Lưu</button>
						</div>
					</div>
				</div>
				{companyInfo.attendanceViewers?.length > 0 && (
					<div className="mt-4 flex flex-wrap gap-2">
						{companyInfo.attendanceViewers.map((email: string) => (
							<span key={email} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
								{email}
								<button onClick={() => removeViewer(email)} className="text-red-500 hover:scale-110 transition-transform"><X size={14} /></button>
							</span>
						))}
					</div>
				)}
			</div>

			<div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
				<div className="p-4 md:p-6 border-b border-slate-50 dark:border-slate-800 flex flex-col lg:flex-row justify-between lg:items-center gap-4">
					<div>
						<h3 className="font-bold dark:text-white uppercase text-[10px] md:text-sm tracking-widest font-['Manrope']">Nhật ký Tổng hợp (Văn phòng & Thị trường)</h3>
						<p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
							Hiển thị {paginatedData.length}/{aggregatedData.length} bản ghi
						</p>
					</div>

					<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
						<div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-700 flex-1">
							<span className="text-[9px] font-black text-slate-400 uppercase min-w-[30px]">Từ</span>
							<input
								type="date"
								className="bg-transparent border-none text-xs font-bold outline-none dark:text-white dark:color-scheme-dark flex-1"
								value={startDate}
								onChange={(e) => setStartDate(e.target.value)}
							/>
						</div>
						<div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-700 flex-1">
							<span className="text-[9px] font-black text-slate-400 uppercase min-w-[30px]">Đến</span>
							<input
								type="date"
								className="bg-transparent border-none text-xs font-bold outline-none dark:text-white dark:color-scheme-dark flex-1"
								value={endDate}
								onChange={(e) => setEndDate(e.target.value)}
							/>
						</div>
					</div>
				</div>
				{/* Desktop View */}
				<div className="hidden md:block overflow-x-auto custom-scrollbar">
					<table className="w-full text-left min-w-[1000px]">
						<thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-400">
							<tr>
								<th className="px-6 py-4">Nhân viên</th>
								<th className="px-6 py-4">Ngày</th>
								<th className="px-6 py-4 text-center">Văn phòng (Vào/Ra)</th>
								<th className="px-6 py-4 text-center">Thị trường (Đầu/Cuối)</th>
								<th className="px-6 py-4">Đăng ký / Lý do</th>
								<th className="px-6 py-4">Trạng thái</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
							{paginatedData.length === 0 ? (
								<tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold uppercase text-xs">Chưa có nhật ký hoạt động</td></tr>
							) : paginatedData.map((row: any) => (
								<tr key={`${row.userEmail}_${row.date}`} className="text-sm hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
									<td className="px-6 py-4">
										<div className="font-bold dark:text-white">{row.userName}</div>
										<div className="text-[10px] text-slate-400">{row.userEmail}</div>
									</td>
									<td className="px-6 py-4 font-black text-slate-600 dark:text-slate-400">{row.date}</td>
									<td className="px-6 py-4">
										<div className="flex items-center justify-center gap-2">
											<span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${row.officeIn ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-300'}`}>
												In: {row.officeIn ? new Date(row.officeIn.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
											</span>
											<span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${row.officeOut ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-300'}`}>
												Out: {row.officeOut ? new Date(row.officeOut.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
											</span>
										</div>
									</td>
									<td className="px-6 py-4">
										<div className="flex items-center justify-center gap-2">
											<span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${row.fieldFirst ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-300'}`}>
												{row.fieldFirst ? new Date(row.fieldFirst.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
											</span>
											<span className="text-slate-200">→</span>
											<span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${row.fieldLast ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-300'}`}>
												{row.fieldLast ? new Date(row.fieldLast.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
											</span>
										</div>
									</td>
									<td className="px-6 py-4 max-w-[200px]">
										{row.requests.length > 0 ? (
											<div className="space-y-1">
												{row.requests.map((req: any, i: number) => (
													<div key={i} className="flex flex-col">
														<span className={`text-[9px] font-black uppercase ${req.requestType === 'leave' ? 'text-red-500' : 'text-amber-500'}`}>
															{req.requestType === 'leave' ? 'Nghỉ phép' : 'Đi muộn'}
														</span>
														<p className="text-[10px] italic text-slate-500 line-clamp-1" title={req.note}>{req.note}</p>
													</div>
												))}
											</div>
										) : <span className="text-slate-300">---</span>}
									</td>
									<td className="px-6 py-4">
										<span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase 
											${row.status === 'on-time' ? 'bg-emerald-100 text-emerald-600' :
												row.status === 'late' ? 'bg-rose-100 text-rose-600' :
													row.status === 'field-trip' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
											{row.status === 'on-time' ? 'Đúng giờ' :
												row.status === 'late' ? 'Đi trễ' :
													row.status === 'field-trip' ? 'Thị trường' : 'N/A'}
										</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* Mobile View */}
				<div className="md:hidden space-y-4">
					{paginatedData.length === 0 ? (
						<div className="text-center py-12 text-slate-400 font-bold uppercase text-xs bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">Chưa có nhật ký hoạt động</div>
					) : (
						paginatedData.map((row: any) => (
							<div key={`${row.userEmail}_${row.date}`} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
								<div className="flex justify-between items-start">
									<div>
										<div className="font-bold text-sm dark:text-white">{row.userName}</div>
										<div className="text-[10px] text-slate-400">{row.userEmail}</div>
									</div>
									<span className="font-black text-xs text-slate-650 dark:text-slate-400">{row.date}</span>
								</div>

								<div className="grid grid-cols-2 gap-3 text-center">
									<div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl space-y-1.5">
										<div className="text-[9px] text-slate-400 uppercase font-black">Văn phòng</div>
										<div className="flex flex-col gap-1 items-center">
											<span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.officeIn ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-300'}`}>
												Vào: {row.officeIn ? new Date(row.officeIn.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
											</span>
											<span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.officeOut ? 'bg-orange-50 text-orange-600' : 'bg-slate-100 text-slate-300'}`}>
												Ra: {row.officeOut ? new Date(row.officeOut.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
											</span>
										</div>
									</div>
									
									<div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl space-y-1.5">
										<div className="text-[9px] text-slate-400 uppercase font-black">Thị trường</div>
										<div className="flex flex-col gap-1 items-center">
											<span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.fieldFirst ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-300'}`}>
												Đầu: {row.fieldFirst ? new Date(row.fieldFirst.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
											</span>
											<span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.fieldLast ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-300'}`}>
												Cuối: {row.fieldLast ? new Date(row.fieldLast.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
											</span>
										</div>
									</div>
								</div>

								{row.requests.length > 0 && (
									<div className="bg-amber-50/50 dark:bg-amber-950/20 p-2.5 rounded-xl space-y-1">
										<div className="text-[9px] text-amber-600 dark:text-amber-400 uppercase font-black">Đơn từ / Lý do</div>
										{row.requests.map((req: any, i: number) => (
											<div key={i} className="flex justify-between items-center text-[10px]">
												<span className="font-extrabold text-amber-700 dark:text-amber-500">
													{req.requestType === 'leave' ? 'Nghỉ phép' : 'Đi muộn'}
												</span>
												<span className="italic text-slate-500 line-clamp-1">{req.note}</span>
											</div>
										))}
									</div>
								)}

								<div className="flex justify-between items-center pt-3 border-t border-slate-50 dark:border-slate-800/50">
									<span className="text-[10px] text-slate-450 uppercase font-bold">Trạng thái</span>
									<span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter 
										${row.status === 'on-time' ? 'bg-emerald-100 text-emerald-600' :
											row.status === 'late' ? 'bg-rose-100 text-rose-600' :
												row.status === 'field-trip' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
										{row.status === 'on-time' ? 'Đúng giờ' :
											row.status === 'late' ? 'Đi trễ' :
												row.status === 'field-trip' ? 'Thị trường' : 'N/A'}
									</span>
								</div>
							</div>
						))
					)}
				</div>

				{/* Pagination Footer */}
				{totalPages > 1 && (
					<div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
						<p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
							Trang {currentPage} / {totalPages}
						</p>
						<div className="flex items-center gap-2">
							<button
								onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
								disabled={currentPage === 1}
								className="p-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-slate-500 disabled:opacity-50 hover:bg-slate-50 transition-all shadow-sm"
							>
								<ChevronLeft size={16} />
							</button>
							<button
								onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
								disabled={currentPage === totalPages}
								className="p-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-slate-500 disabled:opacity-50 hover:bg-slate-50 transition-all shadow-sm"
							>
								<ChevronRight size={16} />
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
