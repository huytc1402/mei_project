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

interface ClientMainScreenProps {
  userId: string;
}

export function ClientMainScreen({ userId }: ClientMainScreenProps) {
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [adminMemoryCount, setAdminMemoryCount] = useState(0);
  const [historyCache, setHistoryCache] = useState<any[] | null>(null); // Cache history data
  const supabase = useMemo(() => createClient(), []); // Memoize Supabase client
  const channelRef = useRef<any>(null);
  
  // Use refs for functions called in callbacks to avoid circular dependencies
  const loadAdminMemoryCountRef = useRef<() => Promise<void>>();
  const showAdminMemoryNotificationRef = useRef<() => Promise<void>>();
  const showDeviceApprovalNotificationRef = useRef<() => Promise<void>>();

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
        // Telegram alert - fire and forget (don't wait for it)
        fetch('/api/telegram/alert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'reaction',
            emoji,
            timestamp: new Date().toLocaleString('vi-VN'),
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
        // Telegram alert - fire and forget
        fetch('/api/telegram/alert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'message',
            content,
            timestamp: new Date().toLocaleString('vi-VN'),
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
    // Reset response box state but keep current message
  }, []);

  const setupRealtime = useCallback(() => {
    // Clean up previous channel if exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel('client-updates')
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
            // Show notification to client
            showAdminMemoryNotificationRef.current?.();
            // Update admin memory count
            loadAdminMemoryCountRef.current?.();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'devices',
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: any, old: any }) => {
          const device = payload.new as any;
          const oldDevice = payload.old as any;
          // Check if device was just approved (is_active changed from false to true)
          if (oldDevice && oldDevice.is_active === false && device.is_active === true) {
            showDeviceApprovalNotificationRef.current?.();
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, supabase]);

  const showAdminMemoryNotification = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('✨ Tớ nhớ cậu', {
          body: 'Tớ vừa nhấn "Nhớ" cho cậu đấy 💕',
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: 'admin-memory',
          requireInteraction: false,
          // @ts-expect-error: 'vibrate' is not in NotificationOptions type but works in browsers supporting it
          vibrate: [200, 100, 200],
        });
      } catch (error) {
        console.error('Notification error:', error);
      }
    }
  }, []);

  const showDeviceApprovalNotification = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('✅ Thiết bị đã được duyệt', {
          body: 'Thiết bị của bạn đã được admin xác nhận. Bạn có thể tiếp tục sử dụng ứng dụng! 🎉',
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: 'device-approval',
          requireInteraction: false,
          // @ts-expect-error: 'vibrate' is not in NotificationOptions type but works in browsers supporting it
          vibrate: [200, 100, 200],
        });
      } catch (error) {
        console.error('Device approval notification error:', error);
      }
    }
  }, []);

  const checkNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
  }, []);

  const loadAdminMemoryCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('memories')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('sender_role', 'admin');
      
      if (error) throw error;
      setAdminMemoryCount(count || 0);
    } catch (error) {
      console.error('Load admin memory count error:', error);
    }
  }, [userId, supabase]);

  // Update refs when functions change
  useEffect(() => {
    loadAdminMemoryCountRef.current = loadAdminMemoryCount;
    showAdminMemoryNotificationRef.current = showAdminMemoryNotification;
    showDeviceApprovalNotificationRef.current = showDeviceApprovalNotification;
  }, [loadAdminMemoryCount, showAdminMemoryNotification, showDeviceApprovalNotification]);

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

  useEffect(() => {
    loadDailyMessage();
    loadAdminMemoryCount();
    const cleanup = setupRealtime();
    checkNotificationPermission();
    
    return cleanup;
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
          Đang tạo lời nhắn yêu thương...
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-romantic-dark via-romantic-soft to-romantic-light relative overflow-hidden flex flex-col">
      {/* Pull to refresh overlay */}
      {(isPulling || isRefreshing) && (
        <div 
          className="fixed top-0 left-0 right-0 z-50 flex flex-col items-center justify-center transition-all duration-200"
          style={{
            height: `${Math.min(pullProgress * 100, 100)}px`,
            backgroundColor: 'rgba(10, 14, 26, 0.95)',
            backdropFilter: 'blur(10px)',
              }}
        >
          {isRefreshing ? (
            <div className="flex flex-col items-center gap-2">
              <div className="text-2xl animate-spin">✨</div>
              <p className="text-romantic-glow/80 text-xs">Đang tải lại...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div 
                className="text-2xl transition-transform"
                style={{ transform: `rotate(${pullProgress * 180}deg)` }}
              >
                ⬇️
              </div>
              <p className="text-romantic-glow/60 text-xs">Kéo để làm mới</p>
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
          />
          
          {/* Admin memory count and History button */}
          <div className="flex items-center gap-2">
            {/* Admin Memory Count */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-romantic-soft/40 backdrop-blur-sm rounded-lg border border-romantic-glow/30">
              <span className="text-base sm:text-lg">✨</span>
              <span className="text-white text-xs sm:text-sm font-medium">{adminMemoryCount}</span>
            </div>
            
            {/* History button */}
            <button
              onClick={handleViewHistory}
              className="w-10 h-10 bg-romantic-soft/40 backdrop-blur-sm rounded-full flex items-center justify-center border border-romantic-glow/30 hover:bg-romantic-soft/60 transition-colors"
              title="Xem lại phản hồi"
            >
              <span className="text-xl">📦</span>
            </button>
          </div>
        </div>

        {/* Main content area - centered and compact */}
        <div className="flex-1 flex flex-col justify-center space-y-2 sm:space-y-3 min-h-0 overflow-y-auto">
          {/* AI Message - The star of the show */}
          {currentMessage && (
            <div className="flex-shrink-0">
              <AIMessage message={currentMessage} />
            </div>
          )}

          {/* Response Box */}
          {currentMessage && (
            <div className="flex-shrink-0">
              <ResponseBox
                onReaction={handleReaction}
                onMessage={handleQuickReply}
                onMemory={handleMemory}
                onViewHistory={handleViewHistory}
                userId={userId}
                currentMessage={currentMessage}
              />
            </div>
          )}

          {/* Memory Button - In layout flow */}
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
    </div>
  );
}

