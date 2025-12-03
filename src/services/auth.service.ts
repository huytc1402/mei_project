import { UserRole } from '@/types';

export class AuthService {
  async loginWithToken(token: string, role: UserRole): Promise<{ success: boolean; error?: string; userId?: string; actualRole?: UserRole }> {
    try {
      // Call API route
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const result = await response.json();

      if (result.success) {
        // Store session
        localStorage.setItem('user_id', result.userId);
        localStorage.setItem('user_role', result.role);
        localStorage.setItem('token', token);
        
        return {
          success: true,
          userId: result.userId,
          actualRole: result.role,
        };
      }

      return result;

    } catch (error: any) {
      console.error('Auth error:', error);
      return { success: false, error: error.message || 'Đăng nhập thất bại' };
    }
  }

  async logout(): Promise<void> {
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_role');
    localStorage.removeItem('token');
  }

  async getCurrentUser(): Promise<{ id: string; role: UserRole } | null> {
    const userId = localStorage.getItem('user_id');
    const role = localStorage.getItem('user_role') as UserRole;

    if (!userId || !role) return null;

    return { id: userId, role };
  }
}

