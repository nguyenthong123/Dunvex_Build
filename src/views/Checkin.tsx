import React, { useState, useEffect } from 'react';
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
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
};

// Helper to update map center and handle resize
const MapUpdater = ({ center, sidebarExpanded }: { center: [number, number], sidebarExpanded: boolean }) => {
    const map = useMap();
    useEffect(() => {
        map.setView(center, map.getZoom());
    }, [center, map]);

    useEffect(() => {
        // Safari needs a slightly longer delay or immediate trigger + delay
        map.invalidateSize();
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 1000);
        return () => clearTimeout(timer);
    }, [map, sidebarExpanded]);

    return null;
};


import { useOwner } from '../hooks/useOwner';

const Checkin = () => {
    const navigate = useNavigate();
    const owner = useOwner();

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
        imageUrl: ''
    });

    const [gettingLocation, setGettingLocation] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [sidebarExpanded, setSidebarExpanded] = useState(true);


    const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

    const formatDriveUrl = (url: string) => {

        if (!url) return '';
        if (url.includes('drive.google.com')) {
            const fileId = url.split('id=')[1];
            if (fileId) return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
        }
        return url;
    };

    const handleDeleteCheckin = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm("Bạn có chắc chắn muốn xóa hoạt động này không?")) {
            try {
                await deleteDoc(doc(db, 'checkins', id));
            } catch (error) {
                console.error("Error deleting checkin:", error);
                alert("Lỗi khi xóa hoạt động");
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
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            let base64Data = "";

            // Safely read file using arrayBuffer (works on Safari)
            if (file.arrayBuffer) {
                const buffer = await file.arrayBuffer();
                let binary = '';
                const bytes = new Uint8Array(buffer);
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                base64Data = window.btoa(binary);
            } else {
                // Fallback (unlikely needed for modern browsers)
                // @ts-ignore
                const Reader = window.FileReader || FileReader;
                if (Reader) {
                    const reader = new Reader();
                    base64Data = await new Promise((resolve, reject) => {
                        reader.onload = () => {
                            if (reader.result) resolve((reader.result as string).split(',')[1]);
                            else reject(new Error("Empty result"));
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                } else {
                    throw new Error("Trình duyệt không hỗ trợ đọc file.");
                }
            }

            const response = await fetch('https://script.google.com/macros/s/AKfycbwIup8ysoKT4E_g8GOVrBiQxXw7SOtqhLWD2b0GOUT54MuoXgTtxP42XSpFR_3aoXAG7g/exec', {
                method: 'POST',
                redirect: 'follow',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
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
        } catch (error: any) {
            console.error(error);
            alert(`Lỗi xử lý tệp: ${error.message}`);
        } finally {
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
                setMapCenter([latitude, longitude]);
                mapInstance?.flyTo([latitude, longitude], 16);


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

        const customer = customers.find(c => c.id === formData.customerId);

        // Distance Check (Limited to 50 meters)
        if (customer && customer.lat && customer.lng) {
            const distance = calculateDistance(
                formData.location.lat,
                formData.location.lng,
                customer.lat,
                customer.lng
            );

            if (distance > 50) {
                alert(`Bạn đang cách khách hàng ${Math.round(distance)}m. Vui lòng di chuyển lại gần phạm vi 50m để check-in!`);
                return;
            }
        }

        setLoading(true);
        try {
            await addDoc(collection(db, 'checkins'), {
                ...formData,
                customerName: customer?.name || 'Vãng lai',
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
                imageUrl: ''
            });
            alert("Checkin thành công!");
        } catch (error) {
            console.error(error);
            alert("Lỗi lưu dữ liệu.");
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
        <div className="flex-1 flex flex-col lg:flex-row relative overflow-hidden h-screen lg:h-full min-h-[500px]">
            {/* Map Area */}
            <div className="relative flex-1 h-[60vh] lg:h-full w-full bg-[#f0f2f5] dark:bg-slate-800 z-[1] overflow-hidden transition-colors duration-300 shadow-inner">
                <MapContainer
                    center={mapCenter}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                    ref={setMapInstance}
                >

                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <MapUpdater center={mapCenter} sidebarExpanded={sidebarExpanded} />


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

                    {/* Filtered history markers */}
                    {(() => {
                        const filtered = recentCheckins.filter(item => {
                            const itemDate = item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toISOString().split('T')[0] : '';
                            const matchDate = itemDate >= dateRange.start && itemDate <= dateRange.end;
                            const matchSearch = item.customerName.toLowerCase().includes(searchQuery.toLowerCase());
                            return matchDate && matchSearch;
                        });

                        return filtered.map((checkin) => {
                            // Support both plain object and Firestore GeoPoint
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
                                            <p className="text-[7px] text-slate-300 mt-2">{checkin.address}</p>
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        });
                    })()}
                </MapContainer>


                {/* Map Overlay Controls */}
                <div className="absolute top-6 left-6 flex flex-col gap-3 z-[1000]">
                    <div className="flex flex-col gap-2 mb-4">
                        <button
                            onClick={() => navigate('/')}
                            className="size-11 bg-[#1A237E] dark:bg-indigo-900 text-white rounded-2xl shadow-2xl flex items-center justify-center hover:bg-slate-900 dark:hover:bg-indigo-950 transition-all border border-white/20"
                            title="Về Trang Chủ"
                        >
                            <span className="material-symbols-outlined">home</span>
                        </button>
                        <button
                            onClick={() => navigate(-1)}
                            className="size-11 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 rounded-2xl shadow-2xl flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-all border border-slate-100 dark:border-slate-800"
                            title="Quay lại"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                    </div>

                    <button
                        onClick={() => mapInstance?.zoomIn()}
                        className="size-11 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-black text-[#1A237E] dark:text-indigo-400 border border-slate-100 dark:border-slate-800"
                    >
                        <span className="material-symbols-outlined">add</span>
                    </button>
                    <button
                        onClick={() => mapInstance?.zoomOut()}
                        className="size-11 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-black text-[#1A237E] dark:text-indigo-400 border border-slate-100 dark:border-slate-800"
                    >
                        <span className="material-symbols-outlined">remove</span>
                    </button>
                    <button
                        onClick={handleGetLocation}
                        className={`size-11 rounded-2xl shadow-2xl flex items-center justify-center transition-all border border-slate-100 dark:border-slate-800 ${gettingLocation ? 'bg-orange-50 text-orange-500 animate-pulse' : 'bg-white dark:bg-slate-900 text-[#f27121] hover:bg-orange-50 dark:hover:bg-slate-800'}`}
                        title="Vị trí của tôi"
                    >
                        <span className="material-symbols-outlined">{gettingLocation ? 'sync' : 'my_location'}</span>
                    </button>

                    {/* Expand activities button (Only visible when collapsed on desktop) */}
                    {!sidebarExpanded && (
                        <button
                            onClick={() => setSidebarExpanded(true)}
                            className="hidden lg:flex size-11 bg-[#1A237E] dark:bg-indigo-900 text-white rounded-2xl shadow-2xl items-center justify-center hover:bg-indigo-900 dark:hover:bg-indigo-950 transition-all animate-in fade-in zoom-in"
                            title="Mở danh sách hoạt động"
                        >
                            <span className="material-symbols-outlined">list_alt</span>
                        </button>
                    )}
                </div>



                {/* Desktop Check-in Button Overlay */}
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 hidden lg:block z-[999]">
                    <button
                        onClick={() => setShowCheckinForm(true)}
                        className="flex items-center gap-4 bg-[#f27121] hover:bg-orange-600 text-white px-10 py-5 rounded-[2.5rem] shadow-[0_20px_40px_rgba(242,113,33,0.3)] transition-all transform hover:scale-105 active:scale-95 font-black text-sm uppercase tracking-[3px]"
                    >
                        <span className="material-symbols-outlined text-2xl">add_location_alt</span>
                        Checkin Ngay
                    </button>
                </div>

            </div>

            {/* Sidebar / Bottom Sheet */}
            <aside
                className={`lg:h-full lg:relative absolute bottom-0 left-0 w-full bg-white dark:bg-slate-900 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] lg:shadow-none ${sheetOpen ? 'z-[60]' : 'z-[5]'} overflow-hidden flex flex-col transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] 
                        ${showCheckinForm ? 'translate-y-full opacity-0 pointer-events-none scale-95' : 'translate-y-0 opacity-100'}
                        ${sheetOpen ? 'h-[92vh] rounded-t-[3rem]' : 'h-[14vh] lg:h-full rounded-t-[3rem] lg:rounded-none'} 
                        ${sidebarExpanded ? 'lg:w-[30%] lg:min-w-[400px] lg:max-w-[460px] lg:border-l lg:border-[#e6dfdb] dark:lg:border-slate-800' : 'lg:w-0 lg:min-w-0 lg:max-w-0 lg:border-none'}`}
            >

                {/* Desktop Toggle Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setSidebarExpanded(!sidebarExpanded);
                    }}
                    className={`hidden lg:flex absolute -left-6 top-10 size-12 bg-white dark:bg-slate-900 border border-[#e6dfdb] dark:border-slate-700 rounded-full items-center justify-center shadow-2xl text-[#FF6D00] hover:bg-orange-50 dark:hover:bg-slate-800 transition-all z-[100] group/toggle ${!sidebarExpanded ? 'rotate-180 translate-x-12' : ''}`}
                >
                    <span className="material-symbols-outlined font-black text-3xl">{sidebarExpanded ? 'chevron_right' : 'chevron_left'}</span>
                    {/* Tooltip */}
                    <div className={`absolute right-full mr-4 px-3 py-1.5 bg-[#1A237E] dark:bg-indigo-900 text-white text-[10px] font-black uppercase rounded-lg opacity-0 group-hover/toggle:opacity-100 pointer-events-none transition-all whitespace-nowrap shadow-xl ${!sidebarExpanded ? 'hidden' : ''}`}>
                        Thu gọn danh sách
                    </div>
                </button>


                <div className={`flex flex-col h-full transition-opacity duration-300 ${sidebarExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>


                    {/* Drawer Handle / Header for Mobile */}
                    <div
                        className="w-full h-14 lg:hidden flex flex-col justify-center items-center cursor-pointer shrink-0 border-b border-slate-50 dark:border-slate-800"
                        onClick={(e) => {
                            e.stopPropagation();
                            setSheetOpen(!sheetOpen);
                        }}
                    >
                        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full mb-1"></div>
                        <p className="text-[10px] font-black uppercase text-slate-400">Danh sách hoạt động</p>
                    </div>


                    {/* Header Contents */}
                    <div className="px-7 pb-4 lg:pt-8 lg:pb-4 flex flex-col gap-5 shrink-0">
                        <div className="flex items-center justify-between">
                            <h1 className="text-[#181411] dark:text-white text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                                Hoạt động
                                <span className="text-[10px] font-black uppercase px-2 py-1 bg-orange-50 dark:bg-orange-900/20 text-[#f27121] dark:text-orange-400 rounded-lg tracking-widest border border-orange-100 dark:border-orange-900/30">Sale</span>
                            </h1>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">
                                <span className="material-symbols-outlined text-[20px]">search</span>
                            </span>
                            <input
                                className="w-full pl-12 pr-4 py-4 bg-[#f8f7f5] dark:bg-slate-800 border-none rounded-[1.5rem] text-sm font-black focus:ring-2 focus:ring-[#f27121]/30 text-[#181411] dark:text-white placeholder-slate-400 transition-all border border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-slate-100 dark:focus:border-slate-700 shadow-inner dark:shadow-none"
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
                            <div className="flex gap-2 p-1 bg-[#f8f7f5] dark:bg-slate-800 rounded-2xl">
                                <input
                                    type="date"
                                    className="flex-1 bg-transparent border-none text-[10px] font-black uppercase p-2 focus:ring-0 text-slate-700 dark:text-slate-300"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                />
                                <div className="flex items-center text-slate-300 dark:text-slate-600">
                                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </div>
                                <input
                                    type="date"
                                    className="flex-1 bg-transparent border-none text-[10px] font-black uppercase p-2 focus:ring-0 text-slate-700 dark:text-slate-300"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                />
                            </div>

                            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                <button className="whitespace-nowrap px-6 py-2.5 bg-[#f27121] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-all">Tất cả</button>
                                <button className="whitespace-nowrap px-6 py-2.5 bg-[#f8f7f5] dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all">Khách mới</button>
                                <button className="whitespace-nowrap px-6 py-2.5 bg-[#f8f7f5] dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all">Viếng thăm</button>
                                <button className="whitespace-nowrap px-6 py-2.5 bg-[#f8f7f5] dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all">Khiếu nại</button>
                            </div>
                        </div>
                    </div>

                    {/* Activity Feed List with Client-side Filter & Pagination */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-4 lg:px-6 py-6 pb-32 space-y-6 bg-[#f8f7f5]/30 dark:bg-slate-900/50">
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
                                    <div className="py-24 flex flex-col items-center justify-center text-slate-200 dark:text-slate-700 gap-5 uppercase font-black text-xs tracking-[6px] opacity-50">
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
                                                <div className="size-10 lg:size-14 rounded-xl lg:rounded-2xl bg-[#1A237E] dark:bg-indigo-900 flex items-center justify-center text-white font-black text-base lg:text-xl shadow-xl shadow-blue-900/10 border-2 border-white dark:border-slate-800 ring-4 ring-transparent group-hover:ring-blue-50 dark:group-hover:ring-indigo-900/30 transition-all">
                                                    {checkin.customerName[0]}
                                                </div>
                                            </div>
                                            <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 lg:p-5 rounded-[1.5rem] lg:rounded-[2rem] shadow-sm hover:shadow-2xl transition-all cursor-pointer group-hover:-translate-y-1 overflow-hidden">
                                                <div className="flex justify-between items-start mb-3 gap-2">
                                                    <div className="space-y-0.5 min-w-0">
                                                        <h4 className="text-[13px] lg:text-sm font-black text-[#1A237E] dark:text-indigo-400 uppercase tracking-tight leading-tight truncate">{checkin.customerName}</h4>
                                                        <div className="flex flex-wrap items-center gap-1.5 lg:gap-2">
                                                            <span className={`px-1.5 py-0.5 rounded text-[7px] lg:text-[8px] font-black uppercase tracking-widest ${checkin.purpose === 'Khiếu nại' ? 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400' :
                                                                checkin.purpose === 'Khách mới' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 dark:text-emerald-400' :
                                                                    checkin.purpose === 'Viếng thăm' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' :
                                                                        checkin.purpose === 'Thăm hỏi' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' :
                                                                            checkin.purpose === 'Giao hàng' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400' :
                                                                                checkin.purpose === 'Thu tiền' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-orange-50 dark:bg-orange-900/20 text-[#f27121] dark:text-orange-400'
                                                                }`}>
                                                                {checkin.purpose}
                                                            </span>
                                                            <span className="text-[8px] lg:text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase truncate">• {checkin.address.split(',')[0]}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        <span className="shrink-0 text-[9px] lg:text-[10px] text-slate-300 dark:text-slate-600 font-black uppercase tracking-tighter bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded-lg">
                                                            {checkin.createdAt?.seconds ? new Date(checkin.createdAt.seconds * 1000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'NOW'}
                                                        </span>
                                                        <button
                                                            onClick={(e) => handleDeleteCheckin(checkin.id, e)}
                                                            className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                                            title="Xóa"
                                                        >
                                                            <span className="material-symbols-outlined text-lg">delete</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                {checkin.imageUrl && (
                                                    <div className="mb-3 lg:mb-4 rounded-xl lg:rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 aspect-video relative group/img shadow-sm">
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
                                                    <div className="p-3 lg:p-4 bg-[#f8f7f5] dark:bg-slate-900/50 rounded-xl lg:rounded-2xl border-l-[4px] lg:border-l-[6px] border-[#1A237E] dark:border-indigo-500 mb-3 lg:mb-4 shadow-inner dark:shadow-none">
                                                        <p className="text-[11px] lg:text-[12px] text-[#1A237E] dark:text-indigo-300 font-bold leading-relaxed line-clamp-3 italic">"{checkin.note}"</p>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-2 text-[9px] lg:text-[10px] text-slate-400 dark:text-slate-500 font-bold leading-tight">
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
                                            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-slate-700 dark:text-slate-300"
                                        >
                                            Trang trước
                                        </button>
                                        <div className="text-[10px] font-black text-slate-400 dark:text-slate-500">
                                            {currentPage} / {totalPages || 1}
                                        </div>
                                        <button
                                            disabled={currentPage >= totalPages}
                                            onClick={() => setCurrentPage(prev => prev + 1)}
                                            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-slate-700 dark:text-slate-300"
                                        >
                                            Trang sau
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            </aside>

            {/* Checkin Form Modal */}
            {showCheckinForm && (
                <div className="fixed inset-0 z-[2000] flex items-end md:items-center justify-center bg-[#1A237E]/80 dark:bg-black/80 backdrop-blur-sm p-0 md:p-4 font-['Manrope'] transition-colors duration-300">

                    <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[95vh] md:max-h-[85vh] animate-in slide-in-from-bottom duration-300 overflow-hidden transition-colors duration-300">
                        <div className="px-8 py-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-[#1A237E] dark:text-indigo-400 uppercase tracking-tight">Thực hiện Checkin</h3>
                                <p className="text-[10px] font-black text-[#f27121] dark:text-orange-400 uppercase tracking-[2px]">
                                    {currentTime.toLocaleDateString('vi-VN')} — {currentTime.toLocaleTimeString('vi-VN')}
                                </p>
                            </div>
                            <button onClick={() => setShowCheckinForm(false)} className="size-10 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-all">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSubmitCheckin} className="flex-1 overflow-y-auto p-8 space-y-6 pb-12 custom-scrollbar">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px] pl-1 mb-2 text-center md:text-left">Chọn Khách Hàng Mục Tiêu *</label>
                                    <div className="relative">
                                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[#f27121] dark:text-orange-400">
                                            <span className="material-symbols-outlined">person</span>
                                        </div>
                                        <select
                                            required
                                            className="w-full pl-14 pr-4 h-16 bg-[#f8f7f5] dark:bg-slate-800 border-none rounded-2xl text-sm font-black focus:ring-2 focus:ring-[#f27121]/50 appearance-none text-[#181411] dark:text-white"
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
                                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px] pl-1 mb-2">Vị trí hiện tại *</label>
                                        <div className="flex gap-2">
                                            <div className="flex-1 min-h-16 bg-[#f8f7f5] dark:bg-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-slate-600 dark:text-slate-300 border-none flex items-center leading-relaxed">
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
                                                className="size-16 bg-[#1A237E] dark:bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-black dark:hover:bg-indigo-800 shadow-xl shadow-blue-500/20 active:scale-95 transition-all shrink-0"
                                            >
                                                <span className="material-symbols-outlined text-2xl">my_location</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px] pl-1 mb-2">Trạng thái Checkin *</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['Khách mới', 'Viếng thăm', 'Khiếu nại'].map((p) => (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, purpose: p }))}
                                                    className={`py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${formData.purpose === p
                                                        ? 'bg-[#1A237E] dark:bg-indigo-600 text-white shadow-xl shadow-blue-500/20'
                                                        : 'bg-[#f8f7f5] dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                        }`}
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px] pl-1 mb-2">Nội dung trao đổi</label>
                                    <textarea
                                        rows={4}
                                        placeholder="Ghi nhanh nội dung làm việc hoặc yêu cầu của khách..."
                                        className="w-full bg-[#f8f7f5] dark:bg-slate-800 border-none rounded-2xl p-5 text-sm font-bold focus:ring-2 focus:ring-[#f27121]/50 resize-none placeholder-slate-300 dark:placeholder-slate-600 text-[#181411] dark:text-white"
                                        value={formData.note}
                                        onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px]">Hình ảnh hiện trường</label>
                                        <span className="text-[10px] text-slate-300 dark:text-slate-600 font-bold italic tracking-wider">AUTO TIMESTAMP</span>
                                    </div>

                                    <div className="flex gap-4">
                                        <button
                                            type="button"
                                            onClick={() => document.getElementById('checkin-image-final')?.click()}
                                            disabled={uploading}
                                            className="flex-1 h-20 bg-[#f8f7f5] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-[2px] flex flex-col items-center justify-center gap-1 transition-all border-2 border-dashed border-slate-200 dark:border-slate-700 disabled:opacity-50"
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
                                            <div className="size-20 rounded-2xl overflow-hidden border-4 border-white dark:border-slate-800 shadow-xl rotate-3 shrink-0">
                                                <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={gettingLocation || uploading || !formData.customerId}
                                className="w-full h-18 bg-[#f27121] text-white rounded-2xl font-black text-sm uppercase tracking-[3px] shadow-2xl shadow-orange-500/40 hover:bg-orange-600 transition-all active:scale-95 mt-4 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:shadow-none py-5"
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
