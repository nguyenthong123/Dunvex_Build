import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, where, limit, orderBy } from 'firebase/firestore';
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

// Helper to update map center
const MapUpdater = ({ center }: { center: [number, number] }) => {
    const map = useMap();
    useEffect(() => {
        map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
};

const Checkin = () => {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState<any[]>([]);
    const [recentCheckins, setRecentCheckins] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCheckinForm, setShowCheckinForm] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [mapCenter, setMapCenter] = useState<[number, number]>([11.9931, 107.5257]);

    // Pagination & Filter States
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const [formData, setFormData] = useState({
        customerId: '',
        customerName: '',
        note: '',
        location: null as { lat: number, lng: number } | null,
        address: '',
        purpose: 'Viếng thăm',
        imageUrl: ''
    });

    const [gettingLocation, setGettingLocation] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Helper to format Google Drive URLs for reliable loading
    const formatDriveUrl = (url: string) => {
        if (!url) return '';
        if (url.includes('drive.google.com')) {
            const fileId = url.split('id=')[1];
            if (fileId) return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
        }
        return url;
    };

    useEffect(() => {
        if (!auth.currentUser) return;

        const qCust = query(
            collection(db, 'customers'),
            where('createdBy', '==', auth.currentUser.uid)
        );
        const unsubCust = onSnapshot(qCust, (snapshot) => {
            setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const qCheck = query(
            collection(db, 'checkins'),
            where('userId', '==', auth.currentUser.uid),
            orderBy('createdAt', 'desc'),
            limit(100) // Increase limit for client-side filtering/pagination
        );
        const unsubCheck = onSnapshot(qCheck, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRecentCheckins(docs);

            if (docs.length > 0 && docs[0].location) {
                setMapCenter([docs[0].location.lat, docs[0].location.lng]);
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
    }, []);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Data = (reader.result as string).split(',')[1];
                try {
                    const response = await fetch('https://script.google.com/macros/s/AKfycby6Bm4e2rkzn7y6Skkl9eYKqclc927iJo1as-fBP7lsnvG1eC7sSh8Albak4fmy59w2FA/exec', {
                        method: 'POST',
                        body: JSON.stringify({
                            filename: `checkin_${Date.now()}_${file.name}`,
                            mimeType: file.type,
                            base64Data: base64Data
                        })
                    });
                    const data = await response.json();
                    if (data.status === 'success') {
                        setFormData(prev => ({ ...prev, imageUrl: data.fileUrl }));
                    } else {
                        alert("Lỗi upload: " + (data.message || "Không xác định"));
                    }
                } catch (err) {
                    console.error(err);
                    alert("Lỗi kết nối Drive.");
                } finally {
                    setUploading(false);
                }
            };
        } catch (error) {
            console.error(error);
            alert("Lỗi xử lý tệp.");
            setUploading(false);
        }
    };

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            alert("Trình duyệt không hỗ trợ định vị.");
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

                // Get address using Nominatim (free)
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
                    const data = await response.json();
                    setFormData(prev => ({ ...prev, address: data.display_name }));
                } catch (err) {
                    setFormData(prev => ({ ...prev, address: `Tọa độ: ${latitude}, ${longitude}` }));
                } finally {
                    setGettingLocation(false);
                }
            },
            (error) => {
                console.error(error);
                alert("Không thể lấy vị trí. Vui lòng cho phép truy cập GPS.");
                setGettingLocation(false);
            },
            { enableHighAccuracy: true }
        );
    };

    const handleSubmitCheckin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.customerId || !formData.location) {
            alert("Vui lòng chọn khách hàng và lấy vị trí!");
            return;
        }

        setLoading(true);
        try {
            const customer = customers.find(c => c.id === formData.customerId);
            await addDoc(collection(db, 'checkins'), {
                ...formData,
                customerName: customer?.name || 'Vãng lai',
                userId: auth.currentUser?.uid,
                userEmail: auth.currentUser?.email,
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
                imageUrl: ''
            });
            alert("Check-in thành công!");
        } catch (error) {
            console.error(error);
            alert("Lỗi lưu dữ liệu.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-[#f8f7f5] font-['Manrope'] text-[#181411] overflow-hidden h-screen flex flex-col">
            {/* Top Navigation */}
            <header className="flex-none flex items-center justify-between whitespace-nowrap border-b border-solid border-[#e6dfdb] bg-white px-4 lg:px-6 py-3 z-[1000] shadow-sm">
                <div className="flex items-center gap-4 text-[#181411]">
                    <div className="size-10 bg-[#f27121] rounded-xl flex items-center justify-center text-white cursor-pointer shadow-lg shadow-orange-500/20" onClick={() => navigate('/')}>
                        <span className="material-symbols-outlined text-[24px]">grid_view</span>
                    </div>
                    <h2 className="text-xl font-black leading-tight tracking-tight cursor-pointer" onClick={() => navigate('/')}>Dunvex Build</h2>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        className="hidden md:flex items-center gap-2 px-4 py-2 bg-[#f8f7f5] border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all text-slate-600"
                        onClick={() => navigate('/')}
                    >
                        <span className="material-symbols-outlined text-[18px]">grid_view</span>
                        <span>Quay lại</span>
                    </button>
                    <div
                        className="bg-center bg-no-repeat bg-cover rounded-full size-10 border-2 border-[#f27121]/20 shadow-md"
                        style={{ backgroundImage: `url(${auth.currentUser?.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'})` }}
                    ></div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col lg:flex-row relative overflow-hidden">
                {/* Map Area */}
                <div className="relative flex-1 h-full w-full bg-[#e5e3df] z-0 overflow-hidden">
                    <MapContainer
                        center={mapCenter}
                        zoom={13}
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={false}
                    >
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        <MapUpdater center={mapCenter} />

                        {recentCheckins.map((checkin) => (
                            checkin.location && (
                                <Marker
                                    key={checkin.id}
                                    position={[checkin.location.lat, checkin.location.lng]}
                                    icon={createCustomIcon(checkin.purpose, !!checkin.imageUrl)}
                                >
                                    <Popup className="custom-popup">
                                        <div className="p-2 min-w-[150px]">
                                            <p className="font-black text-[#1A237E] uppercase text-[10px] mb-1">{checkin.customerName}</p>
                                            <p className="text-[9px] text-slate-500 mb-2">{checkin.purpose}</p>
                                            {checkin.imageUrl && (
                                                <img
                                                    src={formatDriveUrl(checkin.imageUrl)}
                                                    className="w-full h-20 object-cover rounded-lg mb-2 shadow-sm"
                                                    alt="Field"
                                                    referrerPolicy="no-referrer"
                                                />
                                            )}
                                            <p className="text-[8px] text-slate-400 italic">"{checkin.note || 'Không có ghi chú'}"</p>
                                        </div>
                                    </Popup>
                                </Marker>
                            )
                        ))}
                    </MapContainer>

                    {/* Map Overlay Controls */}
                    <div className="absolute top-6 left-6 flex flex-col gap-2 z-[999]">
                        <button className="size-10 bg-white rounded-xl shadow-2xl flex items-center justify-center hover:bg-slate-50 transition-all font-black text-[#1A237E] border border-slate-100">
                            <span className="material-symbols-outlined">add</span>
                        </button>
                        <button className="size-10 bg-white rounded-xl shadow-2xl flex items-center justify-center hover:bg-slate-50 transition-all font-black text-[#1A237E] border border-slate-100">
                            <span className="material-symbols-outlined">remove</span>
                        </button>
                    </div>

                    {/* Desktop Check-in Button Overlay */}
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 hidden lg:block z-[999]">
                        <button
                            onClick={() => setShowCheckinForm(true)}
                            className="flex items-center gap-4 bg-[#f27121] hover:bg-orange-600 text-white px-10 py-5 rounded-[2.5rem] shadow-[0_20px_40px_rgba(242,113,33,0.3)] transition-all transform hover:scale-105 active:scale-95 font-black text-sm uppercase tracking-[3px]"
                        >
                            <span className="material-symbols-outlined text-2xl">add_location_alt</span>
                            Check-in Ngay
                        </button>
                    </div>
                </div>

                {/* Sidebar / Bottom Sheet */}
                <aside
                    className={`lg:w-[30%] lg:min-w-[400px] lg:max-w-[460px] lg:h-full lg:relative lg:border-l lg:border-[#e6dfdb] absolute bottom-0 left-0 w-full bg-white shadow-[0_-20px_50px_rgba(0,0,0,0.1)] lg:shadow-none z-[1001] flex flex-col transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${sheetOpen ? 'h-[75vh] rounded-t-[3rem]' : 'h-[14vh] lg:h-full rounded-t-[3rem] lg:rounded-none'
                        }`}
                >
                    {/* Drawer Handle / Header for Mobile */}
                    <div
                        className="w-full h-12 lg:hidden flex justify-center items-center cursor-pointer shrink-0"
                        onClick={() => setSheetOpen(!sheetOpen)}
                    >
                        <div className="w-16 h-1 bg-slate-200 rounded-full"></div>
                    </div>

                    {/* Header Contents */}
                    <div className="px-7 pb-4 lg:pt-8 lg:pb-4 flex flex-col gap-5 shrink-0">
                        <div className="flex items-center justify-between">
                            <h1 className="text-[#181411] text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                                Hoạt Động
                                <span className="text-[10px] font-black uppercase px-2 py-1 bg-orange-50 text-[#f27121] rounded-lg tracking-widest border border-orange-100">Sale</span>
                            </h1>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">
                                <span className="material-symbols-outlined text-[20px]">search</span>
                            </span>
                            <input
                                className="w-full pl-12 pr-4 py-4 bg-[#f8f7f5] border-none rounded-[1.5rem] text-sm font-black focus:ring-2 focus:ring-[#f27121]/30 text-[#181411] placeholder-slate-400 transition-all border border-transparent focus:bg-white focus:border-slate-100 shadow-inner"
                                placeholder="Tìm khách hàng..."
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1); // Reset to page 1 on search
                                }}
                            />
                        </div>

                        {/* Filter Tags & Date Range */}
                        <div className="flex flex-col gap-4">
                            <div className="flex gap-2 p-1 bg-[#f8f7f5] rounded-2xl">
                                <input
                                    type="date"
                                    className="flex-1 bg-transparent border-none text-[10px] font-black uppercase p-2 focus:ring-0"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                />
                                <div className="flex items-center text-slate-300">
                                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </div>
                                <input
                                    type="date"
                                    className="flex-1 bg-transparent border-none text-[10px] font-black uppercase p-2 focus:ring-0"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                />
                            </div>

                            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                <button className="whitespace-nowrap px-6 py-2.5 bg-[#f27121] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-all">Tất cả</button>
                                <button className="whitespace-nowrap px-6 py-2.5 bg-[#f8f7f5] text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 active:scale-95 transition-all">Khách mới</button>
                                <button className="whitespace-nowrap px-6 py-2.5 bg-[#f8f7f5] text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 active:scale-95 transition-all">Viếng thăm</button>
                                <button className="whitespace-nowrap px-6 py-2.5 bg-[#f8f7f5] text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 active:scale-95 transition-all">Khiếu nại</button>
                            </div>
                        </div>
                    </div>

                    {/* Activity Feed List with Client-side Filter & Pagination */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-4 lg:px-6 py-6 space-y-6 bg-[#f8f7f5]/30">
                        {loading ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-4">
                                <div className="size-10 border-4 border-[#f27121] border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#f27121] animate-pulse">Đang đồng bộ dữ liệu...</p>
                            </div>
                        ) : (() => {
                            const filtered = recentCheckins.filter(item => {
                                const itemDate = item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toISOString().split('T')[0] : '';
                                const matchDate = itemDate >= dateRange.start && itemDate <= dateRange.end;
                                const matchSearch = item.customerName.toLowerCase().includes(searchQuery.toLowerCase());
                                return matchDate && matchSearch;
                            });

                            const totalPages = Math.ceil(filtered.length / itemsPerPage);
                            const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                            if (filtered.length === 0) {
                                return (
                                    <div className="py-24 flex flex-col items-center justify-center text-slate-200 gap-5 uppercase font-black text-xs tracking-[6px] opacity-50">
                                        <span className="material-symbols-outlined text-7xl">explore_off</span>
                                        <p>Dữ liệu trống</p>
                                    </div>
                                );
                            }

                            return (
                                <>
                                    {paginated.map((checkin) => (
                                        <div key={checkin.id} className="flex gap-3 lg:gap-5 relative group">
                                            <div className="flex-none pt-1 lg:pt-2 relative">
                                                <div className="size-10 lg:size-14 rounded-xl lg:rounded-2xl bg-[#1A237E] flex items-center justify-center text-white font-black text-base lg:text-xl shadow-xl shadow-blue-900/10 border-2 border-white ring-4 ring-transparent group-hover:ring-blue-50 transition-all">
                                                    {checkin.customerName[0]}
                                                </div>
                                            </div>
                                            <div className="flex-1 bg-white border border-slate-100 p-4 lg:p-5 rounded-[1.5rem] lg:rounded-[2rem] shadow-sm hover:shadow-2xl transition-all cursor-pointer group-hover:-translate-y-1 overflow-hidden">
                                                <div className="flex justify-between items-start mb-3 gap-2">
                                                    <div className="space-y-0.5 min-w-0">
                                                        <h4 className="text-[13px] lg:text-sm font-black text-[#1A237E] uppercase tracking-tight leading-tight truncate">{checkin.customerName}</h4>
                                                        <div className="flex flex-wrap items-center gap-1.5 lg:gap-2">
                                                            <span className={`px-1.5 py-0.5 rounded text-[7px] lg:text-[8px] font-black uppercase tracking-widest ${checkin.purpose === 'Khiếu nại' ? 'bg-red-50 text-red-500' :
                                                                    checkin.purpose === 'Khách mới' ? 'bg-emerald-50 text-emerald-500' :
                                                                        checkin.purpose === 'Viếng thăm' ? 'bg-purple-50 text-purple-600' :
                                                                            checkin.purpose === 'Thăm hỏi' ? 'bg-blue-50 text-blue-600' :
                                                                                checkin.purpose === 'Giao hàng' ? 'bg-yellow-50 text-yellow-600' :
                                                                                    checkin.purpose === 'Thu tiền' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-[#f27121]'
                                                                }`}>
                                                                {checkin.purpose}
                                                            </span>
                                                            <span className="text-[8px] lg:text-[9px] text-slate-400 font-bold uppercase truncate">• {checkin.address.split(',')[0]}</span>
                                                        </div>
                                                    </div>
                                                    <span className="shrink-0 text-[9px] lg:text-[10px] text-slate-300 font-black uppercase tracking-tighter bg-slate-50 px-2 py-1 rounded-lg">
                                                        {checkin.createdAt?.seconds ? new Date(checkin.createdAt.seconds * 1000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'NOW'}
                                                    </span>
                                                </div>

                                                {checkin.imageUrl && (
                                                    <div className="mb-3 lg:mb-4 rounded-xl lg:rounded-2xl overflow-hidden border border-slate-100 aspect-video relative group/img shadow-sm">
                                                        <img
                                                            src={formatDriveUrl(checkin.imageUrl)}
                                                            alt="Field"
                                                            className="size-full object-cover group-hover/img:scale-110 transition-transform duration-[1.5s]"
                                                            referrerPolicy="no-referrer"
                                                        />
                                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-all scale-110 group-hover/img:scale-100">
                                                            <span className="material-symbols-outlined text-white text-3xl">zoom_in</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {checkin.note && (
                                                    <div className="p-3 lg:p-4 bg-[#f8f7f5] rounded-xl lg:rounded-2xl border-l-[4px] lg:border-l-[6px] border-[#1A237E] mb-3 lg:mb-4 shadow-inner">
                                                        <p className="text-[11px] lg:text-[12px] text-[#1A237E] font-bold leading-relaxed line-clamp-3 italic">"{checkin.note}"</p>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-2 text-[9px] lg:text-[10px] text-slate-400 font-bold leading-tight">
                                                    <span className="material-symbols-outlined text-[14px] lg:text-[16px] text-orange-400 shrink-0">place</span>
                                                    <span className="truncate opacity-70">{checkin.address}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Pagination Controls */}
                                    <div className="flex items-center justify-between pt-4 pb-8">
                                        <button
                                            disabled={currentPage === 1}
                                            onClick={() => setCurrentPage(prev => prev - 1)}
                                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                                        >
                                            Trang trước
                                        </button>
                                        <div className="text-[10px] font-black text-slate-400">
                                            {currentPage} / {totalPages || 1}
                                        </div>
                                        <button
                                            disabled={currentPage >= totalPages}
                                            onClick={() => setCurrentPage(prev => prev + 1)}
                                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                                        >
                                            Trang sau
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* Bottom Action Bar (Mobile Only) */}
                    <div className="p-6 border-t border-slate-100 bg-white lg:hidden shrink-0">
                        <button
                            onClick={() => setShowCheckinForm(true)}
                            className="w-full flex items-center justify-center gap-4 bg-[#1A237E] text-white py-5 rounded-[2rem] font-black text-sm uppercase tracking-[3px] shadow-2xl shadow-blue-900/20 active:scale-95 transition-all"
                        >
                            <span className="material-symbols-outlined text-2xl">add_location_alt</span>
                            Check-in Mới
                        </button>
                    </div>
                </aside>
            </main>


            {/* Checkin Form Modal */}
            {showCheckinForm && (
                <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-[#1A237E]/80 backdrop-blur-sm p-0 md:p-4 font-['Manrope']">
                    <div className="bg-white w-full max-w-xl rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[95vh] md:max-h-[85vh] animate-in slide-in-from-bottom duration-300 overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between shrink-0">
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-[#1A237E] uppercase tracking-tight">Thực hiện Check-in</h3>
                                <p className="text-[10px] font-black text-[#f27121] uppercase tracking-[2px]">
                                    {currentTime.toLocaleDateString('vi-VN')} — {currentTime.toLocaleTimeString('vi-VN')}
                                </p>
                            </div>
                            <button onClick={() => setShowCheckinForm(false)} className="size-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-all">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSubmitCheckin} className="flex-1 overflow-y-auto p-8 space-y-6 pb-12 custom-scrollbar">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[2px] pl-1 mb-2 text-center md:text-left">Chọn Khách Hàng Mục Tiêu *</label>
                                    <div className="relative">
                                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[#f27121]">
                                            <span className="material-symbols-outlined">person</span>
                                        </div>
                                        <select
                                            required
                                            className="w-full pl-14 pr-4 h-16 bg-[#f8f7f5] border-none rounded-2xl text-sm font-black focus:ring-2 focus:ring-[#f27121]/50 appearance-none"
                                            value={formData.customerId}
                                            onChange={(e) => setFormData(prev => ({ ...prev, customerId: e.target.value }))}
                                        >
                                            <option value="">-- Danh sách khách hàng --</option>
                                            {customers.map(c => (
                                                <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[2px] pl-1 mb-2">Vị trí hiện tại *</label>
                                        <div className="flex gap-2">
                                            <div className="flex-1 min-h-16 bg-[#f8f7f5] rounded-2xl px-5 py-4 text-xs font-bold text-slate-600 border-none flex items-center leading-relaxed">
                                                {gettingLocation ? (
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-5 border-2 border-[#f27121] border-t-transparent rounded-full animate-spin"></div>
                                                        <span className="text-[#f27121] uppercase tracking-widest text-[10px]">Đang định vị...</span>
                                                    </div>
                                                ) : formData.address || 'Vui lòng nhấn định vị bên cạnh'}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleGetLocation}
                                                className="size-16 bg-[#1A237E] text-white rounded-2xl flex items-center justify-center hover:bg-black shadow-xl shadow-blue-500/20 active:scale-95 transition-all shrink-0"
                                            >
                                                <span className="material-symbols-outlined text-2xl">my_location</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[2px] pl-1 mb-2">Trạng thái Check-in *</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['Khách mới', 'Viếng thăm', 'Khiếu nại'].map((p) => (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, purpose: p }))}
                                                    className={`py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${formData.purpose === p
                                                        ? 'bg-[#1A237E] text-white shadow-xl shadow-blue-500/20'
                                                        : 'bg-[#f8f7f5] text-slate-400 hover:bg-slate-200'
                                                        }`}
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[2px] pl-1 mb-2">Nội dung trao đổi</label>
                                    <textarea
                                        rows={4}
                                        placeholder="Ghi nhanh nội dung làm việc hoặc yêu cầu của khách..."
                                        className="w-full bg-[#f8f7f5] border-none rounded-2xl p-5 text-sm font-bold focus:ring-2 focus:ring-[#f27121]/50 resize-none placeholder-slate-300"
                                        value={formData.note}
                                        onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Hình ảnh hiện trường</label>
                                        <span className="text-[10px] text-slate-300 font-bold italic tracking-wider">AUTO TIMESTAMP</span>
                                    </div>

                                    <div className="flex gap-4">
                                        <button
                                            type="button"
                                            onClick={() => document.getElementById('checkin-image-final')?.click()}
                                            disabled={uploading}
                                            className="flex-1 h-20 bg-[#f8f7f5] hover:bg-slate-200 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-[2px] flex flex-col items-center justify-center gap-1 transition-all border-2 border-dashed border-slate-200 disabled:opacity-50"
                                        >
                                            {uploading ? (
                                                <div className="size-5 border-2 border-[#f27121] border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined text-2xl">photo_camera</span>
                                                    <span>{formData.imageUrl ? 'Chụp lại ảnh' : 'Chụp ảnh thực tế'}</span>
                                                </>
                                            )}
                                        </button>
                                        <input
                                            id="checkin-image-final"
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="hidden"
                                            onChange={handleImageUpload}
                                        />

                                        {formData.imageUrl && (
                                            <div className="size-20 rounded-2xl overflow-hidden border-4 border-white shadow-xl rotate-3 shrink-0">
                                                <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={gettingLocation || uploading || !formData.customerId}
                                className="w-full h-18 bg-[#f27121] text-white rounded-2xl font-black text-sm uppercase tracking-[3px] shadow-2xl shadow-orange-500/40 hover:bg-orange-600 transition-all active:scale-95 mt-4 disabled:bg-slate-300 disabled:shadow-none py-5"
                            >
                                {uploading ? 'ĐANG ĐỒNG BỘ...' : 'GỬI DỮ LIỆU ĐIỂM ĐẾN'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Checkin;
