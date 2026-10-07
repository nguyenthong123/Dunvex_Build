import nodemailer from 'nodemailer';

/**
 * Cấu hình Transporter gửi email qua Nodemailer
 * Mặc định sử dụng Gmail SMTP với tài khoản dunvex.green@gmail.com
 */
export function getMailTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE !== 'false'; // true cho cổng 465 (SSL), false cho 587 (TLS)
  const user = process.env.SMTP_USER || 'dunvex.green@gmail.com';
  const pass = process.env.SMTP_PASS || '';

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false // Tránh lỗi self-signed cert trên một số môi trường VPS
    }
  });
}

/**
 * Gửi email chứa mã OTP đặt lại mật khẩu cho khách hàng
 * @param {string} toEmail - Email nhận
 * @param {string} otp - Mã 6 số OTP
 * @returns {Promise<any>}
 */
export async function sendOtpEmail(toEmail, otp) {
  const user = process.env.SMTP_USER || 'dunvex.green@gmail.com';
  const fromName = process.env.SMTP_FROM || `"Dunvex Build" <${user}>`;
  const transporter = getMailTransporter();

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Mã OTP Đặt Lại Mật Khẩu - Dunvex Build</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
        .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #0A0E2E 0%, #1A237E 100%); padding: 36px 30px; text-align: center; }
        .logo { font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: 2px; text-transform: uppercase; margin: 0; }
        .tagline { color: #94a3b8; font-size: 11px; margin-top: 6px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
        .content { padding: 36px 32px; }
        .title { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 12px; }
        .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
        .otp-box { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 16px; padding: 20px; text-align: center; margin-bottom: 24px; }
        .otp-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 8px; }
        .otp-code { font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #1A237E; margin: 0; font-family: 'Courier New', Courier, monospace; }
        .warning-box { background: #fff7ed; border-left: 4px solid #f97316; padding: 14px 16px; border-radius: 8px; margin-bottom: 24px; }
        .warning-text { font-size: 12px; line-height: 1.5; color: #9a3412; margin: 0; font-weight: 600; }
        .footer { background: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #f1f5f9; }
        .footer-text { font-size: 11px; color: #94a3b8; line-height: 1.5; margin: 4px 0; }
        .footer-link { color: #1A237E; text-decoration: none; font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo">DUNVEX BUILD</h1>
          <p class="tagline">Hệ thống Quản lý Doanh nghiệp & Vật liệu xây dựng</p>
        </div>
        <div class="content">
          <h2 class="title">Xác nhận Đặt lại Mật khẩu 🔐</h2>
          <p class="desc">
            Xin chào,<br>
            Hệ thống nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>${toEmail}</strong> trên ứng dụng Dunvex Build. Vui lòng sử dụng mã OTP dưới đây để hoàn tất:
          </p>

          <div class="otp-box">
            <div class="otp-label">Mã xác thực của bạn</div>
            <div class="otp-code">${otp}</div>
          </div>

          <div class="warning-box">
            <p class="warning-text">
              ⏱️ <strong>Lưu ý:</strong> Mã xác thực có hiệu lực trong <strong>5 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai, kể cả nhân viên hỗ trợ kỹ thuật.
            </p>
          </div>

          <p class="desc" style="font-size: 13px; color: #64748b; margin-bottom: 0;">
            Nếu bạn không yêu cầu đổi mật khẩu, vui lòng bỏ qua email này. Tài khoản của bạn vẫn được bảo vệ an toàn.
          </p>
        </div>

        <div class="footer">
          <p class="footer-text">© 2026 Dunvex Build • All Rights Reserved</p>
          <p class="footer-text">Hỗ trợ kỹ thuật 24/7: <a href="mailto:dunvex.green@gmail.com" class="footer-link">dunvex.green@gmail.com</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: fromName,
    to: toEmail,
    subject: `[Dunvex Build] Mã OTP đặt lại mật khẩu: ${otp}`,
    text: `Mã OTP đặt lại mật khẩu Dunvex Build của bạn là: ${otp}. Mã có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.`,
    html: htmlContent,
  };

  return transporter.sendMail(mailOptions);
}

/**
 * Gửi email chứa mã OTP xác thực đăng ký tài khoản mới
 * @param {string} toEmail - Email nhận
 * @param {string} otp - Mã 6 số OTP
 * @returns {Promise<any>}
 */
export async function sendRegistrationOtpEmail(toEmail, otp) {
  const user = process.env.SMTP_USER || 'dunvex.green@gmail.com';
  const fromName = process.env.SMTP_FROM || `"Dunvex Build" <${user}>`;
  const transporter = getMailTransporter();

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Mã OTP Xác Thực Đăng Ký Tài Khoản - Dunvex Build</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
        .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #0A0E2E 0%, #1A237E 100%); padding: 36px 30px; text-align: center; }
        .logo { font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: 2px; text-transform: uppercase; margin: 0; }
        .tagline { color: #94a3b8; font-size: 11px; margin-top: 6px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
        .content { padding: 36px 32px; }
        .title { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 12px; }
        .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
        .otp-box { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 16px; padding: 20px; text-align: center; margin-bottom: 24px; }
        .otp-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 8px; }
        .otp-code { font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #1A237E; margin: 0; font-family: 'Courier New', Courier, monospace; }
        .warning-box { background: #fff7ed; border-left: 4px solid #f97316; padding: 14px 16px; border-radius: 8px; margin-bottom: 24px; }
        .warning-text { font-size: 12px; line-height: 1.5; color: #9a3412; margin: 0; font-weight: 600; }
        .footer { background: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #f1f5f9; }
        .footer-text { font-size: 11px; color: #94a3b8; line-height: 1.5; margin: 4px 0; }
        .footer-link { color: #1A237E; text-decoration: none; font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo">DUNVEX BUILD</h1>
          <p class="tagline">Hệ thống Quản lý Doanh nghiệp & Vật liệu xây dựng</p>
        </div>
        <div class="content">
          <h2 class="title">Xác Thực Đăng Ký Tài Khoản Mới ✨</h2>
          <p class="desc">
            Chào mừng bạn đến với Dunvex Build!<br>
            Bạn vừa yêu cầu đăng ký tài khoản với địa chỉ email <strong>${toEmail}</strong>. Vui lòng nhập mã OTP dưới đây để xác thực email thật và kích hoạt tài khoản:
          </p>

          <div class="otp-box">
            <div class="otp-label">Mã xác thực đăng ký</div>
            <div class="otp-code">${otp}</div>
          </div>

          <div class="warning-box">
            <p class="warning-text">
              ⏱️ <strong>Lưu ý:</strong> Mã xác thực có hiệu lực trong <strong>5 phút</strong>. Vui lòng không chia sẻ mã này cho người khác.
            </p>
          </div>

          <p class="desc" style="font-size: 13px; color: #64748b; margin-bottom: 0;">
            Nếu bạn không thực hiện đăng ký tài khoản này, vui lòng bỏ qua email.
          </p>
        </div>

        <div class="footer">
          <p class="footer-text">© 2026 Dunvex Build • All Rights Reserved</p>
          <p class="footer-text">Hỗ trợ kỹ thuật 24/7: <a href="mailto:dunvex.green@gmail.com" class="footer-link">dunvex.green@gmail.com</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: fromName,
    to: toEmail,
    subject: `[Dunvex Build] Mã OTP xác thực đăng ký tài khoản: ${otp}`,
    text: `Mã OTP xác thực đăng ký tài khoản Dunvex Build của bạn là: ${otp}. Mã có hiệu lực trong 5 phút.`,
    html: htmlContent,
  };

  return transporter.sendMail(mailOptions);
}

/**
 * Gửi email thư mời nhân viên tham gia công ty từ Quản trị viên
 * @param {object} params
 * @param {string} params.toEmail - Email nhân viên
 * @param {string} params.displayName - Tên nhân viên
 * @param {string} params.role - Vai trò
 * @param {string} params.password - Mật khẩu đăng nhập ban đầu
 * @param {string} params.companyName - Tên công ty / Cửa hàng
 * @param {string} params.inviterName - Tên người mời (Admin)
 * @returns {Promise<any>}
 */
export async function sendStaffInviteEmail({ toEmail, displayName, role, password, companyName, inviterName }) {
  const user = process.env.SMTP_USER || 'dunvex.green@gmail.com';
  const fromName = process.env.SMTP_FROM || `"Dunvex Build" <${user}>`;
  const transporter = getMailTransporter();

  const roleLabels = {
    sale: 'Nhân viên Kinh doanh / Bán hàng (Sale)',
    warehouse: 'Thủ kho / Quản lý kho',
    accountant: 'Kế toán / Quản lý công nợ',
    admin: 'Quản trị viên hệ thống'
  };
  const roleName = roleLabels[role] || role || 'Nhân viên';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Lời Mời Tham Gia Đội Ngũ - Dunvex Build</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
        .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #0A0E2E 0%, #1A237E 100%); padding: 36px 30px; text-align: center; }
        .logo { font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: 2px; text-transform: uppercase; margin: 0; }
        .tagline { color: #94a3b8; font-size: 11px; margin-top: 6px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
        .content { padding: 36px 32px; }
        .title { font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 12px; }
        .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-bottom: 24px; }
        .card-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #cbd5e1; font-size: 13px; }
        .card-row:last-child { border-bottom: none; }
        .card-label { color: #64748b; font-weight: 600; }
        .card-value { color: #0f172a; font-weight: 700; text-align: right; }
        .highlight-pass { color: #1A237E; font-family: monospace; font-size: 15px; background: #e0e7ff; padding: 2px 8px; border-radius: 6px; }
        .btn-box { text-align: center; margin: 28px 0; }
        .btn { display: inline-block; background: #1A237E; color: #ffffff !important; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 14px; letter-spacing: 0.5px; text-transform: uppercase; }
        .warning-box { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 14px 16px; border-radius: 8px; margin-bottom: 24px; }
        .warning-text { font-size: 12px; line-height: 1.5; color: #166534; margin: 0; font-weight: 600; }
        .footer { background: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #f1f5f9; }
        .footer-text { font-size: 11px; color: #94a3b8; line-height: 1.5; margin: 4px 0; }
        .footer-link { color: #1A237E; text-decoration: none; font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo">DUNVEX BUILD</h1>
          <p class="tagline">Hệ thống Quản lý Doanh nghiệp & Vật liệu xây dựng</p>
        </div>
        <div class="content">
          <h2 class="title">Lời Mời Tham Gia Đội Ngũ 🎉</h2>
          <p class="desc">
            Xin chào <strong>${displayName || toEmail}</strong>,<br>
            Bạn vừa được quản trị viên <strong>${inviterName || 'Quản trị viên'}</strong> mời tham gia làm việc tại <strong>${companyName || 'Dunvex Build'}</strong> trên hệ thống Quản lý Doanh nghiệp Dunvex Build.
          </p>

          <div class="card">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600;">Email đăng nhập:</td>
                <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">${toEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600;">Mật khẩu khởi tạo:</td>
                <td style="padding: 8px 0; text-align: right;"><span class="highlight-pass">${password}</span></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600;">Vị trí / Vai trò:</td>
                <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">${roleName}</td>
              </tr>
            </table>
          </div>

          <div class="warning-box">
            <p class="warning-text">
              🔒 <strong>Bảo mật:</strong> Vui lòng sử dụng thông tin trên để đăng nhập vào ứng dụng Dunvex Build. Sau khi đăng nhập lần đầu, bạn có thể vào mục <em>Hồ sơ</em> hoặc sử dụng tính năng <em>Đổi mật khẩu qua OTP</em> để đổi mật khẩu cá nhân.
            </p>
          </div>

          <p class="desc" style="font-size: 13px; color: #64748b; margin-bottom: 0;">
            Nếu bạn không quen biết người gửi lời mời này, vui lòng bỏ qua thư này.
          </p>
        </div>

        <div class="footer">
          <p class="footer-text">© 2026 Dunvex Build • All Rights Reserved</p>
          <p class="footer-text">Hỗ trợ kỹ thuật 24/7: <a href="mailto:dunvex.green@gmail.com" class="footer-link">dunvex.green@gmail.com</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: fromName,
    to: toEmail,
    subject: `[Dunvex Build] Lời mời tham gia đội ngũ ${companyName || 'Dunvex Build'}`,
    text: `Xin chào ${displayName || toEmail}, bạn được mời tham gia vào hệ thống Dunvex Build với vai trò ${roleName}. Email: ${toEmail}, Mật khẩu khởi tạo: ${password}.`,
    html: htmlContent,
  };

  return transporter.sendMail(mailOptions);
}

