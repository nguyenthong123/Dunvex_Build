import { describe, it, expect } from 'vitest';
import { calculateCouponDiscount } from '../couponUtils';

describe('Coupon Discount Utility Suite', () => {
  it('should calculate order-wide percentage discount', () => {
    const coupon = { scope: 'order', type: 'percentage', discount: '10' };
    const res = calculateCouponDiscount(coupon, [], 1000000, 0);
    expect(res.totalDiscount).toBe(100000);
  });

  it('should calculate order-wide fixed amount discount', () => {
    const coupon = { scope: 'order', type: 'fixed', discount: '50000' };
    const res = calculateCouponDiscount(coupon, [], 1000000, 0);
    expect(res.totalDiscount).toBe(50000);
  });

  it('should calculate product-level percentage discount for selected products only', () => {
    const coupon = {
      scope: 'product',
      type: 'percentage',
      discount: '10', // 10%
      targetProductIds: ['prod_1']
    };

    const lineItems = [
      { productId: 'prod_1', name: 'Keo 3X Bond', qty: 5, priceSell: 150000 }, // Matching: 5 * 150k = 750k -> 10% = 75k
      { productId: 'prod_2', name: 'Tôn 0.45mm', qty: 10, priceSell: 100000 }   // Non-matching
    ];

    const res = calculateCouponDiscount(coupon, lineItems, 1750000, 0);
    expect(res.totalDiscount).toBe(75000);
    expect(res.appliedCount).toBe(1);
    expect(res.breakdown[0].itemDiscount).toBe(75000);
  });

  it('should calculate product-level fixed amount discount per unit', () => {
    const coupon = {
      scope: 'product',
      type: 'fixed',
      discount: '5000', // Giảm 5.000đ / cái
      targetProductIds: ['prod_1', 'prod_3']
    };

    const lineItems = [
      { productId: 'prod_1', name: 'Keo 3X Bond', qty: 4, priceSell: 150000 }, // Matching: 4 * 5k = 20k
      { productId: 'prod_2', name: 'Tôn 0.45mm', qty: 10, priceSell: 100000 },  // Non-matching
      { productId: 'prod_3', name: 'Sơn chống thấm', qty: 2, priceSell: 200000 } // Matching: 2 * 5k = 10k
    ];

    const res = calculateCouponDiscount(coupon, lineItems, 2000000, 0);
    expect(res.totalDiscount).toBe(30000); // 20k + 10k = 30k
    expect(res.appliedCount).toBe(2);
  });

  it('should match target products by SKU as well', () => {
    const coupon = {
      scope: 'product',
      type: 'percentage',
      discount: '20',
      targetProductSkus: ['KEO3X']
    };

    const lineItems = [
      { sku: 'KEO3X', name: 'Keo 3X Bond', qty: 2, priceSell: 100000 } // 2 * 100k = 200k -> 20% = 40k
    ];

    const res = calculateCouponDiscount(coupon, lineItems, 200000, 0);
    expect(res.totalDiscount).toBe(40000);
  });

  it('should cap total discount at subTotal', () => {
    const coupon = { scope: 'order', type: 'fixed', discount: '500000' };
    const res = calculateCouponDiscount(coupon, [], 300000, 0);
    expect(res.totalDiscount).toBe(300000); // Capped at 300k
  });

  it('should correctly calculate discount when lineItem uses price instead of priceSell', () => {
    const coupon = {
      scope: 'product',
      type: 'percentage',
      discount: '10',
      targetProductIds: ['prod_100']
    };

    const lineItems = [
      { productId: 'prod_100', name: 'Sản phẩm thử', qty: 2, price: 50000 } // 2 * 50k = 100k -> 10% = 10k
    ];

    const res = calculateCouponDiscount(coupon, lineItems, 100000, 0);
    expect(res.totalDiscount).toBe(10000);
    expect(res.appliedCount).toBe(1);
  });
});
