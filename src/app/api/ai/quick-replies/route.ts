import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '@/services/ai.service';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    //bổ sung
      const authHeader = request.headers.get('authorization');
      const userId = request.headers.get('x-user-id');
      
      if (!authHeader || !userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    //  
    const { message, seed } = await request.json();


    // const { message, userId } = await request.json(); gốc
    
    if (!message || !userId) {
      return NextResponse.json(
        { error: 'Message and User ID required' },
        { status: 400 }
      );
    }
    
    // Seed is used to ensure different results on each request (ignored but helps with caching)

    const supabase = createAdminClient();
    const aiService = new AIService();

    // Get context - parallelize queries and select only needed fields
    const [reactionsResult, messagesResult] = await Promise.all([
      supabase
        .from('reactions')
        .select('emoji, created_at') // Select only needed fields
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('messages')
        .select('content, created_at') // Select only needed fields
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const reactions = reactionsResult.data || [];
    const messages = messagesResult.data || [];

    const replies = await aiService.generateQuickReplies(message, {
      reactions: reactions,
      messages: messages,
    });

    return NextResponse.json({
      success: true,
      replies,
    });
  } catch (error: any) {
    console.error('Quick replies error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate replies' },
      { status: 500 }
    );
  }
}


