import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { UserRole } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { token, fingerprint, userAgent, ipHash } = await request.json();

    // Verify token
    const adminToken = process.env.ADMIN_TOKEN;
    const clientToken = process.env.CLIENT_TOKEN;

    let role: UserRole | null = null;
    if (token === adminToken) {
      role = 'admin';
    } else if (token === clientToken) {
      role = 'client';
    } else {
      return NextResponse.json(
        { success: false, error: 'Token không hợp lệ' },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();

    // Check if user exists
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('role', role)
      .limit(1);

    if (userError) throw userError;

    let userId: string;

    if (users && users.length > 0 && users[0]) {
      userId = (users[0] as any).id;

      // Check existing devices for client
      if (role === 'client') {
        const { data: devices, error: deviceError } = await supabase
          .from('devices')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true);

        if (deviceError) throw deviceError;

        if (devices && devices.length > 0) {
          const existingDevice = devices.find(
            (d: any) => d.fingerprint === fingerprint
          ) as any;

          if (!existingDevice) {
            // Create new device with is_active = false (pending approval)
            await supabase.from('devices').insert({
              user_id: userId,
              fingerprint,
              user_agent: userAgent,
              ip_hash: ipHash,
              is_active: false, // Chờ admin approval
            } as any);
          
            // New device detected - need admin approval
            const { TelegramService } = await import('@/services/telegram.service');
            const telegram = new TelegramService();
            await telegram.sendNewDeviceAlert(
              `User ID: ${userId}\nFingerprint: ${fingerprint.substring(0, 16)}...\nUser Agent: ${userAgent.substring(0, 50)}...`,
              new Date().toLocaleString('vi-VN')
            );

            return NextResponse.json(
              {
                success: false,
                error: 'Thiết bị mới được phát hiện. Vui lòng chờ xác nhận từ admin.',
              },
              { status: 403 }
            );
          }

          // Update last seen
          await (supabase
            .from('devices') as any)
            .update({ last_seen: new Date().toISOString() })
            .eq('id', existingDevice.id);
        } else {
          // First device - create it
          await supabase.from('devices').insert({
            user_id: userId,
            fingerprint,
            user_agent: userAgent,
            ip_hash: ipHash,
            is_active: true,
          } as any);
        }
      } else {
        // Admin - just update/create device
        const { data: devices } = await supabase
          .from('devices')
          .select('*')
          .eq('user_id', userId)
          .eq('fingerprint', fingerprint)
          .limit(1);

        if (devices && devices.length > 0 && devices[0]) {
          await (supabase
            .from('devices') as any)
            .update({ last_seen: new Date().toISOString() })
            .eq('id', (devices[0] as any).id);
        } else {
          await supabase.from('devices').insert({
            user_id: userId,
            fingerprint,
            user_agent: userAgent,
            ip_hash: ipHash,
            is_active: true,
          } as any);
        }
      }
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({ role } as any)
        .select()
        .single();

      if (createError) throw createError;
      if (!newUser) throw new Error('Failed to create user');
      userId = (newUser as any).id;

      await supabase.from('devices').insert({
        user_id: userId,
        fingerprint,
        user_agent: userAgent,
        ip_hash: ipHash,
        is_active: true,
      } as any);
    }

    return NextResponse.json({
      success: true,
      userId,
      role,
    });
  } catch (error: any) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Đăng nhập thất bại' },
      { status: 500 }
    );
  }
}

