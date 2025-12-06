'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Message, Reaction } from '@/types';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { NotificationToggle } from './NotificationToggle';
import { AIMessage } from './AIMessage';
import { ResponseBox } from './ResponseBox';
import { MemoryButton } from './MemoryButton';
import { ResponseHistoryView } from './ResponseHistoryView';
import { NotificationPopup } from '@/components/NotificationPopup';
import { PrivacyNotice } from './PrivacyNotice';
import { UserPreferences } from './UserPreferences';

interface ClientMainScreenProps {
  userId: string;
}

export function ClientMainScreen({ userId }: ClientMainScreenProps) {
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [adminMemoryCount, setAdminMemoryCount] = useState(0);
  const [historyCache, setHistoryCache] = useState<any[] | null>(null); // Cache history data
  const [suggestionsCache, setSuggestionsCache] = useState<string[]>([]); // Cache suggestions when navigating to history
  const [glowEffect, setGlowEffect] = useState(false); // For glow effect when admin sends memory
  const [showMemoryTooltip, setShowMemoryTooltip] = useState(false); // Tooltip for memory count
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'memory' | 'reaction' | 'message'>('memory');
  const prevMemoryCountRef = useRef(0); // Track previous count for glow effect
  const tooltipRef = useRef<HTMLDivElement>(null); // Ref for tooltip container
  const supabase = useMemo(() => createClient(), []); // Memoize Supabase client
  const channelRef = useRef<any>(null);

  // Use refs for functions called in callbacks to avoid circular dependencies
  const loadAdminMemoryCountRef = useRef<() => Promise<void>>();
  const showAdminMemoryNotificationRef = useRef<() => Promise<void>>();

  const generateNewMessage = useCallback(async () => {
    try {
      const response = await fetch('/api/ai/generate-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();

      if (result.success && result.notification) {
        setCurrentMessage(result.notification);
      }
    } catch (error) {
      console.error('Generate message error:', error);
    }
  }, [userId]);

  const loadDailyMessage = useCallback(async () => {
    try {
      setLoading(true);
      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.toISOString();

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStart = tomorrow.toISOString();

      // Check if message for today already exists - optimized query (select only needed fields)
      const { data: notification } = await supabase
        .from('daily_notifications')
        .select('id, user_id, content, sent_at') // Select only needed fields
        .eq('user_id', userId)
        .gte('sent_at', todayStart)
        .lt('sent_at', tomorrowStart)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (notification) {
        // Message for today exists, use it
        setCurrentMessage({
          id: notification.id,
          userId: notification.user_id,
          content: notification.content,
          type: 'ai',
          createdAt: notification.sent_at,
        });
        setLoading(false);
      } else {
        // No message for today, generate one (only once per day)
        await generateNewMessage();
        setLoading(false);
      }
    } catch (error) {
      console.error('Load message error:', error);
      setLoading(false);
    }
  }, [userId, supabase, generateNewMessage]);

  const handleReaction = useCallback(async (emoji: string) => {
    try {
      // Parallelize database insert and telegram alert (fire and forget for telegram)
      const [reactionResult] = await Promise.allSettled([
        supabase
          .from('reactions')
          .insert({
            user_id: userId,
            emoji,
          })
          .select('id') // Select only id
          .single(),
        // Telegram alert + Push notification - fire and forget (don't wait for it)
        fetch('/api/telegram/alert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'reaction',
            emoji,
            timestamp: new Date().toLocaleString('vi-VN'),
            userId, // Pass userId for push notification
          }),
        }).catch(err => console.error('Telegram alert error:', err)), // Silent fail
      ]);

      if (reactionResult.status === 'fulfilled' && reactionResult.value.data) {
        // Success
      }
    } catch (error) {
      console.error('Reaction error:', error);
    }
  }, [userId, supabase]);

  const handleQuickReply = useCallback(async (content: string) => {
    try {
      // Parallelize database insert and telegram alert (fire and forget for telegram)
      const [messageResult] = await Promise.allSettled([
        supabase
          .from('messages')
          .insert({
            user_id: userId,
            content,
            type: 'quick_reply',
          })
          .select('id') // Select only id
          .single(),
        // Telegram alert + Push notification - fire and forget
        fetch('/api/telegram/alert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'message',
            content,
            timestamp: new Date().toLocaleString('vi-VN'),
            userId, // Pass userId for push notification
          }),
        }).catch(err => console.error('Telegram alert error:', err)), // Silent fail
      ]);

      if (messageResult.status === 'fulfilled' && messageResult.value.data) {
        // Success
      }
    } catch (error) {
      console.error('Quick reply error:', error);
    }
  }, [userId, supabase]);

  const handleMemory = useCallback(async (): Promise<void> => {
    try {
      // Parallelize all operations
      const [memoryResult] = await Promise.allSettled([
        supabase
          .from('memories')
          .insert({
            user_id: userId,
            sender_role: 'client', // Mark as sent by client
          } as any)
          .select('id') // Select only id
          .single(),
        // Send notification to admin - fire and forget
        // Only use /api/client/send-memory to avoid duplicate telegram notifications
        fetch('/api/client/send-memory', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }).catch(err => console.error('Send memory error:', err)),
      ]);

      if (memoryResult.status === 'fulfilled' && memoryResult.value.data) {
        // Success
      } else if (memoryResult.status === 'rejected') {
        throw memoryResult.reason;
      }
    } catch (error) {
      console.error('Memory error:', error);
      throw error; // Re-throw to let MemoryButton handle it
    }
  }, [userId, supabase]);

  const handleViewHistory = useCallback(() => {
    setShowHistory(true);
    // History will be loaded by ResponseHistoryView if cache is empty
  }, []);

  const handleBackFromHistory = useCallback(() => {
    setShowHistory(false);
    // Keep suggestions cached - they will be restored by ResponseBox
  }, []);

  const handleSuggestionsCache = useCallback((suggestions: string[]) => {
    setSuggestionsCache(suggestions);
  }, []);

  const setupRealtime = useCallback(() => {
    // Clean up previous channel if exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`client-updates-${userId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'daily_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: any }) => {
          const notification = payload.new as any;
          setCurrentMessage({
            id: notification.id,
            userId: notification.user_id,
            content: notification.content,
            type: 'ai',
            createdAt: notification.sent_at,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'memories',
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: any }) => {
          const memory = payload.new as any;
          // Check if it's from admin
          if (memory.sender_role === 'admin' && memory.user_id === userId) {
            // Immediately update count and trigger effects
            loadAdminMemoryCountRef.current?.();
            
            // Trigger glow effect
            setGlowEffect(true);
            setTimeout(() => setGlowEffect(false), 4000);
            
            // Show popup notification
            setNotificationType('memory');
            setNotificationMessage('✨ Có năng lượng mới');
            setShowNotificationPopup(true);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reactions',
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: any }) => {
          const newReaction = payload.new as any;
          const newItem = {
            id: newReaction.id,
            type: 'reaction' as const,
            emoji: newReaction.emoji,
            createdAt: newReaction.created_at,
          };
          
          // Optimized update - check duplicate first
          setHistoryCache(prev => {
            if (!prev) return [newItem];
            const exists = prev.some(item => item.id === newItem.id);
            if (exists) return prev;
            // Use functional update to avoid stale closure
            return [newItem, ...prev].sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: any }) => {
          const newMessage = payload.new as any;
          const newItem = {
            id: newMessage.id,
            type: 'message' as const,
            content: newMessage.content,
            createdAt: newMessage.created_at,
          };
          
          // Optimized update
          setHistoryCache(prev => {
            if (!prev) return [newItem];
            const exists = prev.some(item => item.id === newItem.id);
            if (exists) return prev;
            return [newItem, ...prev].sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'memories',
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: any }) => {
          const newMemory = payload.new as any;
          const newItem = {
            id: newMemory.id,
            type: 'memory' as const,
            createdAt: newMemory.created_at,
            senderRole: newMemory.sender_role,
          };
          
          // Batch update history cache
          setHistoryCache(prev => {
            if (!prev) return [newItem];
            if (prev.some(item => item.id === newItem.id)) return prev;
            return [newItem, ...prev].sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Client: Realtime channel error');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, supabase]);

  const showAdminMemoryNotification = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('✨ Có năng lượng mới', {
          body: 'Có năng lượng mới từ bạn ✨',
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: 'admin-memory',
          requireInteraction: false,
          silent: true, // Silent notification - no sound, no vibrate
          // Removed vibrate completely
        });
      } catch (error) {
        console.error('Notification error:', error);
      }
    }
  }, []);

  const checkNotificationPermission = useCallback(async () => {
    // Check actual subscription status, not just permission
    try {
      if (!('serviceWorker' in navigator) || !userId) {
        setNotificationsEnabled(false);
        return;
      }

      const { PushSubscriptionService } = await import('@/services/push-subscription.service');
      const pushService = new PushSubscriptionService();
      
      if (!pushService.isSupported()) {
        setNotificationsEnabled(false);
        return;
      }

      const subscription = await pushService.getSubscription();
      setNotificationsEnabled(!!subscription);
      console.log('🔍 Notification status checked:', !!subscription ? 'Subscribed' : 'Not subscribed');
    } catch (error) {
      console.error('Error checking notification status:', error);
      setNotificationsEnabled(false);
    }
  }, [userId]);

  const loadAdminMemoryCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('memories')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('sender_role', 'admin');

      if (error) {
        console.error('Load admin memory count error:', error);
        return;
      }

      const newCount = count || 0;

      // Trigger glow effect if count increased (and not first load)
      if (prevMemoryCountRef.current > 0 && newCount > prevMemoryCountRef.current) {
        setGlowEffect(true);
        setTimeout(() => setGlowEffect(false), 4000);
      }

      prevMemoryCountRef.current = newCount;
      setAdminMemoryCount(newCount);
    } catch (error) {
      console.error('Load admin memory count error:', error);
    }
  }, [userId, supabase]);

  // Update refs when functions change
  useEffect(() => {
    loadAdminMemoryCountRef.current = loadAdminMemoryCount;
    showAdminMemoryNotificationRef.current = showAdminMemoryNotification;
  }, [loadAdminMemoryCount, showAdminMemoryNotification]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      loadDailyMessage(),
      loadAdminMemoryCount(),
    ]);
  }, [loadDailyMessage, loadAdminMemoryCount]);

  const { isPulling, isRefreshing, pullProgress } = usePullToRefresh({
    onRefresh: handleRefresh,
    enabled: !showHistory && !loading,
  });

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setShowMemoryTooltip(false);
      }
    };

    if (showMemoryTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showMemoryTooltip]);

  // Auto-subscribe to push notifications when user logs in
  useEffect(() => {
    const autoSubscribe = async () => {
      if (!userId) return;

      try {
        const { PushSubscriptionService } = await import('@/services/push-subscription.service');
        const pushService = new PushSubscriptionService();

        if (!pushService.isSupported()) {
          console.log('Push notifications not supported');
          return;
        }

        // Check if already subscribed
        const existingSubscription = await pushService.getSubscription();
        if (existingSubscription) {
          // Already subscribed, verify it's saved on server
          const userAgent = navigator.userAgent;
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              subscription: existingSubscription,
              userAgent,
            }),
          }).catch(() => {
            // Silent fail
          });
          setNotificationsEnabled(true);
          return;
        }

        // Check permission
        if (Notification.permission === 'default') {
          // Permission not yet requested, wait for user to toggle
          return;
        }

        if (Notification.permission === 'granted') {
          // Permission granted, auto-subscribe
          const subscription = await pushService.subscribe(userId);
          if (subscription) {
            setNotificationsEnabled(true);
            console.log('✅ Auto-subscribed to push notifications');
          }
        }
      } catch (error) {
        console.error('Auto-subscribe error:', error);
        // Silent fail - user can manually subscribe via toggle
      }
    };

    // Wait a bit for service worker to be ready
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        setTimeout(autoSubscribe, 2000);
      });
    }
  }, [userId]);

  useEffect(() => {
    loadDailyMessage();
    loadAdminMemoryCount();
    const cleanup = setupRealtime();
    checkNotificationPermission();

    // Poll admin memory count periodically as fallback
    const pollInterval = setInterval(() => {
      if (loadAdminMemoryCountRef.current) {
        loadAdminMemoryCountRef.current();
      }
    }, 5000); // Poll every 5 seconds

    return () => {
      cleanup();
      clearInterval(pollInterval);
    };
  }, [loadDailyMessage, loadAdminMemoryCount, setupRealtime, checkNotificationPermission]);

  if (showHistory) {
    return (
      <ResponseHistoryView
        userId={userId}
        onBack={handleBackFromHistory}
        cachedHistory={historyCache}
        onHistoryLoaded={setHistoryCache}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-romantic-dark via-romantic-soft to-romantic-light">
        <div className="text-6xl mb-4 animate-pulse">
          ✨
        </div>
        <p className="text-romantic-glow/60 text-sm">
          <span>Đang tạo lời nhắn cho bạn</span>
          <span className="animate-pulse">.</span>
          <span className="animate-pulse delay-200">.</span>
          <span className="animate-pulse delay-400">.</span>
        </p>
        
      </div>
    );
  }

  return (
      <div className={`h-screen bg-gradient-to-br from-romantic-dark via-romantic-soft to-romantic-light relative overflow-hidden flex flex-col transition-all duration-1000 ${glowEffect ? 'animate-glow-pulse' : ''}`} style={{ overflow: 'hidden' }}>
      {/* Magical glow overlay effect */}
      {glowEffect && (
        <div className="fixed inset-0 pointer-events-none z-[9999] dreamy-glow">
          {/* MULTI-LAYER AURORA */}
          <div className="aurora-layer layer-1" />
          <div className="aurora-layer layer-2" />
          <div className="aurora-layer layer-3" />

          {/* Pulse */}
          <div className="pulse-ring" />

          {/* Sparkles */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="sparkle"
              style={{
                left: `${50 + (Math.random() * 70 - 35)}%`,
                top: `${50 + (Math.random() * 50 - 25)}%`,
                animationDelay: `${i * 0.35}s`
              }}
            />
          ))}
        </div>
      )}


      {/* Pull to refresh overlay - Simplified */}
      {(isPulling || isRefreshing) && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex flex-col items-center justify-center transition-all duration-300"
          style={{
            height: `${Math.min(pullProgress * 80, 80)}px`,
            backgroundColor: 'rgba(10, 14, 26, 0.9)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {isRefreshing ? (
            <div className="flex flex-col items-center gap-2">
              <div className="text-3xl animate-spin">✨</div>
              <p className="text-romantic-glow/90 text-sm font-medium">Đang tải lại...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                className="text-3xl transition-transform duration-200"
                style={{ 
                  transform: `translateY(${pullProgress * 10}px) rotate(${pullProgress >= 1 ? 180 : pullProgress * 180}deg)`,
                  opacity: pullProgress
                }}
              >
                ⬇️
              </div>
              <p className="text-romantic-glow/70 text-xs" style={{ opacity: pullProgress }}>
                {pullProgress >= 1 ? 'Thả để làm mới' : 'Kéo xuống để làm mới'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Static background accent - minimal performance impact */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-romantic-glow/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-romantic-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md mx-auto w-full h-full flex flex-col px-3 sm:px-4 py-2 sm:py-3">
        {/* Header with notification toggle and history button */}
        <div className="flex items-center justify-between flex-shrink-0">
          <NotificationToggle
            enabled={notificationsEnabled}
            onChange={setNotificationsEnabled}
            userId={userId}
          />

          {/* Right side: Memory count, Settings icons, History */}
          <div className="flex items-center gap-2">
            {/* Admin Memory Count with Click to Show Info */}
            <div className="relative" ref={tooltipRef}>
              <button
                className="w-9 h-9 bg-romantic-soft/40 backdrop-blur-sm rounded-full flex items-center justify-center border border-romantic-glow/30 hover:bg-romantic-soft/60 transition-colors relative"
                onClick={() => setShowMemoryTooltip(!showMemoryTooltip)}
                title="Năng lượng đã nhận"
              >
                <span className="text-lg">✨</span>
                {adminMemoryCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-romantic-accent rounded-full text-[10px] font-bold text-white">
                    {adminMemoryCount > 99 ? '99+' : adminMemoryCount}
                  </span>
                )}
              </button>
              {showMemoryTooltip && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-romantic-dark/95 backdrop-blur-md rounded-lg p-3 border border-romantic-glow/30 shadow-xl z-50 animate-fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-romantic-glow/80 text-xs font-medium">Năng lượng</span>
                    <button
                      onClick={() => setShowMemoryTooltip(false)}
                      className="text-romantic-glow/60 hover:text-romantic-glow text-xs ml-auto"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-white text-xs leading-relaxed">
                    Cậu ấy đã gửi năng lượng cho bạn ✨
                  </p>
                </div>
              )}
            </div>

            {/* Privacy Notice - Compact icon */}
            <PrivacyNotice />

            {/* User Preferences - Compact icon */}
            <UserPreferences userId={userId} />

            {/* History button */}
            <button
              onClick={handleViewHistory}
              className="w-9 h-9 bg-romantic-soft/40 backdrop-blur-sm rounded-full flex items-center justify-center border border-romantic-glow/30 hover:bg-romantic-soft/60 transition-colors"
              title="Xem lại phản hồi"
            >
              <span className="text-lg">📦</span>
            </button>
          </div>
        </div>

        {/* Main content area - centered and compact - NO SCROLL */}
        <div className="flex-1 flex flex-col justify-center space-y-2 sm:space-y-3 min-h-0 overflow-hidden">
          {/* AI Message - Scrollable box */}
          {currentMessage && (
            <div className="flex-shrink-0 w-full">
              <AIMessage message={currentMessage} />
            </div>
          )}

          {/* Response Box - Fixed */}
          {currentMessage && (
            <div className="flex-shrink-0">
              <ResponseBox
                onReaction={handleReaction}
                onMessage={handleQuickReply}
                onMemory={handleMemory}
                onViewHistory={handleViewHistory}
                userId={userId}
                currentMessage={currentMessage}
                onSuggestionsCache={handleSuggestionsCache}
                cachedSuggestions={suggestionsCache}
              />
            </div>
          )}

          {/* Memory Button - Fixed */}
          {currentMessage && (
            <div className="flex-shrink-0 py-2">
              <MemoryButton
                onMemory={handleMemory}
              />
            </div>
          )}
        </div>

        {/* Empty state if no message */}
        {!currentMessage && !loading && (
          <div className="text-center py-12">
            <p className="text-romantic-glow/60 text-sm">
              Đang tạo lời nhắn cho bạn...
            </p>
          </div>
        )}
      </div>

      {/* Notification Popup */}
      <NotificationPopup
        show={showNotificationPopup}
        message={notificationMessage}
        type={notificationType}
        onClose={() => setShowNotificationPopup(false)}
      />
    </div>
  );
}

