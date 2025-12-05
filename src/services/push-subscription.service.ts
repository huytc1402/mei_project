// Client-side service for push subscription management

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export class PushSubscriptionService {
  private publicVapidKey: string | null = null;

  constructor() {
    // Get public VAPID key from environment
    // Following Next.js convention: NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (typeof window !== 'undefined') {
      this.publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_KEY || null;
    }
  }

  /**
   * Convert VAPID key from base64 URL-safe to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  }

  /**
   * Check if browser supports push notifications
   */
  isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      this.publicVapidKey !== null
    );
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('This browser does not support notifications');
    }

    return await Notification.requestPermission();
  }

  /**
   * Register service worker
   * Following Next.js PWA best practices
   */
  async registerServiceWorker(): Promise<ServiceWorkerRegistration> {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Workers are not supported');
    }

    try {
      // Register with updateViaCache: 'none' to ensure we always get the latest version
      // This is recommended by Next.js for PWAs
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw error;
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(userId: string): Promise<PushSubscriptionData | null> {
    try {
      console.log('📝 [PushSubscription] Starting subscribe for userId:', userId);
      
      // Check support
      const isSupported = this.isSupported();
      console.log('🔍 [PushSubscription] Support check:', {
        serviceWorker: 'serviceWorker' in navigator,
        PushManager: 'PushManager' in window,
        publicVapidKey: !!this.publicVapidKey,
        isSupported,
      });
      
      if (!isSupported) {
        console.error('❌ [PushSubscription] Not supported');
        if (!this.publicVapidKey) {
          throw new Error('VAPID public key not configured. Please check NEXT_PUBLIC_VAPID_PUBLIC_KEY environment variable.');
        }
        throw new Error('Push notifications are not supported in this browser.');
      }
      console.log('✅ [PushSubscription] Supported');

      // Request permission
      console.log('🔔 [PushSubscription] Current permission:', Notification.permission);
      console.log('🔔 [PushSubscription] Requesting permission...');
      const permission = await this.requestPermission();
      console.log('🔔 [PushSubscription] Permission result:', permission);
      
      if (permission !== 'granted') {
        console.error('❌ [PushSubscription] Permission not granted:', permission);
        if (permission === 'denied') {
          throw new Error('Notification permission was denied. Please enable notifications in your browser settings.');
        } else if (permission === 'default') {
          throw new Error('Notification permission not requested yet. Please try again.');
        }
        throw new Error(`Notification permission not granted: ${permission}`);
      }
      console.log('✅ [PushSubscription] Permission granted');

      // Register service worker
      console.log('⚙️ [PushSubscription] Registering service worker...');
      const registration = await this.registerServiceWorker();
      console.log('✅ [PushSubscription] Service worker registered:', registration);

      // Get existing subscription or create new one
      console.log('🔍 [PushSubscription] Checking existing subscription...');
      let subscription = await registration.pushManager.getSubscription();
      console.log('🔍 [PushSubscription] Existing subscription:', subscription ? 'Found' : 'Not found');

      if (!subscription) {
        if (!this.publicVapidKey) {
          console.error('❌ [PushSubscription] VAPID public key not configured');
          throw new Error('VAPID public key not configured');
        }
        console.log('🔑 [PushSubscription] Creating new subscription with VAPID key...');
        const applicationServerKey = this.urlBase64ToUint8Array(this.publicVapidKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as any,
        });
        console.log('✅ [PushSubscription] New subscription created:', subscription.endpoint);
      }

      // Convert subscription to JSON format
      const subscriptionData: PushSubscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')!),
        },
      };
      console.log('📦 [PushSubscription] Subscription data prepared');

      // Send subscription to server
      console.log('📤 [PushSubscription] Sending subscription to server...');
      const userAgent = navigator.userAgent;
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          subscription: subscriptionData,
          userAgent,
        }),
      });

      console.log('📥 [PushSubscription] Server response:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [PushSubscription] Server error:', errorText);
        throw new Error(`Failed to save subscription: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ [PushSubscription] Subscription saved to server:', result);
      return subscriptionData;
    } catch (error: any) {
      console.error('❌ [PushSubscription] Subscribe error:', error);
      console.error('  - Message:', error.message);
      console.error('  - Stack:', error.stack);
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(userId: string): Promise<void> {
    try {
      if (!('serviceWorker' in navigator)) {
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        
        // Notify server
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            endpoint: subscription.endpoint,
          }),
        });
      }
    } catch (error: any) {
      console.error('Unsubscribe error:', error);
      throw error;
    }
  }

  /**
   * Check current subscription status
   */
  async getSubscription(): Promise<PushSubscriptionData | null> {
    try {
      if (!('serviceWorker' in navigator)) {
        return null;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        return null;
      }

      return {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')!),
        },
      };
    } catch (error) {
      console.error('Get subscription error:', error);
      return null;
    }
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}
