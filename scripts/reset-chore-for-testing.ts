#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create admin client with service role key
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function resetChoreForTesting() {
  console.log('🔄 Resetting a chore for testing...');
  
  try {
    // Run a SQL query to reset one of the completed chores back to unclaimed
    const choreId = 'eb38994a-7a6e-47de-83ed-ed51e88797cb'; // "Wash Dishes" chore from our testing
    
    // Use RPC to run raw SQL since Supabase RLS might be preventing direct table access
    const { data, error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        UPDATE chores 
        SET status = 'unclaimed',
            user_email = NULL,
            photo_url = NULL,
            completed_at = NULL,
            claimed_at = NULL,
            updated_at = NOW()
        WHERE uuid = $1
      `,
      params: [choreId]
    });
    
    if (error) {
      console.error('❌ Error with RPC:', error);
      
      // Fallback: try direct SQL execution
      console.log('Trying direct SQL execution...');
      const { data: data2, error: error2 } = await supabaseAdmin
        .rpc('reset_chore_for_testing', { chore_id: choreId });
      
      if (error2) {
        console.error('❌ Fallback also failed:', error2);
        
        // Final fallback: try using the API endpoint
        console.log('Trying via staging API with admin token...');
        const adminToken = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const response = await fetch(`https://chorely-backend-staging.adityajain2204.workers.dev/admin/reset-chore/${choreId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          console.log('✅ Chore reset via API');
        } else {
          console.log('❌ API reset failed:', await response.text());
        }
        return;
      }
      
      console.log('✅ Chore reset via fallback');
    } else {
      console.log('✅ Chore reset via RPC');
    }
    
    console.log(`Chore ${choreId} should now be available for claiming`);
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

resetChoreForTesting().catch(console.error);