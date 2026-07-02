import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Mail, Save, ArrowLeft, Shield, CheckCircle2, MapPin } from 'lucide-react';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useOwner } from '../hooks/useOwner';
import { useToast } from '../components/shared/Toast';

const Profile = () => {
    const navigate = useNavigate();
    const owner = useOwner();
    const { showToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const [profile, setProfile] = useState({
        displayName: '',
        phone: '',
        email: '',
        bankCode: '',
        bankAccountNumber: '',
        bankAccountName: ''
    });

    useEffect(() => {
        if (!auth.currentUser) return;
        loadProfile();
    }, [auth.currentUser?.uid]);

    const loadProfile = async () => {
        try {
            const uid = auth.currentUser?.uid || '';
            const docRef = doc(db, 'profiles', uid);
            const snap = await getDoc(docRef);

            setProfile({
                displayName: snap.exists() ? (snap.data().displayName || '') : (auth.currentUser?.displayName || ''),
                phone: snap.exists() ? (snap.data().phone || '') : '',
                email: auth.currentUser?.email || '',
                bankCode: snap.exists() ? (snap.data().bankCode || '') : '',
                bankAccountNumber: snap.exists() ? (snap.data().bankAccountNumber || '') : '',
                bankAccountName: snap.exists() ? (snap.data().bankAccountName || '') : '',
            });
        } catch (e) {
            console.error('Load profile error:', e);
        }
    };

    const handleSave = async () => {
        if (!auth.currentUser?.uid) return;
        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            await setDoc(doc(db, 'profiles', uid), {
                displayName: profile.displayName.trim(),
                phone: profile.phone.trim(),
                email: auth.currentUser.email || '',
                bankCode: profile.bankCode.trim(),
                bankAccountNumber: profile.bankAccountNumber.trim(),
                bankAccountName: profile.bankAccountName.trim().toUpperCase(),
                updatedAt: serverTimestamp(),
            }, { merge: true });

            setSaved(true);
            showToast('✅ Đã lưu thông tin cá nhân!', 'success');
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

                    {/* Bank Info */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                        <h3 className="text-sm font-black uppercase text-slate-700 dark:text-slate-300">Thông tin nhận lương</h3>
                        
                        <div>
                            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Ngân hàng</label>
                            <select
                                value={profile.bankCode}
                                onChange={(e) => setProfile(prev => ({ ...prev, bankCode: e.target.value }))}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            >
                                <option value="">-- Chọn ngân hàng --</option>
                                <option value="MB">MBBank (Quân Đội)</option>
                                <option value="VCB">Vietcombank</option>
                                <option value="TCB">Techcombank</option>
                                <option value="ACB">ACB</option>
                                <option value="VTB">VietinBank</option>
                                <option value="BIDV">BIDV</option>
                                <option value="VPB">VPBank</option>
                                <option value="STB">Sacombank</option>
                                <option value="TPB">TPBank</option>
                                <option value="VIB">VIB</option>
                                <option value="HDB">HDBank</option>
                                <option value="SHB">SHB</option>
                                <option value="SEA">SeABank</option>
                                <option value="VBA">Agribank</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Số tài khoản</label>
                                <input
                                    type="text"
                                    value={profile.bankAccountNumber}
                                    onChange={(e) => setProfile(prev => ({ ...prev, bankAccountNumber: e.target.value }))}
                                    placeholder="VD: 123456789"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Tên chủ tài khoản</label>
                                <input
                                    type="text"
                                    value={profile.bankAccountName}
                                    onChange={(e) => setProfile(prev => ({ ...prev, bankAccountName: e.target.value.toUpperCase() }))}
                                    placeholder="VD: NGUYEN VAN A"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all uppercase"
                                />
                            </div>
                        </div>
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

            {/* 📍 Lịch sử chấm công */}
            <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-6">
                <CheckinHistory />
            </div>
        </div>
    );
};

// ==================== LỊCH SỬ CHẤM CÔNG CÁ NHÂN ====================
const CheckinHistory = () => {
    const [checkins, setCheckins] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth.currentUser?.uid) return;
        loadCheckins();
    }, [auth.currentUser?.uid]);

    const loadCheckins = async () => {
        setLoading(true);
        try {
            const q = query(
                collection(db, 'checkins'),
                where('userEmail', '==', auth.currentUser?.email || ''),
                orderBy('createdAt', 'desc'),
                limit(50)
            );
            const snap = await getDocs(q);
            setCheckins(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error('Checkin history error:', e);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (d: any) => {
        const dt = d?.toDate?.() || new Date(d);
        return dt.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const formatTime = (d: any) => {
        const dt = d?.toDate?.() || new Date(d);
        return dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    const purposeLabel = (p: string) => {
        if (!p) return 'Không rõ';
        if (p.includes('Check-in')) return '🏢 Vào ca';
        if (p.includes('Hiện trường') || p.includes('checkin')) return '🏗️ Hiện trường';
        if (p.includes('Gặp') || p.includes('Khảo sát')) return '🤝 Gặp KH';
        return p;
    };

    return (
        <div>
            <h3 className="text-sm font-black uppercase text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                <MapPin size={16} className="text-indigo-500" /> Lịch sử chấm công
            </h3>
            {loading ? (
                <div className="text-center py-6 text-slate-400 text-xs">Đang tải...</div>
            ) : checkins.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">Chưa có lịch sử chấm công</div>
            ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                    {checkins.map((c, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                                <MapPin size={14} className="text-indigo-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                                    {purposeLabel(c.purpose)}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                    {c.customerName || c.customerBusinessName || 'Vãng lai'}
                                    {c.note ? ` — "${c.note}"` : ''}
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-[10px] font-bold text-slate-500">{formatDate(c.createdAt)}</p>
                                <p className="text-[9px] text-slate-400">{formatTime(c.createdAt)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Profile;
