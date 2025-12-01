'use client';

import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { EmojiPickerComponent } from './EmojiPicker';

// Simplified flying emoji component - CSS animation instead of framer-motion
// Memoized to prevent unnecessary re-renders
const FlyingEmoji = memo(({ emoji, onComplete, startX = 0, startY = 0 }: { 
  emoji: string; 
  onComplete: () => void;
  startX?: number;
  startY?: number;
}) => {
  const randomX = useMemo(() => (Math.random() - 0.5) * 200, []); // Reduced range, memoized
  const randomY = useMemo(() => (Math.random() - 0.5) * 80, []);
  const endX = useMemo(() => startX + randomX, [startX, randomX]);
  const endY = useMemo(() => startY + randomY - 300, [startY, randomY]);
  
  return (
    <div
      className="fixed pointer-events-none z-50"
      style={{
        fontSize: '2rem',
        left: '50%',
        top: '50%',
        '--end-x': `${endX}px`,
        '--end-y': `${endY}px`,
        willChange: 'transform, opacity', // Optimize animation performance
      } as React.CSSProperties & { '--end-x': string; '--end-y': string }}
      onAnimationEnd={onComplete}
    >
      <div className="emoji-fly">{emoji}</div>
    </div>
  );
});

FlyingEmoji.displayName = 'FlyingEmoji';

interface ResponseBoxProps {
  onReaction: (emoji: string) => void;
  onMessage: (content: string) => void;
  onMemory: () => void;
  onViewHistory?: () => void;
  userId?: string;
  currentMessage?: { content: string } | null;
}

export const ResponseBox = memo(function ResponseBox({ onReaction, onMessage, onMemory, onViewHistory, userId, currentMessage }: ResponseBoxProps) {
  const [text, setText] = useState('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [flyingEmojis, setFlyingEmojis] = useState<Array<{ id: string; emoji: string; startX?: number; startY?: number }>>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestion, setLoadingSuggestion] = useState<string | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [hasGeneratedSuggestions, setHasGeneratedSuggestions] = useState(false);
  const emojiIdCounter = useRef(0);
  const popupTimerRef = useRef<NodeJS.Timeout | null>(null);

  const POPUP_DURATION = 2000; // 2 seconds popup

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

  // Generate suggestions when message is available - always generate fresh on mount/reload
  // Optimized with debouncing and request deduplication
  useEffect(() => {
    let mounted = true;
    let abortController: AbortController | null = null;
    
    async function generateSuggestions() {
      if (!currentMessage?.content || !userId) return;
      
      // Cancel previous request if still pending
      if (abortController) {
        abortController.abort();
      }
      abortController = new AbortController();
      
      setLoadingSuggestions(true);
      try {
        // Add timestamp to ensure different results on each reload
        const response = await fetch('/api/ai/quick-replies', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userId}`, // Simple auth
            'x-user-id': userId,
          },
          body: JSON.stringify({ 
            message: currentMessage.content,
            // Add random seed to get different results
            seed: Date.now(),
          }),
          signal: abortController.signal, // Add abort signal for cancellation
        });

        const result = await response.json();

        if (mounted && result.success && result.replies && Array.isArray(result.replies)) {
          // Take only 2 short suggestions, shuffle to get variety
          const filtered = result.replies
            .filter((r: string) => r && r.length > 0 && r.length <= 50);
          
          // Shuffle and take 2 random ones
          const shuffled = [...filtered].sort(() => Math.random() - 0.5);
          const shortSuggestions = shuffled.slice(0, 2);
          
          setSuggestions(shortSuggestions);
          setHasGeneratedSuggestions(true);
        }
      } catch (error: any) {
        // Ignore abort errors
        if (error.name !== 'AbortError') {
          console.error('Generate suggestions error:', error);
        }
        // Don't show error to user, just don't show suggestions
      } finally {
        if (mounted) {
          setLoadingSuggestions(false);
        }
      }
    }

    // Debounce API call to prevent rapid successive calls
    const timeoutId = setTimeout(() => {
      // Always generate fresh suggestions when message is available
      if (currentMessage?.content && userId) {
        // Reset state first
        setHasGeneratedSuggestions(false);
        setSuggestions([]);
        generateSuggestions();
      } else {
        // Reset when message changes
        setHasGeneratedSuggestions(false);
        setSuggestions([]);
        setLoadingSuggestions(false);
      }
    }, 300); // 300ms debounce
    
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      if (abortController) {
        abortController.abort();
      }
    };
  }, [currentMessage?.content, userId]);

  const DEFAULT_EMOJIS = useMemo(() => ['❤️', '😊', '🥺', '👍', '🔥', '💕', '😌', '🌙'], []);

  const handleEmojiClick = useCallback((emoji: string, event?: React.MouseEvent<HTMLButtonElement>) => {
    // Send reaction
    onReaction(emoji);
    
    // Get button position for emoji to fly from
    let startX = 0;
    let startY = 0;
    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      startX = rect.left + rect.width / 2 - window.innerWidth / 2;
      startY = rect.top + rect.height / 2 - window.innerHeight / 2;
    }
    
    // Reduced flying emoji effects (3-5 emojis instead of 10-15)
    const emojiCount = 3 + Math.floor(Math.random() * 3); // 3-5 emojis
    const newEmojis = Array.from({ length: emojiCount }, () => {
      const id = `emoji-${emojiIdCounter.current++}`;
      return { id, emoji, startX: startX + (Math.random() - 0.5) * 50, startY: startY + (Math.random() - 0.5) * 50 };
    });
    setFlyingEmojis(prev => [...prev, ...newEmojis]);
  }, [onReaction]);

  const handleSendText = useCallback(async (content?: string) => {
    const messageContent = content || text.trim();
    if (messageContent) {
      await onMessage(messageContent);
      setText('');
      // Clear suggestions after sending
      setSuggestions([]);
      setHasGeneratedSuggestions(false);
      setLoadingSuggestions(false);
      // Show success popup
      setShowSuccessPopup(true);
    }
  }, [text, onMessage]);

  const handleSuggestionClick = useCallback(async (suggestion: string) => {
    if (loadingSuggestion) return; // Prevent double click
    
    setLoadingSuggestion(suggestion);
    try {
      await handleSendText(suggestion);
    } finally {
      setLoadingSuggestion(null);
    }
  }, [loadingSuggestion, handleSendText]);

  const removeFlyingEmoji = useCallback((id: string) => {
    setFlyingEmojis(prev => prev.filter(e => e.id !== id));
  }, []);

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
                Đã gửi tin nhắn đến admin
              </p>
              <p className="text-romantic-glow/70 text-xs sm:text-sm">
                Tớ đã nhận được tin nhắn của cậu 💕
              </p>
            </div>
          </div>
        </>
      )}

      {/* Flying emojis overlay */}
      {flyingEmojis.map(({ id, emoji, startX, startY }) => (
        <FlyingEmoji
          key={id}
          emoji={emoji}
          startX={startX}
          startY={startY}
          onComplete={() => removeFlyingEmoji(id)}
        />
      ))}

      <div className="space-y-3">
        {/* Combined Response Box - Compact and clean */}
        <div className="relative bg-gradient-to-br from-romantic-soft/50 to-romantic-light/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-romantic-glow/30 backdrop-blur-sm shadow-lg"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-romantic-glow/10 rounded-full blur-3xl" />
          <div className="relative z-10 space-y-3">
            {/* Text Input Section */}
            <div>
              {/* <div className="flex items-center space-x-2 mb-2">
                <span className="text-lg">💬</span>
                <p className="text-romantic-glow/80 text-xs font-medium">Gửi tin nhắn</p>
              </div> */}
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendText();
                    }
                  }}
                  placeholder="Viết gì đó cho tớ..."
                  className="flex-1 px-2.5 sm:px-3 py-2 sm:py-2.5 bg-romantic-soft/60 border border-romantic-light/40 rounded-lg sm:rounded-xl text-white text-xs sm:text-sm placeholder-romantic-glow/40 focus:outline-none focus:border-romantic-glow/60 focus:ring-2 focus:ring-romantic-glow/30 transition-all"
                />
                <button
                  onClick={() => handleSendText()}
                  disabled={!text.trim() || !!loadingSuggestion}
                  className="px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-romantic-glow to-romantic-accent rounded-lg sm:rounded-xl text-white text-xs sm:text-sm font-medium hover:shadow-lg hover:shadow-romantic-glow/50 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Gửi
                </button>
              </div>
              
              {/* AI Suggestions - Compact, below textfield */}
              {(loadingSuggestions || suggestions.length > 0) && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-romantic-glow/60 text-[10px] sm:text-xs font-medium">
                    💡 Gợi ý:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {loadingSuggestions ? (
                      // Loading skeleton
                      <>
                        <div className="px-2.5 py-1.5 bg-romantic-soft/30 border border-romantic-glow/20 rounded-lg animate-pulse">
                          <div className="h-3 w-16 bg-romantic-glow/20 rounded"></div>
                        </div>
                        <div className="px-2.5 py-1.5 bg-romantic-soft/30 border border-romantic-glow/20 rounded-lg animate-pulse">
                          <div className="h-3 w-20 bg-romantic-glow/20 rounded"></div>
                        </div>
                      </>
                    ) : (
                      // Actual suggestions
                      suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleSuggestionClick(suggestion)}
                          disabled={!!loadingSuggestion}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-romantic-soft/40 border border-romantic-glow/30 rounded-lg text-white text-[11px] sm:text-xs hover:bg-romantic-soft/60 hover:border-romantic-glow/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed max-w-full"
                        >
                          <span className="truncate">{suggestion}</span>
                          {loadingSuggestion === suggestion && (
                            <span className="text-[10px] animate-spin">⏳</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-romantic-glow/20"></div>

            {/* Emoji Reactions Section - Single line, fit all */}
            <div>
              {/* <p className="text-romantic-glow/80 text-xs mb-2 text-center font-medium">
                Phản hồi nhanh
              </p> */}
              <div className="flex gap-1 sm:gap-1.5 justify-center items-center flex-wrap">
                {DEFAULT_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    id={`emoji-${emoji}`}
                    onClick={(e) => handleEmojiClick(emoji, e)}
                    className="text-lg sm:text-xl transition-transform hover:scale-110 cursor-pointer p-0.5 sm:p-1 rounded-md sm:rounded-lg hover:bg-romantic-light/30"
                  >
                    {emoji}
                  </button>
                ))}
                <div>
                  <EmojiPickerComponent onEmojiSelect={handleEmojiClick} />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
});
