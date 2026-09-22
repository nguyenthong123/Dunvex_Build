import { describe, it, expect } from 'vitest';
import { groupOrderItems, formatPrice } from '../ticketUtils';

describe('ticketUtils', () => {
	it('preserves separate line items with same product without merging quantities', () => {
		const items = [
			{ id: 'p1', productId: 'p1', name: 'Thanh chính Gypline', qty: 68, price: 24630, unit: 'cây' },
			{ id: 'p1', productId: 'p1', name: 'Thanh chính Gypline', qty: 116, price: 24630, unit: 'cây' }
		];
		const result = groupOrderItems(items);
		expect(result).toHaveLength(2);
		expect(result[0].qty).toBe(68);
		expect(result[1].qty).toBe(116);
	});

	it('handles null/undefined/empty array safely', () => {
		expect(groupOrderItems(null as any)).toEqual([]);
		expect(groupOrderItems(undefined as any)).toEqual([]);
		expect(groupOrderItems([])).toEqual([]);
	});

	it('formats price correctly in Vietnamese format', () => {
		expect(formatPrice(184000)).toBe('184.000');
		expect(formatPrice(0)).toBe('0');
	});
});
