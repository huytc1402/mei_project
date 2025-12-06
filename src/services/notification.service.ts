import { AIService } from './ai.service';
import { createAdminClient } from '@/lib/supabase/admin';
import { PushNotificationService } from './push-notification.service';

export class NotificationService {
  private supabase = createAdminClient();
  private aiService = new AIService();
  private pushService = new PushNotificationService();

  async sendDailyNotification(userId: string): Promise<void> {
    try {
      // Get user preferences (city, horoscope) for AI personalization
      const { data: userPreferences } = await this.supabase
        .from('user_preferences')
        .select('city, horoscope')
        .eq('user_id', userId)
        .maybeSingle();

      // Get user's recent activity
      const { data: reactions } = await this.supabase
        .from('reactions')
        .select('emoji, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      const { data: messages } = await this.supabase
        .from('messages')
        .select('content, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      const { data: memories } = await this.supabase
        .from('memories')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      // Extract user preferences
      const userCity = (userPreferences as any)?.city || undefined;
      const userHoroscope = (userPreferences as any)?.horoscope || undefined;

      // Generate AI message with user preferences
      const { content, emotionLevel } = await this.aiService.generateDailyMessage(
        reactions || [],
        messages || [],
        memories || [],
        userCity,
        userHoroscope
      );

      // Save notification
      await this.supabase.from('daily_notifications').insert({
        user_id: userId,
        content,
        emotion_level: emotionLevel,
      } as any);

      // Send push notification using PushNotificationService
      const notificationContent = content.length > 100 
        ? content.substring(0, 100) + '...' 
        : content;
      
      await this.pushService.sendNotification(userId, {
        title: '✨ Lời nhắn từ tớ',
        body: notificationContent,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: `daily-${new Date().toISOString().split('T')[0]}`,
        data: {
          url: '/client',
          type: 'daily',
        },
        requireInteraction: false,
        silent: false,
      });

      console.log(`✅ Daily notification sent to user ${userId}`);
    } catch (error: any) {
      console.error('Notification error:', error);
      throw error;
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

    // Get current time in Vietnam timezone (UTC+7)
    // Schedules are stored as Vietnam time (HH:mm format), so we need to compare in Vietnam timezone
    const now = new Date();
    
    // Convert to Vietnam time using Intl API for accurate timezone conversion
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    
    const parts = formatter.formatToParts(now);
    const currentHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const currentMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    const currentSecond = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10);
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    console.log(`[NotificationService] Current Vietnam time: ${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')} (UTC+7)`);

    // Check each schedule
    for (const schedule of schedules) {
      const scheduleData = schedule as any;
      const [hours, minutes] = scheduleData.time.split(':').map(Number);
      const scheduleTimeInMinutes = hours * 60 + minutes;
      
      console.log(`[NotificationService] Checking schedule: ${scheduleData.time} (Vietnam time), Current: ${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`);
      
      // Calculate time difference (both in Vietnam timezone)
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
      // Push notification is handled by the API route that creates the memory
      console.log('Memory notification triggered for user:', userId);
    } catch (error) {
      console.error('Memory notification error:', error);
    }
  }
}

