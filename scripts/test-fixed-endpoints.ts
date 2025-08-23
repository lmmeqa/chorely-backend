#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const STAGING_API = 'https://chorely-backend-staging.adityajain2204.workers.dev';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testFixedEndpoints() {
  console.log('🧪 Testing fixed endpoints on staging backend...');
  
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
    
    // Get homeId for other tests
    const homesResponse = await fetch(`${STAGING_API}/homes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const homesData = await homesResponse.json();
    const homeId = homesData[0]?.id;
    
    console.log(`Using homeId: ${homeId}`);
    
    const endpoints = [
      { method: 'POST', path: '/auth/authenticate', description: 'Auth authenticate (should still work)' },
      { method: 'GET', path: '/auth/me', description: 'Auth me (should still work)' },
      { method: 'GET', path: '/me', description: 'User profile (FIXED - was timing out)' },
      { method: 'GET', path: '/homes', description: 'Get homes (should still work)' },
      { method: 'GET', path: `/homes/${homeId}/users`, description: 'Get home users (should still work)' },
      { method: 'GET', path: `/chores/user?homeId=${homeId}`, description: 'Get user chores (should still work)' },
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
        
        if (!response.ok) {
          console.log(`   ❌ ${endpoint.description} failed`);
          console.log(`   Response: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
        } else {
          console.log(`   ✅ ${endpoint.description} succeeded`);
          console.log(`   Response: ${responseText.substring(0, 150)}${responseText.length > 150 ? '...' : ''}`);
        }
        
      } catch (err) {
        console.log(`   ❌ ${endpoint.description} errored:`, err instanceof Error ? err.message : err);
      }
    }

    // Test /user POST endpoint specifically
    console.log(`\n🔄 Testing /user POST endpoint...`);
    try {
      const testUserResponse = await fetch(`${STAGING_API}/user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test-user@demo.com',
          name: 'Test User'
        }),
      });
      
      const testUserText = await testUserResponse.text();
      console.log(`   Status: ${testUserResponse.status}`);
      
      if (!testUserResponse.ok) {
        console.log(`   ❌ /user POST failed`);
        console.log(`   Response: ${testUserText}`);
      } else {
        console.log(`   ✅ /user POST succeeded`);
        console.log(`   Response: ${testUserText}`);
      }
      
    } catch (err) {
      console.log(`   ❌ /user POST errored:`, err instanceof Error ? err.message : err);
    }
    
  } catch (err) {
    console.error('❌ Error during testing:', err);
  }
}

testFixedEndpoints().catch(console.error);