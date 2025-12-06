'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

// Force dynamic rendering - this page uses client-side auth
export const dynamic = 'force-dynamic';

function WelcomePageContent() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.replace(user.role === 'admin' ? '/admin' : '/client');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Try both admin and client login in parallel
      const [adminResult, clientResult] = await Promise.all([
        login(token, 'admin'),
        login(token, 'client'),
      ]);

      const result = adminResult.success ? adminResult : clientResult;

      if (result.success) {
        const role = result.actualRole || (result.userId ? 'client' : 'admin');
        router.replace(role === 'admin' ? '/admin' : '/client');
      } else {
        setError(result.error || 'Token không hợp lệ');
        setLoading(false);
      }
    } catch (error: any) {
      setError(error.message || 'Đăng nhập thất bại');
      setLoading(false);
    }
  };

  // Don't render if already logged in (will redirect)
  if (authLoading || user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-romantic-dark via-romantic-soft to-romantic-light" style={{ backgroundColor: '#0a0e1a' }}>
        <div className="text-5xl animate-spin">⏳</div>
      </div>
    );
  }

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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-romantic-accent to-romantic-glow rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed glow-button"
          >
            {loading ? 'Đang xử lý...' : 'Tiếp tục'}
          </button>
        </form>

        {/* Privacy Transparency Information */}
        <div className="mt-8 p-4 bg-romantic-soft/30 rounded-lg border border-romantic-light/20">
          <div className="flex items-start gap-3">
            <span className="text-xl">🔒</span>
            <div className="flex-1 space-y-2">
              <p className="text-white text-sm font-medium">Quyền riêng tư & Bảo mật</p>
              <div className="space-y-1 text-xs text-romantic-glow/70">
                <p className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Ứng dụng KHÔNG theo dõi vị trí (Location) của bạn</span>
                </p>
                <p className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Dữ liệu được mã hóa và bảo mật</span>
                </p>
                <p className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Bạn có thể đăng nhập lại dễ dàng khi đổi thiết bị</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return <WelcomePageContent />;
}

