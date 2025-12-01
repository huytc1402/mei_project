'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { generateFingerprint } from '@/lib/utils/device';

// Force dynamic rendering - this page uses client-side auth
export const dynamic = 'force-dynamic';

export default function WelcomePage() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [waitingForApproval, setWaitingForApproval] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  // Check device status when token changes
  useEffect(() => {
    if (!token || token.length < 5) {
      setWaitingForApproval(false);
      return;
    }

    const checkDeviceStatus = async () => {
      try {
        const fingerprint = generateFingerprint();
        const response = await fetch('/api/devices/check-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token, fingerprint }),
        });

        const result = await response.json();
        if (result.success) {
          setWaitingForApproval(result.needsApproval === true);
        }
      } catch (error) {
        console.error('Check device status error:', error);
      }
    };

    // Debounce check
    const timeoutId = setTimeout(() => {
      setCheckingStatus(true);
      checkDeviceStatus().finally(() => setCheckingStatus(false));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [token]);

  // Poll for device approval when waiting
  useEffect(() => {
    if (!waitingForApproval || !token) return;

    const attemptLogin = async () => {
      try {
        const [adminResult, clientResult] = await Promise.all([
          login(token, 'admin'),
          login(token, 'client'),
        ]);

        const result = adminResult.success ? adminResult : clientResult;

        if (result.success) {
          setWaitingForApproval(false);
          const role = result.actualRole || (result.userId ? 'client' : 'admin');
          router.push(role === 'admin' ? '/admin' : '/client');
        }
      } catch (error) {
        console.error('Auto login error:', error);
      }
    };

    const pollInterval = setInterval(async () => {
      try {
        const fingerprint = generateFingerprint();
        const response = await fetch('/api/devices/check-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token, fingerprint }),
        });

        const result = await response.json();
        if (result.success && result.isApproved) {
          setWaitingForApproval(false);
          // Try to login automatically
          await attemptLogin();
        }
      } catch (error) {
        console.error('Poll device status error:', error);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [waitingForApproval, token, login, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setWaitingForApproval(false);

    try {
      // Optimize: Try both in parallel
      const [adminResult, clientResult] = await Promise.all([
        login(token, 'admin'),
        login(token, 'client'),
      ]);

      const result = adminResult.success ? adminResult : clientResult;

      if (result.success) {
        const role = result.actualRole || (result.userId ? 'client' : 'admin');
        // Navigate immediately without waiting
        router.push(role === 'admin' ? '/admin' : '/client');
      } else {
        // Check if it's a device approval error
        if (result.error?.includes('chờ xác nhận')) {
          setWaitingForApproval(true);
        }
        setError(result.error || 'Token không hợp lệ');
        setLoading(false);
      }
    } catch (error: any) {
      setError(error.message || 'Đăng nhập thất bại');
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-romantic-dark via-romantic-soft to-romantic-light p-4" style={{ backgroundColor: '#0a0e1a' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-float">
          <div className="text-6xl mb-4">✨</div>
          <h1 className="text-3xl font-light text-white mb-2">Chào mừng</h1>
          <p className="text-romantic-glow/70 text-sm">
            Nhập token để tiếp tục
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={token}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToken(e.target.value)}
              placeholder="Nhập token của bạn"
              className="w-full px-4 py-3 bg-romantic-soft/50 border border-romantic-light/30 rounded-lg text-white placeholder-romantic-glow/40 focus:outline-none focus:border-romantic-glow/50 focus:ring-2 focus:ring-romantic-glow/20 transition-all"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center animate-pulse-soft">
              {error}
            </div>
          )}

          {waitingForApproval && (
            <div className="bg-romantic-soft/40 border border-romantic-glow/30 rounded-lg p-4 text-center animate-fade-in">
              <div className="text-3xl mb-2 animate-pulse">⏳</div>
              <p className="text-romantic-glow/80 text-sm font-medium mb-1">
                Đang chờ admin duyệt thiết bị
              </p>
              <p className="text-romantic-glow/60 text-xs">
                Vui lòng đợi trong giây lát...
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || waitingForApproval || checkingStatus}
            className="w-full py-3 bg-gradient-to-r from-romantic-accent to-romantic-glow rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed glow-button"
          >
            {loading ? 'Đang xử lý...' : waitingForApproval ? 'Đang chờ duyệt...' : checkingStatus ? 'Đang kiểm tra...' : 'Tiếp tục'}
          </button>
        </form>
      </div>
    </div>
  );
}

