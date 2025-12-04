// Custom Service Worker with Workbox and Push Notification handlers
// Import Workbox from CDN
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

// Skip waiting and claim clients immediately
self.skipWaiting();
self.clients.claim();

// Workbox configuration
if (workbox) {
  console.log('✅ Workbox loaded');

  // Precache assets (injected by next-pwa during build)
  // self.__WB_MANIFEST is automatically injected by next-pwa
  // Just use it directly - next-pwa will replace it with the manifest
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST);

  // Cache strategies
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
      cacheName: 'start-url',
    })
  );

  workbox.routing.registerRoute(
    ({ url }) => url.protocol === 'http:' || url.protocol === 'https:',
    new workbox.strategies.NetworkFirst({
      cacheName: 'offlineCache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 200,
        }),
      ],
    })
  );
}

// ============================================
// PUSH NOTIFICATION HANDLERS
// ============================================

console.log('✅ Push notification handlers loaded');

// Push event - handle push notifications
self.addEventListener('push', (event) => {
  console.log('📬 Push event received:', event);
  
  let notificationData = {
    title: '✨ Lời nhắn từ tớ',
    body: 'Bạn có thông báo mới!',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: 'default',
    requireInteraction: false,
    data: {},
  };

  if (event.data) {
    try {
      const data = event.data.json();
      console.log('📦 Push data:', data);
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        tag: data.tag || notificationData.tag,
        requireInteraction: data.requireInteraction || false,
        data: data.data || {},
        actions: data.actions || [],
        vibrate: data.vibrate || [200, 100, 200],
        silent: data.silent || false,
      };
    } catch (e) {
      console.error('❌ Error parsing push data:', e);
      if (event.data.text) {
        notificationData.body = event.data.text();
      }
    }
  }

  const notificationOptions = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    requireInteraction: notificationData.requireInteraction,
    data: notificationData.data,
    vibrate: notificationData.vibrate,
    silent: notificationData.silent,
  };

  if (notificationData.actions && notificationData.actions.length > 0) {
    notificationOptions.actions = notificationData.actions;
  }

  console.log('🔔 Showing notification:', notificationData.title);
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationOptions)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notification clicked:', event.notification.tag);
  event.notification.close();

  const notificationData = event.notification.data || {};
  const urlToOpen = notificationData.url || '/';

  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && (client.url.includes(urlToOpen) || urlToOpen === '/')) {
          if ('focus' in client) {
            return client.focus();
          }
        }
      }
      
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('❌ Notification closed:', event.notification.tag);
});
