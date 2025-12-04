-- ============================================
-- Database Schema for Mei Project
-- ============================================
-- Execute this script in Supabase SQL Editor
-- This script creates all tables, indexes, and constraints

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  role text NOT NULL CHECK (role = ANY (ARRAY['admin'::text, 'client'::text])),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- Unique constraint: Only one user per role
CREATE UNIQUE INDEX IF NOT EXISTS users_role_unique ON public.users (role);

-- Index for created_at queries
CREATE INDEX IF NOT EXISTS users_created_at_idx ON public.users (created_at DESC);

-- ============================================
-- 2. MEMORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.memories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  sender_role text NOT NULL DEFAULT 'client'::text CHECK (sender_role = ANY (ARRAY['admin'::text, 'client'::text])),
  CONSTRAINT memories_pkey PRIMARY KEY (id),
  CONSTRAINT memories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Indexes for memories
CREATE INDEX IF NOT EXISTS memories_user_id_idx ON public.memories (user_id);
CREATE INDEX IF NOT EXISTS memories_created_at_idx ON public.memories (created_at DESC);
CREATE INDEX IF NOT EXISTS memories_user_sender_idx ON public.memories (user_id, sender_role);

-- ============================================
-- 3. MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  content text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['ai'::text, 'quick_reply'::text, 'reaction'::text])),
  emoji text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS messages_user_id_idx ON public.messages (user_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages (created_at DESC);
CREATE INDEX IF NOT EXISTS messages_user_type_idx ON public.messages (user_id, type);

-- ============================================
-- 4. REACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.reactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT reactions_pkey PRIMARY KEY (id),
  CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Indexes for reactions
CREATE INDEX IF NOT EXISTS reactions_user_id_idx ON public.reactions (user_id);
CREATE INDEX IF NOT EXISTS reactions_created_at_idx ON public.reactions (created_at DESC);

-- ============================================
-- 5. DAILY NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.daily_notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  content text NOT NULL,
  sent_at timestamp with time zone DEFAULT now() NOT NULL,
  emotion_level integer NOT NULL DEFAULT 50 CHECK (emotion_level >= 0 AND emotion_level <= 100),
  CONSTRAINT daily_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT daily_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Indexes for daily notifications
CREATE INDEX IF NOT EXISTS daily_notifications_user_id_idx ON public.daily_notifications (user_id);
CREATE INDEX IF NOT EXISTS daily_notifications_sent_at_idx ON public.daily_notifications (sent_at DESC);
CREATE INDEX IF NOT EXISTS daily_notifications_user_date_idx ON public.daily_notifications (user_id, sent_at DESC);

-- ============================================
-- 6. NOTIFICATION SCHEDULES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.notification_schedules (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  time text NOT NULL CHECK (time ~ '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT notification_schedules_pkey PRIMARY KEY (id)
);

-- Index for active schedules (partial index)
CREATE INDEX IF NOT EXISTS notification_schedules_active_idx ON public.notification_schedules (is_active) WHERE is_active = true;

-- ============================================
-- 7. PUSH SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT push_subscriptions_unique UNIQUE (user_id, endpoint)
);

-- Indexes for push subscriptions
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON public.push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_active_idx ON public.push_subscriptions (is_active) WHERE is_active = true;

-- ============================================
-- 8. NOTIFICATION LOGS TABLE (for spam prevention)
-- ============================================
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  notification_type text NOT NULL CHECK (notification_type = ANY (ARRAY['memory'::text, 'message'::text, 'reaction'::text, 'daily'::text])),
  sent_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT notification_logs_pkey PRIMARY KEY (id),
  CONSTRAINT notification_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Indexes for notification logs
CREATE INDEX IF NOT EXISTS notification_logs_user_id_idx ON public.notification_logs (user_id);
CREATE INDEX IF NOT EXISTS notification_logs_sent_at_idx ON public.notification_logs (sent_at DESC);
CREATE INDEX IF NOT EXISTS notification_logs_user_type_sent_idx ON public.notification_logs (user_id, notification_type, sent_at DESC);

-- ============================================
-- 9. NOTIFICATION PREFERENCES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE,
  enable_memory boolean NOT NULL DEFAULT true,
  enable_message boolean NOT NULL DEFAULT true,
  enable_reaction boolean NOT NULL DEFAULT true,
  enable_daily boolean NOT NULL DEFAULT false,
  silent_hours_start integer DEFAULT 22 CHECK (silent_hours_start >= 0 AND silent_hours_start <= 23),
  silent_hours_end integer DEFAULT 7 CHECK (silent_hours_end >= 0 AND silent_hours_end <= 23),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Index for notification preferences
CREATE INDEX IF NOT EXISTS notification_preferences_user_id_idx ON public.notification_preferences (user_id);

-- ============================================
-- ENABLE REALTIME (Supabase specific)
-- ============================================
-- Enable realtime for tables that need it
-- Note: These commands may fail if tables are already in the publication - that's OK
DO $$
BEGIN
  -- Add tables to realtime publication if not already added
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
  EXCEPTION
    WHEN OTHERS THEN NULL; -- Table already in publication, ignore
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION
    WHEN OTHERS THEN NULL; -- Table already in publication, ignore
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.memories;
  EXCEPTION
    WHEN OTHERS THEN NULL; -- Table already in publication, ignore
  END;
END $$;

-- ============================================
-- COMPLETION MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Database schema created successfully!';
  RAISE NOTICE '📊 Tables created: users, memories, messages, reactions, daily_notifications, notification_schedules, push_subscriptions, notification_logs, notification_preferences';
  RAISE NOTICE '🔍 Indexes and constraints applied for optimal performance';
END $$;
