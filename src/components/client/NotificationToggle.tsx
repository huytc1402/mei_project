'use client';

import { useCallback, memo } from 'react';

interface NotificationToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export const NotificationToggle = memo(function NotificationToggle({ enabled, onChange }: NotificationToggleProps) {
  const handleToggle = useCallback(async () => {
    if (!enabled) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        onChange(true);
        // Register service worker for push notifications
        if ('serviceWorker' in navigator) {
          try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered:', registration);
          } catch (error) {
            console.error('Service Worker registration failed:', error);
          }
        }
      }
    } else {
      onChange(false);
    }
  }, [enabled, onChange]);

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
        className={`relative w-14 h-7 rounded-full transition-colors  ${
          enabled ? 'bg-gradient-to-r from-romantic-glow to-romantic-accent' : 'bg-romantic-light/50'
        }`}
      >
        <span
          className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
            enabled ? 'left-[calc(100%-1.5rem)]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
});


