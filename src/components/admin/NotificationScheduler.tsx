'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NotificationSchedule } from '@/types';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/Toast';

export function NotificationScheduler() {
  const [schedules, setSchedules] = useState<NotificationSchedule[]>([]);
  const [time, setTime] = useState('08:00');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    loadSchedules();
  }, []);

  async function loadSchedules() {
    try {
      const { data, error } = await supabase
        .from('notification_schedules')
        .select('*')
        .order('time', { ascending: true });

      if (error) {
        console.error('Error loading schedules:', error);
        showToast('Lỗi khi tải lịch: ' + error.message, 'error');
        return;
      }

      // Map snake_case to camelCase
      const mappedData = (data || []).map((item: any) => ({
        id: item.id,
        time: item.time,
        isActive: item.is_active,
        createdAt: item.created_at,
      }));

      console.log(`Loaded ${mappedData.length} notification schedules`);
      setSchedules(mappedData);
    } catch (error: any) {
      console.error('Load schedules error:', error);
      showToast('Có lỗi xảy ra khi tải lịch: ' + (error.message || 'Unknown error'), 'error');
    }
  }

  async function addSchedule() {
    // Check if time already exists
    const existingSchedule = schedules.find(s => s.time === time);
    if (existingSchedule) {
      showToast('Giờ này đã được đặt rồi. Vui lòng chọn giờ khác.', 'error');
      return;
    }

    if (!time || time.length === 0) {
      showToast('Vui lòng chọn giờ.', 'error');
      return;
    }

    setLoading(true);
    try {
      console.log('Adding notification schedule:', time);
      const { data, error } = await supabase
        .from('notification_schedules')
        .insert({
          time,
          is_active: true,
        })
        .select();

      if (error) {
        console.error('Add schedule error:', error);
        throw error;
      }

      console.log('Schedule added successfully:', data);
      await loadSchedules();
      setTime('08:00');
      showToast('✅ Đã thêm lịch thông báo thành công!', 'success');
    } catch (error: any) {
      console.error('Add schedule error:', error);
      showToast('Có lỗi xảy ra khi thêm lịch: ' + (error.message || 'Unknown error'), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function toggleSchedule(id: string, isActive: boolean) {
    await supabase
      .from('notification_schedules')
      .update({ is_active: !isActive })
      .eq('id', id);

    await loadSchedules();
  }

  async function deleteSchedule(id: string) {
    await supabase
      .from('notification_schedules')
      .delete()
      .eq('id', id);

    await loadSchedules();
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="bg-romantic-soft/40 rounded-2xl p-6 border border-romantic-light/30">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-light text-white">Lịch thông báo hằng ngày</h2>
      </div>
      
      {/* Info box about cron-job.org */}
      <div className="mb-6 p-4 bg-romantic-glow/10 border border-romantic-glow/20 rounded-lg">
        <div className="flex items-start space-x-2">
          <span className="text-lg">ℹ️</span>
          <div className="flex-1">
            <p className="text-sm text-white font-medium mb-1">Cấu hình Cron Job</p>
            <p className="text-xs text-romantic-glow/70 leading-relaxed">
              Hệ thống sử dụng cron-job.org để tự động gửi thông báo. 
              Xem hướng dẫn chi tiết trong file <code className="text-romantic-glow/90">CRON_SETUP_GUIDE.md</code>
            </p>
            <p className="text-xs text-romantic-glow/60 mt-2">
              ⏰ Cron chạy mỗi 5 phút để kiểm tra và gửi thông báo đúng giờ
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex space-x-3">
          <div className="flex-1 relative">
            <input
              type="time"
              value={time}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTime(e.target.value)}
              className="w-full px-4 py-2.5 bg-romantic-soft/60 border-2 border-romantic-glow/40 rounded-lg text-white text-base font-medium focus:outline-none focus:border-romantic-glow focus:ring-2 focus:ring-romantic-glow/30 transition-all shadow-lg shadow-romantic-glow/10 hover:border-romantic-glow/60"
              style={{
                colorScheme: 'dark',
              }}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={addSchedule}
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-romantic-glow to-romantic-accent rounded-lg text-white font-medium hover:shadow-lg hover:shadow-romantic-glow/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Đang thêm...' : 'Thêm'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {schedules.length === 0 ? (
          <p className="text-romantic-glow/60 text-sm text-center py-8">
            Chưa có lịch nào được đặt
          </p>
        ) : (
          schedules.map((schedule: NotificationSchedule) => (
            <div
              key={schedule.id}
              className="flex items-center justify-between bg-romantic-soft/30 rounded-lg p-4 border border-romantic-light/20"
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">⏰</span>
                <div>
                  <p className="text-white font-medium">{schedule.time}</p>
                  <p className="text-romantic-glow/60 text-xs">
                    {schedule.isActive ? 'Đang hoạt động' : 'Đã tắt'}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => toggleSchedule(schedule.id, schedule.isActive)}
                  className={`px-4 py-1 rounded text-xs ${schedule.isActive
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-500/20 text-gray-400'
                    }`}
                >
                  {schedule.isActive ? 'Tắt' : 'Bật'}
                </button>
                <button
                  onClick={() => deleteSchedule(schedule.id)}
                  className="px-4 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30"
                >
                  Xóa
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
    </>
  );
}

