'use client';

import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format, startOfDay, isSameDay, isToday, isYesterday, isThisWeek, isThisMonth, differenceInDays } from 'date-fns';
import vi from 'date-fns/locale/vi';

interface ResponseHistoryViewProps {
  userId: string;
  onBack: () => void;
  cachedHistory?: any[] | null;
  onHistoryLoaded?: (history: any[]) => void;
}

interface HistoryItem {
  id: string;
  type: 'reaction' | 'message' | 'memory';
  emoji?: string;
  content?: string;
  createdAt: string;
  dailyMessage?: string;
  senderRole?: string;
}

// Memoized formatDate function
const formatDate = (dateString: string | undefined | null): string => {
  if (!dateString) return 'Không xác định';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Không xác định';
    return format(date, 'PPp', { locale: vi });
  } catch {
    return 'Không xác định';
  }
};

// Memoized item component to prevent unnecessary re-renders
const HistoryItemComponent = memo(({ item, expandedMessages, onToggleExpand }: {
  item: HistoryItem;
  expandedMessages: Set<string>;
  onToggleExpand: (id: string) => void;
}) => {
  return (
    <div className="bg-romantic-soft/40 rounded-xl p-4 border border-romantic-light/30">
      {item.type === 'reaction' && (
        <div className="flex items-center space-x-3">
          <span className="text-3xl">{item.emoji}</span>
          <div className="flex-1">
            <p className="text-white text-sm">Phản hồi emoji</p>
            <p className="text-romantic-glow/60 text-xs">
              {formatDate(item.createdAt)}
            </p>
          </div>
        </div>
      )}

      {item.type === 'message' && item.content && (
        <div className="space-y-2">
          <div className="flex items-start space-x-2">
            <span className="text-xl">💬</span>
            <div className="flex-1">
              <p className={`text-white text-sm leading-relaxed ${
                !expandedMessages.has(`content-${item.id}`) ? 'line-clamp-2' : ''
              }`}>
                {item.content}
              </p>
              {item.content.length > 100 && (
                <button
                  onClick={() => onToggleExpand(`content-${item.id}`)}
                  className="mt-1 text-romantic-glow/80 text-xs hover:text-romantic-glow transition-colors"
                >
                  {expandedMessages.has(`content-${item.id}`) ? '▼ Thu gọn' : '▶ Xem thêm'}
                </button>
              )}
              <p className="text-romantic-glow/60 text-xs mt-2">
                {formatDate(item.createdAt)}
              </p>
            </div>
          </div>
        </div>
      )}

      {item.type === 'memory' && (
        <div className="flex items-center space-x-3">
          <span className="text-3xl">✨</span>
          <div className="flex-1">
            <p className="text-white text-sm">
              {item.senderRole === 'client' ? 'Bạn đã nhấn "Nhớ"' : 'Đã nhận "Nhớ" từ Cậu ấy'}
            </p>
            <p className="text-romantic-glow/60 text-xs">
              {formatDate(item.createdAt)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

HistoryItemComponent.displayName = 'HistoryItemComponent';

export function ResponseHistoryView({ userId, onBack, cachedHistory, onHistoryLoaded }: ResponseHistoryViewProps) {
  const [history, setHistory] = useState<HistoryItem[]>(cachedHistory || []);
  const [loading, setLoading] = useState(!cachedHistory);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'reaction' | 'message' | 'memory'>('all');
  const [newItemsCount, setNewItemsCount] = useState(0); // Visual feedback for new items
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<any>(null);
  const dailyMessagesCacheRef = useRef<Map<string, string>>(new Map());
  const updateQueueRef = useRef<HistoryItem[]>([]);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastHistoryLengthRef = useRef(history.length);
  
  const toggleMessageExpansion = useCallback((id: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Optimized realtime update - immediate with visual feedback
  const batchUpdateHistory = useCallback((newItem: HistoryItem) => {
    setHistory(prev => {
      // Check duplicate immediately
      if (prev.some(item => item.id === newItem.id)) {
        return prev;
      }
      
      // Get date key for daily message
      const itemDate = new Date(newItem.createdAt);
      itemDate.setHours(0, 0, 0, 0);
      const dateKey = itemDate.toISOString().split('T')[0];
      
      // Check cache first
      const cachedDailyMessage = dailyMessagesCacheRef.current.get(dateKey);
      const itemWithMessage = cachedDailyMessage 
        ? { ...newItem, dailyMessage: cachedDailyMessage }
        : newItem;
      
      // Fetch daily message async if not cached
      if (!cachedDailyMessage) {
        const dateStart = new Date(dateKey);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(dateKey);
        dateEnd.setHours(23, 59, 59, 999);
        
        (async () => {
          try {
            const { data: notification } = await supabase
              .from('daily_notifications')
              .select('content')
              .eq('user_id', userId)
              .gte('sent_at', dateStart.toISOString())
              .lte('sent_at', dateEnd.toISOString())
              .order('sent_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (notification?.content) {
              dailyMessagesCacheRef.current.set(dateKey, notification.content);
              setHistory(current => {
                const updated = current.map(item => 
                  item.id === newItem.id 
                    ? { ...item, dailyMessage: notification.content }
                    : item
                );
                if (onHistoryLoaded) {
                  onHistoryLoaded(updated);
                }
                return updated;
              });
            }
          } catch {
            // Silent fail
          }
        })();
      }
      
      // Add item immediately
      const updated = [itemWithMessage, ...prev].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      // Visual feedback
      setNewItemsCount(1);
      setTimeout(() => setNewItemsCount(0), 2000);
      
      if (onHistoryLoaded) {
        onHistoryLoaded(updated);
      }
      return updated;
    });
  }, [userId, supabase, onHistoryLoaded]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const [reactionsRes, messagesRes, memoriesRes] = await Promise.all([
        supabase
          .from('reactions')
          .select('id, emoji, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100), // Increased limit
        supabase
          .from('messages')
          .select('id, content, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('memories')
          .select('id, created_at, sender_role')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      const reactions = reactionsRes.data || [];
      const messages = messagesRes.data || [];
      const memories = memoriesRes.data || [];

      const allItems: HistoryItem[] = [
        ...reactions.map((r: any) => ({
          id: r.id,
          type: 'reaction' as const,
          emoji: r.emoji,
          createdAt: r.created_at,
        })),
        ...messages.map((m: any) => ({
          id: m.id,
          type: 'message' as const,
          content: m.content,
          createdAt: m.created_at,
        })),
        ...memories.map((m: any) => ({
          id: m.id,
          type: 'memory' as const,
          createdAt: m.created_at,
          senderRole: m.sender_role,
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (allItems.length === 0) {
        setHistory([]);
        setLoading(false);
        return;
      }

      // Get unique dates
      const dateKeys = new Set<string>();
      allItems.forEach(item => {
        const date = new Date(item.createdAt);
        date.setHours(0, 0, 0, 0);
        dateKeys.add(date.toISOString().split('T')[0]);
      });

      const minDate = new Date(Math.min(...Array.from(dateKeys).map(k => new Date(k).getTime())));
      const maxDate = new Date(Math.max(...Array.from(dateKeys).map(k => new Date(k).getTime())));
      minDate.setHours(0, 0, 0, 0);
      maxDate.setHours(23, 59, 59, 999);

      // Fetch all daily notifications in one query
      const { data: allNotifications } = await supabase
        .from('daily_notifications')
        .select('content, sent_at')
        .eq('user_id', userId)
        .gte('sent_at', minDate.toISOString())
        .lte('sent_at', maxDate.toISOString())
        .order('sent_at', { ascending: false });

      // Cache daily messages
      const notificationsMap = new Map<string, string>();
      if (allNotifications) {
        allNotifications.forEach(notification => {
          const notifDate = new Date(notification.sent_at);
          notifDate.setHours(0, 0, 0, 0);
          const dateKey = notifDate.toISOString().split('T')[0];
          if (!notificationsMap.has(dateKey)) {
            notificationsMap.set(dateKey, notification.content);
            dailyMessagesCacheRef.current.set(dateKey, notification.content);
          }
        });
      }

      // Map notifications to items
      const itemsWithMessages = allItems.map(item => {
        const itemDate = new Date(item.createdAt);
        itemDate.setHours(0, 0, 0, 0);
        const dateKey = itemDate.toISOString().split('T')[0];
        return {
          ...item,
          dailyMessage: notificationsMap.get(dateKey) || undefined,
        };
      });

      setHistory(itemsWithMessages);
      if (onHistoryLoaded) {
        onHistoryLoaded(itemsWithMessages);
      }
    } catch (error) {
      console.error('Load history error:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase, onHistoryLoaded]);

  // Filter and group items - memoized
  const filteredAndGroupedItems = useMemo(() => {
    let filtered = history;
    
    if (filterType !== 'all') {
      filtered = history.filter(item => item.type === filterType);
    }

    if (selectedDate) {
      const selected = new Date(selectedDate);
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.createdAt);
        return isSameDay(itemDate, selected);
      });
    }

    const groups = new Map<string, HistoryItem[]>();
    filtered.forEach(item => {
      const date = startOfDay(new Date(item.createdAt));
      const dateKey = format(date, 'yyyy-MM-dd', { locale: vi });
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(item);
    });

    return Array.from(groups.entries()).sort((a, b) => {
      return new Date(b[0]).getTime() - new Date(a[0]).getTime();
    });
  }, [history, filterType, selectedDate]);

  // Date filter options - memoized
  const dateFilterOptions = useMemo(() => {
    const dates = new Set<string>();
    history.forEach(item => {
      const date = startOfDay(new Date(item.createdAt));
      dates.add(format(date, 'yyyy-MM-dd', { locale: vi }));
    });
    
    const today = startOfDay(new Date());
    const sortedDates = Array.from(dates).sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime();
    });

    const recent: Array<{ value: string; label: string }> = [];
    const thisWeek: Array<{ value: string; label: string }> = [];
    const thisMonth: Array<{ value: string; label: string }> = [];
    const older: Array<{ value: string; label: string }> = [];

    sortedDates.forEach(dateStr => {
      const date = new Date(dateStr);
      const daysDiff = differenceInDays(today, date);
      
      let label = '';
      if (isToday(date)) {
        label = 'Hôm nay';
      } else if (isYesterday(date)) {
        label = 'Hôm qua';
      } else if (daysDiff <= 7) {
        label = format(date, 'EEEE, dd/MM', { locale: vi });
      } else if (isThisMonth(date)) {
        label = format(date, 'dd MMMM', { locale: vi });
      } else {
        label = format(date, 'dd/MM/yyyy', { locale: vi });
      }

      const option = { value: dateStr, label };
      if (daysDiff <= 1) {
        recent.push(option);
      } else if (daysDiff <= 7) {
        thisWeek.push(option);
      } else if (isThisMonth(date)) {
        thisMonth.push(option);
      } else {
        older.push(option);
      }
    });

    return { recent, thisWeek, thisMonth, older };
  }, [history]);

  // Sync with cachedHistory - optimized
  useEffect(() => {
    if (!cachedHistory || cachedHistory.length === 0) return;
    
    setHistory(prev => {
      const currentIds = new Set(prev.map(item => item.id));
      const newItems = cachedHistory.filter(item => !currentIds.has(item.id));
      
      if (newItems.length > 0) {
        // Batch add new items
        const merged = [...newItems, ...prev].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        return merged;
      }
      return prev;
    });
  }, [cachedHistory]);

  // Simplified realtime - only listen, don't fetch daily messages here
  useEffect(() => {
    if (!userId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`client-history-${userId}`)
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
          const newItem: HistoryItem = {
            id: newReaction.id,
            type: 'reaction',
            emoji: newReaction.emoji,
            createdAt: newReaction.created_at,
          };
          batchUpdateHistory(newItem);
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
          const newItem: HistoryItem = {
            id: newMessage.id,
            type: 'message',
            content: newMessage.content,
            createdAt: newMessage.created_at,
          };
          batchUpdateHistory(newItem);
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
          const newItem: HistoryItem = {
            id: newMemory.id,
            type: 'memory',
            createdAt: newMemory.created_at,
            senderRole: newMemory.sender_role,
          };
          batchUpdateHistory(newItem);
        }
      )
      .subscribe();

    channelRef.current = channel;
    const currentTimer = updateTimerRef.current;
    const currentChannel = channelRef.current;

    return () => {
      if (currentTimer) {
        clearTimeout(currentTimer);
      }
      if (currentChannel) {
        supabase.removeChannel(currentChannel);
      }
      channelRef.current = null;
    };
  }, [userId, supabase, batchUpdateHistory]);

  useEffect(() => {
    if (!cachedHistory || cachedHistory.length === 0) {
      loadHistory();
    }
  }, [loadHistory, cachedHistory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-romantic-dark via-romantic-soft to-romantic-light" style={{ backgroundColor: '#0a0e1a' }}>
        <div className="text-4xl animate-spin">✨</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-romantic-dark via-romantic-soft to-romantic-light p-4 pb-24" style={{ backgroundColor: '#0a0e1a' }}>
      <div className="max-w-md mx-auto space-y-6">
        <div className="pt-6">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-romantic-glow/80 hover:text-romantic-glow transition-colors mb-4"
          >
            <span>←</span>
            <span>Quay lại</span>
          </button>
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-light text-white">Phản hồi của bạn</h1>
            {newItemsCount > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-romantic-glow/20 rounded-full animate-pulse">
                <span className="text-xs">✨</span>
                <span className="text-romantic-glow text-xs font-medium">{newItemsCount}</span>
              </div>
            )}
          </div>
          <p className="text-romantic-glow/60 text-sm mt-1">
            {history.length} phản hồi
          </p>
        </div>

        {history.length > 0 && (
          <div className="flex items-center gap-1 sm:gap-1.5 justify-between w-full">
            <div className="flex items-center gap-1 sm:gap-1.5 flex-1 min-w-0">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2 py-1.5 rounded-lg text-[10px] sm:text-xs transition-all whitespace-nowrap flex-shrink-0 ${
                  filterType === 'all'
                    ? 'bg-romantic-glow text-white'
                    : 'bg-romantic-soft/50 text-romantic-glow/60 hover:text-romantic-glow'
                }`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setFilterType('reaction')}
                className={`px-2 py-1.5 rounded-lg text-[10px] sm:text-xs transition-all whitespace-nowrap flex-shrink-0 ${
                  filterType === 'reaction'
                    ? 'bg-romantic-glow text-white'
                    : 'bg-romantic-soft/50 text-romantic-glow/60 hover:text-romantic-glow'
                }`}
              >
                Emoji
              </button>
              <button
                onClick={() => setFilterType('message')}
                className={`px-2 py-1.5 rounded-lg text-[10px] sm:text-xs transition-all whitespace-nowrap flex-shrink-0 ${
                  filterType === 'message'
                    ? 'bg-romantic-glow text-white'
                    : 'bg-romantic-soft/50 text-romantic-glow/60 hover:text-romantic-glow'
                }`}
              >
                Tin nhắn
              </button>
              <button
                onClick={() => setFilterType('memory')}
                className={`px-2 py-1.5 rounded-lg text-[10px] sm:text-xs transition-all whitespace-nowrap flex-shrink-0 ${
                  filterType === 'memory'
                    ? 'bg-romantic-glow text-white'
                    : 'bg-romantic-soft/50 text-romantic-glow/60 hover:text-romantic-glow'
                }`}
              >
                Nhớ
              </button>
            </div>
            
            <div className="flex items-center flex-shrink-0">
              <select
                value={selectedDate || ''}
                onChange={(e) => setSelectedDate(e.target.value || null)}
                className="date-filter-select w-8 h-8 bg-romantic-soft/50 border border-romantic-light/30 rounded-lg text-white focus:outline-none focus:border-romantic-glow/50 appearance-none cursor-pointer hover:bg-romantic-soft/70 transition-colors"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23${'2E64FE'.replace(/#/g, '')}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='3' y1='6' x2='21' y2='6'/%3E%3Cline x1='7' y1='12' x2='7' y2='12'/%3E%3Cline x1='11' y1='18' x2='11' y2='18'/%3E%3Cline x1='15' y1='12' x2='15' y2='12'/%3E%3Cline x1='19' y1='6' x2='19' y2='6'/%3E%3C/svg%3E")`,
                  backgroundPosition: 'center',
                  backgroundSize: '1rem',
                  backgroundRepeat: 'no-repeat',
                  color: 'transparent',
                }}
              >
                <option value="">📅 Tất cả ngày</option>
                {dateFilterOptions.recent.length > 0 && (
                  <optgroup label="🕐 Gần đây">
                    {dateFilterOptions.recent.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </optgroup>
                )}
                {dateFilterOptions.thisWeek.length > 0 && (
                  <optgroup label="📆 Tuần này">
                    {dateFilterOptions.thisWeek.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </optgroup>
                )}
                {dateFilterOptions.thisMonth.length > 0 && (
                  <optgroup label="🗓️ Tháng này">
                    {dateFilterOptions.thisMonth.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </optgroup>
                )}
                {dateFilterOptions.older.length > 0 && (
                  <optgroup label="📜 Trước đó">
                    {dateFilterOptions.older.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>
        )}

        <div 
          className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar"
          style={{
            contain: 'layout style paint',
            willChange: 'scroll-position',
            overscrollBehavior: 'contain',
          }}
        >
          {history.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-romantic-glow/60 text-sm">Chưa có phản hồi nào</p>
            </div>
          ) : filteredAndGroupedItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-romantic-glow/60 text-sm">Không có phản hồi phù hợp với bộ lọc</p>
            </div>
          ) : (
            filteredAndGroupedItems.map(([dateKey, items]) => (
              <div key={dateKey} className="space-y-3">
                <div className="sticky top-0 bg-romantic-soft/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-romantic-glow/20 z-10">
                  <h3 className="text-romantic-glow font-medium text-sm">
                    {format(new Date(dateKey), 'EEEE, dd MMMM yyyy', { locale: vi })}
                  </h3>
                  <p className="text-romantic-glow/60 text-xs mt-0.5">
                    {items.length} {items.length === 1 ? 'phản hồi' : 'phản hồi'}
                  </p>
                </div>

                {items.length > 0 && items[0].dailyMessage && (
                  <div className="bg-gradient-to-br from-romantic-glow/20 to-romantic-accent/10 rounded-lg p-3 border border-romantic-glow/30">
                    <div className="flex items-start space-x-2 mb-2">
                      <span className="text-xl">✨</span>
                      <span className="text-romantic-glow/80 text-xs font-medium">Lời nhắn yêu thương</span>
                    </div>
                    <p className={`text-white/90 text-sm italic leading-relaxed pl-7 ${
                      !expandedMessages.has(`msg-${dateKey}`) ? 'line-clamp-3' : ''
                    }`}>
                      {items[0].dailyMessage}
                    </p>
                    {items[0].dailyMessage.length > 150 && (
                      <button
                        onClick={() => toggleMessageExpansion(`msg-${dateKey}`)}
                        className="mt-2 text-romantic-glow/80 text-xs hover:text-romantic-glow transition-colors"
                      >
                        {expandedMessages.has(`msg-${dateKey}`) ? '▼ Thu gọn' : '▶ Xem thêm'}
                      </button>
                    )}
                  </div>
                )}

                <div className="space-y-3 pl-2">
                  {items.map((item) => (
                    <HistoryItemComponent
                      key={item.id}
                      item={item}
                      expandedMessages={expandedMessages}
                      onToggleExpand={toggleMessageExpansion}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
