const FIRESTORE_PROJECT = "dunvex-89461";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents`;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "";
async function firestoreGet(path) {
  const url = `${FIRESTORE_BASE}/${path}?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Firestore GET ${path}: ${res.status}`);
  return res.json();
}
async function firestorePatch(path, fields) {
  const url = `${FIRESTORE_BASE}/${path}?updateMask.fieldPaths=${Object.keys(fields).join("&updateMask.fieldPaths=")}&key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error(`Firestore PATCH ${path}: ${res.status}`);
  return res.json();
}
function toTimestampValue(isoString) {
  return { timestampValue: isoString };
}
function toStringValue(val) {
  return { stringValue: val };
}
function toBooleanValue(val) {
  return { booleanValue: val };
}
function toNullValue() {
  return { nullValue: null };
}
function getExpireDate(planId) {
  const expireDate = /* @__PURE__ */ new Date();
  if (planId === "premium_yearly") {
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
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const expireDate = getExpireDate(planId);
    await firestorePatch(`payment_requests/${requestId}`, {
      status: toStringValue("approved"),
      handledAt: toTimestampValue(now),
      handledBy: toStringValue("AppScript_Bank_Matcher"),
      matchedAmount: { integerValue: String(matchedAmount || amount) },
      matchConfidence: toStringValue(matchConfidence || "auto")
    });
    await firestorePatch(`settings/${ownerId}`, {
      subscriptionStatus: toStringValue("active"),
      isPro: toBooleanValue(true),
      planId: toStringValue(planId),
      paymentConfirmedAt: toTimestampValue(now),
      subscriptionExpiresAt: toTimestampValue(expireDate.toISOString()),
      manualLockOrders: toBooleanValue(false),
      manualLockDebts: toBooleanValue(false),
      manualLockSheets: toBooleanValue(false),
      manualLockAi: toBooleanValue(false),
      graceUntil: toNullValue()
    });
    const notifRes = await fetch(
      `${FIRESTORE_BASE}/notifications?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            userId: toStringValue(ownerId),
            title: toStringValue("\u2705 THANH TO\xC1N \u0110\xC3 \u0110\u01AF\u1EE2C X\xC1C NH\u1EACN"),
            body: toStringValue(`H\u1EC7 th\u1ED1ng \u0111\xE3 t\u1EF1 \u0111\u1ED9ng x\xE1c nh\u1EADn thanh to\xE1n ${amount.toLocaleString("vi-VN")}\u0111 cho g\xF3i ${planName || planId}. T\u1EA5t c\u1EA3 t\xEDnh n\u0103ng \u0111\xE3 \u0111\u01B0\u1EE3c m\u1EDF kho\xE1!`),
            type: toStringValue("success"),
            priority: toStringValue("high"),
            read: toBooleanValue(false),
            createdAt: toTimestampValue(now)
          }
        })
      }
    );
    if (!notifRes.ok) {
      console.error("Failed to create notification:", await notifRes.text());
    }
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
export {
  handler as default
};
