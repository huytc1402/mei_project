'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';

interface MemoryButtonProps {
  onMemory: () => Promise<void>;
}

export const MemoryButton = memo(function MemoryButton({ onMemory }: MemoryButtonProps) {
  const [isSending, setIsSending] = useState(false);

  const handleMemoryClick = useCallback(async () => {
    if (isSending) return;

    setIsSending(true);

    try {
      // Send memory - show loading while sending
      await onMemory();
    } catch (error) {
      console.error('Error sending memory:', error);
    } finally {
      setIsSending(false);
    }
  }, [isSending, onMemory]);

  return (
    <div className="flex justify-center z-40">
      <button
        onClick={handleMemoryClick}
        disabled={isSending}
        className="relative px-8 sm:px-10 py-2.5 sm:py-3 
        bg-gradient-to-r from-romantic-accent/20 via-romantic-glow to-romantic-accent/10 
        rounded-lg sm:rounded-xl flex items-center justify-center gap-2 
        text-white text-sm sm:text-base font-medium shadow-lg 
        disabled:opacity-50 disabled:cursor-not-allowed transition-all 
        hover:shadow-xl hover:shadow-romantic-glow/30 overflow-hidden"
        style={{
          backgroundSize: '200% 200%',
          animation: !isSending ? 'gradient-shift 4s ease infinite':'none',
        }}
      >
        {/* Icon (normal mode) */}
        {!isSending && (
          <span className="text-2xl">
            ✨
          </span>
        )}

        {/* Loading State */}
        {isSending && (
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-spin">
              ✨
            </span>
            <span className="text-xs sm:text-sm opacity-90">
              Đang gửi...
            </span>
          </div>
        )}

        {/* Normal label */}
        {!isSending && (
          <span className="relative z-10 flex items-center justify-center">
            Gửi năng lượng
          </span>
        )}
      </button>
    </div>
  );
});
