import React, { useRef } from 'react';
import { Globe, Plus, Trash2 } from 'lucide-react';

export const TabItem = ({ active, onClick, icon, label }: any) => (
	<button
		onClick={onClick}
		className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 whitespace-nowrap min-w-fit ${active
			? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none translate-y-[-1px]'
			: 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
			}`}
	>
		{icon}
		<span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">{label}</span>
	</button>
);

export const InputSection = ({ label, value, onChange, fullWidth = false, type = 'text' }: any) => (
	<div className={`space-y-2 ${fullWidth ? 'md:col-span-2' : ''}`}>
		<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
		<input type={type} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={value || ''} onChange={e => onChange(e.target.value)} />
	</div>
);

export const LogoUploadSection = ({ label, value, onUpload, uploading }: any) => {
	const fileInputRef = useRef<HTMLInputElement>(null);

	return (
		<div className="space-y-2 md:col-span-2 mb-4">
			<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
			<div className="flex flex-col md:flex-row items-center gap-6 p-6 bg-slate-50 dark:bg-slate-800/20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl transition-all hover:border-indigo-500/50">
				<div className="relative group shrink-0">
					<div className="w-24 h-24 md:w-32 md:h-32 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden flex items-center justify-center p-2">
						{value ? (
							<img src={value} alt="Company Logo" className="w-full h-full object-contain"  loading="lazy" />
						) : (
							<div className="text-slate-300 dark:text-slate-600">
								<Globe size={48} />
							</div>
						)}
						{uploading && (
							<div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex items-center justify-center">
								<div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
							</div>
						)}
					</div>
				</div>

				<div className="flex-1 space-y-3 text-center md:text-left">
					<h4 className="font-bold text-slate-700 dark:text-slate-300">Logo Thương Hiệu</h4>
					<p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-loose">PNG, JPG hoặc SVG. Khuyên dùng 300x100px.</p>
					<div className="flex flex-wrap justify-center md:justify-start gap-2">
						<button
							onClick={() => fileInputRef.current?.click()}
							disabled={uploading}
							className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2"
						>
							<Plus size={14} />
							{value ? 'Thay đổi Logo' : 'Tải lên Logo'}
						</button>
						{value && (
							<button
								onClick={() => onUpload('')}
								className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all flex items-center gap-2"
							>
								<Trash2 size={14} />
								Xóa
							</button>
						)}
					</div>
					<input
						type="file"
						ref={fileInputRef}
						className="hidden"
						accept="image/*"
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) onUpload(file);
						}}
					/>
				</div>
			</div>
		</div>
	);
}
