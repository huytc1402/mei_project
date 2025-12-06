'use client';

import { useState } from 'react';

export function PrivacyNotice() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-9 h-9 bg-romantic-soft/40 backdrop-blur-sm rounded-full flex items-center justify-center border border-romantic-glow/30 hover:bg-romantic-soft/60 transition-colors"
        title="Quyền riêng tư"
      >
        <span className="text-lg">🔒</span>
      </button>

      {isOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Centered Modal */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <div 
              className="bg-romantic-dark/95 backdrop-blur-md rounded-2xl p-5 border border-romantic-glow/30 shadow-xl max-w-sm w-full pointer-events-auto animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-base font-medium text-white">🔒 Quyền riêng tư</p>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-romantic-glow/60 hover:text-romantic-glow text-lg transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-2.5 text-sm text-romantic-glow/80">
                <div className="flex items-start gap-2.5">
                  <span className="text-green-400 mt-0.5 flex-shrink-0 text-base">✓</span>
                  <span>KHÔNG theo dõi vị trí</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-green-400 mt-0.5 flex-shrink-0 text-base">✓</span>
                  <span>Dữ liệu mã hóa & bảo mật</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-green-400 mt-0.5 flex-shrink-0 text-base">✓</span>
                  <span>Đăng nhập lại dễ dàng</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-green-400 mt-0.5 flex-shrink-0 text-base">✓</span>
                  <span>Không thu thập thông tin cá nhân không cần thiết</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
