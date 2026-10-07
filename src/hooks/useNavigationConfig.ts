import { useLocation } from 'react-router-dom';
import { SUPER_ADMIN_EMAIL } from '../constants';
import { useOwner } from './useOwner';
import { auth } from '../services/firebase';
import { isNativeApp } from '../utils/platform';

export interface NavItem {
	icon: string;
	label: string;
	mobileLabel?: string;
	path: string;
	isCenter?: boolean;
	mobileOnly?: boolean;
	desktopOnly?: boolean;
	permissionKey?: string;
	badge?: string | number;
	shortcut?: string;
}

export interface NavGroup {
	id: string;
	title: string;
	icon?: string;
	items: NavItem[];
}

/**
 * Hook trung tâm quản lý cấu hình điều hướng và các nhóm nghiệp vụ Desktop / Mobile.
 */
export function useNavigationConfig() {
	const location = useLocation();
	const path = location.pathname;
	const owner = useOwner();

	const hasPermission = (key?: string) => {
		if (!key) return true;
		
		// Chủ sở hữu (Owner) hoặc Nhân viên có vai trò Admin luôn có toàn quyền (trừ nexus_control)
		if ((!owner.isEmployee || owner.role === 'admin') && key !== 'nexus_control') return true;

		if (key === 'nexus_control') {
			return auth.currentUser?.email === SUPER_ADMIN_EMAIL;
		}

		// Nếu kiểm tra quyền Truy cập Admin, cho phép nếu có bất kỳ quyền quản lý nào
		if (key === 'admin') {
			if (owner.role === 'admin' ||
				owner.accessRights?.admin === true || 
				owner.accessRights?.users_manage === true || 
				owner.accessRights?.system_manage === true) {
				return true;
			}
		}

		// Kiểm tra phân quyền dựa trên nút Bật/Tắt
		const val = owner.accessRights?.[key];
		
		if (val !== undefined) return val === true;

		const sensitiveKeys = ['admin', 'users_manage', 'system_manage'];
		if (sensitiveKeys.includes(key)) return false;

		return true;
	};

	// 1. Cấu hình nút cộng ở giữa thay đổi theo trang
	const getCenterItem = (): NavItem => {
		const currentPath = location.pathname;

		if (currentPath === '/orders' || currentPath === '/') {
			return {
				icon: 'add_shopping_cart',
				label: 'Lên đơn',
				mobileLabel: 'Lên đơn',
				path: '/quick-order',
				permissionKey: 'orders_create'
			};
		}

		if (currentPath === '/inventory') {
			return {
				icon: 'add_box',
				label: 'Phiếu Kho',
				mobileLabel: 'Tạo phiếu',
				path: 'event:open-mobile-add',
				permissionKey: 'inventory_manage'
			};
		}

		if (currentPath === '/customers') {
			return {
				icon: 'person_add',
				label: 'Thêm Khách',
				mobileLabel: 'Thêm khách',
				path: 'event:open-mobile-add',
				permissionKey: 'customers_manage'
			};
		}

		if (currentPath === '/debts') {
			return {
				icon: 'payments',
				label: 'Thu nợ',
				mobileLabel: 'Thu nợ',
				path: 'event:open-mobile-add',
				permissionKey: 'debts_manage'
			};
		}

		if (currentPath === '/admin') {
			return {
				icon: 'person_add',
				label: 'Thêm NV',
				mobileLabel: 'Thêm NV',
				path: 'event:open-mobile-add',
				permissionKey: 'users_manage'
			};
		}

		if (currentPath.startsWith('/services')) {
			return {
				icon: 'shopping_cart',
				label: 'Mua gói',
				mobileLabel: 'Mua gói',
				path: '/services?action=buy',
			};
		}

		if (currentPath === '/attendance') {
			return {
				icon: 'task_alt',
				label: 'Chấm công vào',
				mobileLabel: 'Chấm công',
				path: '/attendance?action=checkin',
				permissionKey: 'checkin_create'
			};
		}

		if (currentPath === '/leaves') {
			return {
				icon: 'add',
				label: 'Đăng ký nghỉ',
				mobileLabel: 'Nghỉ phép',
				path: 'event:open-leave-create'
			};
		}

		if (currentPath === '/settings') {
			return {
				icon: 'contrast',
				label: 'Chế độ tối',
				mobileLabel: 'Đổi nền',
				path: '/settings?action=toggleTheme',
			};
		}

		if (currentPath === '/price-list') {
			return {
				icon: 'cloud_upload',
				label: 'Cập nhật Data',
				mobileLabel: 'Nạp data',
				path: 'event:open-mobile-add',
			};
		}

		if (currentPath === '/coupons') {
			return {
				icon: 'confirmation_number',
				label: 'Tạo mã',
				mobileLabel: 'Tạo mã',
				path: 'event:open-mobile-add',
				permissionKey: 'coupons_manage'
			};
		}

		if (currentPath === '/backup') {
			return {
				icon: 'cloud_download',
				label: 'Backup ngay',
				mobileLabel: 'Sao lưu',
				path: 'event:none',
			};
		}

		// Mặc định cho các trang khác
		return {
			icon: 'add',
			label: 'Thêm SP',
			mobileLabel: 'Thêm SP',
			path: 'event:open-mobile-add',
			permissionKey: 'products_manage'
		};
	};

	// 2. Nhóm nghiệp vụ có cấu trúc rõ ràng cho Desktop (macOS & Windows)
	const rawNavGroups: NavGroup[] = [
		{
			id: 'overview',
			title: 'Tổng quan',
			items: [
				{ icon: 'dashboard', label: 'Bảng điều khiển', mobileLabel: 'Tổng quan', path: '/', shortcut: 'F1' },
			]
		},
		{
			id: 'sales',
			title: 'Bán hàng & Đơn hàng',
			items: [
				{ icon: 'point_of_sale', label: 'Lên đơn nhanh (POS)', mobileLabel: 'Lên đơn', path: '/quick-order', permissionKey: 'orders_create', shortcut: 'F2' },
				{ icon: 'receipt_long', label: 'Danh sách đơn hàng', mobileLabel: 'Đơn hàng', path: '/orders', permissionKey: 'orders_view' },
				{ icon: 'request_quote', label: 'Báo giá & Bảng giá', mobileLabel: 'Báo giá', path: '/price-list' },
				{ icon: 'confirmation_number', label: 'Mã ưu đãi & Giảm giá', mobileLabel: 'Giảm giá', path: '/coupons' },
			]
		},
		{
			id: 'inventory',
			title: 'Kho & Mua hàng',
			items: [
				{ icon: 'inventory_2', label: 'Quản lý tồn kho', mobileLabel: 'Kho hàng', path: '/inventory', permissionKey: 'inventory_view', shortcut: 'F4' },
				{ icon: 'category', label: 'Danh mục sản phẩm', mobileLabel: 'Sản phẩm', path: '/products', permissionKey: 'inventory_view' },
				{ icon: 'local_shipping', label: 'Đơn nhập hàng (PO)', mobileLabel: 'Nhập hàng', path: '/purchase-orders', permissionKey: 'admin' },
				{ icon: 'storefront', label: 'Nhà cung cấp', mobileLabel: 'Nhà CC', path: '/suppliers', permissionKey: 'admin' },
			]
		},
		{
			id: 'customers_debts',
			title: 'Khách hàng & Công nợ',
			items: [
				{ icon: 'group', label: 'Sổ khách hàng', mobileLabel: 'Khách hàng', path: '/customers', permissionKey: 'customers_manage' },
				{ icon: 'account_balance_wallet', label: 'Sổ nợ khách hàng', mobileLabel: 'Công nợ', path: '/debts', permissionKey: 'debts_manage', shortcut: 'F3' },
				{ icon: 'account_balance', label: 'Công nợ Nhà cung cấp', mobileLabel: 'Nợ NCC', path: '/supplier-debts', permissionKey: 'admin' },
				{ icon: 'route', label: 'Giao hàng & Check-in', mobileLabel: 'Giao hàng', path: '/checkin', permissionKey: 'checkin_create' },
			]
		},
		{
			id: 'hr',
			title: 'Nhân sự & Chấm công',
			items: [
				{ icon: 'timer', label: 'Chấm công GPS', mobileLabel: 'Chấm công', path: '/attendance' },
				{ icon: 'event_available', label: 'Quản lý nghỉ phép', mobileLabel: 'Nghỉ phép', path: '/leaves' },
			]
		},
		{
			id: 'system',
			title: 'Quản trị & Cấu hình',
			items: [
				{ icon: 'admin_panel_settings', label: 'Quản trị & Phân quyền', mobileLabel: 'Quản trị', path: '/admin', permissionKey: 'admin' },
				{ icon: 'settings', label: 'Cài đặt hệ thống', mobileLabel: 'Cài đặt', path: '/settings' },
				{ icon: 'download_for_offline', label: 'Tải app cho máy khác', mobileLabel: 'Tải App', path: '/download' },
				{ icon: 'delete', label: 'Thùng rác phục hồi', mobileLabel: 'Thùng rác', path: '/trash' },
				{ icon: 'workspace_premium', label: 'Gói dịch vụ & Bản quyền', mobileLabel: 'Gói cước', path: '/services' },
				{ icon: 'security', label: 'Nexus Control', mobileLabel: 'Nexus', path: '/nexus-control', permissionKey: 'nexus_control' },
				{ icon: 'cloud_download', label: 'Sao lưu & Phục hồi', mobileLabel: 'Sao lưu', path: '/backup', permissionKey: 'nexus_control' },
			]
		}
	];

	// Lọc nhóm theo quyền và nền tảng (chỉ hiện Tải app trên Web)
	const isNative = isNativeApp();
	const navGroups = rawNavGroups
		.map(group => ({
			...group,
			items: group.items
				.filter(item => !(isNative && (item.path === '/download' || item.path === '/downloads' || item.path === '/tai-ung-dung')))
				.filter(item => hasPermission(item.permissionKey))
		}))
		.filter(group => group.items.length > 0);

	// Toàn bộ danh sách phẳng (cho Mobile và các màn hình khác)
	const allItems: NavItem[] = [
		...navGroups.flatMap(g => g.items),
		{ icon: 'person', label: 'Hồ sơ', mobileLabel: 'Tài khoản', path: '/profile' },
	];

	// Xử lý Dynamic Menu cho Mobile
	const getMobileItems = () => {
		const home = allItems.find(i => i.path === '/') || allItems[0];
		const orders = allItems.find(i => i.path === '/orders') || allItems[1];

		const hasLocalSearch = [
			'/products', '/inventory', '/orders', '/customers', '/debts', 
			'/suppliers', '/supplier-debts', '/purchase-orders'
		].includes(location.pathname);

		const searchBtn: NavItem = { 
			icon: 'search', 
			label: 'Tìm kiếm', 
			mobileLabel: 'Tìm kiếm',
			path: hasLocalSearch ? 'event:open-mobile-search' : '/orders?search=focus' 
		};

		const profileBtn = allItems.find(i => i.path === '/profile') || allItems[allItems.length - 1];
		const center = { ...getCenterItem(), isCenter: true };

		const slots = [home, orders, searchBtn, profileBtn];
		
		const validatedSlots = slots.map(item => {
			if (hasPermission(item.permissionKey)) return item;
			if (hasPermission('customers_manage')) return allItems.find(i => i.path === '/customers') || allItems[0];
			if (hasPermission('settings')) return allItems.find(i => i.path === '/settings') || allItems[0];
			return allItems[0];
		});

		return [validatedSlots[0], validatedSlots[1], center, validatedSlots[2], validatedSlots[3]];
	};

	const mobileItems = getMobileItems();
	const sidebarItems = allItems.filter(item => !item.isCenter && hasPermission(item.permissionKey));

	return {
		navItems: mobileItems,
		sidebarItems,
		navGroups,
		currentPath: location.pathname
	};
}
