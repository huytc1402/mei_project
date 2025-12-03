-- Add revoked_at column to devices table
-- This column tracks when a device was revoked
-- Devices with revoked_at IS NOT NULL won't show in pending approval list
ALTER TABLE devices 
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_devices_revoked_at ON devices(revoked_at);

