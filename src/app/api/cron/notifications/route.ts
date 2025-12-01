import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/services/notification.service';

// Force dynamic rendering for cron endpoint
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Verify cron secret (for Vercel Cron or similar)
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notificationService = new NotificationService();
    await notificationService.scheduleDailyNotifications();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Cron error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}


