'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ClientMainScreen } from '@/components/client/ClientMainScreen';

// Force dynamic rendering - this page uses client-side auth
export const dynamic = 'force-dynamic';

export default function ClientPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== 'client')) {
      router.push('/welcome');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-romantic-dark via-romantic-soft to-romantic-light">
        <div className="animate-pulse-soft text-4xl">✨</div>
      </div>
    );
  }

  if (!user || user.role !== 'client') {
    return null;
  }

  return <ClientMainScreen userId={user.id} />;
}


