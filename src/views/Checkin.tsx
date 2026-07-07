import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { addDoc, serverTimestamp, deleteDoc, doc, collection } from 'firebase/firestore';
import { useCustomers } from '../hooks/useCustomers';
import { useCheckins } from '../hooks/useCheckins';
import { MapPin, User, Camera, CheckCircle2, ArrowLeft } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icon issue
const createCustomIcon = (purpose: string, hasImage: boolean) => {
    let color = '#f27121';
    let icon = 'location_on';
    let centerIcon = hasImage ? 'photo_camera' : 'check';
    switch (purpose) {
        case 'Khách mới': color = '#10b981'; icon = 'person_add'; break;
        case 'Khiếu nại': color = '#ef4444'; icon = 'report'; break;
        case 'Viếng thăm': color = '#8b5cf6'; icon = 'visibility'; break;
        case 'Thăm hỏi': color = '#1A237E'; icon = 'volunteer_activism'; break;
    }
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="flex flex-col items-center group"><div class="relative"><div class="absolute -inset-3 rounded-full blur-lg opacity-30 animate-pulse" style="background-color:${color}"></div><span class="material-symbols-outlined text-5xl relative z-10 drop-shadow-[0_5px_15px_rgba(0,0,0,0.3)]" style="color:${color}">${icon}</span><div class="absolute top-3 left-1/2 -translate-x-1/2 size-4 bg-white rounded-full flex items-center justify-center z-20 shadow-lg border border-slate-50"><span class="material-symbols-outlined text-[10px] font-black" style="color:${color}">${centerIcon}</span></div></div></div>`,
        iconSize: [45, 45],
        iconAnchor: [22, 45],
        popupAnchor: [0, -45]
    });
};

const calculateDistance = (lat1: any, lon1: any, lat2: any, lon2: any) => {
    const R = 6371e3;
    const rLat1 = Number(lat1) * Math.PI / 180;
    const rLat2 = Number(lat2) * Math.PI / 180;
    const dLat = (Number(lat2) - Number(lat1)) * Math.PI / 180;
    const dLon = (Number(lon2) - Number(lon1)) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const MapUpdater = ({ center }: { center: [number, number], sidebarExpanded?: boolean }) => {
    const map = useMap();
    useEffect(() => { map.setView(center, map.getZoom() || 13); }, [center, map]);
    useEffect(() => { const t = setTimeout(() => map.invalidateSize(), 300); return () => clearTimeout(t); }, [map]);
    return null;
};

import { useOwner } from '../hooks/useOwner';
import { useToast } from '../components/shared/Toast';

const MapInstanceTracker = ({ setMapInstance }: { setMapInstance: (map: L.Map) => void }) => {
    const map = useMap();
    useEffect(() => { if (map) setMapInstance(map); }, [map, setMapInstance]);
    return null;
};

const Checkin = () => {
    const navigate = useNavigate();
    const { search } = useLocation();
    const owner = useOwner();
    const { showToast } = useToast();

    const { customers, loading: custLoading } = useCustomers({ ownerId: owner.ownerId, enabled: !owner.loading && !!owner.ownerId });
    const { checkins: recentCheckins, loading: checkLoading } = useCheckins({ ownerId: owner.ownerId, enabled: !owner.loading && !!owner.ownerId, maxResults: 500 });
    const [submitting, setSubmitting] = useState(false);
    const [showCheckinForm, setShowCheckinForm] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [mapCenter, setMapCenter] = useState<[number, number]>([11.9931, 107.5257]);
    const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [isFilterExpanded, setIsFilterExpanded] = useState(false);
    const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

    const setDatePreset = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'all') => {
        const now = new Date(); let start = ''; const end = new Date().toISOString().split('T')[0];
        switch (preset) {
            case 'today': start = end; break;
            case 'yesterday': const y = new Date(now); y.setDate(now.getDate()-1); start = y.toISOString().split('T')[0]; break;
            case 'week': const w = new Date(now); w.setDate(now.getDate()-7); start = w.toISOString().split('T')[0]; break;
            case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]; break;
            case 'all': start = '2020-01-01'; break;
        }
        setDateRange({ start, end }); setCurrentPage(1);
    };

    useEffect(() => {
        const params = new URLSearchParams(search);
        if (params.get('new') === 'true') { setShowCheckinForm(true); navigate('/checkin', { replace: true }); }
    }, [search, navigate]);

    const [formData, setFormData] = useState({ customerId: '', customerName: '', note: '', location: null as { lat: number, lng: number } | null, address: '', purpose: 'Viếng thăm', imageUrls: [] as string[] });
    const [searchCustomerQuery, setSearchCustomerQuery] = useState('');
    const [gettingLocation, setGettingLocation] = useState(false);
    const [uploading, setUploading] = useState(false);
    const customerSearchRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const h = (e: MouseEvent) => { if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) setSheetOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const getImageUrl = (url: string) => {
        if (!url) return '';
        if (url.includes('drive.google.com')) { const m = url.match(/[-\w]{25,}/); if (m) return `https://drive.google.com/thumbnail?id=${m[0]}&sz=w1000`; }
        return url;
    };

    const handleDeleteCheckin = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm("Xóa check-in này?")) { try { await deleteDoc(doc(db, 'checkins', id)); } catch (err) { showToast("Lỗi xóa", "error"); } }
    };

    const mapCenterSet = React.useRef(false);
    useEffect(() => { if (!mapCenterSet.current && recentCheckins.length > 0 && recentCheckins[0]?.location) { setMapCenter([recentCheckins[0].location.lat, recentCheckins[0].location.lng]); mapCenterSet.current = true; } }, [recentCheckins]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files; if (!files || files.length === 0) return;
        const currentCount = formData.imageUrls.length;
        const filesToAdd = Array.from(files).slice(0, 3 - currentCount);
        if (filesToAdd.length === 0) { showToast("Tối đa 3 ảnh", "warning"); return; }
        setUploading(true);
        try {
            const uploadPromises = filesToAdd.map(async (file) => {
                const fData = new FormData(); fData.append('file', file); fData.append('upload_preset', 'dunvexbuil'); fData.append('folder', 'dunvex_checkins');
                const res = await fetch('https://api.cloudinary.com/v1_1/dtx0uvb4e/image/upload', { method: 'POST', body: fData });
                const result = await res.json(); return result.secure_url;
            });
            const urls = await Promise.all(uploadPromises);
            setFormData(p => ({ ...p, imageUrls: [...p.imageUrls, ...urls.filter(Boolean)] }));
            showToast("Tải ảnh thành công", "success");
        } catch (err: any) { showToast("Lỗi upload", "error"); } finally { setUploading(false); e.target.value = ''; }
    };

    const removeImage = (idx: number) => setFormData(p => ({ ...p, imageUrls: p.imageUrls.filter((_, i) => i !== idx) }));

    const handleGetLocation = () => {
        if (!navigator.geolocation) { showToast("Trình duyệt không hỗ trợ GPS", "error"); return; }
        setGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                setFormData(p => ({ ...p, location: { lat: latitude, lng: longitude } }));
                if (mapInstance) mapInstance.flyTo([latitude, longitude], 17, { duration: 1.5 });
                else setMapCenter([latitude, longitude]);
                try {
                    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18`);
                    const d = await r.json();
                    if (d?.display_name) setFormData(p => ({ ...p, address: d.display_name }));
                } catch (err) {
                    setFormData(p => ({ ...p, address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` }));
                } finally { setGettingLocation(false); }
            },
            (err) => {
                setGettingLocation(false);
                let msg = "Không thể lấy vị trí.";
                if (err.code === 1) msg = "Vui lòng cấp quyền GPS.";
                else if (err.code === 2) msg = "Không tìm thấy tín hiệu GPS.";
                else if (err.code === 3) msg = "Hết thời gian. Thử lại.";
                showToast(msg, "warning");
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handleSubmitCheckin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.customerId || !formData.location) { showToast("Vui lòng chọn KH và lấy vị trí!", "warning"); return; }
        const customer = customers.find(c => c.id === formData.customerId);
        if (customer) {
            const cLat = customer.lat ?? customer.latitude;
            const cLng = customer.lng ?? customer.longitude;
            if (cLat && cLng) {
                const dist = calculateDistance(formData.location.lat, formData.location.lng, cLat, cLng);
                if (dist > 50) { showToast(`Bạn cách KH ${Math.round(dist)}m. Di chuyển gần hơn!`, "warning"); return; }
            }
        }
        setSubmitting(true);
        try {
            await addDoc(collection(db, 'checkins'), {
                ...formData,
                imageUrl: formData.imageUrls[0] || '',
                customerName: customer?.name || 'Vãng lai',
                customerBusinessName: customer?.name || '',
                userId: auth.currentUser?.uid || "",
                userEmail: auth.currentUser?.email,
                ownerId: owner.ownerId,
                ownerEmail: owner.ownerEmail,
                createdAt: serverTimestamp()
            });
            await addDoc(collection(db, 'audit_logs'), {
                action: 'Check-in KH',
                user: auth.currentUser?.displayName || auth.currentUser?.email || 'NV',
                userId: auth.currentUser?.uid || "",
                ownerId: owner.ownerId,
                details: `Check-in tại ${customer?.name || 'Vãng lai'} - ${formData.purpose}`,
                createdAt: serverTimestamp()
            });
            setShowCheckinForm(false);
            setFormData({ customerId: '', customerName: '', note: '', location: null, address: '', purpose: 'Viếng thăm', imageUrls: [] });
            setSearchCustomerQuery('');
            showToast("Checkin thành công!", "success");
        } catch (err) { showToast("Lỗi lưu dữ liệu.", "error"); } finally { setSubmitting(false); }
    };

    if (owner.loading) return null;

    const hasPermission = owner.role === 'admin' || (owner.accessRights?.checkin_create ?? true);
    if (!hasPermission) {
        return (
            <div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-slate-950 items-center justify-center p-8 min-h-screen">
                <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-full text-purple-500 mb-4"><span className="material-symbols-outlined text-5xl">lock</span></div>
                <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase mb-2">Không có quyền</h2>
                <p className="text-slate-400 text-sm">Bạn không có quyền checkin.</p>
            </div>
        );
    }

    // === FILTERED CHECKINS ===
    const filtered = recentCheckins.filter(item => {
        const itemDate = item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const matchDate = itemDate >= dateRange.start && itemDate <= dateRange.end;
        const matchSearch = (item.customerBusinessName || item.customerName || item.purpose || '').toLowerCase().includes(searchQuery.toLowerCase());
        return matchDate && matchSearch;
    });

    return (
        <div className="relative w-full h-[100dvh] overflow-hidden bg-black">
            {/* === FULL-SCREEN MAP === */}
            <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false} className="z-0">
                <MapInstanceTracker setMapInstance={setMapInstance} />
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
                />
                <MapUpdater center={mapCenter} />
                {formData.location && (
                    <Marker position={[formData.location.lat, formData.location.lng]}
                        icon={L.divIcon({ className: '', html: `<div class="relative flex items-center justify-center"><div class="absolute inset-0 size-8 bg-[#f27121]/30 rounded-full animate-ping"></div><div class="size-4 bg-[#f27121] rounded-full border-2 border-white shadow-lg relative z-10"></div></div>`, iconSize: [32,32], iconAnchor: [16,16] })}>
                        <Popup><p className="text-[10px] font-black uppercase text-[#f27121]">Vị trí đang chọn</p></Popup>
                    </Marker>
                )}
                {filtered.map(c => {
                    const la = c.location?.lat ?? c.location?.latitude; const lo = c.location?.lng ?? c.location?.longitude;
                    if (la === undefined || lo === undefined) return null;
                    return (
                        <Marker key={c.id} position={[la, lo]} icon={createCustomIcon(c.purpose, !!c.imageUrl)}>
                            <Popup className="custom-popup">
                                <div className="p-1 min-w-[140px]">
                                    <p className="font-black text-[#1A237E] uppercase text-[10px] mb-1">{c.customerBusinessName || c.customerName}</p>
                                    <p className="text-[9px] text-slate-500 mb-2">{c.purpose}</p>
                                    {(c.imageUrls || (c.imageUrl ? [c.imageUrl] : [])).slice(0,1).map((url: string, i: number) => <img key={i} src={getImageUrl(url)} className="w-full h-20 object-cover rounded-lg mb-2" alt="" referrerPolicy="no-referrer" />)}
                                    <p className="text-[8px] text-slate-400 italic">"{c.note || ''}"</p>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>

            {/* === GLASS TOP BAR === */}
            <div className="absolute top-0 left-0 right-0 z-[1000] p-3 safe-top">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate(-1)}
                        className="size-10 flex items-center justify-center rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl shadow-lg border border-white/20 dark:border-slate-700/50 text-slate-500 active:scale-95 transition-all">
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex-1 flex items-center justify-between bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl rounded-2xl px-4 h-10 shadow-lg border border-white/20 dark:border-slate-700/50">
                        <h1 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Checkin Map</h1>
                        <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
                            <button onClick={() => setActiveTab('map')}
                                className={`px-3 py-1.5 rounded-[10px] text-[9px] font-black uppercase tracking-wider transition-all ${activeTab === 'map' ? 'bg-[#f27121] text-white shadow-md' : 'text-slate-400'}`}>Map</button>
                            <button onClick={() => setActiveTab('list')}
                                className={`px-3 py-1.5 rounded-[10px] text-[9px] font-black uppercase tracking-wider transition-all ${activeTab === 'list' ? 'bg-[#f27121] text-white shadow-md' : 'text-slate-400'}`}>List</button>
                        </div>
                    </div>
                    <button onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                        className={`size-10 flex items-center justify-center rounded-2xl backdrop-blur-xl shadow-lg border border-white/20 dark:border-slate-700/50 active:scale-95 transition-all ${isFilterExpanded ? 'bg-[#f27121] text-white border-[#f27121]' : 'bg-white/85 dark:bg-slate-900/85 text-slate-500'}`}>
                        <span className="material-symbols-outlined text-lg">tune</span>
                    </button>
                </div>
            </div>

            {/* === FLOATING FILTER DROPDOWN === */}
            <AnimatePresence>
                {isFilterExpanded && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="absolute top-16 left-3 right-3 z-[1000]">
                        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-white/20 dark:border-slate-700/50">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-slate-400 text-sm">search</span>
                                <input className="flex-1 bg-transparent border-none text-xs font-bold outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400"
                                    placeholder="Tìm theo tên, mục đích..." value={searchQuery}
                                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {(['today','yesterday','week','month','all'] as const).map(p => (
                                    <button key={p} onClick={() => setDatePreset(p)}
                                        className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-[#f27121] hover:text-white active:scale-95 transition-all">
                                        {p === 'today' ? 'Hôm nay' : p === 'yesterday' ? 'Hôm qua' : p === 'week' ? '7 ngày' : p === 'month' ? '30 ngày' : 'Tất cả'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* === LIST BOTTOM SHEET === */}
            <AnimatePresence>
                {activeTab === 'list' && (
                    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="absolute bottom-0 left-0 right-0 z-[1000] max-h-[65vh] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-t-[2rem] shadow-2xl border-t border-white/20 dark:border-slate-700/50 overflow-hidden flex flex-col">
                        <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" /></div>
                        <div className="flex gap-2 px-4 mb-3">
                            <div className="flex-1 bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                                <p className="text-[8px] font-black text-slate-400 uppercase">Tổng</p>
                                <p className="text-lg font-black text-[#1A237E] dark:text-indigo-400">{recentCheckins.length}</p>
                            </div>
                            <div className="flex-1 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3 text-center">
                                <p className="text-[8px] font-black text-orange-400 uppercase">7 ngày</p>
                                <p className="text-lg font-black text-[#f27121]">{recentCheckins.filter(c => { const d = c.createdAt?.seconds ? new Date(c.createdAt.seconds*1000) : new Date(); return (new Date().getTime()-d.getTime()) < 7*24*60*60*1000; }).length}</p>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-2">
                            {filtered.length === 0 ? (
                                <p className="text-center text-slate-300 font-bold text-sm py-10">Không có checkin nào</p>
                            ) : (
                                <>
                                    {filtered.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage).map(c => (
                                        <div key={c.id} className="flex gap-3 bg-slate-50 dark:bg-slate-800 rounded-2xl p-3">
                                            <div className="size-10 rounded-xl bg-gradient-to-br from-[#1A237E] to-blue-900 text-white flex items-center justify-center font-black text-sm shrink-0">{(c.customerBusinessName || c.customerName || '?')[0]}</div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-black text-slate-800 dark:text-white truncate">{c.customerBusinessName || c.customerName}</p>
                                                <p className="text-[10px] text-slate-400">{c.purpose} • {c.address?.split(',')[0] || '—'}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-[10px] text-slate-400">{c.createdAt?.seconds ? new Date(c.createdAt.seconds*1000).toLocaleDateString('vi-VN') : ''}</p>
                                                <button onClick={(e) => handleDeleteCheckin(c.id, e)} className="text-slate-300 hover:text-red-500"><span className="material-symbols-outlined text-sm">delete</span></button>
                                            </div>
                                        </div>
                                    ))}
                                    {Math.ceil(filtered.length/itemsPerPage) > 1 && (
                                        <div className="flex justify-center gap-1 pt-3">
                                            {[...Array(Math.ceil(filtered.length/itemsPerPage))].map((_, i) => (
                                                <button key={i} onClick={() => setCurrentPage(i+1)} className={`size-7 rounded-lg text-[10px] font-bold ${currentPage===i+1 ? 'bg-[#f27121] text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>{i+1}</button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* === RIGHT FLOATING CONTROLS === */}
            <div className="absolute bottom-28 right-3 flex flex-col gap-2 z-[1000]">
                <button onClick={() => mapInstance?.zoomIn()} className="size-9 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl rounded-2xl shadow-lg flex items-center justify-center text-slate-500 border border-white/20 dark:border-slate-700/50 active:scale-90"><span className="material-symbols-outlined text-lg">add</span></button>
                <button onClick={() => mapInstance?.zoomOut()} className="size-9 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl rounded-2xl shadow-lg flex items-center justify-center text-slate-500 border border-white/20 dark:border-slate-700/50 active:scale-90"><span className="material-symbols-outlined text-lg">remove</span></button>
                <button onClick={handleGetLocation} className={`size-9 rounded-2xl shadow-lg flex items-center justify-center border border-white/20 dark:border-slate-700/50 active:scale-90 ${gettingLocation ? 'bg-orange-100 text-orange-500 animate-pulse' : 'bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl text-[#f27121]'}`}><span className="material-symbols-outlined text-lg">{gettingLocation ? 'sync' : 'my_location'}</span></button>
            </div>

            {/* === FLOATING CHECKIN BUTTON === */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000]">
                <button onClick={() => setShowCheckinForm(true)}
                    className="flex items-center gap-2 bg-[#f27121] hover:bg-orange-600 text-white px-6 py-3.5 rounded-full shadow-[0_10px_30px_rgba(242,113,33,0.4)] transition-all active:scale-95 font-black text-xs uppercase tracking-[2px]">
                    <span className="material-symbols-outlined">add_location_alt</span>Checkin
                </button>
            </div>

            {/* === CHECKIN FORM MODAL === */}
            <AnimatePresence>
                {showCheckinForm && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/50 backdrop-blur-md z-[2000]" onClick={() => setShowCheckinForm(false)} />
                        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="absolute bottom-0 left-0 right-0 z-[2001] max-h-[85vh] bg-white dark:bg-slate-900 rounded-t-[2.5rem] overflow-hidden flex flex-col shadow-2xl">
                            <div className="sticky top-0 bg-white dark:bg-slate-900 z-10 px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <h3 className="text-lg font-black uppercase text-slate-800 dark:text-white">Checkin Mới</h3>
                                <button onClick={() => setShowCheckinForm(false)} className="size-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400"><span className="material-symbols-outlined">close</span></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Khách hàng</label>
                                    <div className="relative" ref={customerSearchRef}>
                                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 focus-within:ring-2 focus-within:ring-[#f27121]/30 transition-all">
                                            <User size={16} className="text-slate-400 shrink-0" />
                                            <input type="text" className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-slate-700 dark:text-slate-200 placeholder-slate-400"
                                                placeholder="Nhập tên khách hàng..." value={formData.customerName}
                                                onChange={e => { setFormData(p => ({ ...p, customerName: e.target.value })); setSheetOpen(true); }}
                                                onFocus={() => setSheetOpen(true)} />
                                        </div>
                                        {sheetOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl max-h-48 overflow-y-auto z-50">
                                                {customers.filter(c => (c.name || '').toLowerCase().includes((formData.customerName || '').toLowerCase())).slice(0, 8).map(c => (
                                                    <button key={c.id} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between"
                                                        onClick={() => { setFormData(p => ({ ...p, customerName: c.name, customerId: c.id, address: c.address || '' })); setSheetOpen(false); }}>
                                                        <span className="text-sm font-bold">{c.name}</span>
                                                        <span className="text-[9px] text-slate-400">{c.address?.split(',')[0]}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mục đích</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['Khách mới', 'Chăm sóc', 'Khiếu nại', 'Viếng thăm'].map(p => (
                                            <button key={p} onClick={() => setFormData(pv => ({ ...pv, purpose: p }))}
                                                className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all ${formData.purpose === p ? 'bg-[#1A237E] dark:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-500'}`}>{p}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Địa chỉ</label>
                                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 focus-within:ring-2 focus-within:ring-[#f27121]/30 transition-all">
                                        <MapPin size={16} className="text-slate-400 shrink-0" />
                                        <input type="text" className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-slate-700 dark:text-slate-200 placeholder-slate-400"
                                            placeholder="Địa chỉ..." value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ghi chú</label>
                                    <textarea className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-[#f27121]/30 resize-none text-slate-700 dark:text-slate-200 placeholder-slate-400"
                                        rows={3} placeholder="Ghi chú..." value={formData.note} onChange={e => setFormData(p => ({ ...p, note: e.target.value }))} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hình ảnh</label>
                                    <div className="flex gap-2">
                                        <button onClick={() => { const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.multiple=true; inp.onchange=(e:any) => handleImageUpload(e); inp.click(); }}
                                            className="flex-1 py-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-slate-500">
                                            <Camera size={16} /> Chụp ảnh</button>
                                        <button onClick={() => { const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.multiple=true; inp.onchange=(e:any) => handleImageUpload(e); inp.click(); }}
                                            className="flex-1 py-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-slate-500">
                                            <span className="material-symbols-outlined text-base">photo_library</span> Thư viện</button>
                                    </div>
                                    {formData.imageUrls.length > 0 && (
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {formData.imageUrls.map((img, i) => (
                                                <div key={i} className="relative shrink-0">
                                                    <img src={img} className="w-20 h-20 object-cover rounded-xl" alt="" />
                                                    <button onClick={() => removeImage(i)} className="absolute -top-2 -right-2 size-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px]">×</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="sticky bottom-0 bg-white dark:bg-slate-900 p-6 border-t border-slate-100 dark:border-slate-800">
                                <button onClick={handleSubmitCheckin} disabled={submitting}
                                    className="w-full py-4 bg-[#f27121] hover:bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm transition-all disabled:opacity-50 active:scale-[0.98] shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2">
                                    <CheckCircle2 size={18} />{submitting ? 'Đang lưu...' : 'Xác nhận Checkin'}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Checkin;
