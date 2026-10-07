import crypto from 'node:crypto';
import * as db from '../db.js';
import { resolveSession } from '../auth-session.js';
import { sendStaffInviteEmail } from '../mail-helper.js';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, displayName, role, marketPointsRequired, ownerId, ownerEmail } = req.body;

  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    // 1. Verify the SQLite session and admin role.
    const session = resolveSession(idToken);
    if (!session) return res.status(401).json({ error: 'Phiên đăng nhập hết hạn.' });
    const adminDoc = session.user;
    if (!adminDoc || adminDoc.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const targetOwnerId = ownerId || adminDoc.ownerId || adminDoc.uid;
    const targetOwnerEmail = ownerEmail || adminDoc.ownerEmail || adminDoc.email;
    const existingUser = (db.getAll('users') || []).find(u => (u.email || '').toLowerCase().trim() === cleanEmail);
    const uid = existingUser?.uid || existingUser?.id || `usr_${crypto.randomUUID()}`;
    const userId = existingUser?.id || uid;
    const userData = {
      ...(existingUser || {}),
      uid,
      id: userId,
      displayName: displayName || email.split('@')[0],
      email: cleanEmail,
      password: hashPassword(password),
      photoURL: existingUser?.photoURL || `https://ui-avatars.com/api/?name=${email}&background=random`,
      role: role || 'sale',
      marketPointsRequired: Number(marketPointsRequired) || 1,
      ownerId: targetOwnerId,
      ownerEmail: targetOwnerEmail,
      status: 'active',
      createdAt: existingUser?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accessRights: existingUser?.accessRights || {
        dashboard: true,
        orders_view: true,
        orders_create: true,
        inventory_view: true,
        customers_manage: true,
        debts_manage: true,
        users_manage: false,
        admin: false,
        system_manage: false
      }
    };

    db.withTransaction(() => {
      if (existingUser) db.update('users', userId, userData);
      else db.create('users', userData, userId);

      const tempId = cleanEmail.replace(/\W/g, '_');
      db.remove('permissions', tempId);
      db.remove('permissions', cleanEmail);
      db.remove('permissions', tempId.toUpperCase());
    });

    // 2. Gửi email thông báo và lời mời gia nhập công ty
    let emailSent = false;
    try {
      const companySettings = db.getById('settings', targetOwnerId) || {};
      const companyName = companySettings.name || 'Dunvex Build';
      const inviterName = adminDoc.displayName || adminDoc.email?.split('@')[0] || 'Quản trị viên';

      await sendStaffInviteEmail({
        toEmail: cleanEmail,
        displayName: userData.displayName,
        role: userData.role,
        password: password,
        companyName,
        inviterName
      });
      emailSent = true;
      console.log(`[AUTH] Sent staff invite email to ${cleanEmail}`);
    } catch (mailErr) {
      console.warn(`[AUTH] Failed to send staff invite email to ${cleanEmail}:`, mailErr.message);
    }

    res.json({
      success: true,
      uid,
      emailSent,
      message: emailSent
        ? `Đã tạo tài khoản và gửi email lời mời trực tiếp đến ${cleanEmail}!`
        : `Đã tạo tài khoản nhân viên thành công!`
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
}
