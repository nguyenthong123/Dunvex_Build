import { useLocation } from 'react-router-dom';
import { useOwner } from './useOwner';
import { auth } from '../services/firebase';

export interface NavItem {
	icon: string;
	label: string;
	path: string;
	isCenter?: boolean;
	mobileOnly?: boolean;
	desktopOnly?: boolean;
	permissionKey?: string;
}

/**
 * Hook trung tâm quản lý cấu hình điều hướng và các nút động theo ngữ cảnh.
 * Giúp mã nguồn sạch hơn và đảm bảo tính nhất quán trên toàn hệ thống.
 */
export const useNavigationConfig = () => {
	const location = useLocation();
	const path = location.pathname;
	const owner = useOwner();

	const hasPermission = (key?: string) => {
		if (!key) return true;
		
		// Chủ sở hữu (Owner) luôn có toàn quyền
		if (!owner.isEmployee && key !== 'nexus_control') return true;

		if (key === 'nexus_control') {
			return auth.currentUser?.email === 'dunvex.green@gmail.com';
		}

		// Nếu kiểm tra quyền Truy cập Admin, cho phép nếu có bất kỳ quyền quản lý nào
		if (key === 'admin') {
			if (owner.accessRights?.admin === true || 
				owner.accessRights?.users_manage === true || 
				owner.accessRights?.system_manage === true) {
				return true;
			}
		}

		// Kiểm tra phân quyền dựa trên nút Bật/Tắt
		const val = owner.accessRights?.[key];
		
		// Nếu đã được set cụ thể trong database (true hoặc false) thì lấy giá trị đó
		if (val !== undefined) return val === true;

		// Nếu chưa được set (mới thêm tính năng hoặc chưa từng click toggle):
		// Các mục nhạy cảm/quản lý sẽ KHÓA mặc định
		const sensitiveKeys = ['admin', 'users_manage', 'system_manage'];
		if (sensitiveKeys.includes(key)) return false;

		// Các mục nghiệp vụ (Đơn hàng, Kho, Khách hàng...) sẽ MỞ mặc định
		return true;
	};

	// 1. Cấu hình nút cộng ở giữa thay đổi theo trang
	const getCenterItem = (): NavItem => {
		const path = location.pathname;

		if (path === '/orders' || path === '/') {
			return {
				icon: 'add_shopping_cart',
				label: 'Lên đơn',
				path: '/quick-order',
				permissionKey: 'orders_create'
			};
		}

		if (path === '/inventory') {
			return {
				icon: 'add_box',
				label: 'Phiếu Kho',
				path: 'event:open-mobile-add',
				permissionKey: 'inventory_manage'
			};
		}

		if (path === '/customers') {
			return {
				icon: 'person_add',
				label: 'Thêm Khách',
				path: 'event:open-mobile-add',
				permissionKey: 'customers_manage'
			};
		}

		if (path === '/debts') {
			return {
				icon: 'payments',
				label: 'Thu nợ',
				path: 'event:open-mobile-add',
				permissionKey: 'debts_manage'
			};
		}

		if (path === '/admin') {
			return {
				icon: 'person_add',
				label: 'Thêm NV',
				path: 'event:open-mobile-add',
				permissionKey: 'users_manage'
			};
		}

		if (path.startsWith('/services')) {
			return {
				icon: 'shopping_cart',
				label: 'Mua gói',
				path: '/services?action=buy',
			};
		}

		if (path === '/attendance') {
			return {
				icon: 'task_alt',
				label: 'Chấm công vào',
				path: '/attendance?action=checkin',
				permissionKey: 'checkin_create'
			};
		}

		if (path === '/sale-bot') {
			return {
				icon: 'forum',
				label: 'Chat AI',
				path: 'event:toggle-salebot',
			};
		}

		if (path === '/settings') {
			return {
				icon: 'contrast',
				label: 'Chế độ tối',
				path: '/settings?action=toggleTheme',
			};
		}

		if (path === '/price-list') {
			return {
				icon: 'cloud_upload',
				label: 'Cập nhật Data',
				path: 'event:open-mobile-add',
			};
		}

		if (path === '/coupons') {
			return {
				icon: 'confirmation_number',
				label: 'Tạo mã',
				path: 'event:open-mobile-add',
				permissionKey: 'coupons_manage'
			};
		}

		// Mặc định cho các trang khác
		return {
			icon: 'add',
			label: 'Thêm SP',
			path: 'event:open-mobile-add',
			permissionKey: 'products_manage'
		};
	};

	// 2. Toàn bộ danh sách Menu trong hệ thống
	const allItems: NavItem[] = [
		{ icon: 'home', label: 'Trang chủ', path: '/' },                                      // 0
		{ icon: 'receipt_long', label: 'Đơn hàng', path: '/orders', permissionKey: 'orders_view' }, // 1
		{ ...getCenterItem(), isCenter: true },                                              // 2
		{ icon: 'account_balance_wallet', label: 'Công nợ', path: '/debts', permissionKey: 'debts_manage' }, // 3
		{ icon: 'group', label: 'Khách hàng', path: '/customers', permissionKey: 'customers_manage' },       // 4
		{ icon: 'category', label: 'Sản phẩm', path: '/products', permissionKey: 'inventory_view' },     // 5
		{ icon: 'inventory_2', label: 'Tồn kho', path: '/inventory', permissionKey: 'inventory_view' },    // 5.5
		{ icon: 'local_shipping', label: 'Đơn nhập hàng', path: '/purchase-orders', permissionKey: 'admin' }, // NEW
		{ icon: 'storefront', label: 'Nhà cung cấp', path: '/suppliers', permissionKey: 'admin' }, // NEW
		{ icon: 'account_balance', label: 'Công nợ NCC', path: '/supplier-debts', permissionKey: 'admin' }, // NEW
		{ icon: 'request_quote', label: 'Báo giá', path: '/price-list' },                                     // 6
		{ icon: 'location_on', label: 'Checkin', path: '/checkin?action=history', permissionKey: 'checkin_create' }, // 7
		{ icon: 'confirmation_number', label: 'Ưu đãi', path: '/coupons' },                                    // 8
		{ icon: 'timer', label: 'Chấm công', path: '/attendance' },                                           // 9
		{ icon: 'workspace_premium', label: 'Dịch vụ', path: '/services' },                                          // 10
		{ icon: 'admin_panel_settings', label: 'Quản trị', path: '/admin', permissionKey: 'admin' },          // 11
		{ icon: 'settings', label: 'Cài đặt', path: '/settings' },                                            // 12
		{ icon: 'smart_toy', label: 'Trợ lý AI', path: '/sale-bot' },                                         // 13 (NEW)
		{ icon: 'security', label: 'Nexus Control', path: '/nexus-control', permissionKey: 'nexus_control' }, // 14
		{ icon: 'person', label: 'Hồ sơ', path: '/profile' },                                              // 15
	];

	// Xử lý Dynamic Menu cho Mobile - Giờ đây đã được ổn định hóa và kiểm tra quyền
	const getMobileItems = () => {
		const home = allItems[0];
		const orders = allItems[1];

		const hasLocalSearch = [
			'/products', '/inventory', '/orders', '/customers', '/debts', 
			'/suppliers', '/supplier-debts', '/purchase-orders'
		].includes(location.pathname);

		const searchBtn: NavItem = { 
			icon: 'search', 
			label: 'Tìm kiếm', 
			path: hasLocalSearch ? 'event:open-mobile-search' : '/orders?search=focus' 
		};

		const aiBot = allItems.find(i => i.path === '/sale-bot') || allItems[13];
		const center = { ...getCenterItem(), isCenter: true };

		// Các vị trí 1, 2, 4, 5 (không tính center ở vị trí 3)
		const slots = [home, orders, searchBtn, aiBot];
		
		// Kiểm tra quyền cho từng slot, nếu không có quyền thì thay thế bằng fallback hợp lệ
		const validatedSlots = slots.map(item => {
			if (hasPermission(item.permissionKey)) return item;
			
			// Fallback sequence: Khách hàng -> Cài đặt -> Trang chủ
			if (hasPermission('customers_manage')) return allItems[4]; // Khách hàng
			if (hasPermission('settings')) return allItems[12]; // Cài đặt
			return allItems[0]; // Trang chủ (luôn mở)
		});

		// Trả về đúng 5 vị trí cố định (Center ở giữa) để đảm bảo giao diện không bị nhảy
		return [validatedSlots[0], validatedSlots[1], center, validatedSlots[2], validatedSlots[3]];
	};

	const mobileItems = getMobileItems();
	const sidebarItems = allItems.filter(item => !item.isCenter && hasPermission(item.permissionKey));

	return {
		navItems: mobileItems,
		sidebarItems,
		currentPath: location.pathname
	};
};
