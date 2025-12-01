import { AIService } from './ai.service';
import { createAdminClient } from '@/lib/supabase/admin';
import { TelegramService } from './telegram.service';

export class NotificationService {
  private supabase = createAdminClient();
  private aiService = new AIService();
  private telegramService = new TelegramService();

  async sendDailyNotification(userId: string): Promise<void> {
    try {
      // Get user's recent activity
      const { data: reactions } = await this.supabase
        .from('reactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      const { data: messages } = await this.supabase
        .from('messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      const { data: memories } = await this.supabase
        .from('memories')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      // Generate AI message
      const { content, emotionLevel } = await this.aiService.generateDailyMessage(
        reactions || [],
        messages || [],
        memories || []
      );

      // Save notification
      await this.supabase.from('daily_notifications').insert({
        user_id: userId,
        content,
        emotion_level: emotionLevel,
      } as any);

      // Send push notification
      await this.sendPushNotification(userId, content);
    } catch (error) {
      console.error('Notification error:', error);
    }
  }

  async scheduleDailyNotifications(): Promise<void> {
    const { data: schedules } = await this.supabase
      .from('notification_schedules')
      .select('*')
      .eq('is_active', true);

    if (!schedules || schedules.length === 0) return;

    const { data: clientUsers } = await this.supabase
      .from('users')
      .select('id')
      .eq('role', 'client');

    if (!clientUsers) return;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    // Check each schedule
    for (const schedule of schedules) {
      const scheduleData = schedule as any;
      const [hours, minutes] = scheduleData.time.split(':').map(Number);
      const scheduleTimeInMinutes = hours * 60 + minutes;
      
      // Calculate time difference
      const timeDiff = currentTimeInMinutes - scheduleTimeInMinutes;
      
      // Send if schedule time matches (within 5 minutes window)
      // This works for both:
      // - Vercel cron (runs once/day): sends all schedules that should have been sent
      // - External cron (runs every 5 min): sends only schedules within 5 min window
      const isWithinWindow = timeDiff >= 0 && timeDiff <= 5;
      const isExactTime = timeDiff === 0 && currentSecond < 10;
      
      if (isWithinWindow || isExactTime) {
        // Check if notification was already sent today for this schedule
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStart = today.toISOString();
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStart = tomorrow.toISOString();

        for (const user of clientUsers) {
          const userData = user as any;
          
          // Check if notification already sent today
          const { data: existingNotification } = await this.supabase
            .from('daily_notifications')
            .select('id')
            .eq('user_id', userData.id)
            .gte('sent_at', todayStart)
            .lt('sent_at', tomorrowStart)
            .limit(1)
            .maybeSingle();

          // Only send if not already sent today
          if (!existingNotification) {
          await this.sendDailyNotification(userData.id);
          }
        }
      }
    }
  }

  async sendMemoryNotification(userId: string): Promise<void> {
    try {
      // The memory is already saved in the database by the API route
      // The client will receive it via Supabase realtime subscription
      // We can also trigger a push notification if needed
      console.log('Memory notification triggered for user:', userId);
      
      // Note: For full push notification support, you would need to:
      // 1. Store push subscriptions in a table
      // 2. Use Web Push API with VAPID keys
      // 3. Send push notification through a push service
      // For now, the realtime subscription will handle the notification
    } catch (error) {
      console.error('Memory notification error:', error);
    }
  }

  private async sendPushNotification(
    userId: string,
    content: string
  ): Promise<void> {
    // This will be implemented with Web Push API
    // For now, we'll use a service worker approach
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const notificationOptions: NotificationOptions = {
          body: content,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: 'daily-message',
          requireInteraction: false,
        };
        
        // Add vibrate if supported
        if ('vibrate' in navigator) {
          (notificationOptions as any).vibrate = [200, 100, 200];
        }
        
        await registration.showNotification('✨ Lời nhắn từ tớ', notificationOptions);
      } catch (error) {
        console.error('Push notification error:', error);
      }
    }
  }
}

