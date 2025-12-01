import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database';

// Singleton pattern for client-side Supabase client
let supabaseClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export const createClient = () => {
  // Return cached client if available (singleton pattern)
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Strict validation: throw error if env vars are missing
  // NEXT_PUBLIC_* vars should always be set in production
  if (!supabaseUrl || !supabaseAnonKey) {
    const missing = [];
    if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    
    const errorMessage = `Missing required environment variables: ${missing.join(', ')}. ` +
      'Please ensure these are set in your Vercel project settings or .env.local file.';
    
    // Log error in development, throw in production
    if (typeof window !== 'undefined') {
      console.error(errorMessage);
    }
    
    throw new Error(errorMessage);
  }
  
  supabaseClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
};

