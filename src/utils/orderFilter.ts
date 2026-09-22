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

import { smartSearchMatch, calculateSearchScore } from './searchUtils';

export function filterOrders(
    orders: OrderFilterInput[],
    searchTerm: string,
    fromDate: string,
    toDate: string
): OrderFilterInput[] {
    const rawTerm = searchTerm ? searchTerm.replace(/^#/, '').trim() : '';

    const filtered = orders.filter(order => {
        // Collect line item product names
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

    if (rawTerm) {
        const scored = filtered.map(order => ({
            order,
            score: calculateSearchScore(order, rawTerm, { primary: ['id', 'customerName', 'customerBusinessName', 'customerPhone'] })
        }));
        scored.sort((a, b) => b.score - a.score);
        return scored.map(s => s.order);
    }

    return filtered;
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
