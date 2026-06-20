// 🧹 EMERGENCY: Service Worker tự hủy
// File này sẽ được deploy 1 lần duy nhất để diệt SW cũ đã cache
self.addEventListener('install', () => {
  console.log('🧹 SW Killer: Bắt đầu dọn dẹp...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('🧹 SW Killer: Đang xóa toàn bộ cache cũ...');
  event.waitUntil(
    (async () => {
      // Xóa tất cả cache storage
      const names = await caches.keys();
      await Promise.all(names.map(name => caches.delete(name)));
      console.log('🧹 SW Killer: Đã xóa ' + names.length + ' cache(s)');
      
      // Tự hủy — unregister chính mình
      await self.registration.unregister();
      console.log('🧹 SW Killer: Đã tự hủy!');
      
      // Claim tất cả clients để load trang mới không qua SW
      await self.clients.claim();
      
      // Reload tất cả tabs đang mở
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => client.navigate(client.url));
      console.log('🧹 SW Killer: Đã reload trang!');
    })()
  );
});

// Không cache gì hết — mọi request đi thẳng ra network
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
