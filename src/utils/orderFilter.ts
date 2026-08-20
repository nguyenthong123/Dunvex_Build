/**
 * Order filtering & formatting utilities
 * Tách từ OrderList.tsx để test được pure logic
 */

export interface OrderFilterInput {
    id: string;
    customerName?: string;
    customerBusinessName?: string;
    customerPhone?: string;
    orderDate?: string;
    totalAmount?: number;
    totalProfit?: number;
    discountValue?: number;
    discount?: number;
    status?: string;
    createdAt?: { seconds: number } | Date | string;
    [key: string]: unknown; // cho phép extra fields từ Firebase
}

/** Export cùng định dạng với OrderList để dùng chung */
export function filterOrders(
    orders: OrderFilterInput[],
    searchTerm: string,
    fromDate: string,
    toDate: string
): OrderFilterInput[] {
    return orders.filter(order => {
        // Search: match name / business / id / phone
        let term = searchTerm.toLowerCase();
        if (term.startsWith('#')) {
            term = term.slice(1);
        }
        const matchesSearch = !term || (
            (String(order.customerName || '').toLowerCase().includes(term)) ||
            (String(order.customerBusinessName || '').toLowerCase().includes(term)) ||
            (String(order.id || '').toLowerCase().includes(term)) ||
            (String(order.customerPhone || '').includes(term))
        );

        // Date: match orderDate or createdAt
        let matchesDate = true;
        if (fromDate || toDate) {
            const start = fromDate || '0000-00-00';
            const end = toDate || '9999-99-99';
            const txDate = order.orderDate || extractDate(order.createdAt);
            matchesDate = txDate >= start && txDate <= end;
        }

        return matchesSearch && matchesDate;
    });
}

function extractDate(createdAt?: { seconds: number } | Date | string): string {
    if (!createdAt) return '';
    if (typeof createdAt === 'object' && 'seconds' in createdAt) {
        return new Date(createdAt.seconds * 1000).toISOString().split('T')[0];
    }
    if (createdAt instanceof Date) return createdAt.toISOString().split('T')[0];
    if (typeof createdAt === 'string') return createdAt.split('T')[0];
    return '';
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

/** Tiền tệ VNĐ đầy đủ (cho Telegram) */
export function formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}
