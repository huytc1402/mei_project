'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

interface GardenState {
  level: number; // Tree growth level (0-10)
  lastWatered: Date | null;
  totalMemories: number;
  streak: number; // Consecutive days with memories
  health: number; // 0-100, decreases over time without memories
}

export default function SecretGardenPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [gardenState, setGardenState] = useState<GardenState>({
    level: 0,
    lastWatered: null,
    totalMemories: 0,
    streak: 0,
    health: 100,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/welcome');
    }
  }, [user, loading, router]);

  // Load garden state
  const loadGardenState = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      // Get the other user (admin if current is client, client if current is admin)
      const otherRole = user.role === 'admin' ? 'client' : 'admin';
      const { data: otherUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role', otherRole)
        .limit(1);

      if (!otherUsers || otherUsers.length === 0) {
        setIsLoading(false);
        return;
      }

      const otherUserId = (otherUsers[0] as any).id;
      
      // Get all memories between current user and the other user
      // Memories where either user_id matches current user OR sender is the other user
      const { data: memories, error } = await supabase
        .from('memories')
        .select('id, user_id, sender_role, created_at')
        .or(`user_id.eq.${user.id},user_id.eq.${otherUserId}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading garden state:', error);
        return;
      }

      if (!memories || memories.length === 0) {
        setGardenState({
          level: 0,
          lastWatered: null,
          totalMemories: 0,
          streak: 0,
          health: 100,
        });
        setIsLoading(false);
        return;
      }

      // Calculate garden state
      const totalMemories = memories.length;
      const level = Math.min(Math.floor(totalMemories / 5), 10); // 5 memories per level, max level 10
      
      // Calculate streak (consecutive days with at least one memory)
      let streak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const memoryDates = new Set(
        memories.map((m: any) => {
          const date = new Date(m.created_at);
          date.setHours(0, 0, 0, 0);
          return date.getTime();
        })
      );

      let checkDate = new Date(today);
      while (memoryDates.has(checkDate.getTime())) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }

      // Calculate health (decreases 5% per day without memory, min 0)
      const lastMemory = memories[0];
      const lastMemoryDate = new Date(lastMemory.created_at);
      const daysSinceLastMemory = Math.floor(
        (today.getTime() - lastMemoryDate.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)
      );
      const health = Math.max(100 - (daysSinceLastMemory * 5), 0);

      setGardenState({
        level,
        lastWatered: lastMemory ? new Date(lastMemory.created_at) : null,
        totalMemories,
        streak,
        health,
      });
    } catch (error) {
      console.error('Error loading garden state:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (user) {
      loadGardenState();
    }
  }, [user, loadGardenState]);

  // Auto-hide welcome message
  useEffect(() => {
    if (showWelcome) {
      const timer = setTimeout(() => setShowWelcome(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showWelcome]);

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-900 via-emerald-800 to-teal-900">
        <div className="text-5xl animate-spin">🌱</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const treeEmojis = ['🌱', '🌿', '🌳', '🌲', '🌴', '🌳', '🌲', '🌴', '🌳', '🌲', '🌳'];
  const treeEmoji = treeEmojis[Math.min(gardenState.level, treeEmojis.length - 1)];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-800 to-teal-900 p-4">
      {/* Welcome Message */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 backdrop-blur-md rounded-xl px-6 py-4 border border-emerald-400/30 shadow-2xl"
          >
            <p className="text-white text-lg font-medium text-center">
              🌸 Khu Vườn Bí Mật 🌸
            </p>
            <p className="text-emerald-200/80 text-sm text-center mt-1">
              Nơi tình yêu nở hoa
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="max-w-md mx-auto mb-6">
        <button
          onClick={() => router.push(user.role === 'admin' ? '/admin' : '/client')}
          className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors mb-4"
        >
          <span>←</span>
          <span>Quay lại</span>
        </button>

        <div className="text-center mb-6">
          <h1 className="text-3xl font-light text-white mb-2">🌸 Khu Vườn Bí Mật 🌸</h1>
          <p className="text-emerald-200/70 text-sm">
            Mỗi lần nhấn {"Nhớ"} là một giọt nước cho cây
          </p>
        </div>
      </div>

      {/* Garden Display */}
      <div className="max-w-md mx-auto space-y-6">
        {/* Tree Display */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="bg-gradient-to-br from-emerald-900/50 to-teal-900/50 rounded-2xl p-8 border border-emerald-400/30 backdrop-blur-sm shadow-2xl"
        >
          <div className="text-center">
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="text-9xl mb-4"
            >
              {treeEmoji}
            </motion.div>
            <p className="text-white text-xl font-medium mb-2">
              Cây Tình Yêu
            </p>
            <p className="text-emerald-200/80 text-sm">
              Cấp độ {gardenState.level}/10
            </p>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-emerald-800/50 to-teal-800/50 rounded-xl p-4 border border-emerald-400/20">
            <div className="text-center">
              <p className="text-3xl mb-1">💧</p>
              <p className="text-white text-2xl font-bold">{gardenState.totalMemories}</p>
              <p className="text-emerald-200/70 text-xs">Lần nhớ</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-800/50 to-teal-800/50 rounded-xl p-4 border border-emerald-400/20">
            <div className="text-center">
              <p className="text-3xl mb-1">🔥</p>
              <p className="text-white text-2xl font-bold">{gardenState.streak}</p>
              <p className="text-emerald-200/70 text-xs">Ngày liên tiếp</p>
            </div>
          </div>
        </div>

        {/* Health Bar */}
        <div className="bg-gradient-to-br from-emerald-800/50 to-teal-800/50 rounded-xl p-4 border border-emerald-400/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white text-sm font-medium">Sức khỏe</span>
            <span className="text-emerald-200/80 text-sm">{gardenState.health}%</span>
          </div>
          <div className="w-full bg-emerald-900/50 rounded-full h-3 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${gardenState.health}%` }}
              transition={{ duration: 1 }}
              className={`h-full rounded-full ${
                gardenState.health > 70
                  ? 'bg-gradient-to-r from-emerald-400 to-green-400'
                  : gardenState.health > 40
                  ? 'bg-gradient-to-r from-yellow-400 to-orange-400'
                  : 'bg-gradient-to-r from-red-400 to-rose-400'
              }`}
            />
          </div>
          {gardenState.health < 50 && (
            <p className="text-yellow-300/80 text-xs mt-2 text-center">
              ⚠️ Cây đang cần được chăm sóc!
            </p>
          )}
        </div>

        {/* Last Watered */}
        {gardenState.lastWatered && (
          <div className="bg-gradient-to-br from-emerald-800/50 to-teal-800/50 rounded-xl p-4 border border-emerald-400/20 text-center">
            <p className="text-emerald-200/80 text-sm">
              💧 Lần tưới cuối: {new Date(gardenState.lastWatered).toLocaleString('vi-VN')}
            </p>
          </div>
        )}

        {/* Empty State */}
        {gardenState.totalMemories === 0 && (
          <div className="bg-gradient-to-br from-emerald-800/50 to-teal-800/50 rounded-xl p-6 border border-emerald-400/20 text-center">
            <p className="text-4xl mb-3">🌱</p>
            <p className="text-white text-lg font-medium mb-2">Hạt giống đang chờ</p>
            <p className="text-emerald-200/70 text-sm">
              Nhấn {"Nhớ"} để bắt đầu chăm sóc khu vườn này
            </p>
          </div>
        )}

        {/* Growth Message */}
        {gardenState.level > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-xl p-4 border border-emerald-400/30 text-center"
          >
            <p className="text-white text-sm">
              {gardenState.level < 3 && '🌱 Hạt giống đang nảy mầm...'}
              {gardenState.level >= 3 && gardenState.level < 6 && '🌿 Cây đang lớn lên từng ngày...'}
              {gardenState.level >= 6 && gardenState.level < 9 && '🌳 Cây đã trưởng thành, xanh tươi...'}
              {gardenState.level >= 9 && '🌲 Cây cổ thụ của tình yêu đã nở hoa! 💕'}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
