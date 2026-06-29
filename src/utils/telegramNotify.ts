/**
 * Tiện ích gửi thông báo Telegram Chủ động.
 * Gọi lên Vercel Serverless Function /api/telegram-notify
 */

export const sendTelegramNotification = async (ownerId: string, message: string) => {
  if (!ownerId || !message) return false;

  try {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    // Nếu chạy local, không gọi lên Vercel API thực tế để tránh lỗi (hoặc có thể trỏ thẳng lên Vercel URL thật)
    // Để dễ test, nếu ở local thì bỏ qua hoặc log ra console.
    if (isLocal) {
      console.log('TELEGRAM NOTIFY (LOCAL):', message);
      return true;
    }

    const res = await fetch('/api/telegram-notify', {
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
