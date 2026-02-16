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
		if (owner.role === 'admin') return true;
		return owner.accessRights?.[key] ?? true; // Default to true if not explicitly set
	};

	// 1. Cấu hình nút cộng ở giữa thay đổi theo trang
	const getCenterItem = (): NavItem => {
		const path = location.pathname;

		if (path === '/orders') {
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

		if (path === '/debts' || path === '/') {
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

		// Mặc định cho các trang khác (checkin...)
		return {
			icon: 'add',
			label: 'Checkin ngay',
			path: '/checkin?new=true',
			permissionKey: 'checkin_create'
		};

	};

	// 2. Toàn bộ danh sách Menu trong hệ thống
	const allItems: NavItem[] = [
		{ icon: 'home', label: 'Trang chủ', path: '/' },
		{ icon: 'receipt_long', label: 'Đơn hàng', path: '/orders', permissionKey: 'orders_view' },
		{ ...getCenterItem(), isCenter: true },
		{ icon: 'account_balance_wallet', label: 'Công nợ', path: '/debts', permissionKey: 'debts_manage' },
		{ icon: 'history', label: 'Hoạt động', path: '/checkin?action=history', permissionKey: 'checkin_create' },
		{ icon: 'group', label: 'Khách hàng', path: '/customers', desktopOnly: true, permissionKey: 'customers_manage' },
		{ icon: 'inventory_2', label: 'Sản phẩm', path: '/inventory', desktopOnly: true, permissionKey: 'inventory_view' },
		{ icon: 'request_quote', label: 'Báo giá', path: '/price-list' },
		{ icon: 'timer', label: 'Chấm công', path: '/attendance' },
		{ icon: 'school', label: 'Đào tạo', path: '/khoa-dao-tao' },
		{ icon: 'settings', label: 'Cài đặt', path: '/settings' },
	];

	// Logic xử lý slot 5: "Hoạt động" hay "Cài đặt"
	const getSlot5 = () => {
		if (path === '/debts' || path === '/orders' || path === '/inventory' || path === '/') {
			return allItems[7]; // Cài đặt
		}
		return allItems[4]; // Hoạt động
	};

	// Xử lý Dynamic Menu cho Mobile
	const getMobileItems = () => {
		let items: NavItem[] = [];
		if (path === '/orders') {
			items = [
				allItems[0], // Trang chủ
				allItems[5], // Khách hàng (Thay cho Đơn hàng)
				allItems[2], // Center (Lên đơn)
				allItems[6], // Sản phẩm (Thay cho Công nợ)
				{ icon: 'search', label: 'Tìm đơn', path: '/orders?search=focus' }, // Thay Báo giá bằng Tìm đơn hàng
			];
		} else if (path === '/inventory') {
			items = [
				allItems[0], // Trang chủ
				{ icon: 'search', label: 'Tìm kiếm', path: '/inventory?search=focus' }, // Thay Sản phẩm bằng Tìm kiếm
				allItems[2], // Center (Thêm SP)
				{ icon: 'history', label: 'Lịch sử kho', path: '/inventory?tab=logs' }, // Thay Khách hàng bằng Lịch sử kho
				{ icon: 'upload_file', label: 'Nhập Excel', path: '/inventory?import=true' }, // Thay Báo giá bằng Nhập Excel
			];
		} else if (path === '/debts') {
			items = [
				allItems[0], // Trang chủ
				allItems[1], // Đơn hàng
				allItems[2], // Center (Thu nợ)
				allItems[5], // Khách hàng (Thay cho Công nợ)
				getSlot5(),  // Cài đặt
			];
		} else if (path === '/') {
			items = [
				allItems[0], // Trang chủ
				allItems[1], // Đơn hàng
				allItems[2], // Center (Thu nợ)
				allItems[4], // Hoạt động/Checkin (Thay cho Công nợ)
				getSlot5(),  // Cài đặt
			];
		} else if (path === '/admin') {
			items = [
				allItems[0], // Trang chủ
				{ icon: 'timer', label: 'Chấm công', path: '/admin?tab=attendance' },
				allItems[2], // Center (Thêm NV)
				{ icon: 'people', label: 'Nhân sự', path: '/admin?tab=users' },
				{ icon: 'shield', label: 'Phân quyền', path: '/admin?tab=permissions' },
			];
		} else if (path.startsWith('/khoa-dao-tao')) {
			items = [
				allItems[0], // Trang chủ
				{ icon: 'inventory_2', label: 'Tồn kho chuyên sâu', path: '/khoa-dao-tao?tab=inventory' },
				allItems[2], // Center (Kết thúc Lab)
				{ icon: 'sync', label: 'Vận hành & đồng bộ', path: '/khoa-dao-tao?tab=operations' },
				{ icon: 'account_balance', label: 'Đối soát & tài chính', path: '/khoa-dao-tao?tab=finance' },
			];
		} else if (path === '/attendance') {
			items = [
				allItems[0], // Trang chủ
				allItems[1], // Đơn hàng
				allItems[2], // Center (Chấm công vào)
				{ icon: 'coffee', label: 'Đăng ký nghỉ/muộn', path: '/attendance?action=request' },
				allItems[4], // Hoạt động
			];
		} else if (path === '/settings') {
			items = [
				allItems[0], // Trang chủ
				{ icon: 'payments', label: 'Gói & Chi phí', path: '/settings?section=pricing' },
				allItems[2], // Center (Chế độ tối)
				{ icon: 'menu_book', label: 'Cẩm nang', path: '/settings?section=guide' },
				{ icon: 'logout', label: 'Đăng xuất', path: '/settings?action=logout' },
			];
		} else if (path === '/customers') {
			items = [
				allItems[0], // Trang chủ
				{ icon: 'map', label: 'Bản đồ', path: '/customers?map=true' }, // Thay Đơn hàng bằng Bản đồ
				allItems[2], // Center (Thêm Khách)
				{ icon: 'search', label: 'Tìm kiếm', path: '/customers?search=true' }, // Giữ Tìm kiếm
				{ icon: 'upload_file', label: 'Nhập Excel', path: '/customers?import=true' }, // Thay Hoạt động bằng Nhập Excel
			];
		} else if (path === '/price-list') {
			items = [
				allItems[0], // Trang chủ
				allItems[5], // Khách hàng
				allItems[2], // Center (Cập nhật Data)
				allItems[6], // Sản phẩm
				allItems[1], // Đơn hàng
			];
		} else {
			items = [
				allItems[0], // Trang chủ
				allItems[1], // Đơn hàng
				allItems[2], // Center
				allItems[3], // Công nợ
				getSlot5(),  // Slot động
			];
		}

		// Filter based on permissions
		return items.filter(item => hasPermission(item.permissionKey));
	};

	const mobileItems = getMobileItems();

	// Filter cho Sidebar (Hiện tất cả trừ nút Center và filter theo quyền)
	const sidebarItems = allItems.filter(item => !item.isCenter && hasPermission(item.permissionKey));

	return {
		navItems: mobileItems, // Mặc định cho MobileNav/BottomNav
		sidebarItems,
		currentPath: location.pathname
	};
};
