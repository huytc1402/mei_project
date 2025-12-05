'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/Toast';

export function SendMemory() {
  const [isSending, setIsSending] = useState(false);
  const [clientMemoryCount, setClientMemoryCount] = useState(0);
  const supabase = createClient();
  const channelRef = useRef<any>(null);
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    loadClientMemoryCount();

    // Setup realtime subscription for memories
    const channel = supabase
      .channel(`admin-memory-count-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'memories',
        },
        (payload: { new: any }) => {
          const memory = payload.new as any;
          // Only update if it's from client
          if (memory.sender_role === 'client') {
            loadClientMemoryCount();
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [supabase]);

  async function loadClientMemoryCount() {
    try {
      const { data: clientUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'client')
        .limit(1);

      if (clientUsers && clientUsers.length > 0) {
        const clientId = (clientUsers[0] as any).id;
        const { count, error } = await supabase
          .from('memories')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', clientId)
          .eq('sender_role', 'client');

        if (error) {
          console.error('Load client memory count error:', error);
          return;
        }

        setClientMemoryCount(count || 0);
      }
    } catch (error) {
      console.error('Load memory count error:', error);
    }
  }

  async function handleSendMemory() {
    if (isSending) return;

    setIsSending(true);

    try {
      const response = await fetch('/api/admin/send-memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        // Reload client memory count after sending
        await loadClientMemoryCount();
      } else {
        showToast('Gửi thất bại: ' + (result.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Send memory error:', error);
      showToast('Có lỗi xảy ra khi gửi', 'error');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="bg-gradient-to-br from-romantic-soft/50 to-romantic-light/30 rounded-2xl p-6 border border-romantic-glow/30 backdrop-blur-sm shadow-lg">
      <div className="flex items-center justify-between mb-4">

        {clientMemoryCount > 0 && (
          <div className="text-romantic-glow/80 text-sm">
            Cậu ấy đã nhớ: <span className="font-medium">{clientMemoryCount}</span> lần
          </div>
        )}
      </div>


      {/* Memory Send Button - Style #1: Clean Loading */}
      <div className="w-full">
        <button
          onClick={handleSendMemory}
          disabled={isSending}
          className="relative w-full py-5 bg-gradient-to-r from-romantic-accent via-romantic-glow to-romantic-accent rounded-2xl text-white font-medium text-lg overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-xl hover:shadow-romantic-glow/30 flex items-center justify-center gap-2"
          style={{
            backgroundSize: '200% 200%',
            animation: isSending ? 'gradient-shift 4s ease infinite' : 'none',
          }}
        >
          {/* Loading State */}
          {isSending ? (
            <div className="flex items-center gap-2">
              <span className="text-2xl animate-spin">✨</span>
              <span className="text-sm sm:text-base opacity-90">Đang gửi...</span>
            </div>
          ) : (
            // Normal label
            <div className="flex items-center gap-2">
              <span className="text-2xl">✨</span>
              <span>Gửi {"Nhớ"}</span>
            </div>
          )}
        </button>
      </div>

    </div>
    </>
  );
}

