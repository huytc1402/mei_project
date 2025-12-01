// src/lib/env.ts
const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'TELEGRAM_BOT_TOKEN',
    'ADMIN_TOKEN',
    'CLIENT_TOKEN',
  ];
  
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  
  export const env = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    openaiApiKey: process.env.OPENAI_API_KEY!,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN!,
    adminToken: process.env.ADMIN_TOKEN!,
    clientToken: process.env.CLIENT_TOKEN!,
  };