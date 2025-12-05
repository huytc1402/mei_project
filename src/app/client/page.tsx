'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ClientMainScreen } from '@/components/client/ClientMainScreen';

// Force dynamic rendering - this page uses client-side auth
export const dynamic = 'force-dynamic';

export default function ClientPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user || user.role !== 'client') {
      router.replace('/welcome');
      return;
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-romantic-dark via-romantic-soft to-romantic-light">
        <div className="text-5xl animate-spin">⏳</div>
      </div>
    );
  }

  if (!user || user.role !== 'client') {
    return null;
  }

  return <ClientMainScreen userId={user.id} />;
}


