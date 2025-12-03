'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { generateFingerprint } from '@/lib/utils/device';
import { ClientMainScreen } from '@/components/client/ClientMainScreen';

// Force dynamic rendering - this page uses client-side auth
export const dynamic = 'force-dynamic';

export default function ClientPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checkingDevice, setCheckingDevice] = useState(true);

  // Check device status before allowing access
  useEffect(() => {
    async function checkDeviceStatus() {
      if (loading) return;

      if (!user || user.role !== 'client') {
        router.push('/welcome');
        return;
      }

      try {
        const fingerprint = generateFingerprint();
        const storedToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        
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
            // If device is not approved or revoked, show message and redirect
            if (result.isApproved === false || result.needsApproval === true) {
              // Clear auth and redirect to welcome with message
              if (typeof window !== 'undefined') {
                localStorage.removeItem('token');
                localStorage.removeItem('userId');
                localStorage.removeItem('userRole');
                // Redirect with message
                router.push('/welcome?blocked=true');
              }
              return;
            }
          } else {
            // If check fails, clear auth and redirect
            if (typeof window !== 'undefined') {
              localStorage.removeItem('token');
              localStorage.removeItem('userId');
              localStorage.removeItem('userRole');
              router.push('/welcome?blocked=true');
            }
            return;
          }
        } else {
          // No token, redirect to welcome
          router.push('/welcome');
          return;
        }
      } catch (error) {
        console.error('Check device error:', error);
        router.push('/welcome');
        return;
      } finally {
        setCheckingDevice(false);
      }
    }

    checkDeviceStatus();
  }, [user, loading, router]);

  if (loading || checkingDevice) {
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


