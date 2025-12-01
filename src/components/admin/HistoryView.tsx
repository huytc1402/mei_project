'use client';

import { useState, useMemo } from 'react';
import { Message, Reaction, Memory } from '@/types';
import { format, startOfDay, isSameDay, isToday, isYesterday, isThisWeek, isThisMonth, differenceInDays } from 'date-fns';
import vi from 'date-fns/locale/vi';

// Component for message with expand/collapse
function MessageItem({ message, createdAt }: { message: string; createdAt: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const MAX_LENGTH = 100; // Approximate 2 lines
  
  const shouldTruncate = message.length > MAX_LENGTH;
  const displayText = isExpanded ? message : (shouldTruncate ? message.substring(0, MAX_LENGTH) + '...' : message);

  return (
    <div className="space-y-2">
      <p className={`text-white text-sm ${!isExpanded && shouldTruncate ? 'line-clamp-2' : ''}`}>
        {displayText}
      </p>
      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-romantic-glow/60 text-xs hover:text-romantic-glow transition-colors"
        >
          {isExpanded ? '▼ Thu gọn' : '▶ Xem thêm'}
        </button>
      )}
      <p className="text-romantic-glow/60 text-xs">
        {format(new Date(createdAt), 'PPp', { locale: vi })}
      </p>
    </div>
  );
}

interface HistoryViewProps {
  data: {
    reactions: Reaction[];
    messages: Message[];
    memories: Memory[];
  };
}

type HistoryItem =
  | (Reaction & { itemType: 'reaction' })
  | (Message & { itemType: 'message' })
  | (Memory & { itemType: 'memory' });

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

export function HistoryView({ data }: HistoryViewProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'reaction' | 'message' | 'memory'>('all');

  const allItems: HistoryItem[] = useMemo(() => {
    const items = [
      ...data.reactions.map((r) => ({ ...r, itemType: 'reaction' as const })),
      ...data.messages.map((m) => ({ ...m, itemType: 'message' as const })),
      ...data.memories.map((m) => ({ ...m, itemType: 'memory' as const })),
    ].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      if (isNaN(dateA) || isNaN(dateB)) return 0;
      return dateB - dateA;
    });

    // Filter by type
    let filtered = items;
    if (filterType !== 'all') {
      filtered = items.filter(item => item.itemType === filterType);
    }

    // Filter by date
    if (selectedDate) {
      const selected = new Date(selectedDate);
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.createdAt);
        return isSameDay(itemDate, selected);
      });
    }

    return filtered;
  }, [data, filterType, selectedDate]);

  // Group items by date
  const groupedItems = useMemo(() => {
    const groups = new Map<string, HistoryItem[]>();
    
    allItems.forEach(item => {
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
  }, [allItems]);

  // Get unique dates for filter with friendly labels
  const dateFilterOptions = useMemo(() => {
    const dates = new Set<string>();
    const allItemsForDates = [
      ...data.reactions.map((r) => ({ ...r, itemType: 'reaction' as const })),
      ...data.messages.map((m) => ({ ...m, itemType: 'message' as const })),
      ...data.memories.map((m) => ({ ...m, itemType: 'memory' as const })),
    ];
    
    allItemsForDates.forEach(item => {
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
  }, [data]);

  return (
    <div className="bg-romantic-soft/40 rounded-2xl p-6 border border-romantic-light/30">
      <h2 className="text-xl font-light text-white mb-4">Lịch sử tương tác</h2>

      {/* Filters */}
      <div className="mb-4">
        {/* Type Filter and Date Filter in same row */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
              filterType === 'all'
                ? 'bg-romantic-glow text-white'
                : 'bg-romantic-soft/50 text-romantic-glow/60 hover:text-romantic-glow'
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setFilterType('reaction')}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
              filterType === 'reaction'
                ? 'bg-romantic-glow text-white'
                : 'bg-romantic-soft/50 text-romantic-glow/60 hover:text-romantic-glow'
            }`}
          >
            Emoji
          </button>
          <button
            onClick={() => setFilterType('message')}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
              filterType === 'message'
                ? 'bg-romantic-glow text-white'
                : 'bg-romantic-soft/50 text-romantic-glow/60 hover:text-romantic-glow'
            }`}
          >
            Tin nhắn
          </button>
          <button
            onClick={() => setFilterType('memory')}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
              filterType === 'memory'
                ? 'bg-romantic-glow text-white'
                : 'bg-romantic-soft/50 text-romantic-glow/60 hover:text-romantic-glow'
            }`}
          >
            Nhớ
          </button>
          
          {/* Date Filter - Icon only */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-romantic-glow/60 text-xs">🔽</span>
            <select
              value={selectedDate || ''}
              onChange={(e) => setSelectedDate(e.target.value || null)}
              className="px-3 py-1.5 bg-romantic-soft/50 border border-romantic-light/30 rounded-lg text-white text-xs focus:outline-none focus:border-romantic-glow/50"
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
      </div>

      {/* Grouped Items by Date */}
      <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
        {groupedItems.length === 0 ? (
          <p className="text-romantic-glow/60 text-sm text-center py-8">
            Chưa có tương tác nào
          </p>
        ) : (
          groupedItems.map(([dateKey, items]) => (
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
              <div className="space-y-2 pl-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-romantic-soft/30 rounded-lg p-4 border border-romantic-light/20"
                  >
                    {item.itemType === 'reaction' && (
                      <div className="flex items-center space-x-3">
                        <span className="text-3xl flex-shrink-0">{(item as Reaction & { itemType: 'reaction' }).emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm">Phản hồi emoji</p>
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-romantic-accent/30 text-romantic-accent border border-romantic-accent/50">
                              💕 Client
                            </span>
                          </div>
                          <p className="text-romantic-glow/60 text-xs">
                            {formatDate(item.createdAt)}
                          </p>
                        </div>
                      </div>
                    )}

                    {item.itemType === 'message' && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-romantic-accent/30 text-romantic-accent border border-romantic-accent/50">
                            💕 Client
                          </span>
                        </div>
                        <MessageItem message={(item as Message & { itemType: 'message' }).content} createdAt={item.createdAt} />
                      </div>
                    )}

                    {item.itemType === 'memory' && (
                      <div className="flex items-center space-x-3">
                        <span className="text-3xl">✨</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm">Đã nhấn Nhớ</p>
                            {(item as Memory & { itemType: 'memory' }).senderRole && (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                (item as Memory & { itemType: 'memory' }).senderRole === 'admin'
                                  ? 'bg-romantic-glow/30 text-romantic-glow border border-romantic-glow/50'
                                  : 'bg-romantic-accent/30 text-romantic-accent border border-romantic-accent/50'
                              }`}>
                                {(item as Memory & { itemType: 'memory' }).senderRole === 'admin' ? '👤 Admin' : '💕 Client'}
                              </span>
                            )}
                          </div>
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
  );
}

