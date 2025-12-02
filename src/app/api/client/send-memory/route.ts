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

