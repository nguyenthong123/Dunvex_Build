import { describe, it, expect } from 'vitest';
import { filterOrders, formatCompactPrice, formatPrice, type OrderFilterInput } from '../orderFilter';

const sampleOrders: OrderFilterInput[] = [
    { id: 'ORD-001', customerName: 'Nguyễn Văn A', customerPhone: '0909123456', orderDate: '2026-08-10' },
    { id: 'ORD-002', customerName: 'Công Ty TNHH ABC', customerBusinessName: 'ABC Corp', orderDate: '2026-08-11' },
    { id: 'ORD-003', customerName: 'Trần Thị B', customerPhone: '0918222333', orderDate: '2026-08-09' },
    { id: 'ORD-004', customerName: 'LÊ VĂN C', orderDate: '2026-08-11' },
    { id: 'ORD-005', customerName: 'Nguyễn Văn An', orderDate: '2026-08-12' },
];

describe('filterOrders', () => {
    describe('search', () => {
        it('trả về tất cả khi search rỗng', () => {
            expect(filterOrders(sampleOrders, '', '', '')).toHaveLength(5);
        });

        it('khớp tên khách hàng', () => {
            const result = filterOrders(sampleOrders, 'Nguyễn Văn A', '', '');
            expect(result).toHaveLength(2); // Nguyễn Văn A + Nguyễn Văn An
            expect(result.map(o => o.id)).toContain('ORD-001');
        });

        it('khớp không phân biệt hoa thường', () => {
            const result = filterOrders(sampleOrders, 'lê văn', '', '');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('ORD-004');
        });

        it('khớp tên doanh nghiệp', () => {
            const result = filterOrders(sampleOrders, 'ABC Corp', '', '');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('ORD-002');
        });

        it('khớp mã đơn hàng', () => {
            const result = filterOrders(sampleOrders, 'ORD-003', '', '');
            expect(result).toHaveLength(1);
        });

        it('khớp số điện thoại', () => {
            const result = filterOrders(sampleOrders, '0909', '', '');
            expect(result).toHaveLength(1);
            expect(result[0].customerName).toBe('Nguyễn Văn A');
        });

        it('trả rỗng nếu không khớp', () => {
            const result = filterOrders(sampleOrders, 'NOT_EXIST', '', '');
            expect(result).toHaveLength(0);
        });
    });

    describe('date filter', () => {
        it('lọc theo fromDate', () => {
            const result = filterOrders(sampleOrders, '', '2026-08-11', '');
            expect(result).toHaveLength(3); // 11/8 + 12/8
        });

        it('lọc theo toDate', () => {
            const result = filterOrders(sampleOrders, '', '', '2026-08-10');
            expect(result).toHaveLength(2); // 9/8 + 10/8
        });

        it('lọc khoảng từ-đến', () => {
            const result = filterOrders(sampleOrders, '', '2026-08-10', '2026-08-11');
            expect(result).toHaveLength(3);
        });

        it('kết hợp search + date', () => {
            const result = filterOrders(sampleOrders, 'Văn', '2026-08-10', '2026-08-11');
            expect(result).toHaveLength(2); // ORD-001 (Văn A, 10/8) + ORD-004 (VĂN C, 11/8)
            expect(result.map(o => o.id).sort()).toEqual(['ORD-001', 'ORD-004']);
        });
    });

    describe('createdAt timestamp', () => {
        it('dùng createdAt.seconds nếu không có orderDate', () => {
            const orders: OrderFilterInput[] = [
                { id: 'TS-001', createdAt: { seconds: Math.floor(new Date('2026-08-11').getTime() / 1000) } },
                { id: 'TS-002', createdAt: { seconds: Math.floor(new Date('2026-08-09').getTime() / 1000) } },
            ];
            const result = filterOrders(orders, '', '2026-08-11', '');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('TS-001');
        });

        it('orderDate ưu tiên hơn createdAt', () => {
            const orders: OrderFilterInput[] = [
                { id: 'PRI-001', orderDate: '2026-08-11', createdAt: { seconds: Math.floor(new Date('2026-01-01').getTime() / 1000) } },
            ];
            const result = filterOrders(orders, '', '2026-08-11', '2026-08-11');
            expect(result).toHaveLength(1); // dùng orderDate
        });
    });
});

describe('formatCompactPrice', () => {
    it('tỷ + triệu', () => {
        expect(formatCompactPrice(1_500_000_000)).toBe('1tỷ500');
    });

    it('tỷ chẵn (không hiện 0)', () => {
        expect(formatCompactPrice(2_000_000_000)).toBe('2tỷ');
    });

    it('triệu + nghìn', () => {
        expect(formatCompactPrice(228_308_300)).toBe('228tr308');
    });

    it('triệu chẵn', () => {
        expect(formatCompactPrice(5_000_000)).toBe('5tr');
    });

    it('nghìn', () => {
        expect(formatCompactPrice(500_000)).toBe('500k');
    });

    it('dưới 1000 trả về số thô', () => {
        expect(formatCompactPrice(500)).toBe('500');
    });

    it('số 0', () => {
        expect(formatCompactPrice(0)).toBe('0');
    });
});

describe('formatPrice', () => {
    it('định dạng VNĐ', () => {
        const result = formatPrice(228000);
        expect(result).toContain('228');
        expect(result).toContain('000');
    });
});
