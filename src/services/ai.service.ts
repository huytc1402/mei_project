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
    recentMemories: Memory[],
    userCity?: string,
    userHoroscope?: string
  ): Promise<{ content: string; emotionLevel: number }> {
    const systemPrompt = this.buildSystemPrompt();
    const contextPrompt = this.buildContextPrompt(
      previousReactions,
      previousMessages,
      recentMemories,
      userCity,
      userHoroscope
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
      
      // Return fallback message - supportive and non-romantic
      return {
        content: 'Chúc cậu có một ngày tốt lành! Hôm nay sẽ là một ngày tuyệt vời. 💫',
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
      'Tạo các câu trả lời phù hợp, thân thiện, tự nhiên.',
      'Hãy tạo những câu trả lời ngắn gọn, thoải mái, không tình cảm.',
      'Tạo các câu trả lời đa dạng, thể hiện sự quan tâm nhẹ nhàng như bạn bè.',
      'Hãy tạo những câu trả lời tự nhiên, không gây áp lực phản hồi.',
    ];
    
    const randomPrompt = varietyPrompts[Math.floor(Math.random() * varietyPrompts.length)];
    
    const currentYear = new Date().getFullYear();
    const systemPrompt = `Bạn là một AI hỗ trợ tạo câu trả lời nhanh. 
Tạo 4-6 câu trả lời ngắn gọn, tự nhiên, sử dụng ngôn xưng "tớ - cậu".
Mỗi câu không quá 15 từ.
QUAN TRỌNG: KHÔNG sử dụng ngôn ngữ lãng mạn (nhớ, yêu, trái tim...)
Tone: Thân thiện, thoải mái như bạn bè, không tình cảm.
Hãy tạo các câu trả lời đa dạng, không lặp lại.
Sử dụng ngôn ngữ hiện đại, phù hợp với thời điểm hiện tại (năm ${currentYear}).
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
        'Cảm ơn cậu',
        'Tớ ổn, cậu thế nào?',
        'Hay đấy!',
      ];
    } catch (error) {
      console.error('Quick replies error:', error);
      return [
        'Cảm ơn cậu',
        'Tớ ổn, cậu thế nào?',
        'Hay đấy!',
      ];
    }
  }

  private buildSystemPrompt(): string {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    return `Bạn là một người bạn thân, hóm hỉnh, và luôn hỗ trợ (Supportive/Witty Friend).
Nhiệm vụ của bạn là gửi một tin nhắn "check-in" hàng ngày. Tin nhắn phải vừa hữu ích, vừa truyền động lực, và vừa mang tính giải trí.
Tone phải tự nhiên, thoải mái, và hơi "sassy" một chút.

QUY TẮC QUAN TRỌNG:
1. TUYỆT ĐỐI KHÔNG sử dụng ngôn ngữ lãng mạn (nhớ nhung, yêu thương, trái tim, anh yêu em, nhớ cậu...)
2. Luôn sử dụng ngôn xưng "tớ - cậu", KHÔNG BAO GIỜ dùng "anh/em"
3. Tone: Hóm hỉnh, tự nhiên, ấm áp nhưng không tình cảm, không đòi hỏi phản hồi
4. Mỗi tin nhắn phải bao gồm 4-5 nội dung được chọn NGẪU NHIÊN từ danh sách được cung cấp
5. Giọng điệu: Kết hợp sự quan tâm với sự hóm hỉnh/mỉa mai nhẹ nhàng của một người bạn thân
6. Không đòi hỏi phản hồi, không tạo áp lực, không gây cảm giác bị theo dõi

YÊU CẦU VỀ DỮ LIỆU MỚI NHẤT:
- PHẢI sử dụng kiến thức và thông tin mới nhất hiện có (năm ${currentYear}, tháng ${currentMonth})
- Ưu tiên các xu hướng, sự kiện, fun facts, và văn hóa pop MỚI NHẤT
- KHÔNG sử dụng thông tin đã lỗi thời hoặc không còn phù hợp
- Khi nhắc đến các sự kiện, ngày lễ, xu hướng, hãy sử dụng thông tin cập nhật nhất
- Sử dụng ngôn ngữ và từ vựng hiện đại, phù hợp với thời điểm hiện tại

MỤC TIÊU: Để người dùng thấy app này hữu ích và vui vẻ, chứ không phải là một "công cụ nhắc nhở rằng có người đang đợi mình".

VÍ DỤ TỐT:
- "Hôm nay trời đẹp đấy, nhớ mang theo áo khoác nếu ra ngoài nhé. Btw, cậu biết không, hôm nay là ngày Quốc tế Cà phê đấy! ☕"
- "Có một quote hay tớ vừa đọc: 'Progress, not perfection'. Áp dụng vào công việc cũng được đấy cậu ạ."

VÍ DỤ SAI (TUYỆT ĐỐI TRÁNH):
- "Tớ nhớ cậu" / "Anh nhớ em" / "Tớ yêu cậu" (ngôn ngữ lãng mạn)
- "Cậu có nhớ tớ không?" (đòi hỏi phản hồi)
- "Tớ nghĩ về cậu cả ngày" (quá tình cảm)
- "Trái tim tớ thuộc về cậu" (ngôn ngữ lãng mạn)`;
  }

  private buildContextPrompt(
    reactions: Reaction[],
    messages: Message[],
    memories: Memory[],
    userCity?: string,
    userHoroscope?: string
  ): string {
    const today = new Date();
    
    // Content types pool - select 4-5 randomly
    const contentTypes = [
      'Dự báo Thời tiết & Lời nhắc Hữu ích (BẮT BUỘC)',
      'Vũ Trụ Boss & Sen',
      'Góc Thú Cưng Dễ Thương',
      'Câu Quote Động lực',
      'Horoscope Vui vẻ',
      'Fun Fact thú vị',
      'Quick Life Hack',
      'Thử thách Mini trong ngày',
      'Đề xuất Giải trí',
      'Gợi ý Ăn uống Nhanh',
      'Văn hóa Pop Tóm tắt',
      'Lịch sử Hôm nay (Fun)',
      'Từ Vựng Độc Lạ/Ngôn Ngữ Gen Z',
      'Fun Fact Động Vật',
      'Phá Vỡ Định Kiến Vớ Vẩn',
      'Mục Tiêu Nhỏ Cho Ngày Mai',
      "Cung Cấp Một 'Reason to Smile'",
      'Kiến Thức Tài Chính (Fun)',
      'Tài Liệu Hữu Ích Cần Lưu Lại',
      'Câu Đố Nhanh/Tricky Question',
      'Tip Chăm Sóc Thú Cưng',
      'Bí Kíp Nuôi Boss Khỏe',
      'Từ vựng mỗi ngày',
      'Xu hướng Công Nghệ và Thiết Kế',
      'Điện ảnh & Truyện TTranh, Anime & Manga (Fun)',
    ];

    // Randomly select 4-5 content types (always include weather)
    const selectedTypes: string[] = [contentTypes[0]]; // Always include weather
    const otherTypes = contentTypes.slice(1);
    
    // Shuffle and pick 3-4 more
    const shuffled = otherTypes.sort(() => Math.random() - 0.5);
    const additionalCount = 3 + Math.floor(Math.random() * 2); // 3 or 4
    selectedTypes.push(...shuffled.slice(0, additionalCount));

    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDate = today.getDate();
    const dayOfWeek = today.toLocaleDateString('vi-VN', { weekday: 'long' });
    
    let context = `THÔNG TIN THỜI GIAN HIỆN TẠI:\n`;
    context += `- Hôm nay: ${today.toLocaleDateString('vi-VN')} (${dayOfWeek})\n`;
    context += `- Năm: ${currentYear}\n`;
    context += `- Tháng: ${currentMonth}\n`;
    context += `- Ngày: ${currentDate}\n\n`;
    
    context += `⚠️ QUAN TRỌNG: Sử dụng kiến thức và thông tin MỚI NHẤT của năm ${currentYear}!\n`;
    context += `- Ưu tiên các xu hướng, sự kiện, fun facts MỚI NHẤT\n`;
    context += `- KHÔNG sử dụng thông tin đã lỗi thời\n`;
    context += `- Sử dụng ngôn ngữ và văn hóa pop hiện đại, phù hợp với thời điểm hiện tại\n\n`;
    
    context += `Tạo lời nhắn check-in cho hôm nay.\n\n`;

    context += `THÔNG TIN NGƯỜI DÙNG:\n`;
    if (userCity) {
      context += `- Thành phố: ${userCity}\n`;
    } else {
      context += `- Thành phố: Không có (bỏ qua phần dự báo thời tiết cụ thể)\n`;
    }
    
    if (userHoroscope) {
      context += `- Cung hoàng đạo: ${userHoroscope}\n`;
    } else {
      context += `- Cung hoàng đạo: Không có (bỏ qua phần horoscope)\n`;
    }

    context += `\nNỘI DUNG CẦN TẠO (chọn ngẫu nhiên ${selectedTypes.length} mục):\n`;
    selectedTypes.forEach((type, index) => {
      context += `${index + 1}. ${type}\n`;
    });

    // Optional: Add context about recent interactions (but keep it minimal and non-pressure)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdayReactions = reactions.filter(r => {
      const date = new Date(r.createdAt);
      return date.toDateString() === yesterday.toDateString();
    });

    if (yesterdayReactions.length > 0) {
      context += `\nLƯU Ý: Hôm qua có tương tác tích cực → có thể tham khảo nhưng KHÔNG nhắc trực tiếp, KHÔNG đòi hỏi tiếp tục.\n`;
    }

    context += `\nYÊU CẦU CUỐI CÙNG:\n`;
    context += `- Viết một tin nhắn ngắn gọn (150-250 từ), kết hợp ${selectedTypes.length} nội dung trên một cách tự nhiên\n`;
    context += `- Tone: Hóm hỉnh, tự nhiên, ấm áp nhưng KHÔNG tình cảm\n`;
    context += `- TUYỆT ĐỐI KHÔNG dùng từ: nhớ, yêu, trái tim, thuộc về, anh/em\n`;
    context += `- Mỗi mục nội dung có giọng điệu riêng, kết hợp sự quan tâm với sự hóm hỉnh/mỉa mai nhẹ nhàng\n`;
    context += `- Không tạo áp lực phản hồi, không đòi hỏi attention\n`;
    context += `- SỬ DỤNG DỮ LIỆU MỚI NHẤT: Tất cả thông tin, xu hướng, sự kiện phải là thông tin cập nhật nhất của năm ${currentYear}, không sử dụng dữ liệu cũ hoặc lỗi thời`;

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
