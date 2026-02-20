import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { db, auth } from '../../services/firebase';
import { collection, writeBatch, doc, serverTimestamp, addDoc, getDocs, query, where } from 'firebase/firestore';
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download, Link as LinkIcon, Globe } from 'lucide-react';

interface BulkImportProps {
	type: 'customers' | 'products';
	ownerId: string;
	ownerEmail: string;
	onClose: () => void;
	onSuccess?: () => void;
}

interface FieldConfig {
	key: string;
	label: string;
	required?: boolean;
	type?: 'string' | 'number';
	default?: any;
}

const BulkImport: React.FC<BulkImportProps> = ({ type, ownerId, ownerEmail, onClose, onSuccess }) => {
	const [data, setData] = useState<any[]>([]);
	const [columns, setColumns] = useState<string[]>([]);
	const [loading, setLoading] = useState(false);
	const [importing, setImporting] = useState(false);
	const [step, setStep] = useState<1 | 2>(1); // 1: Upload, 2: Preview & Confirm
	const [error, setError] = useState<string | null>(null);
	const [importMethod, setImportMethod] = useState<'file' | 'link'>('file');
	const [sheetUrl, setSheetUrl] = useState('');
	const fileInputRef = useRef<HTMLInputElement>(null);

	const fieldConfig: Record<string, { title: string, fields: FieldConfig[] }> = {
		customers: {
			title: 'Khách hàng',
			fields: [
				{ key: 'name', label: 'Tên khách hàng', required: true, type: 'string' },
				{ key: 'phone', label: 'Số điện thoại', required: true, type: 'string' },
				{ key: 'businessName', label: 'Tên cơ sở', type: 'string' },
				{ key: 'type', label: 'Phân loại', default: 'Chủ nhà', type: 'string' },
				{ key: 'address', label: 'Địa chỉ', type: 'string' },
				{ key: 'lat', label: 'Vĩ độ (Lat)', type: 'number' },
				{ key: 'lng', label: 'Kinh độ (Lng)', type: 'number' },
				{ key: 'note', label: 'Ghi chú', type: 'string' }
			]
		},
		products: {
			title: 'Sản phẩm',
			fields: [
				{ key: 'name', label: 'Tên sản phẩm', required: true, type: 'string' },
				{ key: 'category', label: 'Danh mục', default: 'Khác', type: 'string' },
				{ key: 'priceBuy', label: 'Giá nhập', type: 'number', default: 0 },
				{ key: 'priceSell', label: 'Giá bán', type: 'number', required: true },
				{ key: 'stock', label: 'Tồn kho', type: 'number', default: 0 },
				{ key: 'unit', label: 'Đơn vị', default: 'Cái', type: 'string' },
				{ key: 'sku', label: 'Mã SKU', type: 'string' },
				{ key: 'specification', label: 'Quy cách', type: 'string' },
				{ key: 'packaging', label: 'Đóng gói', type: 'string' },
				{ key: 'density', label: 'Trọng lượng', type: 'string' },
				{ key: 'note', label: 'Ghi chú', type: 'string' }
			]
		}
	};

	const config = fieldConfig[type];

	const processRawData = (jsonData: any[][]) => {
		if (jsonData.length < 1) {
			throw new Error("Dữ liệu không hợp lệ hoặc trang tính trống.");
		}

		// Dynamically find the header row (first row with a "name" or equivalent column)
		let headerRowIndex = -1;
		const nameLabels = ['tên', 'name', 'sản phẩm', 'khách hàng'];

		for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
			const row = jsonData[i];
			if (!row) continue;
			const hasNameColumn = row.some(cell => {
				const val = String(cell || '').toLowerCase().trim();
				return nameLabels.some(label => val.includes(label));
			});
			if (hasNameColumn) {
				headerRowIndex = i;
				break;
			}
		}

		if (headerRowIndex === -1) {
			headerRowIndex = 0; // Fallback to first row
		}

		const headers = (jsonData[headerRowIndex] as any[]).map(h =>
			String(h || '').replace(/[\uFEFF\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase()
		);

		const rows = jsonData.slice(headerRowIndex + 1) as any[][];

		const mappedData = rows.map(row => {
			const obj: any = {};

			// Detect combined coordinates first (e.g., "12.357047, 107.924228")
			const coordColIndex = headers.findIndex(h =>
				h.includes('vị trí') || h.includes('coordinate') || h.includes('location')
			);

			if (coordColIndex !== -1) {
				const coordVal = String(row[coordColIndex] || '');
				if (coordVal.includes(',')) {
					const [lat, lng] = coordVal.split(',').map(s => Number(s.trim()));
					if (!isNaN(lat)) obj.lat = lat;
					if (!isNaN(lng)) obj.lng = lng;
				}
			}

			config.fields.forEach(field => {
				// Avoid overwriting lat/lng if already successfully parsed from combined column
				if ((field.key === 'lat' || field.key === 'lng') && obj[field.key] !== undefined) return;

				const colIndex = headers.findIndex(h => {
					const cleanH = h.replace(/\s/g, '');
					const cleanLabel = field.label.toLowerCase().replace(/\s/g, '');
					const cleanKey = field.key.toLowerCase();

					if (cleanH === cleanKey || cleanH === cleanLabel || cleanH.includes(cleanLabel) || cleanLabel.includes(cleanH)) return true;

					// Common Synonyms for 'name'
					if (field.key === 'name') {
						const nameSynonyms = ['họvàtên', 'fullname', 'têncơsở', 'tênkháchhàng', 'kháchhàng'];
						if (nameSynonyms.some(s => cleanH.includes(s) || s.includes(cleanH))) return true;
					}

					// Common Synonyms for 'phone'
					if (field.key === 'phone') {
						const phoneSynonyms = ['sđt', 'đt', 'điệnthoại', 'mobile', 'tel'];
						if (phoneSynonyms.some(s => cleanH.includes(s) || s.includes(cleanH))) return true;
					}

					// Common Synonyms for 'businessName'
					if (field.key === 'businessName') {
						const bizSynonyms = ['têncơsở', 'côngty', 'đơnvị', 'têncửahàng'];
						if (bizSynonyms.some(s => cleanH.includes(s) || s.includes(cleanH))) return true;
					}

					// Synonyms for 'category'
					if (field.key === 'category') {
						const catSynonyms = ['danhmục', 'ngànhhàng', 'loại', 'phânloại', 'nhóm', 'group', 'category'];
						if (catSynonyms.some(s => cleanH.includes(s) || s.includes(cleanH))) return true;
					}

					return false;
				});

				if (colIndex !== -1) {
					let val = row[colIndex];
					if (field.type === 'number') {
						if (typeof val === 'string') {
							// Remove currency units (đ, VND), and other non-numeric chars except separators
							let cleaned = val.replace(/[^0-9,.-]/g, '').trim();

							// Handle Vietnamese locale: 
							// 1. If it has BOTH comma and dot (1.234.567,89) -> Remove dots, use comma as dot
							if (cleaned.includes(',') && cleaned.includes('.')) {
								cleaned = cleaned.replace(/\./g, '').replace(',', '.');
							}
							// 2. If it has ONLY comma (1234,56) -> use comma as dot
							else if (cleaned.includes(',')) {
								cleaned = cleaned.replace(',', '.');
							}
							// 3. If it has ONLY dot (133.215) -> In VN, this is usually thousands
							// We can identify this if the dot is followed by 3 digits at the end
							else if (cleaned.includes('.') && /^\d+\.\d{3}$/.test(cleaned)) {
								cleaned = cleaned.replace(/\./g, '');
							}
							// If it looks like 123.456 (dot as thousands separator in VN) 
							// and it's for price fields, we might need caution.
							// But standard Number("123.456") treats dot as decimal.
							// For prices in VN, usually it's integer.

							val = Number(cleaned);
						}
						val = (val !== undefined && val !== null && !isNaN(Number(val))) ? Number(val) : (field.default || 0);
					} else {
						if (typeof val === 'number') {
							// Convert number to locale string to preserve decimal commas in UI
							val = val.toLocaleString('vi-VN');
						} else {
							val = val !== undefined && val !== null ? String(val).trim() : (field.default || '');
						}
					}
					obj[field.key] = val;
				} else {
					// Mark as missing so we don't overwrite during update
					obj[`_${field.key}_isMissing`] = true;
					if (obj[field.key] === undefined) {
						obj[field.key] = field.default || (field.type === 'number' ? 0 : '');
					}
				}
			});
			return obj;
		}).filter(row => row.name && String(row.name).length > 2);

		setColumns(config.fields.map(f => f.label));
		setData(mappedData);
		setStep(2);
	};

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setLoading(true);
		setError(null);

		const reader = new FileReader();
		reader.onload = (event) => {
			try {
				const bstr = event.target?.result;
				const wb = XLSX.read(bstr, { type: 'binary' });
				const wsname = wb.SheetNames[0];
				const ws = wb.Sheets[wsname];
				const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
				processRawData(jsonData);
			} catch (err: any) {
				setError(err.message || "Lỗi khi đọc file Excel.");
			} finally {
				setLoading(false);
			}
		};
		reader.onerror = () => {
			setError("Không thể đọc file.");
			setLoading(false);
		};
		reader.readAsBinaryString(file);
	};

	const handleLinkImport = async () => {
		if (!sheetUrl) return;

		setLoading(true);
		setError(null);

		try {
			// Extract spreadsheet ID and GID
			const ssMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
			const gidMatch = sheetUrl.match(/gid=([0-9]+)/);

			if (!ssMatch) {
				throw new Error("Link Google Sheets không đúng định dạng.");
			}

			const ssId = ssMatch[1];
			const gid = gidMatch ? gidMatch[1] : '0';

			// Try XLSX format first which is better for data types, but include GID
			const exportUrl = `https://docs.google.com/spreadsheets/d/${ssId}/export?format=xlsx&gid=${gid}`;

			const response = await fetch(exportUrl);
			if (!response.ok) {
				throw new Error("Không thể truy cập trang tính. Hãy chắc chắn bạn đã bật quyền 'Bất kỳ ai có liên kết đều có thể xem'.");
			}

			const arrayBuffer = await response.arrayBuffer();
			const wb = XLSX.read(arrayBuffer, { type: 'array' });

			// Select the sheet. Google normally returns the correct sheet even in XLSX if gid is provided,
			// but we fallback to Sheet 0 if it's the whole book.
			const wsname = wb.SheetNames[0];
			const ws = wb.Sheets[wsname];
			const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

			processRawData(jsonData);
		} catch (err: any) {
			setError(err.message || "Lỗi khi lấy dữ liệu từ Google Sheets.");
		} finally {
			setLoading(false);
		}
	};

	const handleImport = async () => {
		if (data.length === 0) return;
		setImporting(true);

		try {
			// 1. Fetch existing items to check for duplicates
			const q = query(collection(db, type), where('ownerId', '==', ownerId));
			const snapshot = await getDocs(q);
			const existingItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

			const batchSize = 500;
			const totalBatches = Math.ceil(data.length / batchSize);
			let totalUpdated = 0;
			let totalCreated = 0;

			const normalize = (s: string) => String(s || '').toLowerCase().replace(/[\s\u00A0]+/g, ' ').trim();

			for (let i = 0; i < totalBatches; i++) {
				const batch = writeBatch(db);
				const currentChunk = data.slice(i * batchSize, (i + 1) * batchSize);

				currentChunk.forEach(item => {
					// Check if item already exists
					let existingDocId = '';
					let existingItem: any = null;

					if (type === 'products') {
						// Priority 1: Match by SKU AND Category if provided in spreadsheet
						if (item.sku) {
							const cleanCat = normalize(item.category);
							existingItem = existingItems.find((e: any) =>
								String(e.sku) === String(item.sku) &&
								normalize(e.category) === cleanCat
							);
						}
						// Priority 2: Match by Name AND Category if SKU didn't match or wasn't provided
						if (!existingItem && item.name) {
							const cleanName = normalize(item.name);
							const cleanCat = normalize(item.category);
							existingItem = existingItems.find((e: any) =>
								normalize(e.name) === cleanName &&
								normalize(e.category) === cleanCat
							);
						}

						if (existingItem) existingDocId = existingItem.id;
					} else if (type === 'customers' && item.phone) {
						existingItem = existingItems.find((e: any) => e.phone === item.phone);
						if (existingItem) existingDocId = existingItem.id;
					}

					const docRef = existingDocId ? doc(db, type, existingDocId) : doc(collection(db, type));

					// Important: If updating and the new data has no SKU (e.g. column deleted), 
					// preserve the OLD SKU instead of setting it to empty.
					const finalItem = { ...item };
					if (existingDocId && !item.sku && existingItem.sku) {
						finalItem.sku = existingItem.sku;
					}

					const dataToSet: any = {
						ownerId,
						ownerEmail,
						[existingDocId ? 'updatedAt' : 'createdAt']: serverTimestamp(),
						[existingDocId ? 'updatedBy' : 'createdBy']: auth.currentUser?.uid,
						[existingDocId ? 'updatedByEmail' : 'createdByEmail']: auth.currentUser?.email,
						status: item.status || (type === 'customers' ? 'Hoạt động' : 'Kinh doanh')
					};

					// Only include fields that were actually in the spreadsheet if updating
					config.fields.forEach(f => {
						if (!existingDocId || !item[`_${f.key}_isMissing`]) {
							dataToSet[f.key] = item[f.key];
						}
					});

					// Remove internal tracking keys before saving
					Object.keys(dataToSet).forEach(k => {
						if (k.startsWith('_') && k.endsWith('_isMissing')) delete dataToSet[k];
					});

					if (existingDocId) {
						batch.update(docRef, dataToSet);
						totalUpdated++;
					} else {
						batch.set(docRef, dataToSet);
						totalCreated++;
					}
				});

				await batch.commit();
			}

			await addDoc(collection(db, 'audit_logs'), {
				action: `Nhập liệu hàng loạt ${config.title}`,
				user: auth.currentUser?.displayName || auth.currentUser?.email || 'Hệ thống',
				userId: auth.currentUser?.uid,
				ownerId,
				details: `Đã xử lý ${data.length} ${config.title}: Cập nhật ${totalUpdated}, Thêm mới ${totalCreated}`,
				createdAt: serverTimestamp()
			});

			onSuccess?.();
			onClose();
			alert(`Thành công! Đã cập nhật ${totalUpdated} và thêm mới ${totalCreated} ${config.title}.`);
		} catch (err: any) {
			console.error("Import error:", err);
			alert("Lỗi khi nhập dữ liệu: " + err.message);
		} finally {
			setImporting(false);
		}
	};

	const downloadTemplate = () => {
		const ws = XLSX.utils.json_to_sheet([
			config.fields.reduce((acc, f) => ({ ...acc, [f.label]: '' }), {})
		]);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, "Template");
		XLSX.writeFile(wb, `Template_Import_${type}.xlsx`);
	};

	return (
		<div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
			<div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20 dark:border-slate-800 animate-in zoom-in-95 duration-200">
				{/* Header */}
				<div className="px-8 py-6 bg-[#1A237E] dark:bg-slate-900 border-b border-white/10 flex items-center justify-between text-white transition-colors">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-white/10 rounded-xl">
							<FileSpreadsheet size={24} />
						</div>
						<div>
							<h3 className="text-xl font-black uppercase tracking-tight">Nhập liệu hàng loạt {config.title}</h3>
							<p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Excel / Google Sheets Import</p>
						</div>
					</div>
					<button onClick={onClose} className="size-10 rounded-full bg-white/10 hover:bg-rose-500 flex items-center justify-center transition-all group">
						<X size={20} className="group-hover:rotate-90 transition-transform" />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
					{step === 1 ? (
						<div className="space-y-8">
							{/* Method Selector */}
							<div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
								<button
									onClick={() => setImportMethod('file')}
									className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${importMethod === 'file' ? 'bg-white dark:bg-slate-900 text-[#1A237E] shadow-sm' : 'text-slate-400 opacity-60'}`}
								>
									<FileSpreadsheet size={16} /> File Excel
								</button>
								<button
									onClick={() => setImportMethod('link')}
									className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${importMethod === 'link' ? 'bg-white dark:bg-slate-900 text-[#1A237E] shadow-sm' : 'text-slate-400 opacity-60'}`}
								>
									<LinkIcon size={16} /> Link Trang tính
								</button>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
									<h4 className="font-black text-slate-800 dark:text-white mb-4 uppercase text-xs tracking-widest flex items-center gap-2">
										<CheckCircle2 size={16} className="text-emerald-500" /> Hướng dẫn
									</h4>
									<ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400 font-medium">
										{importMethod === 'file' ? (
											<>
												<li>• Sử dụng file Excel (.xlsx hoặc .csv).</li>
												<li>• Hàng đầu tiên phải là tiêu đề cột.</li>
												<li>• Các cột bắt buộc: {config.fields.filter(f => f.required).map(f => f.label).join(', ')}.</li>
											</>
										) : (
											<>
												<li>• Trang tính phải ở chế độ <b>"Bất kỳ ai có liên kết đều có thể xem"</b>.</li>
												<li>• Hoặc sử dụng tính năng <b>"Xuất bản lên web"</b> của Google.</li>
												<li>• Link có dạng: <i>docs.google.com/spreadsheets/d/...</i></li>
											</>
										)}
										<li>• Hệ thống tự động khớp tên cột gần đúng.</li>
									</ul>
									{importMethod === 'file' && (
										<button
											onClick={downloadTemplate}
											className="mt-6 w-full py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
										>
											<Download size={16} /> Tải file mẫu (.xlsx)
										</button>
									)}
								</div>

								{importMethod === 'file' ? (
									<div className="flex flex-col items-center justify-center border-4 border-dashed border-slate-100 dark:border-slate-800 rounded-[3rem] p-10 hover:border-indigo-500/30 transition-colors group relative cursor-pointer" onClick={() => fileInputRef.current?.click()}>
										<div className="size-20 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-3xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
											<Upload size={40} />
										</div>
										<p className="font-black text-slate-800 dark:text-white uppercase tracking-tight">Kéo thả hoặc Click</p>
										<p className="text-xs text-slate-400 font-bold mt-1">Để chọn file Excel từ máy tính</p>
										<input
											ref={fileInputRef}
											type="file"
											accept=".xlsx, .xls, .csv"
											className="hidden"
											onChange={handleFileUpload}
											disabled={loading}
										/>
									</div>
								) : (
									<div className="flex flex-col gap-4">
										<div className="flex-1 bg-slate-50 dark:bg-slate-800/50 rounded-[3rem] p-8 border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center">
											<div className="size-16 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-2xl flex items-center justify-center mb-6">
												<Globe size={32} />
											</div>
											<div className="w-full space-y-4">
												<div>
													<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest pl-4">Dán Link Google Sheets tại đây</label>
													<input
														type="text"
														placeholder="https://docs.google.com/spreadsheets/d/..."
														className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 dark:text-white focus:border-indigo-500 transition-all outline-none"
														value={sheetUrl}
														onChange={(e) => setSheetUrl(e.target.value)}
													/>
												</div>
												<button
													onClick={handleLinkImport}
													disabled={loading || !sheetUrl}
													className="w-full bg-[#1A237E] dark:bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
												>
													Lấy dữ liệu ngay
												</button>
											</div>
										</div>
									</div>
								)}

								{loading && (
									<div className="fixed inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-[2px] z-[80] flex items-center justify-center">
										<div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl flex flex-col items-center gap-4 border border-white/20">
											<div className="size-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
											<p className="font-black text-xs text-slate-800 dark:text-white uppercase tracking-widest">Đang kết nối dữ liệu...</p>
										</div>
									</div>
								)}
							</div>

							{error && (
								<div className="p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-400 text-sm font-bold">
									<AlertCircle size={20} />
									{error}
								</div>
							)}
						</div>
					) : (
						<div className="space-y-6">
							<div className="flex items-center justify-between">
								<div>
									<h4 className="font-black text-slate-800 dark:text-white uppercase text-xs tracking-widest flex items-center gap-2">
										Xem trước dữ liệu ({data.length} hàng)
									</h4>
									<p className="text-[10px] text-slate-400 font-bold">Nguồn: {importMethod === 'file' ? 'Excel' : 'Google Sheets'}</p>
								</div>
								<button
									onClick={() => setStep(1)}
									className="text-indigo-500 font-bold text-xs hover:underline uppercase tracking-widest"
								>
									Quay lại bước chọn nguồn
								</button>
							</div>

							<div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden">
								<div className="overflow-x-auto max-h-[400px] custom-scrollbar">
									<table className="w-full text-left border-collapse">
										<thead className="sticky top-0 bg-white dark:bg-slate-900 shadow-sm z-10">
											<tr>
												{columns.map((col, idx) => (
													<th key={idx} className="py-4 px-6 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">
														{col}
													</th>
												))}
											</tr>
										</thead>
										<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
											{data.slice(0, 50).map((row, rowIdx) => (
												<tr key={rowIdx} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5 transition-colors">
													{config.fields.map((field, colIdx) => (
														<td key={colIdx} className="py-3 px-6 text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
															{row[field.key]?.toLocaleString() || '---'}
														</td>
													))}
												</tr>
											))}
										</tbody>
									</table>
								</div>
								{data.length > 50 && (
									<div className="p-4 bg-indigo-50/30 dark:bg-indigo-900/20 text-center text-[10px] font-black text-indigo-500 uppercase tracking-widest">
										Và {data.length - 50} hàng khác...
									</div>
								)}
							</div>

							<button
								onClick={handleImport}
								disabled={importing}
								className="w-full bg-[#FF6D00] text-white py-5 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-orange-500/30 hover:bg-orange-600 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
							>
								{importing ? (
									<>
										<div className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
										Đang lưu vào cơ sở dữ liệu...
									</>
								) : (
									<>
										<CheckCircle2 size={20} /> Xác nhận đồng bộ {data.length} {config.title}
									</>
								)}
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default BulkImport;
