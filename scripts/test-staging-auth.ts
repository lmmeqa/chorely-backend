#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const STAGING_API = 'https://chorely-backend-staging.adityajain2204.workers.dev';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testStagingAuth() {
  console.log('Testing staging backend authentication...');
  
  try {
    // First, authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'alice@demo.com',
      password: 'Password1!',
    });
    
    if (error) {
      console.error('❌ Supabase authentication failed:', error.message);
      return;
    }
    
    console.log('✅ Supabase authentication successful!');
    
    // Now test the staging backend
    const response = await fetch(`${STAGING_API}/auth/authenticate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${data.session?.access_token}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Staging response status:', response.status);
    console.log('Staging response text:', await response.text());
    
  } catch (err) {
    console.error('❌ Error during staging test:', err);
  }
}

testStagingAuth().catch(console.error);
