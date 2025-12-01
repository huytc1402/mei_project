'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format, startOfDay, isSameDay, isToday, isYesterday, isThisWeek, isThisMonth, differenceInDays } from 'date-fns';
import vi from 'date-fns/locale/vi';

interface ResponseHistoryViewProps {
  userId: string;
  onBack: () => void;
  cachedHistory?: any[] | null; // Cached history data to avoid reload
  onHistoryLoaded?: (history: any[]) => void; // Callback to cache history
}

interface HistoryItem {
  id: string;
  type: 'reaction' | 'message' | 'memory';
  emoji?: string;
  content?: string;
  createdAt: string;
  dailyMessage?: string; // Lời nhắn yêu thương tương ứng
  senderRole?: string; // For memories
}

function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return 'Không xác định';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Không xác định';
    return format(date, 'PPp', { locale: vi });
  } catch {
    return 'Không xác định';
  }
}

export function ResponseHistoryView({ userId, onBack, cachedHistory, onHistoryLoaded }: ResponseHistoryViewProps) {
  const [history, setHistory] = useState<HistoryItem[]>(cachedHistory || []);
  const [loading, setLoading] = useState(!cachedHistory); // Only show loading if no cache
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'reaction' | 'message' | 'memory'>('all');
  const supabase = useMemo(() => createClient(), []); // Memoize Supabase client
  
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

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      // Parallelize queries and select only needed fields - include memories
      const [reactionsRes, messagesRes, memoriesRes] = await Promise.all([
        supabase
          .from('reactions')
          .select('id, emoji, created_at') // Select only needed fields
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('messages')
          .select('id, content, created_at') // Select only needed fields
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('memories')
          .select('id, created_at, sender_role') // Select only needed fields
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const reactions = reactionsRes.data || [];
      const messages = messagesRes.data || [];
      const memories = memoriesRes.data || [];

      // Create all items first - include memories
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

      // Get date range from all items
      if (allItems.length === 0) {
        setHistory([]);
        setLoading(false);
        return;
      }

      const dates = allItems.map(item => new Date(item.createdAt));
      const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
      minDate.setHours(0, 0, 0, 0);
      maxDate.setHours(23, 59, 59, 999);

      // Fetch all daily notifications in date range in one query
      const { data: allNotifications } = await supabase
        .from('daily_notifications')
        .select('content, sent_at')
        .eq('user_id', userId)
        .gte('sent_at', minDate.toISOString())
        .lte('sent_at', maxDate.toISOString())
        .order('sent_at', { ascending: false });

      // Create a map of date (YYYY-MM-DD) -> notification content
      const notificationsMap = new Map<string, string>();
      if (allNotifications) {
        allNotifications.forEach(notification => {
          const notifDate = new Date(notification.sent_at);
          notifDate.setHours(0, 0, 0, 0);
          const dateKey = notifDate.toISOString().split('T')[0];
          // Only set if not already set (keep the latest one for each date)
          if (!notificationsMap.has(dateKey)) {
            notificationsMap.set(dateKey, notification.content);
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
      // Cache history data in parent component
      if (onHistoryLoaded) {
        onHistoryLoaded(itemsWithMessages);
      }
    } catch (error) {
      console.error('Load history error:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase, onHistoryLoaded]);

  const handleClearAll = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const confirmClearAll = useCallback(async () => {
    try {
      setLoading(true);
      
      // Delete all reactions
      const { error: reactionsError } = await supabase
        .from('reactions')
        .delete()
        .eq('user_id', userId);
      
      if (reactionsError) {
        console.error('Error deleting reactions:', reactionsError);
        throw reactionsError;
      }

      // Delete all messages
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('user_id', userId);
      
      if (messagesError) {
        console.error('Error deleting messages:', messagesError);
        throw messagesError;
      }

      // Clear local state
      setHistory([]);
      setExpandedMessages(new Set());
      
      // Clear cache in parent
      if (onHistoryLoaded) {
        onHistoryLoaded([]);
      }
      
      setShowClearConfirm(false);
      console.log('All history cleared successfully');
    } catch (error: any) {
      console.error('Clear all error:', error);
      alert('Có lỗi xảy ra khi xóa: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [userId, supabase, onHistoryLoaded]);

  const cancelClearAll = useCallback(() => {
    setShowClearConfirm(false);
  }, []);

  // Filter and group items
  const filteredAndGroupedItems = useMemo(() => {
    // Filter by type
    let filtered = history;
    if (filterType !== 'all') {
      filtered = history.filter(item => item.type === filterType);
    }

    // Filter by date
    if (selectedDate) {
      const selected = new Date(selectedDate);
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.createdAt);
        return isSameDay(itemDate, selected);
      });
    }

    // Group by date
    const groups = new Map<string, HistoryItem[]>();
    
    filtered.forEach(item => {
      const date = startOfDay(new Date(item.createdAt));
      const dateKey = format(date, 'yyyy-MM-dd', { locale: vi });
      
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(item);
    });

    // Sort dates descending
    return Array.from(groups.entries()).sort((a, b) => {
      return new Date(b[0]).getTime() - new Date(a[0]).getTime();
    });
  }, [history, filterType, selectedDate]);

  // Get unique dates for filter with friendly labels
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

    // Categorize dates
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

  useEffect(() => {
    // Only load if no cached data
    if (!cachedHistory || cachedHistory.length === 0) {
      loadHistory();
    }
  }, [loadHistory, cachedHistory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-romantic-dark via-romantic-soft to-romantic-light" style={{ backgroundColor: '#0a0e1a' }}>
        <div className="text-4xl animate-spin">
          ✨
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-romantic-dark via-romantic-soft to-romantic-light p-4 pb-24" style={{ backgroundColor: '#0a0e1a' }}>
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
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
            {history.length > 0 && (
              <button
                onClick={handleClearAll}
                className="px-3 py-1.5 text-xs bg-romantic-soft/60 hover:bg-romantic-soft/80 border border-romantic-glow/30 rounded-lg text-romantic-glow/80 hover:text-romantic-glow transition-all flex items-center gap-1.5"
                title="Xóa tất cả phản hồi"
              >
                <span>🗑️</span>
                <span>Clear</span>
              </button>
            )}
          </div>
          <p className="text-romantic-glow/60 text-sm mt-1">
            {history.length} phản hồi
          </p>
        </div>

        {/* Clear All Confirmation Modal */}
        {showClearConfirm && (
          <>
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] animate-fade-in"
              onClick={cancelClearAll}
            />
            <div className="fixed inset-0 flex items-center justify-center z-[70] p-4 animate-fade-in">
              <div className="bg-gradient-to-br from-romantic-dark/95 via-romantic-soft/90 to-romantic-dark/95 backdrop-blur-md rounded-2xl px-6 py-5 border border-romantic-glow/30 shadow-2xl text-center w-full max-w-[320px] mx-auto">
                <div className="text-4xl mb-3">⚠️</div>
                <h3 className="text-white text-lg font-medium mb-2">
                  Xác nhận xóa
                </h3>
                <p className="text-romantic-glow/70 text-sm mb-4">
                  Bạn có chắc muốn clear {history.length} phản hồi?<br />
                  <span className="text-xs text-romantic-glow/50">(Không thể khôi phục)</span>
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={cancelClearAll}
                    className="flex-1 px-4 py-2.5 bg-romantic-soft/60 hover:bg-romantic-soft/80 border border-romantic-glow/30 rounded-lg text-white text-sm transition-all"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={confirmClearAll}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500/80 to-red-600/80 hover:from-red-500 hover:to-red-600 rounded-lg text-white text-sm font-medium transition-all"
                  >
                    Xóa tất cả
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Filters - Only show if there are items */}
        {history.length > 0 && (
          <div className="flex items-center gap-1 sm:gap-1.5 justify-between w-full">
            {/* Type Filter - Compact buttons, fit in one row */}
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
            
            {/* Date Filter - Icon only, no text */}
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
                  color: 'transparent', // Hide text in closed state
                }}
                title="Lọc theo ngày"
              >
                <option value="">📅 Tất cả ngày</option>
                {dateFilterOptions.recent.length > 0 && (
                  <optgroup label="🕐 Gần đây">
                    {dateFilterOptions.recent.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </optgroup>
                )}
                {dateFilterOptions.thisWeek.length > 0 && (
                  <optgroup label="📆 Tuần này">
                    {dateFilterOptions.thisWeek.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </optgroup>
                )}
                {dateFilterOptions.thisMonth.length > 0 && (
                  <optgroup label="🗓️ Tháng này">
                    {dateFilterOptions.thisMonth.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </optgroup>
                )}
                {dateFilterOptions.older.length > 0 && (
                  <optgroup label="📜 Trước đó">
                    {dateFilterOptions.older.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>
        )}

        {/* History list - Grouped by date */}
        <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar">
          {history.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-romantic-glow/60 text-sm">
                Chưa có phản hồi nào
              </p>
            </div>
          ) : filteredAndGroupedItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-romantic-glow/60 text-sm">
                Không có phản hồi phù hợp với bộ lọc
              </p>
            </div>
          ) : (
            filteredAndGroupedItems.map(([dateKey, items]) => (
              <div key={dateKey} className="space-y-3">
                {/* Date Header */}
                <div className="sticky top-0 bg-romantic-soft/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-romantic-glow/20 z-10">
                  <h3 className="text-romantic-glow font-medium text-sm">
                    {format(new Date(dateKey), 'EEEE, dd MMMM yyyy', { locale: vi })}
                  </h3>
                  <p className="text-romantic-glow/60 text-xs mt-0.5">
                    {items.length} {items.length === 1 ? 'phản hồi' : 'phản hồi'}
                  </p>
                </div>

                {/* Items for this date */}
                <div className="space-y-3 pl-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-romantic-soft/40 rounded-xl p-4 border border-romantic-light/30 space-y-3"
                    >
                      {/* Daily message (lời nhắn yêu thương) - with collapse/expand */}
                      {item.dailyMessage && (
                        <div className="bg-gradient-to-br from-romantic-glow/20 to-romantic-accent/10 rounded-lg p-3 border border-romantic-glow/30">
                          <div className="flex items-start space-x-2 mb-2">
                            <span className="text-xl">✨</span>
                            <span className="text-romantic-glow/80 text-xs font-medium">Lời nhắn yêu thương</span>
                          </div>
                          <p className={`text-white/90 text-sm italic leading-relaxed pl-7 ${
                            !expandedMessages.has(`msg-${item.id}`) ? 'line-clamp-3' : ''
                          }`}>
                            {item.dailyMessage}
                          </p>
                          {item.dailyMessage.length > 150 && (
                            <button
                              onClick={() => toggleMessageExpansion(`msg-${item.id}`)}
                              className="mt-2 text-romantic-glow/80 text-xs hover:text-romantic-glow transition-colors"
                            >
                              {expandedMessages.has(`msg-${item.id}`) ? '▼ Thu gọn' : '▶ Xem thêm'}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Response content */}
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
                                  onClick={() => toggleMessageExpansion(`content-${item.id}`)}
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
                              {item.senderRole === 'client' ? 'Bạn đã nhấn "Nhớ"' : 'Đã nhận "Nhớ" từ admin'}
                            </p>
                            <p className="text-romantic-glow/60 text-xs">
                              {formatDate(item.createdAt)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
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
