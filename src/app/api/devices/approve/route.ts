import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { deviceId, action } = await request.json();

    if (!deviceId || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing deviceId or action' },
        { status: 400 }
      );
    }

    if (action !== 'approve' && action !== 'deny') {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    if (action === 'approve') {
      // Approve device - set is_active to true
      const { error } = await (supabase
        .from('devices') as any)
        .update({ is_active: true })
        .eq('id', deviceId);

      if (error) throw error;

      // Get device info for notifications
      const { data: device } = await supabase
        .from('devices')
        .select('*, user_id')
        .eq('id', deviceId)
        .single();

      if (device) {
        const deviceData = device as any;
        const userId = deviceData.user_id;

        // Send Telegram notification to admin
        const { TelegramService } = await import('@/services/telegram.service');
        const telegram = new TelegramService();
        await telegram.sendAlert(
          `✅ Thiết bị đã được xác nhận!\n\n` +
          `Fingerprint: ${deviceData.fingerprint.substring(0, 24)}...\n` +
          `User Agent: ${deviceData.user_agent.substring(0, 50)}...\n` +
          `⏰ ${new Date().toLocaleString('vi-VN')}`
        );

        // Send push notification to client via Supabase realtime
        // Create a notification record that client can listen to
        const { NotificationService } = await import('@/services/notification.service');
        const notificationService = new NotificationService();
        
        // Store device approval notification (client will receive via realtime)
        // Note: device_approvals table might not exist, that's okay - we'll use realtime on devices table
        const { error: insertError } = await supabase.from('device_approvals').insert({
          user_id: userId,
          device_id: deviceId,
          approved_at: new Date().toISOString(),
        } as any);
        
        // Ignore error if table doesn't exist - notification will be sent via realtime subscription on devices table
        if (insertError) {
          console.log('Device approvals table not found or error:', insertError.message);
        }

        // Trigger notification via realtime subscription (client listens to devices table)
        // The client will detect the is_active change and show notification
      }

      return NextResponse.json({ success: true });
    } else {
      // Deny device - delete it
      const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }
  } catch (error: any) {
    console.error('Device approval error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process device approval' },
      { status: 500 }
    );
  }
}

