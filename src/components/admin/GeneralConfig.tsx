import React from 'react';
import { Globe, MapPin, RefreshCcw, Save, Download, Lock, Upload, FileSpreadsheet, CheckCircle, XCircle, Crown, Plus, Trash2, Clock } from 'lucide-react';
import { InputSection, LogoUploadSection } from './SharedComponents';

export const GeneralConfig = ({
    companyInfo, setCompanyInfo,
    logoUploading, handleLogoUpload,
    handleMigrateDebt, loading,
    handleSaveSettings, owner,
    syncRange, setSyncRange,
    exportLoading, exportCount,
    extraExportLimit, isSyncLocked,
    importFileInputRef, handleImportSyncData,
    importLoading, importSummary, handleExportData, systemConfig, showToast
}: any) => {
    return (
						<div className="space-y-6">
							<div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
								<div className="flex items-center gap-4 mb-6">
									<div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl text-blue-600 dark:text-blue-400">
										<Globe size={24} />
									</div>
									<div>
										<h3 className="text-xl font-bold dark:text-white">Thông tin Doanh nghiệp</h3>
										<p className="text-sm text-slate-500 dark:text-slate-400">Hiển thị trên phiếu in và hóa đơn.</p>
									</div>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<LogoUploadSection
										label="Logo Doanh nghiệp"
										value={companyInfo.logoUrl}
										uploading={logoUploading}
										onUpload={handleLogoUpload}
									/>
									<InputSection label="Tên Công Ty" value={companyInfo.name} onChange={(v: string) => setCompanyInfo({ ...companyInfo, name: v })} />
									<InputSection label="Mã số thuế" value={companyInfo.taxCode} onChange={(v: string) => setCompanyInfo({ ...companyInfo, taxCode: v })} />
									<InputSection label="Địa chỉ" value={companyInfo.address} onChange={(v: string) => setCompanyInfo({ ...companyInfo, address: v })} fullWidth />
									<InputSection label="Hotline" value={companyInfo.phone} onChange={(v: string) => setCompanyInfo({ ...companyInfo, phone: v })} />
									<InputSection label="Email" value={companyInfo.email} onChange={(v: string) => setCompanyInfo({ ...companyInfo, email: v })} />

									<div className="md:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-6">
										<h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Cấu hình Chấm công văn phòng</h4>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
											<div className="space-y-2">
												<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vị trí Văn phòng (Lat, Lng)</label>
												<div className="flex gap-2">
													<input
														readOnly
														className="flex-1 bg-slate-100 dark:bg-slate-800/50 border-none rounded-xl px-4 py-3 text-xs font-bold dark:text-white"
														value={`${companyInfo.lat || 0}, ${companyInfo.lng || 0}`}
													/>
													<button
														onClick={() => {
															navigator.geolocation.getCurrentPosition(
																(pos) => setCompanyInfo({ ...companyInfo, lat: pos.coords.latitude, lng: pos.coords.longitude }),
																(err) => showToast("Không thể lấy vị trí: " + err.message, "error")
															);
														}}
														className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-all shrink-0"
													>
														<MapPin size={20} />
													</button>
												</div>
											</div>
											<div className="grid grid-cols-3 gap-4">
												<InputSection label="Giờ bắt đầu" type="time" value={companyInfo.workStart} onChange={(v: string) => setCompanyInfo({ ...companyInfo, workStart: v })} />
												<InputSection label="Giờ kết thúc" type="time" value={companyInfo.workEnd} onChange={(v: string) => setCompanyInfo({ ...companyInfo, workEnd: v })} />
												<InputSection label="Bán kính (m)" type="number" value={companyInfo.geofenceRadius} onChange={(v: string) => setCompanyInfo({ ...companyInfo, geofenceRadius: Number(v) })} />
											</div>
										</div>
									</div>
								</div>
								<div className="mt-8 flex justify-between items-center">
									<button onClick={handleMigrateDebt} disabled={loading} className="flex items-center gap-2 bg-rose-500/10 text-rose-600 px-4 py-2 rounded-xl font-bold hover:bg-rose-500/20 transition-all disabled:opacity-50 text-xs">
										<RefreshCcw size={16} /> Đồng bộ Công Nợ Toàn Hệ Thống
									</button>
									<button onClick={handleSaveSettings} disabled={loading} className="flex items-center gap-2 bg-[#1A237E] dark:bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50">
										<Save size={20} /> {loading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
									</button>
								</div>
							</div>

							<div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
								<div className="flex items-center gap-4 mb-6">
									<div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl text-indigo-600 dark:text-indigo-400">
										<Download size={24} />
									</div>
									<div>
										<h3 className="text-xl font-bold dark:text-white">Bộ lưu dữ liệu (Export)</h3>
										<p className="text-sm text-slate-500 dark:text-slate-400">Trích xuất dữ liệu tùy chọn theo mốc thời gian ra file Excel.</p>
									</div>
									<div className="ml-auto flex flex-col items-end">
										<span className={`text-[10px] font-black px-2 py-1 rounded-lg ${!owner.isPro && exportCount >= (5 + extraExportLimit) ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
											SỬ DỤNG: {exportCount}/{owner.isPro ? 'Không giới hạn' : (5 + extraExportLimit + ' LẦN/THÁNG')}
										</span>
									</div>
									{isSyncLocked && (
										<div className="ml-auto bg-rose-500/10 text-rose-500 px-3 py-1 rounded-lg flex items-center gap-1.5 animate-pulse">
											<Lock size={14} />
											<span className="text-[10px] font-black">BỊ KHÓA</span>
										</div>
									)}
								</div>

								<div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
										<div className="space-y-1">
											<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Từ ngày</label>
											<input
												type="date"
												className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
												value={syncRange.start}
												onChange={(e) => setSyncRange({ ...syncRange, start: e.target.value })}
											/>
										</div>
										<div className="space-y-1">
											<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đến ngày</label>
											<input
												type="date"
												className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
												value={syncRange.end}
												onChange={(e) => setSyncRange({ ...syncRange, end: e.target.value })}
											/>
										</div>
									</div>

									<div className="flex flex-col md:flex-row items-center gap-6">
										<div className="flex-1">
											<h4 className="font-bold text-slate-800 dark:text-white mb-2">Tải dữ liệu nâng cao</h4>
											<p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
												Hệ thống sẽ lọc dữ liệu (Đơn hàng, Công nợ, Checkin) theo khoảng thời gian bạn chọn và tạo file Excel trực tiếp.
												Hành động này giúp báo cáo gọn nhẹ và xử lý nhanh hơn. (Yêu cầu tài khoản PRO)
											</p>
										</div>
										<button
											onClick={handleExportData}
											disabled={exportLoading || (!owner.isPro && exportCount >= (5 + extraExportLimit)) || isSyncLocked}
											className="w-full md:w-auto bg-[#1A237E] dark:bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/10"
										>
											{exportLoading ? (
												<><RefreshCcw size={20} className="animate-spin" /> Đang xử lý...</>
											) : isSyncLocked ? (
												<><Lock size={20} /> ĐÃ BỊ KHÓA</>
											) : (
												<><Download size={20} /> Tải dữ liệu về</>
											)}
										</button>
									</div>
								</div>
							</div>

							{/* Thẻ Phục hồi / Đồng bộ dữ liệu lại vào App từ Excel / JSON */}
							<div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
								<div className="flex items-center gap-4 mb-6">
									<div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl text-emerald-600 dark:text-emerald-400">
										<Upload size={24} />
									</div>
									<div>
										<h3 className="text-xl font-bold dark:text-white">Đồng bộ dữ liệu vào Ứng dụng (Import / Phục hồi)</h3>
										<p className="text-sm text-slate-500 dark:text-slate-400">Cập nhật dữ liệu từ file Excel (.xlsx) hoặc file Backup (.json) vào hệ thống.</p>
									</div>
								</div>

								<div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
									<input
										ref={importFileInputRef}
										type="file"
										accept=".xlsx,.xls,.json"
										onChange={handleImportSyncData}
										className="hidden"
									/>
									<div className="flex flex-col md:flex-row items-center gap-6">
										<div className="flex-1 space-y-2">
											<h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
												<FileSpreadsheet size={18} className="text-emerald-600" />
												Đồng bộ dữ liệu cũ & mới
											</h4>
											<p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
												Hỗ trợ nạp dữ liệu từ file Excel đã xuất (<code className="text-indigo-600 dark:text-indigo-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">san_pham, khach_hang, don_hang, cong_no, lich_su_thanh_toan...</code>) hoặc file Backup (.json). Dữ liệu sẽ tự động phân loại theo từng danh mục và ghi đè/cập nhật thông minh vào hệ thống mà không bị lặp bản ghi.
											</p>
										</div>

										<button
											onClick={() => importFileInputRef.current?.click()}
											disabled={importLoading}
											className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/10 shrink-0"
										>
											{importLoading ? (
												<><RefreshCcw size={20} className="animate-spin" /> Đang đồng bộ...</>
											) : (
												<><Upload size={20} /> Tải file Excel/JSON lên để đồng bộ</>
											)}
										</button>
									</div>

									{importSummary && (
										<div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3">
											<CheckCircle size={20} className="text-emerald-600 shrink-0" />
											<p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{importSummary}</p>
										</div>
									)}
								</div>
							</div>

							<div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
								<div className="flex items-center gap-4 mb-6">
									<div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl text-amber-600 dark:text-amber-400">
										<Crown size={24} />
									</div>
									<div>
										<h3 className="text-xl font-bold dark:text-white">Gói Dịch Vụ</h3>
									</div>
								</div>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl flex items-center gap-4">
										<div className={`p-3 rounded-xl ${owner.isPro ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{owner.isPro ? <CheckCircle /> : <XCircle />}</div>
										<div>
											<p className="text-xs font-black text-slate-400 uppercase tracking-widest">Gói đăng ký</p>
											<p className="text-lg font-black text-slate-800 dark:text-white uppercase">
												{owner.planId === 'premium_yearly' ? 'Premium (1 Năm)' : owner.planId === 'premium_monthly' ? 'Premium (1 Tháng)' : owner.isPro ? 'Premium Pro' : 'Dùng thử'}
											</p>
										</div>
									</div>
									<div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl flex items-center gap-4">
										<div className="p-3 rounded-xl bg-blue-50 text-blue-600"><Clock /></div>
										<div>
											<p className="text-xs font-black text-slate-400 uppercase tracking-widest">Thời gian còn lại</p>
											<p className="text-lg font-black text-slate-800 dark:text-white">
												{(() => {
													const expireAt = owner.subscriptionExpiresAt || owner.trialEndsAt;
													if (expireAt) {
														const expireDate = expireAt.toDate ? expireAt.toDate() : new Date(expireAt);
														const days = Math.ceil((expireDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
														return days > 0 ? `${days} ngày` : 'Đã hết hạn';
													}
													return owner.subscriptionStatus === 'active' ? 'Vô thời hạn' : 'Hết hạn';
												})()}
											</p>
										</div>
									</div>
								</div>
							</div>

							{/* Hệ số chi phí vận hành */}
							<div className="md:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-6">
								<h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Hệ số chi phí vận hành</h4>
								<p className="text-[10px] text-slate-400 mb-3">Áp dụng cho sản phẩm được tick "Áp hệ số chi phí". Lợi nhuận = Giá bán - (Giá nhập × (1 + Hệ số%))</p>
								<InputSection label="Hệ số chi phí (%)" type="number" value={companyInfo.overheadRate ?? 8.5} onChange={(v: string) => setCompanyInfo({ ...companyInfo, overheadRate: Number(v) })} />
							</div>
						</div>
    );
};
