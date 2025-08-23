#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const STAGING_API = 'https://chorely-backend-staging.adityajain2204.workers.dev';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debugTimeouts() {
  console.log('Debugging timeout issues on staging backend...');
  
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
    
    // First get a homeId
    const homesResponse = await fetch(`${STAGING_API}/homes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const homesData = await homesResponse.json();
    const homeId = homesData[0]?.id;
    
    console.log(`Using homeId: ${homeId}`);
    
    // Test the problematic endpoints one by one with detailed error handling
    const problemEndpoints = [
      { method: 'GET', path: '/me', description: 'Get user profile (/me)', timeout: 10000 },
      { method: 'GET', path: `/homes/${homeId}/users`, description: 'Get home users', timeout: 10000 },
    ];
    
    for (const endpoint of problemEndpoints) {
      try {
        console.log(`\n🔄 Testing ${endpoint.description}...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), endpoint.timeout);
        
        const response = await fetch(`${STAGING_API}${endpoint.path}`, {
          method: endpoint.method,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const responseText = await response.text();
          console.log(`   ✅ ${endpoint.description} succeeded`);
          console.log(`   Response: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
        } else {
          const responseText = await response.text();
          console.log(`   ❌ ${endpoint.description} failed with status ${response.status}`);
          console.log(`   Response: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
        }
        
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.log(`   ⏰ ${endpoint.description} timed out after ${endpoint.timeout}ms`);
        } else {
          console.log(`   ❌ ${endpoint.description} errored:`, err instanceof Error ? err.message : err);
        }
      }
    }
    
  } catch (err) {
    console.error('❌ Error during debugging:', err);
  }
}

debugTimeouts().catch(console.error);