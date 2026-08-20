/**
 * Hàm tính công nợ thuần túy — không phụ thuộc Firebase/React
 * Dễ test, dễ tái sử dụng
 */

interface OrderLike {
  totalAmount?: number | string;
  status?: string;
}

interface PaymentLike {
  amount?: number | string;
}

/** Tính tổng tiền đơn hàng đã chốt */
export function calculateTotalOrders(orders: OrderLike[], statusFilter: string = 'Đơn chốt'): number {
  return orders
    .filter(o => o.status === statusFilter)
    .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
}

/** Tính tổng tiền đã thanh toán */
export function calculateTotalPayments(payments: PaymentLike[]): number {
  return payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

/** Tính công nợ hiện tại = Tổng mua - Tổng trả */
export function calculateDebt(totalOrders: number, totalPayments: number): number {
  return totalOrders - totalPayments;
}

/** Tính công nợ cho 1 khách hàng từ danh sách đơn + phiếu thu */
export function calculateCustomerDebt(
  orders: OrderLike[],
  payments: PaymentLike[],
  statusFilter: string = 'Đơn chốt'
): number {
  const totalBuy = calculateTotalOrders(orders, statusFilter);
  const totalPay = calculateTotalPayments(payments);
  return calculateDebt(totalBuy, totalPay);
}

/** Phân loại công nợ */
export function classifyDebt(debt: number): 'paid' | 'owing' | 'overdue' {
  if (debt <= 0) return 'paid';
  return 'owing';
}

/** Format tiền VNĐ */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('vi-VN') + 'đ';
}
