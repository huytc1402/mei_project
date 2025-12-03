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

    if (action !== 'approve' && action !== 'deny' && action !== 'revoke') {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get device info first
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('*, user_id')
      .eq('id', deviceId)
      .single();

    if (deviceError || !device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      );
    }

    const deviceData = device as any;
    const userId = deviceData.user_id;

    if (action === 'approve') {
      // Approve device - set is_active to true
      const { error } = await (supabase
        .from('devices') as any)
        .update({ is_active: true })
        .eq('id', deviceId);

      if (error) throw error;

      // Send Telegram notification
      try {
        const { TelegramService } = await import('@/services/telegram.service');
        const telegram = new TelegramService();
        await telegram.sendAlert(
          `✅ Thiết bị đã được xác nhận!\n\n` +
          `Fingerprint: ${deviceData.fingerprint.substring(0, 24)}...\n` +
          `User Agent: ${deviceData.user_agent.substring(0, 50)}...\n` +
          `⏰ ${new Date().toLocaleString('vi-VN')}`
        );
      } catch (telegramError) {
        console.error('Telegram notification error:', telegramError);
      }

      return NextResponse.json({ success: true });
    } else if (action === 'revoke') {
      // Revoke device - set is_active to false, add revoked_at timestamp, and delete all related data
      // Device stays in DB but won't show in pending list (revoked_at IS NOT NULL)
      // Client must re-request approval (will create new device entry)
      
      // Delete all related data for this user first
      await Promise.all([
        supabase.from('reactions').delete().eq('user_id', userId),
        supabase.from('messages').delete().eq('user_id', userId),
        supabase.from('memories').delete().eq('user_id', userId),
        supabase.from('daily_notifications').delete().eq('user_id', userId),
      ]);

      // Mark device as revoked (set is_active = false and revoked_at = now)
      // This makes device disappear from pending list but keeps history
      const { error: updateError } = await (supabase
        .from('devices') as any)
        .update({ 
          is_active: false,
          revoked_at: new Date().toISOString(),
        })
        .eq('id', deviceId);

      if (updateError) throw updateError;

      // Send Telegram notification
      try {
        const { TelegramService } = await import('@/services/telegram.service');
        const telegram = new TelegramService();
        await telegram.sendAlert(
          `🔒 Thiết bị đã bị thu hồi quyền truy cập!\n\n` +
          `Fingerprint: ${deviceData.fingerprint.substring(0, 24)}...\n` +
          `User Agent: ${deviceData.user_agent.substring(0, 50)}...\n` +
          `⏰ ${new Date().toLocaleString('vi-VN')}`
        );
      } catch (telegramError) {
        console.error('Telegram notification error:', telegramError);
      }

      return NextResponse.json({ success: true });
    } else {
      // Deny device - delete it completely
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
