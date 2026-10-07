import { describe, it, expect } from 'vitest';
import { getLocalDateString, getTodayString, formatDateVN } from '../dateUtils';

describe('dateUtils', () => {
	it('getLocalDateString trả về đúng YYYY-MM-DD theo local time', () => {
		const testDate = new Date(2026, 8, 28, 6, 30, 0); // 28/09/2026 lúc 06:30 sáng
		expect(getLocalDateString(testDate)).toBe('2026-09-28');
	});

	it('getTodayString trả về chuỗi 10 ký tự dạng YYYY-MM-DD', () => {
		const today = getTodayString();
		expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('formatDateVN format đúng chuỗi YYYY-MM-DD sang DD/MM/YYYY', () => {
		expect(formatDateVN('2026-09-28')).toBe('28/09/2026');
		expect(formatDateVN('2026-08-11')).toBe('11/08/2026');
	});

	it('formatDateVN xử lý Firestore timestamp', () => {
		const fakeTimestamp = { seconds: 1780000000 };
		const result = formatDateVN(fakeTimestamp);
		expect(result).not.toBe('---');
	});

	it('formatDateVN fallback về --- khi input null/undefined', () => {
		expect(formatDateVN(null)).toBe('---');
		expect(formatDateVN('')).toBe('---');
	});
});
