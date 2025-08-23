#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testDemoAuth() {
  console.log('Testing demo user authentication...');
  
  const testUser = { email: 'alice@demo.com', password: 'Password1!' };
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password,
    });
    
    if (error) {
      console.error('❌ Authentication failed:', error.message);
    } else {
      console.log('✅ Authentication successful!');
      console.log('User ID:', data.user?.id);
      console.log('Access token:', data.session?.access_token?.substring(0, 20) + '...');
    }
  } catch (err) {
    console.error('❌ Error during authentication:', err);
  }
}

testDemoAuth().catch(console.error);
