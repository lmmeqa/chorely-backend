#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const STAGING_API = 'https://chorely-backend-staging.adityajain2204.workers.dev';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testProperEndpoints() {
  console.log('Testing proper endpoints on staging backend...');
  
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
    const token = data.session?.access_token;
    
    const endpoints = [
      { method: 'POST', path: '/auth/authenticate', description: 'Auth authenticate' },
      { method: 'GET', path: '/auth/me', description: 'Get current user' }, 
      { method: 'GET', path: '/me', description: 'Get user profile' },
      { method: 'GET', path: '/homes', description: 'Get homes' },
      { method: 'GET', path: '/chores/user', description: 'Get user chores' },
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`\n🔄 Testing ${endpoint.description} (${endpoint.method} ${endpoint.path})...`);
        
        const response = await fetch(`${STAGING_API}${endpoint.path}`, {
          method: endpoint.method,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        const responseText = await response.text();
        console.log(`   Status: ${response.status}`);
        console.log(`   Response: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
        
        if (!response.ok) {
          console.log(`   ❌ ${endpoint.description} failed`);
        } else {
          console.log(`   ✅ ${endpoint.description} succeeded`);
        }
        
      } catch (err) {
        console.log(`   ❌ ${endpoint.description} errored:`, err instanceof Error ? err.message : err);
      }
    }
    
  } catch (err) {
    console.error('❌ Error during testing:', err);
  }
}

testProperEndpoints().catch(console.error);