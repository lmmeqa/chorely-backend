// scripts/seed.ts
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { homes, users, userHomes, chores, todoItems, choreApprovals } from '../src/db/schema';

const DATABASE_URL = process.env.DATABASE_URL!;
if (!DATABASE_URL) throw new Error('DATABASE_URL not set');

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
const db = drizzle(client);

// Helpers
const minutesFromNow = (mins: number) => new Date(Date.now() + mins * 60_000);
const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60_000);
const img = (slug: string) => `/seed/${slug}.jpg`;

// Wipe in FK-safe order (dev only)
try { await db.execute('DELETE FROM dispute_votes'); } catch {}
try { await db.execute('DELETE FROM disputes'); } catch {}
try { await db.execute('DELETE FROM chore_approvals'); } catch {}
try { await db.execute('DELETE FROM todo_items'); } catch {}
try { await db.execute('DELETE FROM chores'); } catch {}
try { await db.execute('DELETE FROM user_homes'); } catch {}
try { await db.execute('DELETE FROM users'); } catch {}
try { await db.execute('DELETE FROM home'); } catch {}

// Demo users & home
const alice = { email: 'alice@demo.com', name: 'Alice' };
const bob   = { email: 'bob@demo.com',   name: 'Bob' };
const charlie = { email: 'charlie@demo.com', name: 'Charlie' };
await db.insert(users).values([alice, bob, charlie]);

const [home] = await db
  .insert(homes)
  .values({ name: 'Demo House', weeklyPointQuota: 120 })
  .returning();

await db.insert(userHomes).values([
  { userEmail: alice.email, homeId: home.id, points: 40 },
  { userEmail: bob.email,   homeId: home.id, points: 15 },
  { userEmail: charlie.email, homeId: home.id, points: 0 },
]);

// Chores with varied statuses
const [c1] = await db.insert(chores).values({
  name: 'Wash Dishes',
  description: 'Scrub and dry dishes from dinner.',
  time: minutesFromNow(30),
  icon: '🍽️',
  status: 'unclaimed',
  userEmail: alice.email,
  homeId: home.id,
  points: 20,
  claimedAt: hoursAgo(2),
}).returning();

const [c2] = await db.insert(chores).values({
  name: 'Vacuum Living Room',
  description: 'Vacuum under the couch and rug edges',
  time: minutesFromNow(60),
  icon: '🧹',
  status: 'complete',
  userEmail: bob.email,
  homeId: home.id,
  points: 15,
  completedAt: hoursAgo(1),
  photoUrl: img('organized-closet-wardrobe'),
}).returning();

const [c3] = await db.insert(chores).values({
  name: 'Laundry',
  description: 'Wash, dry, and fold one load of laundry.',
  time: minutesFromNow(90),
  icon: '👕',
  status: 'claimed',
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
  status: 'unapproved',
  userEmail: null,
  homeId: home.id,
  points: 10,
}).returning();

// Todo items for some chores
await db.insert(todoItems).values([
  { choreId: c1.uuid, name: 'Load dishwasher', order: 0 },
  { choreId: c1.uuid, name: 'Run cycle', order: 1 },
  { choreId: c1.uuid, name: 'Unload dishes', order: 2 },
  { choreId: c3.uuid, name: 'Wash', order: 0 },
  { choreId: c3.uuid, name: 'Dry', order: 1 },
  { choreId: c3.uuid, name: 'Fold', order: 2 },
]);

// Auto-approve an example chore
await db.insert(choreApprovals).values({ choreUuid: c4.uuid, userEmail: alice.email });

await client.end();
console.log('✓ Seed complete');