import { describe, it, expect } from 'vitest';
import {
  calculateTotalOrders,
  calculateTotalPayments,
  calculateDebt,
  calculateCustomerDebt,
  classifyDebt,
  formatCurrency,
} from '../debtUtils';

// ─── calculateTotalOrders ──────────────────────────
describe('calculateTotalOrders', () => {
  it('tính tổng đơn hàng đã chốt', () => {
    const orders = [
      { totalAmount: 1_000_000, status: 'Đơn chốt' },
      { totalAmount: 2_500_000, status: 'Đơn chốt' },
      { totalAmount: 500_000, status: 'Đơn nháp' }, // bỏ qua
    ];
    expect(calculateTotalOrders(orders)).toBe(3_500_000);
  });

  it('trả về 0 nếu không có đơn chốt', () => {
    const orders = [
      { totalAmount: 1_000_000, status: 'Đơn nháp' },
    ];
    expect(calculateTotalOrders(orders)).toBe(0);
  });

  it('trả về 0 nếu mảng rỗng', () => {
    expect(calculateTotalOrders([])).toBe(0);
  });

  it('hỗ trợ status filter tùy chỉnh', () => {
    const orders = [
      { totalAmount: 1_000_000, status: 'Hoàn thành' },
      { totalAmount: 500_000, status: 'Đơn chốt' },
    ];
    expect(calculateTotalOrders(orders, 'Hoàn thành')).toBe(1_000_000);
  });

  it('xử lý totalAmount là string', () => {
    const orders = [
      { totalAmount: '2000000', status: 'Đơn chốt' },
    ];
    expect(calculateTotalOrders(orders)).toBe(2_000_000);
  });
});

// ─── calculateTotalPayments ─────────────────────────
describe('calculateTotalPayments', () => {
  it('tính tổng tiền đã trả', () => {
    const payments = [
      { amount: 500_000 },
      { amount: 1_200_000 },
      { amount: 300_000 },
    ];
    expect(calculateTotalPayments(payments)).toBe(2_000_000);
  });

  it('trả về 0 nếu mảng rỗng', () => {
    expect(calculateTotalPayments([])).toBe(0);
  });

  it('xử lý amount = 0 hoặc undefined', () => {
    const payments = [
      { amount: 500_000 },
      { amount: 0 },
      {}, // no amount
    ] as any[];
    expect(calculateTotalPayments(payments)).toBe(500_000);
  });
});

// ─── calculateDebt ──────────────────────────────────
describe('calculateDebt', () => {
  it('tính công nợ = tổng mua - tổng trả', () => {
    expect(calculateDebt(5_000_000, 3_000_000)).toBe(2_000_000);
  });

  it('công nợ âm = khách trả dư', () => {
    expect(calculateDebt(2_000_000, 3_000_000)).toBe(-1_000_000);
  });

  it('công nợ = 0 khi đã trả hết', () => {
    expect(calculateDebt(5_000_000, 5_000_000)).toBe(0);
  });
});

// ─── calculateCustomerDebt ──────────────────────────
describe('calculateCustomerDebt', () => {
  it('tính công nợ cho 1 khách hàng cụ thể', () => {
    const orders = [
      { totalAmount: 1_500_000, status: 'Đơn chốt' },
      { totalAmount: 800_000, status: 'Đơn chốt' },
    ];
    const payments = [
      { amount: 1_000_000 },
    ];
    expect(calculateCustomerDebt(orders, payments)).toBe(1_300_000);
  });

  it('khách mới chưa có giao dịch → nợ 0', () => {
    expect(calculateCustomerDebt([], [])).toBe(0);
  });
});

// ─── classifyDebt ───────────────────────────────────
describe('classifyDebt', () => {
  it('phân loại đúng trạng thái công nợ', () => {
    expect(classifyDebt(1_000_000)).toBe('owing');
    expect(classifyDebt(0)).toBe('paid');
    expect(classifyDebt(-500_000)).toBe('paid'); // trả dư
  });
});

// ─── formatCurrency ─────────────────────────────────
describe('formatCurrency', () => {
  it('format đúng định dạng VNĐ', () => {
    expect(formatCurrency(1_000_000)).toBe('1.000.000đ');
    expect(formatCurrency(0)).toBe('0đ');
    expect(formatCurrency(12_345_678)).toBe('12.345.678đ');
  });
});
