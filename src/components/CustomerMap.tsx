import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useToast } from './shared/Toast';

// Fix for Leaflet marker icon issue in React
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
	iconUrl: markerIcon,
	iconRetinaUrl: markerIconRetina,
	shadowUrl: markerShadow,
	iconSize: [25, 41],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface CustomerMapProps {
	customers?: any[];
	onClose: () => void;
}

const COLOR_PALETTE = [
	'#1A237E', '#FF6D00', '#10B981', '#9C27B0', '#E11D48',
	'#0284C7', '#F59E0B', '#7C3AED', '#DB2777', '#4B5563',
	'#B91C1C', '#15803D'
];

const createCustomIcon = (color: string) => {
	return L.divIcon({
		className: 'custom-div-icon',
		html: `
			<div style="
				background-color: ${color};
				width: 30px;
				height: 30px;
				border-radius: 50% 50% 50% 0;
				transform: rotate(-45deg);
				display: flex;
				align-items: center;
				justify-content: center;
				border: 2px solid white;
				box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
			">
				<div style="
					width: 10px;
					height: 10px;
					background-color: white;
					border-radius: 50%;
					transform: rotate(45deg);
				"></div>
			</div>
		`,
		iconSize: [30, 30],
		iconAnchor: [15, 30],
		popupAnchor: [0, -30]
	});
};

const MapController = ({ customers = [], focusLocation = null }: { customers?: any[], focusLocation?: [number, number] | null }) => {
	const map = useMap();
	const hasAutoFitted = useRef(false);

	useEffect(() => {
		if (focusLocation) {
			map.flyTo(focusLocation, 16, { duration: 2 });
			return;
		}

		if (customers && Array.isArray(customers) && customers.length > 0 && !hasAutoFitted.current) {
			try {
				const bounds = L.latLngBounds(customers.map(c => [Number(c.lat), Number(c.lng)]));
				if (bounds.isValid()) {
					map.fitBounds(bounds, { padding: [50, 50] });
					hasAutoFitted.current = true;
				}
			} catch (e) {
				console.error("MapController Error:", e);
			}
		}
	}, [customers, focusLocation, map]);

	return null;
};

const CustomerMap: React.FC<CustomerMapProps> = ({ customers = [], onClose }) => {
	const { showToast } = useToast();
	const [searchQuery, setSearchQuery] = useState('');
	const [focusLocation, setFocusLocation] = useState<[number, number] | null>(null);
	const [showSearchResults, setShowSearchResults] = useState(false);
	const [isLegendOpen, setIsLegendOpen] = useState(true);
	const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
	const [isLocating, setIsLocating] = useState(false);

	const safeCustomers = Array.isArray(customers) ? customers : [];

	const typeConfig = useMemo(() => {
		const types = Array.from(new Set(safeCustomers.map(c => c.type || 'Chưa phân loại')));
		const config: Record<string, { color: string }> = {};
		types.forEach((type, index) => {
			config[type] = {
				color: COLOR_PALETTE[index % COLOR_PALETTE.length]
			};
		});
		return config;
	}, [safeCustomers]);

	const [activeFilters, setActiveFilters] = useState<Record<string, boolean>>({});

	useEffect(() => {
		const filters: Record<string, boolean> = {};
		Object.keys(typeConfig).forEach(type => {
			filters[type] = true;
		});
		setActiveFilters(filters);
	}, [typeConfig]);

	const toggleFilter = (type: string) => {
		setActiveFilters(prev => ({ ...prev, [type]: !prev[type] }));
	};

	const validCustomers = safeCustomers.filter(c => c.lat && c.lng);
	const visibleCustomers = validCustomers.filter(c => {
		const type = c.type || 'Chưa phân loại';
		return activeFilters[type] !== false;
	});

	const filteredSearchResults = searchQuery.trim() === ''
		? []
		: validCustomers.filter(c =>
			(c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
			(c.businessName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
			(c.phone || '').includes(searchQuery)
		).slice(0, 5);

	const handleSearchSelect = (customer: any) => {
		const type = customer.type || 'Chưa phân loại';
		if (activeFilters[type] === false) {
			toggleFilter(type);
		}
		setFocusLocation([Number(customer.lat), Number(customer.lng)]);
		setSearchQuery(customer.name || '');
		setShowSearchResults(false);
	};

	const handleGetMyLocation = () => {
		if (!navigator.geolocation) {
			showToast('Trình duyệt không hỗ trợ định vị', "error");
			return;
		}
		setIsLocating(true);
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
				setUserLocation(loc);
				setFocusLocation(loc);
				setIsLocating(false);
			},
			() => {
				setIsLocating(false);
				showToast('Không thể lấy vị trí. Hãy bật GPS và cho phép truy cập.', "warning");
			},
			{ enableHighAccuracy: true, timeout: 5000 }
		);
	};

	return (
		<div className="fixed inset-0 z-[200] flex flex-col bg-white dark:bg-slate-950 animate-in fade-in duration-300">
			{/* Header */}
			<header className="h-16 md:h-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 relative z-[2002]">
				<div className="flex items-center gap-3">
					<div className="size-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-[#FF6D00]">
						<span className="material-symbols-outlined">map</span>
					</div>
					<div className="hidden sm:block">
						<h2 className="text-lg font-black text-[#1A237E] dark:text-indigo-400 uppercase tracking-tight">Bản đồ khách hàng</h2>
						<p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Phân tích mật độ & Vị trí</p>
					</div>
				</div>

				<div className="flex-1 max-w-md mx-4 relative">
					<div className="relative">
						<span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg font-bold">search</span>
						<input
							type="text"
							placeholder="Tìm tên, cửa hàng, SĐT..."
							className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-orange-500/20"
							value={searchQuery}
							onChange={(e) => {
								setSearchQuery(e.target.value);
								setShowSearchResults(true);
							}}
							onFocus={() => setShowSearchResults(true)}
						/>
					</div>

					{showSearchResults && filteredSearchResults.length > 0 && (
						<div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden z-[2050] animate-in slide-in-from-top-2 duration-200">
							{filteredSearchResults.map(c => (
								<button
									key={c.id}
									onClick={() => handleSearchSelect(c)}
									className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-800 last:border-none"
								>
									<div className="size-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center font-bold text-[10px] shrink-0">
										{(c.name?.[0] || 'K').toUpperCase()}
									</div>
									<div className="text-left overflow-hidden">
										<p className="text-xs font-black text-slate-800 dark:text-slate-200 leading-none mb-1 truncate">{c.name}</p>
										<p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter truncate">{c.businessName || c.type}</p>
									</div>
								</button>
							))}
						</div>
					)}
				</div>

				<button
					onClick={onClose}
					className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all"
				>
					<span className="material-symbols-outlined">close</span>
				</button>
			</header>

			{/* Map Container */}
			<div className="flex-1 relative" onClick={() => setShowSearchResults(false)}>
				{validCustomers.length === 0 && !userLocation ? (
					<div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-slate-50 dark:bg-slate-900/50 z-10">
						<div className="bg-white dark:bg-slate-800 p-8 rounded-full shadow-xl mb-6">
							<span className="material-symbols-outlined text-6xl text-slate-200 dark:text-slate-700">wrong_location</span>
						</div>
						<h3 className="text-xl font-black text-slate-800 dark:text-white uppercase mb-2">Chưa có dữ liệu vị trí</h3>
						<p className="text-slate-500 dark:text-slate-400 max-w-sm">Dường như chưa có khách hàng nào được cập nhật tọa độ GPS. Hãy vào chi tiết khách hàng và lấy vị trí để hiển thị trên bản đồ.</p>
					</div>
				) : (
					<MapContainer
						center={[21.0285, 105.8542]}
						zoom={13}
						style={{ height: '100%', width: '100%' }}
						zoomControl={false}
					>
						<TileLayer
							attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
							url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
						/>

						{userLocation && (
							<Marker position={userLocation} icon={L.divIcon({
								className: 'user-location-icon',
								html: `<div class="size-4 bg-blue-500 rounded-full border-2 border-white shadow-xl ring-4 ring-blue-500/30 animate-pulse"></div>`,
								iconSize: [20, 20],
								iconAnchor: [10, 10]
							})}>
								<Popup>Bạn đang đứng ở đây</Popup>
							</Marker>
						)}

						{visibleCustomers.map((customer) => {
							const type = customer.type || 'Chưa phân loại';
							const color = typeConfig[type]?.color || '#E11D48';

							return (
								<Marker
									key={customer.id}
									position={[Number(customer.lat), Number(customer.lng)]}
									icon={createCustomIcon(color)}
								>
									<Popup className="custom-popup">
										<div className="p-1 min-w-[150px]">
											<div className="flex items-center gap-2 mb-2">
												<div className="size-8 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center font-black text-xs shrink-0">
													{(customer.name?.[0] || 'K').toUpperCase()}
												</div>
												<div className="overflow-hidden">
													<h4 className="font-black text-[#1A237E] dark:text-indigo-300 uppercase text-xs leading-none truncate">{customer.name}</h4>
													<span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{type}</span>
												</div>
											</div>
											<p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed mb-3 font-medium">
												<span className="material-symbols-outlined text-[10px] align-middle mr-1">location_on</span>
												{customer.address || 'Không có địa chỉ'}
											</p>
											<a
												href={`tel:${customer.phone}`}
												className="flex items-center justify-center gap-2 w-full bg-[#1A237E] dark:bg-indigo-600 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
											>
												<span className="material-symbols-outlined text-xs">call</span> Gọi ngay
											</a>
										</div>
									</Popup>
								</Marker>
							);
						})}

						<MapController customers={validCustomers} focusLocation={focusLocation} />

						<div className="leaflet-bottom leaflet-right m-4 flex flex-col items-end gap-3 pointer-events-none">
							<button
								onClick={(e) => { e.stopPropagation(); handleGetMyLocation(); }}
								disabled={isLocating}
								className={`size-12 bg-white dark:bg-slate-900 text-blue-600 rounded-full shadow-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-center transition-all active:scale-90 pointer-events-auto relative z-[2001] hover:bg-slate-50 dark:hover:bg-slate-800 ${isLocating ? 'animate-spin' : ''}`}
								title="Vị trí của tôi"
							>
								<span className="material-symbols-outlined font-black">my_location</span>
							</button>

							<button
								onClick={(e) => { e.stopPropagation(); setIsLegendOpen(!isLegendOpen); }}
								className={`size-12 bg-white dark:bg-slate-900 ${isLegendOpen ? 'text-[#FF6D00]' : 'text-slate-400'} rounded-full shadow-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-center transition-all active:scale-90 pointer-events-auto relative z-[2001] hover:bg-slate-50 dark:hover:bg-slate-800`}
							>
								<span className="material-symbols-outlined font-black">{isLegendOpen ? 'layers_clear' : 'layers'}</span>
							</button>

							<div className={`bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 space-y-2 pointer-events-auto relative z-[2000] max-h-[300px] overflow-y-auto custom-scrollbar min-w-[200px] transition-all duration-300 origin-bottom-right transform ${isLegendOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
								<p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-50 dark:border-slate-800 pb-2">Phân loại khách hàng</p>
								<div className="space-y-1">
									{Object.entries(typeConfig).map(([type, config]) => (
										<button
											key={type}
											onClick={() => toggleFilter(type)}
											className={`flex items-center gap-3 w-full p-2 rounded-xl transition-all ${activeFilters[type] !== false ? 'hover:bg-slate-50 dark:hover:bg-slate-800' : 'opacity-40 grayscale'}`}
										>
											<div className="size-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: config.color }}></div>
											<span className={`text-[10px] font-black uppercase tracking-tight text-left truncate flex-1 ${activeFilters[type] !== false ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>{type}</span>
											<span className="material-symbols-outlined text-xs">{activeFilters[type] !== false ? 'visibility' : 'visibility_off'}</span>
										</button>
									))}
								</div>
							</div>
						</div>
					</MapContainer>
				)}
			</div>
		</div>
	);
};

export default CustomerMap;
