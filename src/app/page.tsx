'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { generateFingerprint } from '@/lib/utils/device';

// Force dynamic rendering - this page uses client-side routing
export const dynamic = 'force-dynamic';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [checkingDevice, setCheckingDevice] = useState(true);

  // Check device status and redirect accordingly
  useEffect(() => {
    async function checkDeviceAndRedirect() {
      if (loading) return;

      // If no user, go to welcome
      if (!user) {
        router.push('/welcome');
        return;
      }

      // Check device status
      try {
        const fingerprint = generateFingerprint();
        // Get token from localStorage (if exists)
        const storedToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        
        // If we have a token, check device status
        if (storedToken) {
          const response = await fetch('/api/devices/check-status', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token: storedToken, fingerprint }),
          });

          const result = await response.json();
          
          if (result.success) {
            // If first time on this device, go to welcome
            if (result.isFirstTime === true) {
              router.push('/welcome');
              return;
            }
          }
        }

        // Otherwise, go to main page
        const redirectPath = user.role === 'admin' ? '/admin' : '/client';
        router.push(redirectPath);
      } catch (error) {
        console.error('Check device error:', error);
        // On error, go to welcome to be safe
        router.push('/welcome');
      } finally {
        setCheckingDevice(false);
      }
    }

    checkDeviceAndRedirect();
  }, [user, loading, router]);

  if (loading || checkingDevice) {
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


