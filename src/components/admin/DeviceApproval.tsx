'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import vi from 'date-fns/locale/vi';

interface Device {
  id: string;
  user_id: string;
  fingerprint: string;
  user_agent: string;
  ip_hash: string;
  is_active: boolean;
  created_at: string;
  last_seen: string;
}

export function DeviceApproval() {
  const [pendingDevices, setPendingDevices] = useState<Device[]>([]);
  const [activeDevices, setActiveDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  async function loadDevices() {
    setLoading(true);
    try {
      // Get all devices
      const { data: allDevices } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (allDevices) {
        // Remove duplicates based on fingerprint (keep the latest one)
        const uniqueDevices = new Map<string, Device>();
        allDevices.forEach((d: any) => {
          const existing = uniqueDevices.get(d.fingerprint);
          if (!existing || new Date(d.created_at) > new Date(existing.created_at)) {
            uniqueDevices.set(d.fingerprint, d as Device);
          }
        });

        const devicesArray = Array.from(uniqueDevices.values());
        const pending = devicesArray.filter((d) => !d.is_active);
        const active = devicesArray.filter((d) => d.is_active);
        
        setPendingDevices(pending);
        setActiveDevices(active);
      }
    } catch (error) {
      console.error('Load devices error:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    let channel: any = null;
    let debounceTimer: NodeJS.Timeout | null = null;

    function setupRealtime() {
      channel = supabase
        .channel('device-updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'devices',
          },
          () => {
            // Debounce to avoid multiple rapid calls
            if (debounceTimer) {
              clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(() => {
              if (mounted) {
                loadDevices();
              }
            }, 500);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'devices',
          },
          () => {
            // Debounce to avoid multiple rapid calls
            if (debounceTimer) {
              clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(() => {
              if (mounted) {
                loadDevices();
              }
            }, 500);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'devices',
          },
          () => {
            // Debounce to avoid multiple rapid calls
            if (debounceTimer) {
              clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(() => {
              if (mounted) {
                loadDevices();
              }
            }, 500);
          }
        )
        .subscribe();

      return () => {
        if (channel) {
          supabase.removeChannel(channel);
        }
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
      };
    }

    loadDevices();
    const cleanup = setupRealtime();

    return () => {
      mounted = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function approveDevice(deviceId: string) {
    try {
      const response = await fetch('/api/devices/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceId, action: 'approve' }),
      });

      const result = await response.json();
      if (result.success) {
        await loadDevices();
      } else {
        alert('Lỗi: ' + result.error);
      }
    } catch (error) {
      console.error('Approve device error:', error);
      alert('Có lỗi xảy ra khi xác nhận thiết bị');
    }
  }

  async function denyDevice(deviceId: string) {
    if (!confirm('Bạn có chắc muốn từ chối thiết bị này?')) {
      return;
    }

    try {
      const response = await fetch('/api/devices/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceId, action: 'deny' }),
      });

      const result = await response.json();
      if (result.success) {
        await loadDevices();
      } else {
        alert('Lỗi: ' + result.error);
      }
    } catch (error) {
      console.error('Deny device error:', error);
      alert('Có lỗi xảy ra khi từ chối thiết bị');
    }
  }

  if (loading) {
    return (
      <div className="bg-romantic-soft/40 rounded-2xl p-6 border border-romantic-light/30">
        <div className="animate-pulse-soft text-center text-romantic-glow/60">
          Đang tải...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Devices */}
      <div className="bg-romantic-soft/40 rounded-2xl p-6 border border-romantic-light/30">
        <h2 className="text-xl font-light text-white mb-4">
          ⚠️ Thiết bị chờ xác nhận ({pendingDevices.length})
        </h2>

        {pendingDevices.length === 0 ? (
          <p className="text-romantic-glow/60 text-sm text-center py-8">
            Không có thiết bị nào chờ xác nhận
          </p>
        ) : (
          <div className="space-y-3">
            {pendingDevices.map((device) => (
              <div
                key={device.id}
                className="bg-romantic-soft/30 rounded-lg p-4 border border-yellow-500/30"
              >
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between">
                    <p className="text-white text-sm font-medium">
                      Thiết bị mới
                    </p>
                    <span className="text-xs text-yellow-400">
                      {format(new Date(device.created_at), 'PPp', { locale: vi })}
                    </span>
                  </div>
                  <p className="text-romantic-glow/60 text-xs font-mono">
                    Fingerprint: {device.fingerprint.substring(0, 24)}...
                  </p>
                  <p className="text-romantic-glow/60 text-xs">
                    {device.user_agent.substring(0, 80)}...
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => approveDevice(device.id)}
                    className="flex-1 py-2 px-4 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/30 transition-colors"
                  >
                    ✅ Xác nhận
                  </button>
                  <button
                    onClick={() => denyDevice(device.id)}
                    className="flex-1 py-2 px-4 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-colors"
                  >
                    ❌ Từ chối
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Devices */}
      <div className="bg-romantic-soft/40 rounded-2xl p-6 border border-romantic-light/30">
        <h2 className="text-xl font-light text-white mb-4">
          ✅ Thiết bị đã xác nhận ({activeDevices.length})
        </h2>

        {activeDevices.length === 0 ? (
          <p className="text-romantic-glow/60 text-sm text-center py-8">
            Chưa có thiết bị nào được xác nhận
          </p>
        ) : (
          <div className="space-y-2">
            {activeDevices.map((device) => (
              <div
                key={device.id}
                className="bg-romantic-soft/30 rounded-lg p-3 border border-romantic-light/20"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-white text-sm font-mono">
                      {device.fingerprint.substring(0, 24)}...
                    </p>
                    <p className="text-romantic-glow/60 text-xs mt-1">
                      {device.user_agent.substring(0, 60)}...
                    </p>
                    <p className="text-romantic-glow/40 text-xs mt-1">
                      Lần cuối: {format(new Date(device.last_seen), 'PPp', { locale: vi })}
                    </p>
                  </div>
                  <span className="text-green-400 text-xs">✓ Đã xác nhận</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

