#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const STAGING_API = 'https://chorely-backend-staging.adityajain2204.workers.dev';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debugStaging() {
  console.log('🔍 Debugging Staging Backend');
  console.log('================================');
  
  try {
    // Step 1: Test basic connectivity
    console.log('\n1️⃣ Testing basic connectivity...');
    const pingResponse = await fetch(`${STAGING_API}/public/ping`);
    console.log(`   Ping status: ${pingResponse.status}`);
    const pingData = await pingResponse.text();
    console.log(`   Ping response: ${pingData}`);
    
    // Step 2: Test homes endpoint (should work without auth)
    console.log('\n2️⃣ Testing homes endpoint...');
    const homesResponse = await fetch(`${STAGING_API}/homes`);
    console.log(`   Homes status: ${homesResponse.status}`);
    if (homesResponse.ok) {
      const homesData = await homesResponse.json();
      console.log(`   Homes count: ${homesData.length}`);
    } else {
      const homesError = await homesResponse.text();
      console.log(`   Homes error: ${homesError}`);
    }
    
    // Step 3: Authenticate with Supabase
    console.log('\n3️⃣ Authenticating with Supabase...');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'alice@demo.com',
      password: 'Password1!',
    });
    
    if (error) {
      console.error('   ❌ Supabase auth failed:', error.message);
      return;
    }
    
    console.log('   ✅ Supabase auth successful!');
    console.log(`   User: ${data.user?.email}`);
    console.log(`   Token: ${data.session?.access_token?.substring(0, 50)}...`);
    
    // Step 4: Test authenticate endpoint with real token
    console.log('\n4️⃣ Testing /auth/authenticate endpoint...');
    const authResponse = await fetch(`${STAGING_API}/auth/authenticate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${data.session!.access_token}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`   Auth status: ${authResponse.status}`);
    if (authResponse.ok) {
      const authData = await authResponse.json();
      console.log(`   Auth response:`, authData);
    } else {
      const authError = await authResponse.text();
      console.log(`   Auth error: ${authError}`);
    }
    
    // Step 5: Test user creation endpoint
    console.log('\n5️⃣ Testing /user endpoint...');
    const userResponse = await fetch(`${STAGING_API}/user`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${data.session!.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'alice@demo.com',
        name: 'Alice'
      }),
    });
    
    console.log(`   User creation status: ${userResponse.status}`);
    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log(`   User creation response:`, userData);
    } else {
      const userError = await userResponse.text();
      console.log(`   User creation error: ${userError}`);
    }
    
    // Step 6: Test user homes endpoint
    console.log('\n6️⃣ Testing /user/:email/homes endpoint...');
    const userHomesResponse = await fetch(`${STAGING_API}/user/alice@demo.com/homes`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${data.session!.access_token}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`   User homes status: ${userHomesResponse.status}`);
    if (userHomesResponse.ok) {
      const userHomesData = await userHomesResponse.json();
      console.log(`   User homes response:`, userHomesData);
    } else {
      const userHomesError = await userHomesResponse.text();
      console.log(`   User homes error: ${userHomesError}`);
    }
    
  } catch (err: any) {
    console.error('❌ Debug failed:', err?.message || err);
    console.error('Full error:', err);
  }
}

debugStaging();
