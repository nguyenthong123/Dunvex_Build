// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock dependencies of useOrderForm
const mockProducts = [
  { id: 'prod-1', name: 'Xi măng Hà Tiên', sku: 'XM-HT-01', price: 1000000, priceSell: 1000000, priceImport: 800000, stock: 100, approvalStatus: 'approved' },
  { id: 'prod-2', name: 'Cát xây dựng', sku: 'CAT-XD-01', price: 500000, priceSell: 500000, priceImport: 300000, stock: 50, approvalStatus: 'approved' }
];

const mockCustomers = [
  { id: 'cust-1', name: 'Nguyễn Văn A', phone: '0901234567', debt: 100000, totalDebt: 100000, creditLimit: 5000000, approvalStatus: 'approved' }
];

vi.mock('../useProducts', () => ({
  useProducts: () => ({ products: mockProducts, loading: false })
}));

vi.mock('../useCustomers', () => ({
  useCustomers: () => ({ customers: mockCustomers, loading: false })
}));

vi.mock('../../utils/telegramNotify', () => ({
  sendTelegramNotification: vi.fn(),
  notifyOrderEvent: vi.fn().mockResolvedValue(true)
}));

let mockRebates: any[] = [];
vi.mock('../../services/dataAccess', () => ({
  customerRebateService: {
    listenByOwner: vi.fn((ownerId, cb) => {
      cb(mockRebates);
      return () => {};
    })
  }
}));

// In-memory store simulating VPS SQLite / Firestore collections
const store: Record<string, Record<string, any>> = {
  orders: {},
  customers: {
    'cust-1': { id: 'cust-1', name: 'Nguyễn Văn A', phone: '0901234567', debt: 100000, totalDebt: 100000 }
  },
  products: {
    'prod-1': { id: 'prod-1', name: 'Xi măng Hà Tiên', stock: 100 },
    'prod-2': { id: 'prod-2', name: 'Cát xây dựng', stock: 50 }
  },
  debts: {},
  coupons: {},
  audit_logs: {},
  notifications: {},
  inventory_logs: {}
};

let capturedBatchWrites: any[] = [];

vi.mock('../../services/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'user-1', email: 'test@example.com', displayName: 'Tester' } },
  doc: (first: any, second?: any, third?: any) => {
    let col = '';
    let id = '';
    if (typeof first === 'object' && first?.col) {
      col = first.col;
      id = second || `auto-${Math.random().toString(36).substring(2, 9)}`;
    } else if (typeof second === 'string') {
      col = second;
      id = third || `auto-${Math.random().toString(36).substring(2, 9)}`;
    }
    return {
      path: `${col}/${id}`,
      id,
      col
    };
  },
  collection: (db: any, col?: string) => {
    const colName = col || (typeof db === 'string' ? db : 'orders');
    return {
      path: colName,
      id: colName,
      col: colName
    };
  },
  query: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: () => new Date().toISOString(),
  Timestamp: { now: () => new Date().toISOString() },
  increment: (n: number) => ({ __type: 'increment', value: n }),
  onSnapshot: vi.fn((target: any, cb: any) => {
    if (target?.path?.includes('settings')) {
      cb({ exists: () => true, data: () => ({ overheadRate: 8.5 }) });
    } else {
      // coupons query
      cb({
        docs: Object.values(store.coupons).map(c => ({
          id: c.id,
          data: () => c
        }))
      });
    }
    return () => {};
  }),
  getDoc: vi.fn(async (docRef: any) => {
    const colData = store[docRef.col] || {};
    const data = colData[docRef.id];
    return {
      exists: () => !!data,
      id: docRef.id,
      data: () => data
    };
  }),
  getDocs: vi.fn(async (q: any) => {
    const col = q?.path || 'coupons';
    const docs = Object.values(store[col] || {}).map(d => ({
      id: d.id,
      data: () => d
    }));
    return {
      empty: docs.length === 0,
      docs
    };
  }),
  runTransaction: vi.fn(async (db: any, updateFn: (tx: any) => Promise<any>) => {
    const ops: any[] = [];
    const tx = {
      get: vi.fn(async (ref: any) => {
        const colData = store[ref.col] || {};
        const data = colData[ref.id];
        return {
          exists: () => !!data,
          id: ref.id,
          data: () => data
        };
      }),
      set: vi.fn((ref: any, data: any) => {
        ops.push({ type: 'set', col: ref.col, id: ref.id, data });
        if (!store[ref.col]) store[ref.col] = {};
        store[ref.col][ref.id] = data;
      }),
      update: vi.fn((ref: any, data: any) => {
        ops.push({ type: 'update', col: ref.col, id: ref.id, data });
        if (!store[ref.col]) store[ref.col] = {};
        const current = store[ref.col][ref.id] || {};
        const updated = { ...current };
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === 'object' && (v as any).__type === 'increment') {
            updated[k] = (Number(updated[k]) || 0) + (v as any).value;
          } else {
            updated[k] = v;
          }
        }
        store[ref.col][ref.id] = updated;
      }),
      delete: vi.fn((ref: any) => {
        ops.push({ type: 'delete', col: ref.col, id: ref.id });
        if (store[ref.col]) {
          delete store[ref.col][ref.id];
        }
      })
    };
    const res = await updateFn(tx);
    capturedBatchWrites.push(ops);
    return res;
  })
}));

import { useOrderForm } from '../useOrderForm';

describe('WEB-06 Suite: Chiết khấu thủ công, ghi chú và các trường trong đơn hàng', () => {
  const owner = { ownerId: 'owner-1', ownerEmail: 'owner@example.com', role: 'admin' };

  beforeEach(() => {
    mockRebates = [];
    capturedBatchWrites = [];
    store.orders = {};
    store.debts = {};
    store.coupons = {};
    store.customers['cust-1'] = { id: 'cust-1', name: 'Nguyễn Văn A', phone: '0901234567', debt: 100000, totalDebt: 100000 };
  });

  it('Ca 1 (Tối thiểu): Tiền hàng 1.000.000đ + phí 20.000đ − chiết khấu tay 50.000đ = 970.000đ; ghi chú "Giao buổi chiều" — sau lưu & reload phải giữ đủ', async () => {
    let toastFn = vi.fn();
    let savedOrderId = '';

    const { result } = renderHook(() =>
      useOrderForm({
        owner,
        showToast: toastFn,
        location: {},
        onSuccess: () => {}
      })
    );

    // 1. Thêm mặt hàng 1.000.000đ
    act(() => {
      result.current.setSelectedCustomer(mockCustomers[0]);
      result.current.addLineItem();
    });
    act(() => {
      result.current.updateLineItem(0, 'productId', 'prod-1');
      result.current.updateLineItem(0, 'price', 1000000);
      result.current.updateLineItem(0, 'qty', 1);
    });

    // 2. Nhập chiết khấu tay 50.000đ
    act(() => {
      result.current.setDiscountAmt(50000);
    });

    // 3. Nhập ghi chú "Giao buổi chiều"
    act(() => {
      result.current.setOrderNote('Giao buổi chiều');
    });

    // 4. Nhập phí vận chuyển 20.000đ
    act(() => {
      result.current.setShippingFee(20000);
    });

    // Kiểm tra state trước khi lưu
    expect(result.current.subTotal).toBe(1000000);
    expect(result.current.shippingFee).toBe(20000);
    expect(result.current.discountAmt).toBe(50000);
    expect(result.current.manualDiscount).toBe(50000);
    expect(result.current.finalTotal).toBe(970000);
    expect(result.current.orderNote).toBe('Giao buổi chiều');

    // 5. Lưu đơn hàng
    await act(async () => {
      await result.current.handleConfirmOrder();
    });

    // Xác nhận đơn được lưu vào store
    const orderKeys = Object.keys(store.orders);
    expect(orderKeys.length).toBe(1);
    savedOrderId = orderKeys[0];
    const savedOrder = store.orders[savedOrderId];

    // Payload lưu đúng và đủ cả chiết khấu + ghi chú + phí vận chuyển
    expect(savedOrder.subTotal).toBe(1000000);
    expect(savedOrder.adjustmentValue).toBe(20000);
    expect(savedOrder.discountValue).toBe(50000);
    expect(savedOrder.discountAmt).toBe(50000);
    expect(savedOrder.manualDiscount).toBe(50000);
    expect(savedOrder.totalAmount).toBe(970000);
    expect(savedOrder.note).toBe('Giao buổi chiều');

    // Kiểm tra công nợ khách hàng được cộng đúng 970.000đ
    expect(store.customers['cust-1'].debt).toBe(100000 + 970000);

    // 6. Reload / Mở đơn lại để sửa (editId)
    const { result: editResult } = renderHook(() =>
      useOrderForm({
        owner,
        showToast: vi.fn(),
        editId: savedOrderId,
        location: {}
      })
    );

    await act(async () => {
      await new Promise(r => setTimeout(r, 60));
    });

    // Kiểm tra form edit nạp đầy đủ các trường
    expect(editResult.current.discountAmt).toBe(50000);
    expect(editResult.current.manualDiscount).toBe(50000);
    expect(editResult.current.shippingFee).toBe(20000);
    expect(editResult.current.orderNote).toBe('Giao buổi chiều');
    expect(editResult.current.finalTotal).toBe(970000);
  });

  it('Ca 2: Đảo thứ tự nhập các trường (Ghi chú → Chiết khấu → Phí và ngược lại) cho kết quả nhất quán', async () => {
    // Thứ tự A: Note → Discount → Fee
    const { result: formA } = renderHook(() => useOrderForm({ owner, showToast: vi.fn(), location: {} }));
    act(() => {
      formA.current.updateLineItem(0, 'productId', 'prod-1');
      formA.current.updateLineItem(0, 'price', 1000000);
      formA.current.updateLineItem(0, 'qty', 1);
      formA.current.setOrderNote('Ghi chú trước');
      formA.current.setDiscountAmt(50000);
      formA.current.setShippingFee(20000);
    });

    // Thứ tự B: Discount → Fee → Note
    const { result: formB } = renderHook(() => useOrderForm({ owner, showToast: vi.fn(), location: {} }));
    act(() => {
      formB.current.updateLineItem(0, 'productId', 'prod-1');
      formB.current.updateLineItem(0, 'price', 1000000);
      formB.current.updateLineItem(0, 'qty', 1);
      formB.current.setDiscountAmt(50000);
      formB.current.setShippingFee(20000);
      formB.current.setOrderNote('Ghi chú trước');
    });

    // Thứ tự C: Fee → Note → Discount
    const { result: formC } = renderHook(() => useOrderForm({ owner, showToast: vi.fn(), location: {} }));
    act(() => {
      formC.current.updateLineItem(0, 'productId', 'prod-1');
      formC.current.updateLineItem(0, 'price', 1000000);
      formC.current.updateLineItem(0, 'qty', 1);
      formC.current.setShippingFee(20000);
      formC.current.setOrderNote('Ghi chú trước');
      formC.current.setDiscountAmt(50000);
    });

    expect(formA.current.finalTotal).toBe(970000);
    expect(formB.current.finalTotal).toBe(970000);
    expect(formC.current.finalTotal).toBe(970000);

    expect(formA.current.discountAmt).toBe(50000);
    expect(formB.current.discountAmt).toBe(50000);
    expect(formC.current.discountAmt).toBe(50000);
  });

  it('Ca 3: Mở đơn cũ có chiết khấu, chỉ sửa ghi chú rồi lưu — giữ nguyên chiết khấu và không phát sinh diff nợ', async () => {
    const existingOrderId = 'order-legacy-1';
    store.orders[existingOrderId] = {
      id: existingOrderId,
      customerId: 'cust-1',
      customerName: 'Nguyễn Văn A',
      items: [{ id: 'prod-1', productId: 'prod-1', name: 'Xi măng Hà Tiên', price: 1000000, qty: 1 }],
      subTotal: 1000000,
      adjustmentValue: 20000,
      discountValue: 50000,
      totalAmount: 970000,
      note: 'Ghi chú cũ',
      status: 'Đơn chốt',
      ownerId: owner.ownerId
    };

    const initialCustomerDebt = store.customers['cust-1'].debt;

    const { result } = renderHook(() =>
      useOrderForm({
        owner,
        showToast: vi.fn(),
        editId: existingOrderId,
        location: {}
      })
    );

    // Chờ fetchOrder
    await act(async () => {
      await new Promise(r => setTimeout(r, 60));
    });

    expect(result.current.discountAmt).toBe(50000);
    expect(result.current.orderNote).toBe('Ghi chú cũ');

    // Chỉ sửa ghi chú
    act(() => {
      result.current.setOrderNote('Ghi chú mới đã được cập nhật');
    });

    // Lưu lại
    await act(async () => {
      await result.current.handleConfirmOrder();
    });

    const updated = store.orders[existingOrderId];
    expect(updated.note).toBe('Ghi chú mới đã được cập nhật');
    expect(updated.discountValue).toBe(50000);
    expect(updated.totalAmount).toBe(970000);

    // Công nợ khách hàng không bị cộng tăng thêm vì tổng tiền không đổi (diffDebt === 0)
    expect(store.customers['cust-1'].debt).toBe(initialCustomerDebt);
  });

  it('Ca 4: Giá trị biên — chiết khấu bằng 0, xóa rỗng ô input, nhập số rồi bấm lưu ngay không bị NaN hay rơi số', async () => {
    const { result } = renderHook(() => useOrderForm({ owner, showToast: vi.fn(), location: {} }));

    act(() => {
      result.current.updateLineItem(0, 'productId', 'prod-1');
      result.current.updateLineItem(0, 'price', 1000000);
      result.current.updateLineItem(0, 'qty', 1);
    });

    // Xóa rỗng input
    act(() => {
      result.current.setDiscountAmt(0);
    });
    expect(result.current.discountAmt).toBe(0);
    expect(result.current.finalTotal).toBe(1000000);

    // Nhập rồi lưu ngay
    act(() => {
      result.current.setDiscountAmt(75000);
    });
    expect(result.current.discountAmt).toBe(75000);
    expect(result.current.finalTotal).toBe(925000);

    await act(async () => {
      await result.current.handleConfirmOrder();
    });

    const orderKeys = Object.keys(store.orders);
    const saved = store.orders[orderKeys[orderKeys.length - 1]];
    expect(saved.discountValue).toBe(75000);
    expect(saved.totalAmount).toBe(925000);
  });

  it('Ca 5: Provider re-render & showToast không làm mất chiết khấu nhập tay khi đang soạn', async () => {
    let toastFn = vi.fn();
    const { result, rerender } = renderHook(
      ({ showToast }) => useOrderForm({ owner, showToast, location: {} }),
      { initialProps: { showToast: toastFn } }
    );

    act(() => {
      result.current.updateLineItem(0, 'productId', 'prod-1');
      result.current.updateLineItem(0, 'price', 1000000);
      result.current.updateLineItem(0, 'qty', 1);
      result.current.setDiscountAmt(50000);
      result.current.setOrderNote('Đang soạn ghi chú');
    });

    expect(result.current.discountAmt).toBe(50000);

    // Giả lập ToastProvider bắn thông báo nhiều lần và đổi hàm showToast
    for (let i = 0; i < 5; i++) {
      const freshToast = vi.fn();
      rerender({ showToast: freshToast });
    }

    expect(result.current.discountAmt).toBe(50000);
    expect(result.current.orderNote).toBe('Đang soạn ghi chú');
    expect(result.current.finalTotal).toBe(950000);
  });

  it('Ca 6: Áp dụng và gỡ Coupon khi có chiết khấu tay — không ghi đè, không cộng trùng', async () => {
    const mockCoupon = {
      id: 'coupon-1',
      code: 'GIAM100K',
      title: 'Giảm 100.000đ',
      discount: '100000',
      type: 'fixed',
      scope: 'order',
      status: 'active'
    };

    const { result } = renderHook(() => useOrderForm({ owner, showToast: vi.fn(), location: {} }));

    act(() => {
      result.current.updateLineItem(0, 'productId', 'prod-1');
      result.current.updateLineItem(0, 'price', 1000000);
      result.current.updateLineItem(0, 'qty', 1);
      // Nhập chiết khấu tay 50.000đ
      result.current.setDiscountAmt(50000);
    });

    expect(result.current.discountAmt).toBe(50000);
    expect(result.current.manualDiscount).toBe(50000);
    expect(result.current.autoDiscount).toBe(0);

    // Áp dụng coupon 100.000đ
    act(() => {
      result.current.handleSelectCoupon(mockCoupon);
    });

    // Tổng chiết khấu = 50.000 (tay) + 100.000 (coupon) = 150.000đ
    expect(result.current.autoDiscount).toBe(100000);
    expect(result.current.manualDiscount).toBe(50000);
    expect(result.current.discountAmt).toBe(150000);
    expect(result.current.finalTotal).toBe(850000);

    // Gỡ coupon
    act(() => {
      result.current.handleRemoveCoupon();
    });

    // Chiết khấu tay vẫn giữ nguyên 50.000đ
    expect(result.current.autoDiscount).toBe(0);
    expect(result.current.manualDiscount).toBe(50000);
    expect(result.current.discountAmt).toBe(50000);
    expect(result.current.finalTotal).toBe(950000);
  });

  it('Ca 7: Áp dụng và gỡ Chiết khấu trả sau (Rebate) khi có chiết khấu tay', async () => {
    const mockRebate = {
      id: 'rebate-1',
      customerId: 'cust-1',
      customerName: 'Nguyễn Văn A',
      rebateAmount: 30000,
      status: 'active',
      usedCount: 0,
      maxUsage: 1
    };

    const { result } = renderHook(() => useOrderForm({ owner, showToast: vi.fn(), location: {} }));

    act(() => {
      result.current.setSelectedCustomer(mockCustomers[0]);
      result.current.updateLineItem(0, 'productId', 'prod-1');
      result.current.updateLineItem(0, 'price', 1000000);
      result.current.updateLineItem(0, 'qty', 1);
      result.current.setDiscountAmt(40000);
    });

    // Áp dụng rebate 30.000đ
    act(() => {
      result.current.handleSelectRebate(mockRebate);
    });

    // Tổng chiết khấu = 40.000 (tay) + 30.000 (rebate) = 70.000đ
    expect(result.current.autoDiscount).toBe(30000);
    expect(result.current.manualDiscount).toBe(40000);
    expect(result.current.discountAmt).toBe(70000);
    expect(result.current.finalTotal).toBe(930000);

    // Gỡ rebate
    act(() => {
      result.current.handleRemoveRebate();
    });

    // Chiết khấu tay vẫn còn nguyên 40.000đ
    expect(result.current.autoDiscount).toBe(0);
    expect(result.current.manualDiscount).toBe(40000);
    expect(result.current.discountAmt).toBe(40000);
    expect(result.current.finalTotal).toBe(960000);
  });

  it('Ca 8: Lưu đầy đủ các trường cùng lúc — ngày đơn, khách hàng, toạ độ, ghi chú, phí, chiết khấu', async () => {
    const { result } = renderHook(() => useOrderForm({ owner, showToast: vi.fn(), location: {} }));

    act(() => {
      result.current.setSelectedCustomer(mockCustomers[0]);
      result.current.updateLineItem(0, 'productId', 'prod-1');
      result.current.updateLineItem(0, 'price', 1000000);
      result.current.updateLineItem(0, 'qty', 2);
      result.current.setOrderDate('2026-10-27');
      result.current.setDeliveryLocation('10.762622, 106.660172');
      result.current.setParsedLocation({ lat: 10.762622, lng: 106.660172 });
      result.current.setOrderNote('Giao hàng tầng 3');
      result.current.setShippingFee(35000);
      result.current.setDiscountAmt(60000);
      result.current.setOrderStatus('Đơn chốt');
    });

    // Tiền hàng: 2 * 1.000.000 = 2.000.000đ
    // Phí: 35.000đ
    // Chiết khấu: 60.000đ
    // Tổng: 1.975.000đ
    expect(result.current.subTotal).toBe(2000000);
    expect(result.current.finalTotal).toBe(1975000);

    await act(async () => {
      await result.current.handleConfirmOrder();
    });

    const orderKeys = Object.keys(store.orders);
    const saved = store.orders[orderKeys[orderKeys.length - 1]];

    expect(saved.customerName).toBe('Nguyễn Văn A');
    expect(saved.orderDate).toBe('2026-10-27');
    expect(saved.rawDeliveryLocation).toBe('10.762622, 106.660172');
    expect(saved.deliveryLocation).toEqual({ lat: 10.762622, lng: 106.660172 });
    expect(saved.note).toBe('Giao hàng tầng 3');
    expect(saved.adjustmentValue).toBe(35000);
    expect(saved.discountValue).toBe(60000);
    expect(saved.totalAmount).toBe(1975000);
    expect(saved.status).toBe('Đơn chốt');
  });

  it('Ca 9: Double submit guard — kích hoạt lưu lặp không tạo trùng đơn và không nhân đôi công nợ', async () => {
    const { result } = renderHook(() => useOrderForm({ owner, showToast: vi.fn(), location: {} }));

    act(() => {
      result.current.setSelectedCustomer(mockCustomers[0]);
      result.current.updateLineItem(0, 'productId', 'prod-1');
      result.current.updateLineItem(0, 'price', 1000000);
      result.current.updateLineItem(0, 'qty', 1);
      result.current.setDiscountAmt(50000);
    });

    const initialDebt = store.customers['cust-1'].debt;

    // Kích hoạt đồng thời 2 lần gọi handleConfirmOrder (mô phỏng double click nhanh)
    await act(async () => {
      const p1 = result.current.handleConfirmOrder();
      const p2 = result.current.handleConfirmOrder();
      await Promise.all([p1, p2]);
    });

    // Chỉ có duy nhất 1 đơn được tạo
    expect(Object.keys(store.orders).length).toBe(1);
    // Nợ chỉ được cộng đúng 1 lần (100.000 + 950.000 = 1.050.000đ)
    expect(store.customers['cust-1'].debt).toBe(initialDebt + 950000);
  });
});
