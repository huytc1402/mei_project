import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '@/services/ai.service';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    
    // Check if message for today already exists
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = tomorrow.toISOString();
    
    const { data: existingNotification } = await supabase
      .from('daily_notifications')
      .select('*')
      .eq('user_id', userId)
      .gte('sent_at', todayStart)
      .lt('sent_at', tomorrowStart)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // If message for today exists, return it
    if (existingNotification) {
      const notif = existingNotification as any;
      return NextResponse.json({
        success: true,
        notification: {
          id: notif.id,
          userId: notif.user_id,
          content: notif.content,
          type: 'ai',
          createdAt: notif.sent_at,
        },
      });
    }

    const aiService = new AIService();

    // Get user's activity from YESTERDAY (for generating today's message)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayStart = yesterday.toISOString();
    
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    const yesterdayEndISO = yesterdayEnd.toISOString();

    // Get all recent activity (last 7 days for context, but focus on yesterday)
    // Parallelize queries and select only needed fields
    const [reactionsResult, messagesResult, memoriesResult] = await Promise.all([
      supabase
        .from('reactions')
        .select('emoji, created_at') // Select only needed fields
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('messages')
        .select('content, created_at') // Select only needed fields
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('memories')
        .select('created_at') // Select only needed fields
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const allReactions = reactionsResult.data || [];
    const allMessages = messagesResult.data || [];
    const allMemories = memoriesResult.data || [];

    // Filter to get yesterday's activity (AI service will handle this, but we pass all for context)
    const { content, emotionLevel } = await aiService.generateDailyMessage(
      allReactions,
      allMessages,
      allMemories
    );

    // Save notification for today
    const { data: notification, error } = await supabase
      .from('daily_notifications')
      .insert({
        user_id: userId,
        content,
        emotion_level: emotionLevel,
      } as any)
      .select()
      .single();

    if (error) throw error;
    if (!notification) throw new Error('Failed to create notification');

    const notif = notification as any;

    return NextResponse.json({
      success: true,
      notification: {
        id: notif.id,
        userId: notif.user_id,
        content: notif.content,
        type: 'ai',
        createdAt: notif.sent_at,
      },
    });
  } catch (error: any) {
    console.error('AI generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate message' },
      { status: 500 }
    );
  }
}


