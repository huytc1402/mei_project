'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';

interface MemoryButtonProps {
  onMemory: () => Promise<void>;
}

export const MemoryButton = memo(function MemoryButton({ onMemory }: MemoryButtonProps) {
  const [isSending, setIsSending] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const popupTimerRef = useRef<NodeJS.Timeout | null>(null);

  const LOADING_DURATION = 1000; // 1.5 seconds
  const COOLDOWN_DURATION = 1; // 3 seconds cooldown
  const POPUP_DURATION = 3000; // 3 seconds popup

  useEffect(() => {
    if (cooldown > 0) {
      cooldownTimerRef.current = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, [cooldown]);

  useEffect(() => {
    if (showSuccessPopup) {
      popupTimerRef.current = setTimeout(() => {
        setShowSuccessPopup(false);
      }, POPUP_DURATION);
    }
    return () => {
      if (popupTimerRef.current) {
        clearTimeout(popupTimerRef.current);
      }
    };
  }, [showSuccessPopup]);

  const handleMemoryClick = useCallback(async () => {
    if (isSending || cooldown > 0) return;

    setIsSending(true);
    setCooldown(COOLDOWN_DURATION);

    try {
      // Show loading for 3 seconds
      await new Promise(resolve => setTimeout(resolve, LOADING_DURATION));
      
      // Send memory
      await onMemory();
      
      // Show success popup
      setShowSuccessPopup(true);
    } catch (error) {
      console.error('Error sending memory:', error);
    } finally {
      setIsSending(false);
    }
  }, [isSending, cooldown, onMemory]);

  return (
    <>
      {/* Success Popup - Center, dark theme with backdrop */}
        {showSuccessPopup && (
          <>
            {/* Backdrop */}
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] animate-fade-in" />
            {/* Popup - Center using flexbox for better mobile support */}
          <div className="fixed inset-0 flex items-center justify-center z-[70] p-4 animate-fade-in">
              <div className="bg-gradient-to-br from-romantic-dark/95 via-romantic-soft/90 to-romantic-dark/95 backdrop-blur-md rounded-2xl px-4 sm:px-6 py-4 sm:py-5 border border-romantic-glow/30 shadow-2xl text-center w-[calc(100%-2rem)] max-w-[280px] mx-auto">
                <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">
                  ✨
                </div>
                <p className="text-white text-sm sm:text-base font-medium mb-1">
                  Đã gửi {"Nhớ"} đến admin
                </p>
                <p className="text-romantic-glow/70 text-xs sm:text-sm">
                  Tớ đã nhận được tín hiệu của cậu 💕
                </p>
              </div>
            </div>
          </>
        )}

      {/* Memory Button - Center, rectangular */}
      <div className="flex justify-center z-40">
        <button
          onClick={handleMemoryClick}
          disabled={isSending || cooldown > 0}
          className="relative px-8 sm:px-10 py-2.5 sm:py-3 bg-gradient-to-r from-romantic-glow via-romantic-dark to-romantic-soft rounded-lg sm:rounded-xl flex items-center justify-center gap-2 text-white text-sm sm:text-base font-medium shadow-lg overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-xl hover:shadow-romantic-glow/30"
          style={{
            backgroundSize: '200% 200%',
            animation: !(isSending || cooldown > 0) ? 'gradient-shift 4s ease infinite' : 'none',
          }}
        >
          {/* Loading spinner */}
          {isSending && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg sm:rounded-xl">
              <div className="text-xl sm:text-2xl animate-spin">
                💫
              </div>
            </div>
          )}

          {/* Cooldown overlay */}
          {cooldown > 0 && !isSending && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg sm:rounded-xl backdrop-blur-sm">
              <span className="text-xs sm:text-sm font-bold">{cooldown}s</span>
            </div>
          )}

          {/* Icon and Text */}
          {!isSending && cooldown === 0 && (
            <>
              <span className="relative z-10 text-lg sm:text-xl">✨</span>
              <span className="relative z-10">Nhớ</span>
            </>
          )}
        </button>
      </div>
    </>
  );
});
