/**
 * Tiện ích gửi thông báo Telegram Chủ động.
 * Gọi lên Vercel Serverless Function /api/telegram-notify
 */

export const sendTelegramNotification = async (ownerId: string, message: string) => {
  if (!ownerId || !message) return false;

  try {
    const isViteLocal = import.meta.env.DEV; // Vite local dev server
    if (isViteLocal) {
      // LOCAL DEV: Khi dev local có thể bỏ qua để không spam
      return true;
    }

    // Nếu chạy trên Capacitor (Android/iOS), API phải trỏ đến tên miền thật của VPS (vì Capacitor chạy localhost không có backend API)
    const isCapacitor = window.location.protocol === 'capacitor:' || window.location.hostname === 'localhost';
    const apiUrl = isCapacitor ? 'https://dunvex.136-109-194-84.nip.io/api/telegram-notify' : '/api/telegram-notify';

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId, message })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Lỗi khi gửi thông báo Telegram:', err);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception khi gửi thông báo Telegram:', error);
    return false;
  }
};
