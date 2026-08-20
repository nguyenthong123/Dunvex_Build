import React from 'react';
import { FileText, Image as ImageIcon, X } from 'lucide-react';

export interface CustomerFormModalProps {
    showAddForm: boolean;
    showEditForm: boolean;
    setShowAddForm: (v: boolean) => void;
    setShowEditForm: (v: boolean) => void;
    formData: any;
    setFormData: (data: any) => void;
    handleAddCustomer: (e: React.FormEvent) => void;
    handleUpdateCustomer: (e: React.FormEvent) => void;
    customerTypes: string[];
    uploadingLicense: boolean;
    uploadingImages: boolean;
    handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>, type: 'license' | 'additional') => void;
    removeLicense: (index: number) => void;
    removeImage: (index: number) => void;
    gettingLocation: boolean;
    handleGetLocation: () => void;
    showTaxInfo: boolean;
    setShowTaxInfo: (v: boolean) => void;
    getImageUrl: (url: string) => string;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
    showAddForm,
    showEditForm,
    setShowAddForm,
    setShowEditForm,
    formData,
    setFormData,
    handleAddCustomer,
    handleUpdateCustomer,
    customerTypes,
    uploadingLicense,
    uploadingImages,
    handleImageUpload,
    removeLicense,
    removeImage,
    gettingLocation,
    handleGetLocation,
    showTaxInfo,
    setShowTaxInfo,
    getImageUrl
}) => {
    if (!showAddForm && !showEditForm) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[#1A237E]/80 dark:bg-black/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-300">
                <div className="px-8 py-6 bg-[#1A237E] dark:bg-indigo-900 text-white flex items-center justify-between">
                    <h3 className="text-xl font-black uppercase tracking-tight">{showAddForm ? 'Thêm Khách Hàng' : 'Cập Nhật Hồ Sơ'}</h3>
                    <button onClick={() => { setShowAddForm(false); setShowEditForm(false); }} className="size-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <form onSubmit={showAddForm ? handleAddCustomer : handleUpdateCustomer} className="p-8 space-y-5 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Họ và Tên *</label>
                                <input
                                    type="text" required
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Số điện thoại</label>
                                <input
                                    type="tel"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Email khách hàng</label>
                                <input
                                    type="email"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
                                    placeholder="VD: customer@example.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Phân loại</label>
                                <input
                                    list="customer-types"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
                                    value={formData.type}
                                    placeholder="VD: Chủ nhà, Thợ..."
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                />
                                <datalist id="customer-types">
                                    {customerTypes.map(t => <option key={t} value={t} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Tuyến bán hàng (Zoning)</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
                                    placeholder="VD: Tuyến Thứ 2, Khu vực A..."
                                    value={formData.route}
                                    onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Nhân viên phụ trách (Email)</label>
                                <input
                                    type="email"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
                                    placeholder="Email nhân viên phụ trách..."
                                    value={formData.createdByEmail}
                                    onChange={(e) => setFormData({ ...formData, createdByEmail: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Hạn mức công nợ (VNĐ)</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-black text-[#FF6D00] focus:ring-2 focus:ring-[#FF6D00]/20"
                                    placeholder="0"
                                    value={formData.creditLimit === 0 ? '' : formData.creditLimit}
                                    onChange={(e) => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Giấy phép kinh doanh / GPKD</label>
                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={() => document.getElementById('license-upload')?.click()}
                                    disabled={uploadingLicense}
                                    className="w-full h-14 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 text-slate-400 hover:text-indigo-500 hover:border-indigo-500 transition-all"
                                >
                                    {uploadingLicense ? (
                                        <span className="animate-spin material-symbols-outlined">sync</span>
                                    ) : (
                                        <>
                                            <FileText size={18} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Tải lên GPKD</span>
                                        </>
                                    )}
                                </button>
                                <input id="license-upload" type="file" className="hidden" multiple accept="image/*,application/pdf" onChange={(e) => handleImageUpload(e, 'license')} />

                                {formData.licenseUrls && formData.licenseUrls.length > 0 && (
                                    <div className="grid grid-cols-4 gap-2">
                                        {formData.licenseUrls.map((url: string, idx: number) => (
                                            <div key={idx} className="aspect-square rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 relative group">
                                                <img src={getImageUrl(url)} className="w-full h-full object-cover" alt={`License ${idx}`}  loading="lazy" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeLicense(idx)}
                                                    className="absolute top-1 right-1 size-6 bg-red-500 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* TOGGLE FORM CHO THÔNG TIN HÓA ĐƠN */}
                        <div className="pt-2">
                            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800">
                                <div>
                                    <h4 className="text-xs font-black uppercase text-slate-800 dark:text-indigo-400">Thông tin xuất hóa đơn</h4>
                                    <p className="text-[10px] text-slate-500">Tên công ty, MST và địa chỉ tài chính</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowTaxInfo(!showTaxInfo)}
                                    className={`w-12 h-6 rounded-full transition-all duration-300 relative ${showTaxInfo ? 'bg-[#FF6D00]' : 'bg-slate-200 dark:bg-slate-700'} shadow-inner`}
                                >
                                    <div className={`absolute top-1 size-4 bg-white rounded-full transition-all duration-300 ${showTaxInfo ? 'left-7 shadow-lg translate-x-0' : 'left-1 shadow-sm'}`}></div>
                                </button>
                            </div>

                            {showTaxInfo && (
                                <div className="space-y-4 pt-4 animate-in slide-in-from-top-2 duration-300">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Tên xuất hóa đơn</label>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
                                            placeholder="VD: CÔNG TY TNHH DUNVEX DIGITAL"
                                            value={formData.taxName}
                                            onChange={(e) => setFormData({ ...formData, taxName: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Mã số thuế</label>
                                            <input
                                                type="text"
                                                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
                                                placeholder="VD: 0312345678"
                                                value={formData.taxCode}
                                                onChange={(e) => setFormData({ ...formData, taxCode: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">SĐT hóa đơn (nếu có)</label>
                                            <input
                                                type="text"
                                                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
                                                placeholder="Dùng SĐT chính nếu bỏ trống"
                                                value={formData.taxPhone}
                                                onChange={(e) => setFormData({ ...formData, taxPhone: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Địa chỉ xuất hóa đơn</label>
                                        <textarea
                                            rows={2}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
                                            placeholder="Địa chỉ ghi trên hóa đơn tài chính..."
                                            value={formData.taxAddress}
                                            onChange={(e) => setFormData({ ...formData, taxAddress: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Hình ảnh khác / Công trình</label>
                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={() => document.getElementById('images-upload')?.click()}
                                    disabled={uploadingImages}
                                    className="w-full h-14 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 text-slate-400 hover:text-orange-500 hover:border-orange-500 transition-all"
                                >
                                    {uploadingImages ? (
                                        <span className="animate-spin material-symbols-outlined">sync</span>
                                    ) : (
                                        <>
                                            <ImageIcon size={18} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Thêm hình ảnh</span>
                                        </>
                                    )}
                                </button>
                                <input id="images-upload" type="file" className="hidden" multiple accept="image/*" onChange={(e) => handleImageUpload(e, 'additional')} />

                                {formData.additionalImages && formData.additionalImages.length > 0 && (
                                    <div className="grid grid-cols-4 gap-2">
                                        {formData.additionalImages.map((url: string, idx: number) => (
                                            <div key={idx} className="aspect-square rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 relative group">
                                                <img src={getImageUrl(url)} className="w-full h-full object-cover" alt={`Img ${idx}`}  loading="lazy" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(idx)}
                                                    className="absolute top-1 right-1 size-6 bg-red-500 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Vĩ độ (Lat)</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
                                    placeholder="VD: 10.762622"
                                    value={formData.lat || ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val.includes(',')) {
                                            const [latStr, lngStr] = val.split(',').map(s => s.trim());
                                            setFormData({ ...formData, lat: parseFloat(latStr) || null, lng: parseFloat(lngStr) || formData.lng });
                                        } else {
                                            setFormData({ ...formData, lat: val ? parseFloat(val) : null });
                                        }
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Kinh độ (Lng)</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
                                    placeholder="VD: 106.660172"
                                    value={formData.lng || ''}
                                    onChange={(e) => setFormData({ ...formData, lng: e.target.value ? parseFloat(e.target.value) : null })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Địa chỉ</label>
                            <div className="flex gap-2">
                                <textarea
                                    rows={2}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                                <button
                                    type="button"
                                    onClick={handleGetLocation}
                                    disabled={gettingLocation}
                                    className="size-14 bg-gradient-to-br from-[#1A237E] to-[#283593] text-white rounded-2xl shrink-0 flex items-center justify-center hover:bg-black dark:hover:bg-indigo-800 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-blue-500/20"
                                >
                                    <span className="material-symbols-outlined">{gettingLocation ? 'sync' : 'location_on'}</span>
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 tracking-widest pl-1">Ghi chú</label>
                            <textarea
                                rows={3}
                                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/20"
                                value={formData.note}
                                placeholder="Thông tin thêm về khách hàng..."
                                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="pt-4">
                        <button
                            type="submit"
                            className="w-full bg-[#FF6D00] text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-[0.98]"
                        >
                            {showAddForm ? 'Xác nhận tạo hồ sơ' : 'Cập nhật thông tin'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
