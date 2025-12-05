'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

// Force dynamic rendering - this page uses client-side routing
export const dynamic = 'force-dynamic';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/welcome');
      return;
    }

    const redirectPath = user.role === 'admin' ? '/admin' : '/client';
    router.replace(redirectPath);
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-romantic-dark via-romantic-soft to-romantic-light" style={{ backgroundColor: '#0a0e1a' }}>
        <div className="animate-pulse-soft">
          <div className="text-4xl">✨</div>
        </div>
      </div>
    );
  }

  return null;
}


