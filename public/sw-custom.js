// Custom Service Worker for Push Notifications only
// No Workbox, no precaching - just push notification handlers
// This prevents all precaching-related 404 errors
console.log('✅ Service Worker loaded (push notifications only)');

// Reference self.__WB_MANIFEST to satisfy next-pwa requirement
// But we don't use it - manifest will be empty due to publicExcludes and buildExcludes
// eslint-disable-next-line no-undef
const manifest = self.__WB_MANIFEST || [];
if (manifest.length > 0) {
  console.warn('⚠️ Manifest found but will not be used (precaching disabled)');
}

// ============================================
// SERVICE WORKER LIFECYCLE
// ============================================

// Install event - skip waiting to activate immediately
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  // Skip waiting means the new service worker will activate immediately
  // instead of waiting for all tabs to close
  self.skipWaiting();
});

// Activate event - claim clients only when service worker is active
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activating...');
  // Claim clients only when the service worker is active
  // This prevents "Only the active worker can claim clients" error
  event.waitUntil(
    self.clients.claim().then(() => {
      console.log('✅ Service Worker activated and claimed clients');
    }).catch((error) => {
      console.warn('⚠️ Error claiming clients (non-critical):', error);
    })
  );
});

// ============================================
// PUSH NOTIFICATION HANDLERS
// ============================================

console.log('✅ Push notification handlers loaded');

// Push event - handle push notifications
self.addEventListener('push', function (event) {
  console.log('📬 Push event received:', event);
  
  // Default notification data
  let notificationData = {
    title: '✨ Lời nhắn từ tớ',
    body: 'Bạn có thông báo mới!',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: 'default',
    requireInteraction: false,
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1',
    },
  };

  // Parse push data if available
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
        data: {
          ...notificationData.data,
          ...(data.data || {}),
          url: data.data?.url || '/',
        },
        actions: data.actions || [],
        vibrate: data.vibrate || [200, 100, 200],
        silent: data.silent || false,
      };
    } catch (e) {
      console.error('❌ Error parsing push data:', e);
      // Fallback: try to get text data
      if (event.data.text) {
        notificationData.body = event.data.text();
      }
    }
  }

  // Build notification options
  const notificationOptions = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    requireInteraction: notificationData.requireInteraction,
    data: notificationData.data,
    silent: notificationData.silent || false,
  };

  // Only add vibrate if NOT silent
  if (!notificationOptions.silent && notificationData.vibrate) {
    notificationOptions.vibrate = notificationData.vibrate;
  }

  // Add actions if available
  if (notificationData.actions && notificationData.actions.length > 0) {
    notificationOptions.actions = notificationData.actions;
  }

  console.log('🔔 Showing notification:', notificationData.title);
  // Use event.waitUntil to keep the service worker alive until notification is shown
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
      // Check if there's already a window/tab open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          // Focus existing window and post message to navigate
          client.focus();
          // Post message to the client to trigger navigation
          // The client-side code should listen for this message and use Next.js router
          if (client.postMessage) {
            client.postMessage({
              type: 'NAVIGATE',
              url: urlToOpen,
            });
          }
          return Promise.resolve();
        }
      }
      
      // If no window is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
      
      return Promise.resolve();
    }).catch((error) => {
      console.error('Error handling notification click:', error);
      // Fallback: try to open window directly
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
