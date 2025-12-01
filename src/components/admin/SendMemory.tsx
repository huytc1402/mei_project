'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export function SendMemory() {
  const [isSending, setIsSending] = useState(false);
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [clientMemoryCount, setClientMemoryCount] = useState(0);
  const COOLDOWN_SECONDS = 3;
  const supabase = createClient();

  useEffect(() => {
    loadClientMemoryCount();
  }, []);

  useEffect(() => {
    if (isSending && cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            setIsSending(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isSending, cooldown]);

  async function loadClientMemoryCount() {
    try {
      const { data: clientUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'client')
        .limit(1);

      if (clientUsers && clientUsers.length > 0) {
        const clientId = (clientUsers[0] as any).id;
        const { count } = await supabase
          .from('memories')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', clientId)
          .eq('sender_role', 'client');
        
        setClientMemoryCount(count || 0);
      }
    } catch (error) {
      console.error('Load memory count error:', error);
    }
  }

  async function handleSendMemory() {
    if (isSending) return;

    setIsSending(true);
    setCooldown(COOLDOWN_SECONDS);
    
    try {
      const response = await fetch('/api/admin/send-memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        setLastSent(new Date());
        // Re-enable after cooldown
        setTimeout(() => {
          setIsSending(false);
          setCooldown(0);
        }, COOLDOWN_SECONDS * 1000);
      } else {
        setIsSending(false);
        setCooldown(0);
        alert('Gửi thất bại: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Send memory error:', error);
      setIsSending(false);
      setCooldown(0);
      alert('Có lỗi xảy ra khi gửi');
    }
  }

  return (
    <div className="bg-gradient-to-br from-romantic-soft/50 to-romantic-light/30 rounded-2xl p-6 border border-romantic-glow/30 backdrop-blur-sm shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-light text-white">Gửi {"Nhớ"} cho cậu ấy</h2>
        {clientMemoryCount > 0 && (
          <div className="text-romantic-glow/80 text-sm">
            Cậu ấy đã nhớ: <span className="font-medium">{clientMemoryCount}</span> lần
          </div>
        )}
      </div>
      <p className="text-romantic-glow/60 text-sm mb-6">
        Nhấn nút bên dưới để gửi tín hiệu đom đóm đến client. Họ sẽ nhận được thông báo ngay lập tức.
      </p>

      <button
        onClick={handleSendMemory}
        disabled={isSending}
        className="relative w-full py-5 bg-gradient-to-r from-romantic-accent via-romantic-glow to-romantic-accent rounded-2xl text-white font-medium text-lg overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-xl hover:shadow-romantic-glow/30"
        style={{
          backgroundSize: '200% 200%',
          animation: isSending ? 'none' : 'gradient-shift 4s ease infinite',
        }}
      >
        {/* Sending animation / Cooldown */}
        {isSending && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl">
            {cooldown > 0 ? (
              <div className="text-center">
                <div className="text-2xl mb-1 animate-spin">
                  ✨
                </div>
                <p className="text-xs">Đợi {cooldown}s...</p>
              </div>
            ) : (
              <div className="text-2xl animate-spin">
                ✨
              </div>
            )}
          </div>
        )}

        <span className="relative z-10 flex items-center justify-center space-x-2">
          {!isSending ? (
            <>
              <span className="text-2xl">
                ✨
              </span>
              <span>Gửi {"Nhớ"}</span>
            </>
          ) : (
            <span>Đang gửi...</span>
          )}
        </span>
      </button>

      {lastSent && (
        <div className="mt-4 text-center animate-fade-in">
          <p className="text-green-400/80 text-sm flex items-center justify-center space-x-2">
            <span>✓</span>
            <span>Đã gửi lúc {lastSent.toLocaleTimeString('vi-VN')}</span>
          </p>
        </div>
      )}
    </div>
  );
}

