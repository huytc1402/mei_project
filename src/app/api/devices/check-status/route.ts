import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateFingerprint } from '@/lib/utils/device';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { token, fingerprint } = await request.json();

    if (!token || !fingerprint) {
      return NextResponse.json(
        { success: false, error: 'Missing token or fingerprint' },
        { status: 400 }
      );
    }

    // Verify token
    const adminToken = process.env.ADMIN_TOKEN;
    const clientToken = process.env.CLIENT_TOKEN;

    let role: 'admin' | 'client' | null = null;
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

    // Get user
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('role', role)
      .limit(1);

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        isApproved: true, // New user, no device yet
        needsApproval: false,
      });
    }

    const userId = (users[0] as any).id;

    // Check device status
    const { data: devices } = await supabase
      .from('devices')
      .select('id, is_active')
      .eq('user_id', userId)
      .eq('fingerprint', fingerprint)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!devices || devices.length === 0) {
      // No device found - check if there are any active devices
      const { data: activeDevices } = await supabase
        .from('devices')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1);

      if (activeDevices && activeDevices.length > 0) {
        // There are active devices but this fingerprint is new - needs approval
        return NextResponse.json({
          success: true,
          isApproved: false,
          needsApproval: true,
        });
      } else {
        // First device - will be auto-approved
        return NextResponse.json({
          success: true,
          isApproved: true,
          needsApproval: false,
        });
      }
    }

    const device = devices[0] as any;
    return NextResponse.json({
      success: true,
      isApproved: device.is_active === true,
      needsApproval: device.is_active === false,
    });
  } catch (error: any) {
    console.error('Check device status error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check device status' },
      { status: 500 }
    );
  }
}

