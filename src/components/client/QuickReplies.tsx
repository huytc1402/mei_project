'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface QuickRepliesProps {
  message: string;
  onReply: (content: string) => void;
}

export function QuickReplies({ message, onReply }: QuickRepliesProps) {
  const [replies, setReplies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      generateReplies();
    }
  }, [message, user]);

  async function generateReplies() {
    if (!user) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/ai/quick-replies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          userId: user.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setReplies(result.replies);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Generate replies error:', error);
      setReplies([
        'Tớ cũng nhớ cậu',
        'Cảm ơn cậu',
        'Tớ ổn, cậu thế nào?',
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-romantic-soft/30 rounded-2xl p-4 border border-romantic-light/20">
        <div className="animate-pulse-soft text-center text-romantic-glow/60 text-sm">
          Đang tạo câu trả lời...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-romantic-glow/70 text-sm text-center">
        Trả lời nhanh
      </p>
      <div className="flex flex-col gap-2">
        {replies.map((reply: string, index: number) => (
          <button
            key={index}
            onClick={() => onReply(reply)}
            className="bg-romantic-soft/40 rounded-lg p-3 text-left text-white text-sm border border-romantic-light/20 hover:border-romantic-glow/50 hover:bg-romantic-soft/60 transition-all"
          >
            {reply}
          </button>
        ))}
      </div>
    </div>
  );
}

