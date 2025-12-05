'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationPopupProps {
  show: boolean;
  message: string;
  type?: 'memory' | 'reaction' | 'message';
  onClose: () => void;
}

export function NotificationPopup({ show, message, type = 'memory', onClose }: NotificationPopupProps) {
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    setIsVisible(show);
    if (show) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose(), 300); // Wait for animation
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  const icons = {
    memory: '✨',
    reaction: '❤️',
    message: '💬',
  };

  if (!show && !isVisible) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed inset-0 flex items-center justify-center z-[70] p-4 pointer-events-none"
          >
            <div className="bg-gradient-to-br from-romantic-dark/95 via-romantic-soft/90 to-romantic-dark/95 backdrop-blur-md rounded-2xl px-6 py-5 border border-romantic-glow/30 shadow-2xl text-center w-full max-w-[320px] pointer-events-auto">
              <div className="text-4xl mb-3">
                {icons[type]}
              </div>
              <p className="text-white text-base font-medium mb-1">
                {message}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
