import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NotificationService } from '@/services/notification.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Get admin user from request (should be authenticated)
    // For now, we'll get the client user ID
    const supabase = createAdminClient();
    
    // Get the client user (there should be only one)
    const { data: clientUsers, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'client')
      .limit(1);

    if (userError) throw userError;
    if (!clientUsers || clientUsers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No client user found' },
        { status: 404 }
      );
    }

    const clientUserId = (clientUsers[0] as any).id;

    // Save admin memory to database
    const { data: memory, error: memoryError } = await supabase
      .from('memories')
      .insert({
        user_id: clientUserId,
        sender_role: 'admin', // Mark as sent by admin
      } as any)
      .select()
      .single();

    if (memoryError) throw memoryError;
    if (!memory) {
      return NextResponse.json(
        { success: false, error: 'Failed to create memory' },
        { status: 500 }
      );
    }

    // Send Telegram notification
    const { TelegramService } = await import('@/services/telegram.service');
    const telegramService = new TelegramService();
    await telegramService.sendAlert(
      `✨ Đã gửi "Nhớ" cho cậu ấy!\n⏰ ${new Date().toLocaleString('vi-VN')}`
    );

    // Send push notification to client (via realtime)
    const notificationService = new NotificationService();
    await notificationService.sendMemoryNotification(clientUserId);

    return NextResponse.json({
      success: true,
      message: 'Memory sent successfully',
      memoryId: (memory as any).id,
    });
  } catch (error: any) {
    console.error('Send memory error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send memory' },
      { status: 500 }
    );
  }
}

