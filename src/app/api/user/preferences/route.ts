import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET user preferences
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('user_preferences')
      .select('city, horoscope')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is fine
      throw error;
    }

    return NextResponse.json({
      success: true,
      preferences: data || { city: null, horoscope: null },
    });
  } catch (error: any) {
    console.error('Get preferences error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get preferences' },
      { status: 500 }
    );
  }
}

// POST/PUT user preferences
export async function POST(request: NextRequest) {
  try {
    const { userId, city, horoscope } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Use upsert to create or update
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(
        {
          user_id: userId,
          city: city?.trim() || null,
          horoscope: horoscope || null,
          updated_at: new Date().toISOString(),
        } as any,
        {
          onConflict: 'user_id',
        }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      preferences: data,
    });
  } catch (error: any) {
    console.error('Save preferences error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save preferences' },
      { status: 500 }
    );
  }
}
