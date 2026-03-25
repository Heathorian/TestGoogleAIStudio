import { createClient } from '@supabase/supabase-js';

// Use environment variables if available, otherwise fallback to provided credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nofzaihmrhexdzxmzgdh.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_bOsssjq9bMLYNccmw0Vd8w_bzBLF1cb';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing. Please check your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
