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
            // Check if device with this fingerprint already exists (even if inactive)
            const { data: existingDevicesByFingerprint } = await supabase
              .from('devices')
              .select('id, is_active')
              .eq('user_id', userId)
              .eq('fingerprint', fingerprint)
              .limit(1);

            if (existingDevicesByFingerprint && existingDevicesByFingerprint.length > 0) {
              // Device exists - update it instead of creating duplicate
              const existingDeviceByFp = existingDevicesByFingerprint[0] as any;
              await (supabase
                .from('devices') as any)
                .update({ 
                  user_agent: userAgent,
                  ip_hash: ipHash,
                  last_seen: new Date().toISOString(),
                })
                .eq('id', existingDeviceByFp.id);

              if (existingDeviceByFp.is_active === false) {
                // Still pending approval
                return NextResponse.json(
                  {
                    success: false,
                    error: 'Thiết bị mới được phát hiện. Vui lòng chờ xác nhận từ admin.',
                  },
                  { status: 403 }
                );
              }
              // Device is active, continue with login (no need to create new device)
            } else {
              // Truly new device - create with is_active = false (pending approval)
              const { data: newDevice, error: deviceInsertError } = await supabase
                .from('devices')
                .insert({
                  user_id: userId,
                  fingerprint,
                  user_agent: userAgent,
                  ip_hash: ipHash,
                  is_active: false, // Chờ admin approval
                } as any)
                .select()
                .single();

              if (deviceInsertError) {
                console.error('❌ Error creating device:', deviceInsertError);
                // Check if device already exists (unique constraint violation)
                if (deviceInsertError.code === '23505') {
                  console.log('Device already exists (duplicate key), checking status...');
                  // Try to get the existing device
                  const { data: existingDeviceData } = await supabase
                    .from('devices')
                    .select('id, is_active')
                    .eq('user_id', userId)
                    .eq('fingerprint', fingerprint)
                    .limit(1)
                    .maybeSingle();

                  if (existingDeviceData) {
                    const deviceData = existingDeviceData as any;
                    // Update last_seen for existing device
                    await (supabase
                      .from('devices') as any)
                      .update({ last_seen: new Date().toISOString() })
                      .eq('id', deviceData.id);

                    if (deviceData.is_active === false) {
                      return NextResponse.json(
                        {
                          success: false,
                          error: 'Thiết bị mới được phát hiện. Vui lòng chờ xác nhận từ admin.',
                        },
                        { status: 403 }
                      );
                    }
                    // Device is active, continue with login
                  } else {
                    // Device exists but couldn't fetch - return error
                    return NextResponse.json(
                      {
                        success: false,
                        error: 'Lỗi khi kiểm tra thiết bị. Vui lòng thử lại.',
                      },
                      { status: 500 }
                    );
                  }
                } else {
                  // Other error - still return error to user
                  return NextResponse.json(
                    {
                      success: false,
                      error: 'Lỗi khi tạo thiết bị. Vui lòng thử lại.',
                    },
                    { status: 500 }
                  );
                }
              } else if (newDevice) {
                console.log('✅ New device created successfully:', (newDevice as any).id);
                
                // New device detected - need admin approval
                // Send Telegram notification (will log if not configured)
                try {
                  const { TelegramService } = await import('@/services/telegram.service');
                  const telegram = new TelegramService();
                  await telegram.sendNewDeviceAlert(
                    `User ID: ${userId}\nFingerprint: ${fingerprint.substring(0, 16)}...\nUser Agent: ${userAgent.substring(0, 50)}...`,
                    new Date().toLocaleString('vi-VN')
                  );
                  console.log('✅ Telegram notification sent for new device');
                } catch (telegramError) {
                  console.error('❌ Telegram notification error:', telegramError);
                  // Continue - notification failure shouldn't block device creation
                }

                return NextResponse.json(
                  {
                    success: false,
                    error: 'Thiết bị mới được phát hiện. Vui lòng chờ xác nhận từ admin.',
                  },
                  { status: 403 }
                );
              }
            }
          }

          // Update last seen for existing active device
          await (supabase
            .from('devices') as any)
            .update({ 
              last_seen: new Date().toISOString(),
              user_agent: userAgent, // Update user agent in case it changed
              ip_hash: ipHash, // Update IP hash in case it changed
            })
            .eq('id', existingDevice.id);
        } else {
          // First device - check if exists first to avoid duplicates
          const { data: existingDevice } = await supabase
            .from('devices')
            .select('id')
            .eq('user_id', userId)
            .eq('fingerprint', fingerprint)
            .limit(1)
            .maybeSingle();

          if (!existingDevice) {
            // Only insert if doesn't exist
            const { error: insertError } = await supabase.from('devices').insert({
              user_id: userId,
              fingerprint,
              user_agent: userAgent,
              ip_hash: ipHash,
              is_active: true,
            } as any);

            if (insertError && insertError.code !== '23505') {
              // Ignore duplicate key errors, log others
              console.error('First device insert error:', insertError);
            }
          } else {
            // Update last_seen if device exists
            await (supabase
              .from('devices') as any)
              .update({ last_seen: new Date().toISOString() })
              .eq('id', (existingDevice as any).id);
          }
        }
      } else {
        // Admin - check if exists first to avoid duplicates
        const { data: devices } = await supabase
          .from('devices')
          .select('*')
          .eq('user_id', userId)
          .eq('fingerprint', fingerprint)
          .limit(1);

        if (devices && devices.length > 0 && devices[0]) {
          // Update existing device
          await (supabase
            .from('devices') as any)
            .update({ 
              last_seen: new Date().toISOString(),
              user_agent: userAgent,
              ip_hash: ipHash,
            })
            .eq('id', (devices[0] as any).id);
        } else {
          // Insert new device
          const { error: insertError } = await supabase.from('devices').insert({
            user_id: userId,
            fingerprint,
            user_agent: userAgent,
            ip_hash: ipHash,
            is_active: true,
          } as any);

          if (insertError && insertError.code !== '23505') {
            // Ignore duplicate key errors, log others
            console.error('Admin device insert error:', insertError);
          }
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

      // Check if device exists before inserting to avoid duplicates
      const { data: existingDevice } = await supabase
        .from('devices')
        .select('id')
        .eq('user_id', userId)
        .eq('fingerprint', fingerprint)
        .limit(1)
        .maybeSingle();

      if (!existingDevice) {
        const { error: insertError } = await supabase.from('devices').insert({
          user_id: userId,
          fingerprint,
          user_agent: userAgent,
          ip_hash: ipHash,
          is_active: true,
        } as any);

        if (insertError && insertError.code !== '23505') {
          // Ignore duplicate key errors, log others
          console.error('New user device insert error:', insertError);
        }
      } else {
        // Update last_seen if device exists
        await (supabase
          .from('devices') as any)
          .update({ last_seen: new Date().toISOString() })
          .eq('id', existingDevice as any).id;
      }
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

