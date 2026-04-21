import { useLocation } from 'react-router-dom';
import { useOwner } from './useOwner';

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
		
		// Grant full access to Owners and Staff Admins
		// role === 'admin' is for both owner and staff who are given admin role
		if (owner.role === 'admin') return true;

		// If it's an employee (non-admin), they MUST have the explicit right
		if (owner.isEmployee) {
			return owner.accessRights?.[key] === true;
		}
		
		// For other owners, default to true if not explicitly denied
		return owner.accessRights?.[key] ?? true;
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
				icon: 'add_circle',
				label: 'Thêm SP',
				path: '/inventory?new=true',
				permissionKey: 'inventory_manage'
			};
		}

		if (path === '/customers') {
			return {
				icon: 'person_add',
				label: 'Thêm Khách',
				path: '/customers?new=true',
				permissionKey: 'customers_manage'
			};
		}

		if (path === '/debts') {
			return {
				icon: 'payments',
				label: 'Thu nợ',
				path: '/debts?payment=true',
				permissionKey: 'debts_manage'
			};
		}

		if (path === '/admin') {
			return {
				icon: 'person_add',
				label: 'Thêm NV',
				path: '/admin?tab=users&action=add',
				permissionKey: 'users_manage'
			};
		}

		if (path.startsWith('/khoa-dao-tao')) {
			if (path === '/khoa-dao-tao') {
				return {
					icon: 'settings',
					label: 'Cập nhật Video',
					path: '/khoa-dao-tao?action=update_video',
				};
			}
			return {
				icon: 'stop_circle',
				label: 'Kết thúc Lab',
				path: '/khoa-dao-tao',
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
				path: '/price-list?import=true',
			};
		}

		if (path === '/finance') {
			return {
				icon: 'add_card',
				label: 'Thu/Chi',
				path: '/finance?new=true',
				permissionKey: 'finance_view'
			};
		}

		if (path === '/coupons') {
			return {
				icon: 'confirmation_number',
				label: 'Tạo mã mới',
				path: '/coupons?action=new',
				permissionKey: 'admin'
			};
		}

		// Mặc định cho các trang khác
		return {
			icon: 'add',
			label: 'Checkin',
			path: '/checkin?new=true',
			permissionKey: 'checkin_create'
		};
	};

	// 2. Toàn bộ danh sách Menu trong hệ thống (Đã chuẩn hóa Index)
	const allItems: NavItem[] = [
		{ icon: 'home', label: 'Trang chủ', path: '/' },                                      // 0
		{ icon: 'receipt_long', label: 'Đơn hàng', path: '/orders', permissionKey: 'orders_view' }, // 1
		{ ...getCenterItem(), isCenter: true },                                              // 2
		{ icon: 'account_balance_wallet', label: 'Công nợ', path: '/debts', permissionKey: 'debts_manage' }, // 3
		{ icon: 'account_balance', label: 'Tài chính', path: '/finance', permissionKey: 'finance_view' },    // 4
		{ icon: 'group', label: 'Khách hàng', path: '/customers', permissionKey: 'customers_manage' },       // 5
		{ icon: 'inventory_2', label: 'Sản phẩm', path: '/inventory', permissionKey: 'inventory_view' },     // 6
		{ icon: 'request_quote', label: 'Báo giá', path: '/price-list' },                                     // 7
		{ icon: 'history', label: 'Hoạt động', path: '/checkin?action=history', permissionKey: 'checkin_create' }, // 8
		{ icon: 'confirmation_number', label: 'Ưu đãi', path: '/coupons' },                                    // 9
		{ icon: 'timer', label: 'Chấm công', path: '/attendance' },                                           // 10
		{ icon: 'school', label: 'Đào tạo', path: '/khoa-dao-tao' },                                          // 11
		{ icon: 'admin_panel_settings', label: 'Quản trị', path: '/admin', permissionKey: 'admin' },          // 12
		{ icon: 'settings', label: 'Cài đặt', path: '/settings' },                                            // 13
	];

	// Logic xử lý slot 5: Linh hoạt tùy trang
	const getSlot5 = () => {
		if (path === '/debts' || path === '/orders' || path === '/inventory' || path === '/') {
			return allItems[7]; // Báo giá
		}
		return allItems[8]; // Hoạt động
	};

	// Xử lý Dynamic Menu cho Mobile
	const getMobileItems = () => {
		let items: NavItem[] = [];
		const home = allItems[0];
		const orders = allItems[1];
		const center = allItems[2];
		const debts = allItems[3];
		const finance = allItems[4];
		const customers = allItems[5];
		const products = allItems[6];
		const priceList = allItems[7];
		const history = allItems[8];
		const coupons = allItems[9];
		const attendance = allItems[10];
		const training = allItems[11];
		const admin = allItems[12];
		const settings = allItems[13];

		if (path === '/orders') {
			items = [
				home,
				customers,
				center,
				products,
				{ icon: 'search', label: 'Tìm đơn', path: '/orders?search=focus' },
			];
		} else if (path === '/inventory') {
			items = [
				home,
				{ icon: 'search', label: 'Tìm kiếm', path: '/inventory?search=focus' },
				center,
				{ icon: 'inventory', label: 'Tồn kho gộp', path: '/inventory?tab=inventory' },
				{ icon: 'upload_file', label: 'Nhập Excel', path: '/inventory?import=true' },
			];
		} else if (path === '/debts') {
			items = [
				home,
				orders,
				center,
				{ icon: 'history', label: 'Lịch sử', path: '/debts?tab=history' },
				priceList,
			];
		} else if (path === '/') {
			items = [
				home,
				orders,
				center,
				coupons,
				priceList,
			];
		} else if (path === '/admin') {
			items = [
				home,
				{ icon: 'timer', label: 'Chấm công', path: '/admin?tab=attendance' },
				center,
				{ icon: 'people', label: 'Nhân sự', path: '/admin?tab=users' },
				{ icon: 'shield', label: 'Phân quyền', path: '/admin?tab=permissions' },
			];
		} else if (path.startsWith('/khoa-dao-tao')) {
			items = [
				home,
				{ icon: 'play_circle', label: 'Video', path: '/khoa-dao-tao?tab=videos' },
				center,
				{ icon: 'sync', label: 'Vận hành', path: '/khoa-dao-tao?tab=operations' },
				{ icon: 'account_balance', label: 'Đối soát', path: '/khoa-dao-tao?tab=finance' },
			];
		} else if (path === '/attendance') {
			items = [
				home,
				orders,
				center,
				{ icon: 'coffee', label: 'Đăng ký', path: '/attendance?action=request' },
				history,
			];
		} else if (path === '/settings') {
			items = [
				home,
				{ icon: 'payments', label: 'Gói', path: '/settings?section=pricing' },
				center,
				{ icon: 'menu_book', label: 'Cẩm nang', path: '/settings?section=guide' },
				{ icon: 'logout', label: 'Đăng xuất', path: '/settings?action=logout' },
			];
		} else if (path === '/customers') {
			items = [
				home,
				{ icon: 'map', label: 'Bản đồ', path: '/customers?map=true' },
				center,
				{ icon: 'search', label: 'Tìm kiếm', path: '/customers?search=true' },
				{ icon: 'upload_file', label: 'Nhập Excel', path: '/customers?import=true' },
			];
		} else if (path === '/price-list') {
			items = [
				home,
				customers,
				center,
				products,
				orders,
			];
		} else if (path === '/finance') {
			items = [
				home,
				{ icon: 'history_toggle_off', label: 'Tuổi nợ', path: '/finance?tab=aging' },
				center,
				{ icon: 'query_stats', label: 'Lợi nhuận', path: '/finance?tab=profit' },
				{ icon: 'history', label: 'Lịch sử', path: '/finance?tab=history' },
			];
		} else if (path === '/coupons') {
			items = [
				home,
				orders,
				center,
				history,
				settings,
			];
		} else {
			items = [
				home,
				orders,
				center,
				debts,
				getSlot5(),
			];
		}

		// Filter based on permissions
		return items.filter(item => hasPermission(item.permissionKey));
	};

	const mobileItems = getMobileItems();
	const sidebarItems = allItems.filter(item => !item.isCenter && hasPermission(item.permissionKey));

	return {
		navItems: mobileItems,
		sidebarItems,
		currentPath: location.pathname
	};
};
