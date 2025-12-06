'use client';

import { useCallback, memo, useState } from 'react';
import { PushSubscriptionService } from '@/services/push-subscription.service';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/Toast';

interface NotificationToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  userId?: string | null;
}

export const NotificationToggle = memo(function NotificationToggle({ enabled, onChange, userId }: NotificationToggleProps) {
  const pushService = new PushSubscriptionService();
  const [isLoading, setIsLoading] = useState(false);
  const { toasts, showToast, removeToast } = useToast();

  const handleToggle = useCallback(async () => {
    if (isLoading) return; // Prevent double click
    
    console.log('🔔 NotificationToggle clicked, enabled:', enabled, 'userId:', userId);
    
    if (!enabled) {
      // Enable notifications - Subscribe
      console.log('📝 Starting subscription process...');
      setIsLoading(true);
      
      // Check if push notifications are supported
      if (!pushService.isSupported()) {
        console.error('❌ Push notifications not supported');
        setIsLoading(false);
        showToast('Trình duyệt của bạn không hỗ trợ push notifications', 'error');
        return;
      }
      console.log('✅ Push notifications supported');

      if (!userId) {
        console.error('❌ No userId');
        setIsLoading(false);
        showToast('Vui lòng đăng nhập để bật thông báo', 'error');
        return;
      }

      try {
        // Subscribe to push notifications
        console.log('🔄 Calling pushService.subscribe()...');
        const subscription = await pushService.subscribe(userId);
        console.log('📦 Subscribe result:', subscription);
        
        if (subscription) {
          onChange(true);
          console.log('✅ Push notification subscribed successfully:', subscription);
          showToast('✅ Đã bật thông báo thành công!', 'success');
        } else {
          console.error('❌ Subscription returned null - checking why...');
          console.error('  - Check console for [PushSubscription] logs above');
          console.error('  - Common causes:');
          console.error('    1. Permission denied by user');
          console.error('    2. Browser not supported');
          console.error('    3. VAPID key not configured');
          showToast('Không thể đăng ký thông báo. Vui lòng cho phép thông báo khi browser hỏi', 'error');
        }
      } catch (error: any) {
        console.error('❌ Subscribe error:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
        if (error.message?.includes('permission')) {
          showToast('Vui lòng cho phép thông báo trong cài đặt trình duyệt', 'error');
        } else {
          showToast('Có lỗi xảy ra khi đăng ký thông báo: ' + (error.message || 'Unknown error'), 'error');
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      // Disable notifications - Unsubscribe
      console.log('📝 Starting unsubscribe process...');
      setIsLoading(true);
      
      if (!userId) {
        console.error('❌ No userId for unsubscribe');
        setIsLoading(false);
        return;
      }

      try {
        console.log('🔍 Checking current subscription...');
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
          console.log('📤 Unsubscribing from push service...');
          await subscription.unsubscribe();
          console.log('✅ Unsubscribed from push service');
          
          // Notify server
          console.log('📤 Notifying server of unsubscribe...');
          const unsubscribeResponse = await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              endpoint: subscription.endpoint,
            }),
          });
          
          console.log('📥 Unsubscribe server response:', unsubscribeResponse.status);
          if (!unsubscribeResponse.ok) {
            console.error('❌ Server unsubscribe failed');
          }
        } else {
          console.log('⚠️ No subscription found to unsubscribe');
        }
        
        onChange(false);
        console.log('✅ Push notification unsubscribed successfully');
        showToast('✅ Đã tắt thông báo', 'success');
      } catch (error: any) {
        console.error('❌ Unsubscribe error:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
        showToast('Có lỗi khi tắt thông báo: ' + (error.message || 'Unknown error'), 'error');
      } finally {
        setIsLoading(false);
      }
    }
  }, [enabled, onChange, userId, pushService, isLoading]);

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="relative flex items-center gap-2">
        {/* Icon Button */}
        <button
          onClick={handleToggle}
          disabled={isLoading}
          className="w-9 h-9 bg-romantic-soft/40 backdrop-blur-sm rounded-full flex items-center justify-center border border-romantic-glow/30 hover:bg-romantic-soft/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={enabled ? 'Thông báo: Đang bật' : 'Thông báo: Đang tắt'}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-romantic-glow/60 border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="text-lg">{enabled ? '🔔' : '🔕'}</span>
          )}
        </button>
      </div>
    </>
  );
});


