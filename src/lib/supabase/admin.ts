import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

export const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Strict validation: throw error if env vars are missing
  // This ensures no placeholder keys are used in production
  if (!supabaseUrl || !supabaseServiceKey) {
    const missing = [];
    if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      'Please ensure these are set in your Vercel project settings or .env.local file.'
    );
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};


