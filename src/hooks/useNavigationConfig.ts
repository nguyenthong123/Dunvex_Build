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
		
		// Chủ sở hữu (Owner) luôn có toàn quyền
		if (!owner.isEmployee) return true;

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
		const sensitiveKeys = ['admin', 'users_manage', 'finance_view', 'system_manage'];
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

	// 2. Toàn bộ danh sách Menu trong hệ thống
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

	// Xử lý Dynamic Menu cho Mobile
	const getMobileItems = () => {
		const currentPath = location.pathname;
		
		const home = allItems[0];
		const orders = allItems[1];
		const center = allItems[2];
		const finance = allItems[4];
		const customers = allItems[5];
		const products = allItems[6];
		const priceList = allItems[7];
		const history = allItems[8];
		const coupons = allItems[9];

		let items: NavItem[] = [];

		if (currentPath === '/' || currentPath === '/admin' || currentPath === '/settings') {
			// Chiến lược cho Trang chủ: Chọn tối đa 4 mục quan trọng nhất dựa trên quyền
			const candidates = [
				home,
				orders,
				center,
				customers,
				products,
				coupons,
				priceList
			];

			// Lọc theo quyền
			const permitted = candidates.filter(item => !item.permissionKey || hasPermission(item.permissionKey));
			
			// Lấy 4 mục đầu tiên (Giao diện cũ dùng 4 nút để đẹp hơn trên mobile)
			items = permitted.slice(0, 4);

			// Đảm bảo nút Center luôn nằm ở vị trí số 3 (index 2) nếu có
			if (!items.find(i => i.isCenter) && permitted.find(i => i.isCenter)) {
				items[2] = permitted.find(i => i.isCenter)!;
			}
		} else if (currentPath === '/orders') {
			items = [
				home,
				{ icon: 'pending_actions', label: 'Đang xử lý', path: '/orders?status=pending' },
				center,
				{ icon: 'check_circle', label: 'Đã chốt', path: '/orders?status=closed' },
			];
		} else if (currentPath === '/finance') {
			items = [
				home,
				{ icon: 'history_toggle_off', label: 'Tuổi nợ', path: '/finance?tab=aging' },
				center,
				{ icon: 'history', label: 'Lịch sử', path: '/finance?tab=history' },
			];
		} else if (currentPath === '/customers') {
			items = [
				home,
				{ icon: 'person_add', label: 'Thêm mới', path: '/customers?new=true' },
				center,
				{ icon: 'map', label: 'Bản đồ', path: '/customers?view=map' },
			];
		} else if (currentPath === '/inventory') {
			items = [
				home,
				{ icon: 'search', label: 'Tìm kiếm', path: '/inventory?search=focus' },
				center,
				{ icon: 'inventory', label: 'Tồn kho gộp', path: '/inventory?tab=inventory' },
			];
		} else {
			// Mặc định: Lấy 4 mục đầu tiên từ candidates
			const candidates = [home, orders, center, customers, products];
			items = candidates.filter(item => !item.permissionKey || hasPermission(item.permissionKey)).slice(0, 4);
		}

		return items;
	};

	const mobileItems = getMobileItems();
	const sidebarItems = allItems.filter(item => !item.isCenter && hasPermission(item.permissionKey));

	return {
		navItems: mobileItems,
		sidebarItems,
		currentPath: location.pathname
	};
};
