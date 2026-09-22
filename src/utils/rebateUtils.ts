/**
 * Rebate Utilities — Bộ quy tắc & kiểm tra hiệu lực chiết khấu trả sau theo khách hàng
 */

import type { CustomerRebateData } from '../services/dataAccess';

export type RebateStatusType = 'active' | 'used' | 'expired' | 'upcoming' | 'disabled';

export function getRebateStatus(rebate: Partial<CustomerRebateData>, checkDate: string = new Date().toISOString().split('T')[0]): RebateStatusType {
  if (rebate.status === 'disabled') {
    return 'disabled';
  }

  const usedCount = Number(rebate.usedCount) || 0;
  const maxUsage = Number(rebate.maxUsage) || 1;

  if (usedCount >= maxUsage) {
    return 'used';
  }

  if (rebate.endDate && checkDate > rebate.endDate) {
    return 'expired';
  }

  if (rebate.startDate && checkDate < rebate.startDate) {
    return 'upcoming';
  }

  return 'active';
}

export function isRebateValidForOrder(
  rebate: Partial<CustomerRebateData>,
  customerId?: string,
  customerName?: string,
  orderDate: string = new Date().toISOString().split('T')[0]
): boolean {
  if (!rebate) return false;

  // Khớp khách hàng (theo ID hoặc tên)
  const idMatch = customerId && rebate.customerId && String(rebate.customerId).trim() === String(customerId).trim();
  const nameMatch = customerName && rebate.customerName && String(rebate.customerName).trim().toLowerCase() === String(customerName).trim().toLowerCase();

  if (!idMatch && !nameMatch) {
    return false;
  }

  // Kiểm tra trạng thái và thời hạn
  const status = getRebateStatus(rebate, orderDate);
  return status === 'active';
}

export function findValidCustomerRebate(
  rebates: Array<Partial<CustomerRebateData> & { id: string }>,
  customerId?: string,
  customerName?: string,
  orderDate: string = new Date().toISOString().split('T')[0]
): (Partial<CustomerRebateData> & { id: string }) | null {
  if (!Array.isArray(rebates) || rebates.length === 0) return null;

  const validRebates = rebates.filter(r => isRebateValidForOrder(r, customerId, customerName, orderDate));
  if (validRebates.length === 0) return null;

  // Lấy chiết khấu có số tiền lớn nhất hoặc hạn kết thúc gần nhất
  return validRebates.sort((a, b) => (Number(b.rebateAmount) || 0) - (Number(a.rebateAmount) || 0))[0];
}
