import { isNativeApp } from './utils/platform';

export const routeModules = {
	home: () => import('./views/Home'),
	quickOrder: () => import('./views/QuickOrder'),
	debts: () => import('./views/Debts'),
	adminSettings: () => import('./views/AdminSettings'),
	appSettings: () => import('./views/AppSettings'),
	login: () => import('./views/Login'),
	customers: () => import('./views/CustomerList'),
	suppliers: () => import('./views/SupplierList'),
	supplierDebts: () => import('./views/SupplierDebts'),
	purchaseOrders: () => import('./views/PurchaseOrders'),
	products: () => import('./views/ProductList'),
	inventory: () => import('./views/InventoryPage'),
	orders: () => import('./views/OrderList'),
	checkin: () => import('./views/Checkin'),
	attendance: () => import('./views/Attendance'),
	leaves: () => import('./views/LeaveManagement'),
	pricing: () => import('./views/Pricing'),
	priceList: () => import('./views/PriceList'),
	services: () => import('./views/SubscriptionServices'),
	coupons: () => import('./views/Coupons'),
	nexus: () => import('./views/NexusControl'),
	profile: () => import('./views/Profile'),
	backup: () => import('./views/Backup'),
	trash: () => import('./views/Trash'),
	download: () => import('./views/DownloadApp'),
};

const routeLoaders: Record<string, () => Promise<unknown>> = {
	'/': routeModules.home,
	'/quick-order': routeModules.quickOrder,
	'/debts': routeModules.debts,
	'/admin': routeModules.adminSettings,
	'/settings': routeModules.appSettings,
	'/customers': routeModules.customers,
	'/suppliers': routeModules.suppliers,
	'/supplier-debts': routeModules.supplierDebts,
	'/purchase-orders': routeModules.purchaseOrders,
	'/products': routeModules.products,
	'/inventory': routeModules.inventory,
	'/orders': routeModules.orders,
	'/checkin': routeModules.checkin,
	'/attendance': routeModules.attendance,
	'/leaves': routeModules.leaves,
	'/pricing': routeModules.pricing,
	'/price-list': routeModules.priceList,
	'/services': routeModules.services,
	'/coupons': routeModules.coupons,
	'/nexus-control': routeModules.nexus,
	'/profile': routeModules.profile,
	'/backup': routeModules.backup,
	'/trash': routeModules.trash,
	'/download': routeModules.download,
	'/downloads': routeModules.download,
	'/tai-ung-dung': routeModules.download,
};

export function preloadNativeRoute(path: string): void {
	if (!isNativeApp() || path.startsWith('event:')) return;

	const pathname = path.split(/[?#]/, 1)[0];
	const routePath = Object.keys(routeLoaders)
		.sort((left, right) => right.length - left.length)
		.find((candidate) => pathname === candidate || (candidate !== '/' && pathname.startsWith(`${candidate}/`)));
	const load = routePath ? routeLoaders[routePath] : undefined;
	if (load) {
		void load().catch((error) => {
			console.warn(`[Native route preload] Unable to preload ${routePath}:`, error);
		});
	}
}
