import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { TelegramService } from '@/services/telegram.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    
    // Get admin user
    const { data: adminUsers } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1);

    if (!adminUsers || adminUsers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No admin user found' },
        { status: 404 }
      );
    }

    // Send Telegram notification to admin
    const telegramService = new TelegramService();
    await telegramService.sendAlert(
      `✨ Cậu ấy đã nhấn "Nhớ"!\n ⏰ ${new Date().toLocaleString('vi-VN')}`
    );

    // Send push notification to admin
    const adminUserId = (adminUsers[0] as any).id;
    const { PushNotificationService } = await import('@/services/push-notification.service');
    const pushService = new PushNotificationService();
    await pushService.sendNotification(adminUserId, {
      title: '✨ Cậu ấy đã nhấn Nhớ!',
      body: 'Cậu ấy vừa nhấn nút Nhớ cho bạn.',
      icon: '/icon-192x192.png',
      tag: `memory-${Date.now()}`, // Format: "memory-timestamp" for rate limiting
      data: {
        url: '/admin',
        type: 'memory',
      },
      requireInteraction: false,
      vibrate: [200, 100, 200],
    }).catch(err => console.error('Push notification error:', err)); // Fire and forget

    return NextResponse.json({
      success: true,
      message: 'Memory notification sent to admin',
    });
  } catch (error: any) {
    console.error('Send memory error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send memory' },
      { status: 500 }
    );
  }
}

