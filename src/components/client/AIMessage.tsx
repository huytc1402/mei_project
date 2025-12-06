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
    <div className="relative animate-fade-in w-full">
      {/* Glow effect background - static */}
      <div className="absolute inset-0 bg-gradient-to-r from-romantic-glow/10 via-romantic-accent/5 to-romantic-glow/10 rounded-3xl blur-xl opacity-30" />

      <div className="relative bg-gradient-to-br from-romantic-soft/60 via-romantic-soft/40 to-romantic-light/30 rounded-2xl sm:rounded-3xl border border-romantic-glow/30 backdrop-blur-md shadow-xl flex flex-col" style={{ maxHeight: '45vh', minHeight: '180px' }}>
        {/* Scrollable Content Area - Only this scrolls */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 pt-4 sm:pt-5 custom-scrollbar min-h-0">
          <div className="relative z-10">
            <div className="flex items-start space-x-3 mb-3">
              <div className="text-4xl flex-shrink-0">
                ✨
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-light break-words">
                  {message.content}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-romantic-glow/20 flex-shrink-0">
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
  );
});
