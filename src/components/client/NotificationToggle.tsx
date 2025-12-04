'use client';

import { useCallback, memo } from 'react';
import { PushSubscriptionService } from '@/services/push-subscription.service';

interface NotificationToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  userId?: string | null;
}

export const NotificationToggle = memo(function NotificationToggle({ enabled, onChange, userId }: NotificationToggleProps) {
  const pushService = new PushSubscriptionService();

  const handleToggle = useCallback(async () => {
    if (!enabled) {
      // Check if push notifications are supported
      if (!pushService.isSupported()) {
        alert('Trình duyệt của bạn không hỗ trợ push notifications');
        return;
      }

      if (!userId) {
        alert('Vui lòng đăng nhập để bật thông báo');
        return;
      }

      try {
        // Subscribe to push notifications
        const subscription = await pushService.subscribe(userId);
        if (subscription) {
          onChange(true);
          console.log('✅ Push notification subscribed successfully');
        } else {
          alert('Không thể đăng ký thông báo. Vui lòng thử lại.');
        }
      } catch (error: any) {
        console.error('Subscribe error:', error);
        if (error.message?.includes('permission')) {
          alert('Vui lòng cho phép thông báo trong cài đặt trình duyệt');
        } else {
          alert('Có lỗi xảy ra khi đăng ký thông báo: ' + (error.message || 'Unknown error'));
        }
      }
    } else {
      // Unsubscribe
      if (userId) {
        try {
          await pushService.unsubscribe(userId);
          onChange(false);
          console.log('✅ Push notification unsubscribed');
        } catch (error) {
          console.error('Unsubscribe error:', error);
        }
      }
    }
  }, [enabled, onChange, userId, pushService]);

  return (
    <div className="flex items-center justify-between bg-gradient-to-r from-romantic-soft/50 to-romantic-light/30 rounded-xl p-4 border border-romantic-glow/20 backdrop-blur-sm shadow-lg">
      <div className="flex items-center space-x-3 mr-4">
        <span className="text-2xl">
          🔔
        </span>
        <div>
          <p className="text-white text-sm font-medium">Thông báo</p>
          <p className="text-romantic-glow/60 text-xs">
            {enabled ? 'Đang bật' : 'Đang tắt'}
          </p>
        </div>
      </div>

      <button
        onClick={handleToggle}
        className={`relative w-14 h-7 rounded-full transition-colors  ${enabled ? 'bg-gradient-to-r from-romantic-glow to-romantic-accent' : 'bg-romantic-light/50'
          }`}
      >
        <span
          className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${enabled ? 'left-[calc(100%-1.5rem)]' : 'left-0.5'
            }`}
        />
      </button>
    </div>
  );
});


