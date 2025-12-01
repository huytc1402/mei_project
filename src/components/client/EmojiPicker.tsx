'use client';

import { useState, useCallback, memo, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Theme } from 'emoji-picker-react';

// Dynamic import để tránh SSR issues - lazy load for better performance
const EmojiPicker = dynamic(
  () => import('emoji-picker-react'),
  { 
    ssr: false,
    loading: () => <div className="w-8 h-8 animate-pulse bg-romantic-light/30 rounded" />, // Loading placeholder
  }
);

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

export const EmojiPickerComponent = memo(function EmojiPickerComponent({ onEmojiSelect }: EmojiPickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handleEmojiClick = useCallback((emojiData: any) => {
    onEmojiSelect(emojiData.emoji);
    setShowPicker(false);
  }, [onEmojiSelect]);

  const togglePicker = useCallback(() => {
    setShowPicker(prev => !prev);
  }, []);

  const closePicker = useCallback(() => {
    setShowPicker(false);
  }, []);

  // Memoize dimensions to avoid recalculation
  const pickerDimensions = useMemo(() => {
    if (typeof window === 'undefined') return { width: 320, height: 400 };
    return {
      width: Math.min(320, window.innerWidth - 32),
      height: Math.min(400, window.innerHeight * 0.6),
    };
  }, []);

  return (
    <div className="relative">
      <button
        onClick={togglePicker}
        className="text-lg sm:text-xl w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-romantic-light/30 rounded-md sm:rounded-lg hover:bg-romantic-light/50 transition-colors"
        aria-label="Chọn emoji"
      >
        ➕
      </button>

      {showPicker && (
        <>
          {/* Backdrop to close picker */}
          <div
            onClick={closePicker}
            className="fixed inset-0 z-[40]"
            aria-hidden="true"
          />
          <div className="absolute bottom-full right-0 mb-2 z-[50] max-w-[calc(100vw-2rem)] animate-fade-in">
            <div className="bg-romantic-soft rounded-lg shadow-2xl overflow-hidden max-w-[calc(100vw-2rem)]">
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                theme={Theme.DARK}
                width={pickerDimensions.width}
                height={pickerDimensions.height}
                previewConfig={{ showPreview: false }}
                skinTonesDisabled
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
});

