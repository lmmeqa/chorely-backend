#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const STAGING_API = 'https://chorely-backend-staging.adityajain2204.workers.dev';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testFinalEndpoints() {
  console.log('Testing final endpoints on staging backend...');
  
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
    
    // First get homes to get a homeId
    const homesResponse = await fetch(`${STAGING_API}/homes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const homesData = await homesResponse.json();
    const homeId = homesData[0]?.id;
    
    console.log(`Using homeId: ${homeId}`);
    
    const endpoints = [
      { method: 'GET', path: '/me', description: 'Get user profile' },
      { method: 'GET', path: `/chores/user?homeId=${homeId}`, description: 'Get user chores with homeId' },
      { method: 'GET', path: `/chores/available/${homeId}`, description: 'Get available chores' },
      { method: 'GET', path: `/homes/${homeId}/users`, description: 'Get home users' },
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
        console.log(`   Response: ${responseText.substring(0, 300)}${responseText.length > 300 ? '...' : ''}`);
        
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

testFinalEndpoints().catch(console.error);