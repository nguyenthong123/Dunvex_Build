import * as db from '../db.js';
import { sendTelegramMessage } from '../telegram-helper.js';

async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Load data from local DB
    await db.load();
    let processedCount = 0;
    let expiredLocked = 0;

    // ── STEP 0: Auto-lock expired users ──
    const allSettings = db.getAll('settings') || [];
    const allPkgs = db.getAll('subscription_packages') || [];
    const now = new Date();

    for (const settings of allSettings) {
      const expiresAt = settings.subscriptionExpiresAt;
      if (!expiresAt) continue;

      const expireDate = new Date(expiresAt);
      if (now <= expireDate) continue;

      // Chỉ khóa khi chưa bị khóa hoặc status khác 'expired'
      if (settings.manualLockOrders && settings.manualLockDebts &&
          settings.manualLockSheets && settings.manualLockAi &&
          settings.subscriptionStatus === 'expired') continue;

      console.log('[CRON-AUTO-LOCK] Locking admin:', settings.email || settings.name || settings.id?.slice(0,10),
        'expired:', expireDate.toISOString().slice(0,10));

      db.update('settings', settings.id, {
        manualLockOrders: true,
        manualLockDebts: true,
        manualLockSheets: true,
        manualLockAi: true,
        subscriptionStatus: 'expired',
        expiryEmailSent: true
      });
      expiredLocked++;

      // 🔥 Cascade: khóa tất cả staff thuộc admin này
      const allUsers = db.getAll('users') || [];
      const staffUnderAdmin = allUsers.filter(u => 
        u.ownerId === settings.id && 
        u.role !== 'admin' &&
        u.uid !== settings.id
      );
      for (const staff of staffUnderAdmin) {
        const staffSettings = db.get('settings', staff.uid || staff.id);
        if (staffSettings) {
          db.update('settings', staff.uid || staff.id, {
            manualLockOrders: true,
            manualLockDebts: true,
            manualLockSheets: true,
            manualLockAi: true,
            subscriptionStatus: 'expired'
          });
          console.log('[CRON-AUTO-LOCK] Cascaded to staff:', staff.displayName || staff.email, 'admin:', settings.id?.slice(0,12));
        }
      }

      if (!settings.expiryEmailSent && settings.email) {
        // const pkg = allPkgs.find(p => p.id === settings.planId);
        // sendExpiryEmail(settings.email, settings.name || '', pkg?.name || '', expiresAt).catch(() => {});
      }
    }
    console.log('[CRON] Expired users locked:', expiredLocked);
    // 📅 GMT+7 Vietnam timezone — báo cáo ngày hôm nay (cron chạy lúc 17h VN)
    const offset = 7 * 60 * 60 * 1e3;
    const vnTime = new Date(now.getTime() + offset);
    const dateStr = vnTime.toISOString().slice(0, 10); // "YYYY-MM-DD"

    const vnNow = new Date(now.getTime() + offset);
    // Lấy 0h của hôm nay (giờ VN)
    vnNow.setUTCHours(0, 0, 0, 0);
    const startOfDay = new Date(vnNow.getTime() - offset);
    // endOfDay để có range chính xác
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1e3);

    const allKeys = db.getAll('api_keys') || [];

    // Hỗ trợ n8n EOD workflow: action=list_owners
    if (req.query?.action === 'list_owners') {
      const activeOwners = allKeys
        .filter(k => k.telegramBotToken && k.telegramGroupChatId && k.enabled !== false && k.notifyEodReport !== false)
        .map(k => {
          const oId = k.ownerId || k.id;
          const p = db.get('profiles', oId);
          const u = db.get('users', oId);
          const s = db.get('settings', oId);
          return {
            ownerId: oId,
            name: p?.displayName || u?.displayName || u?.name || s?.adminName || s?.name || 'Xưởng',
            groupChatId: k.telegramGroupChatId
          };
        });
      return res.status(200).json({ success: true, count: activeOwners.length, owners: activeOwners });
    }

    const targetOwnerId = req.query?.ownerId;
    const filteredKeys = targetOwnerId
      ? allKeys.filter(k => (k.ownerId === targetOwnerId || k.id === targetOwnerId))
      : allKeys;

    for (const keyDoc of filteredKeys) {
      const ownerId = keyDoc.ownerId || keyDoc.id;
      const botToken = keyDoc.telegramBotToken;
      // 🎯 Ưu tiên gửi vào nhóm Telegram, fallback về chat cá nhân nếu không có nhóm
      const chatId = keyDoc.telegramGroupChatId || keyDoc.telegramChatId;
      const enabled = keyDoc.enabled !== false;
      const notifyEod = keyDoc.notifyEodReport !== false;

      if (!botToken || !chatId || !enabled || !notifyEod) continue;


      // 🛑 DEDUPLICATION CHECK: Skip if already successfully sent today
      try {
        const existingLogs = db.getAll('bot_report_logs', {
          where: [
            { field: 'ownerId', op: '==', value: ownerId },
            { field: 'type', op: '==', value: 'eod_report' },
            { field: 'dateStr', op: '==', value: dateStr },
            { field: 'success', op: '==', value: true }
          ]
        });
        if (existingLogs && existingLogs.length > 0) {
          console.log(`[CRON] Skip sending EOD report for owner ${ownerId} today - already sent at ${existingLogs[0].createdAt}`);
          continue;
        }
      } catch (err) {
        console.error('[CRON] Error checking EOD log:', err);
      }

      // Get owner info (Ưu tiên: profiles -> users -> settings)
      const profileDoc = db.get('profiles', ownerId);
      const userDoc = db.get('users', ownerId);
      const settingsDoc = db.get('settings', ownerId);
      const adminName = profileDoc?.displayName || userDoc?.displayName || userDoc?.name || settingsDoc?.adminName || settingsDoc?.name || "Admin";

      // Get all "Đơn chốt" orders for this owner
      const allOrders = db.getAll('orders') || [];
      const ownerOrders = allOrders.filter((o) => {
        if (o.ownerId !== ownerId) return false;
        if (o.status !== "Đơn chốt") return false;
        // Check if order is from today
        const orderDate = o.orderDate || o.createdAt;
        if (!orderDate) return false;
        const d = new Date(orderDate);
        return d >= startOfDay && d < endOfDay;
      });

      const revenueByStaff = {};
      const revenueByCustomer = {};
      let totalRevenue = 0;

      // Build UID -> displayName map from users and profiles collections
      const allUsers = db.getAll('users') || [];
      const allProfiles = db.getAll('profiles') || [];
      const userNameMap = {};
      for (const u of allUsers) {
        if (u.id && (u.displayName || u.name)) userNameMap[u.id] = u.displayName || u.name;
        if (u.uid && (u.displayName || u.name)) userNameMap[u.uid] = u.displayName || u.name;
      }
      for (const p of allProfiles) {
        if (p.id && p.displayName) userNameMap[p.id] = p.displayName;
        if (p.uid && p.displayName) userNameMap[p.uid] = p.displayName;
      }

      ownerOrders.forEach((o) => {
        const amount = Number(o.totalAmount || 0);
        // Ưu tiên lookup displayName mới nhất từ createdBy UID nếu có
        let staff = (o.createdBy && userNameMap[o.createdBy]) ? userNameMap[o.createdBy] : o.staffName;
        if (!staff) staff = "Admin";
        const customer = o.customerName || "Khách vãng lai";

        revenueByStaff[staff] = (revenueByStaff[staff] || 0) + amount;
        revenueByCustomer[customer] = (revenueByCustomer[customer] || 0) + amount;
        totalRevenue += amount;
      });

      // 💰 Tính công nợ khách hàng
      const allCustomers = db.getAll('customers') || [];
      const ownerCustomers = allCustomers.filter((c) => c.ownerId === ownerId);
      const debtorsRaw = ownerCustomers.filter((c) => Number(c.totalDebt ?? c.debt ?? 0) > 0);
      const debtors = [];
      for (const c of debtorsRaw) {
        let days = Number(c.debtDays || 0);

        try {
          // Find last order for this customer
          const customerOrders = allOrders.filter(
            (o) => o.ownerId === ownerId && o.customerId === c.id && o.status === "Đơn chốt"
          );
          customerOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

          // Find last payment for this customer
          const allPayments = db.getAll('payments') || [];
          const customerPayments = allPayments.filter(
            (p) => p.ownerId === ownerId && p.customerId === c.id
          );
          customerPayments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

          let lastTxTime = 0;
          if (customerOrders.length > 0 && customerOrders[0].createdAt) {
            lastTxTime = Math.max(lastTxTime, new Date(customerOrders[0].createdAt).getTime());
          }
          if (customerPayments.length > 0 && customerPayments[0].createdAt) {
            lastTxTime = Math.max(lastTxTime, new Date(customerPayments[0].createdAt).getTime());
          }

          if (lastTxTime > 0) {
            days = Math.floor((Date.now() - lastTxTime) / (1e3 * 60 * 60 * 24));
          }
        } catch (e) {
          console.error("Error fetching lastTx for debtor", c.id, e);
        }

        debtors.push({
          name: c.name || "",
          debt: Number(c.totalDebt ?? c.debt ?? 0),
          days
        });
      }
      debtors.sort((a, b) => b.debt - a.debt);

      // Supplier debts
      const allSuppliers = db.getAll('suppliers') || [];
      const ownerSuppliers = allSuppliers.filter((s) => s.ownerId === ownerId);
      const allSupplierDebts = db.getAll('supplier_debts') || [];
      const ownerSupplierDebts = allSupplierDebts.filter((d) => d.ownerId === ownerId);

      const supplierDebtors = [];
      for (const s of ownerSuppliers) {
        const sDebts = ownerSupplierDebts.filter((d) => d.supplierId === s.id);
        const netDebt = sDebts.reduce((sum, d) => {
          const amount = Number(d.amount || 0);
          if (d.type === "debt_increase") return sum + amount;
          if (d.type === "payment") return sum - amount;
          return sum;
        }, 0);

        if (netDebt > 0) {
          supplierDebtors.push({
            name: s.name || "",
            debt: netDebt
          });
        }
      }
      supplierDebtors.sort((a, b) => b.debt - a.debt);

      // Build report
      const fmtVND = (n) => n.toLocaleString("vi-VN") + "đ";

      let dataSection = `
💴 <b>TỔNG KẾT DOANH THU HÔM NAY</b>
`;
      dataSection += `💰 Tổng doanh thu: <b>${fmtVND(totalRevenue)}</b>
`;

      if (Object.keys(revenueByStaff).length > 0) {
        dataSection += `
👥 <i>Theo nhân viên:</i>
`;
        for (const [staff, amount] of Object.entries(revenueByStaff)) {
          dataSection += `  - ${staff}: ${fmtVND(amount)}
`;
        }
      }

      if (Object.keys(revenueByCustomer).length > 0) {
        dataSection += `
🛒 <i>Theo khách hàng:</i>
`;
        for (const [cust, amount] of Object.entries(revenueByCustomer)) {
          dataSection += `  - ${cust}: ${fmtVND(amount)}
`;
        }
      }

      if (totalRevenue === 0) {
        dataSection += `  Hôm nay chưa có đơn hàng nào.
`;
      }

      dataSection += `
📋 <b>CÔNG NỢ KHÁCH HÀNG</b>
`;
      if (debtors.length === 0) {
        dataSection += `  ✅ Tuyệt vời, không có khách nào nợ!
`;
      } else {
        const top5 = debtors.slice(0, 5);
        top5.forEach((d, i) => {
          dataSection += `  ${i + 1}. ${d.name}: <b>${fmtVND(d.debt)}</b> (${d.days} ngày)
`;
        });
        if (debtors.length > 5) {
          dataSection += `  <i>... và ${debtors.length - 5} khách nợ khác</i>
`;
        }
      }

      dataSection += `
🏭 <b>CÔNG NỢ NHÀ CUNG CẤP (Mình nợ NCC)</b>
`;
      if (supplierDebtors.length === 0) {
        dataSection += `  ✅ Không có khoản nợ NCC nào!
`;
      } else {
        supplierDebtors.forEach((s, i) => {
          dataSection += `  ${i + 1}. ${s.name}: <b>${fmtVND(s.debt)}</b>
`;
        });
      }

      // DeepSeek AI for greeting/closing
      const prompt = `Bạn là trợ lý AI (Telegram Bot) của phần mềm Dunvex Build, phục vụ sếp: ${adminName}.
Nhiệm vụ: Viết 1 LỜI CHÀO mở đầu và 1 LỜI KẾT cho báo cáo cuối ngày.

Thông tin tham khảo (KHÔNG viết lại số liệu, phần số liệu sẽ được chèn tự động):
- Doanh thu hôm nay: ${totalRevenue.toLocaleString("vi-VN")} đ
- Số đơn hàng: ${ownerOrders.length}
- Số khách đang nợ: ${debtors.length}

YÊU CẦU:
1. Dùng emoji phù hợp, lời văn kính trọng, thân thiện và động viên tinh thần.
2. BẮT BUỘC dùng HTML TAGS (Ví dụ: <b>chữ đậm</b>, <i>chữ nghiêng</i>).
3. TUYỆT ĐỐI KHÔNG DÙNG MARKDOWN (không dùng dấu * hay ** hay #).
4. TUYỆT ĐỐI KHÔNG liệt kê lại số liệu hay số tiền cụ thể.
5. Trả về ĐÚNG 2 dòng, phân cách bằng |||:
   Dòng 1: Lời chào mở đầu (1-2 câu)
   Dòng 2: Lời kết động viên (1-2 câu)
Ví dụ: 🌙 Chào sếp ${adminName}! Dưới đây là báo cáo cuối ngày ạ!|||💪 Chúc sếp nghỉ ngơi thật tốt, ngày mai tiếp tục chinh phục nhé! 🚀`;

      let greeting = `🌙 Chào sếp ${adminName}! Dưới đây là báo cáo cuối ngày ạ!`;
      let closing = `💪 Chúc sếp nghỉ ngơi thật tốt! 🚀`;

      const deepseekApiKey = process.env.DEEPSEEK_API_KEY || "sk-5ced935df4be41938479954151790443";
      try {
        if (deepseekApiKey) {
          const aiRes = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${deepseekApiKey}`
            },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: [{ role: "user", content: prompt }],
              temperature: 0.3
            })
          });
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const aiText = aiData.choices?.[0]?.message?.content?.trim() || "";
            const parts = aiText.split("|||");
            if (parts.length >= 2) {
              greeting = parts[0].trim();
              closing = parts[1].trim();
            } else if (aiText) {
              greeting = aiText;
            }
          }
        }
      } catch (e) {
        console.warn("DeepSeek greeting generation notice:", e.message);
      }

      const reportText = `${greeting}
${dataSection}
${closing}`;

      try {
        await sendTelegramMessage(botToken, chatId, reportText);
        processedCount++;
        try {
          db.create('bot_report_logs', {
            type: 'eod_report',
            ownerId,
            dateStr,
            chatId,
            success: true,
            content: reportText,
            createdAt: new Date().toISOString()
          });
        } catch (dbErr) {
          console.error('[CRON] Error logging EOD success to DB:', dbErr);
        }
      } catch (teleErr) {
        console.error("Telegram send EOD error:", teleErr.message);
        try {
          db.create('bot_report_logs', {
            type: 'eod_report',
            ownerId,
            dateStr,
            chatId,
            success: false,
            error: teleErr.message || 'Unknown error',
            content: reportText,
            createdAt: new Date().toISOString()
          });
        } catch (dbErr) {
          console.error('[CRON] Error logging EOD failure to DB:', dbErr);
        }
      }

      // ⏱️ PHÂN TẢI THÔNG MINH (Pacing Delay): Nghỉ 1s giữa các admin để tránh bị Telegram / DeepSeek Rate Limit khi có nhiều tài khoản
      if (filteredKeys.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return res.status(200).json({ success: true, processed: processedCount });
  } catch (error) {
    console.error("CRON EOD Error:", error);
    return res.status(500).json({ error: error.message || "Server Error" });
  }
}

export { handler as default };
