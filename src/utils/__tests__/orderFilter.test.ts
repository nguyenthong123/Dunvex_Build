import { describe, it, expect } from 'vitest';
import {
    filterOrders,
    formatCompactPrice,
    formatPrice,
    formatOrderDate,
    formatOrderDateOnly,
    getOrderTimestamp,
    getPaymentTimestamp,
    getTxDateString,
    getTimeRangeForPreset,
    type OrderFilterInput
} from '../orderFilter';

const sampleOrders: OrderFilterInput[] = [
    { id: 'ORD-001', customerName: 'Nguyễn Văn A', customerPhone: '0909123456', orderDate: '2026-08-10', totalAmount: 100000, totalProfit: 20000, status: 'Mới' },
    { id: 'ORD-002', customerName: 'Công Ty TNHH ABC', customerBusinessName: 'ABC Corp', orderDate: '2026-08-11', totalAmount: 500000, totalProfit: 150000, status: 'Đơn chốt' },
    { id: 'ORD-003', customerName: 'Trần Thị B', customerPhone: '0918222333', orderDate: '2026-08-09', totalAmount: 300000, totalProfit: 50000, status: 'Đang xử lý' },
    { id: 'ORD-004', customerName: 'LÊ VĂN C', orderDate: '2026-08-11', totalAmount: 1200000, totalProfit: 400000, status: 'Đơn chốt' },
    { id: 'ORD-005', customerName: 'Nguyễn Văn An', orderDate: '2026-08-12', totalAmount: 250000, totalProfit: 60000, status: 'Đã hủy' },
];

describe('getOrderTimestamp', () => {
    it('nhận diện đúng định dạng seconds (Firestore Client SDK)', () => {
        const order = { createdAt: { seconds: 1783762596, nanoseconds: 381000000 } };
        expect(getOrderTimestamp(order)).toBe(1783762596381);
    });

    it('nhận diện đúng định dạng _seconds (Firestore Admin SDK / Backup JSON)', () => {
        const order = { createdAt: { _seconds: 1783762596, _nanoseconds: 381000000 } };
        expect(getOrderTimestamp(order)).toBe(1783762596381);
    });

    it('nhận diện đúng chuỗi ISO (SQLite VPS)', () => {
        const iso = '2026-08-10T08:30:00.000Z';
        const order = { createdAt: iso };
        expect(getOrderTimestamp(order)).toBe(new Date(iso).getTime());
    });

    it('fallback về orderDate khi không có createdAt', () => {
        const order = { orderDate: '2026-08-11' };
        expect(getOrderTimestamp(order)).toBe(new Date('2026-08-11').getTime());
    });

    it('trả về 0 khi đối tượng null/rỗng', () => {
        expect(getOrderTimestamp(null)).toBe(0);
        expect(getOrderTimestamp({})).toBe(0);
    });
});

describe('getPaymentTimestamp & getTxDateString', () => {
    it('nhận diện timestamp từ payment date và createdAt', () => {
        const p1 = { date: '2026-09-20' };
        expect(getPaymentTimestamp(p1)).toBe(new Date('2026-09-20').getTime());

        const p2 = { createdAt: { seconds: 1783762596 } };
        expect(getPaymentTimestamp(p2)).toBe(1783762596000);
    });

    it('trích xuất đúng định dạng YYYY-MM-DD từ nhiều định dạng khác nhau', () => {
        expect(getTxDateString({ orderDate: '2026-09-25' })).toBe('2026-09-25');
        expect(getTxDateString({ date: '2026-08-15' })).toBe('2026-08-15');
        expect(getTxDateString({ createdAt: '2026-07-10T10:00:00.000Z' })).toBe('2026-07-10');
    });

    it('tính đúng khoảng ngày cho preset', () => {
        const allRange = getTimeRangeForPreset('all');
        expect(allRange.fromDate).toBe('');
        expect(allRange.toDate).toBe('');

        const thisMonth = getTimeRangeForPreset('this_month');
        expect(thisMonth.fromDate).toMatch(/^\d{4}-\d{2}-01$/);
        expect(thisMonth.toDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

describe('filterOrders', () => {
    describe('search', () => {
        it('trả về tất cả khi search rỗng', () => {
            expect(filterOrders(sampleOrders, '', '', '')).toHaveLength(5);
        });

        it('khớp tên khách hàng và luôn sắp xếp theo ngày mới nhất', () => {
            const result = filterOrders(sampleOrders, 'Nguyễn Văn A', '', '');
            expect(result).toHaveLength(2); // Nguyễn Văn A (10/8) + Nguyễn Văn An (12/8)
            expect(result[0].id).toBe('ORD-005'); // 12/8 (mới hơn) phải ở trước
            expect(result[1].id).toBe('ORD-001'); // 10/8 (cũ hơn) phải ở sau
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

    describe('status filter', () => {
        it('lọc theo trạng thái Đơn chốt', () => {
            const result = filterOrders(sampleOrders, '', '', '', 'Đơn chốt');
            expect(result).toHaveLength(2);
            expect(result.map(o => o.id)).toContain('ORD-002');
            expect(result.map(o => o.id)).toContain('ORD-004');
        });

        it('lọc theo trạng thái Mới', () => {
            const result = filterOrders(sampleOrders, '', '', '', 'Mới');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('ORD-001');
        });

        it('statusFilter = "all" trả về tất cả', () => {
            const result = filterOrders(sampleOrders, '', '', '', 'all');
            expect(result).toHaveLength(5);
        });
    });

    describe('sorting options', () => {
        it('sắp xếp theo mới nhất (mặc định)', () => {
            const result = filterOrders(sampleOrders, '', '', '', 'all', 'newest');
            expect(result[0].id).toBe('ORD-005'); // 2026-08-12
            expect(result[result.length - 1].id).toBe('ORD-003'); // 2026-08-09
        });

        it('sắp xếp theo cũ nhất', () => {
            const result = filterOrders(sampleOrders, '', '', '', 'all', 'oldest');
            expect(result[0].id).toBe('ORD-003'); // 2026-08-09
            expect(result[result.length - 1].id).toBe('ORD-005'); // 2026-08-12
        });

        it('sắp xếp theo tổng tiền giảm dần', () => {
            const result = filterOrders(sampleOrders, '', '', '', 'all', 'total_desc');
            expect(result[0].id).toBe('ORD-004'); // 1.200.000
            expect(result[result.length - 1].id).toBe('ORD-001'); // 100.000
        });

        it('sắp xếp theo lợi nhuận giảm dần', () => {
            const result = filterOrders(sampleOrders, '', '', '', 'all', 'profit_desc');
            expect(result[0].id).toBe('ORD-004'); // 400.000
            expect(result[result.length - 1].id).toBe('ORD-001'); // 20.000
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

describe('formatOrderDate & formatOrderDateOnly', () => {
    it('format ngày đơn hàng an toàn', () => {
        const res = formatOrderDateOnly(null, '2026-08-11');
        expect(res).toBe('11/08/2026');
    });
});
