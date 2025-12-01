-- Add sender_role column to memories table to distinguish admin vs client memories
ALTER TABLE memories 
ADD COLUMN IF NOT EXISTS sender_role TEXT DEFAULT 'client' CHECK (sender_role IN ('admin', 'client'));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_memories_sender_role ON memories(sender_role);
CREATE INDEX IF NOT EXISTS idx_memories_user_sender ON memories(user_id, sender_role);

