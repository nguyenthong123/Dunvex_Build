import * as db from '../db.js';

const TECHNICAL_FIELDS = ['ownerId', 'ownerEmail', 'updatedBy', 'updatedAt'];

function stripTechnicalFields(item) {
  if (!item || typeof item !== 'object') return item;
  const cleaned = {};
  for (const [key, val] of Object.entries(item)) {
    if (TECHNICAL_FIELDS.includes(key)) continue;
    cleaned[key] = val;
  }
  return cleaned;
}

function filterByDate(data, startTS, endTS) {
  if (!Array.isArray(data)) return [];
  if (!startTS && !endTS) return data;
  return data.filter((item) => {
    if (!item.createdAt) return true;
    let d = null;
    if (item.createdAt instanceof Date) {
      d = item.createdAt;
    } else if (typeof item.createdAt === 'string' || typeof item.createdAt === 'number') {
      d = new Date(item.createdAt);
    } else if (item.createdAt && typeof item.createdAt === 'object' && item.createdAt.seconds) {
      d = new Date(item.createdAt.seconds * 1000);
    }
    if (!d || isNaN(d.getTime())) return true;
    if (startTS && d < startTS) return false;
    if (endTS && d > endTS) return false;
    return true;
  });
}

export default async function exportData(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { ownerId, startDate, endDate } = req.body || req.query || {};

  try {
    const startTS = startDate ? new Date(startDate + 'T00:00:00') : null;
    const endTS = endDate ? new Date(endDate + 'T23:59:59') : null;

    if (!ownerId) {
      return res.status(400).json({ error: 'Yêu cầu mã ownerId để trích xuất dữ liệu' });
    }

    const targetCollections = [
      'products',
      'customers',
      'orders',
      'debts',
      'checkins',
      'attendance_logs',
      'payments',
      'inventory_logs',
      'supplier_debts',
      'purchase_orders'
    ];
    const results = {};

    for (const colName of targetCollections) {
      // Get data from SQLite (live data), filtered by ownerId
      const docs = db.getAll(colName, {
        where: [{ field: 'ownerId', op: '==', value: ownerId }]
      });

      // Filter by date range
      const filtered = filterByDate(docs, startTS, endTS);

      // Strip technical fields & unused fields
      results[colName] = filtered.map((item) => {
        const cleaned = stripTechnicalFields(item);
        if (colName === 'customers') {
          delete cleaned.businessName;
        }
        return cleaned;
      });
    }

    // Extract order details for chi_tiet_don_hang
    const orderDetails = [];
    if (results.orders) {
      const ownerSettings = (db.getById ? db.getById('settings', ownerId) : db.get('settings', ownerId)) || {};
      const overheadRate = ownerSettings.overheadRate !== undefined ? Number(ownerSettings.overheadRate) : 8.5;

      const productMapById = {};
      const productMapByName = {};
      if (results.products) {
        for (const p of results.products) {
          if (p.id) productMapById[p.id] = p;
          if (p.name) productMapByName[p.name.trim().toLowerCase()] = p;
        }
      }

      const EXCLUDE_PROFIT_KEYWORDS = ['ứng tiền', 'ung tien', 'ưng tiền', 'ứng trước', 'ung truoc', 'tạm ứng', 'tam ung'];
      const isExcludedFromProfit = (name, flag) => {
        if (flag) return true;
        if (!name) return false;
        const lower = String(name).toLowerCase();
        return EXCLUDE_PROFIT_KEYWORDS.some((kw) => lower.includes(kw));
      };

      for (const order of results.orders) {
        if (order.items && Array.isArray(order.items)) {
          for (const item of order.items) {
            const rawItem = typeof item === 'object' ? item : { item };
            const prodId = rawItem.id || rawItem.productId;
            const prodName = rawItem.name || rawItem.productName || '';
            const matchedProd = productMapById[prodId] || productMapByName[prodName.trim().toLowerCase()] || {};

            const excluded = isExcludedFromProfit(prodName, rawItem.excludeProfit || matchedProd.excludeProfit);
            const applyOverhead = rawItem.applyOverheadCost !== undefined 
              ? Boolean(rawItem.applyOverheadCost) 
              : Boolean(matchedProd.applyOverheadCost);

            const qty = Number(rawItem.qty || 0);
            const priceSell = Number(rawItem.price !== undefined ? rawItem.price : (rawItem.priceSell || 0));
            const buyPrice = Number(rawItem.buyPrice !== undefined && rawItem.buyPrice !== null
              ? rawItem.buyPrice 
              : (matchedProd.priceImport || matchedProd.costPrice || matchedProd.buyPrice || 0));

            let unitProfit = 0;
            let profit = 0;

            if (!excluded) {
              let effectiveCost = buyPrice;
              if (applyOverhead && overheadRate > 0) {
                effectiveCost = buyPrice * (1 + overheadRate / 100);
              }
              unitProfit = priceSell - effectiveCost;
              profit = unitProfit * qty;
            }

            orderDetails.push({
              orderId: order.id,
              orderDate: order.orderDate || (order.createdAt ? new Date(order.createdAt).toLocaleDateString('vi-VN') : ''),
              customerName: order.customerName || '',
              createdBy: order.createdBy || '',
              createdByEmail: order.createdByEmail || '',
              createdByDisplayName: order.createdByDisplayName || '',
              ...rawItem,
              buyPrice: Math.round(buyPrice),
              profit: Math.round(profit),
              unitProfit: Math.round(unitProfit),
            });
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        products: results.products || [],
        customers: results.customers || [],
        orders: results.orders || [],
        debts: results.debts || [],
        checkins: results.checkins || [],
        attendance_logs: results.attendance_logs || [],
        payments: results.payments || [],
        inventory_logs: results.inventory_logs || [],
        supplier_debts: results.supplier_debts || [],
        purchase_orders: results.purchase_orders || [],
        orderDetails,
      },
      counts: {
        products: results.products?.length || 0,
        customers: results.customers?.length || 0,
        orders: results.orders?.length || 0,
        debts: results.debts?.length || 0,
        checkins: results.checkins?.length || 0,
        attendance_logs: results.attendance_logs?.length || 0,
        payments: results.payments?.length || 0,
        inventory_logs: results.inventory_logs?.length || 0,
        supplier_debts: results.supplier_debts?.length || 0,
        purchase_orders: results.purchase_orders?.length || 0,
      },
    });
  } catch (error) {
    console.error('Export API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
