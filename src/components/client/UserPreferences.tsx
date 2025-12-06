'use client';

import { useState, useEffect } from 'react';
// No longer need direct Supabase client - using API route instead
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/Toast';

interface UserPreferencesProps {
  userId: string;
}

const HOROSCOPE_OPTIONS = [
  'Bạch Dương (Aries)',
  'Kim Ngưu (Taurus)',
  'Song Tử (Gemini)',
  'Cự Giải (Cancer)',
  'Sư Tử (Leo)',
  'Xử Nữ (Virgo)',
  'Thiên Bình (Libra)',
  'Thần Nông (Scorpio)',
  'Nhân Mã (Sagittarius)',
  'Ma Kết (Capricorn)',
  'Bảo Bình (Aquarius)',
  'Song Ngư (Pisces)',
];

export function UserPreferences({ userId }: UserPreferencesProps) {
  const [city, setCity] = useState('');
  const [horoscope, setHoroscope] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    loadPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function loadPreferences() {
    try {
      setLoading(true);
      // Use API route instead of direct Supabase client to bypass RLS
      const response = await fetch(`/api/user/preferences?userId=${userId}`);
      const result = await response.json();

      if (result.success && result.preferences) {
        setCity(result.preferences.city || '');
        setHoroscope(result.preferences.horoscope || '');
      }
    } catch (error) {
      console.error('Load preferences error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (saving) return;

    // Validation: Cả hai trường đều bắt buộc
    const trimmedCity = city.trim();
    if (!trimmedCity || !horoscope) {
      if (!trimmedCity && !horoscope) {
        showToast('Vui lòng điền Thành phố và chọn Cung hoàng đạo!', 'error');
      } else if (!trimmedCity) {
        showToast('Vui lòng điền Thành phố!', 'error');
      } else {
        showToast('Vui lòng chọn Cung hoàng đạo!', 'error');
      }
      return;
    }

    setSaving(true);

    try {
      // Use API route to save (bypasses RLS)
      const response = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          city: trimmedCity,
          horoscope: horoscope,
        }),
      });

      const result = await response.json();

      if (result.success) {
        showToast('Đã lưu tùy chọn thành công! ✨', 'success');
        setIsExpanded(false);
      } else {
        throw new Error(result.error || 'Failed to save');
      }
    } catch (error: any) {
      console.error('Save preferences error:', error);
      showToast('Có lỗi xảy ra khi lưu: ' + (error.message || 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <button
        onClick={() => setIsExpanded(true)}
        className="w-9 h-9 bg-romantic-soft/40 backdrop-blur-sm rounded-full flex items-center justify-center border border-romantic-glow/30 hover:bg-romantic-soft/60 transition-colors"
        title="Tùy chọn cá nhân"
      >
        <span className="text-lg">⚙️</span>
      </button>

      {isExpanded && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={() => setIsExpanded(false)}
          />
          
          {/* Centered Modal */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <div 
              className="bg-romantic-dark/95 backdrop-blur-md rounded-2xl p-5 border border-romantic-glow/30 shadow-xl max-w-sm w-full max-h-[80vh] overflow-y-auto custom-scrollbar pointer-events-auto animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-base font-medium text-white">⚙️ Tùy chọn cá nhân</p>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-romantic-glow/60 hover:text-romantic-glow text-lg transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Thành phố/Tỉnh <span className="text-romantic-glow/80">*</span>
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="VD: Hà Nội, HCM..."
                    className="w-full px-3 py-2.5 bg-romantic-soft/50 border border-romantic-light/30 rounded-lg text-white text-sm placeholder-romantic-glow/40 focus:outline-none focus:border-romantic-glow/50 transition-all"
                  />
                  <p className="text-xs text-romantic-glow/60 mt-1.5">
                    Cho dự báo thời tiết
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Cung hoàng đạo <span className="text-romantic-glow/80">*</span>
                  </label>
                  <select
                    value={horoscope}
                    onChange={(e) => setHoroscope(e.target.value)}
                    className="w-full px-3 py-2.5 bg-romantic-soft/50 border border-romantic-light/30 rounded-lg text-white text-sm focus:outline-none focus:border-romantic-glow/50 transition-all"
                  >
                    <option value="">-- Chọn --</option>
                    {HOROSCOPE_OPTIONS.map((option) => (
                      <option key={option} value={option} className="bg-romantic-dark">
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving || !city.trim() || !horoscope}
                  className="w-full py-2.5 bg-gradient-to-r from-romantic-glow to-romantic-accent rounded-lg text-white text-sm font-medium hover:shadow-lg hover:shadow-romantic-glow/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
                
                {/* Validation hint */}
                {(!city.trim() || !horoscope) && (
                  <p className="text-xs text-romantic-glow/60 text-center mt-1">
                    {!city.trim() && !horoscope 
                      ? 'Vui lòng điền Thành phố và chọn Cung hoàng đạo để lưu'
                      : !city.trim() 
                      ? 'Vui lòng điền Thành phố'
                      : 'Vui lòng chọn Cung hoàng đạo'
                    }
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
