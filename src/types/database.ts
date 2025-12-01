export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          role: 'admin' | 'client';
          device_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          role: 'admin' | 'client';
          device_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          role?: 'admin' | 'client';
          device_id?: string | null;
          created_at?: string;
        };
      };
      devices: {
        Row: {
          id: string;
          user_id: string;
          fingerprint: string;
          user_agent: string;
          ip_hash: string;
          is_active: boolean;
          created_at: string;
          last_seen: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          fingerprint: string;
          user_agent: string;
          ip_hash: string;
          is_active?: boolean;
          created_at?: string;
          last_seen?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          fingerprint?: string;
          user_agent?: string;
          ip_hash?: string;
          is_active?: boolean;
          created_at?: string;
          last_seen?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          type: 'ai' | 'quick_reply' | 'reaction';
          emoji: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          type: 'ai' | 'quick_reply' | 'reaction';
          emoji?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          content?: string;
          type?: 'ai' | 'quick_reply' | 'reaction';
          emoji?: string | null;
          created_at?: string;
        };
      };
      reactions: {
        Row: {
          id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          emoji: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          emoji?: string;
          created_at?: string;
        };
      };
      memories: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          created_at?: string;
        };
      };
      notification_schedules: {
        Row: {
          id: string;
          time: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          time: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          time?: string;
          is_active?: boolean;
          created_at?: string;
        };
      };
      daily_notifications: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          sent_at: string;
          emotion_level: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          sent_at?: string;
          emotion_level: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          content?: string;
          sent_at?: string;
          emotion_level?: number;
        };
      };
    };
  };
}


