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

    // Get or create user - ensure only 1 user per role
    let userId: string;
    
    // Always check for existing user first
    const { data: existingUsers, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('role', role)
      .order('created_at', { ascending: true });

    if (userError) throw userError;

    if (existingUsers && existingUsers.length > 0) {
      // User exists - use the first one (oldest)
      userId = (existingUsers[0] as any).id;
      
      // Delete duplicates if any (keep only the first one)
      if (existingUsers.length > 1) {
        const duplicateIds = existingUsers.slice(1).map((u: any) => u.id);
        await supabase
          .from('users')
          .delete()
          .in('id', duplicateIds);
      }
    } else {
      // No user exists - create one
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({ role } as any)
        .select()
        .single();

      if (createError) {
        // If any error, check again and use existing (race condition)
        const { data: checkUsers } = await supabase
          .from('users')
          .select('id')
          .eq('role', role)
          .order('created_at', { ascending: true });
        if (checkUsers && checkUsers.length > 0) {
          userId = (checkUsers[0] as any).id;
          // Delete duplicates
          if (checkUsers.length > 1) {
            const duplicateIds = checkUsers.slice(1).map((u: any) => u.id);
            await supabase
              .from('users')
              .delete()
              .in('id', duplicateIds);
          }
        } else {
          throw createError;
        }
      } else if (newUser) {
        userId = (newUser as any).id;
        // Double-check: delete any duplicates that might have been created
        const { data: allUsers } = await supabase
          .from('users')
          .select('id')
          .eq('role', role)
          .order('created_at', { ascending: true });
        if (allUsers && allUsers.length > 1) {
          // Keep first, delete rest
          userId = (allUsers[0] as any).id;
          const duplicateIds = allUsers.slice(1).map((u: any) => u.id);
          await supabase
            .from('users')
            .delete()
            .in('id', duplicateIds);
        }
      } else {
        throw new Error('Failed to create user');
      }
    }

    // Handle device - ensure no duplicates
    if (role === 'admin') {
      // Admin: Always auto-approved
      // Check for existing device first
      const { data: existingDevices } = await supabase
        .from('devices')
        .select('id')
        .eq('user_id', userId)
        .eq('fingerprint', fingerprint)
        .order('created_at', { ascending: true });

      if (existingDevices && existingDevices.length > 0) {
        // Device exists - update the first one (oldest)
        const deviceId = (existingDevices[0] as any).id;
        const { error: updateError } = await (supabase
          .from('devices') as any)
          .update({
            user_agent: userAgent,
            ip_hash: ipHash,
            is_active: true,
            last_seen: new Date().toISOString(),
          })
          .eq('id', deviceId);

        if (updateError) throw updateError;
        
        // Delete duplicates if any
        if (existingDevices.length > 1) {
          const duplicateIds = existingDevices.slice(1).map((d: any) => d.id);
          await supabase
            .from('devices')
            .delete()
            .in('id', duplicateIds);
        }
      } else {
        // Insert new device
        const { error: insertError } = await supabase
          .from('devices')
          .insert({
            user_id: userId,
            fingerprint,
            user_agent: userAgent,
            ip_hash: ipHash,
            is_active: true,
            last_seen: new Date().toISOString(),
          } as any);

        if (insertError) {
          // If any error, check again and update existing
          const { data: checkDevices } = await supabase
            .from('devices')
            .select('id')
            .eq('user_id', userId)
            .eq('fingerprint', fingerprint)
            .order('created_at', { ascending: true });

          if (checkDevices && checkDevices.length > 0) {
            const deviceId = (checkDevices[0] as any).id;
            await (supabase
              .from('devices') as any)
              .update({
                user_agent: userAgent,
                ip_hash: ipHash,
                is_active: true,
                last_seen: new Date().toISOString(),
              })
              .eq('id', deviceId);
            
            // Delete duplicates
            if (checkDevices.length > 1) {
              const duplicateIds = checkDevices.slice(1).map((d: any) => d.id);
              await supabase
                .from('devices')
                .delete()
                .in('id', duplicateIds);
            }
          } else {
            throw insertError;
          }
        } else {
          // Double-check: delete any duplicates that might have been created
          const { data: allDevices } = await supabase
            .from('devices')
            .select('id')
            .eq('user_id', userId)
            .eq('fingerprint', fingerprint)
            .order('created_at', { ascending: true });
          
          if (allDevices && allDevices.length > 1) {
            // Keep first, delete rest
            const deviceId = (allDevices[0] as any).id;
            await (supabase
              .from('devices') as any)
              .update({
                user_agent: userAgent,
                ip_hash: ipHash,
                is_active: true,
                last_seen: new Date().toISOString(),
              })
              .eq('id', deviceId);
            
            const duplicateIds = allDevices.slice(1).map((d: any) => d.id);
            await supabase
              .from('devices')
              .delete()
              .in('id', duplicateIds);
          }
        }
      }
    } else {
      // Client: Check device status
      // First, check if device with this fingerprint exists
      const { data: existingDevicesByFp } = await supabase
        .from('devices')
        .select('id, is_active, fingerprint')
        .eq('user_id', userId)
        .eq('fingerprint', fingerprint)
        .order('created_at', { ascending: true });

      if (existingDevicesByFp && existingDevicesByFp.length > 0) {
        // Device exists - update the first one (oldest)
        const existingDevice = existingDevicesByFp[0] as any;
        const { error: updateError } = await (supabase
          .from('devices') as any)
          .update({
            user_agent: userAgent,
            ip_hash: ipHash,
            last_seen: new Date().toISOString(),
          })
          .eq('id', existingDevice.id);

        if (updateError) throw updateError;
        
        // Delete duplicates if any
        if (existingDevicesByFp.length > 1) {
          const duplicateIds = existingDevicesByFp.slice(1).map((d: any) => d.id);
          await supabase
            .from('devices')
            .delete()
            .in('id', duplicateIds);
        }

        // If device is inactive (revoked), require admin approval again
        if (!existingDevice.is_active) {
          // Update device info but keep is_active = false
          const { error: updateError2 } = await (supabase
            .from('devices') as any)
            .update({
              user_agent: userAgent,
              ip_hash: ipHash,
              last_seen: new Date().toISOString(),
              // Keep is_active = false (revoked)
            })
            .eq('id', existingDevice.id);

          if (updateError2) throw updateError2;

          // Send notification to admin about re-approval request
          try {
            const { TelegramService } = await import('@/services/telegram.service');
            const telegram = new TelegramService();
            await telegram.sendNewDeviceAlert(
              `Thiết bị đã bị thu hồi yêu cầu duyệt lại!\nUser ID: ${userId}\nFingerprint: ${fingerprint.substring(0, 16)}...\nUser Agent: ${userAgent.substring(0, 50)}...`,
              new Date().toLocaleString('vi-VN')
            );
          } catch (telegramError) {
            console.error('Telegram notification error:', telegramError);
          }

          return NextResponse.json(
            {
              success: false,
              error: 'Quyền truy cập của bạn đã bị thu hồi. Vui lòng chờ admin duyệt lại.',
            },
            { status: 403 }
          );
        }
      } else {
        // New device - check if there are any active devices
        const { data: activeDevices } = await supabase
          .from('devices')
          .select('id')
          .eq('user_id', userId)
          .eq('is_active', true)
          .limit(1);

        const isFirstDevice = !activeDevices || activeDevices.length === 0;
        const isActive = isFirstDevice; // Auto-approve first device

        // Insert new device
        const { error: insertError } = await supabase
          .from('devices')
          .insert({
            user_id: userId,
            fingerprint,
            user_agent: userAgent,
            ip_hash: ipHash,
            is_active: isActive,
            last_seen: new Date().toISOString(),
          } as any);

        if (insertError) {
          // If any error, check again and update existing
          const { data: checkDevices } = await supabase
            .from('devices')
            .select('id, is_active')
            .eq('user_id', userId)
            .eq('fingerprint', fingerprint)
            .order('created_at', { ascending: true });

          if (checkDevices && checkDevices.length > 0) {
            const checkDevice = checkDevices[0] as any;
            
            // If device is inactive (revoked), require admin approval again
            if (!checkDevice.is_active) {
              // Update device info but keep is_active = false
              await (supabase
                .from('devices') as any)
                .update({
                  user_agent: userAgent,
                  ip_hash: ipHash,
                  last_seen: new Date().toISOString(),
                  // Keep is_active = false (revoked)
                })
                .eq('id', checkDevice.id);
              
              // Delete duplicates
              if (checkDevices.length > 1) {
                const duplicateIds = checkDevices.slice(1).map((d: any) => d.id);
                await supabase
                  .from('devices')
                  .delete()
                  .in('id', duplicateIds);
              }

              // Send notification to admin
              try {
                const { TelegramService } = await import('@/services/telegram.service');
                const telegram = new TelegramService();
                await telegram.sendNewDeviceAlert(
                  `Thiết bị đã bị thu hồi yêu cầu duyệt lại!\nUser ID: ${userId}\nFingerprint: ${fingerprint.substring(0, 16)}...\nUser Agent: ${userAgent.substring(0, 50)}...`,
                  new Date().toLocaleString('vi-VN')
                );
              } catch (telegramError) {
                console.error('Telegram notification error:', telegramError);
              }

              return NextResponse.json(
                {
                  success: false,
                  error: 'Quyền truy cập của bạn đã bị thu hồi. Vui lòng chờ admin duyệt lại.',
                },
                { status: 403 }
              );
            }

            // Device is active - update it
            await (supabase
              .from('devices') as any)
              .update({
                user_agent: userAgent,
                ip_hash: ipHash,
                is_active: isActive,
                last_seen: new Date().toISOString(),
              })
              .eq('id', checkDevice.id);
            
            // Delete duplicates
            if (checkDevices.length > 1) {
              const duplicateIds = checkDevices.slice(1).map((d: any) => d.id);
              await supabase
                .from('devices')
                .delete()
                .in('id', duplicateIds);
            }
          } else {
            throw insertError;
          }
        } else {
          // Double-check: delete any duplicates that might have been created
          const { data: allDevices } = await supabase
            .from('devices')
            .select('id, is_active')
            .eq('user_id', userId)
            .eq('fingerprint', fingerprint)
            .order('created_at', { ascending: true });
          
          if (allDevices && allDevices.length > 1) {
            // Keep first, delete rest
            const firstDevice = allDevices[0] as any;
            await (supabase
              .from('devices') as any)
              .update({
                user_agent: userAgent,
                ip_hash: ipHash,
                is_active: isActive,
                last_seen: new Date().toISOString(),
              })
              .eq('id', firstDevice.id);
            
            const duplicateIds = allDevices.slice(1).map((d: any) => d.id);
            await supabase
              .from('devices')
              .delete()
              .in('id', duplicateIds);
          }
        }

        // If not first device, send notification and return error
        if (!isFirstDevice) {
          try {
            const { TelegramService } = await import('@/services/telegram.service');
            const telegram = new TelegramService();
            await telegram.sendNewDeviceAlert(
              `User ID: ${userId}\nFingerprint: ${fingerprint.substring(0, 16)}...\nUser Agent: ${userAgent.substring(0, 50)}...`,
              new Date().toLocaleString('vi-VN')
            );
          } catch (telegramError) {
            console.error('Telegram notification error:', telegramError);
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
