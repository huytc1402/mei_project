import { GoogleGenerativeAI } from '@google/generative-ai';
import { Message, Reaction, Memory } from '@/types';

export class AIService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private quickReplyModel: any; // Cached model for quick replies

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY is not set');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Use Gemini Pro - stable and free tier friendly
    // gemini-pro is the most stable and widely available model
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.9, // Higher temperature for more variety in quick replies
      },
    });
    // Pre-create quick reply model for better performance
    this.quickReplyModel = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.9, // Higher temperature for more variety
        topK: 40,
        topP: 0.95,
      },
    });
  }

  async generateDailyMessage(
    previousReactions: Reaction[],
    previousMessages: Message[],
    recentMemories: Memory[]
  ): Promise<{ content: string; emotionLevel: number }> {
    const systemPrompt = this.buildSystemPrompt();
    const contextPrompt = this.buildContextPrompt(
      previousReactions,
      previousMessages,
      recentMemories
    );

    try {
      const prompt = `${systemPrompt}\n\n${contextPrompt}`;
      
      // Use string format for gemini-pro (simpler and more reliable)
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const content = response.text() || '';

      if (!content || content.trim().length === 0) {
        throw new Error('Empty response from AI');
      }

      const emotionLevel = this.calculateEmotionLevel(
        previousReactions,
        previousMessages
      );

      return { content: content.trim(), emotionLevel };
    } catch (error: any) {
      console.error('AI generation error:', error);
      console.error('Error details:', {
        message: error?.message,
        status: error?.status,
        statusText: error?.statusText,
      });
      
      // Return fallback message
      return {
        content: 'Hôm nay tớ nghĩ về cậu nhiều lắm. Mong cậu có một ngày tốt lành.',
        emotionLevel: 50,
      };
    }
  }

  async generateQuickReplies(
    message: string,
    context: { reactions: Reaction[]; messages: Message[] }
  ): Promise<string[]> {
    // Add variety prompts to get different results each time
    const varietyPrompts = [
      'Tạo các câu trả lời phù hợp, ấm áp, không quá thân mật.',
      'Hãy tạo những câu trả lời tự nhiên, chân thành, sử dụng ngôn ngữ gần gũi.',
      'Tạo các câu trả lời ngắn gọn, thể hiện sự quan tâm nhẹ nhàng.',
      'Hãy tạo những câu trả lời ấm áp, thể hiện sự đồng cảm.',
    ];
    
    const randomPrompt = varietyPrompts[Math.floor(Math.random() * varietyPrompts.length)];
    
    const systemPrompt = `Bạn là một AI hỗ trợ tạo câu trả lời nhanh. 
Tạo 4-6 câu trả lời ngắn gọn, tự nhiên, sử dụng ngôn xưng "tớ - cậu".
Mỗi câu không quá 15 từ.
Hãy tạo các câu trả lời đa dạng, không lặp lại.
Chỉ trả về danh sách các câu trả lời, mỗi câu một dòng, không đánh số.`;

    const userPrompt = `Tin nhắn: "${message}"
${randomPrompt}
Hãy tạo các câu trả lời khác nhau, đa dạng về cách diễn đạt.`;

    try {
      const prompt = `${systemPrompt}\n\n${userPrompt}`;
      
      // Use pre-created model for better performance (reuse instance)
      const result = await this.quickReplyModel.generateContent(prompt);
      const response = await result.response;
      const content = response.text() || '';

      const replies = content
        .split('\n')
        .map((line: string) => line.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter((line: string) => line.length > 0 && !line.startsWith('*') && !line.startsWith('-'))
        .filter((line: string, index: number, self: string[]) => self.indexOf(line) === index) // Remove duplicates
        .slice(0, 6);

      return replies.length > 0 ? replies : [
        'Tớ cũng nhớ cậu',
        'Cảm ơn cậu',
        'Tớ ổn, cậu thế nào?',
      ];
    } catch (error) {
      console.error('Quick replies error:', error);
      return [
        'Tớ cũng nhớ cậu',
        'Cảm ơn cậu',
        'Tớ ổn, cậu thế nào?',
      ];
    }
  }

  private buildSystemPrompt(): string {
    return `Bạn là một AI tình cảm, nhẹ nhàng và tinh tế. 
Nhiệm vụ của bạn là tạo ra những lời nhắn yêu thương hàng ngày.

QUY TẮC:
1. Luôn sử dụng ngôn xưng "tớ - cậu", KHÔNG BAO GIỜ dùng "anh/em"
2. Tone ấm, nhẹ, gần gũi nhưng không sở hữu, không chiếm hữu
3. Không dồn dập, không làm đối phương ngột ngạt
4. Phản ánh cảm xúc từ tương tác hôm qua
5. Nếu đối phương im lặng → hỏi han êm, không trách móc
6. Nếu có nhiều tương tác tích cực → tăng cảm xúc nhưng vẫn tinh tế
7. Nếu có "Nhớ" được gửi → thể hiện sự đồng điệu

VÍ DỤ TỐT:
- "Hôm nay tớ nghĩ về cậu nhiều. Mong cậu có một ngày tốt lành."
- "Cậu có khỏe không? Tớ mong nghe tin từ cậu."
- "Tớ biết cậu đang bận, nhưng tớ vẫn ở đây."

VÍ DỤ SAI (TRÁNH):
- "Anh nhớ em quá" (sai ngôn xưng)
- "Em phải trả lời anh" (quá sở hữu)
- "Anh yêu em" (quá thân mật, không phù hợp)`;
  }

  private buildContextPrompt(
    reactions: Reaction[],
    messages: Message[],
    memories: Memory[]
  ): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdayReactions = reactions.filter(r => {
      const date = new Date(r.createdAt);
      return date.toDateString() === yesterday.toDateString();
    });

    const yesterdayMessages = messages.filter(m => {
      const date = new Date(m.createdAt);
      return date.toDateString() === yesterday.toDateString();
    });

    const recentMemories = memories.filter(m => {
      const date = new Date(m.createdAt);
      return date >= yesterday;
    });

    let context = `Tạo lời nhắn cho hôm nay (${today.toLocaleDateString('vi-VN')}).\n\n`;

    if (recentMemories.length > 0) {
      context += `Có ${recentMemories.length} lượt "Nhớ" gần đây → thể hiện sự đồng điệu.\n`;
    }

    if (yesterdayReactions.length > 0) {
      const positiveEmojis = ['❤️', '😊', '👍', '🔥'];
      const negativeEmojis = ['🥺', '😢', '😔'];
      
      const hasPositive = yesterdayReactions.some(r => 
        positiveEmojis.includes(r.emoji)
      );
      const hasNegative = yesterdayReactions.some(r => 
        negativeEmojis.includes(r.emoji)
      );

      if (hasPositive) {
        context += `Hôm qua có phản hồi tích cực (❤️, 😊) → tăng cảm xúc ấm hơn 10-15%.\n`;
      } else if (hasNegative) {
        context += `Hôm qua có phản hồi buồn (🥺) → dịu lại, an ủi nhẹ.\n`;
      }
    }

    if (yesterdayMessages.length === 0 && yesterdayReactions.length === 0) {
      context += `Hôm qua không có phản hồi → nhắc nhẹ, không trách móc, hỏi han êm.\n`;
    }

    context += `\nTạo một lời nhắn ngắn gọn (50-100 từ), ấm áp, tự nhiên.`;

    return context;
  }

  private calculateEmotionLevel(
    reactions: Reaction[],
    messages: Message[]
  ): number {
    let baseLevel = 50;

    const last24h = new Date();
    last24h.setHours(last24h.getHours() - 24);

    const recentReactions = reactions.filter(r => 
      new Date(r.createdAt) >= last24h
    );
    const recentMessages = messages.filter(m => 
      new Date(m.createdAt) >= last24h
    );

    const positiveEmojis = ['❤️', '😊', '👍', '🔥'];
    const positiveCount = recentReactions.filter(r => 
      positiveEmojis.includes(r.emoji)
    ).length;

    if (positiveCount > 0) {
      baseLevel += Math.min(positiveCount * 10, 30);
    }

    if (recentMessages.length > 0) {
      baseLevel += 15;
    }

    return Math.min(baseLevel, 100);
  }
}
