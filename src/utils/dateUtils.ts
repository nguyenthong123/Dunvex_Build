/**
 * Date Utilities for Dunvex Build
 * Đảm bảo ngày tháng luôn chính xác theo Local Time (tránh lỗi lệch múi giờ UTC+7).
 */

/**
 * Trả về chuỗi ngày YYYY-MM-DD theo giờ địa phương (local time).
 * Thay thế an toàn cho `new Date().toISOString().split('T')[0]` vốn chuyển về UTC
 * (dẫn đến từ 00:00 - 06:59 sáng giờ VN bị lùi thành ngày hôm trước).
 */
export const getLocalDateString = (input?: Date | string | number | null): string => {
	if (!input) input = new Date();
	const d = input instanceof Date ? input : new Date(input);
	if (isNaN(d.getTime())) return '';
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

/**
 * Trả về chuỗi ngày hôm nay YYYY-MM-DD theo giờ địa phương
 */
export const getTodayString = (): string => {
	return getLocalDateString(new Date());
};

/**
 * Format ngày hiển thị dạng dd/mm/yyyy an toàn không bị lệch timezone
 */
export const formatDateVN = (date: any): string => {
	if (!date) return '---';
	if (date.seconds) {
		const d = new Date(date.seconds * 1000);
		return d.toLocaleDateString('vi-VN');
	}
	if (typeof date === 'string') {
		const trimmed = date.trim();
		if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
			const parts = trimmed.split('T')[0].split('-');
			if (parts.length === 3) {
				return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
			}
		}
	}
	const d = new Date(date);
	return isNaN(d.getTime()) ? '---' : d.toLocaleDateString('vi-VN');
};
