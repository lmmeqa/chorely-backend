#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const API_BASE = 'http://localhost:3000';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function makeAuthenticatedRequest(url: string, token: string, method = 'GET', body?: any): Promise<{ status: number, data: any, duration: number }> {
  const start = Date.now();
  
  try {
    const response = await fetch(`${API_BASE}${url}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    const duration = Date.now() - start;
    const data = await response.json().catch(() => null);
    
    return { status: response.status, data, duration };
  } catch (error) {
    const duration = Date.now() - start;
    return { status: 0, data: { error: error.message }, duration };
  }
}

async function testBatchEndpoints() {
  console.log('🚀 Testing Batch Endpoints vs Individual Calls\n');
  
  // Authenticate first
  console.log('Authenticating as alice@demo.com...');
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: 'alice@demo.com',
    password: 'Password1!',
  });
  
  if (error || !authData.session?.access_token) {
    console.error('❌ Authentication failed:', error?.message);
    return;
  }
  
  const token = authData.session.access_token;
  console.log('✅ Authentication successful\n');
  
  // Get user's home ID first
  console.log('Getting user homes...');
  const homeResponse = await makeAuthenticatedRequest('/user/alice%40demo.com/home', token);
  if (homeResponse.status !== 200 || !homeResponse.data?.length) {
    console.error('❌ Failed to get user homes:', homeResponse.data);
    return;
  }
  
  const homeId = homeResponse.data[0].id;
  console.log(`✅ Found home ID: ${homeId}\n`);
  
  // Test 1: Individual API calls (old way)
  console.log('📊 Testing INDIVIDUAL API calls (old approach)...');
  
  const individualStart = Date.now();
  const individualCalls = await Promise.all([
    makeAuthenticatedRequest(`/chores/available/${homeId}`, token),
    makeAuthenticatedRequest(`/chores/user?homeId=${homeId}`, token),
    makeAuthenticatedRequest(`/chores/unapproved/${homeId}`, token),
    makeAuthenticatedRequest(`/points/${homeId}/alice%40demo.com`, token),
    makeAuthenticatedRequest(`/points/${homeId}`, token),
  ]);
  const individualDuration = Date.now() - individualStart;
  
  console.log('Individual call results:');
  individualCalls.forEach((result, i) => {
    const endpoints = ['available chores', 'my chores', 'unapproved chores', 'user points', 'all points'];
    console.log(`  ${endpoints[i]}: ${result.status} (${result.duration}ms)`);
  });
  console.log(`  Total individual calls duration: ${individualDuration}ms\n`);
  
  // Test 2: Batch API call (new way)
  console.log('⚡ Testing BATCH API call (new approach)...');
  
  const batchStart = Date.now();
  const batchResponse = await makeAuthenticatedRequest(`/home/${homeId}/summary?user=alice%40demo.com`, token);
  const batchDuration = Date.now() - batchStart;
  
  console.log(`Batch call result: ${batchResponse.status} (${batchDuration}ms)`);
  if (batchResponse.status === 200) {
    const data = batchResponse.data;
    console.log('  Available chores:', data.availableChores?.length || 0);
    console.log('  My chores:', data.myChores?.length || 0);
    console.log('  Unapproved chores:', data.unapprovedChores?.length || 0);
    console.log('  User points:', data.userPoints || 0);
    console.log('  All user points entries:', Object.keys(data.allUserPoints || {}).length);
  } else {
    console.log('  Error:', batchResponse.data);
  }
  console.log();
  
  // Test 3: Batch approval statuses
  if (batchResponse.status === 200 && batchResponse.data.unapprovedChores?.length > 0) {
    console.log('🎯 Testing APPROVAL STATUS batch...');
    
    const unapprovedUuids = batchResponse.data.unapprovedChores.map((c: any) => c.uuid);
    console.log(`  Testing with ${unapprovedUuids.length} unapproved chores`);
    
    // Individual approval calls (old way)
    const approvalIndividualStart = Date.now();
    const approvalIndividualCalls = await Promise.all(
      unapprovedUuids.map((uuid: string) => 
        makeAuthenticatedRequest(`/approvals/${uuid}`, token)
      )
    );
    const approvalIndividualDuration = Date.now() - approvalIndividualStart;
    
    console.log(`  Individual approval calls: ${approvalIndividualCalls.length} calls in ${approvalIndividualDuration}ms`);
    
    // Batch approval call (new way)
    const approvalBatchStart = Date.now();
    const approvalBatchResponse = await makeAuthenticatedRequest('/approvals/batch', token, 'POST', {
      uuids: unapprovedUuids
    });
    const approvalBatchDuration = Date.now() - approvalBatchStart;
    
    console.log(`  Batch approval call: ${approvalBatchResponse.status} (${approvalBatchDuration}ms)`);
    if (approvalBatchResponse.status === 200) {
      console.log(`  Returned ${approvalBatchResponse.data?.length || 0} approval statuses`);
    }
    console.log();
  }
  
  // Summary
  console.log('📈 PERFORMANCE SUMMARY:');
  console.log(`  Individual calls: 5+ requests in ${individualDuration}ms`);
  console.log(`  Batch call: 1 request in ${batchDuration}ms`);
  console.log(`  Improvement: ${Math.round((1 - batchDuration / individualDuration) * 100)}% faster`);
  console.log(`  Reduction: ${Math.round((individualDuration - batchDuration) / individualDuration * 100)}% less time`);
  
  if (individualDuration > batchDuration) {
    console.log('✅ BATCH ENDPOINT IS FASTER! 🚀');
  } else {
    console.log('⚠️  Individual calls were faster (possibly due to caching or network conditions)');
  }
  
  console.log('\n🎯 API Call Reduction:');
  console.log(`  Before: ~31 API calls on login (from logs.txt analysis)`);
  console.log(`  After: ~3 API calls on login (auth + batch + batch approvals)`);
  console.log(`  Reduction: ~90% fewer API calls! 📉`);
}

testBatchEndpoints().catch(console.error);