#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { uploadToStorageReturnPath, createSignedUrlForPath } from '../src/lib/uploads';
import dotenv from 'dotenv';

dotenv.config();

async function testWorkerLikeUpload() {
  console.log('🧪 Testing image upload in Worker-like context...');
  
  try {
    // Simulate the base64 decode like in the real completion endpoint
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    
    console.log('📝 Base64 image data length:', testImageBase64.length);
    
    // Decode to ArrayBuffer like in the real endpoint
    const binaryString = atob(testImageBase64);
    const imageBuffer = new ArrayBuffer(binaryString.length);
    const view = new Uint8Array(imageBuffer);
    for (let i = 0; i < binaryString.length; i++) {
      view[i] = binaryString.charCodeAt(i);
    }
    
    console.log('📦 Decoded image buffer size:', imageBuffer.byteLength, 'bytes');
    
    // Mock environment like in Workers
    const mockEnv = {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_BUCKET: 'uploads-staging' // This is what staging uses
    };
    
    console.log('🔧 Using bucket:', mockEnv.SUPABASE_BUCKET);
    
    // Test the exact upload function used in the completion endpoint
    console.log('📤 Uploading with uploadToStorageReturnPath...');
    const path = await uploadToStorageReturnPath(imageBuffer, {
      env: mockEnv,
      prefix: 'proofs/chores/test-chore-id',
      filename: 'test-completion.png',
      contentType: 'image/png'
    });
    
    console.log('✅ Upload successful! Path:', path);
    
    // Test creating signed URL
    console.log('🔗 Creating signed URL...');
    const signedUrl = await createSignedUrlForPath(path, {
      env: mockEnv,
      expiresIn: 3600
    });
    
    console.log('✅ Signed URL created:', signedUrl);
    
    // Test if the signed URL works
    console.log('🧪 Testing signed URL accessibility...');
    const response = await fetch(signedUrl);
    console.log('📡 Response status:', response.status);
    console.log('📡 Response content-type:', response.headers.get('content-type'));
    
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      console.log('✅ Image accessible! Size:', buffer.byteLength, 'bytes');
    } else {
      console.log('❌ Image not accessible');
    }
    
    // Clean up
    console.log('🧹 Cleaning up test file...');
    const supabase = createClient(mockEnv.SUPABASE_URL!, mockEnv.SUPABASE_SERVICE_ROLE_KEY!);
    const { error: deleteError } = await supabase.storage
      .from(mockEnv.SUPABASE_BUCKET!)
      .remove([path]);
    
    if (deleteError) {
      console.log('⚠️  Delete failed:', deleteError);
    } else {
      console.log('✅ Test file cleaned up');
    }
    
  } catch (err) {
    console.error('❌ Test failed:', err);
  }
}

testWorkerLikeUpload().catch(console.error);