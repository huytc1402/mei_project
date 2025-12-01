'use client';

import { Message, Reaction, Memory } from '@/types';
import { format } from 'date-fns';
import vi from 'date-fns/locale/vi';

interface RealtimeAlertsProps {
  data: {
    reactions: Reaction[];
    messages: Message[];
    memories: Memory[];
  };
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

export function RealtimeAlerts({ data }: RealtimeAlertsProps) {
  const latestReaction = data.reactions[0];
  const latestMessage = data.messages[0];
  const latestMemory = data.memories[0];

  return (
    <div className="space-y-4">
      <div className="bg-romantic-soft/40 rounded-2xl p-6 border border-romantic-light/30">
        <h2 className="text-xl font-light text-white mb-4">Thông báo realtime</h2>

        <div className="space-y-4">
          {latestReaction && (
            <div className="bg-romantic-soft/30 rounded-lg p-4 border border-romantic-light/20 animate-fade-in">
              <div className="flex items-center space-x-3">
                <span className="text-3xl">{latestReaction.emoji}</span>
                <div className="flex-1">
                  <p className="text-white text-sm">Phản hồi mới</p>
                  <p className="text-romantic-glow/60 text-xs">
                    {formatDate(latestReaction.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {latestMessage && (
            <div className="bg-romantic-soft/30 rounded-lg p-4 border border-romantic-light/20 animate-fade-in">
              <div className="space-y-2">
                <p className="text-white text-sm font-medium">Tin nhắn mới</p>
                <p className="text-white/80 text-sm">{latestMessage.content}</p>
                <p className="text-romantic-glow/60 text-xs">
                  {formatDate(latestMessage.createdAt)}
                </p>
              </div>
            </div>
          )}

          {latestMemory && (
            <div className="bg-gradient-to-r from-romantic-accent/20 to-romantic-glow/20 rounded-lg p-4 border border-romantic-glow/30 animate-fade-in">
              <div className="flex items-center space-x-3">
                <span className="text-4xl">✨</span>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">Đom đóm sáng!</p>
                  <p className="text-romantic-glow/80 text-sm">
                    Cậu ấy đã nhấn Nhớ
                  </p>
                  <p className="text-romantic-glow/60 text-xs mt-1">
                    {formatDate(latestMemory.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!latestReaction && !latestMessage && !latestMemory && (
            <p className="text-romantic-glow/60 text-sm text-center py-8">
              Chưa có thông báo nào
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

