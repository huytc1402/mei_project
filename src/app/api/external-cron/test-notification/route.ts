import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/services/notification.service';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Test endpoint để trigger notification ngay lập tức
 * Sử dụng để test mà không cần đợi đến giờ schedule
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      );
    }

    const notificationService = new NotificationService();
    
    // Force send notification (bypass schedule check)
    await notificationService.sendDailyNotification(userId);

    return NextResponse.json({
      success: true,
      message: 'Test notification sent',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Test notification error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint để xem thông tin debug
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const userId = request.nextUrl.searchParams.get('userId');
    
    const results: any = {
      timestamp: new Date().toISOString(),
      currentTime: new Date().toLocaleString('vi-VN', { 
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    if (userId) {
      // Check user info
      const { data: user } = await supabase
        .from('users')
        .select('id, role, email')
        .eq('id', userId)
        .single();

      // Check push subscriptions
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, is_active, created_at')
        .eq('user_id', userId)
        .eq('is_active', true);

      // Check today's notifications
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.toISOString();
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStart = tomorrow.toISOString();

      const { data: todayNotifications } = await supabase
        .from('daily_notifications')
        .select('id, content, sent_at')
        .eq('user_id', userId)
        .gte('sent_at', todayStart)
        .lt('sent_at', tomorrowStart)
        .order('sent_at', { ascending: false });

      results.user = user;
      results.pushSubscriptions = subscriptions || [];
      results.todayNotifications = todayNotifications || [];
      results.hasSubscription = (subscriptions || []).length > 0;
      results.hasNotificationToday = (todayNotifications || []).length > 0;
    }

    // Check active schedules
    const { data: schedules } = await supabase
      .from('notification_schedules')
      .select('id, time, is_active')
      .eq('is_active', true)
      .order('time', { ascending: true });

    results.activeSchedules = schedules || [];

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error: any) {
    console.error('Test endpoint error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
