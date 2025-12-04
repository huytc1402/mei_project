import { NextRequest, NextResponse } from 'next/server';
import { TelegramService } from '@/services/telegram.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { type, emoji, content, timestamp, userId } = await request.json();

    const telegramService = new TelegramService();

    // Send Telegram notification
    switch (type) {
      case 'reaction':
        await telegramService.sendReactionAlert(emoji, timestamp);
        break;
      case 'message':
        await telegramService.sendMessageAlert(content, timestamp);
        break;
      case 'memory':
        await telegramService.sendMemoryAlert(timestamp);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid alert type' },
          { status: 400 }
        );
    }

    // Also send push notification to admin if reaction or message
    if ((type === 'reaction' || type === 'message') && userId) {
      try {
        const supabase = (await import('@/lib/supabase/admin')).createAdminClient();
        const { data: adminUsers } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'admin')
          .limit(1);

        if (adminUsers && adminUsers.length > 0) {
          const adminUserId = (adminUsers[0] as any).id;
          const { PushNotificationService } = await import('@/services/push-notification.service');
          const pushService = new PushNotificationService();

          if (type === 'reaction') {
            await pushService.sendNotification(adminUserId, {
              title: `${emoji || '😊'} Cậu ấy đã gửi emoji`,
              body: `${emoji || '😊'} - Cậu ấy vừa gửi emoji phản hồi.`,
              icon: '/icon-192x192.png',
              tag: `reaction-${Date.now()}`,
              data: {
                url: '/admin',
                type: 'reaction',
                emoji: emoji || '😊',
              },
              requireInteraction: false,
            }).catch(err => console.error('Push notification error:', err));
          } else if (type === 'message') {
            const messagePreview = content 
              ? (content.length > 50 ? content.substring(0, 50) + '...' : content)
              : 'Có tin nhắn mới';
            await pushService.sendNotification(adminUserId, {
              title: '💬 Có tin nhắn mới',
              body: messagePreview,
              icon: '/icon-192x192.png',
              tag: `message-${Date.now()}`,
              data: {
                url: '/admin',
                type: 'message',
              },
              requireInteraction: false,
              vibrate: [200, 100, 200],
            }).catch(err => console.error('Push notification error:', err));
          }
        }
      } catch (error) {
        console.error('Push notification error:', error);
        // Non-critical, don't fail the request
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Telegram alert error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send alert' },
      { status: 500 }
    );
  }
}


