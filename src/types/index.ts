export type UserRole = 'admin' | 'client';

export interface User {
  id: string;
  role: UserRole;
  deviceId?: string;
  createdAt: string;
}

export interface Device {
  id: string;
  userId: string;
  fingerprint: string;
  userAgent: string;
  ipHash: string;
  isActive: boolean;
  createdAt: string;
  lastSeen: string;
}

export interface Message {
  id: string;
  userId: string;
  content: string;
  type: 'ai' | 'quick_reply' | 'reaction';
  emoji?: string;
  createdAt: string;
}

export interface Reaction {
  id: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface Memory {
  id: string;
  userId: string;
  senderRole?: 'admin' | 'client'; // Who sent this memory
  createdAt: string;
}

export interface NotificationSchedule {
  id: string;
  time: string; // HH:mm format
  isActive: boolean;
  createdAt: string;
}

export interface DailyNotification {
  id: string;
  userId: string;
  content: string;
  sentAt: string;
  emotionLevel: number; // 0-100
}

export interface AuthToken {
  token: string;
  role: UserRole;
  expiresAt?: string;
  isOneTime?: boolean;
}


