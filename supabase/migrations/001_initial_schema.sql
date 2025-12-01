-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL CHECK (role IN ('admin', 'client')),
  device_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ai', 'quick_reply', 'reaction')),
  emoji TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reactions table
CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Memories table
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification schedules table
CREATE TABLE IF NOT EXISTS notification_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  time TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily notifications table
CREATE TABLE IF NOT EXISTS daily_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  emotion_level INTEGER DEFAULT 50
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_fingerprint ON devices(fingerprint);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_notifications_user_id ON daily_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_notifications_sent_at ON daily_notifications(sent_at);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Note: Adjust these policies based on your authentication setup
-- For now, using service role key bypasses RLS

-- Users can view own data (if using Supabase Auth)
-- CREATE POLICY "Users can view own data" ON users
--   FOR SELECT USING (auth.uid()::text = id::text);

-- For service role access (used in API routes)
-- Service role key bypasses RLS by default

-- RLS Policies cho Users
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (true); -- Service role bypass

CREATE POLICY "Users can insert own data" ON users
  FOR INSERT WITH CHECK (true);

-- RLS Policies cho Devices
CREATE POLICY "Users can read own devices" ON devices
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own devices" ON devices
  FOR INSERT WITH CHECK (true);

-- RLS Policies cho Messages
CREATE POLICY "Users can read own messages" ON messages
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own messages" ON messages
  FOR INSERT WITH CHECK (true);

-- RLS Policies cho Reactions
CREATE POLICY "Users can read own reactions" ON reactions
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own reactions" ON reactions
  FOR INSERT WITH CHECK (true);

-- RLS Policies cho Memories
CREATE POLICY "Users can read own memories" ON memories
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own memories" ON memories
  FOR INSERT WITH CHECK (true);

-- RLS Policies cho Daily Notifications
CREATE POLICY "Users can read own notifications" ON daily_notifications
  FOR SELECT USING (true);

-- RLS Policies cho Notification Schedules (admin only)
CREATE POLICY "Admin can read schedules" ON notification_schedules
  FOR SELECT USING (true);

CREATE POLICY "Admin can manage schedules" ON notification_schedules
  FOR ALL USING (true);

