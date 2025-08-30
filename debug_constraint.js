// Quick test to check if constraint works
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { disputes } = require('./dist/db/schema');

async function testConstraint() {
  const sql = postgres(process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/chorely');
  const db = drizzle(sql);

  try {
    // Insert first dispute
    const first = await db.insert(disputes).values({
      choreId: 'test-chore-uuid-123',
      disputerEmail: 'test@example.com',
      reason: 'test reason 1',
      status: 'pending'
    }).returning();
    console.log('First insert succeeded:', first[0].uuid);

    // Try to insert duplicate - should fail
    try {
      const second = await db.insert(disputes).values({
        choreId: 'test-chore-uuid-123',  // Same chore
        disputerEmail: 'test2@example.com',
        reason: 'test reason 2',
        status: 'pending'
      }).returning();
      console.log('ERROR: Second insert should have failed but succeeded:', second[0].uuid);
    } catch (err) {
      console.log('Good: Second insert failed as expected:', err.code, err.constraint);
    }

    // Cleanup
    await db.delete(disputes).where(disputes.choreId.eq('test-chore-uuid-123'));

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await sql.end();
  }
}

testConstraint();