import { createClient } from '@supabase/supabase-js';

// Support both Node env and Worker bindings
function getEnvVar(key: string, env?: any): string {
  // In Workers: use passed env bindings
  if (env && env[key]) return env[key];
  // In Node: use process.env
  if (typeof process !== 'undefined' && process.env[key]) return process.env[key];
  throw new Error(`Missing environment variable: ${key}`);
}

let _supabase: any = null;

export function createSupabaseClient(env?: any) {
  const SUPABASE_URL = getEnvVar('SUPABASE_URL', env);
  const SUPABASE_SERVICE_ROLE_KEY = getEnvVar('SUPABASE_SERVICE_ROLE_KEY', env);

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Initialize client lazily to handle environment loading
function getSupabaseClient() {
  if (!_supabase) {
    _supabase = createSupabaseClient();
  }
  return _supabase;
}

export const supabase = new Proxy({} as any, {
  get(target, prop) {
    return getSupabaseClient()[prop];
  }
});
export default supabase;
