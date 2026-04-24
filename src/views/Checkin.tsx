import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, where, limit, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { MapPin, User, FileText, Camera, CheckCircle2, Navigation2, History, ArrowLeft } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icon issue
const createCustomIcon = (purpose: string, hasImage: boolean) => {
    let color = '#f27121';
    let icon = 'location_on';
    let centerIcon = hasImage ? 'photo_camera' : 'check';

    switch (purpose) {
        case 'Khách mới':
            color = '#10b981'; // Emerald Green
            icon = 'person_add';
            break;
        case 'Khiếu nại':
            color = '#ef4444'; // Red
            icon = 'report';
            break;
        case 'Viếng thăm':
            color = '#8b5cf6'; // Purple
            icon = 'visibility';
            break;
        case 'Thăm hỏi':
            color = '#1A237E'; // Navy
            icon = 'volunteer_activism';
            break;
    }

    return L.divIcon({
        className: 'custom-div-icon',
        html: `
            <div class="flex flex-col items-center group">
                <div class="relative">
                    <div class="absolute -inset-3 rounded-full blur-lg opacity-30 animate-pulse" style="background-color: ${color}"></div>
                    <span class="material-symbols-outlined text-5xl relative z-10 drop-shadow-[0_5px_15px_rgba(0,0,0,0.3)]" style="color: ${color}">${icon}</span>
                    <div class="absolute top-3 left-1/2 -translate-x-1/2 size-4 bg-white rounded-full flex items-center justify-center z-20 shadow-lg border border-slate-50">
                        <span class="material-symbols-outlined text-[10px] font-black" style="color: ${color}">${centerIcon}</span>
                    </div>
                </div>
            </div>
        `,
        iconSize: [45, 45],
        iconAnchor: [22, 45],
        popupAnchor: [0, -45]
    });
};

// Helper to calculate distance in meters (Haversine formula)
const calculateDistance = (lat1: any, lon1: any, lat2: any, lon2: any) => {
    const R = 6371e3; // metres
    const rLat1 = Number(lat1) * Math.PI / 180;
    const rLat2 = Number(lat2) * Math.PI / 180;
    const dLat = (Number(lat2) - Number(lat1)) * Math.PI / 180;
    const dLon = (Number(lon2) - Number(lon1)) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(rLat1) * Math.cos(rLat2) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
};

// Helper to update map center and handle resize
const MapUpdater = ({ center, sidebarExpanded }: { center: [number, number], sidebarExpanded: boolean }) => {
    const map = useMap();
    useEffect(() => {
        const zoom = map.getZoom() || 13;
        map.setView(center, zoom);
    }, [center, map]);

    useEffect(() => {
        // Map needs a moment to initialize before invalidating size
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 300);
        return () => clearTimeout(timer);
    }, [map, sidebarExpanded]);

    return null;
};


import { useOwner } from '../hooks/useOwner';
import { useToast } from '../components/shared/Toast';

// Map instance tracker to get L.Map in v5
const MapInstanceTracker = ({ setMapInstance }: { setMapInstance: (map: L.Map) => void }) => {
    const map = useMap();
    useEffect(() => {
        if (map) setMapInstance(map);
    }, [map, setMapInstance]);
    return null;
};

const Checkin = () => {
    const navigate = useNavigate();
    const owner = useOwner();
    const { showToast } = useToast();

    const [customers, setCustomers] = useState<any[]>([]);
    const [recentCheckins, setRecentCheckins] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCheckinForm, setShowCheckinForm] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [mapCenter, setMapCenter] = useState<[number, number]>([11.9931, 107.5257]);
    const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');

    // Pagination & Filter States
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isFilterExpanded, setIsFilterExpanded] = useState(false);

    const setDatePreset = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'all') => {
        const now = new Date();
        let start = '';
        let end = new Date().toISOString().split('T')[0];

        switch (preset) {
            case 'today':
                start = end;
                break;
            case 'yesterday':
                const yesterday = new Date(now);
                yesterday.setDate(now.getDate() - 1);
                start = yesterday.toISOString().split('T')[0];
                end = start;
                break;
            case 'week':
                const weekAgo = new Date(now);
                weekAgo.setDate(now.getDate() - 7);
                start = weekAgo.toISOString().split('T')[0];
                break;
            case 'month':
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                start = monthStart.toISOString().split('T')[0];
                break;
            case 'all':
                start = '2020-01-01'; // Default far back
                break;
        }
        setDateRange({ start, end });
        setCurrentPage(1);
    };

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const { search } = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(search);
        if (params.get('new') === 'true') {
            setShowCheckinForm(true);
            navigate('/checkin', { replace: true });
        }
        if (params.get('action') === 'history') {
            setSheetOpen(true);
            setSidebarExpanded(true);
            navigate('/checkin', { replace: true });
        }
    }, [search, navigate]);

    const [formData, setFormData] = useState({
        customerId: '',
        customerName: '',
        note: '',
        location: null as { lat: number, lng: number } | null,
        address: '',
        purpose: 'Viếng thăm',
        imageUrls: [] as string[]
    });

    const [searchCustomerQuery, setSearchCustomerQuery] = useState('');
    const [showCustomerResults, setShowCustomerResults] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const customerSearchRef = React.useRef<HTMLDivElement>(null);

    // Handle outside click for customer search dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (customerSearchRef.current && !customerSearchRef.current.contains(event.target as Node)) {
                setShowCustomerResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [gettingLocation, setGettingLocation] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [sidebarExpanded, setSidebarExpanded] = useState(true);


    const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

    const getImageUrl = (url: string) => {
        if (!url) return '';
        if (url.includes('drive.google.com')) {
            const match = url.match(/[-\w]{25,}/);
            if (match) {
                return `https://drive.google.com/thumbnail?id=${match[0]}&sz=w1000`;
            }
        }
        return url;
    };

    const handleDeleteCheckin = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm("Bạn có chắc chắn muốn xóa check-in này không?")) {
            try {
                await deleteDoc(doc(db, 'checkins', id));
            } catch (error) {
                console.error("Error deleting checkin:", error);
                showToast("Lỗi khi xóa check-in", "error");
            }
        }
    };

    useEffect(() => {
        if (owner.loading || !owner.ownerId) return;

        const qCust = query(
            collection(db, 'customers'),
            where('ownerId', '==', owner.ownerId)
        );
        const unsubCust = onSnapshot(qCust, (snapshot) => {
            setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const qCheck = query(
            collection(db, 'checkins'),
            where('ownerId', '==', owner.ownerId),
            limit(100)
        );
        const unsubCheck = onSnapshot(qCheck, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
            // Sort client-side to avoid requiring a composite index
            const sortedDocs = docs.sort((a, b) => {
                const dateA = a.createdAt?.seconds || 0;
                const dateB = b.createdAt?.seconds || 0;
                return dateB - dateA;
            });
            setRecentCheckins(sortedDocs);

            if (sortedDocs.length > 0 && sortedDocs[0].location) {
                setMapCenter([sortedDocs[0].location.lat, sortedDocs[0].location.lng]);
            }

            setLoading(false);
        }, (error) => {
            console.error("Firestore Error:", error);
            setLoading(false);
        });

        return () => {
            unsubCust();
            unsubCheck();
        };
    }, [owner.loading, owner.ownerId]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const currentCount = formData.imageUrls.length;
        const filesToAdd = Array.from(files).slice(0, 3 - currentCount);

        if (filesToAdd.length === 0) {
            showToast("Tối đa 3 ảnh hiện trường", "warning");
            return;
        }

        setUploading(true);
        try {
            const uploadPromises = filesToAdd.map(async (file) => {
                const fData = new FormData();
                fData.append('file', file);
                fData.append('upload_preset', 'dunvexbuil');
                fData.append('folder', 'dunvex_checkins');

                const response = await fetch(
                    `https://api.cloudinary.com/v1_1/dtx0uvb4e/image/upload`,
                    { method: 'POST', body: fData }
                );
                const result = await response.json();
                return result.secure_url;
            });

            const urls = await Promise.all(uploadPromises);
            const validUrls = urls.filter(url => !!url);

            setFormData(prev => ({
                ...prev,
                imageUrls: [...prev.imageUrls, ...validUrls]
            }));

            showToast(`Đã tải ${validUrls.length} ảnh thành công`, "success");
        } catch (error: any) {
            showToast(`Lỗi xử lý tệp: ${error.message}`, "error");
        } finally {
            setUploading(false);
            // Reset input
            e.target.value = '';
        }
    };

    const removeImage = (index: number) => {
        setFormData(prev => ({
            ...prev,
            imageUrls: prev.imageUrls.filter((_, i) => i !== index)
        }));
    };

    const filteredCustomersForCheckin = customers.filter(c =>
        String(c.name || '').toLowerCase().includes(searchCustomerQuery.toLowerCase()) ||
        String(c.businessName || '').toLowerCase().includes(searchCustomerQuery.toLowerCase()) ||
        String(c.phone || '').includes(searchCustomerQuery)
    );

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            showToast("Trình duyệt của bạn không hỗ trợ định vị GPS.", "error");
            return;
        }

        setGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                setFormData(prev => ({
                    ...prev,
                    location: { lat: latitude, lng: longitude }
                }));

                // Priority: Use mapInstance for animated transition
                if (mapInstance) {
                    mapInstance.flyTo([latitude, longitude], 17, {
                        duration: 1.5
                    });
                } else {
                    setMapCenter([latitude, longitude]);
                }

                // Reverse geocoding
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
                    const data = await response.json();
                    if (data && data.display_name) {
                        setFormData(prev => ({ ...prev, address: data.display_name }));
                    }
                } catch (err) {
                    console.error("Geocoding failed:", err);
                    setFormData(prev => ({ ...prev, address: `Tọa độ: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}` }));
                } finally {
                    setGettingLocation(false);
                }
            },
            (error) => {
                setGettingLocation(false);
                let msg = "Không thể lấy vị trí.";
                if (error.code === 1) msg = "Vui lòng cấp quyền truy cập vị trí (GPS) trên trình duyệt.";
                else if (error.code === 2) msg = "Không tìm thấy tín hiệu GPS. Hãy thử di chuyển ra chỗ thoáng.";
                else if (error.code === 3) msg = "Hết thời gian tìm vị trí. Vui lòng thử lại.";
                showToast(msg, "warning");
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handleSubmitCheckin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.customerId || !formData.location) {
            showToast("Vui lòng chọn khách hàng và lấy vị trí!", "warning");
            return;
        }

        const customer = customers.find(c => c.id === formData.customerId);

        // Distance Check (Enforced if customer has location data)
        if (customer) {
            const cLat = customer.lat ?? customer.latitude;
            const cLng = customer.lng ?? customer.longitude;

            if (cLat !== undefined && cLat !== null && cLng !== undefined && cLng !== null) {
                const distance = calculateDistance(
                    formData.location.lat,
                    formData.location.lng,
                    cLat,
                    cLng
                );

                if (distance > 50) {
                    showToast(`Bạn cách khách hàng ${Math.round(distance)}m. Vui lòng di chuyển lại gần phạm vi 50m!`, "warning");
                    return;
                }
            } else {
                // Warning if customer has no location data but geofencing is expected
                console.warn("Customer has no location data. Skipping distance check.");
            }
        }

        setLoading(true);
        try {
            await addDoc(collection(db, 'checkins'), {
                ...formData,
                imageUrl: formData.imageUrls[0] || '', // Compatibility for old views
                customerName: customer?.name || 'Vãng lai',
                customerBusinessName: customer?.businessName || '',
                userId: auth.currentUser?.uid,
                userEmail: auth.currentUser?.email,
                ownerId: owner.ownerId,
                ownerEmail: owner.ownerEmail,
                createdAt: serverTimestamp()
            });

            // Log to Audit System
            await addDoc(collection(db, 'audit_logs'), {
                action: 'Check-in khách hàng',
                user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
                userId: auth.currentUser?.uid,
                ownerId: owner.ownerId,
                details: `Đã check-in tại ${customer?.name || 'Vãng lai'} - Mục đích: ${formData.purpose}`,
                createdAt: serverTimestamp()
            });
            setShowCheckinForm(false);

            setFormData({
                customerId: '',
                customerName: '',
                note: '',
                location: null,
                address: '',
                purpose: 'Viếng thăm',
                imageUrls: []
            });
            setSearchCustomerQuery('');
            setSelectedCustomer(null);
            showToast("Checkin thành công!", "success");
        } catch (error) {
            showToast("Lỗi lưu dữ liệu.", "error");
        } finally {
            setLoading(false);
        }
    };

    const hasPermission = owner.role === 'admin' || (owner.accessRights?.checkin_create ?? true);

    if (owner.loading) return null;

    if (!hasPermission) {
        return (
            <div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-slate-950 items-center justify-center text-center p-8 min-h-screen">
                <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-full text-purple-500 mb-4">
                    <MapPin size={48} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase mb-2">Quyền hạn hạn chế</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-md">
                    Bạn không có quyền thực hiện Check-in / Xem lịch sử check-in. Vui lòng liên hệ Admin.
                </p>
                <button onClick={() => navigate('/')} className="mt-6 bg-[#1A237E] text-white px-6 py-2 rounded-xl font-bold">Quay lại Trang chủ</button>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col relative overflow-hidden h-screen bg-slate-50 dark:bg-slate-950">
            {/* Header & Tab Switcher */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 z-[1000] shrink-0">
                <div className="px-4 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="size-10 flex items-center justify-center rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 transition-all"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-xl lg:text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
                            Checkin
                            <span className="text-[10px] font-black uppercase px-2 py-1 bg-orange-50 dark:bg-orange-900/20 text-[#f27121] dark:text-orange-400 rounded-lg tracking-widest border border-orange-100 dark:border-orange-900/30">Sale</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Mobile Filter Toggle */}
                        <button
                            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                            className={`lg:hidden size-10 flex items-center justify-center rounded-xl transition-all ${isFilterExpanded ? 'bg-orange-50 text-[#f27121]' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}
                        >
                            <span className="material-symbols-outlined text-lg">{isFilterExpanded ? 'expand_less' : 'filter_alt'}</span>
                        </button>

                        {/* Tab Switcher */}
                        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                            <button
                                onClick={() => setActiveTab('map')}
                                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'map'
                                    ? 'bg-white dark:bg-slate-700 text-[#1A237E] dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-lg">map</span>
                                <span className="hidden sm:inline">Bản đồ</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('list')}
                                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'list'
                                    ? 'bg-white dark:bg-slate-700 text-[#1A237E] dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-lg">list_alt</span>
                                <span className="hidden sm:inline">Danh sách</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Global Filters Bar */}
                <AnimatePresence>
                    {(isFilterExpanded || activeTab === 'list') && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="px-4 lg:px-8 pb-4 space-y-4">
                                <div className="flex flex-col lg:flex-row gap-4 items-end">
                                    {/* Search Input */}
                                    <div className="flex-1 w-full relative">
                                        <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">
                                            <span className="material-symbols-outlined text-[20px]">search</span>
                                        </span>
                                        <input
                                            className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-black focus:ring-2 focus:ring-[#f27121]/30 text-slate-800 dark:text-white placeholder-slate-400 transition-all shadow-inner"
                                            placeholder="TÌM KIẾM THEO TÊN, MỤC ĐÍCH..."
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => {
                                                setSearchQuery(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                        />
                                    </div>

                                    {/* Date Range Inputs */}
                                    <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-3">
                                        <div className="flex-1 sm:w-48 space-y-1">
                                            <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Từ ngày</label>
                                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2.5 shadow-inner">
                                                <span className="material-symbols-outlined text-sm text-slate-400">calendar_today</span>
                                                <input
                                                    type="date"
                                                    className="bg-transparent border-none text-[10px] font-black uppercase p-0 focus:ring-0 text-slate-700 dark:text-slate-300 w-full"
                                                    value={dateRange.start}
                                                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex-1 sm:w-48 space-y-1">
                                            <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Đến ngày</label>
                                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2.5 shadow-inner">
                                                <span className="material-symbols-outlined text-sm text-slate-400">event</span>
                                                <input
                                                    type="date"
                                                    className="bg-transparent border-none text-[10px] font-black uppercase p-0 focus:ring-0 text-slate-700 dark:text-slate-300 w-full"
                                                    value={dateRange.end}
                                                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Presets */}
                                    <div className="w-full lg:w-auto flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                        {[
                                            { id: 'today', label: 'Hôm nay' },
                                            { id: 'week', label: '7 ngày' },
                                            { id: 'month', label: 'Tháng này' },
                                            { id: 'all', label: 'Tất cả' }
                                        ].map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => setDatePreset(p.id as any)}
                                                className={`whitespace-nowrap px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm border ${
                                                    (p.id === 'today' && dateRange.start === dateRange.end && dateRange.start === new Date().toISOString().split('T')[0]) ||
                                                    (p.id === 'all' && dateRange.start === '2020-01-01')
                                                    ? 'bg-[#f27121] text-white border-[#f27121]'
                                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                                                }`}
                                            >
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </header>

            <main className="flex-1 relative overflow-hidden">
                <AnimatePresence mode="wait">
                    {activeTab === 'map' ? (
                        <motion.div
                            key="map"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="absolute inset-0 flex flex-col"
                        >
                            <div className="relative flex-1 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <MapContainer
                                    center={mapCenter}
                                    zoom={13}
                                    style={{ height: '100%', width: '100%' }}
                                    zoomControl={false}
                                >
                                    <MapInstanceTracker setMapInstance={setMapInstance} />
                                    <TileLayer
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    />
                                    <MapUpdater center={mapCenter} sidebarExpanded={false} />

                                    {/* Current capturing location marker */}
                                    {formData.location && (
                                        <Marker
                                            position={[formData.location.lat, formData.location.lng]}
                                            icon={L.divIcon({
                                                className: 'current-location-icon',
                                                html: `
                                                    <div class="relative flex items-center justify-center">
                                                        <div class="absolute inset-0 size-8 bg-[#f27121]/30 rounded-full animate-ping"></div>
                                                        <div class="size-4 bg-[#f27121] rounded-full border-2 border-white shadow-lg relative z-10"></div>
                                                    </div>
                                                `,
                                                iconSize: [32, 32],
                                                iconAnchor: [16, 16]
                                            })}
                                        >
                                            <Popup>
                                                <p className="text-[10px] font-black uppercase text-[#f27121]">Vị trí bạn đang chọn</p>
                                            </Popup>
                                        </Marker>
                                    )}

                                    {recentCheckins.filter(item => {
                                        const itemDate = item.createdAt?.seconds 
                                            ? new Date(item.createdAt.seconds * 1000).toISOString().split('T')[0] 
                                            : new Date().toISOString().split('T')[0];
                                        const matchDate = itemDate >= dateRange.start && itemDate <= dateRange.end;
                                        const matchSearch = (item.customerBusinessName || item.customerName || '').toLowerCase().includes(searchQuery.toLowerCase());
                                        return matchDate && matchSearch;
                                    }).map((checkin) => {
                                        const lat = checkin.location?.lat ?? checkin.location?.latitude;
                                        const lng = checkin.location?.lng ?? checkin.location?.longitude;
                                        if (lat === undefined || lng === undefined) return null;

                                        return (
                                            <Marker
                                                key={checkin.id}
                                                position={[lat, lng]}
                                                icon={createCustomIcon(checkin.purpose, !!checkin.imageUrl)}
                                            >
                                                <Popup className="custom-popup">
                                                    <div className="p-2 min-w-[150px]">
                                                        <p className="font-black text-[#1A237E] uppercase text-[10px] mb-1">{checkin.customerBusinessName || checkin.customerName}</p>
                                                        <p className="text-[9px] text-slate-500 mb-2">{checkin.purpose}</p>
                                                        {(checkin.imageUrls || (checkin.imageUrl ? [checkin.imageUrl] : [])).map((url: string, idx: number) => (
                                                            <img
                                                                key={idx}
                                                                src={getImageUrl(url)}
                                                                className={`w-full ${idx === 0 ? 'h-24' : 'hidden'} object-cover rounded-lg mb-2 shadow-sm`}
                                                                alt="Field"
                                                                referrerPolicy="no-referrer"
                                                            />
                                                        ))}
                                                        <p className="text-[8px] text-slate-400 italic">"{checkin.note || 'Không có ghi chú'}"</p>
                                                    </div>
                                                </Popup>
                                            </Marker>
                                        );
                                    })}
                                </MapContainer>

                                {/* Map Overlay Controls */}
                                <div className="absolute bottom-6 right-6 flex flex-col gap-3 z-[1000]">
                                    <button
                                        onClick={() => mapInstance?.zoomIn()}
                                        className="size-11 bg-white dark:bg-slate-900 rounded-2xl shadow-xl flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-black text-[#1A237E] dark:text-indigo-400 border border-slate-100 dark:border-slate-800"
                                    >
                                        <span className="material-symbols-outlined">add</span>
                                    </button>
                                    <button
                                        onClick={() => mapInstance?.zoomOut()}
                                        className="size-11 bg-white dark:bg-slate-900 rounded-2xl shadow-xl flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-black text-[#1A237E] dark:text-indigo-400 border border-slate-100 dark:border-slate-800"
                                    >
                                        <span className="material-symbols-outlined">remove</span>
                                    </button>
                                    <button
                                        onClick={handleGetLocation}
                                        className={`size-11 rounded-2xl shadow-xl flex items-center justify-center transition-all border border-slate-100 dark:border-slate-800 ${gettingLocation ? 'bg-orange-50 text-orange-500 animate-pulse' : 'bg-white dark:bg-slate-900 text-[#f27121] hover:bg-orange-50 dark:hover:bg-slate-800'}`}
                                        title="Vị trí của tôi"
                                    >
                                        <span className="material-symbols-outlined">{gettingLocation ? 'sync' : 'my_location'}</span>
                                    </button>
                                </div>

                                {/* Floating Check-in Button */}
                                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000]">
                                    <button
                                        onClick={() => setShowCheckinForm(true)}
                                        className="flex items-center gap-3 bg-[#f27121] hover:bg-orange-600 text-white px-8 py-4 rounded-[2rem] shadow-[0_15px_30px_rgba(242,113,33,0.3)] transition-all transform hover:scale-105 active:scale-95 font-black text-xs uppercase tracking-[2px]"
                                    >
                                        <span className="material-symbols-outlined text-xl">add_location_alt</span>
                                        Checkin Ngay
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="absolute inset-0 flex flex-col bg-[#f8f9fb] dark:bg-slate-950 overflow-y-auto custom-scrollbar"
                        >
                            <div className="max-w-4xl mx-auto w-full p-4 lg:p-8 space-y-6 pb-32">
                                {/* Statistics Summary (Optional but looks premium) */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                                        <div className="size-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-[#1A237E] dark:text-indigo-400">
                                            <span className="material-symbols-outlined text-lg">analytics</span>
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Tổng Check-in</p>
                                            <p className="text-sm font-black text-slate-800 dark:text-white">{recentCheckins.length}</p>
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                                        <div className="size-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-[#f27121]">
                                            <span className="material-symbols-outlined text-lg">new_releases</span>
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Mới (7 ngày)</p>
                                            <p className="text-sm font-black text-slate-800 dark:text-white">
                                                {recentCheckins.filter(c => {
                                                    const d = c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000) : new Date();
                                                    return (new Date().getTime() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
                                                }).length}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* List Feed */}
                                <div className="space-y-6">
                                    {loading ? (
                                        <div className="py-20 flex flex-col items-center justify-center gap-4">
                                            <div className="size-10 border-4 border-[#f27121] border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-[#f27121] animate-pulse">Đang tải lịch sử...</p>
                                        </div>
                                    ) : (() => {
                                        const filtered = recentCheckins.filter(item => {
                                            const itemDate = item.createdAt?.seconds 
                                                ? new Date(item.createdAt.seconds * 1000).toISOString().split('T')[0] 
                                                : new Date().toISOString().split('T')[0];
                                            const matchDate = itemDate >= dateRange.start && itemDate <= dateRange.end;
                                            const matchSearch = (item.customerBusinessName || item.customerName || item.purpose || '').toLowerCase().includes(searchQuery.toLowerCase());
                                            return matchDate && matchSearch;
                                        });

                                        const totalPages = Math.ceil(filtered.length / itemsPerPage);
                                        const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                                        if (filtered.length === 0) {
                                            return (
                                                <div className="py-24 flex flex-col items-center justify-center text-slate-200 dark:text-slate-800 gap-5 uppercase font-black text-xs tracking-[6px]">
                                                    <span className="material-symbols-outlined text-7xl">history</span>
                                                    <p>Không có dữ liệu checkin</p>
                                                </div>
                                            );
                                        }

                                        return (
                                            <>
                                                {paginated.map((checkin) => (
                                                    <motion.div
                                                        layout
                                                        key={checkin.id}
                                                        className="flex gap-4 lg:gap-6 relative group"
                                                    >
                                                        <div className="flex-none pt-2">
                                                            <div className="size-12 lg:size-16 rounded-2xl bg-gradient-to-br from-[#1A237E] to-blue-900 text-white flex items-center justify-center text-xl lg:text-2xl font-black shadow-lg shadow-blue-900/20 uppercase border-2 border-white dark:border-slate-800">
                                                                {(checkin.customerBusinessName || checkin.customerName)[0]}
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 lg:p-6 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group-hover:-translate-y-1 relative overflow-hidden">
                                                            <div className="flex justify-between items-start mb-4 gap-4">
                                                                <div className="space-y-1">
                                                                    <h4 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight leading-tight">{checkin.customerBusinessName || checkin.customerName}</h4>
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                                                                            checkin.purpose === 'Khiếu nại' ? 'bg-red-50 dark:bg-red-900/20 text-red-500' :
                                                                            checkin.purpose === 'Khách mới' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' :
                                                                            'bg-blue-50 dark:bg-blue-900/20 text-blue-500'
                                                                        }`}>
                                                                            {checkin.purpose}
                                                                        </span>
                                                                        <span className="text-[9px] text-slate-400 font-bold uppercase">• {checkin.address.split(',')[0]}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-end gap-2 shrink-0">
                                                                    <span className="text-[10px] text-slate-300 dark:text-slate-600 font-black uppercase tracking-tighter bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                                                        {checkin.createdAt?.seconds ? new Date(checkin.createdAt.seconds * 1000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong'}
                                                                    </span>
                                                                    <button
                                                                        onClick={(e) => handleDeleteCheckin(checkin.id, e)}
                                                                        className="text-slate-200 hover:text-red-500 transition-colors p-1"
                                                                    >
                                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Images */}
                                                            {(() => {
                                                                const imgs = checkin.imageUrls || (checkin.imageUrl ? [checkin.imageUrl] : []);
                                                                if (imgs.length === 0) return null;
                                                                return (
                                                                    <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl overflow-hidden">
                                                                        {imgs.map((url: string, idx: number) => (
                                                                            <img
                                                                                key={idx}
                                                                                src={getImageUrl(url)}
                                                                                className="aspect-video object-cover rounded-xl border border-slate-50 dark:border-slate-800"
                                                                                alt="Field"
                                                                                referrerPolicy="no-referrer"
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                );
                                                            })()}

                                                            {checkin.note && (
                                                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-l-4 border-[#1A237E] dark:border-indigo-500 mb-4">
                                                                    <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed italic">"{checkin.note}"</p>
                                                                </div>
                                                            )}

                                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                                                                <span className="material-symbols-outlined text-sm text-[#f27121]">place</span>
                                                                <span className="truncate">{checkin.address}</span>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}

                                                {/* Pagination */}
                                                <div className="flex items-center justify-between pt-6">
                                                    <button
                                                        disabled={currentPage === 1}
                                                        onClick={() => setCurrentPage(prev => prev - 1)}
                                                        className="px-6 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-20 transition-all shadow-sm"
                                                    >
                                                        Trước
                                                    </button>
                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        {currentPage} / {totalPages || 1}
                                                    </div>
                                                    <button
                                                        disabled={currentPage >= totalPages}
                                                        onClick={() => setCurrentPage(prev => prev + 1)}
                                                        className="px-6 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-20 transition-all shadow-sm"
                                                    >
                                                        Sau
                                                    </button>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Floating Action Button for List Tab - Hidden on Mobile */}
                            <div className="fixed bottom-10 right-6 z-[1000] hidden sm:flex">
                                <button
                                    onClick={() => setShowCheckinForm(true)}
                                    className="size-16 bg-[#f27121] text-white rounded-2xl shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-orange-500/30"
                                >
                                    <span className="material-symbols-outlined text-3xl font-black">add_location_alt</span>
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Checkin Form Modal - Stays shared */}
            <AnimatePresence>
                {showCheckinForm && (
                    <div className="fixed inset-0 z-[2000] flex items-end md:items-center justify-center p-0 md:p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowCheckinForm(false)}
                            className="absolute inset-0 bg-[#1A237E]/80 dark:bg-black/90 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ y: "100%", scale: 0.95 }}
                            animate={{ y: 0, scale: 1 }}
                            exit={{ y: "100%", scale: 0.95 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-t-[3rem] md:rounded-[3rem] shadow-2xl flex flex-col max-h-[95vh] md:max-h-[85vh] overflow-hidden relative z-10"
                        >
                            <div className="px-8 py-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black text-[#1A237E] dark:text-indigo-400 uppercase tracking-tight">Checkin Hiện Trường</h3>
                                    <p className="text-[10px] font-black text-[#f27121] dark:text-orange-400 uppercase tracking-[2px]">
                                        {currentTime.toLocaleDateString('vi-VN')} — {currentTime.toLocaleTimeString('vi-VN')}
                                    </p>
                                </div>
                                <button onClick={() => setShowCheckinForm(false)} className="size-10 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-all">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <form onSubmit={handleSubmitCheckin} className="flex-1 overflow-y-auto p-8 space-y-6 pb-12 custom-scrollbar">
                                {/* Form contents same as before but polished */}
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px] mb-3">Chọn Khách Hàng *</label>
                                    <div className="relative" ref={customerSearchRef}>
                                        <input
                                            required
                                            type="text"
                                            placeholder="Tìm khách hàng..."
                                            className="w-full pl-6 pr-4 h-16 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-black focus:ring-2 focus:ring-[#f27121]/50 text-slate-800 dark:text-white"
                                            value={searchCustomerQuery}
                                            onChange={(e) => {
                                                setSearchCustomerQuery(e.target.value);
                                                setShowCustomerResults(true);
                                                if (selectedCustomer && e.target.value !== (selectedCustomer.businessName || selectedCustomer.name)) {
                                                    setSelectedCustomer(null);
                                                    setFormData(prev => ({ ...prev, customerId: '' }));
                                                }
                                            }}
                                        />
                                        {showCustomerResults && searchCustomerQuery && (
                                            <div className="absolute z-[2100] left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar">
                                                {filteredCustomersForCheckin.map(c => (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        className="w-full px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center justify-between border-b border-slate-50 dark:border-slate-700 last:border-none group"
                                                        onClick={() => {
                                                            setSelectedCustomer(c);
                                                            setSearchCustomerQuery(c.businessName || c.name);
                                                            setFormData(prev => ({ ...prev, customerId: c.id }));
                                                            setShowCustomerResults(false);
                                                        }}
                                                    >
                                                        <div>
                                                            <p className="font-black text-sm uppercase text-slate-800 dark:text-slate-200 group-hover:text-[#f27121]">
                                                                {c.businessName || c.name}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400 font-black uppercase mt-1">{c.phone}</p>
                                                        </div>
                                                        {selectedCustomer?.id === c.id && <CheckCircle2 size={18} className="text-[#f27121]" />}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px] mb-3">Vị trí hiện tại *</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 min-h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center leading-relaxed">
                                            {gettingLocation ? 'Đang xác định vị trí...' : formData.address || 'Chưa có vị trí'}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleGetLocation}
                                            className="size-16 bg-[#1A237E] dark:bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-black transition-all shadow-xl shadow-blue-500/20 active:scale-95 shrink-0"
                                        >
                                            <span className="material-symbols-outlined text-2xl">my_location</span>
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px] mb-3">Mục đích *</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['Khách mới', 'Viếng thăm', 'Khiếu nại'].map((p) => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, purpose: p }))}
                                                className={`py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${formData.purpose === p
                                                    ? 'bg-[#1A237E] dark:bg-indigo-600 text-white shadow-xl shadow-blue-500/20'
                                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-200'
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px] mb-3">Ghi chú</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Nhập nội dung làm việc..."
                                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 text-sm font-bold focus:ring-2 focus:ring-[#f27121]/50 resize-none text-slate-800 dark:text-white"
                                        value={formData.note}
                                        onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px] mb-3">Ảnh hiện trường (Tối đa 3)</label>
                                    <div className="grid grid-cols-4 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => document.getElementById('checkin-image-v2')?.click()}
                                            disabled={uploading || formData.imageUrls.length >= 3}
                                            className="h-20 bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 text-slate-400 rounded-2xl font-black text-[9px] uppercase tracking-[1px] flex flex-col items-center justify-center gap-1 border-2 border-dashed border-slate-200 transition-all disabled:opacity-30"
                                        >
                                            {uploading ? (
                                                <div className="size-4 border-2 border-[#f27121] border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined text-xl">camera</span>
                                                    <span>{formData.imageUrls.length}/3</span>
                                                </>
                                            )}
                                        </button>
                                        <input
                                            id="checkin-image-v2"
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            multiple
                                            className="hidden"
                                            onChange={handleImageUpload}
                                        />
                                        {formData.imageUrls.map((url, index) => (
                                            <div key={index} className="relative size-20">
                                                <img src={url} alt="Preview" className="size-full object-cover rounded-2xl shadow-md border border-slate-100" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(index)}
                                                    className="absolute -top-1.5 -right-1.5 size-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg"
                                                >
                                                    <span className="material-symbols-outlined text-[12px]">close</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={gettingLocation || uploading || !formData.customerId}
                                    className="w-full h-16 bg-[#f27121] text-white rounded-2xl font-black text-sm uppercase tracking-[3px] shadow-2xl shadow-orange-500/40 hover:bg-orange-600 transition-all active:scale-95 disabled:bg-slate-300"
                                >
                                    {uploading ? 'Đang tải lên...' : 'Xác nhận Checkin'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Checkin;
