import * as db from '../db.js';
import { sendTelegramMessage } from '../telegram-helper.js';

function now() {
  return new Date().toISOString();
}

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  console.log("[order-webhook] Request from:", req.headers["origin"] || req.headers["referer"] || "unknown",
    "| customerName:", req.body?.customerName, "| items:", req.body?.items?.length);

  const apiKey = req.headers["x-api-key"] || req.headers["X-Api-Key"];
  const webhookToken = req.query?.token;

  if (!apiKey) return res.status(401).json({ error: "Missing x-api-key header" });

  try {
    const body = req.body;
    // Tự động nhận diện tài khoản dựa trên x-api-key (Bỏ qua body.ownerId hoàn toàn)
    const apiKeys = db.getAll('api_keys');
    const keyDoc = apiKeys.find(k => k.key === apiKey);
    
    if (!keyDoc) {
      return res.status(403).json({ error: "Invalid API key" });
    }
    if (keyDoc.enabled !== true) {
      return res.status(403).json({ error: "API key is disabled" });
    }
    
    const ownerId = keyDoc.ownerId || keyDoc.id;

    if (!body.customerName || !body.items?.length) return res.status(400).json({ error: "Missing customerName or items" });

    // Lấy tất cả sản phẩm của owner
    const allProducts = db.getAll('products', {
      where: [{ field: 'ownerId', op: '==', value: ownerId }]
    });

    const items = [];
    const notFound = [];

    for (const item of body.items) {
      let matched = null;

      if (item.productId) {
        matched = allProducts.find(p => p.id === item.productId);
      }
      if (!matched && item.productName) {
        matched = allProducts.find(p =>
          p.name?.toLowerCase() === item.productName.toLowerCase()
        );
      }

      if (matched) {
        items.push({
          productId: matched.id,
          name: matched.name || '',
          category: matched.category || matched.order_category || '',
          qty: Number(item.qty) || 0,
          price: Number(item.price) || Number(matched.priceSell || 0),
          buyPrice: Number(matched.priceImport || 0),
          unit: matched.unit || '',
          weight: matched.density ? String(matched.density) : '',
          stock: Number(matched.stock || 0),
          imageUrl: matched.imageUrl || ''
        });
      } else {
        notFound.push(item.productId || item.productName || 'unknown');
      }
    }

    if (items.length === 0) {
      return res.status(400).json({ error: "No matching products found", notFound });
    }

    // Tìm hoặc tạo khách hàng
    const customerName = body.customerName || '';
    const customerPhone = body.customerPhone || '';
    const customerEmail = body.customerEmail || '';

    const customers = db.getAll('customers', {
      where: [{ field: 'ownerId', op: '==', value: ownerId }]
    });
    let customer = customers.find(c => c.name === customerName);
    let customerId;

    if (customer) {
      customerId = customer.id;
    } else {
      const newCust = db.create('customers', {
        ownerId,
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
        address: body.customerAddress || '',
        type: 'Khách web',
        debt: 0,
        totalOrders: 0,
        createdAt: now(),
        createdBy: ownerId
      });
      customerId = newCust.id;
    }

    // Tính toán
    const shippingFee = Number(body.shippingFee) || 0;
    const subTotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const totalWeight = items.reduce((s, i) => s + (parseFloat(i.weight) || 0) * i.qty, 0);
    const totalCost = items.reduce((s, i) => s + (i.buyPrice || 0) * i.qty, 0);
    const totalAmount = subTotal + shippingFee;

    // Xử lý tọa độ giao hàng (deliveryLocation / rawDeliveryLocation / Google Maps link)
    let deliveryLocation = null;
    let rawDeliveryLocation = body.rawDeliveryLocation || '';
    if (body.deliveryLocation) {
      if (typeof body.deliveryLocation === 'object' && body.deliveryLocation.lat && body.deliveryLocation.lng) {
        deliveryLocation = {
          lat: Number(body.deliveryLocation.lat),
          lng: Number(body.deliveryLocation.lng)
        };
      } else if (typeof body.deliveryLocation === 'string') {
        rawDeliveryLocation = body.deliveryLocation;
        const match = rawDeliveryLocation.match(/@?(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
        if (match) {
          deliveryLocation = { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
        }
      }
    }
    if (!deliveryLocation && rawDeliveryLocation) {
      const match = rawDeliveryLocation.match(/@?(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
      if (match) {
        deliveryLocation = { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
      }
    }

    // Tạo đơn hàng
    const orderData = {
      ownerId,
      customerName,
      customerPhone,
      customerAddress: body.customerAddress || '',
      customerId: customerId || '',
      deliveryLocation: deliveryLocation || null,
      rawDeliveryLocation: rawDeliveryLocation || '',
      items: items.map(i => ({
        productId: i.productId,
        name: i.name,
        category: i.category || '',
        qty: i.qty,
        price: i.price,
        buyPrice: i.buyPrice,
        unit: i.unit,
        weight: i.weight,
        imageUrl: i.imageUrl || ''
      })),
      subTotal,
      totalAmount,
      paidAmount: totalAmount,
      debtAmount: 0,
      discountValue: 0,
      adjustmentValue: shippingFee,
      totalWeight,
      totalCost,
      totalProfit: subTotal - totalCost,
      status: 'Đơn chốt',
      note: body.note || 'Đơn từ Webhook API',
      orderDate: body.orderDate ? new Date(body.orderDate).toISOString().slice(0, 10) : now().slice(0, 10),
      createdAt: now(),
      updatedAt: now(),
      createdBy: 'web',
      createdByEmail: 'web@dunvex.com',
      createdByDisplayName: 'Web',
      source: 'webhook',
      order_category: items[0]?.category || ''
    };

    const order = db.create('orders', orderData);
    const orderId = order.id;

    // Cập nhật stock sản phẩm
    for (const item of items) {
      const product = allProducts.find(p => p.id === item.productId);
      if (product) {
        const newStock = Math.max(0, (Number(product.stock) || 0) - item.qty);
        db.update('products', item.productId, { stock: newStock, updatedAt: now() });
      }
    }

    // Cập nhật công nợ khách hàng
    if (customerId) {
      const cust = db.getById('customers', customerId);
      if (cust) {
        const currentDebt = Number(cust.debt || 0);
        db.update('customers', customerId, { debt: currentDebt + totalAmount, updatedAt: now() });
      }
    }

    // Telegram notification
    if (keyDoc.telegramBotToken && keyDoc.telegramChatId) {
      const chatId = keyDoc.telegramGroupChatId || keyDoc.telegramChatId;
      try {
        const message = `📦 <b>ĐƠN HÀNG MỚI (CHỐT)</b>\n- Khách hàng: <b>${customerName || 'Khách vãng lai'}</b>\n- Tổng tiền: <b>${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalAmount)}</b>\n- Người thao tác: Bot Trợ Lý (Webhook)`;
        await sendTelegramMessage(keyDoc.telegramBotToken, chatId, message);
      } catch (teleErr) {
        console.error('Failed to send Telegram notification:', teleErr);
      }
    }

    return res.status(200).json({
      success: true,
      orderId,
      customerId: customerId || null,
      totalAmount,
      items: items.length,
      notFound: notFound.length > 0 ? notFound : undefined
    });

  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}

export { handler as default };
