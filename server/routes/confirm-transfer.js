import * as db from '../db.js';

function getExpireDate(planId, durationDays, durationMonths) {
  const expireDate = new Date();
  if (durationMonths) {
    expireDate.setMonth(expireDate.getMonth() + Number(durationMonths));
  } else if (durationDays) {
    expireDate.setDate(expireDate.getDate() + Number(durationDays));
  } else if (planId === "premium_yearly") {
    expireDate.setFullYear(expireDate.getFullYear() + 1);
  } else {
    expireDate.setMonth(expireDate.getMonth() + 1);
  }
  return expireDate;
}

export default async function handler(req, res) {
  const apiToken = process.env.NEXUS_WEBHOOK_TOKEN || "dunvex-nexus-2026";
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const authHeader = req.headers.authorization || req.headers["x-api-key"] || "";
  const token = req.body?.token || "";
  if (authHeader !== `Bearer ${apiToken}` && token !== apiToken) {
    console.warn("Unauthorized webhook call");
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const {
      requestId,
      ownerId,
      userEmail,
      planId,
      planName,
      amount,
      matchedAmount,
      transferCode,
      matchConfidence
    } = req.body;
    if (!requestId || !ownerId || !planId) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    console.log(`Confirming payment: ${transferCode} for ${planName} (${amount}đ) — confidence: ${matchConfidence}`);

    const now = new Date();
    const expireDate = getExpireDate(planId, req.body.durationDays, req.body.durationMonths);

    // Build batch: update payment_request + settings + notification
    const batchOps = [
      {
        type: 'update',
        collection: 'payment_requests',
        id: requestId,
        data: {
          status: "approved",
          handledAt: now.toISOString(),
          handledBy: "payment_matcher",
          matchedAmount: matchedAmount || amount,
          matchConfidence: matchConfidence || "auto"
        }
      },
      {
        type: 'update',
        collection: 'settings',
        id: ownerId,
        data: {
          subscriptionStatus: "active",
          isPro: true,
          planId: planId,
          paymentConfirmedAt: now.toISOString(),
          subscriptionExpiresAt: expireDate.toISOString(),
          manualLockOrders: false,
          manualLockDebts: false,
          manualLockSheets: false,
          manualLockAi: false,
          graceUntil: null
        }
      },
      {
        type: 'create',
        collection: 'notifications',
        id: Date.now().toString(),
        data: {
          userId: ownerId,
          title: "\u2705 THANH TO\u00c1N \u0110\u00c3 \u0110\u01af\u1ee2C X\u00c1C NH\u1eacN",
          body: `H\u1ec7 th\u1ed1ng \u0111\u00e3 t\u1ef1 \u0111\u1ed9ng x\u00e1c nh\u1eadn thanh to\u00e1n ${amount.toLocaleString("vi-VN")}\u0111 cho g\u00f3i ${planName || planId}. T\u1ea5t c\u1ea3 t\u00ednh n\u0103ng \u0111\u00e3 \u0111\u01b0\u1ee3c m\u1edf kho\u00e1!`,
          type: "success",
          priority: "high",
          read: false,
          createdAt: now.toISOString()
        }
      }
    ];

    // \ud83d\udd25 Cascade UNLOCK: t\u00ecm t\u1ea5t c\u1ea3 staff c\u00f3 ownerId === adminId v\u00e0 m\u1edf kh\u00f3a
    const allUsers = db.getAll('users') || [];
    const staffUnderAdmin = allUsers.filter(u =>
      u.ownerId === ownerId &&
      u.role !== 'admin' &&
      u.uid !== ownerId
    );
    for (const staff of staffUnderAdmin) {
      const staffUid = staff.uid || staff.id;
      const staffSettings = db.get('settings', staffUid);
      if (staffSettings) {
        batchOps.push({
          type: 'update',
          collection: 'settings',
          id: staffUid,
          data: {
            manualLockOrders: false,
            manualLockDebts: false,
            manualLockSheets: false,
            manualLockAi: false,
            subscriptionStatus: 'active',
            // X\u00f3a expiry ri\u00eang \u0111\u1ec3 staff k\u1ebf th\u1eeba t\u1eeb admin
            subscriptionExpiresAt: null,
            planId: null,
            isPro: null
          }
        });
      } else {
        batchOps.push({
          type: 'create',
          collection: 'settings',
          id: staffUid,
          data: { subscriptionStatus: 'active' }
        });
      }
      console.log(`[UNLOCK-CASCADE] Unlocked staff: ${staff.displayName || staff.email} (admin: ${ownerId?.slice(0,12)})`);
    }

    db.batchWrite(batchOps);

    console.log(`\u2705 Payment confirmed: ${requestId} \u2192 ${planName} for ${ownerId} + ${staffUnderAdmin.length} staff unlocked`);
    return res.status(200).json({
      success: true,
      message: `Payment confirmed for ${planName}`,
      requestId,
      ownerId,
      staffUnlocked: staffUnderAdmin.length
    });
  } catch (error) {
    console.error("confirm-transfer error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
