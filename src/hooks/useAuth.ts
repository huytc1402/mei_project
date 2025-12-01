'use client';

import { useState, useEffect } from 'react';
import { AuthService } from '@/services/auth.service';
import { User, UserRole } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<{ id: string; role: UserRole } | null>(null);
  const [loading, setLoading] = useState(true);
  const authService = new AuthService();

  useEffect(() => {
    // Optimize: Check auth immediately from localStorage (synchronous)
    const userId = typeof window !== 'undefined' ? localStorage.getItem('user_id') : null;
    const role = typeof window !== 'undefined' ? localStorage.getItem('user_role') : null;
    
    if (userId && role) {
      setUser({ id: userId, role: role as UserRole });
      setLoading(false);
    } else {
      checkAuth();
    }
  }, []);

  async function checkAuth() {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(token: string, role: UserRole) {
    const result = await authService.loginWithToken(token, role);
    if (result.success && result.userId) {
      setUser({ id: result.userId, role: result.actualRole || role });
    }
    return result;
  }

  async function logout() {
    await authService.logout();
    setUser(null);
  }

  return { user, loading, login, logout };
}

