import express from 'express';
import crypto from 'crypto';
import * as db from '../db.js';
import { sendOtpEmail, sendRegistrationOtpEmail } from '../mail-helper.js';
import { createSession, resolveSession, revokeSession, revokeUserSessions } from '../auth-session.js';

const router = express.Router();

function requireSQLiteSession(req, res, next) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const session = resolveSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.' });
  }
  req.sqliteSession = session;
  next();
}

// Helper: Mã hóa mật khẩu bằng crypto.scryptSync (salt + hash)
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

// Helper: Kiểm tra mật khẩu (hỗ trợ cả hash scrypt và mật khẩu plaintext cũ)
function verifyPassword(password, storedPassword) {
  if (!storedPassword) return false;
  // Mật khẩu cũ chưa mã hóa (plaintext) — chỉ so sánh exact match
  if (!storedPassword.includes(':')) {
    return password === storedPassword;
  }
  // Mật khẩu đã mã hóa scrypt — verify bằng salt + hash
  const [salt, originalHash] = storedPassword.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === originalHash;
}

/**
 * GET /api/auth/status
 * Kiểm tra xem tài khoản đã có mật khẩu mã hóa trong SQLite hay chưa
 */
router.get('/status', (req, res) => {
  const { email, uid } = req.query;
  if (!email && !uid) return res.status(400).json({ error: 'Missing email or uid' });
  const cleanEmail = String(email || '').toLowerCase().trim();
  const allUsers = db.getAll('users') || [];
  const user = allUsers.find(u => (uid && (u.uid === uid || u.id === uid)) || (cleanEmail && (u.email || '').toLowerCase().trim() === cleanEmail));
  const hasPassword = !!(user && user.password);
  res.json({
    hasPassword,
    updatedAt: user?.updatedAt || null
  });
});

/**
 * POST /api/auth/set-password
 * Lưu và mã hóa mật khẩu vào CSDL SQLite (dunvex.db)
 */
router.post('/set-password', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
  }

  const cleanEmail = String(email).toLowerCase().trim();

  try {
    const passwordHash = hashPassword(password);
    const allUsers = db.getAll('users') || [];
    const user = allUsers.find(u => (u.email || '').toLowerCase().trim() === cleanEmail);
    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const session = resolveSession(token);

    if (user) {
      if (!session || session.user.uid !== (user.uid || user.id)) {
        return res.status(401).json({ error: 'Vui lòng đăng nhập đúng tài khoản; nếu quên mật khẩu hãy dùng OTP.' });
      }
      user.password = passwordHash;
      user.updatedAt = new Date().toISOString();
      db.update('users', user.id || user.uid, user);
    } else {
      const permissions = db.getAll('permissions') || [];
      const permission = permissions.find(p => (p.email || '').toLowerCase().trim() === cleanEmail);
      if (!permission) {
        return res.status(404).json({ error: 'Email chưa được mời vào hệ thống. Vui lòng liên hệ quản trị viên.' });
      }
      const id = `usr_${crypto.randomUUID()}`;
      const newUser = {
        id,
        uid: id,
        email: cleanEmail,
        password: passwordHash,
        displayName: permission?.displayName || cleanEmail.split('@')[0],
        role: permission.role || 'sale',
        ownerId: permission.ownerId,
        ownerEmail: permission.ownerEmail,
        status: 'active',
        accessRights: permission.accessRights,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.withTransaction(() => {
        db.create('users', newUser, newUser.id);
        db.remove('permissions', permission.id);
      });
    }

    res.json({
      success: true,
      message: 'Đã mã hóa và lưu mật khẩu vào SQLite CSDL thành công!'
    });
  } catch (err) {
    console.error('set-password error:', err);
    res.status(500).json({ error: err.message || 'Lỗi lưu mật khẩu' });
  }
});

/**
 * POST /api/auth/update-profile
 * Cập nhật tên hiển thị / SĐT trong SQLite (users, profiles)
 */
router.post('/update-profile', requireSQLiteSession, async (req, res) => {
  const { displayName, phone } = req.body;
  const uid = req.sqliteSession.user.uid;

  if (!uid) {
    return res.status(400).json({ error: 'Thiếu uid người dùng' });
  }

  const cleanName = displayName ? String(displayName).trim() : '';
  const cleanPhone = phone ? String(phone).trim() : '';

  try {
    // 1. Cập nhật bảng 'users' trong SQLite
    const allUsers = db.getAll('users') || [];
    let user = allUsers.find(u => u.uid === uid || u.id === uid);
    if (user) {
      if (cleanName) {
        user.displayName = cleanName;
        user.name = cleanName;
      }
      if (cleanPhone) user.phone = cleanPhone;
      user.updatedAt = new Date().toISOString();
      db.update('users', user.id || user.uid, user);
    }

    // 2. Cập nhật bảng 'profiles' trong SQLite
    const allProfiles = db.getAll('profiles') || [];
    let profile = allProfiles.find(p => p.id === uid || p.uid === uid);
    if (profile) {
      if (cleanName) {
        profile.displayName = cleanName;
        profile.name = cleanName;
      }
      if (cleanPhone) profile.phone = cleanPhone;
      profile.updatedAt = new Date().toISOString();
      db.update('profiles', profile.id || profile.uid, profile);
    } else {
      db.create('profiles', {
        id: uid,
        uid: uid,
        displayName: cleanName,
        name: cleanName,
        phone: cleanPhone,
        updatedAt: new Date().toISOString()
      }, uid);
    }

    res.json({
      success: true,
      message: 'Cập nhật hồ sơ thành công!'
    });
  } catch (err) {
    console.error('update-profile error:', err);
    res.status(500).json({ error: err.message || 'Lỗi cập nhật hồ sơ' });
  }
});

/**
 * POST /api/auth/login
 * Đăng nhập trực tiếp qua dữ liệu tài khoản lưu trên VPS
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ Email và Mật khẩu' });
  }

  const cleanEmail = String(email).toLowerCase().trim();

  try {
    const allUsers = db.getAll('users') || [];
    let user = allUsers.find(u => (u.email || '').toLowerCase().trim() === cleanEmail);

    // Nếu chưa có trong users, kiểm tra xem có lời mời trong permissions không
    if (!user) {
      const allPerms = db.getAll('permissions') || [];
      const perm = allPerms.find(p => (p.email || '').toLowerCase().trim() === cleanEmail);
      if (perm) {
        const id = `usr_${crypto.randomUUID()}`;
        user = {
          uid: id,
          id,
          displayName: perm.displayName || cleanEmail.split('@')[0],
          email: cleanEmail,
          role: perm.role || 'sale',
          marketPointsRequired: perm.marketPointsRequired || 1,
          ownerId: perm.ownerId,
          ownerEmail: perm.ownerEmail,
          status: 'active',
          password: hashPassword(password),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        db.withTransaction(() => {
          db.create('users', user, user.id);
          db.remove('permissions', perm.id);
        });
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'Tài khoản chưa được đăng ký trong hệ thống. Vui lòng liên hệ Quản trị viên.' });
    }

    // Kiểm tra mật khẩu mã hóa scrypt
    if (!verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Mật khẩu không chính xác' });
    }

    if (!user.password.includes(':')) {
      user.password = hashPassword(password);
      user.updatedAt = new Date().toISOString();
      db.update('users', user.id || user.uid, user);
    }

    const authUid = user.uid || user.id;
    if (!user.uid) {
      user.uid = authUid;
      db.update('users', user.id || authUid, user);
    }
    const session = createSession({ ...user, uid: authUid });

    res.json({
      success: true,
      sessionToken: session.token,
      expiresAt: session.expiresAt,
      user: session.user
    });

  } catch (err) {
    console.error('Auth login error:', err);
    res.status(500).json({ error: err.message || 'Lỗi xử lý đăng nhập' });
  }
});

/**
 * POST /api/auth/send-otp
 * Tạo mã xác thực 6 số và gửi qua email dunvex.green@gmail.com
 * Hỗ trợ type: 'reset_password' (mặc định) hoặc 'register'
 */
router.post('/send-otp', async (req, res) => {
  const { email, type = 'reset_password' } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Vui lòng cung cấp địa chỉ email hợp lệ' });
  }

  const cleanEmail = String(email).toLowerCase().trim();

  try {
    const allUsers = db.getAll('users') || [];
    const allPerms = db.getAll('permissions') || [];
    const user = allUsers.find(u => (u.email || '').toLowerCase().trim() === cleanEmail) ||
                 allPerms.find(p => (p.email || '').toLowerCase().trim() === cleanEmail);

    if (type === 'register') {
      // Khi đăng ký mới: Nếu email đã tồn tại trong users và đã có mật khẩu, báo lỗi đã có tài khoản
      if (user && user.password) {
        return res.status(400).json({ error: 'Email này đã được đăng ký tài khoản. Vui lòng đăng nhập hoặc chọn Quên mật khẩu.' });
      }
    } else {
      // Khi quên mật khẩu: Bắt buộc tài khoản phải tồn tại
      if (!user) {
        return res.status(404).json({ error: 'Không tìm thấy tài khoản với email này trong hệ thống' });
      }
    }

    // 2. Chống Spam (Rate Limiting: 60 giây giữa các lần gửi cho cùng 1 email)
    const existingOtps = (db.getAll('password_otps') || []).filter(
      o => (o.email || '').toLowerCase().trim() === cleanEmail && !o.used
    );

    const now = Date.now();
    const recentOtp = existingOtps.find(o => {
      const createdTime = new Date(o.createdAt).getTime();
      return (now - createdTime) < 60 * 1000;
    });

    if (recentOtp) {
      const waitSeconds = Math.ceil((60 * 1000 - (now - new Date(recentOtp.createdAt).getTime())) / 1000);
      return res.status(429).json({ error: `Vui lòng đợi ${waitSeconds} giây trước khi yêu cầu gửi lại mã mới.` });
    }

    // 3. Tạo mã ngẫu nhiên 6 chữ số và thời hạn 5 phút
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(now + 5 * 60 * 1000).toISOString();
    const otpRecord = {
      id: 'otp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      email: cleanEmail,
      otp,
      type,
      expiresAt,
      attempts: 0,
      used: 0,
      createdAt: new Date().toISOString()
    };

    db.create('password_otps', otpRecord, otpRecord.id);

    // 4. Gửi email qua mail-helper
    try {
      if (type === 'register') {
        await sendRegistrationOtpEmail(cleanEmail, otp);
        console.log(`[AUTH] Sent registration OTP to ${cleanEmail}`);
      } else {
        await sendOtpEmail(cleanEmail, otp);
        console.log(`[AUTH] Sent password reset OTP to ${cleanEmail}`);
      }
    } catch (mailErr) {
      console.error('[AUTH] sendOtpEmail error:', mailErr);
      return res.status(500).json({
        error: 'Lỗi gửi email: ' + (mailErr.message || 'Không thể gửi email qua Gmail SMTP. Vui lòng kiểm tra SMTP_PASS trong .env.')
      });
    }

    res.json({
      success: true,
      message: `Đã gửi mã xác thực OTP 6 số đến email ${cleanEmail}. Vui lòng kiểm tra hộp thư.`
    });

  } catch (err) {
    console.error('send-otp error:', err);
    res.status(500).json({ error: err.message || 'Lỗi xử lý yêu cầu gửi OTP' });
  }
});

/**
 * POST /api/auth/verify-register
 * Xác thực mã OTP và hoàn tất đăng ký tài khoản mới trong SQLite
 */
router.post('/verify-register', async (req, res) => {
  const { email, otp, password, displayName } = req.body;

  if (!email || !otp || !password) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ Email, mã OTP và Mật khẩu' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
  }

  const cleanEmail = String(email).toLowerCase().trim();
  const cleanOtp = String(otp).trim();

  try {
    const allOtps = db.getAll('password_otps') || [];
    const validOtps = allOtps
      .filter(o => (o.email || '').toLowerCase().trim() === cleanEmail && !o.used)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const activeOtp = validOtps[0];

    if (!activeOtp) {
      return res.status(400).json({ error: 'Mã xác thực không hợp lệ hoặc đã được sử dụng. Vui lòng yêu cầu mã mới.' });
    }

    if (Date.now() > new Date(activeOtp.expiresAt).getTime()) {
      return res.status(400).json({ error: 'Mã xác thực đã hết hạn (5 phút). Vui lòng yêu cầu mã mới.' });
    }

    if (activeOtp.attempts >= 5) {
      return res.status(400).json({ error: 'Mã xác thực đã bị khóa do nhập sai quá 5 lần. Vui lòng yêu cầu mã mới.' });
    }

    if (activeOtp.otp !== cleanOtp) {
      activeOtp.attempts = (activeOtp.attempts || 0) + 1;
      db.update('password_otps', activeOtp.id, activeOtp);
      const remaining = 5 - activeOtp.attempts;
      return res.status(400).json({
        error: `Mã OTP không chính xác. Bạn còn ${remaining} lần thử.`
      });
    }

    activeOtp.used = 1;
    activeOtp.updatedAt = new Date().toISOString();
    db.update('password_otps', activeOtp.id, activeOtp);

    const passwordHash = hashPassword(password);
    const allUsers = db.getAll('users') || [];
    let user = allUsers.find(u => (u.email || '').toLowerCase().trim() === cleanEmail);

    if (user) {
      user.password = passwordHash;
      if (displayName) user.displayName = displayName;
      user.updatedAt = new Date().toISOString();
      db.update('users', user.id || user.uid, user);
    } else {
      const allPerms = db.getAll('permissions') || [];
      const perm = allPerms.find(p => (p.email || '').toLowerCase().trim() === cleanEmail);
      const id = `usr_${crypto.randomUUID()}`;
      user = {
        id,
        uid: id,
        email: cleanEmail,
        password: passwordHash,
        displayName: displayName || perm?.displayName || cleanEmail.split('@')[0],
        role: perm?.role || 'sale',
        ownerId: perm?.ownerId || id,
        ownerEmail: perm?.ownerEmail || cleanEmail,
        status: 'active',
        marketPointsRequired: perm?.marketPointsRequired || 1,
        accessRights: perm?.accessRights || {
          dashboard: true,
          orders_view: true,
          orders_create: true,
          inventory_view: true,
          customers_manage: true,
          debts_manage: true,
          users_manage: false,
          admin: false,
          system_manage: false
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.withTransaction(() => {
        db.create('users', user, user.id);
        if (perm) db.remove('permissions', perm.id);
      });
    }

    const authUid = user.uid || user.id;
    revokeUserSessions(user.id || authUid);
    const session = createSession({ ...user, uid: authUid });

    res.json({
      success: true,
      message: 'Xác thực OTP và đăng ký tài khoản thành công!',
      sessionToken: session.token,
      expiresAt: session.expiresAt,
      user: session.user
    });

  } catch (err) {
    console.error('verify-register error:', err);
    res.status(500).json({ error: err.message || 'Lỗi xử lý xác thực đăng ký' });
  }
});

/**
 * POST /api/auth/verify-reset-password
 * Xác thực mã OTP và cập nhật mật khẩu mới trong SQLite
 */
router.post('/verify-reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ Email, mã OTP và Mật khẩu mới' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
  }

  const cleanEmail = String(email).toLowerCase().trim();
  const cleanOtp = String(otp).trim();

  try {
    const allOtps = db.getAll('password_otps') || [];
    const validOtps = allOtps
      .filter(o => (o.email || '').toLowerCase().trim() === cleanEmail && !o.used)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const activeOtp = validOtps[0];

    if (!activeOtp) {
      return res.status(400).json({ error: 'Mã xác thực không hợp lệ hoặc đã được sử dụng. Vui lòng yêu cầu mã mới.' });
    }

    // Kiểm tra hết hạn (5 phút)
    if (Date.now() > new Date(activeOtp.expiresAt).getTime()) {
      return res.status(400).json({ error: 'Mã xác thực đã hết hạn (5 phút). Vui lòng yêu cầu mã mới.' });
    }

    // Kiểm tra số lần nhập sai (tối đa 5 lần)
    if (activeOtp.attempts >= 5) {
      return res.status(400).json({ error: 'Mã xác thực đã bị khóa do nhập sai quá 5 lần. Vui lòng yêu cầu mã mới.' });
    }

    // Kiểm tra mã OTP
    if (activeOtp.otp !== cleanOtp) {
      activeOtp.attempts = (activeOtp.attempts || 0) + 1;
      db.update('password_otps', activeOtp.id, activeOtp);
      const remaining = 5 - activeOtp.attempts;
      return res.status(400).json({
        error: `Mã OTP không chính xác. Bạn còn ${remaining} lần thử.`
      });
    }

    // Đánh dấu OTP đã sử dụng
    activeOtp.used = 1;
    activeOtp.updatedAt = new Date().toISOString();
    db.update('password_otps', activeOtp.id, activeOtp);

    // Cập nhật mật khẩu mã hóa scrypt vào SQLite
    const passwordHash = hashPassword(newPassword);
    const allUsers = db.getAll('users') || [];
    let user = allUsers.find(u => (u.email || '').toLowerCase().trim() === cleanEmail);

    if (user) {
      user.password = passwordHash;
      user.updatedAt = new Date().toISOString();
      db.update('users', user.id || user.uid, user);
    } else {
      // Nếu là tài khoản trong permissions
      const allPerms = db.getAll('permissions') || [];
      const perm = allPerms.find(p => (p.email || '').toLowerCase().trim() === cleanEmail);
      if (perm) {
        const id = `usr_${Date.now()}`;
        user = {
          uid: id,
          id,
          displayName: perm.displayName || cleanEmail.split('@')[0],
          email: cleanEmail,
          role: perm.role || 'sale',
          marketPointsRequired: perm.marketPointsRequired || 1,
          ownerId: perm.ownerId,
          ownerEmail: perm.ownerEmail,
          status: 'active',
          password: passwordHash,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        db.create('users', user, user.uid);
        db.remove('permissions', perm.id);
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản để cập nhật mật khẩu.' });
    }

    const authUid = user.uid || user.id;
    const userId = user.id || authUid;
    revokeUserSessions(userId);
    const session = createSession({ ...user, uid: authUid });

    res.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công! Hệ thống đang tự động đăng nhập...',
      sessionToken: session.token,
      expiresAt: session.expiresAt,
      user: session.user
    });

  } catch (err) {
    console.error('verify-reset-password error:', err);
    res.status(500).json({ error: err.message || 'Lỗi cập nhật mật khẩu mới' });
  }
});

router.get('/session', requireSQLiteSession, (req, res) => {
  res.json({
    success: true,
    user: req.sqliteSession.user,
    expiresAt: req.sqliteSession.expiresAt,
  });
});

router.post('/logout', (req, res) => {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  revokeSession(token);
  res.json({ success: true });
});

export default router;
