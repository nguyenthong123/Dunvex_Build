import type { VercelRequest, VercelResponse } from '@vercel/node';

// Firestore REST API helpers (server-side)
const FIRESTORE_PROJECT = 'dunvex-89461';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents`;

// Lấy Firebase API Key từ env
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || '';

async function firestoreGet(path: string) {
    const url = `${FIRESTORE_BASE}/${path}?key=${FIREBASE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Firestore GET ${path}: ${res.status}`);
    return res.json();
}

async function firestorePatch(path: string, fields: Record<string, any>) {
    const url = `${FIRESTORE_BASE}/${path}?updateMask.fieldPaths=${Object.keys(fields).join('&updateMask.fieldPaths=')}&key=${FIREBASE_API_KEY}`;
    const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
    });
    if (!res.ok) throw new Error(`Firestore PATCH ${path}: ${res.status}`);
    return res.json();
}

function toTimestampValue(isoString: string) {
    return { timestampValue: isoString };
}

function toStringValue(val: string) {
    return { stringValue: val };
}

function toBooleanValue(val: boolean) {
    return { booleanValue: val };
}

function toNullValue() {
    return { nullValue: null };
}

function getExpireDate(planId: string): Date {
    const expireDate = new Date();
    if (planId === 'premium_yearly') {
        expireDate.setFullYear(expireDate.getFullYear() + 1);
    } else {
        expireDate.setMonth(expireDate.getMonth() + 1);
    }
    return expireDate;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const apiToken = process.env.NEXUS_WEBHOOK_TOKEN || 'dunvex-nexus-2026';

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Auth check
    const authHeader = req.headers.authorization || req.headers['x-api-key'] || '';
    const token = req.body?.token || '';
    if (authHeader !== `Bearer ${apiToken}` && token !== apiToken) {
        console.warn('Unauthorized webhook call');
        return res.status(401).json({ error: 'Unauthorized' });
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
            matchConfidence,
        } = req.body;

        if (!requestId || !ownerId || !planId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        console.log(`Confirming payment: ${transferCode} for ${planName} (${amount}đ) — confidence: ${matchConfidence}`);

        const now = new Date().toISOString();
        const expireDate = getExpireDate(planId);

        // 1. Update payment_request → approved
        await firestorePatch(`payment_requests/${requestId}`, {
            status: toStringValue('approved'),
            handledAt: toTimestampValue(now),
            handledBy: toStringValue('AppScript_Bank_Matcher'),
            matchedAmount: { integerValue: String(matchedAmount || amount) },
            matchConfidence: toStringValue(matchConfidence || 'auto'),
        });

        // 2. Update settings → mở khoá + active
        await firestorePatch(`settings/${ownerId}`, {
            subscriptionStatus: toStringValue('active'),
            isPro: toBooleanValue(true),
            planId: toStringValue(planId),
            paymentConfirmedAt: toTimestampValue(now),
            subscriptionExpiresAt: toTimestampValue(expireDate.toISOString()),
            manualLockOrders: toBooleanValue(false),
            manualLockDebts: toBooleanValue(false),
            manualLockSheets: toBooleanValue(false),
            manualLockAi: toBooleanValue(false),
            graceUntil: toNullValue(),
        });

        // 3. Tạo notification
        const notifRes = await fetch(
            `${FIRESTORE_BASE}/notifications?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fields: {
                        userId: toStringValue(ownerId),
                        title: toStringValue('✅ THANH TOÁN ĐÃ ĐƯỢC XÁC NHẬN'),
                        body: toStringValue(`Hệ thống đã tự động xác nhận thanh toán ${amount.toLocaleString('vi-VN')}đ cho gói ${planName || planId}. Tất cả tính năng đã được mở khoá!`),
                        type: toStringValue('success'),
                        priority: toStringValue('high'),
                        read: toBooleanValue(false),
                        createdAt: toTimestampValue(now),
                    },
                }),
            }
        );

        if (!notifRes.ok) {
            console.error('Failed to create notification:', await notifRes.text());
        }

        console.log(`✅ Payment confirmed: ${requestId} → ${planName} for ${ownerId}`);
        return res.status(200).json({
            success: true,
            message: `Payment confirmed for ${planName}`,
            requestId,
            ownerId,
        });
    } catch (error: any) {
        console.error('confirm-transfer error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
