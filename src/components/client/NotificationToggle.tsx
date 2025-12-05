'use client';

import { useCallback, memo, useState } from 'react';
import { PushSubscriptionService } from '@/services/push-subscription.service';

interface NotificationToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  userId?: string | null;
}

export const NotificationToggle = memo(function NotificationToggle({ enabled, onChange, userId }: NotificationToggleProps) {
  const pushService = new PushSubscriptionService();
  const [isLoading, setIsLoading] = useState(false);

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
        alert('Trình duyệt của bạn không hỗ trợ push notifications');
        return;
      }
      console.log('✅ Push notifications supported');

      if (!userId) {
        console.error('❌ No userId');
        setIsLoading(false);
        alert('Vui lòng đăng nhập để bật thông báo');
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
          alert('✅ Đã bật thông báo thành công!');
        } else {
          console.error('❌ Subscription returned null - checking why...');
          console.error('  - Check console for [PushSubscription] logs above');
          console.error('  - Common causes:');
          console.error('    1. Permission denied by user');
          console.error('    2. Browser not supported');
          console.error('    3. VAPID key not configured');
          alert('Không thể đăng ký thông báo. Vui lòng:\n1. Cho phép thông báo khi browser hỏi\n2. Kiểm tra console để xem lỗi chi tiết');
        }
      } catch (error: any) {
        console.error('❌ Subscribe error:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
        if (error.message?.includes('permission')) {
          alert('Vui lòng cho phép thông báo trong cài đặt trình duyệt');
        } else {
          alert('Có lỗi xảy ra khi đăng ký thông báo: ' + (error.message || 'Unknown error'));
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
        alert('✅ Đã tắt thông báo');
      } catch (error: any) {
        console.error('❌ Unsubscribe error:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
        alert('Có lỗi khi tắt thông báo: ' + (error.message || 'Unknown error'));
      } finally {
        setIsLoading(false);
      }
    }
  }, [enabled, onChange, userId, pushService, isLoading]);

  return (
    <div className="flex items-center justify-between bg-gradient-to-r from-romantic-soft/50 to-romantic-light/30 rounded-xl p-4 border border-romantic-glow/20 backdrop-blur-sm shadow-lg">
      <div className="flex items-center space-x-3 mr-4">
        <span className="text-2xl">
          🔔
        </span>
        <div>
          <p className="text-white text-sm font-medium">Thông báo</p>
          <p className="text-romantic-glow/60 text-xs">
            {isLoading ? 'Đang xử lý...' : (enabled ? 'Đang bật' : 'Đang tắt')}
          </p>
        </div>
      </div>

      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={`relative w-14 h-7 rounded-full transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${enabled ? 'bg-gradient-to-r from-romantic-glow to-romantic-accent' : 'bg-romantic-light/50'
          }`}
      >
        {isLoading ? (
          <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <span
            className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${enabled ? 'left-[calc(100%-1.5rem)]' : 'left-0.5'
              }`}
          />
        )}
      </button>
    </div>
  );
});


