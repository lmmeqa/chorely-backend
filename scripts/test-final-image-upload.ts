#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const STAGING_API = 'https://chorely-backend-staging.adityajain2204.workers.dev';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testFinalImageUpload() {
  console.log('🧪 Testing FINAL image upload with fixed code...');
  
  try {
    // Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'bob@demo.com', // Use Bob this time to avoid conflicts
      password: 'Password1!',
    });
    
    if (error) {
      console.error('❌ Supabase authentication failed:', error.message);
      return;
    }
    
    console.log('✅ Supabase authentication successful as Bob!');
    const token = data.session?.access_token;
    
    // Get a home
    const homesResponse = await fetch(`${STAGING_API}/homes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const homesData = await homesResponse.json();
    const homeId = homesData[0]?.id;
    
    console.log(`Using homeId: ${homeId}`);
    
    // Create a new test chore using the API
    console.log('🔄 Creating a test chore...');
    const createResponse = await fetch(`${STAGING_API}/chores`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Test Image Upload ${Date.now()}`,
        description: 'Test chore for image upload functionality',
        time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        icon: '🧪',
        homeId: homeId,
        points: 10
      }),
    });
    
    if (!createResponse.ok) {
      const createError = await createResponse.text();
      console.error('❌ Failed to create test chore:', createError);
      return;
    }
    
    const newChore = await createResponse.json();
    console.log(`✅ Created test chore: ${newChore.uuid}`);
    
    // Wait a moment for the chore to be available
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Claim the chore
    console.log('🔄 Claiming the test chore...');
    const claimResponse = await fetch(`${STAGING_API}/chores/${newChore.uuid}/claim`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (claimResponse.status !== 204) {
      const claimError = await claimResponse.text();
      console.error('❌ Failed to claim chore:', claimError);
      return;
    }
    
    console.log('✅ Chore claimed successfully');
    
    // Complete with image
    console.log('🔄 Completing chore with image (THIS IS THE TEST!)...');
    
    // Create a simple test image (1x1 red pixel PNG) 
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    
    const completeResponse = await fetch(`${STAGING_API}/chores/${newChore.uuid}/complete`, {
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
      
      // Check if the photo was uploaded
      console.log('🔄 Checking if photo was uploaded...');
      const updatedChoreResponse = await fetch(`${STAGING_API}/chores/${newChore.uuid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const updatedChore = await updatedChoreResponse.json();
      console.log('Updated chore status:', updatedChore.status);
      console.log('Updated chore photo URL:', updatedChore.photoUrl);
      
      if (updatedChore.photoUrl) {
        console.log('✅✅ PHOTO URL WAS SET! IMAGE UPLOAD IS WORKING! ✅✅');
        console.log('🖼️  Photo path stored:', updatedChore.photoUrl);
        
        // This is the key test - photoUrl should no longer be null
        console.log('🎉 THE FIX WAS SUCCESSFUL! 🎉');
        
      } else {
        console.log('❌ Photo URL was NOT set - upload still failing');
      }
      
    } else {
      const errorText = await completeResponse.text();
      console.log('❌ Completion failed:', errorText);
    }
    
  } catch (err) {
    console.error('❌ Error during testing:', err);
  }
}

testFinalImageUpload().catch(console.error);