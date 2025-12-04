// Custom Service Worker for Push Notifications
// This will be merged with workbox service worker by next-pwa

// Push event - handle push notifications
self.addEventListener('push', (event) => {
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
      console.error('Error parsing push data:', e);
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

  // Add actions if provided
  if (notificationData.actions && notificationData.actions.length > 0) {
    notificationOptions.actions = notificationData.actions;
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationOptions)
  );
});

// Notification click event - open app when notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  const urlToOpen = notificationData.url || '/';

  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    }).then((clientList) => {
      // Check if app is already open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && (client.url.includes(urlToOpen) || urlToOpen === '/')) {
          if ('focus' in client) {
            return client.focus();
          }
        }
      }
      
      // If app is not open, open it
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Notification close event (optional - for analytics)
self.addEventListener('notificationclose', (event) => {
  // Could send analytics here
  console.log('Notification closed:', event.notification.tag);
});
