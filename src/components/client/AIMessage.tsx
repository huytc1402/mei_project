'use client';

import { memo, useMemo } from 'react';
import { Message } from '@/types';

interface AIMessageProps {
  message: Message;
}

function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('vi-VN', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export const AIMessage = memo(function AIMessage({ message }: AIMessageProps) {
  const formattedDate = useMemo(() => formatDate(message.createdAt), [message.createdAt]);
  return (
    <div className="relative animate-fade-in">
      {/* Glow effect background - static */}
      <div className="absolute inset-0 bg-gradient-to-r from-romantic-glow/10 via-romantic-accent/5 to-romantic-glow/10 rounded-3xl blur-xl opacity-30" />
      
      <div className="relative bg-gradient-to-br from-romantic-soft/60 via-romantic-soft/40 to-romantic-light/30 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-romantic-glow/30 backdrop-blur-md shadow-xl">
        {/* Decorative elements - static */}
        <div className="absolute top-4 right-4 opacity-15 text-6xl">
          ✨
        </div>

        <div className="absolute bottom-4 left-4 opacity-10 text-5xl">
          💫
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-start space-x-3 mb-3">
            <div className="text-4xl">
              ✨
            </div>
            <div className="flex-1">
              <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-light">
                {message.content}
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-romantic-glow/20">
            <div className="flex items-center space-x-1">
              <span className="text-romantic-glow/60 text-xs">
                Gửi cậu!
              </span>
            </div>
            <p className="text-romantic-glow/50 text-xs font-light">
              {formattedDate}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});
