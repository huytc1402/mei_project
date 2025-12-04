import { useEffect, useState, useCallback } from 'react';
import { PushSubscriptionService } from '@/services/push-subscription.service';

export function usePushNotifications(userId: string | null) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const pushService = useState(() => new PushSubscriptionService())[0];

  // Check support and subscription status
  useEffect(() => {
    const checkStatus = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      setIsSupported(pushService.isSupported());

      if (pushService.isSupported()) {
        try {
          const subscription = await pushService.getSubscription();
          setIsSubscribed(!!subscription);
        } catch (error) {
          console.error('Error checking subscription:', error);
        }
      }

      setIsLoading(false);
    };

    checkStatus();
  }, [userId, pushService]);

  // Inject push handlers into service worker
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const injectPushHandlers = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        
        // Inject push handlers by posting a message to service worker
        registration.active?.postMessage({
          type: 'INJECT_PUSH_HANDLERS',
          source: '/sw-push.js',
        });
      } catch (error) {
        console.error('Error injecting push handlers:', error);
      }
    };

    // Wait a bit for service worker to be ready
    navigator.serviceWorker.ready.then(() => {
      setTimeout(injectPushHandlers, 1000);
    });
  }, []);

  const subscribe = useCallback(async () => {
    if (!userId || !pushService.isSupported()) {
      return false;
    }

    setIsLoading(true);
    try {
      const subscription = await pushService.subscribe(userId);
      if (subscription) {
        setIsSubscribed(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Subscribe error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [userId, pushService]);

  const unsubscribe = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      await pushService.unsubscribe(userId);
      setIsSubscribed(false);
    } catch (error) {
      console.error('Unsubscribe error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, pushService]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
}
