#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create admin client
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkAndCreateBuckets() {
  console.log('🔍 Checking Supabase Storage buckets...');
  
  try {
    // List all buckets
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError);
      return;
    }
    
    console.log('📦 Existing buckets:', buckets.map(b => b.name));
    
    const bucketsToCheck = ['uploads', 'uploads-staging'];
    
    for (const bucketName of bucketsToCheck) {
      const bucketExists = buckets.some(bucket => bucket.name === bucketName);
      
      if (!bucketExists) {
        console.log(`❌ Bucket "${bucketName}" does not exist. Creating it...`);
        
        const { data, error } = await supabaseAdmin.storage.createBucket(bucketName, {
          public: false, // Private bucket for chore completion photos
          allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
          fileSizeLimit: 10 * 1024 * 1024, // 10MB limit
        });
        
        if (error) {
          console.error(`❌ Error creating bucket "${bucketName}":`, error);
        } else {
          console.log(`✅ Successfully created bucket "${bucketName}"`);
        }
      } else {
        console.log(`✅ Bucket "${bucketName}" exists`);
      }
    }
    
    // Test a simple upload to uploads-staging
    console.log('\n🧪 Testing upload to uploads-staging bucket...');
    const testData = new Blob(['test content'], { type: 'text/plain' });
    const testPath = `test/${Date.now()}-test.txt`;
    
    const { error: uploadError } = await supabaseAdmin.storage
      .from('uploads-staging')
      .upload(testPath, testData);
    
    if (uploadError) {
      console.error('❌ Test upload failed:', uploadError);
    } else {
      console.log('✅ Test upload successful');
      
      // Clean up test file
      await supabaseAdmin.storage.from('uploads-staging').remove([testPath]);
      console.log('🧹 Test file cleaned up');
    }
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

checkAndCreateBuckets().catch(console.error);