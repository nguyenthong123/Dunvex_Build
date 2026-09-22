/**
 * Tiện ích gửi thông báo Telegram & n8n Chủ động.
 * Hỗ trợ các luồng: Đơn hàng, Chấm công, Checkin công trình, Thu công nợ, Nghỉ phép, Tổng kết EOD.
 */

export interface EventNotificationPayload {
  ownerId: string;
  eventType?: 'order' | 'attendance' | 'site_checkin' | 'debt_payment' | 'leave_request' | 'eod_report' | 'generic';
  message?: string;
  data?: any;
}

export const sendTelegramNotification = async (
  ownerId: string,
  message: string,
  eventType: 'order' | 'attendance' | 'site_checkin' | 'debt_payment' | 'leave_request' | 'eod_report' | 'generic' = 'generic',
  eventData?: any
) => {
  if (!ownerId) return false;

  try {
    const isViteLocal = import.meta.env.DEV; // Vite local dev server

    // Nếu chạy trên Capacitor (Android/iOS), API phải trỏ đến tên miền thật của VPS (vì Capacitor chạy localhost không có backend API)
    const isCapacitor = typeof window !== 'undefined' && (window.location.protocol === 'capacitor:' || window.location.hostname === 'localhost');
    const apiUrl = isCapacitor ? 'https://dunvex.136-109-194-84.nip.io/api/telegram-notify' : '/api/telegram-notify';

    const payload: EventNotificationPayload = {
      ownerId,
      message,
      eventType,
      data: eventData || {}
    };

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn('Thông báo Telegram / n8n:', err);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception khi gửi thông báo Telegram / n8n:', error);
    return false;
  }
};

/** 1. Báo đơn hàng mới / chốt / sửa / hủy */
export const notifyOrderEvent = async (ownerId: string, data: {
  customerName: string;
  totalAmount: number;
  status: string;
  actorName?: string;
  orderId?: string;
}) => {
  const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(data.totalAmount || 0);
  const msg = `📦 <b>THÔNG BÁO ĐƠN HÀNG (${data.status.toUpperCase()})</b>\n- Khách hàng: <b>${data.customerName}</b>\n- Tổng tiền: <b>${formattedPrice}</b>\n- Người thao tác: ${data.actorName || 'Admin'}`;
  return sendTelegramNotification(ownerId, msg, 'order', data);
};

/** 2. Báo chấm công nhân viên (Vào ca / Ra ca tại xưởng) */
export const notifyAttendanceEvent = async (ownerId: string, data: {
  userName: string;
  userEmail?: string;
  action: 'checkin' | 'checkout';
  time?: string;
  distance?: number;
  location?: { lat: number; lng: number };
  status?: string;
}) => {
  const actionStr = data.action === 'checkout' ? '🚪 RA CA (Check-out)' : '🏢 VÀO CA (Check-in)';
  const distStr = data.distance != null ? `\n- Khoảng cách xưởng: <b>${data.distance}m</b>` : '';
  const msg = `⏰ <b>CHẤM CÔNG NHÂN VIÊN - ${actionStr}</b>\n- Nhân viên: <b>${data.userName}</b>${distStr}\n- Trạng thái: ${data.status || 'Đúng giờ'}`;
  return sendTelegramNotification(ownerId, msg, 'attendance', data);
};

/** 3. Báo check-in tại công trình / Giao hàng */
export const notifySiteCheckinEvent = async (ownerId: string, data: {
  userName: string;
  customerName?: string;
  siteName?: string;
  time?: string;
  distance?: number;
  location?: { lat: number; lng: number };
  imageUrl?: string;
  note?: string;
}) => {
  const site = data.customerName || data.siteName || 'Công trình';
  const mapsLink = data.location ? `\n- Định vị GPS: https://www.google.com/maps/search/?api=1&query=${data.location.lat},${data.location.lng}` : '';
  const photo = data.imageUrl ? `\n- Ảnh hiện trường: ${data.imageUrl}` : '';
  const msg = `📍 <b>CHECK-IN TẠI CÔNG TRÌNH / GIAO HÀNG</b>\n- Nhân viên: <b>${data.userName}</b>\n- Công trình / Khách: <b>${site}</b>${mapsLink}${photo}`;
  return sendTelegramNotification(ownerId, msg, 'site_checkin', data);
};

/** 4. Báo thu & nhập công nợ */
export const notifyDebtPaymentEvent = async (ownerId: string, data: {
  customerName: string;
  amount: number;
  paymentMethod?: string;
  remainingDebt?: number;
  collectorName?: string;
  time?: string;
  note?: string;
}) => {
  const formattedAmount = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(data.amount || 0);
  const remainStr = data.remainingDebt != null ? `\n- Dư nợ còn lại: <b>${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(data.remainingDebt)}</b>` : '';
  const msg = `💰 <b>GHI NHẬN THU NỢ KHÁCH HÀNG</b>\n- Khách hàng: <b>${data.customerName}</b>\n- Số tiền thu: <b>${formattedAmount}</b>${remainStr}\n- Người thu: ${data.collectorName || 'Nhân viên'}`;
  return sendTelegramNotification(ownerId, msg, 'debt_payment', data);
};

/** 5. Báo đơn xin nghỉ phép / đi muộn */
export const notifyLeaveRequestEvent = async (ownerId: string, data: {
  userName: string;
  userEmail?: string;
  requestType: 'leave' | 'late';
  dates: string[] | string;
  note?: string;
  time?: string;
}) => {
  const reqStr = data.requestType === 'leave' ? '🏖️ Xin nghỉ phép' : '⏰ Xin đi muộn';
  const datesStr = Array.isArray(data.dates) ? data.dates.join(', ') : data.dates;
  const msg = `📝 <b>ĐƠN ĐĂNG KÝ ${reqStr.toUpperCase()}</b>\n- Nhân viên: <b>${data.userName}</b>\n- Ngày: <b>${datesStr}</b>\n- Lý do: <i>${data.note || 'Bận việc gia đình'}</i>`;
  return sendTelegramNotification(ownerId, msg, 'leave_request', data);
};

