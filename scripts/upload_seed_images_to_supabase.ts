import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const env = process.argv[2] || 'staging';
const SUPABASE_URL = env === 'production' ? process.env.SUPABASE_URL_PRODUCTION! : process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = env === 'production' ? process.env.SUPABASE_SERVICE_ROLE_KEY_PRODUCTION! : process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET_NAME = process.env.SUPABASE_BUCKET || (env === 'production' ? 'uploads' : 'uploads-staging');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function uploadSeedImages() {
  console.log(`🌱 Uploading seed images to ${env} environment`);
  console.log(`📦 Using bucket: ${BUCKET_NAME}`);
  
  const seedDir = path.join(process.cwd(), 'static', 'seed');
  const files = fs.readdirSync(seedDir).filter(f => f.endsWith('.jpg'));
  
  for (const file of files) {
    const filePath = path.join(seedDir, file);
    const fileBuffer = fs.readFileSync(filePath);
    
    // Upload to seed/ directory in the bucket
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(`seed/${file}`, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });
    
    if (error) {
      console.error(`❌ Failed to upload ${file}:`, error);
    } else {
      console.log(`✅ Uploaded: ${file}`);
    }
  }
  
  console.log('🎉 Seed images uploaded successfully!');
  console.log(`📸 Images are now available at: ${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/seed/`);
}

uploadSeedImages().catch(console.error);