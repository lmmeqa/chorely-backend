#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const STAGING_API = 'https://chorely-backend-staging.adityajain2204.workers.dev';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testClaimAndComplete() {
  console.log('🧪 Testing claim and complete with image...');
  
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
    
    // Get a home
    const homesResponse = await fetch(`${STAGING_API}/homes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const homesData = await homesResponse.json();
    const homeId = homesData[0]?.id;
    
    console.log(`Using homeId: ${homeId}`);
    
    // Find all chores for this user to see what's available
    const choresResponse = await fetch(`${STAGING_API}/chores/user?homeId=${homeId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const choresData = await choresResponse.json();
    
    console.log(`Found ${choresData.length} chores for user`);
    
    // Look for any unclaimed chore
    const unclaimedChore = choresData.find((c: any) => c.status === 'available');
    
    if (!unclaimedChore) {
      console.log('❌ No unclaimed chores found');
      return;
    }
    
    console.log(`Found unclaimed chore: ${unclaimedChore.name} (${unclaimedChore.uuid})`);
    
    // Step 1: Claim the chore
    console.log('🔄 Claiming chore...');
    const claimResponse = await fetch(`${STAGING_API}/chores/${unclaimedChore.uuid}/claim`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`Claim response: ${claimResponse.status}`);
    
    if (claimResponse.status !== 204) {
      const claimError = await claimResponse.text();
      console.log('❌ Failed to claim chore:', claimError);
      return;
    }
    
    console.log('✅ Chore claimed successfully');
    
    // Step 2: Complete with image
    console.log('🔄 Completing chore with image...');
    
    // Create a simple test image (1x1 red pixel PNG) 
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    
    const completeResponse = await fetch(`${STAGING_API}/chores/${unclaimedChore.uuid}/complete`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: {
          data: testImageBase64,
          filename: 'test-completion.png',
          contentType: 'image/png'
        }
      }),
    });
    
    console.log(`Complete response status: ${completeResponse.status}`);
    
    if (completeResponse.status === 204) {
      console.log('✅ Chore completion succeeded');
      
      // Step 3: Check if the photo was uploaded
      console.log('🔄 Checking chore details...');
      const updatedChoreResponse = await fetch(`${STAGING_API}/chores/${unclaimedChore.uuid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const updatedChore = await updatedChoreResponse.json();
      console.log('Updated chore status:', updatedChore.status);
      console.log('Updated chore photo URL:', updatedChore.photoUrl);
      
      if (updatedChore.photoUrl) {
        console.log('✅ Photo URL was set!');
        console.log('Photo path stored:', updatedChore.photoUrl);
        
        // We don't need to test the signed URL here since that's tested elsewhere
        // The important thing is that photoUrl is no longer null
        
      } else {
        console.log('❌ No photo URL was set on the chore');
      }
      
    } else {
      const errorText = await completeResponse.text();
      console.log('❌ Completion failed:', errorText);
    }
    
  } catch (err) {
    console.error('❌ Error during testing:', err);
  }
}

testClaimAndComplete().catch(console.error);