'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

// Force dynamic rendering - this page uses client-side routing
export const dynamic = 'force-dynamic';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Memoize redirect path to avoid unnecessary recalculations
  const redirectPath = useMemo(() => {
    if (loading || !user) return null;
    return user.role === 'admin' ? '/admin' : '/client';
  }, [user, loading]);

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push(redirectPath || '/client');
      } else {
        router.push('/welcome');
      }
    }
  }, [user, loading, router, redirectPath]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-romantic-dark via-romantic-soft to-romantic-light" style={{ backgroundColor: '#0a0e1a' }}>
      <div className="animate-pulse-soft">
        <div className="text-4xl">✨</div>
      </div>
    </div>
  );
}


