'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Message, Reaction, Memory, NotificationSchedule } from '@/types';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { NotificationScheduler } from './NotificationScheduler';
import { HistoryView } from './HistoryView';
import { RealtimeAlerts } from './RealtimeAlerts';
import { DeviceApproval } from './DeviceApproval';
import { SendMemory } from './SendMemory';

interface AdminDashboardProps {
  userId: string;
}

export function AdminDashboard({ userId }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'schedule' | 'history' | 'alerts' | 'devices' | 'send'>('schedule');
  const [realtimeData, setRealtimeData] = useState<{
    reactions: Reaction[];
    messages: Message[];
    memories: Memory[];
  }>({
    reactions: [],
    messages: [],
    memories: [],
  });
  const supabase = useMemo(() => createClient(), []); // Memoize Supabase client
  const channelRef = useRef<any>(null);

  const loadInitialData = useCallback(async () => {
    // Parallelize queries and select only needed fields
    const [reactionsResult, messagesResult, memoriesResult] = await Promise.all([
      supabase
        .from('reactions')
        .select('id, user_id, emoji, created_at') // Select only needed fields
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('messages')
        .select('id, user_id, content, type, emoji, created_at') // Select only needed fields
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('memories')
        .select('id, user_id, sender_role, created_at') // Select only needed fields including sender_role
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const reactions = reactionsResult.data || [];
    const messages = messagesResult.data || [];
    const memories = memoriesResult.data || [];

    // Map snake_case to camelCase
    setRealtimeData({
      reactions: reactions.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        emoji: r.emoji,
        createdAt: r.created_at,
      })),
      messages: messages.map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        content: m.content,
        type: m.type,
        emoji: m.emoji,
        createdAt: m.created_at,
      })),
      memories: memories.map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        senderRole: m.sender_role || 'client', // Default to client if not set
        createdAt: m.created_at,
      })),
    });
  }, [supabase]);

  const showClientReactionNotification = useCallback(async (emoji: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('❤️ Cậu ấy đã phản hồi', {
          body: `Cậu ấy đã gửi ${emoji}`,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: 'client-reaction',
          requireInteraction: false,
          // @ts-expect-error: 'vibrate' is not in NotificationOptions type but works in browsers supporting it
          vibrate: [200, 100, 200],
        });
      } catch (error) {
        console.error('Reaction notification error:', error);
      }
    }
  }, []);

  const showClientMessageNotification = useCallback(async (content: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('💬 Tin nhắn mới', {
          body: content.length > 50 ? content.substring(0, 50) + '...' : content,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: 'client-message',
          requireInteraction: false,
          // @ts-expect-error: 'vibrate' is not in NotificationOptions type but works in browsers supporting it
          vibrate: [200, 100, 200],
        });
      } catch (error) {
        console.error('Message notification error:', error);
      }
    }
  }, []);

  const showClientMemoryNotification = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('✨ Cậu ấy nhớ cậu', {
          body: 'Cậu ấy vừa nhấn "Nhớ" cho cậu đấy 💕',
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: 'client-memory',
          requireInteraction: false,
          // @ts-expect-error: 'vibrate' is not in NotificationOptions type but works in browsers supporting it
          vibrate: [200, 100, 200],
        });
      } catch (error) {
        console.error('Memory notification error:', error);
      }
    }
  }, []);

  const setupRealtime = useCallback(() => {
    // Clean up previous channel if exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel('admin-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reactions',
        },
        (payload: { new: any }) => {
          const reaction = payload.new as any;
          setRealtimeData((prev: typeof realtimeData) => ({
            ...prev,
            reactions: [{
              id: reaction.id,
              userId: reaction.user_id,
              emoji: reaction.emoji,
              createdAt: reaction.created_at,
            }, ...prev.reactions].slice(0, 20),
          }));
          // Show notification
          showClientReactionNotification(reaction.emoji);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload: { new: any }) => {
          const message = payload.new as any;
          setRealtimeData((prev: typeof realtimeData) => ({
            ...prev,
            messages: [{
              id: message.id,
              userId: message.user_id,
              content: message.content,
              type: message.type,
              emoji: message.emoji,
              createdAt: message.created_at,
            }, ...prev.messages].slice(0, 20),
          }));
          // Show notification
          showClientMessageNotification(message.content);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'memories',
        },
        (payload: { new: any }) => {
          const memory = payload.new as any;
          // Only show notification if it's from client
          if (memory.sender_role === 'client') {
            setRealtimeData((prev: typeof realtimeData) => ({
              ...prev,
              memories: [{
                id: memory.id,
                userId: memory.user_id,
                senderRole: memory.sender_role || 'client',
                createdAt: memory.created_at,
              }, ...prev.memories].slice(0, 20),
            }));
            // Show notification
            showClientMemoryNotification();
          } else {
            // Also add admin memories to the list (but don't show notification)
            setRealtimeData((prev: typeof realtimeData) => ({
              ...prev,
              memories: [{
                id: memory.id,
                userId: memory.user_id,
                senderRole: memory.sender_role || 'admin',
                createdAt: memory.created_at,
              }, ...prev.memories].slice(0, 20),
            }));
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
  }, [supabase, showClientReactionNotification, showClientMessageNotification, showClientMemoryNotification]);

  useEffect(() => {
    const cleanup = setupRealtime();
    loadInitialData();
    return cleanup;
  }, [setupRealtime, loadInitialData]);

  const handleRefresh = useCallback(async () => {
    await loadInitialData();
  }, [loadInitialData]);

  const { isPulling, isRefreshing, pullProgress } = usePullToRefresh({
    onRefresh: handleRefresh,
    enabled: true,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-romantic-dark via-romantic-soft to-romantic-light p-4 relative">
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
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-light text-white mb-2">Admin Dashboard</h1>
          <p className="text-romantic-glow/60 text-sm">Quản lý ứng dụng</p>
        </div>

        <div className="flex space-x-2 mb-6 bg-romantic-soft/30 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm transition-all ${
              activeTab === 'schedule'
                ? 'bg-romantic-glow text-white'
                : 'text-romantic-glow/60 hover:text-romantic-glow'
            }`}
          >
            Lịch thông báo
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm transition-all ${
              activeTab === 'history'
                ? 'bg-romantic-glow text-white'
                : 'text-romantic-glow/60 hover:text-romantic-glow'
            }`}
          >
            Lịch sử
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm transition-all ${
              activeTab === 'alerts'
                ? 'bg-romantic-glow text-white'
                : 'text-romantic-glow/60 hover:text-romantic-glow'
            }`}
          >
            Thông báo realtime
          </button>
          <button
            onClick={() => setActiveTab('devices')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm transition-all ${
              activeTab === 'devices'
                ? 'bg-romantic-glow text-white'
                : 'text-romantic-glow/60 hover:text-romantic-glow'
            }`}
          >
            Thiết bị
          </button>
          <button
            onClick={() => setActiveTab('send')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm transition-all ${
              activeTab === 'send'
                ? 'bg-romantic-glow text-white'
                : 'text-romantic-glow/60 hover:text-romantic-glow'
            }`}
          >
            Gửi Nhớ
          </button>
        </div>

        {activeTab === 'schedule' && <NotificationScheduler />}
        {activeTab === 'history' && <HistoryView data={realtimeData} />}
        {activeTab === 'alerts' && <RealtimeAlerts data={realtimeData} />}
        {activeTab === 'devices' && <DeviceApproval />}
        {activeTab === 'send' && <SendMemory />}
      </div>
    </div>
  );
}

