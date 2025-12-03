import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { UserRole } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token không được để trống' },
        { status: 400 }
      );
    }

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
      .order('created_at', { ascending: true })
      .limit(1);

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
          .order('created_at', { ascending: true })
          .limit(1);
        
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
