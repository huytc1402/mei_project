import { NextRequest, NextResponse } from 'next/server';
import { PushNotificationService } from '@/services/push-notification.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { userId, subscription, userAgent } = await request.json();

    if (!userId || !subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const pushService = new PushNotificationService();
    await pushService.saveSubscription(userId, subscription, userAgent);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Subscribe error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to subscribe' },
      { status: 500 }
    );
  }
}
