import { db } from '../../../src/db/models';

// Remove backend rows for given emails; does not touch Supabase auth users
export async function resetBackendForEmails(emails: string[]): Promise<void> {
  const lower = emails.map(e => e.toLowerCase());
  await db.transaction(async trx => {
    await trx('chore_approvals').whereIn('user_email', lower).del();
    await trx('disputes').whereIn('disputer_email', lower).del();
    await trx('user_homes').whereIn('user_email', lower).del();
    await trx('users').whereIn('email', lower).del();
  });
}

// Comprehensive cleanup for all test data created during a test run
export async function cleanupTestData(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('cleanupTestData called outside of test environment. Skipping.');
    return;
  }

  console.log('[cleanup] Cleaning up all test data...');
  
  await db.transaction(async (trx) => {
    // Clean up in order of foreign key dependencies
    // Only clean up tables that exist to avoid errors
    
    try {
      // 1. Clean up todo items (referenced by chores)
      await trx('todo_items').del();
    } catch (e: any) {
      if (e.code !== '42P01') throw e; // Ignore "relation does not exist"
    }
    
    try {
      // 2. Clean up chore approvals (referenced by chores)
      await trx('chore_approvals').del();
    } catch (e: any) {
      if (e.code !== '42P01') throw e;
    }
    
    try {
      // 3. Clean up dispute votes (referenced by disputes)
      await trx('dispute_votes').del();
    } catch (e: any) {
      if (e.code !== '42P01') throw e;
    }
    
    try {
      // 4. Clean up disputes (referenced by chores)
      await trx('disputes').del();
    } catch (e: any) {
      if (e.code !== '42P01') throw e;
    }
    
    try {
      // 5. Clean up chores (referenced by homes)
      await trx('chores').del();
    } catch (e: any) {
      if (e.code !== '42P01') throw e;
    }
    
    try {
      // 6. Clean up user_homes (referenced by users and homes)
      await trx('user_homes').del();
    } catch (e: any) {
      if (e.code !== '42P01') throw e;
    }
    
    try {
      // 7. Clean up users
      await trx('users').del();
    } catch (e: any) {
      if (e.code !== '42P01') throw e;
    }
    
    try {
      // 8. Clean up homes
      await trx('home').del();
    } catch (e: any) {
      if (e.code !== '42P01') throw e;
    }
    
    try {
      // 9. Clean up activities (if any)
      await trx('activities').del();
    } catch (e: any) {
      if (e.code !== '42P01') throw e;
    }
  });
  
  console.log('[cleanup] Test data cleanup complete.');
}


