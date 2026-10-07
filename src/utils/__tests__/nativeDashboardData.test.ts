import { describe, expect, it } from 'vitest';
import {
  getNativeMonthlySellerStats,
  needsNativeOrderLineItems,
  normalizeNativeDashboardOrder,
  normalizeNativeDashboardProduct,
} from '../nativeDashboardData';

describe('native dashboard data normalization', () => {
  it('normalizes SQLite/API snake_case order fields and related line items', () => {
    const order = normalizeNativeDashboardOrder({
      id: 'order-1',
      status: 'Đơn chốt',
      created_at: '2026-10-03T08:30:00.000Z',
      total_amount: '125000',
      customer_id: 'customer-1',
      customer_name: 'Khách A',
      discount_amt: '5000',
    }, [{
      order_id: 'order-1',
      product_id: 'product-1',
      unit_price: '25000',
      quantity: '5',
      buy_price: '18000',
    }]);

    expect(order).toMatchObject({
      createdAt: '2026-10-03T08:30:00.000Z',
      totalAmount: 125000,
      customerId: 'customer-1',
      customerName: 'Khách A',
      discountValue: 5000,
      items: [{
        productId: 'product-1',
        price: 25000,
        qty: 5,
        buyPrice: 18000,
      }],
    });
  });

  it('derives the local order date from the native timestamp when no order date is stored', () => {
    const createdAt = new Date(2026, 9, 3, 0, 15).toISOString();
    const order = normalizeNativeDashboardOrder({ created_at: createdAt });
    const expectedDate = new Date(createdAt);
    const expected = [
      expectedDate.getFullYear(),
      String(expectedDate.getMonth() + 1).padStart(2, '0'),
      String(expectedDate.getDate()).padStart(2, '0'),
    ].join('-');

    expect(order.orderDate).toBe(expected);
  });

  it('keeps embedded line items and zero profit values authoritative', () => {
    const order = normalizeNativeDashboardOrder({
      totalProfit: 0,
      items: [{ productId: 'product-1', price: 10, qty: 2 }],
    }, [{ product_id: 'ignored' }]);

    expect(order.totalProfit).toBe(0);
    expect(order.items).toHaveLength(1);
    expect(needsNativeOrderLineItems(order)).toBe(false);
  });

  it('requests line items when both stored profit and embedded items are absent', () => {
    expect(needsNativeOrderLineItems({ id: 'order-1' })).toBe(true);
    expect(needsNativeOrderLineItems({ total_profit: '100' })).toBe(false);
  });

  it('normalizes snake_case product cost and profit exclusion fields', () => {
    expect(normalizeNativeDashboardProduct({
      product_name: 'Vật tư',
      price_import: '15000',
      exclude_profit: 1,
    })).toMatchObject({
      name: 'Vật tư',
      priceImport: 15000,
      excludeProfit: true,
    });
  });

  it('aggregates current-month finalized orders for Native seller leaderboard', () => {
    const now = new Date(2026, 9, 3, 12);
    const stats = getNativeMonthlySellerStats([
      {
        status: 'Đơn chốt',
        created_at: new Date(2026, 9, 2, 10).toISOString(),
        total_amount: '2000000',
        createdByEmail: 'sale@example.com',
        createdByDisplayName: 'Nhân viên A',
      },
      {
        status: 'Đơn chốt',
        createdAt: new Date(2026, 9, 3, 9).toISOString(),
        totalAmount: 193239,
        createdByEmail: 'sale@example.com',
      },
      {
        status: 'Đơn chốt',
        createdAt: new Date(2026, 8, 30, 23).toISOString(),
        totalAmount: 999999,
        createdByEmail: 'sale@example.com',
      },
      {
        status: 'Đơn tạm',
        createdAt: new Date(2026, 9, 3, 10).toISOString(),
        totalAmount: 999999,
        createdByEmail: 'sale@example.com',
      },
    ], now);

    expect(stats).toEqual([{
      email: 'sale@example.com',
      displayName: 'Nhân viên A',
      totalRevenue: 2193239,
      orderCount: 2,
    }]);
  });
});
