#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const STAGING_API = 'https://chorely-backend-staging.adityajain2204.workers.dev';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkChoreStates() {
  console.log('🔍 Checking chore states...');
  
  try {
    // Authenticate as Alice
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'alice@demo.com',
      password: 'Password1!',
    });
    
    if (error) {
      console.error('❌ Supabase authentication failed:', error.message);
      return;
    }
    
    const token = data.session?.access_token;
    
    // Get a home
    const homesResponse = await fetch(`${STAGING_API}/homes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const homesData = await homesResponse.json();
    const homeId = homesData[0]?.id;
    
    console.log(`Using homeId: ${homeId}`);
    
    // Check available chores
    console.log('\n📋 Available chores:');
    const availableResponse = await fetch(`${STAGING_API}/chores/available/${homeId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const availableChores = await availableResponse.json();
    console.log(`Available: ${availableChores.length} chores`);
    availableChores.forEach((c: any, i: number) => {
      console.log(`  ${i+1}. ${c.name} (${c.uuid}) - Status: ${c.status}`);
    });
    
    // Check user's chores
    console.log('\n👤 User chores:');
    const choresResponse = await fetch(`${STAGING_API}/chores/user?homeId=${homeId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const choresData = await choresResponse.json();
    console.log(`User has: ${choresData.length} chores`);
    choresData.forEach((c: any, i: number) => {
      console.log(`  ${i+1}. ${c.name} (${c.uuid}) - Status: ${c.status}, User: ${c.userEmail || 'none'}`);
    });
    
    // If there are available chores, claim one and test
    if (availableChores.length > 0) {
      const choreToTest = availableChores[0];
      console.log(`\n🧪 Testing with chore: ${choreToTest.name}`);
      
      // Claim it
      console.log('📌 Claiming chore...');
      const claimResponse = await fetch(`${STAGING_API}/chores/${choreToTest.uuid}/claim`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (claimResponse.status === 204) {
        console.log('✅ Chore claimed successfully');
        
        // Complete with image
        console.log('🔄 Completing with image...');
        const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
        
        const completeResponse = await fetch(`${STAGING_API}/chores/${choreToTest.uuid}/complete`, {
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
          console.log('✅ Completion successful!');
          
          // Check if photo was uploaded
          const updatedResponse = await fetch(`${STAGING_API}/chores/${choreToTest.uuid}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const updatedChore = await updatedResponse.json();
          
          if (updatedChore.photoUrl) {
            console.log('🖼️  Photo URL was set:', updatedChore.photoUrl);
            console.log('✅ IMAGE UPLOAD WORKING!');
          } else {
            console.log('❌ Photo URL was NOT set');
          }
        } else {
          const errorText = await completeResponse.text();
          console.log('❌ Completion failed:', errorText);
        }
      } else {
        const claimError = await claimResponse.text();
        console.log('❌ Claim failed:', claimError);
      }
    }
    
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

checkChoreStates().catch(console.error);