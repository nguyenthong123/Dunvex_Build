import { describe, it, expect, beforeEach } from 'vitest';
import { RAMStore } from '../ramStore';

describe('RAMStore (In-Memory Mac Engine)', () => {
  let store: RAMStore;

  beforeEach(() => {
    store = new RAMStore();
  });

  it('should store and retrieve documents correctly', () => {
    store.setDocument('products', 'p1', { name: 'Xi măng Hà Tiên', base_price: 90000 });
    const doc = store.getDocument('products', 'p1');
    expect(doc).toBeDefined();
    expect(doc?.name).toBe('Xi măng Hà Tiên');
    expect(doc?.base_price).toBe(90000);
  });

  it('should perform instant Vietnamese fuzzy search', () => {
    store.loadDocuments('customers', [
      { id: 'c1', name: 'Nguyễn Văn Thông', phone: '0901234567', customer_code: 'KH-1001' },
      { id: 'c2', name: 'Trần Thị Mai', phone: '0912345678', customer_code: 'KH-1002' },
      { id: 'c3', name: 'Lê Hoàng Nam', phone: '0987654321', customer_code: 'KH-1003' },
    ]);

    // Search without accents
    const res1 = store.query('customers', { searchKeyword: 'thong' });
    expect(res1.length).toBe(1);
    expect(res1[0].name).toBe('Nguyễn Văn Thông');

    // Search phone
    const res2 = store.query('customers', { searchKeyword: '0987' });
    expect(res2.length).toBe(1);
    expect(res2[0].name).toBe('Lê Hoàng Nam');
  });

  it('should handle filters (==, !=, >, <, in, array-contains)', () => {
    store.loadDocuments('orders', [
      { id: 'o1', order_code: 'ORD-1', total_amount: 500000, status: 'completed', tags: ['vip'] },
      { id: 'o2', order_code: 'ORD-2', total_amount: 1500000, status: 'pending', tags: ['normal'] },
      { id: 'o3', order_code: 'ORD-3', total_amount: 2500000, status: 'completed', tags: ['vip', 'urgent'] },
    ]);

    const resGreaterThan = store.query('orders', {
      filters: [{ field: 'total_amount', op: '>', value: 1000000 }],
    });
    expect(resGreaterThan.length).toBe(2);

    const resArrayContains = store.query('orders', {
      filters: [{ field: 'tags', op: 'array-contains', value: 'urgent' }],
    });
    expect(resArrayContains.length).toBe(1);
    expect(resArrayContains[0].id).toBe('o3');
  });

  it('should aggregate statistics in RAM with 0ms delay', () => {
    store.loadDocuments('orders', [
      { id: 'o1', total_amount: 500000, profit: 50000 },
      { id: 'o2', total_amount: 1500000, profit: 150000 },
      { id: 'o3', total_amount: 2000000, profit: 200000 },
    ]);

    const stats = store.getStats('orders');
    expect(stats.count).toBe(3);
    expect(stats.totalAmount).toBe(4000000);
    expect(stats.totalProfit).toBe(400000);
  });

  it('should support pagination (limit & offset) and sorting', () => {
    store.loadDocuments('products', [
      { id: 'p1', name: 'A', base_price: 300 },
      { id: 'p2', name: 'B', base_price: 100 },
      { id: 'p3', name: 'C', base_price: 200 },
    ]);

    const sortedAsc = store.query('products', { orderByField: 'base_price', orderDir: 'asc' });
    expect(sortedAsc.map(p => p.id)).toEqual(['p2', 'p3', 'p1']);

    const paged = store.query('products', {
      orderByField: 'base_price',
      orderDir: 'asc',
      limitCount: 2,
      offsetVal: 1,
    });
    expect(paged.map(p => p.id)).toEqual(['p3', 'p1']);
  });
});
