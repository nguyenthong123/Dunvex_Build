import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import {
	FileSpreadsheet, Upload, Link as LinkIcon, Download,
	Printer, Search, Trash2, Globe, ArrowLeft, Building2,
	Phone, Mail, MapPin, Hash, Info, RefreshCw, QrCode,
	Calendar, User, ChevronRight, Maximize2, Check, Save
} from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';
import { useOwner } from '../hooks/useOwner';

const PriceList = () => {
	const navigate = useNavigate();
	const owner = useOwner();
	const [loading, setLoading] = useState(true);
	const [importing, setImporting] = useState(false);
	const [companyInfo, setCompanyInfo] = useState<any>(null);
	const [priceData, setPriceData] = useState<any[]>([]);
	const [headers, setHeaders] = useState<string[]>([]);
	const [searchTerm, setSearchTerm] = useState('');
	const [showImportModal, setShowImportModal] = useState(false);
	const [importMethod, setImportMethod] = useState<'file' | 'link'>('file');
	const [sheetUrl, setSheetUrl] = useState('');
	const fileInputRef = useRef<HTMLInputElement>(null);

	// New states
	const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
	const [priceLists, setPriceLists] = useState<any[]>([]);
	const [selectedList, setSelectedList] = useState<any>(null);
	const [zoomScale, setZoomScale] = useState(1); // 0.6, 0.85, 1.0
	const [isDesktopLayout, setIsDesktopLayout] = useState(true);

	useEffect(() => {
		if (owner.loading || !owner.ownerId) return;

		// 1. Get Company Info
		const fetchSettings = async () => {
			const settingsRef = doc(db, 'settings', owner.ownerId);
			const settingsSnap = await getDoc(settingsRef);
			if (settingsSnap.exists()) {
				setCompanyInfo(settingsSnap.data());
			}
		};
		fetchSettings();

		// 2. Fetch Price Lists (Both Legacy ID-based and New Field-based)
		const q = query(
			collection(db, 'price_lists'),
			where('ownerId', '==', owner.ownerId)
		);

		// Listen to collection changes
		const unsubscribe = onSnapshot(q, async (snapshot) => {
			try {
				const collectionLists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

				// Also fetch legacy doc directly by ID
				const legacyRef = doc(db, 'price_lists', owner.ownerId);
				const legacySnap = await getDoc(legacyRef);

				let combined: any[] = [...collectionLists];

				if (legacySnap.exists()) {
					const legacyData = legacySnap.data();
					// Unique check to avoid double showing
					if (!combined.find(l => l.id === owner.ownerId || l.id === 'legacy')) {
						combined.push({
							id: 'legacy',
							title: 'Báo giá cũ (Gốc)',
							...legacyData
						});
					}
				}

				// Sort by updatedAt descending
				const sorted = combined.sort((a: any, b: any) => {
					const dateA = a.updatedAt?.seconds || (a.updatedAt instanceof Date ? a.updatedAt.getTime() / 1000 : 0);
					const dateB = b.updatedAt?.seconds || (b.updatedAt instanceof Date ? b.updatedAt.getTime() / 1000 : 0);
					return dateB - dateA;
				});

				setPriceLists(sorted);
				setLoading(false);
			} catch (err) {
				console.error("Error merging lists:", err);
				setLoading(false);
			}
		});

		return () => unsubscribe();
	}, [owner.loading, owner.ownerId]);

	const handleSelectList = (list: any) => {
		setSelectedList(list);
		setPriceData(list.items || []);
		setHeaders(list.headers || []);
		setViewMode('detail');

		setIsDesktopLayout(true);
		// Auto calculate zoom to fit screen width
		const screenWidth = window.innerWidth;
		const targetWidth = 1000;
		const padding = 32;
		const fitScale = (screenWidth - padding) / targetWidth;
		setZoomScale(Math.min(1, Math.max(0.3, fitScale)));
	};

	const processRawData = (jsonData: any[][]) => {
		if (jsonData.length < 1) return;

		const rawHeaders = (jsonData[0] as any[]).map(h => String(h || '').trim());
		const rawRows = jsonData.slice(1);

		const mappedData = rawRows.map((row: any[]) => {
			const obj: any = {};
			rawHeaders.forEach((header, idx) => {
				obj[header] = row[idx] !== undefined && row[idx] !== null ? row[idx] : '';
			});
			return obj;
		}).filter(row => Object.values(row).some(v => v !== '')); // Skip empty rows

		setPriceData(mappedData);
		setHeaders(rawHeaders);
		setSelectedList({ items: mappedData, headers: rawHeaders, isUnsaved: true });
		setViewMode('detail');

		setIsDesktopLayout(true);
		const screenWidth = window.innerWidth;
		const targetWidth = 1000;
		const padding = 32;
		const fitScale = (screenWidth - padding) / targetWidth;
		setZoomScale(Math.min(1, Math.max(0.3, fitScale)));

		setShowImportModal(false);
	};

	const savePriceList = async (items: any[], headers: string[]) => {
		if (!owner.ownerId) return;

		const title = window.prompt("Nhập tên cho bản báo giá này:", `Báo giá cập nhật ${new Date().toLocaleDateString('vi-VN')}`);
		if (title === null) return; // Cancelled

		setImporting(true);
		try {
			const newList = {
				ownerId: owner.ownerId,
				items,
				headers,
				updatedAt: serverTimestamp(),
				updatedBy: auth.currentUser?.email,
				title: title || `Báo giá ${new Date().toLocaleString('vi-VN')}`
			};
			await addDoc(collection(db, 'price_lists'), newList);

			// Success - return to list view
			setViewMode('list');
			setSelectedList(null);
			setPriceData([]);
			setHeaders([]);
		} catch (error) {
			console.error("Error saving price list:", error);
			alert("Lỗi khi lưu báo giá.");
		} finally {
			setImporting(false);
		}
	};

	const handleDeleteList = async (e: React.MouseEvent, id: string) => {
		e.stopPropagation();
		if (!owner.ownerId) return;
		if (!window.confirm("Bạn có chắc chắn muốn xóa bản báo giá này?")) return;

		try {
			// If it's the legacy doc, the doc ID is actually the ownerId
			const targetId = id === 'legacy' ? owner.ownerId : id;
			await deleteDoc(doc(db, 'price_lists', targetId));

			// Force update local state for the virtual 'legacy' item
			if (id === 'legacy') {
				setPriceLists(prev => prev.filter(l => l.id !== 'legacy'));
			}
		} catch (error) {
			console.error("Error deleting price list:", error);
			alert("Không thể xóa bản báo giá này. Vui lòng thử lại sau.");
		}
	};

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setImporting(true);
		const reader = new FileReader();
		reader.onload = (event) => {
			try {
				const bstr = event.target?.result;
				const wb = XLSX.read(bstr, { type: 'binary' });
				const wsname = wb.SheetNames[0];
				const ws = wb.Sheets[wsname];
				const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
				processRawData(jsonData);
			} catch (err) {
				alert("Lỗi khi đọc file Excel.");
			} finally {
				setImporting(false);
			}
		};
		reader.readAsBinaryString(file);
	};

	const handleLinkImport = async () => {
		if (!sheetUrl) return;
		setImporting(true);
		try {
			const ssMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
			const gidMatch = sheetUrl.match(/gid=([0-9]+)/);
			if (!ssMatch) throw new Error("Link không hợp lệ");

			const ssId = ssMatch[1];
			const gid = gidMatch ? gidMatch[1] : '0';
			const exportUrl = `https://docs.google.com/spreadsheets/d/${ssId}/export?format=csv&gid=${gid}`;

			const response = await fetch(exportUrl);
			if (!response.ok) throw new Error("Không thể truy cập trang tính");

			const csvText = await response.text();
			const wb = XLSX.read(csvText, { type: 'string' });
			const wsname = wb.SheetNames[0];
			const ws = wb.Sheets[wsname];
			const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
			processRawData(jsonData);
		} catch (err: any) {
			alert(err.message || "Lỗi khi lấy dữ liệu.");
		} finally {
			setImporting(false);
		}
	};

	const handlePrint = () => {
		window.print();
	};

	const filteredData = priceData.filter(item =>
		Object.values(item).some(val =>
			String(val).toLowerCase().includes(searchTerm.toLowerCase())
		)
	);

	if (loading) return (
		<div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
			<div className="flex flex-col items-center gap-4">
				<RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
				<p className="text-sm font-black text-slate-400 uppercase tracking-widest">Đang tải báo giá...</p>
			</div>
		</div>
	);

	return (
		<div className="flex flex-col min-h-screen bg-slate-100 dark:bg-slate-950 transition-colors duration-300 print:bg-white print:p-0">
			{/* Header Actions - Hidden on Print */}
			<header className="h-14 md:h-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0 relative md:sticky top-0 z-[40] print:hidden transition-all duration-300">
				<div className="flex items-center gap-3 md:gap-4 flex-1 truncate">
					<button
						onClick={() => viewMode === 'detail' ? setViewMode('list') : navigate('/')}
						className="size-9 md:size-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all shadow-sm shrink-0"
					>
						<ArrowLeft size={18} />
					</button>
					<h2 className="text-xs md:text-xl font-black text-[#1A237E] dark:text-indigo-400 uppercase tracking-tighter truncate">
						{viewMode === 'list' ? 'Lịch sử báo giá' : (selectedList?.title || 'Chi tiết báo giá')}
					</h2>
				</div>

				<div className="flex items-center gap-2">
					{viewMode === 'detail' && (
						<div className="hidden lg:relative lg:block">
							<Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
							<input
								type="text"
								placeholder="Tìm kiếm sản phẩm..."
								className="pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm w-64 focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-white"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
							/>
						</div>
					)}

					{viewMode === 'list' && (
						<button
							onClick={() => setShowImportModal(true)}
							className="size-9 md:w-auto bg-[#FF6D00] text-white md:px-4 md:py-2.5 rounded-xl font-bold md:text-sm shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center justify-center gap-2"
							title="Cập nhật Data"
						>
							<Upload size={18} />
							<span className="hidden md:inline">Cập nhật Data</span>
						</button>
					)}

					{viewMode === 'detail' && (
						<div className="flex items-center gap-2">
							<button
								onClick={handlePrint}
								disabled={priceData.length === 0}
								className="size-9 md:w-32 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl flex items-center justify-center gap-2 font-bold text-sm hover:bg-slate-200 transition-all disabled:opacity-50"
								title="In Báo Giá"
							>
								<Printer size={16} />
								<span className="hidden md:inline">In Báo Giá</span>
							</button>

							{selectedList?.isUnsaved ? (
								<button
									onClick={() => savePriceList(priceData, headers)}
									className="size-9 md:w-auto bg-indigo-600 text-white md:px-6 md:py-2.5 rounded-xl font-black text-[10px] md:text-sm shadow-lg shadow-blue-500/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
								>
									<Save size={16} />
									<span className="hidden md:inline">Lưu</span>
								</button>
							) : (
								<button
									className="size-9 md:w-auto bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl flex items-center justify-center transition-all md:px-4 md:hidden"
									onClick={() => {
										if (navigator.share) {
											navigator.share({
												title: selectedList?.title,
												url: window.location.href
											}).catch(console.error);
										}
									}}
								>
									<Download size={16} />
								</button>
							)}
						</div>
					)}
				</div>
			</header>

			{/* PAGE CONTENT */}
			<main className={`flex-1 ${viewMode === 'detail' ? 'p-4 md:p-8' : 'p-4 md:p-12'} print:p-0 overflow-x-hidden transition-all duration-300`}>
				{viewMode === 'list' ? (
					<div className="max-w-4xl mx-auto space-y-6">
						<div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-1">
							<div>
								<h3 className="text-lg md:text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Danh sách vừa lưu</h3>
								<p className="text-[10px] md:text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Quản lý các bản báo giá của bạn</p>
							</div>
						</div>

						{priceLists.length === 0 ? (
							<div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-20 flex flex-col items-center justify-center text-center border border-slate-200 dark:border-slate-800 shadow-xl">
								<div className="size-20 bg-indigo-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center text-indigo-500 mb-6">
									<FileSpreadsheet size={40} />
								</div>
								<h4 className="text-xl font-black text-slate-800 dark:text-white uppercase mb-2">Chưa có bản báo giá nào</h4>
								<p className="text-slate-400 max-w-sm font-medium">Bắt đầu bằng cách tải lên file Excel hoặc link Google Sheets.</p>
								<button
									onClick={() => setShowImportModal(true)}
									className="mt-8 bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
								>
									Tải lên ngay
								</button>
							</div>
						) : (
							<div className="grid gap-4">
								{priceLists.map((list) => (
									<div
										key={list.id}
										onClick={() => handleSelectList(list)}
										className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-indigo-500/30 transition-all group cursor-pointer flex items-center justify-between"
									>
										<div className="flex items-center gap-5">
											<div className="size-10 md:size-14 bg-slate-50 dark:bg-slate-800 rounded-xl md:rounded-2xl flex items-center justify-center text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner shrink-0">
												<FileSpreadsheet className="w-5 h-5 md:w-7 md:h-7" />
											</div>
											<div className="min-w-0">
												<h4 className="font-black text-slate-800 dark:text-white text-sm md:text-lg group-hover:text-indigo-600 transition-colors truncate pr-2">{list.title}</h4>
												<div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
													<div className="flex items-center gap-1 text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-tighter md:tracking-widest">
														<Calendar size={10} className="md:w-3 md:h-3" />
														{list.updatedAt?.seconds ? new Date(list.updatedAt.seconds * 1000).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : 'Vừa xong'}
													</div>
													<div className="flex items-center gap-1 text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-tighter md:tracking-widest">
														<User size={10} className="md:w-3 md:h-3" />
														{list.updatedBy?.split('@')[0] || 'Admin'}
													</div>
												</div>
											</div>
										</div>
										<div className="flex items-center gap-2">
											<button
												onClick={(e) => handleDeleteList(e, list.id)}
												className="size-8 md:size-10 rounded-lg md:rounded-xl bg-rose-50 dark:bg-rose-900/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-sm shrink-0"
												title="Xóa báo giá"
											>
												<Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
											</button>
											<div className="size-8 md:size-10 rounded-lg md:rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:translate-x-1 transition-all shrink-0 hidden sm:flex">
												<ChevronRight size={18} />
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				) : (
					<div className="relative min-h-[800px] flex justify-center">
						{/* ZOOM CONTROLS - Floating Pill (Moved higher on mobile) */}
						<div className="fixed bottom-28 md:bottom-8 left-1/2 -translate-x-1/2 z-[60] bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-full p-1.5 flex items-center gap-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)] print:hidden scale-90 sm:scale-100 transition-all duration-500">
							{[0.6, 0.85, 1.0].map((scale) => (
								<button
									key={scale}
									onClick={() => setZoomScale(scale)}
									className={`px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest transition-all ${zoomScale === scale ? 'bg-white text-slate-900' : 'text-white/40 hover:text-white'}`}
								>
									{Math.round(scale * 100)}%
								</button>
							))}
							<div className="w-px h-4 bg-white/20 mx-2"></div>
							<button
								onClick={() => setIsDesktopLayout(!isDesktopLayout)}
								className={`p-2 rounded-full transition-all ${isDesktopLayout ? 'bg-indigo-600 text-white' : 'text-white/40 hover:text-white hover:bg-white/10'}`}
								title="Bật/Tắt chế độ xem máy tính"
							>
								<Maximize2 size={18} />
							</button>
						</div>

						<div
							className="origin-top transition-all duration-500 ease-out pb-40 md:pb-20 flex justify-center"
							style={{
								transform: `scale(${zoomScale})`,
								width: '1000px',
								minWidth: '1000px'
							}}
						>
							<div className="bg-white dark:bg-slate-900 shadow-2xl rounded-[3rem] overflow-hidden border border-slate-200 dark:border-slate-800 print:shadow-none print:rounded-none print:border-none w-full">

								{/* Báo giá Header */}
								<div className="p-12 bg-white border-b border-slate-50 relative">
									<div className="flex justify-between items-start gap-8">
										<div className="space-y-6">
											<div className="flex items-center gap-4">
												<div className="size-16 bg-[#5C5CFF] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20 shrink-0">
													<Building2 size={36} />
												</div>
												<h1 className="text-4xl font-black text-[#1A237E] uppercase tracking-tighter leading-tight">
													{companyInfo?.name || 'DUNVEX'}
												</h1>
											</div>

											<div className="space-y-2.5 pl-1">
												<div className="flex items-start gap-3 text-slate-500">
													<MapPin size={14} className="text-indigo-600 shrink-0 mt-0.5" />
													<span className="text-xs font-bold uppercase tracking-wide leading-tight">{companyInfo?.address || 'XÃ KIẾN ĐỨC , LÂM ĐỒNG'}</span>
												</div>
												<div className="flex items-center gap-6">
													<div className="flex items-center gap-2 text-slate-500">
														<Phone size={14} className="text-indigo-600" />
														<span className="text-sm font-bold">{companyInfo?.phone || '0988765444'}</span>
													</div>
													<div className="flex items-center gap-2 text-slate-500">
														<Mail size={14} className="text-indigo-600" />
														<span className="text-sm font-bold">{companyInfo?.email || 'dunvex.green@gmail.com'}</span>
													</div>
												</div>
											</div>
										</div>

										<div className="text-right">
											<h2 className="text-6xl font-normal text-[#1A237E] uppercase tracking-[0.2em] mb-1">Báo Giá</h2>
											<p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mb-8">Niêm Yết Hệ Thống</p>

											<div className="w-32 h-px bg-slate-100 ml-auto mb-4"></div>
											<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
												Ngày cập nhật: {selectedList?.updatedAt?.seconds ? new Date(selectedList.updatedAt.seconds * 1000).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN')}
											</p>
										</div>
									</div>
								</div>

								{/* Báo giá Body */}
								<div className="p-4 md:p-12 pt-6">
									<div className="overflow-x-auto print:overflow-visible -mx-4 px-4 custom-scrollbar">
										<table className="w-full text-left border-collapse min-w-[700px] md:min-w-full">
											<thead>
												<tr>
													<th className="py-6 px-4 text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em] border-b border-slate-100 text-center w-10">STT</th>
													{headers.map((header, idx) => (
														<th
															key={idx}
															className="py-6 px-4 text-[12px] font-black text-slate-950 uppercase tracking-[0.2em] border-b border-slate-100 whitespace-normal break-words"
														>
															{header}
														</th>
													))}
												</tr>
											</thead>
											<tbody className="divide-y divide-slate-50">
												{filteredData.map((row, rowIdx) => (
													<tr key={rowIdx} className="hover:bg-slate-50/50 transition-colors">
														<td className="py-6 px-4 text-[11px] font-black text-slate-200 text-center">{rowIdx + 1}</td>
														{headers.map((header, colIdx) => (
															<td
																key={colIdx}
																className={`py-6 px-4 text-[13px] font-bold whitespace-normal break-words ${colIdx === 0 ? 'text-[#1A237E] leading-relaxed w-[350px]' : 'text-slate-500'}`}
															>
																{row[header]?.toLocaleString() || '---'}
															</td>
														))}
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>

								{/* Footer Details */}
								<div className="p-12 bg-white border-t border-slate-50">
									<div className="flex flex-col md:flex-row justify-between items-end gap-8">
										<div className="max-w-xl space-y-4">
											<h4 className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">
												<Info size={14} /> Chính sách áp dụng
											</h4>
											<p className="text-[10px] font-bold text-slate-400 leading-relaxed italic opacity-80">
												* Báo giá trên là giá niêm yết chính thức, chưa bao gồm chiết khấu linh hoạt theo số lượng.
												Mọi thắc mắc vui lòng liên hệ trực tiếp hotline hoặc truy cập website công ty để biết thêm chi tiết.
											</p>
										</div>
										<div className="text-right space-y-3">
											<div className="size-24 bg-slate-50 rounded-3xl mx-auto md:ml-auto flex items-center justify-center text-slate-100">
												<QrCode size={48} />
											</div>
											<div>
												<p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Xác nhận bởi</p>
												<p className="text-lg font-black text-[#1A237E] uppercase tracking-tighter mt-0.5">{companyInfo?.name || 'DUNVEX'}</p>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}
			</main>

			{/* IMPORT MODAL */}
			{showImportModal && (
				<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
					<div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white/20 dark:border-slate-800 transition-colors">
						<div className="px-8 py-6 bg-indigo-600 dark:bg-slate-800 text-white flex items-center justify-between">
							<div className="flex items-center gap-3">
								<FileSpreadsheet size={24} />
								<h3 className="text-xl font-black uppercase tracking-tight">Cập Nhật Dữ Liệu Báo Giá</h3>
							</div>
							<button onClick={() => setShowImportModal(false)} className="size-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
								<Trash2 size={20} className="rotate-45" />
							</button>
						</div>

						<div className="p-8 space-y-8">
							<div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit mx-auto">
								<button
									onClick={() => setImportMethod('file')}
									className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${importMethod === 'file' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
								>
									File Excel
								</button>
								<button
									onClick={() => setImportMethod('link')}
									className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${importMethod === 'link' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
								>
									Google Sheets
								</button>
							</div>

							{importMethod === 'file' ? (
								<div
									className="flex flex-col items-center justify-center border-4 border-dashed border-slate-100 dark:border-slate-800 rounded-[3rem] p-12 hover:border-indigo-500/30 transition-all group cursor-pointer"
									onClick={() => fileInputRef.current?.click()}
								>
									<Upload size={48} className="text-indigo-500 mb-4 group-hover:-translate-y-2 transition-transform" />
									<p className="font-black text-slate-800 dark:text-white uppercase tracking-tight">Chọn hoặc kéo file Excel</p>
									<p className="text-xs text-slate-400 font-bold mt-1">Dữ liệu sẽ được tự động đồng bộ hóa</p>
									<input
										ref={fileInputRef}
										type="file"
										accept=".xlsx, .xls, .csv"
										className="hidden"
										onChange={handleFileUpload}
										disabled={importing}
									/>
								</div>
							) : (
								<div className="space-y-4">
									<div className="bg-slate-50 dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700">
										<div className="flex items-center gap-3 mb-6 text-emerald-500">
											<Globe size={24} />
											<h4 className="font-black uppercase text-xs tracking-widest">Dán link trang tính</h4>
										</div>
										<input
											type="text"
											placeholder="https://docs.google.com/spreadsheets/d/..."
											className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl py-4 px-6 text-sm font-bold dark:text-white outline-none focus:border-indigo-500 transition-all"
											value={sheetUrl}
											onChange={(e) => setSheetUrl(e.target.value)}
										/>
									</div>
									<button
										onClick={handleLinkImport}
										disabled={importing || !sheetUrl}
										className="w-full bg-indigo-600 text-white py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
									>
										{importing ? 'Đang kết nối...' : 'Lấy Dữ Liệu Ngay'}
									</button>
								</div>
							)}

							{importing && (
								<div className="flex items-center justify-center gap-3 text-indigo-600 animate-pulse font-black text-xs uppercase tracking-widest">
									<RefreshCw className="animate-spin" size={16} />
									Đang xử lý dữ liệu...
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default PriceList;
