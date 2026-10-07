import { apiUrl } from '../services/apiClient';

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
    const payload: EventNotificationPayload = {
      ownerId,
      message,
      eventType,
      data: eventData || {}
    };

    const res = await fetch(apiUrl('/api/telegram-notify'), {
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
  orderCode?: string;
  time?: string;
  note?: string;
}) => {
  const now = new Date();
  const timeDisplay = data.time || `${now.toLocaleTimeString('vi-VN', { hour12: false })} ${now.toLocaleDateString('vi-VN')}`;
  const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(data.totalAmount || 0);
  const codeStr = data.orderCode ? `\n- Mã đơn: <b>${data.orderCode}</b>` : '';
  const noteStr = data.note ? `\n- Ghi chú: <i>${data.note}</i>` : '';
  const msg = `📦 <b>THÔNG BÁO ĐƠN HÀNG (${data.status.toUpperCase()})</b>${codeStr}\n- Thời gian: <b>${timeDisplay}</b>\n- Khách hàng: <b>${data.customerName}</b>\n- Tổng tiền: <b>${formattedPrice}</b>${noteStr}\n- Người thao tác: ${data.actorName || 'Admin'}`;
  return sendTelegramNotification(ownerId, msg, 'order', { ...data, time: timeDisplay });
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
  const now = new Date();
  const timeDisplay = data.time || `${now.toLocaleTimeString('vi-VN', { hour12: false })} ${now.toLocaleDateString('vi-VN')}`;
  const actionStr = data.action === 'checkout' ? '🚪 RA CA (Check-out)' : '🏢 VÀO CA (Check-in)';
  const distStr = data.distance != null ? `\n- Khoảng cách xưởng: <b>${data.distance}m</b>` : '';
  const timeStr = `\n- Thời gian: <b>${timeDisplay}</b>`;
  const msg = `⏰ <b>CHẤM CÔNG NHÂN VIÊN - ${actionStr}</b>\n- Nhân viên: <b>${data.userName}</b>${timeStr}${distStr}\n- Trạng thái: ${data.status || 'Đúng giờ'}`;
  return sendTelegramNotification(ownerId, msg, 'attendance', { ...data, time: timeDisplay });
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
  const now = new Date();
  const timeDisplay = data.time || `${now.toLocaleTimeString('vi-VN', { hour12: false })} ${now.toLocaleDateString('vi-VN')}`;
  const site = data.customerName || data.siteName || 'Công trình';
  const mapsLink = data.location ? `\n- Định vị GPS: https://www.google.com/maps/search/?api=1&query=${data.location.lat},${data.location.lng}` : '';
  const photo = data.imageUrl ? `\n- Ảnh hiện trường: ${data.imageUrl}` : '';
  const timeStr = `\n- Thời gian: <b>${timeDisplay}</b>`;
  const msg = `📍 <b>CHECK-IN TẠI CÔNG TRÌNH / GIAO HÀNG</b>\n- Nhân viên: <b>${data.userName}</b>${timeStr}\n- Công trình / Khách: <b>${site}</b>${mapsLink}${photo}`;
  return sendTelegramNotification(ownerId, msg, 'site_checkin', { ...data, time: timeDisplay });
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
  const now = new Date();
  const timeDisplay = data.time || `${now.toLocaleTimeString('vi-VN', { hour12: false })} ${now.toLocaleDateString('vi-VN')}`;
  const formattedAmount = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(data.amount || 0);
  const remainStr = data.remainingDebt != null ? `\n- Dư nợ còn lại: <b>${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(data.remainingDebt)}</b>` : '';
  const msg = `💰 <b>GHI NHẬN THU NỢ KHÁCH HÀNG</b>\n- Thời gian: <b>${timeDisplay}</b>\n- Khách hàng: <b>${data.customerName}</b>\n- Số tiền thu: <b>${formattedAmount}</b>${remainStr}\n- Người thu: ${data.collectorName || 'Nhân viên'}`;
  return sendTelegramNotification(ownerId, msg, 'debt_payment', { ...data, time: timeDisplay });
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
  const now = new Date();
  const timeDisplay = data.time || `${now.toLocaleTimeString('vi-VN', { hour12: false })} ${now.toLocaleDateString('vi-VN')}`;
  const reqStr = data.requestType === 'leave' ? '🏖️ Xin nghỉ phép' : '⏰ Xin đi muộn';
  const datesStr = Array.isArray(data.dates) ? data.dates.join(', ') : data.dates;
  const msg = `📝 <b>ĐƠN ĐĂNG KÝ ${reqStr.toUpperCase()}</b>\n- Thời gian nộp: <b>${timeDisplay}</b>\n- Nhân viên: <b>${data.userName}</b>\n- Ngày: <b>${datesStr}</b>\n- Lý do: <i>${data.note || 'Bận việc gia đình'}</i>`;
  return sendTelegramNotification(ownerId, msg, 'leave_request', { ...data, time: timeDisplay });
};
