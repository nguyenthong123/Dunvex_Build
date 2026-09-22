/**
 * Coupon Utilities — Bộ tính toán chiết khấu đơn hàng & sản phẩm cho Dunvex App
 * Hỗ trợ chiết khấu toàn đơn và chiết khấu theo từng sản phẩm (% hoặc số tiền cố định)
 */

export interface CouponDiscountResult {
  totalDiscount: number;
  breakdown: Array<{
    productId?: string;
    sku?: string;
    productName?: string;
    qty: number;
    price: number;
    itemDiscount: number;
  }>;
  appliedCount: number;
}

export function calculateCouponDiscount(
  coupon: any,
  lineItems: any[] = [],
  subTotal: number = 0,
  shippingFee: number = 0
): CouponDiscountResult {
  if (!coupon) {
    return { totalDiscount: 0, breakdown: [], appliedCount: 0 };
  }

  const discountVal = parseFloat(coupon.discount) || 0;
  const scope = coupon.scope || 'order';
  let totalDiscount = 0;
  const breakdown: CouponDiscountResult['breakdown'] = [];

  if (scope === 'product') {
    const targetIds = Array.isArray(coupon.targetProductIds)
      ? coupon.targetProductIds.map((id: any) => String(id))
      : [];
    const targetSkus = Array.isArray(coupon.targetProductSkus)
      ? coupon.targetProductSkus.map((sku: any) => String(sku).toLowerCase().trim())
      : [];

    for (const item of lineItems) {
      if (!item) continue;
      const itemId = item.productId ? String(item.productId) : '';
      const itemSku = item.sku ? String(item.sku).toLowerCase().trim() : '';

      const isMatchId = itemId && targetIds.includes(itemId);
      const isMatchSku = itemSku && targetSkus.includes(itemSku);

      if (isMatchId || isMatchSku) {
        const qty = Number(item.qty) || 0;
        const price = Number(item.price ?? item.priceSell ?? 0) || 0;
        let itemDiscount = 0;

        if (coupon.type === 'percentage') {
          // Giảm theo % đơn giá * số lượng
          itemDiscount = (qty * price) * (discountVal / 100);
        } else if (coupon.type === 'fixed') {
          // Giảm số tiền cố định trên từng đơn vị sản phẩm
          itemDiscount = qty * discountVal;
        }

        totalDiscount += itemDiscount;
        breakdown.push({
          productId: itemId,
          sku: itemSku,
          productName: item.name || '',
          qty,
          price,
          itemDiscount
        });
      }
    }
  } else {
    // Scope: 'order' (Mặc định toàn đơn hàng)
    if (coupon.type === 'percentage') {
      totalDiscount = subTotal * (discountVal / 100);
    } else if (coupon.type === 'fixed') {
      totalDiscount = discountVal;
    } else if (coupon.type === 'shipping') {
      totalDiscount = Number(shippingFee) || 0;
    }
  }

  // Khống chế số tiền giảm không vượt quá tổng phụ đơn hàng
  totalDiscount = Math.min(Math.max(0, Math.round(totalDiscount)), Math.max(0, subTotal));

  return {
    totalDiscount,
    breakdown,
    appliedCount: breakdown.length
  };
}
