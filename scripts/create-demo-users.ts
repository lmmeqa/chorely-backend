#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const DEMO_USERS = [
  { email: 'alice@demo.com', password: 'Password1!', name: 'Alice' },
  { email: 'bob@demo.com', password: 'Password1!', name: 'Bob' },
  { email: 'charlie@demo.com', password: 'Password1!', name: 'Charlie' },
  { email: 'diana@demo.com', password: 'Password1!', name: 'Diana' },
];

async function createDemoUsers() {
  console.log('Creating demo users in Supabase auth...');
  
  for (const user of DEMO_USERS) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { name: user.name }
      });
      
      if (error) {
        if (error.message.includes('already registered')) {
          console.log(`✅ ${user.email} already exists`);
        } else {
          console.error(`❌ Failed to create ${user.email}:`, error.message);
        }
      } else {
        console.log(`✅ Created ${user.email}`);
      }
    } catch (err) {
      console.error(`❌ Error creating ${user.email}:`, err);
    }
  }
  
  console.log('Demo user creation complete!');
}

createDemoUsers().catch(console.error);
