#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const STAGING_API = 'https://chorely-backend-staging.adityajain2204.workers.dev';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testImageUpload() {
  console.log('🧪 Testing image upload flow...');
  
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
    
    // Get a claimed chore to complete
    const homesResponse = await fetch(`${STAGING_API}/homes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const homesData = await homesResponse.json();
    const homeId = homesData[0]?.id;
    
    // Get user's chores
    const choresResponse = await fetch(`${STAGING_API}/chores/user?homeId=${homeId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const choresData = await choresResponse.json();
    
    console.log('Available chores:', choresData.length);
    const claimedChore = choresData.find((c: any) => c.status === 'claimed');
    
    if (!claimedChore) {
      console.log('❌ No claimed chores found. Need to claim a chore first.');
      return;
    }
    
    console.log(`Found claimed chore: ${claimedChore.name} (${claimedChore.uuid})`);
    
    // Create a simple test image (1x1 red pixel PNG)
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    
    console.log('🔄 Testing image upload with chore completion...');
    
    const completeResponse = await fetch(`${STAGING_API}/chores/${claimedChore.uuid}/complete`, {
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
      
      // Check if the chore was updated with photo
      const updatedChoreResponse = await fetch(`${STAGING_API}/chores/${claimedChore.uuid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const updatedChore = await updatedChoreResponse.json();
      console.log('Updated chore photo URL:', updatedChore.photoUrl);
      
      if (updatedChore.photoUrl) {
        console.log('✅ Photo URL was set!');
        
        // Try to fetch the photo URL to see if it works
        try {
          const photoResponse = await fetch(updatedChore.photoUrl);
          console.log(`Photo URL status: ${photoResponse.status}`);
          console.log(`Photo URL headers:`, Object.fromEntries(photoResponse.headers));
        } catch (e) {
          console.log('❌ Photo URL fetch failed:', e);
        }
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

testImageUpload().catch(console.error);