import { getOptimizedImageUrl } from '../../utils/validation';
import { formatDateVN } from '../../utils/dateUtils';

/** Resolve an image URL to its optimized variant (empty string if unavailable). */
export const getTicketImageUrl = (url: string): string => {
	const optimized = getOptimizedImageUrl(url);
	if (!optimized) return '';
	return optimized;
};

export const formatDate = (date: any): string => {
	return formatDateVN(date);
};

export const formatPrice = (num: number): string => {
	return new Intl.NumberFormat('vi-VN').format(num || 0);
};

export const getCreatorName = (order: any, owner: any): string => {
	const isSystemOrWebhook = !order.createdByEmail ||
		order.createdByEmail === 'web@dunvex.com' ||
		order.createdByDisplayName === 'Web';

	if (isSystemOrWebhook && owner.userEmail) {
		return owner.userDisplayName || owner.userEmail.split('@')[0];
	}

	return order.createdByDisplayName || order.createdByEmail?.split('@')[0] || 'Admin';
};

export const getScaleAndWidth = (layoutMode: 'a4' | 'receipt', screenWidth: number) => {
	const targetWidth = layoutMode === 'receipt' ? 420 : 1000;
	const padding = layoutMode === 'receipt' ? 32 : 40;
	if (screenWidth < targetWidth + padding) {
		return {
			width: `${targetWidth}px`,
			scale: (screenWidth - padding) / targetWidth
		};
	}
	return {
		width: `${targetWidth}px`,
		scale: 1
	};
};

/** Tổng số kiện hàng (đã format theo vi-VN). Dùng chung cho cả 2 layout. */
export const computeTotalPackages = (order: any): string => {
	const totalPackages = order.items?.reduce((sum: number, item: any) => {
		const packaging = parseFloat(item.packaging) || 0;
		if (packaging <= 0) return sum;
		return sum + (Number(item.qty) / packaging);
	}, 0) || 0;
	return totalPackages.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
};

export const getTicketImageFilename = (layoutMode: 'a4' | 'receipt', order: any): string => {
	return `phieu_giao_hang_${layoutMode.toUpperCase()}_${order.id?.slice(0, 8).toUpperCase()}.png`;
};

export const groupOrderItems = (items: any[]) => {
	if (!items || !Array.isArray(items)) return [];
	return items;
};
