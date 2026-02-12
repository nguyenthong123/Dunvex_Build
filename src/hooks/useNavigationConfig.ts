import { useLocation } from 'react-router-dom';

export interface NavItem {
	icon: string;
	label: string;
	path: string;
	isCenter?: boolean;
	mobileOnly?: boolean;
	desktopOnly?: boolean;
}

/**
 * Hook trung tâm quản lý cấu hình điều hướng và các nút động theo ngữ cảnh.
 * Giúp mã nguồn sạch hơn và đảm bảo tính nhất quán trên toàn hệ thống.
 */
export const useNavigationConfig = () => {
	const location = useLocation();
	const path = location.pathname;

	// 1. Cấu hình nút cộng ở giữa thay đổi theo trang
	const getCenterItem = (): NavItem => {
		const path = location.pathname;

		if (path === '/orders') {
			return {
				icon: 'add_shopping_cart',
				label: 'Lên đơn',
				path: '/quick-order'
			};
		}

		if (path === '/inventory') {
			return {
				icon: 'add_circle',
				label: 'Thêm SP',
				path: '/inventory?new=true'
			};
		}

		if (path === '/customers') {
			return {
				icon: 'person_add',
				label: 'Thêm Khách',
				path: '/customers?new=true'
			};
		}

		if (path === '/debts' || path === '/') {
			return {
				icon: 'payments',
				label: 'Thu nợ',
				path: '/debts?payment=true'
			};
		}

		// Mặc định cho các trang khác (checkin...)
		return {
			icon: 'add',
			label: 'Checkin ngay',
			path: '/checkin?new=true'
		};

	};

	// 2. Toàn bộ danh sách Menu trong hệ thống
	const allItems: NavItem[] = [
		{ icon: 'home', label: 'Trang chủ', path: '/' },
		{ icon: 'receipt_long', label: 'Đơn hàng', path: '/orders' },
		{ ...getCenterItem(), isCenter: true },
		{ icon: 'account_balance_wallet', label: 'Công nợ', path: '/debts' },
		{ icon: 'history', label: 'Hoạt động', path: '/checkin?action=history' },
		{ icon: 'group', label: 'Khách hàng', path: '/customers', desktopOnly: true },
		{ icon: 'inventory_2', label: 'Sản phẩm', path: '/inventory', desktopOnly: true },
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
		if (path === '/orders') {
			return [
				allItems[0], // Trang chủ
				allItems[5], // Khách hàng (Thay cho Đơn hàng)
				allItems[2], // Center (Lên đơn)
				allItems[6], // Sản phẩm (Thay cho Công nợ)
				getSlot5(),  // Cài đặt
			];
		}

		if (path === '/inventory') {
			return [
				allItems[0], // Trang chủ
				{ icon: 'inventory', label: 'Tồn kho', path: '/inventory' }, // Thay Đơn hàng bằng Tồn kho
				allItems[2], // Center (Thêm SP)
				allItems[5], // Khách hàng (Thay cho Công nợ)
				getSlot5(),  // Cài đặt
			];
		}

		if (path === '/debts') {
			return [
				allItems[0], // Trang chủ
				allItems[1], // Đơn hàng
				allItems[2], // Center (Thu nợ)
				allItems[5], // Khách hàng (Thay cho Công nợ)
				getSlot5(),  // Cài đặt
			];
		}

		if (path === '/') {
			return [
				allItems[0], // Trang chủ
				allItems[1], // Đơn hàng
				allItems[2], // Center (Thu nợ)
				allItems[4], // Hoạt động/Checkin (Thay cho Công nợ)
				getSlot5(),  // Cài đặt
			];
		}

		// Mặc định
		return [
			allItems[0], // Trang chủ
			allItems[1], // Đơn hàng
			allItems[2], // Center
			allItems[3], // Công nợ
			getSlot5(),  // Slot động
		];
	};

	const mobileItems = getMobileItems();

	// Filter cho Sidebar (Hiện tất cả trừ nút Center)
	const sidebarItems = allItems.filter(item => !item.isCenter);

	return {
		navItems: mobileItems, // Mặc định cho MobileNav/BottomNav
		sidebarItems,
		currentPath: location.pathname
	};
};
