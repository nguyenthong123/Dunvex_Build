import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { doc, updateDoc, serverTimestamp, collection, addDoc } from '../services/firebase';
import { useOrders } from '../hooks/useOrders';
import { MapPin, User, Camera, ArrowLeft, Truck, Navigation, CheckCircle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useOwner } from '../hooks/useOwner';
import { useToast } from '../components/shared/Toast';

const createOrderIcon = (status: string) => {
    let color = status === 'Hoàn thành' ? '#10b981' : '#ef4444'; // Green for complete, Red for pending
    let icon = status === 'Hoàn thành' ? 'check_circle' : 'local_shipping';
    
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="flex flex-col items-center group"><div class="relative"><div class="absolute -inset-3 rounded-full blur-lg opacity-30 animate-pulse" style="background-color:${color}"></div><span class="material-symbols-outlined text-5xl relative z-10 drop-shadow-[0_5px_15px_rgba(0,0,0,0.3)]" style="color:${color}">${icon}</span></div></div>`,
        iconSize: [45, 45],
        iconAnchor: [22, 45],
        popupAnchor: [0, -45]
    });
};

const MapUpdater = ({ center }: { center: [number, number] }) => {
    const map = useMap();
    useEffect(() => { map.setView(center, map.getZoom() || 13); }, [center, map]);
    useEffect(() => { const t = setTimeout(() => map.invalidateSize(), 300); return () => clearTimeout(t); }, [map]);
    return null;
};

const MapInstanceTracker = ({ setMapInstance }: { setMapInstance: (map: L.Map) => void }) => {
    const map = useMap();
    useEffect(() => { if (map) setMapInstance(map); }, [map, setMapInstance]);
    return null;
};

const Checkin = () => {
    const navigate = useNavigate();
    const owner = useOwner();
    const { showToast } = useToast();

    const { orders, loading: ordersLoading } = useOrders({ ownerId: owner.ownerId, enabled: !owner.loading && !!owner.ownerId });
    
    const [mapCenter, setMapCenter] = useState<[number, number]>([11.9931, 107.5257]);
    const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [uploading, setUploading] = useState(false);
    
    // Filter
    const [dateRange, setDateRange] = useState({
        start: new Date().toISOString().split('T')[0], // Today
        end: new Date().toISOString().split('T')[0]
    });

    const setDatePreset = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'all') => {
        const now = new Date(); let start = ''; const end = new Date().toISOString().split('T')[0];
        switch (preset) {
            case 'today': start = end; break;
            case 'yesterday': const y = new Date(now); y.setDate(now.getDate()-1); start = y.toISOString().split('T')[0]; break;
            case 'week': const w = new Date(now); w.setDate(now.getDate()-7); start = w.toISOString().split('T')[0]; break;
            case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]; break;
            case 'all': start = '2020-01-01'; break;
        }
        setDateRange({ start, end });
    };

    // Filter orders
    const deliveryOrders = orders.filter(o => {
        if (!o.deliveryLocation) return false;
        if (o.status !== 'Đơn chốt' && o.status !== 'Hoàn thành') return false;
        
        // Date filter
        const oDate = o.orderDate || (o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toISOString().split('T')[0] : '');
        if (dateRange.start !== '2020-01-01') {
            if (oDate < dateRange.start || oDate > dateRange.end) return false;
        }
        return true;
    });

    // Set map center to first order if available
    const mapCenterSet = React.useRef(false);
    useEffect(() => { 
        if (!mapCenterSet.current && deliveryOrders.length > 0) { 
            const firstPending = deliveryOrders.find(o => o.status === 'Đơn chốt') || deliveryOrders[0];
            if (firstPending.deliveryLocation) {
                setMapCenter([firstPending.deliveryLocation.lat, firstPending.deliveryLocation.lng]); 
                mapCenterSet.current = true; 
            }
        } 
    }, [deliveryOrders]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, orderId: string) => {
        const files = e.target.files; 
        if (!files || files.length === 0) return;
        
        setUploading(true);
        try {
            const { uploadImageToVPS } = await import('../utils/vpsUpload');
            const imageUrl = await uploadImageToVPS(files[0]);
            
            if (imageUrl) {
                // Update order status
                await updateDoc(doc(db, 'orders', orderId), {
                    status: 'Hoàn thành',
                    deliveryImage: imageUrl,
                    deliveredAt: serverTimestamp()
                });
                
                // Audit log
                await addDoc(collection(db, 'audit_logs'), {
                    action: 'Giao hàng thành công',
                    user: auth.currentUser?.displayName || auth.currentUser?.email || 'Tài xế',
                    userId: auth.currentUser?.uid || "",
                    ownerId: owner.ownerId,
                    details: `Đã giao đơn hàng ${orderId} thành công`,
                    createdAt: serverTimestamp()
                });

                showToast("Đã giao hàng thành công!", "success");
                setSelectedOrder(null);
            }
        } catch (err: any) { 
            showToast("Lỗi tải ảnh. Vui lòng thử lại.", "error"); 
        } finally { 
            setUploading(false); 
            e.target.value = ''; 
        }
    };

    const handleGetDirections = (lat: number, lng: number) => {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    };

    if (owner.loading) return null;

    const hasPermission = owner.role === 'admin' || (owner.accessRights?.checkin_create ?? true);
    if (!hasPermission) {
        return (
            <div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-slate-950 items-center justify-center p-8 min-h-screen">
                <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-full text-purple-500 mb-4"><span className="material-symbols-outlined text-5xl">lock</span></div>
                <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase mb-2">Không có quyền</h2>
                <p className="text-slate-400 text-sm">Bạn không có quyền truy cập bản đồ giao hàng.</p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-[100dvh] overflow-hidden bg-slate-100 dark:bg-slate-900">
            {/* FULL-SCREEN MAP */}
            <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false} className="z-0">
                <MapInstanceTracker setMapInstance={setMapInstance} />
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                />
                <MapUpdater center={mapCenter} />
                
                {deliveryOrders.map(order => (
                    <Marker 
                        key={order.id} 
                        position={[order.deliveryLocation.lat, order.deliveryLocation.lng]}
                        icon={createOrderIcon(order.status)}
                        eventHandlers={{
                            click: () => {
                                setSelectedOrder(order);
                                mapInstance?.flyTo([order.deliveryLocation.lat, order.deliveryLocation.lng], 16, { duration: 1 });
                            }
                        }}
                    >
                    </Marker>
                ))}
            </MapContainer>

            {/* HEADER OVERLAY */}
            <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/50 to-transparent pointer-events-none flex justify-between items-start pt-safe">
                <button onClick={() => navigate('/')} className="size-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white pointer-events-auto hover:bg-white/30 transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-2xl pointer-events-auto">
                    <h1 className="text-white font-black uppercase tracking-widest text-sm text-center drop-shadow-md">
                        Bản đồ Giao Hàng
                    </h1>
                </div>
            </div>

            {/* FILTER OVERLAY */}
            <div className="absolute top-20 right-4 z-10 pointer-events-auto flex flex-col gap-2">
                <select 
                    className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-800 shadow-lg outline-none"
                    onChange={(e) => setDatePreset(e.target.value as any)}
                >
                    <option value="today">Hôm nay</option>
                    <option value="yesterday">Hôm qua</option>
                    <option value="week">Tuần này</option>
                    <option value="month">Tháng này</option>
                    <option value="all">Tất cả</option>
                </select>
                <div className="bg-white/90 backdrop-blur-md rounded-xl p-3 shadow-lg border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="size-3 rounded-full bg-red-500"></div>
                        <span className="text-xs font-bold text-slate-700">Chờ giao ({deliveryOrders.filter(o => o.status === 'Đơn chốt').length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="size-3 rounded-full bg-emerald-500"></div>
                        <span className="text-xs font-bold text-slate-700">Đã giao ({deliveryOrders.filter(o => o.status === 'Hoàn thành').length})</span>
                    </div>
                </div>
            </div>

            {/* ORDER DETAIL MODAL */}
            <AnimatePresence>
                {selectedOrder && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setSelectedOrder(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm max-h-[85vh] flex flex-col relative overflow-hidden"
                        >
                            {/* Close Button */}
                            <button 
                                onClick={() => setSelectedOrder(null)}
                                className="absolute top-4 right-4 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-800 transition-colors z-10"
                            >
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>

                            {/* Header */}
                            <div className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                    <Truck size={12} /> {selectedOrder.orderCode}
                                </p>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight pr-8">
                                    {selectedOrder.customerName}
                                </h3>
                                <div className={`inline-block mt-2 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                    selectedOrder.status === 'Hoàn thành' 
                                    ? 'bg-emerald-100 text-emerald-700' 
                                    : 'bg-rose-100 text-rose-700'
                                }`}>
                                    {selectedOrder.status}
                                </div>
                            </div>

                            {/* Scrollable Content */}
                            <div className="p-5 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-900/50">
                                {/* Product List */}
                                <div className="mb-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Danh sách giao hàng</h4>
                                    <div className="space-y-2">
                                        {selectedOrder.items?.map((item: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 line-clamp-1 flex-1 pr-2">
                                                    {item.name}
                                                </span>
                                                <span className="text-sm font-black text-[#f27121] bg-[#f27121]/10 px-2 py-1 rounded-lg">
                                                    x{item.qty}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Compact Info */}
                                <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiền thu (COD)</span>
                                        <span className="text-base font-black text-[#f27121]">
                                            {new Intl.NumberFormat('vi-VN').format(selectedOrder.subTotal || 0)}đ
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <User size={14} className="text-slate-400" />
                                        <span className="font-bold text-slate-700 dark:text-slate-200">{selectedOrder.customerPhone || 'Không có SĐT'}</span>
                                    </div>
                                    <div className="flex items-start gap-2 text-xs">
                                        <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                                        <span className="font-medium text-slate-500 dark:text-slate-400 line-clamp-2">
                                            {selectedOrder.customerAddress || selectedOrder.rawDeliveryLocation || 'Không có địa chỉ cụ thể'}
                                        </span>
                                    </div>
                                </div>

                                {/* Delivery Proof Image (if completed) */}
                                {selectedOrder.status === 'Hoàn thành' && selectedOrder.deliveryImage && (
                                    <div className="mt-4 w-full h-32 rounded-xl overflow-hidden relative shadow-sm border border-slate-200 dark:border-slate-700">
                                        <img src={selectedOrder.deliveryImage} alt="Delivery Proof" className="w-full h-full object-cover"  loading="lazy" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
                                            <span className="text-white text-xs font-bold flex items-center gap-1">
                                                <CheckCircle size={14} className="text-emerald-400" /> Đã giao xong
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            {selectedOrder.status === 'Đơn chốt' && (
                                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-3 bg-white dark:bg-slate-900">
                                    <button 
                                        onClick={() => handleGetDirections(selectedOrder.deliveryLocation.lat, selectedOrder.deliveryLocation.lng)}
                                        className="flex-[0.8] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex justify-center items-center gap-1 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        <Navigation size={14} /> Chỉ đường
                                    </button>
                                    
                                    <div className="flex-[1.2] relative overflow-hidden flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors">
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            capture="environment"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            onChange={(e) => handleImageUpload(e, selectedOrder.id)}
                                            disabled={uploading}
                                        />
                                        <div className={`w-full py-3 text-white font-black uppercase tracking-widest text-[10px] flex justify-center items-center gap-1`}>
                                            {uploading ? (
                                                <span className="animate-pulse">Đang tải...</span>
                                            ) : (
                                                <><Camera size={14} /> Chụp Xong</>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Checkin;
