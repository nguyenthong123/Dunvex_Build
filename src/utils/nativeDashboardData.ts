import { getOrderTimestamp } from './orderFilter';

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function finiteNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function localDateFromTimestamp(value: unknown): string | undefined {
  let date: Date | undefined;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    date = new Date(value < 1e12 ? value * 1000 : value);
  } else if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) date = new Date(timestamp);
  } else if (value && typeof value === 'object') {
    const timestampValue = value as { seconds?: number; _seconds?: number; toDate?: () => Date };
    if (typeof timestampValue.toDate === 'function') date = timestampValue.toDate();
    else {
      const seconds = timestampValue.seconds ?? timestampValue._seconds;
      if (typeof seconds === 'number') date = new Date(seconds * 1000);
    }
  }
  if (!date || Number.isNaN(date.getTime())) return undefined;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeLineItem(item: Record<string, any>): Record<string, any> {
  return {
    ...item,
    productId: firstDefined(item.productId, item.product_id, item.id),
    price: finiteNumber(firstDefined(item.price, item.unit_price, item.unitPrice)) ?? 0,
    buyPrice: finiteNumber(firstDefined(
      item.buyPrice,
      item.buy_price,
      item.priceImport,
      item.price_import,
      item.costPrice,
      item.cost_price,
    )) ?? 0,
    qty: finiteNumber(firstDefined(item.qty, item.quantity)) ?? 0,
  };
}

export function normalizeNativeDashboardOrder(
  order: Record<string, any>,
  relatedItems: Record<string, any>[] = [],
): Record<string, any> {
  const embeddedItems = Array.isArray(order.items)
    ? order.items
    : Array.isArray(order.products)
      ? order.products
      : [];
  const items = embeddedItems.length > 0 ? embeddedItems : relatedItems;
  const totalProfit = finiteNumber(firstDefined(order.totalProfit, order.total_profit));
  const createdAt = firstDefined(order.createdAt, order.created_at);
  const explicitOrderDate = firstDefined(order.orderDate, order.order_date, order.date);

  return {
    ...order,
    status: firstDefined(order.status, order.order_status),
    orderDate: explicitOrderDate ?? localDateFromTimestamp(createdAt),
    createdAt,
    totalAmount: finiteNumber(firstDefined(
      order.totalAmount,
      order.total_amount,
      order.total,
      order.amount,
    )) ?? 0,
    totalProfit,
    discountValue: finiteNumber(firstDefined(
      order.discountValue,
      order.discount_value,
      order.discountAmt,
      order.discount_amt,
    )) ?? 0,
    customerId: firstDefined(order.customerId, order.customer_id),
    customerName: firstDefined(order.customerName, order.customer_name),
    customerBusinessName: firstDefined(
      order.customerBusinessName,
      order.customer_business_name,
      order.business_name,
    ),
    items: items.map((item: Record<string, any>) => normalizeLineItem(item)),
  };
}

export function normalizeNativeDashboardProduct(
  product: Record<string, any>,
): Record<string, any> {
  return {
    ...product,
    name: firstDefined(product.name, product.product_name) || '',
    priceImport: finiteNumber(firstDefined(
      product.priceImport,
      product.price_import,
      product.buyPrice,
      product.buy_price,
      product.costPrice,
      product.cost_price,
    )) ?? 0,
    excludeProfit: booleanValue(firstDefined(product.excludeProfit, product.exclude_profit)),
  };
}

export function needsNativeOrderLineItems(order: Record<string, any>): boolean {
  const totalProfit = finiteNumber(firstDefined(order.totalProfit, order.total_profit));
  const embeddedItems = Array.isArray(order.items)
    ? order.items
    : Array.isArray(order.products)
      ? order.products
      : [];
  return totalProfit === undefined && embeddedItems.length === 0;
}

export interface NativeMonthlySellerStat {
  email: string;
  displayName: string;
  totalRevenue: number;
  orderCount: number;
}

export function getNativeMonthlySellerStats(
  orders: Record<string, any>[],
  now = new Date(),
): NativeMonthlySellerStat[] {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const sellers = new Map<string, NativeMonthlySellerStat & { uid: string }>();

  for (const order of orders) {
    if (String(order.status || '').trim() !== 'Đơn chốt') continue;
    const timestamp = getOrderTimestamp({
      ...order,
      createdAt: firstDefined(order.createdAt, order.created_at),
      orderDate: firstDefined(order.orderDate, order.order_date),
    });
    if (timestamp < monthStart || timestamp >= nextMonthStart) continue;

    const email = String(order.createdByEmail || '').toLowerCase().trim();
    const uid = String(order.createdBy || '').trim();
    const key = email || uid || 'unknown';
    const amount = Number(firstDefined(order.totalAmount, order.total_amount, order.total, order.amount)) || 0;
    const existing = sellers.get(key);
    if (existing) {
      existing.totalRevenue += amount;
      existing.orderCount++;
      if (!existing.uid && uid) existing.uid = uid;
      if (!existing.displayName && order.createdByDisplayName) {
        existing.displayName = String(order.createdByDisplayName);
      }
      continue;
    }

    sellers.set(key, {
      email: key,
      displayName: String(order.createdByDisplayName || key.split('@')[0]),
      totalRevenue: amount,
      orderCount: 1,
      uid,
    });
  }

  return Array.from(sellers.values())
    .map(({ uid: _uid, ...seller }) => seller)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10);
}
