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
      console.log('Telegram alert (mock):', message);
      return;
    }

    try {
      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error('Telegram send error:', error);
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

  async sendNewDeviceAlert(
    deviceInfo: string,
    timestamp: string
  ): Promise<void> {
    const message = `⚠️ Thiết bị mới được phát hiện!\n\n${deviceInfo}\n⏰ ${timestamp}`;
    await this.sendAlert(message);
  }
}



