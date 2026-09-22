import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Mail, Save, ArrowLeft, Shield, CheckCircle2, MapPin, Eye, EyeOff } from 'lucide-react';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, orderBy, limit } from '../services/firebase';
import { useOwner } from '../hooks/useOwner';
import { useToast } from '../components/shared/Toast';
import SalesChart from '../components/profile/SalesChart';
import { updatePassword, EmailAuthProvider, linkWithCredential, updateProfile } from 'firebase/auth';
import { setDocument, updateDocument } from '../services/apiClient';

const Profile = () => {
    const navigate = useNavigate();
    const owner = useOwner();
    const { showToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [passwordSaving, setPasswordSaving] = useState(false);

    const [hasPassword, setHasPassword] = useState(false);
    const [profile, setProfile] = useState({
        displayName: '',
        phone: '',
        email: '',
    });

    useEffect(() => {
        if (!auth.currentUser) return;
        loadProfile();
    }, [auth.currentUser?.uid]);

    const loadProfile = async () => {
        try {
            const uid = auth.currentUser?.uid || '';
            const email = auth.currentUser?.email || '';
            const docRef = doc(db, 'profiles', uid);
            const userRef = doc(db, 'users', uid);
            const [snap, userSnap] = await Promise.all([
                getDoc(docRef).catch(() => null),
                getDoc(userRef).catch(() => null)
            ]);

            const savedName = (snap?.exists() ? (snap.data().displayName || snap.data().name) : '') ||
                              (userSnap?.exists() ? (userSnap.data().displayName || userSnap.data().name) : '') ||
                              owner.userDisplayName ||
                              auth.currentUser?.displayName || '';

            setProfile({
                displayName: savedName,
                phone: (snap?.exists() ? snap.data().phone : userSnap?.data()?.phone) || '',
                email: email,
            });

            if (email || uid) {
                try {
                    const res = await fetch(`/api/auth/status?uid=${uid}&email=${encodeURIComponent(email)}`);
                    const data = await res.json();
                    if (data.hasPassword) {
                        setHasPassword(true);
                        setNewPassword('••••••••');
                    }
                } catch (err) {}
            }
        } catch (e) {
            console.error('Load profile error:', e);
        }
    };

    const handleSave = async () => {
        if (!auth.currentUser?.uid) return;
        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            const newName = profile.displayName.trim();
            const newPhone = profile.phone.trim();

            // 1. Update Firebase Auth User Display Name
            if (auth.currentUser) {
                await updateProfile(auth.currentUser, { displayName: newName }).catch((err) => console.warn('updateProfile warn:', err));
            }

            // 2. Update Firestore 'profiles' collection
            await setDoc(doc(db, 'profiles', uid), {
                displayName: newName,
                name: newName,
                phone: newPhone,
                email: auth.currentUser.email || '',
                updatedAt: serverTimestamp(),
            }, { merge: true });

            // 3. Update Firestore 'users' collection
            await setDoc(doc(db, 'users', uid), {
                displayName: newName,
                name: newName,
                phone: newPhone,
                updatedAt: serverTimestamp(),
            }, { merge: true }).catch(() => {});

            // 4. Update Backend SQLite DB (profiles & users tables) on VPS via apiClient (handles auth)
            try {
                await setDocument('profiles', uid, {
                    id: uid,
                    displayName: newName,
                    name: newName,
                    phone: newPhone,
                    email: auth.currentUser.email || '',
                    updatedAt: new Date().toISOString(),
                });
                await updateDocument('users', uid, {
                    displayName: newName,
                    name: newName,
                    phone: newPhone,
                    updatedAt: new Date().toISOString(),
                });
            } catch (err) {
                console.warn('Backend SQLite sync notice:', err);
            }

            // 5. Update backend /api/auth/update-profile via Admin SDK
            try {
                await fetch('/api/auth/update-profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uid, displayName: newName, phone: newPhone })
                });
            } catch (err) {
                console.warn('update-profile API notice:', err);
            }

            // 6. Update local session & dispatch event for immediate UI reactivity
            try {
                const sessionStr = localStorage.getItem('dunvex_user_session');
                const sessionObj = sessionStr ? JSON.parse(sessionStr) : {};
                sessionObj.displayName = newName;
                localStorage.setItem('dunvex_user_session', JSON.stringify(sessionObj));
                window.dispatchEvent(new CustomEvent('dunvex_profile_updated', { detail: { displayName: newName, phone: newPhone } }));
            } catch (e) {}

            setSaved(true);
            showToast('✅ Đã lưu thông tin cá nhân!', 'success');
            setTimeout(() => setSaved(false), 2000);
        } catch (e: any) {
            showToast('❌ Lỗi: ' + (e.message || 'Không lưu được'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSetPassword = async () => {
        if (!auth.currentUser) {
            showToast('❌ Bạn chưa đăng nhập!', 'error');
            return;
        }
        if (newPassword === '••••••••') {
            showToast('💡 Mật khẩu của bạn đã được lưu sẵn. Vui lòng nhập mật khẩu mới nếu muốn thay đổi!', 'info');
            return;
        }
        if (!newPassword || newPassword.length < 6) {
            showToast('❌ Mật khẩu phải có ít nhất 6 ký tự!', 'error');
            return;
        }
        setPasswordSaving(true);
        try {
            const user = auth.currentUser;
            const email = user.email || '';
            if (!email) {
                showToast('❌ Tài khoản của bạn không có Email để đặt mật khẩu!', 'error');
                return;
            }

            // Mã hóa scrypt & lưu trực tiếp vào CSDL SQLite (dunvex.db) trên máy chủ VPS
            const res = await fetch('/api/auth/set-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uid: user.uid,
                    email: email,
                    password: newPassword
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast('✅ Đã mã hóa và lưu mật khẩu mới vào CSDL SQLite thành công!', 'success');
                setHasPassword(true);
                setNewPassword('••••••••');
            } else {
                throw new Error(data.error || 'Lưu mật khẩu thất bại');
            }
        } catch (e: any) {
            console.error('Set password error:', e);
            showToast('❌ Lỗi: ' + (e?.message || 'Không thiết lập được mật khẩu'), 'error');
        } finally {
            setPasswordSaving(false);
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

                {/* Avatar */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-black shadow-lg mb-3">
                        {profile.displayName?.charAt(0)?.toUpperCase() || auth.currentUser?.email?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
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

                {/* 🔒 Thiết lập mật khẩu PWA */}
                <div className="mt-6 p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2">
                        Thiết lập mật khẩu đăng nhập PWA
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                        Đặt mật khẩu để bạn có thể đăng nhập bằng Email trực tiếp trên ứng dụng màn hình chính (PWA) mà không cần qua Google.
                    </p>
                    <div className="space-y-3">
                        {hasPassword && (
                            <div className="px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                <span>Tài khoản đã có mật khẩu mã hóa trên CSDL VPS</span>
                            </div>
                        )}
                        <div className="relative">
                            <input
                                id="new-password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                value={newPassword}
                                onFocus={() => {
                                    if (newPassword === '••••••••') {
                                        setNewPassword('');
                                    }
                                }}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder={hasPassword ? "Nhập mật khẩu mới để thay đổi" : "Nhập mật khẩu mới (tối thiểu 6 ký tự)"}
                                autoComplete="current-password"
                                className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono"
                                disabled={passwordSaving}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1.5 rounded-lg focus:outline-none"
                                title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        <button
                            onClick={handleSetPassword}
                            disabled={passwordSaving || !newPassword}
                            className="w-full py-3 bg-slate-800 hover:bg-slate-900 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {passwordSaving ? 'Đang lưu...' : hasPassword ? 'Cập nhật mật khẩu mới' : 'Đặt mật khẩu'}
                        </button>
                    </div>
                </div>

                {/* 📱 PWA Pin App Card */}
                <div className="mt-5 p-5 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-900 dark:to-indigo-950/20 border border-indigo-100/80 dark:border-indigo-900/30 rounded-3xl shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-indigo-500 text-white rounded-2xl shadow-md">
                            <span className="material-symbols-outlined text-2xl font-bold">install_mobile</span>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Ghim ứng dụng ra MH chính</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">Chạy toàn màn hình, mượt mà và tiết kiệm dữ liệu như một ứng dụng gốc trên điện thoại.</p>
                            <button 
                                onClick={() => window.dispatchEvent(new CustomEvent('pin-app'))}
                                className="mt-3.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all active:scale-95 shadow-sm shadow-indigo-500/20 cursor-pointer"
                            >
                                Xem hướng dẫn ghim app
                            </button>
                        </div>
                    </div>
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
