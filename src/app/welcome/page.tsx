'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

// Force dynamic rendering - this page uses client-side auth
export const dynamic = 'force-dynamic';

function WelcomePageContent() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

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
        router.push(role === 'admin' ? '/admin' : '/client');
      } else {
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-romantic-accent to-romantic-glow rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed glow-button"
          >
            {loading ? 'Đang xử lý...' : 'Tiếp tục'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return <WelcomePageContent />;
}

