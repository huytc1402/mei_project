import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/services/notification.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Get token from query parameter or header
    const token = request.nextUrl.searchParams.get('token') || 
                  request.headers.get('x-cron-token');
    const cronToken = process.env.EXTERNAL_CRON_TOKEN;

    // Verify token
    if (!cronToken || token !== cronToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notificationService = new NotificationService();
    await notificationService.scheduleDailyNotifications();

    return NextResponse.json({ 
      success: true,
      message: 'Notifications processed',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('External cron error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

