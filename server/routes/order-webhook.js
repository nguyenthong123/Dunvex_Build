import * as db from '../db.js';
import { sendTelegramMessage } from '../telegram-helper.js';

function now() {
  return new Date().toISOString();
}

function cleanCustomerName(name) {
  if (!name || typeof name !== 'string') return '';
  let str = name.trim().replace(/\s+/g, ' ');

  // Xử lý trường hợp lặp 2 từ giống nhau: "Tèo Tèo" -> "Tèo", "Nam Nam" -> "Nam"
  const words = str.split(' ');
  if (words.length === 2 && words[0].toLowerCase() === words[1].toLowerCase()) {
    return words[0];
  }

  // Xử lý trường hợp lặp cụm từ chẵn: "Nguyễn Văn A Nguyễn Văn A" -> "Nguyễn Văn A"
  const half = Math.floor(words.length / 2);
  if (words.length >= 2 && words.length % 2 === 0) {
    const firstHalf = words.slice(0, half).join(' ').toLowerCase();
    const secondHalf = words.slice(half).join(' ').toLowerCase();
    if (firstHalf === secondHalf) {
      return words.slice(0, half).join(' ');
    }
  }

  return str;
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

      const pId = item.productId || item.id;
      const rawName = (item.productName || item.name || '').trim();

      if (pId) {
        matched = allProducts.find(p => p.id === pId || p.sku === pId);
      }
      if (!matched && rawName) {
        const lower = rawName.toLowerCase();
        matched = allProducts.find(p => (p.name || '').toLowerCase().trim() === lower);
        if (!matched) {
          matched = allProducts.find(p => {
            const pLower = (p.name || '').toLowerCase().trim();
            return pLower && (pLower.includes(lower) || lower.includes(pLower));
          });
        }
      }

      if (matched) {
        items.push({
          productId: matched.id,
          name: matched.name || rawName,
          category: matched.category || matched.order_category || '',
          qty: Number(item.qty) || 1,
          price: Number(item.price) > 0 ? Number(item.price) : Number(matched.priceSell || 0),
          buyPrice: Number(matched.priceImport || 0),
          unit: matched.unit || item.unit || 'Cái',
          weight: matched.density ? String(matched.density) : (item.weight ? String(item.weight) : ''),
          stock: Number(matched.stock || 0),
          imageUrl: matched.imageUrl || item.imageUrl || ''
        });
      } else if (rawName || pId) {
        // Fallback linh hoạt: Vẫn tiếp nhận sản phẩm web ngoài để không làm rớt đơn của khách
        items.push({
          productId: pId || `custom_${Date.now()}`,
          name: rawName || 'Sản phẩm Web ngoài',
          category: item.category || 'Khách đặt từ Web',
          qty: Math.max(1, Number(item.qty) || 1),
          price: Number(item.price) || 0,
          buyPrice: 0,
          unit: item.unit || 'Cái',
          weight: item.weight ? String(item.weight) : '',
          stock: 999,
          imageUrl: item.imageUrl || ''
        });
      } else {
        notFound.push(pId || rawName || 'unknown');
      }
    }

    if (items.length === 0) {
      return res.status(400).json({ error: "No matching products found", notFound });
    }

    const ownerUser = db.get('users', ownerId) || {};
    const ownerEmail = ownerUser.email || keyDoc.createdBy || '';

    // 1. Chuẩn hoá thông tin khách hàng từ web
    let customerName = cleanCustomerName(body.customerName || body.name || '');
    const rawCustomerPhone = (body.customerPhone || body.phone || '').trim();
    const cleanPhone = rawCustomerPhone.replace(/\D/g, '');
    const customerEmail = (body.customerEmail || body.email || '').toLowerCase().trim();
    const customerAddress = (body.customerAddress || body.address || '').trim();
    let customerBusinessName = (body.customerBusinessName || '').trim();

    const customers = db.getAll('customers', {
      where: [{ field: 'ownerId', op: '==', value: ownerId }]
    });

    const isGenericName = (name) => {
      if (!name) return true;
      const lower = name.toLowerCase().trim();
      return ['khách lẻ', 'khách vãng lai', 'khách lẻ mua', 'khách web', 'chưa cập nhật tên', 'khách hàng', 'unknown'].includes(lower);
    };

    let customer = null;

    // 1. Tìm theo customerId gửi từ web (nếu có và hợp lệ)
    if (body.customerId) {
      customer = customers.find(c => c.id === body.customerId);
    }

    // 2. Tìm theo tên khách hàng hoặc tên doanh nghiệp (Exact match hoặc case-insensitive)
    if (!customer && customerName && !isGenericName(customerName)) {
      const lowerName = customerName.toLowerCase().trim();
      customer = customers.find(c => {
        const cName = (c.name || '').toLowerCase().trim();
        const bName = (c.businessName || '').toLowerCase().trim();
        const cleanCName = cleanCustomerName(c.name || '').toLowerCase().trim();
        return cName === lowerName || bName === lowerName || cleanCName === lowerName;
      });
    }

    // 3. Tìm theo số điện thoại (CHỈ KHỚP NẾU TÊN TƯƠNG ĐỒNG HOẶC KHÁCH CŨ LÀ TÊN CHUNG/VÃNG LAI)
    // Tuyệt đối không gán đè nếu người mua web có tên mới khác biệt hoàn toàn với tên khách đang giữ SĐT
    if (!customer && cleanPhone && cleanPhone.length >= 8) {
      const phoneMatches = customers.filter(c => (c.phone || '').replace(/\D/g, '') === cleanPhone);
      for (const pMatch of phoneMatches) {
        const pMatchName = (pMatch.name || '').toLowerCase().trim();
        const incomingLower = (customerName || '').toLowerCase().trim();

        // Khách cũ mang tên chung (Khách lẻ, Khách vãng lai...) -> Cập nhật tên mới của web
        if (isGenericName(pMatch.name)) {
          customer = pMatch;
          break;
        }

        // Tên web trùng hoặc chứa nhau (ví dụ "Anh Tuấn" và "Tuấn", hoặc "Nguyễn Văn A")
        if (incomingLower && (pMatchName === incomingLower || pMatchName.includes(incomingLower) || incomingLower.includes(pMatchName))) {
          customer = pMatch;
          break;
        }

        // Người mua web không nhập tên -> Chấp nhận dùng tên khách cũ theo SĐT
        if (!customerName) {
          customer = pMatch;
          break;
        }
      }
    }

    // 4. Tìm theo Email (tương tự, chỉ nhận nếu tên tương đồng hoặc tài khoản web)
    if (!customer && customerEmail) {
      const emailMatches = customers.filter(c => (c.email || '').toLowerCase().trim() === customerEmail);
      for (const eMatch of emailMatches) {
        const eMatchName = (eMatch.name || '').toLowerCase().trim();
        const incomingLower = (customerName || '').toLowerCase().trim();

        if (isGenericName(eMatch.name) || !customerName) {
          customer = eMatch;
          break;
        }

        if (incomingLower && (eMatchName === incomingLower || eMatchName.includes(incomingLower) || incomingLower.includes(eMatchName))) {
          customer = eMatch;
          break;
        }
      }
    }

    let customerId;

    if (customer) {
      customerId = customer.id;
      // Cập nhật thông tin nếu khách cũ là generic
      if (customerName && !isGenericName(customerName) && isGenericName(customer.name)) {
        db.update('customers', customer.id, {
          name: customerName,
          phone: rawCustomerPhone || customer.phone || '',
          email: customerEmail || customer.email || '',
          address: customerAddress || customer.address || '',
          updatedAt: now()
        });
      } else if (!customerName || isGenericName(customerName)) {
        customerName = customer.name || 'Khách vãng lai';
      }
      customerBusinessName = customer.businessName || customerBusinessName || customerName;
    } else {
      // TẠO MỚI KHÁCH HÀNG CHUẨN 100% SCHEMA DUNVEX
      const newCustName = customerName || (rawCustomerPhone ? `Khách ${rawCustomerPhone}` : 'Khách Web');
      const newCust = db.create('customers', {
        ownerId,
        name: newCustName,
        businessName: customerBusinessName || newCustName,
        phone: rawCustomerPhone,
        email: customerEmail,
        address: customerAddress,
        type: 'Chủ nhà', // Chuẩn hóa phân loại "Chủ nhà" mặc định
        route: 'Khách đặt từ Website', // Tuyến bán hàng / Zoning
        note: 'Nguồn từ Website', // Ghi chú nguồn
        source: 'web',
        status: 'Hoạt động',
        creditLimit: 0,
        debt: 0,
        totalDebt: 0,
        totalOrders: 0,
        totalOrdersAmount: 0,
        totalPaymentsAmount: 0,
        licenseUrls: [],
        additionalImages: [],
        taxName: '',
        taxCode: '',
        taxAddress: '',
        taxPhone: '',
        ownerEmail: ownerEmail || '',
        createdByEmail: ownerEmail || 'web@dunvex.com',
        createdBy: ownerId,
        createdAt: now(),
        updatedAt: now()
      });
      customerId = newCust.id;
      customerName = newCust.name;
      customerBusinessName = newCust.businessName;
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

    const paidAmount = body.paidAmount !== undefined ? Number(body.paidAmount) : (body.isPaid ? totalAmount : 0);
    const debtAmount = Math.max(0, totalAmount - paidAmount);

    // Tạo đơn hàng
    const orderData = {
      ownerId,
      customerName,
      customerBusinessName: customerBusinessName || '',
      customerPhone: rawCustomerPhone,
      customerAddress: body.customerAddress || '',
      customerId: customerId || '',
      deliveryLocation: deliveryLocation || null,
      rawDeliveryLocation: rawDeliveryLocation || '',
      items: items.map(i => ({
        productId: i.productId,
        id: i.productId,
        name: i.name,
        category: i.category || '',
        qty: i.qty,
        price: i.price,
        buyPrice: i.buyPrice,
        unit: i.unit,
        weight: i.weight,
        imageUrl: i.imageUrl || ''
      })),
      products: items.map(i => ({
        id: i.productId,
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
      paidAmount,
      debtAmount,
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

    // Cập nhật công nợ và thống kê khách hàng
    if (customerId) {
      const cust = db.get('customers', customerId);
      if (cust) {
        const currentDebt = Number(cust.debt || cust.totalDebt || 0) + debtAmount;
        const totalOrders = Number(cust.totalOrders || 0) + 1;
        const totalOrdersAmount = Number(cust.totalOrdersAmount || 0) + totalAmount;
        const totalPaymentsAmount = Number(cust.totalPaymentsAmount || 0) + paidAmount;
        db.update('customers', customerId, {
          debt: currentDebt,
          totalDebt: currentDebt,
          totalOrders,
          totalOrdersAmount,
          totalPaymentsAmount,
          updatedAt: now()
        });
      }
    }

    // Telegram notification
    const chatId = keyDoc.telegramGroupChatId || keyDoc.telegramChatId;
    if (keyDoc.telegramBotToken && chatId && keyDoc.notifyNewOrder !== false) {
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
