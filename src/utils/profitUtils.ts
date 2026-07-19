/**
 * Các keyword tự động loại khỏi tính lợi nhuận.
 * VD: "Thợ ứng tiền", "Công thợ ứng tiền", "Ứng tiền công thợ", v.v.
 * Khớp không phân biệt hoa/thường.
 */
const EXCLUDE_PROFIT_KEYWORDS = [
  'ứng tiền',
  'ung tien',
  'ưng tiền',
  'ứng trước',
  'ung truoc',
  'tạm ứng',
  'tam ung',
];

/**
 * Kiểm tra sản phẩm có bị loại khỏi tính lợi nhuận không.
 * Ưu tiên checkbox `excludeProfit`, sau đó kiểm tra keyword trong tên.
 */
export function shouldExcludeFromProfit(
  productName: string,
  excludeProfit?: boolean
): boolean {
  if (excludeProfit) return true;
  if (!productName) return false;
  const lower = productName.toLowerCase();
  return EXCLUDE_PROFIT_KEYWORDS.some(kw => lower.includes(kw));
}
