/**
 * Shared document type interfaces cho Dunvex Build
 * Dùng trong fakeFirestore và các hooks để tăng type safety
 */

export interface OrderDoc {
    id: string;
    ownerId: string;
    customerId?: string;
    customerName?: string;
    customerBusinessName?: string;
    status: string;
    totalAmount: number;
    orderDate?: string;
    createdAt?: string;
    createdBy?: string;
    staffName?: string;
    items?: OrderItem[];
    discount?: number;
    notes?: string;
}

export interface OrderItem {
    productId: string;
    name: string;
    qty: number;
    price: number;
    unit?: string;
    total?: number;
}

export interface CustomerDoc {
    id: string;
    ownerId: string;
    name: string;
    businessName?: string;
    phone?: string;
    debt?: number;
    totalDebt?: number;
    debtDays?: number;
    type?: string;
    address?: string;
    createdAt?: string;
}

export interface ProductDoc {
    id: string;
    ownerId: string;
    name: string;
    category?: string;
    priceSell?: number;
    priceImport?: number;
    stock?: number;
    unit?: string;
    specification?: string;
    status?: string;
    sku?: string;
    excludeProfit?: boolean;
}

export interface PaymentDoc {
    id: string;
    ownerId: string;
    customerId?: string;
    customerName?: string;
    amount: number;
    paymentMethod?: string;
    createdAt?: string;
    paymentDate?: string;
    type?: string;
}
