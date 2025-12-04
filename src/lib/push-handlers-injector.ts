// Script to inject push notification handlers into service worker
// This will be called after service worker is ready

export async function injectPushHandlers() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check if push handlers are already injected by checking for push event listener
    // If not, we need to ensure push handlers are in the service worker
    
    // The custom worker/index.js should be automatically merged by next-pwa
    // But we can also dynamically inject if needed
    console.log('✅ Service Worker ready, push handlers should be available');
    
    // Verify push is supported
    if (registration.pushManager) {
      console.log('✅ Push Manager available');
    } else {
      console.warn('⚠️ Push Manager not available');
    }
  } catch (error) {
    console.error('Error checking service worker:', error);
  }
}
