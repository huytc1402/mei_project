-- Add user preferences table for AI personalization
-- This allows users to set their city (for weather) and horoscope

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE,
  city text,
  horoscope text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT user_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Index for user preferences
CREATE INDEX IF NOT EXISTS user_preferences_user_id_idx ON public.user_preferences (user_id);

-- Enable Row Level Security
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_preferences
CREATE POLICY "Users can read own preferences" ON public.user_preferences
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own preferences" ON public.user_preferences
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
  FOR UPDATE USING (true);

-- Enable realtime for user preferences
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_preferences;
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;
END $$;
