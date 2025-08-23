#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testJWT() {
  console.log('🔍 Testing JWT Verification');
  console.log('============================');
  
  try {
    // Step 1: Get a real token from Supabase
    console.log('\n1️⃣ Getting Supabase token...');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'alice@demo.com',
      password: 'Password1!',
    });
    
    if (error) {
      console.error('   ❌ Supabase auth failed:', error.message);
      return;
    }
    
    console.log('   ✅ Supabase auth successful!');
    const token = data.session!.access_token;
    console.log(`   Token: ${token.substring(0, 50)}...`);
    
    // Step 2: Test JWT verification locally
    console.log('\n2️⃣ Testing JWT verification locally...');
    try {
      const key = new TextEncoder().encode(SUPABASE_JWT_SECRET);
      const { payload } = await jwtVerify(token, key);
      console.log('   ✅ JWT verification successful!');
      console.log(`   User ID: ${payload.sub}`);
      console.log(`   Email: ${(payload as any).email}`);
      console.log(`   Role: ${(payload as any).role}`);
    } catch (jwtError: any) {
      console.error('   ❌ JWT verification failed:', jwtError.message);
      console.error('   Full error:', jwtError);
    }
    
    // Step 3: Test with a simple token
    console.log('\n3️⃣ Testing with simple token...');
    try {
      const key = new TextEncoder().encode(SUPABASE_JWT_SECRET);
      const { payload } = await jwtVerify('test-token', key);
      console.log('   ✅ Simple token verification successful!');
    } catch (jwtError: any) {
      console.log('   ❌ Simple token verification failed (expected):', jwtError.message);
    }
    
  } catch (err: any) {
    console.error('❌ Test failed:', err?.message || err);
    console.error('Full error:', err);
  }
}

testJWT();
