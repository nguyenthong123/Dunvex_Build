/**
 * Order filtering & formatting utilities
 * Hỗ trợ chuẩn hóa Timestamp, lọc trạng thái, tìm kiếm thông minh và sắp xếp đa tiêu chí
 */

import { smartSearchMatch, calculateSearchScore } from './searchUtils';
import { getLocalDateString, formatDateVN } from './dateUtils';

export interface OrderFilterInput {
    id: string;
    customerName?: string;
    customerBusinessName?: string;
    customerPhone?: string;
    customerAddress?: string;
    orderDate?: string;
    totalAmount?: number;
    totalProfit?: number;
    discountValue?: number;
    discount?: number;
    status?: string;
    note?: string;
    items?: any[];
    createdAt?: { seconds?: number; nanoseconds?: number; _seconds?: number; _nanoseconds?: number } | Date | string | number | null;
    [key: string]: unknown; // cho phép extra fields từ Firebase/SQLite
}

export type OrderSortOption = 'newest' | 'oldest' | 'total_desc' | 'total_asc' | 'profit_desc' | 'profit_asc';

/**
 * Trích xuất timestamp (mili-giây) từ bất kỳ định dạng nào của đơn hàng
 * Xử lý an toàn: Firestore client SDK, Firestore Admin SDK (_seconds), ISO string từ SQLite, số nguyên epoch, và fallback về orderDate
 */
export function getOrderTimestamp(order: any): number {
    if (!order) return 0;
    const c = order.createdAt;
    if (c !== undefined && c !== null) {
        if (typeof c === 'object') {
            if (typeof c.seconds === 'number') {
                return c.seconds * 1000 + (c.nanoseconds ? c.nanoseconds / 1e6 : 0);
            }
            if (typeof c._seconds === 'number') {
                return c._seconds * 1000 + (c._nanoseconds ? c._nanoseconds / 1e6 : 0);
            }
            if (typeof c.toDate === 'function') {
                const d = c.toDate();
                if (d instanceof Date && !isNaN(d.getTime())) return d.getTime();
            }
            if (c instanceof Date && !isNaN(c.getTime())) {
                return c.getTime();
            }
        }
        if (typeof c === 'string') {
            const t = new Date(c).getTime();
            if (!isNaN(t)) return t;
        }
        if (typeof c === 'number' && !isNaN(c)) {
            return c < 1e12 ? c * 1000 : c;
        }
    }
    if (order.orderDate) {
        const t = new Date(order.orderDate).getTime();
        if (!isNaN(t)) return t;
    }
    return 0;
}

/**
 * Trích xuất timestamp (mili-giây) từ thanh toán (payment)
 */
export function getPaymentTimestamp(payment: any): number {
    if (!payment) return 0;
    if (payment.createdAt) {
        const t = getOrderTimestamp(payment);
        if (t > 0) return t;
    }
    if (payment.date) {
        const t = new Date(payment.date).getTime();
        if (!isNaN(t)) return t;
    }
    return 0;
}

/**
 * Trích xuất chuỗi YYYY-MM-DD an toàn từ đơn hàng hoặc thanh toán
 */
export function getTxDateString(item: any): string {
    if (!item) return '';
    if (item.orderDate && typeof item.orderDate === 'string') return item.orderDate.split('T')[0];
    if (item.date && typeof item.date === 'string') return item.date.split('T')[0];
    const ts = getOrderTimestamp(item);
    if (ts > 0) {
        const d = new Date(ts);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
    return '';
}

/**
 * Lấy khoảng ngày từ preset (all, this_month, 2_months, 3_months)
 */
export function getTimeRangeForPreset(preset: 'all' | 'this_month' | '2_months' | '3_months' | 'custom'): { fromDate: string; toDate: string } {
    if (preset === 'all' || preset === 'custom') {
        return { fromDate: '', toDate: '' };
    }
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    if (preset === 'this_month') {
        const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        return { fromDate: startStr, toDate: todayStr };
    }
    if (preset === '2_months') {
        const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const startStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
        return { fromDate: startStr, toDate: todayStr };
    }
    if (preset === '3_months') {
        const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const startStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
        return { fromDate: startStr, toDate: todayStr };
    }
    return { fromDate: '', toDate: '' };
}

/**
 * Lọc và sắp xếp danh sách đơn hàng
 */
export function filterOrders(
    orders: OrderFilterInput[],
    searchTerm: string = '',
    fromDate: string = '',
    toDate: string = '',
    statusFilter: string = 'all',
    sortBy: OrderSortOption = 'newest'
): OrderFilterInput[] {
    const rawTerm = searchTerm ? searchTerm.replace(/^#/, '').trim() : '';

    const filtered = orders.filter(order => {
        // 1. Lọc theo trạng thái (nếu khác 'all')
        if (statusFilter && statusFilter !== 'all') {
            const orderStatus = (order.status || '').trim();
            if (orderStatus !== statusFilter) return false;
        }

        // 2. Lọc theo từ khóa tìm kiếm
        const itemNames = Array.isArray(order.items)
            ? (order.items as any[]).map(i => i.name || '').filter(Boolean)
            : [];

        const matchesSearch = smartSearchMatch([
            order.id || '',
            order.customerName || '',
            order.customerBusinessName || '',
            order.customerPhone || '',
            order.customerAddress || '',
            order.note || '',
            order.status || '',
            ...itemNames
        ], rawTerm);

        if (!matchesSearch) return false;

        // 3. Lọc theo ngày (orderDate hoặc extract từ createdAt)
        let matchesDate = true;
        if (fromDate || toDate) {
            const start = fromDate || '0000-00-00';
            const end = toDate || '9999-99-99';
            const txDate = order.orderDate || extractDate(order.createdAt);
            matchesDate = txDate >= start && txDate <= end;
        }

        return matchesDate;
    });

    // Luôn luôn sắp xếp theo thời gian (hoặc tiêu chí sortBy đã chọn) để đảm bảo đơn mới nhất luôn ở trên đầu
    const sorted = [...filtered];
    sorted.sort((a, b) => compareOrders(a, b, sortBy));
    return sorted;
}

function compareOrders(a: OrderFilterInput, b: OrderFilterInput, sortBy: OrderSortOption): number {
    switch (sortBy) {
        case 'oldest':
            return getOrderTimestamp(a) - getOrderTimestamp(b);
        case 'total_desc':
            return (Number(b.totalAmount) || 0) - (Number(a.totalAmount) || 0);
        case 'total_asc':
            return (Number(a.totalAmount) || 0) - (Number(b.totalAmount) || 0);
        case 'profit_desc':
            return (Number(b.totalProfit) || 0) - (Number(a.totalProfit) || 0);
        case 'profit_asc':
            return (Number(a.totalProfit) || 0) - (Number(b.totalProfit) || 0);
        case 'newest':
        default:
            return getOrderTimestamp(b) - getOrderTimestamp(a);
    }
}

export function extractDate(createdAt?: any): string {
    if (!createdAt) return '';
    const ts = getOrderTimestamp({ createdAt });
    if (!ts) return '';
    return getLocalDateString(new Date(ts));
}

/** Format ngày giờ hiển thị đầy đủ */
export function formatOrderDate(createdAt: any, fallbackDate?: string): string {
    const ts = getOrderTimestamp({ createdAt, orderDate: fallbackDate });
    if (!ts) return fallbackDate || '---';
    const d = new Date(ts);
    return isNaN(d.getTime()) ? (fallbackDate || '---') : d.toLocaleString('vi-VN');
}

/** Format chỉ hiển thị ngày dd/mm/yyyy */
export function formatOrderDateOnly(createdAt: any, fallbackDate?: string): string {
    if (fallbackDate && typeof fallbackDate === 'string' && fallbackDate.length >= 10) {
        return formatDateVN(fallbackDate);
    }
    const ts = getOrderTimestamp({ createdAt, orderDate: fallbackDate });
    if (!ts) return fallbackDate ? formatDateVN(fallbackDate) : '---';
    return formatDateVN(ts);
}

/** 228.308.300 → "228tr308" */
export function formatCompactPrice(price: number): string {
    if (price >= 1_000_000_000) {
        const ty = Math.floor(price / 1_000_000_000);
        const trieu = Math.round((price % 1_000_000_000) / 1_000_000);
        return trieu === 0 ? `${ty}tỷ` : `${ty}tỷ${trieu}`;
    }
    if (price >= 1_000_000) {
        const trieu = Math.floor(price / 1_000_000);
        const nghin = Math.round((price % 1_000_000) / 1_000);
        return nghin === 0 ? `${trieu}tr` : `${trieu}tr${nghin}`;
    }
    if (price >= 1_000) return `${Math.round(price / 1_000)}k`;
    return String(price);
}

/** Tiền tệ VNĐ đầy đủ (cho Telegram/Bảng kê) */
export function formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}
