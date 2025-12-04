import { NextRequest, NextResponse } from 'next/server';
import { PushNotificationService } from '@/services/push-notification.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    console.log('📥 [API] /api/push/subscribe - Request received');
    const { userId, subscription, userAgent } = await request.json();
    console.log('📦 [API] Request data:', {
      userId,
      hasSubscription: !!subscription,
      hasEndpoint: !!subscription?.endpoint,
      hasKeys: !!subscription?.keys,
      userAgent,
    });

    if (!userId || !subscription || !subscription.endpoint || !subscription.keys) {
      console.error('❌ [API] Missing required fields');
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('💾 [API] Saving subscription to database...');
    const pushService = new PushNotificationService();
    await pushService.saveSubscription(userId, subscription, userAgent);
    console.log('✅ [API] Subscription saved successfully');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ [API] Subscribe error:', error);
    console.error('  - Message:', error.message);
    console.error('  - Stack:', error.stack);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to subscribe' },
      { status: 500 }
    );
  }
}
