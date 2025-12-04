import { NextRequest, NextResponse } from 'next/server';
import { PushNotificationService } from '@/services/push-notification.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { userId, type, data } = await request.json();

    if (!userId || !type) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const pushService = new PushNotificationService();

    let payload;
    let notificationType: string;

    switch (type) {
      case 'memory-from-admin':
        payload = {
          title: '✨ Cậu ấy đã nhớ đến bạn!',
          body: 'Cậu ấy vừa nhấn nút Nhớ. Hãy mở app để xem!',
          icon: '/icon-192x192.png',
          tag: 'memory-from-admin',
          data: {
            url: '/client',
            type: 'memory',
          },
          requireInteraction: false,
          vibrate: [200, 100, 200],
        };
        notificationType = 'memory';
        break;

      case 'memory-from-client':
        payload = {
          title: '✨ Cậu ấy đã nhấn Nhớ!',
          body: 'Cậu ấy vừa nhấn nút Nhớ cho bạn.',
          icon: '/icon-192x192.png',
          tag: 'memory-from-client',
          data: {
            url: '/admin',
            type: 'memory',
          },
          requireInteraction: false,
          vibrate: [200, 100, 200],
        };
        notificationType = 'memory';
        break;

      case 'reaction':
        const emoji = data?.emoji || '😊';
        payload = {
          title: `${emoji} Cậu ấy đã gửi emoji`,
          body: `${emoji} - Cậu ấy vừa gửi emoji phản hồi.`,
          icon: '/icon-192x192.png',
          tag: `reaction-${Date.now()}`,
          data: {
            url: '/admin',
            type: 'reaction',
            emoji,
          },
          requireInteraction: false,
        };
        notificationType = 'reaction';
        break;

      case 'message':
        const messagePreview = data?.content 
          ? (data.content.length > 50 ? data.content.substring(0, 50) + '...' : data.content)
          : 'Có tin nhắn mới';
        payload = {
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
        };
        notificationType = 'message';
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid notification type' },
          { status: 400 }
        );
    }

    // Update tag with notification type for rate limiting
    payload.tag = `${notificationType}-${Date.now()}`;

    const result = await pushService.sendNotification(userId, payload);

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error: any) {
    console.error('Send push notification error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send notification' },
      { status: 500 }
    );
  }
}
