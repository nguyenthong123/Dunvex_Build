import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Mail, Save, ArrowLeft, Shield, MapPin, CheckCircle2, Camera, Trash2, Building2 } from 'lucide-react';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, orderBy, limit } from '../services/firebase';
import { useOwner } from '../hooks/useOwner';
import { useToast } from '../components/shared/Toast';
import SalesChart from '../components/profile/SalesChart';
import { apiUrl, getAuthHeaders } from '../services/apiClient';
import { getSessionToken, setSQLiteSession } from '../services/sqliteSession';
import { compressImage } from '../utils/vpsUpload';

const Profile = () => {
    const navigate = useNavigate();
    const owner = useOwner();
    const { showToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [logoUploading, setLogoUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [profile, setProfile] = useState({
        displayName: '',
        phone: '',
        email: '',
        logoUrl: '',
    });

    useEffect(() => {
        if (!auth.currentUser) return;
        loadProfile();
    }, [auth.currentUser?.uid, owner.ownerId]);

    const loadProfile = async () => {
        try {
            const uid = auth.currentUser?.uid || '';
            const email = auth.currentUser?.email || '';
            const ownerId = owner.ownerId || uid;
            const docRef = doc(db, 'profiles', uid);
            const userRef = doc(db, 'users', uid);
            const settingsRef = ownerId ? doc(db, 'settings', ownerId) : null;

            const [snap, userSnap, settingsSnap] = await Promise.all([
                getDoc(docRef).catch(() => null),
                getDoc(userRef).catch(() => null),
                settingsRef ? getDoc(settingsRef).catch(() => null) : null
            ]);

            const savedName = (snap?.exists() ? (snap.data().displayName || snap.data().name) : '') ||
                              (userSnap?.exists() ? (userSnap.data().displayName || userSnap.data().name) : '') ||
                              owner.userDisplayName ||
                              auth.currentUser?.displayName || '';

            const savedLogo = (settingsSnap?.exists() ? settingsSnap.data().logoUrl : '') ||
                              (snap?.exists() ? (snap.data().logoUrl || snap.data().photoURL) : '') ||
                              (userSnap?.exists() ? (userSnap.data().logoUrl || userSnap.data().photoURL) : '') || '';

            setProfile({
                displayName: savedName,
                phone: (snap?.exists() ? snap.data().phone : userSnap?.data()?.phone) || '',
                email: email,
                logoUrl: savedLogo,
            });
        } catch (e) {
            console.error('Load profile error:', e);
        }
    };

    const handleLogoUpload = async (file: File) => {
        if (!file) return;
        setLogoUploading(true);
        try {
            // Nén ảnh gọn nhẹ (tối đa 800x800) để in phiếu sắc nét và tiết kiệm bộ nhớ
            const base64 = await compressImage(file, 800, 800, 0.85);
            let finalUrl = '';

            // 1. Thử tải lên Cloudinary như cấu hình Web
            try {
                const formData = new FormData();
                formData.append('file', base64);
                formData.append('upload_preset', 'dunvexbuil');
                formData.append('folder', 'dunvex_branding');
                const res = await fetch('https://api.cloudinary.com/v1_1/dtx0uvb4e/image/upload', {
                    method: 'POST',
                    body: formData,
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.secure_url) finalUrl = data.secure_url;
                }
            } catch (err) {
                console.warn('Cloudinary upload error:', err);
            }

            // 2. Dự phòng: Tải lên VPS qua endpoint /api/upload
            if (!finalUrl) {
                try {
                    const res = await fetch(apiUrl('/api/upload'), {
                        method: 'POST',
                        headers: {
                            ...getAuthHeaders(),
                            Authorization: `Bearer ${getSessionToken()}`,
                        },
                        body: JSON.stringify({
                            imageBase64: base64,
                            fileName: `logo_${Date.now()}`,
                            folder: 'branding',
                        }),
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.url) finalUrl = data.url;
                    }
                } catch (err) {
                    console.warn('VPS upload error:', err);
                }
            }

            // 3. Fallback: Base64 data URL
            if (!finalUrl) {
                finalUrl = base64;
            }

            setProfile(prev => ({ ...prev, logoUrl: finalUrl }));

            // Đồng bộ trực tiếp vào Firestore / SQLite settings & profiles
            const uid = auth.currentUser?.uid || '';
            const ownerId = owner.ownerId || uid;
            if (ownerId) {
                await setDoc(doc(db, 'settings', ownerId), {
                    logoUrl: finalUrl,
                    updatedAt: serverTimestamp(),
                }, { merge: true });
            }
            if (uid) {
                await setDoc(doc(db, 'profiles', uid), {
                    logoUrl: finalUrl,
                    photoURL: finalUrl,
                    updatedAt: serverTimestamp(),
                }, { merge: true });
                await setDoc(doc(db, 'users', uid), {
                    photoURL: finalUrl,
                    updatedAt: serverTimestamp(),
                }, { merge: true });
            }

            // Cập nhật session offline
            try {
                const sessionStr = localStorage.getItem('dunvex_user_session');
                const sessionObj = sessionStr ? JSON.parse(sessionStr) : {};
                sessionObj.logoUrl = finalUrl;
                sessionObj.photoURL = finalUrl;
                localStorage.setItem('dunvex_user_session', JSON.stringify(sessionObj));
                if (getSessionToken()) setSQLiteSession(sessionObj, getSessionToken());
            } catch {}

            // Bắn tín hiệu để phiếu bán hàng và phiếu thu nợ render lại ngay
            window.dispatchEvent(new CustomEvent('collection_changed', { detail: { collection: 'settings' } }));
            window.dispatchEvent(new CustomEvent('dunvex_profile_updated', { detail: { logoUrl: finalUrl } }));

            showToast('✅ Đã cập nhật logo! Đã áp dụng lên phiếu bán hàng và phiếu thu nợ.', 'success');
        } catch (err: any) {
            showToast('❌ Lỗi upload ảnh: ' + (err.message || 'Không thể tải ảnh'), 'error');
        } finally {
            setLogoUploading(false);
        }
    };

    const handleRemoveLogo = async () => {
        setProfile(prev => ({ ...prev, logoUrl: '' }));
        const uid = auth.currentUser?.uid || '';
        const ownerId = owner.ownerId || uid;
        if (ownerId) {
            await setDoc(doc(db, 'settings', ownerId), {
                logoUrl: '',
                updatedAt: serverTimestamp(),
            }, { merge: true });
        }
        if (uid) {
            await setDoc(doc(db, 'profiles', uid), {
                logoUrl: '',
                photoURL: '',
                updatedAt: serverTimestamp(),
            }, { merge: true });
        }
        try {
            const sessionStr = localStorage.getItem('dunvex_user_session');
            const sessionObj = sessionStr ? JSON.parse(sessionStr) : {};
            sessionObj.logoUrl = '';
            sessionObj.photoURL = '';
            localStorage.setItem('dunvex_user_session', JSON.stringify(sessionObj));
            if (getSessionToken()) setSQLiteSession(sessionObj, getSessionToken());
        } catch {}

        window.dispatchEvent(new CustomEvent('collection_changed', { detail: { collection: 'settings' } }));
        showToast('Đã xóa logo!', 'success');
    };

    const handleSave = async () => {
        if (!auth.currentUser?.uid) return;
        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            const newName = profile.displayName.trim();
            const newPhone = profile.phone.trim();
            const newLogo = profile.logoUrl;
            const ownerId = owner.ownerId || uid;

            const response = await fetch(apiUrl('/api/auth/update-profile'), {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    Authorization: `Bearer ${getSessionToken()}`,
                },
                body: JSON.stringify({ displayName: newName, phone: newPhone }),
            });
            const result = await response.json();
            if (!response.ok || result.error) throw new Error(result.error || 'Không lưu được hồ sơ');

            // Đồng bộ settings logo & thông tin cá nhân
            if (ownerId) {
                await setDoc(doc(db, 'settings', ownerId), {
                    logoUrl: newLogo,
                    updatedAt: serverTimestamp(),
                }, { merge: true });
            }
            await setDoc(doc(db, 'profiles', uid), {
                displayName: newName,
                phone: newPhone,
                logoUrl: newLogo,
                photoURL: newLogo,
                updatedAt: serverTimestamp(),
            }, { merge: true });
            await setDoc(doc(db, 'users', uid), {
                displayName: newName,
                phone: newPhone,
                photoURL: newLogo,
                updatedAt: serverTimestamp(),
            }, { merge: true });

            // Update the local session for immediate UI reactivity.
            try {
                const sessionStr = localStorage.getItem('dunvex_user_session');
                const sessionObj = sessionStr ? JSON.parse(sessionStr) : {};
                sessionObj.displayName = newName;
                sessionObj.phone = newPhone;
                sessionObj.logoUrl = newLogo;
                sessionObj.photoURL = newLogo;
                localStorage.setItem('dunvex_user_session', JSON.stringify(sessionObj));
                if (getSessionToken()) setSQLiteSession(sessionObj, getSessionToken());
                window.dispatchEvent(new CustomEvent('dunvex_profile_updated', { detail: { displayName: newName, phone: newPhone, logoUrl: newLogo } }));
                window.dispatchEvent(new CustomEvent('collection_changed', { detail: { collection: 'settings' } }));
            } catch (e) {}

            setSaved(true);
            showToast('✅ Đã lưu thông tin cá nhân và logo!', 'success');
            setTimeout(() => setSaved(false), 2000);
        } catch (e: any) {
            showToast('❌ Lỗi: ' + (e.message || 'Không lưu được'), 'error');
        } finally {
            setSaving(false);
        }
    };


    if (owner.loading) {
        return (
            <div className="absolute inset-0 pt-14 lg:pt-0 pb-20 lg:pb-0 z-40 bg-white dark:bg-slate-900 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="absolute inset-0 pt-14 lg:pt-0 pb-20 lg:pb-0 z-40 bg-white dark:bg-slate-900 overflow-auto">
            <div className="max-w-lg mx-auto p-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
                            Hồ sơ cá nhân
                        </h1>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                            Cập nhật thông tin hiển thị trên đơn hàng
                        </p>
                    </div>
                </div>

                {/* Avatar & Logo Section */}
                <div className="flex flex-col items-center mb-8">
                    <div className="relative group">
                        <div
                            onClick={() => !logoUploading && fileInputRef.current?.click()}
                            className="w-24 h-24 rounded-full border-2 border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-black shadow-xl overflow-hidden cursor-pointer hover:opacity-95 active:scale-95 transition-all relative"
                            title="Nhấp để tải lên logo / ảnh đại diện"
                        >
                            {profile.logoUrl ? (
                                <img
                                    src={profile.logoUrl}
                                    alt="Logo"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span>{profile.displayName?.charAt(0)?.toUpperCase() || auth.currentUser?.email?.charAt(0)?.toUpperCase() || '?'}</span>
                            )}

                            {logoUploading && (
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                                    <div className="animate-spin w-7 h-7 border-2 border-white border-t-transparent rounded-full" />
                                </div>
                            )}
                        </div>

                        {/* Nút máy ảnh tải ảnh */}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={logoUploading}
                            className="absolute bottom-0 right-0 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg border-2 border-white dark:border-slate-900 cursor-pointer active:scale-90 transition-transform"
                            title="Chọn ảnh logo"
                        >
                            <Camera size={14} />
                        </button>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleLogoUpload(file);
                            e.target.value = '';
                        }}
                    />

                    {/* Logo actions */}
                    <div className="flex items-center gap-3 mt-3">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={logoUploading}
                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                            {profile.logoUrl ? 'Thay đổi Logo' : 'Tải lên Logo'}
                        </button>
                        {profile.logoUrl && (
                            <>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <button
                                    type="button"
                                    onClick={handleRemoveLogo}
                                    disabled={logoUploading}
                                    className="text-xs font-bold text-rose-500 hover:underline cursor-pointer"
                                >
                                    Xóa Logo
                                </button>
                            </>
                        )}
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center mt-1.5 max-w-xs">
                        Logo này sẽ được áp dụng làm logo trên <b>phiếu bán hàng</b> và <b>phiếu thu nợ</b>
                    </p>

                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-2">
                        {profile.displayName || auth.currentUser?.email?.split('@')[0] || 'Người dùng'}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Shield size={10} />
                        {owner.isEmployee ? 'Nhân viên' : 'Quản trị viên'}
                    </p>
                </div>

                {/* Form */}
                <div className="space-y-5">
                    {/* Tên hiển thị */}
                    <div>
                        <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                            <User size={14} /> Tên hiển thị
                        </label>
                        <input
                            type="text"
                            value={profile.displayName}
                            onChange={(e) => setProfile(prev => ({ ...prev, displayName: e.target.value }))}
                            placeholder="VD: Nguyễn Văn A"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        />
                        <p className="text-[10px] text-slate-400 mt-1 ml-1">Tên này sẽ hiển thị trên đơn hàng khi bạn lên đơn</p>
                    </div>

                    {/* SĐT */}
                    <div>
                        <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                            <Phone size={14} /> Số điện thoại
                        </label>
                        <input
                            type="tel"
                            value={profile.phone}
                            onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="VD: 0987654321"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        />
                        <p className="text-[10px] text-slate-400 mt-1 ml-1">SĐT của bạn sẽ hiển thị trên phiếu đơn hàng, khách có thể liên hệ trực tiếp</p>
                    </div>

                    {/* Email (readonly) */}
                    <div>
                        <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                            <Mail size={14} /> Email
                        </label>
                        <input
                            type="email"
                            value={profile.email}
                            disabled
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-500 text-sm font-medium cursor-not-allowed"
                        />
                        <p className="text-[10px] text-slate-400 mt-1 ml-1">Email đăng nhập — không thể thay đổi</p>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`w-full py-3.5 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                            saved
                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20'
                        }`}
                    >
                        {saved ? (
                            <>
                                <CheckCircle2 size={18} /> Đã lưu!
                            </>
                        ) : saving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Đang lưu...
                            </>
                        ) : (
                            <>
                                <Save size={18} /> Lưu thông tin
                            </>
                        )}
                    </button>
                </div>

                {/* Info box */}
                <div className="mt-6 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800">
                    <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                        💡 <b>Lưu ý:</b> Khi bạn lưu số điện thoại tại đây, tất cả đơn hàng bạn tạo sẽ hiển thị SĐT của bạn thay vì SĐT chung của cửa hàng. Khách hàng sẽ liên hệ trực tiếp với bạn!
                    </p>
                </div>

            </div>

            {/* 📊 Biểu đồ doanh thu cá nhân */}
            <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-6">
                <SalesChart ownerId={owner.ownerId || ''} userEmail={auth.currentUser?.email || ''} />
            </div>

            {/* Chân trang — đồng bộ với MainLayout */}
            <footer className="py-12 px-6 text-center border-t border-slate-50 dark:border-slate-800/50 mt-auto transition-colors duration-300">
                <div className="flex flex-col items-center gap-2 opacity-30 dark:opacity-20 hover:opacity-100 transition-opacity duration-500">
                    <div className="size-8 bg-slate-400 dark:bg-slate-500 rounded-lg flex items-center justify-center mb-1">
                        <span className="text-white text-lg">🏗️</span>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        Dunvex<span className="text-slate-900 dark:text-white">Build</span> Management System
                    </p>
                    <p className="text-[8px] font-bold text-slate-400">© 2026 Developed by Antigravity AI Engine</p>
                </div>
            </footer>
        </div>
    );
};

export default Profile;
