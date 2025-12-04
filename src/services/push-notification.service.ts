import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
  vibrate?: number[];
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export class PushNotificationService {
  private supabase = createAdminClient();

  constructor() {
    // Initialize VAPID details
    const publicKey = process.env.PUBLIC_VAPID_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const email = process.env.VAPID_EMAIL || 'mailto:admin@example.com';

    if (!publicKey || !privateKey) {
      console.warn('⚠️ VAPID keys not configured. Push notifications will not work.');
      return;
    }

    webpush.setVapidDetails(email, publicKey, privateKey);
  }

  /**
   * Save push subscription to database
   */
  async saveSubscription(
    userId: string,
    subscription: PushSubscription,
    userAgent?: string
  ): Promise<void> {
    try {
      console.log('💾 [PushNotificationService] Saving subscription:', {
        userId,
        endpoint: subscription.endpoint.substring(0, 50) + '...',
        hasKeys: !!subscription.keys,
        userAgent,
      });

      const { error, data } = await this.supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          user_agent: userAgent,
          updated_at: new Date().toISOString(),
          is_active: true,
        } as any, {
          onConflict: 'user_id,endpoint',
        });

      if (error) {
        console.error('❌ [PushNotificationService] Database error:', error);
        throw error;
      }

      console.log('✅ [PushNotificationService] Subscription saved:', data);
    } catch (error) {
      console.error('❌ [PushNotificationService] Error saving subscription:', error);
      throw error;
    }
  }

  /**
   * Get all active push subscriptions for a user
   */
  async getSubscriptions(userId: string): Promise<Array<PushSubscription>> {
    try {
      const { data, error } = await this.supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) throw error;

      if (!data || data.length === 0) return [];

      return data.map((sub: any) => ({
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      }));
    } catch (error) {
      console.error('Error getting subscriptions:', error);
      return [];
    }
  }

  /**
   * Remove push subscription
   */
  async removeSubscription(userId: string, endpoint: string): Promise<void> {
    try {
      // Since push_subscriptions table is new and may not be in type definitions yet,
      // we use a more permissive approach
      const query = this.supabase.from('push_subscriptions') as any;
      const { error } = await query
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('endpoint', endpoint);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing subscription:', error);
      throw error;
    }
  }

  /**
   * Send push notification to a user
   */
  async sendNotification(
    userId: string,
    payload: NotificationPayload
  ): Promise<{ sent: number; failed: number }> {
    try {
      // Check user preferences
      const canSend = await this.checkUserPreferences(userId, payload);
      if (!canSend) {
        return { sent: 0, failed: 0 };
      }

      // Check rate limiting
      const canSendNow = await this.checkRateLimit(userId, payload.tag || 'default');
      if (!canSendNow) {
        console.log(`Rate limit exceeded for user ${userId}, notification type: ${payload.tag}`);
        return { sent: 0, failed: 0 };
      }

      const subscriptions = await this.getSubscriptions(userId);
      if (subscriptions.length === 0) {
        return { sent: 0, failed: 0 };
      }

      let sent = 0;
      let failed = 0;

      const notificationPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icon-192x192.png',
        badge: payload.badge || '/icon-192x192.png',
        tag: payload.tag || 'default',
        data: {
          ...payload.data,
          url: payload.data?.url || '/',
        },
        requireInteraction: payload.requireInteraction || false,
        vibrate: payload.vibrate || [200, 100, 200],
        actions: payload.actions || [],
      });

      // Send to all subscriptions
      const promises = subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(subscription, notificationPayload);
          sent++;
        } catch (error: any) {
          console.error('Error sending notification:', error);
          
          // If subscription is invalid, remove it
          if (error.statusCode === 410 || error.statusCode === 404) {
            await this.removeSubscription(userId, subscription.endpoint);
          }
          
          failed++;
        }
      });

      await Promise.allSettled(promises);

      // Log notification sent
      if (sent > 0) {
        await this.logNotification(userId, payload.tag || 'default');
      }

      return { sent, failed };
    } catch (error) {
      console.error('Error sending notification:', error);
      return { sent: 0, failed: 0 };
    }
  }

  /**
   * Check user notification preferences
   */
  private async checkUserPreferences(
    userId: string,
    payload: NotificationPayload
  ): Promise<boolean> {
    try {
      const { data } = await this.supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!data) {
        // No preferences set, default to allow
        return true;
      }

      const prefs = data as any;
      const tag = payload.tag || 'default';

      // Check if notification type is enabled
      if (tag.includes('memory') && !prefs.enable_memory) return false;
      if (tag.includes('message') && !prefs.enable_message) return false;
      if (tag.includes('reaction') && !prefs.enable_reaction) return false;
      if (tag.includes('daily') && !prefs.enable_daily) return false;

      // Check silent hours
      if (prefs.silent_hours_start !== null && prefs.silent_hours_end !== null) {
        const now = new Date();
        const currentHour = now.getHours();
        const start = prefs.silent_hours_start;
        const end = prefs.silent_hours_end;

        if (start > end) {
          // Silent hours span midnight (e.g., 22:00 - 07:00)
          if (currentHour >= start || currentHour < end) {
            return false;
          }
        } else {
          // Silent hours within same day (e.g., 10:00 - 12:00)
          if (currentHour >= start && currentHour < end) {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Error checking preferences:', error);
      return true; // Default to allow if error
    }
  }

  /**
   * Check rate limiting
   */
  private async checkRateLimit(
    userId: string,
    notificationType: string
  ): Promise<boolean> {
    try {
      // Determine rate limit based on notification type
      const rateLimits: Record<string, number> = {
        memory: 5 * 60 * 1000, // 5 minutes
        message: 2 * 60 * 1000, // 2 minutes
        reaction: 1 * 60 * 1000, // 1 minute
        daily: 24 * 60 * 60 * 1000, // 24 hours
      };

      const limitMs = rateLimits[notificationType] || 1 * 60 * 1000; // Default: 1 minute

      // Check last notification of this type
      const { data } = await this.supabase
        .from('notification_logs')
        .select('sent_at')
        .eq('user_id', userId)
        .eq('notification_type', notificationType)
        .order('sent_at', { ascending: false })
        .limit(1)
        .single();

      if (!data) {
        return true; // No previous notification, allow
      }

      const lastSent = new Date((data as any).sent_at).getTime();
      const now = Date.now();
      const timeDiff = now - lastSent;

      return timeDiff >= limitMs;
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return true; // Default to allow if error
    }
  }

  /**
   * Log notification sent
   */
  private async logNotification(
    userId: string,
    notificationType: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('notification_logs')
        .insert({
          user_id: userId,
          notification_type: notificationType,
        } as any);
    } catch (error) {
      console.error('Error logging notification:', error);
      // Non-critical error, don't throw
    }
  }
}
