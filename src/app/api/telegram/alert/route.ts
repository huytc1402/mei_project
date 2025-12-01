import { NextRequest, NextResponse } from 'next/server';
import { TelegramService } from '@/services/telegram.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { type, emoji, content, timestamp } = await request.json();

    const telegramService = new TelegramService();

    switch (type) {
      case 'reaction':
        await telegramService.sendReactionAlert(emoji, timestamp);
        break;
      case 'message':
        await telegramService.sendMessageAlert(content, timestamp);
        break;
      case 'memory':
        await telegramService.sendMemoryAlert(timestamp);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid alert type' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Telegram alert error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send alert' },
      { status: 500 }
    );
  }
}


