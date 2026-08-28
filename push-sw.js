// Service Worker para notificaciones push del mozo
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Nuevo Pedido';
  const body = data.body || 'Tenés un nuevo pedido';
  const url = data.url || '/mozo.html';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/public/brand/logo.svg',
      badge: '/public/brand/logo.svg',
      vibrate: [200, 100, 200],
      data: { url },
      actions: [
        { action: 'open', title: 'Ver Pedido' }
      ]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/mozo.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      for (const client of clients) {
        if (client.url.includes('mozo') && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
