import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Supabase environment variables are missing!');
  console.error('Please set in your .env file:');
  console.error('SUPABASE_URL=your-project-url');
  console.error('SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  throw new Error('Missing Supabase configuration');
}

// Create Supabase client with service role key for admin operations
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default supabase;
