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

    // HARD LIMIT: Check if admin has already sent memory today (max 1/day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = tomorrow.toISOString();

    const { count: todayCount, error: countError } = await supabase
      .from('memories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', clientUserId)
      .eq('sender_role', 'admin')
      .gte('created_at', todayStart)
      .lt('created_at', tomorrowStart);

    if (countError) throw countError;

    if ((todayCount || 0) >= 1) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Bạn đã gửi năng lượng hôm nay rồi. Hãy đợi đến ngày mai nhé!',
          limitReached: true
        },
        { status: 429 }
      );
    }

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

    // Send SILENT push notification to client (no vibrate, no popup - just badge/icon change)
    const { PushNotificationService } = await import('@/services/push-notification.service');
    const pushService = new PushNotificationService();
    await pushService.sendNotification(clientUserId, {
      title: '✨ Có tin nhắn mới',
      body: 'Có năng lượng mới từ bạn ✨',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: `memory-${Date.now()}`, // Format: "memory-timestamp" for rate limiting
      data: {
        url: '/client',
        type: 'memory',
        silent: true, // Mark as silent
      },
      requireInteraction: false,
      silent: true, // Silent notification - no sound, no vibrate
      // Remove vibrate completely
    }).catch(err => console.error('Push notification error:', err)); // Fire and forget

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

