'use client';

import { useState } from 'react';

const DEFAULT_EMOJIS = ['❤️', '😊', '🥺', '👍', '🔥', '💕', '😌', '🌙'];

interface EmojiReactionsProps {
  onReaction: (emoji: string) => void;
}

export function EmojiReactions({ onReaction }: EmojiReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [customEmojis, setCustomEmojis] = useState<string[]>([]);

  function handleEmojiClick(emoji: string) {
    onReaction(emoji);
    
    // Shake animation
    const element = document.getElementById(`emoji-${emoji}`);
    if (element) {
      element.classList.add('emoji-shake');
      setTimeout(() => {
        element.classList.remove('emoji-shake');
      }, 120);
    }
  }

  function handleAddEmoji() {
    const emoji = prompt('Nhập emoji bạn muốn thêm:');
    if (emoji && emoji.length <= 2) {
      setCustomEmojis([...customEmojis, emoji]);
    }
  }

  const allEmojis = [...DEFAULT_EMOJIS, ...customEmojis];

  return (
    <div className="bg-romantic-soft/30 rounded-2xl p-4 border border-romantic-light/20">
      {/* <p className="text-romantic-glow/70 text-sm mb-3 text-center">
        Phản hồi nhanh
      </p> */}
      <div className="flex flex-wrap gap-3 justify-center">
        {allEmojis.map((emoji) => (
          <button
            key={emoji}
            id={`emoji-${emoji}`}
            onClick={() => handleEmojiClick(emoji)}
            className="text-3xl hover:scale-110 transition-transform cursor-pointer"
          >
            {emoji}
          </button>
        ))}
        <button
          onClick={handleAddEmoji}
          className="text-2xl w-10 h-10 flex items-center justify-center bg-romantic-light/30 rounded-full hover:bg-romantic-light/50 transition-colors"
        >
          ➕
        </button>
      </div>
    </div>
  );
}


