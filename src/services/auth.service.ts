import { createClient } from '@/lib/supabase/client';
import { generateFingerprint, getUserAgent, hashIP } from '@/lib/utils/device';
import { UserRole } from '@/types';

export class AuthService {
  private supabase = createClient();

  async loginWithToken(token: string, role: UserRole): Promise<{ success: boolean; error?: string; userId?: string; actualRole?: UserRole }> {
    try {
      // Generate device fingerprint
      const fingerprint = generateFingerprint();
      const userAgent = getUserAgent();
      
      // Get IP (in production, get from request headers)
      const ip = await this.getClientIP();
      const ipHash = hashIP(ip);

      // Call API route
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          fingerprint,
          userAgent,
          ipHash,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Store session
        localStorage.setItem('user_id', result.userId);
        localStorage.setItem('user_role', result.actualRole || result.role);
        localStorage.setItem('device_fingerprint', fingerprint);
        localStorage.setItem('token', token); // Store token to check device status later
        
        return {
          success: true,
          userId: result.userId,
          actualRole: result.actualRole || result.role,
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
    localStorage.removeItem('device_fingerprint');
    localStorage.removeItem('token');
  }

  async getCurrentUser(): Promise<{ id: string; role: UserRole } | null> {
    const userId = localStorage.getItem('user_id');
    const role = localStorage.getItem('user_role') as UserRole;

    if (!userId || !role) return null;

    return { id: userId, role };
  }

  private async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || 'unknown';
    } catch {
      return 'unknown';
    }
  }

}

