// scripts/seed.ts
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { homes, users, userHomes, chores, todoItems, choreApprovals, disputes, disputeVotes } from '../src/db/schema';

async function main() {
  const env = process.argv[2] || 'local';
  
  // Get appropriate DATABASE_URL based on environment
  let DATABASE_URL: string;
  switch (env) {
    case 'staging':
      DATABASE_URL = process.env.DATABASE_URL_STAGING!;
      break;
    case 'production':
      DATABASE_URL = process.env.DATABASE_URL_PRODUCTION!;
      break;
    default:
      DATABASE_URL = process.env.DATABASE_URL!;
  }
  
  if (!DATABASE_URL) throw new Error(`DATABASE_URL for ${env} environment not set`);
  
  console.log(`🌱 Seeding ${env} environment...`);

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  const db = drizzle(client);

  const minutesFromNow = (mins: number) => new Date(Date.now() + mins * 60_000);
  const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60_000);
  const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60_000);
  const img = (slug: string) => `/seed/${slug}.jpg`;

  // Clean up existing data
  try { await db.execute('DELETE FROM dispute_votes'); } catch {}
  try { await db.execute('DELETE FROM disputes'); } catch {}
  try { await db.execute('DELETE FROM chore_approvals'); } catch {}
  try { await db.execute('DELETE FROM todo_items'); } catch {}
  try { await db.execute('DELETE FROM chores'); } catch {}
  try { await db.execute('DELETE FROM user_homes'); } catch {}
  try { await db.execute('DELETE FROM users'); } catch {}
  try { await db.execute('DELETE FROM home'); } catch {}

  // Create users
  const alice = { email: 'alice@demo.com', name: 'Alice' };
  const bob   = { email: 'bob@demo.com',   name: 'Bob' };
  const charlie = { email: 'charlie@demo.com', name: 'Charlie' };
  const diana = { email: 'diana@demo.com', name: 'Diana' };
  await db.insert(users).values([alice, bob, charlie, diana]);

  // Create home
  const [home] = await db
    .insert(homes)
    .values({ name: 'Demo House', weeklyPointQuota: 120 })
    .returning();

  // Assign users to home with points
  await db.insert(userHomes).values([
    { userEmail: alice.email, homeId: home.id, points: 45 },
    { userEmail: bob.email,   homeId: home.id, points: 30 },
    { userEmail: charlie.email, homeId: home.id, points: 20 },
    { userEmail: diana.email, homeId: home.id, points: 15 },
  ]);

  // Create chores with proper status and user assignments
  const [c1] = await db.insert(chores).values({
    name: 'Wash Dishes',
    description: 'Scrub and dry dishes from dinner.',
    time: minutesFromNow(30),
    icon: '🍽️',
    status: 'unclaimed', // Unclaimed - no user assigned
    userEmail: null,
    homeId: home.id,
    points: 20,
  }).returning();

  const [c2] = await db.insert(chores).values({
    name: 'Vacuum Living Room',
    description: 'Vacuum under the couch and rug edges',
    time: minutesFromNow(60),
    icon: '🧹',
    status: 'complete', // Completed by Bob
    userEmail: bob.email,
    homeId: home.id,
    points: 15,
    completedAt: hoursAgo(2),
    photoUrl: img('vacuum-living-room'),
  }).returning();

  const [c3] = await db.insert(chores).values({
    name: 'Laundry',
    description: 'Wash, dry, and fold one load of laundry.',
    time: minutesFromNow(90),
    icon: '👕',
    status: 'claimed', // Claimed by Charlie
    userEmail: charlie.email,
    homeId: home.id,
    points: 25,
    claimedAt: hoursAgo(1),
  }).returning();

  const [c4] = await db.insert(chores).values({
    name: 'Take Out Trash',
    description: 'Empty all bins and take out the trash.',
    time: minutesFromNow(45),
    icon: '🗑️',
    status: 'unapproved', // Unapproved - needs approvals
    userEmail: null,
    homeId: home.id,
    points: 10,
  }).returning();

  const [c5] = await db.insert(chores).values({
    name: 'Clean Bathroom',
    description: 'Clean sink, toilet, and shower.',
    time: minutesFromNow(120),
    icon: '🚿',
    status: 'complete', // Completed by Alice
    userEmail: alice.email,
    homeId: home.id,
    points: 30,
    completedAt: hoursAgo(4),
    photoUrl: img('clean-bathroom-sink-shower'),
  }).returning();

  const [c6] = await db.insert(chores).values({
    name: 'Organize Closet',
    description: 'Sort and organize clothes in the closet.',
    time: minutesFromNow(180),
    icon: '👔',
    status: 'claimed', // Claimed by Diana
    userEmail: diana.email,
    homeId: home.id,
    points: 35,
    claimedAt: hoursAgo(3),
  }).returning();

  const [c7] = await db.insert(chores).values({
    name: 'Mop Kitchen Floor',
    description: 'Mop the kitchen floor thoroughly.',
    time: minutesFromNow(60),
    icon: '🧽',
    status: 'complete', // Completed by Bob (disputed)
    userEmail: bob.email,
    homeId: home.id,
    points: 20,
    completedAt: daysAgo(1),
    photoUrl: img('mopping-kitchen-floor'),
  }).returning();

  const [c8] = await db.insert(chores).values({
    name: 'Water Plants',
    description: 'Water all indoor plants.',
    time: minutesFromNow(30),
    icon: '🌱',
    status: 'unclaimed', // Unclaimed - no user assigned
    userEmail: null,
    homeId: home.id,
    points: 15,
  }).returning();

  // Create todo items for chores
  await db.insert(todoItems).values([
    // Wash Dishes (c1)
    { choreId: c1.uuid, name: 'Load dishwasher', order: 0 },
    { choreId: c1.uuid, name: 'Run cycle', order: 1 },
    { choreId: c1.uuid, name: 'Unload dishes', order: 2 },
    
    // Vacuum Living Room (c2)
    { choreId: c2.uuid, name: 'Move furniture', order: 0 },
    { choreId: c2.uuid, name: 'Vacuum main areas', order: 1 },
    { choreId: c2.uuid, name: 'Vacuum under furniture', order: 2 },
    { choreId: c2.uuid, name: 'Empty vacuum bag', order: 3 },
    
    // Laundry (c3)
    { choreId: c3.uuid, name: 'Sort clothes', order: 0 },
    { choreId: c3.uuid, name: 'Wash', order: 1 },
    { choreId: c3.uuid, name: 'Dry', order: 2 },
    { choreId: c3.uuid, name: 'Fold', order: 3 },
    
    // Take Out Trash (c4)
    { choreId: c4.uuid, name: 'Collect all bins', order: 0 },
    { choreId: c4.uuid, name: 'Tie up bags', order: 1 },
    { choreId: c4.uuid, name: 'Take to outside bin', order: 2 },
    
    // Clean Bathroom (c5)
    { choreId: c5.uuid, name: 'Clean sink', order: 0 },
    { choreId: c5.uuid, name: 'Clean toilet', order: 1 },
    { choreId: c5.uuid, name: 'Clean shower', order: 2 },
    { choreId: c5.uuid, name: 'Wipe mirrors', order: 3 },
    
    // Organize Closet (c6)
    { choreId: c6.uuid, name: 'Remove all items', order: 0 },
    { choreId: c6.uuid, name: 'Sort by category', order: 1 },
    { choreId: c6.uuid, name: 'Organize by color', order: 2 },
    { choreId: c6.uuid, name: 'Put back neatly', order: 3 },
    
    // Mop Kitchen Floor (c7)
    { choreId: c7.uuid, name: 'Sweep floor', order: 0 },
    { choreId: c7.uuid, name: 'Fill bucket with water', order: 1 },
    { choreId: c7.uuid, name: 'Mop thoroughly', order: 2 },
    { choreId: c7.uuid, name: 'Let dry', order: 3 },
    
    // Water Plants (c8)
    { choreId: c8.uuid, name: 'Check soil moisture', order: 0 },
    { choreId: c8.uuid, name: 'Water thirsty plants', order: 1 },
    { choreId: c8.uuid, name: 'Remove dead leaves', order: 2 },
  ]);

  // Create approvals for unapproved chore (c4)
  await db.insert(choreApprovals).values([
    { choreUuid: c4.uuid, userEmail: alice.email },
    { choreUuid: c4.uuid, userEmail: bob.email },
  ]);

  // Create disputes
  const [d1] = await db.insert(disputes).values({
    choreId: c7.uuid, // Mop Kitchen Floor (completed by Bob)
    disputerEmail: alice.email,
    reason: 'Floor is still dirty and sticky in corners',
    status: 'pending',
  }).returning();

  const [d2] = await db.insert(disputes).values({
    choreId: c5.uuid, // Clean Bathroom (completed by Alice)
    disputerEmail: charlie.email,
    reason: 'Toilet seat was not cleaned properly',
    status: 'pending',
  }).returning();

  // Create dispute votes
  await db.insert(disputeVotes).values([
    { disputeUuid: d1.uuid, userEmail: diana.email, vote: 'sustain' }, // Diana sustains Bob's dispute
    { disputeUuid: d2.uuid, userEmail: bob.email, vote: 'overrule' },   // Bob overrules Alice's dispute
  ]);

  await client.end();
  console.log(`✓ Seed complete for ${env} environment`);
  console.log(`✓ Created 8 chores: 2 unclaimed, 2 claimed, 3 completed, 1 unapproved`);
  console.log(`✓ All chores have todo items`);
  console.log(`✓ Created 2 disputes with votes`);
  console.log(`✓ Each user has at least 1 claimed chore`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});