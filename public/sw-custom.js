// Custom Service Worker with Workbox and Push Notification handlers
// Import Workbox from CDN
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

// Workbox configuration
if (workbox) {
  console.log('✅ Workbox loaded');

  // Precache assets (injected by next-pwa during build)
  // self.__WB_MANIFEST is automatically injected by next-pwa
  // Handle precaching safely - only if manifest exists and is valid
  if (self.__WB_MANIFEST && Array.isArray(self.__WB_MANIFEST) && self.__WB_MANIFEST.length > 0) {
    try {
      // Filter out files that might not exist (e.g., in development)
      const validManifest = self.__WB_MANIFEST.filter((entry) => {
        // Skip build manifest files that might not exist in dev mode
        if (typeof entry === 'string') {
          return !entry.includes('app-build-manifest.json') && 
                 !entry.includes('build-manifest.json');
        }
        if (entry && entry.url) {
          return !entry.url.includes('app-build-manifest.json') && 
                 !entry.url.includes('build-manifest.json');
        }
        return true;
      });
      
      if (validManifest.length > 0) {
        workbox.precaching.precacheAndRoute(validManifest);
        console.log('✅ Precache configured with', validManifest.length, 'entries');
      } else {
        console.log('ℹ️ No valid precache entries after filtering');
      }
    } catch (error) {
      console.warn('⚠️ Precache error (non-critical):', error);
    }
  } else {
    console.log('ℹ️ No precache manifest available (development mode or no assets to cache)');
  }

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
// Following Next.js PWA best practices
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
    vibrate: notificationData.vibrate,
    silent: notificationData.silent,
  };

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
// Following Next.js PWA best practices
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
      // Check if there's already a window/tab open with the target URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && (client.url.includes(urlToOpen) || urlToOpen === '/')) {
          if ('focus' in client) {
            return client.focus();
          }
        }
      }
      
      // If no window is open, open a new one
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
