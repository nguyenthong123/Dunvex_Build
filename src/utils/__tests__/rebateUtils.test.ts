import { describe, it, expect } from 'vitest';
import { getRebateStatus, isRebateValidForOrder, findValidCustomerRebate } from '../rebateUtils';

describe('rebateUtils', () => {
  const sampleRebate = {
    id: 'rebate-1',
    customerId: 'cust-123',
    customerName: 'thong nguyen',
    rebateAmount: 2000000,
    startDate: '2026-10-05',
    endDate: '2026-10-15',
    maxUsage: 1,
    usedCount: 0,
    status: 'active' as const,
  };

  it('xác định đúng trạng thái active trong khoảng thời gian', () => {
    expect(getRebateStatus(sampleRebate, '2026-10-10')).toBe('active');
    expect(getRebateStatus(sampleRebate, '2026-10-05')).toBe('active');
    expect(getRebateStatus(sampleRebate, '2026-10-15')).toBe('active');
  });

  it('xác định đúng trạng thái upcoming trước ngày bắt đầu', () => {
    expect(getRebateStatus(sampleRebate, '2026-10-01')).toBe('upcoming');
  });

  it('xác định đúng trạng thái expired sau ngày kết thúc', () => {
    expect(getRebateStatus(sampleRebate, '2026-10-16')).toBe('expired');
  });

  it('xác định đúng trạng thái used khi đã dùng đủ lượt', () => {
    expect(getRebateStatus({ ...sampleRebate, usedCount: 1 }, '2026-10-10')).toBe('used');
  });

  it('xác định đúng trạng thái disabled', () => {
    expect(getRebateStatus({ ...sampleRebate, status: 'disabled' }, '2026-10-10')).toBe('disabled');
  });

  it('kiểm tra hợp lệ theo customerId hoặc customerName trong kỳ', () => {
    expect(isRebateValidForOrder(sampleRebate, 'cust-123', undefined, '2026-10-10')).toBe(true);
    expect(isRebateValidForOrder(sampleRebate, undefined, 'thong nguyen', '2026-10-10')).toBe(true);
    expect(isRebateValidForOrder(sampleRebate, 'other-cust', 'other name', '2026-10-10')).toBe(false);
  });

  it('không hợp lệ nếu đã dùng hết lượt hoặc quá hạn', () => {
    const usedRebate = { ...sampleRebate, usedCount: 1 };
    expect(isRebateValidForOrder(usedRebate, 'cust-123', 'thong nguyen', '2026-10-10')).toBe(false);

    expect(isRebateValidForOrder(sampleRebate, 'cust-123', 'thong nguyen', '2026-10-20')).toBe(false);
  });

  it('tìm đúng chiết khấu hợp lệ từ danh sách', () => {
    const rebates = [
      { id: 'r1', customerId: 'cust-123', customerName: 'thong nguyen', rebateAmount: 1000000, startDate: '2026-10-05', endDate: '2026-10-15', maxUsage: 1, usedCount: 0, status: 'active' as const },
      { id: 'r2', customerId: 'cust-123', customerName: 'thong nguyen', rebateAmount: 2000000, startDate: '2026-10-05', endDate: '2026-10-15', maxUsage: 1, usedCount: 0, status: 'active' as const },
      { id: 'r3', customerId: 'cust-456', customerName: 'other', rebateAmount: 5000000, startDate: '2026-10-05', endDate: '2026-10-15', maxUsage: 1, usedCount: 0, status: 'active' as const },
    ];

    const result = findValidCustomerRebate(rebates, 'cust-123', 'thong nguyen', '2026-10-10');
    expect(result?.id).toBe('r2');
    expect(result?.rebateAmount).toBe(2000000);
  });
});
