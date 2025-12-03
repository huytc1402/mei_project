import TelegramBot from 'node-telegram-bot-api';

export class TelegramService {
  private bot: TelegramBot | null = null;
  private chatId: string;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_ADMIN_CHAT_ID || '';

    if (token) {
      this.bot = new TelegramBot(token, { polling: false });
    }
  }

  async sendAlert(message: string): Promise<void> {
    if (!this.bot || !this.chatId) {
      console.warn('⚠️ Telegram bot not configured. Missing:', 
        !this.bot ? 'TELEGRAM_BOT_TOKEN' : '', 
        !this.chatId ? 'TELEGRAM_ADMIN_CHAT_ID' : ''
      );
      console.log('Telegram alert (mock):', message);
      return;
    }

    try {
      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'HTML',
      });
      console.log('✅ Telegram notification sent successfully');
    } catch (error: any) {
      console.error('❌ Telegram send error:', error.message || error);
      // Log more details for debugging
      if (error.response) {
        console.error('Telegram API response:', error.response);
      }
    }
  }

  async sendReactionAlert(emoji: string, timestamp: string): Promise<void> {
    const message = `❤️ Cậu ấy đã phản hồi: ${emoji}\n⏰ ${timestamp}`;
    await this.sendAlert(message);
  }

  async sendMessageAlert(content: string, timestamp: string): Promise<void> {
    const message = `💬 Tin nhắn mới:\n"${content}"\n⏰ ${timestamp}`;
    await this.sendAlert(message);
  }

  async sendMemoryAlert(timestamp: string): Promise<void> {
    const message = `✨ Cậu ấy đã nhấn "Nhớ" lúc ${timestamp}`;
    await this.sendAlert(message);
  }
}



