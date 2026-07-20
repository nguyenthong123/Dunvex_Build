import { getFirestore } from 'firebase-admin/firestore';

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

async function handler(req, res) {
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
    console.log(`Confirming payment: ${transferCode} for ${planName} (${amount}\u0111) \u2014 confidence: ${matchConfidence}`);

    const db = getFirestore();
    const now = new Date();
    const expireDate = getExpireDate(planId, req.body.durationDays, req.body.durationMonths);

    const batch = db.batch();

    // Update payment_request
    batch.set(db.collection("payment_requests").doc(requestId), {
      status: "approved",
      handledAt: now,
      handledBy: "payment_matcher",
      matchedAmount: matchedAmount || amount,
      matchConfidence: matchConfidence || "auto"
    }, { merge: true });

    // Update settings - unlock user
    batch.set(db.collection("settings").doc(ownerId), {
      subscriptionStatus: "active",
      isPro: true,
      planId: planId,
      paymentConfirmedAt: now,
      subscriptionExpiresAt: expireDate,
      manualLockOrders: false,
      manualLockDebts: false,
      manualLockSheets: false,
      manualLockAi: false,
      graceUntil: null
    }, { merge: true });

    // Create notification
    const notifRef = db.collection("notifications").doc();
    batch.set(notifRef, {
      userId: ownerId,
      title: "\u2705 THANH TO\xC1N \u0110\xC3 \u0110\u01AF\u1EE2C X\xC1C NH\u1EACN",
      body: `H\u1EC7 th\u1ED1ng \u0111\xE3 t\u1EF1 \u0111\u1ED9ng x\xE1c nh\u1EADn thanh to\xE1n ${amount.toLocaleString("vi-VN")}\u0111 cho g\xF3i ${planName || planId}. T\u1EA5t c\u1EA3 t\xEDnh n\u0103ng \u0111\xE3 \u0111\u01B0\u1EE3c m\u1EDF kho\xE1!`,
      type: "success",
      priority: "high",
      read: false,
      createdAt: now
    });

    await batch.commit();

    console.log(`\u2705 Payment confirmed: ${requestId} \u2192 ${planName} for ${ownerId}`);
    return res.status(200).json({
      success: true,
      message: `Payment confirmed for ${planName}`,
      requestId,
      ownerId
    });
  } catch (error) {
    console.error("confirm-transfer error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
export { handler as default };
