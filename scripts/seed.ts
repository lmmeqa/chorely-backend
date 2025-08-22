import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import {
  homes, users, userHomes, chores, todoItems
} from '../src/db/schema'

const DATABASE_URL = process.env.DATABASE_URL!
if (!DATABASE_URL) throw new Error('DATABASE_URL not set')

const client = new pg.Client({ connectionString: DATABASE_URL })
await client.connect()
const db = drizzle(client)

// ---- Wipe (optional, safe for dev) ----
await db.delete(todoItems)
await db.delete(chores)
await db.delete(userHomes)
// users referenced by many FKs; delete after userHomes
await db.delete(users)
await db.delete(homes)

// ---- Seed ----
const [home] = await db.insert(homes).values({
  name: 'Demo Home',
  weeklyPointQuota: 150,
}).returning()

const demoEmail = 'demo@example.com'
const demoSupabaseId = '00000000-0000-0000-0000-000000000001' // replace in real env if you want

await db.insert(users).values({
  email: demoEmail,
  name: 'Demo User',
  supabaseUserId: demoSupabaseId,
  authUserId: demoSupabaseId,
  avatarUrl: null,
  lastProvider: 'seed',
  lastLogin: new Date(),
}).onConflictDoNothing()

await db.insert(userHomes).values({
  userEmail: demoEmail,
  homeId: home.id,
  points: 0,
})

// a couple demo chores
const [chore1] = await db.insert(chores).values({
  name: 'Do the dishes',
  description: 'Load, run, and unload the dishwasher',
  time: new Date(),
  icon: '🧽',
  status: 'unapproved',
  userEmail: demoEmail,       // nullable; leave null if you want unassigned
  homeId: home.id,
  points: 10,
}).returning()

await db.insert(chores).values({
  name: 'Vacuum living room',
  description: 'Vacuum under the couch and rug edges',
  time: new Date(),
  icon: '🧹',
  status: 'unapproved',
  userEmail: null,
  homeId: home.id,
  points: 15,
})

await db.insert(todoItems).values([
  { choreId: chore1.uuid, name: 'Load dishwasher', order: 0 },
  { choreId: chore1.uuid, name: 'Run cycle', order: 1 },
  { choreId: chore1.uuid, name: 'Unload dishes', order: 2 },
])

await client.end()
console.log('✓ Seed complete')
