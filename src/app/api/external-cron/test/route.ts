import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Test endpoint để kiểm tra cron setup
 * Có thể gọi trực tiếp từ browser hoặc cron-job.org để test
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    
    // Get active schedules count
    const { data: schedules, error: schedulesError } = await supabase
      .from('notification_schedules')
      .select('id, time, is_active')
      .eq('is_active', true);

    // Get client users count
    const { data: clientUsers, error: usersError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'client');

    // Get today's notifications count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = tomorrow.toISOString();

    const { data: todayNotifications, error: notifError } = await supabase
      .from('daily_notifications')
      .select('id, user_id, sent_at')
      .gte('sent_at', todayStart)
      .lt('sent_at', tomorrowStart);

    const now = new Date();
    const currentTime = now.toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh'
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      currentTime: currentTime,
      timezone: 'Asia/Ho_Chi_Minh',
      stats: {
        activeSchedules: schedules?.length || 0,
        schedules: schedules || [],
        clientUsers: clientUsers?.length || 0,
        todayNotifications: todayNotifications?.length || 0,
      },
      errors: {
        schedules: schedulesError?.message,
        users: usersError?.message,
        notifications: notifError?.message,
      },
      info: {
        message: 'Cron endpoint is accessible. Use /api/external-cron/notifications for actual cron job.',
        cronUrl: '/api/external-cron/notifications',
      },
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
