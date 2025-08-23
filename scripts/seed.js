"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// scripts/seed.ts
require("dotenv/config");
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = __importDefault(require("pg"));
const schema_1 = require("../src/db/schema");
async function main() {
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL)
        throw new Error('DATABASE_URL not set');
    const client = new pg_1.default.Client({ connectionString: DATABASE_URL });
    await client.connect();
    const db = (0, node_postgres_1.drizzle)(client);
    const minutesFromNow = (mins) => new Date(Date.now() + mins * 60_000);
    const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60_000);
    const img = (slug) => `/seed/${slug}.jpg`;
    try {
        await db.execute('DELETE FROM dispute_votes');
    }
    catch { }
    try {
        await db.execute('DELETE FROM disputes');
    }
    catch { }
    try {
        await db.execute('DELETE FROM chore_approvals');
    }
    catch { }
    try {
        await db.execute('DELETE FROM todo_items');
    }
    catch { }
    try {
        await db.execute('DELETE FROM chores');
    }
    catch { }
    try {
        await db.execute('DELETE FROM user_homes');
    }
    catch { }
    try {
        await db.execute('DELETE FROM users');
    }
    catch { }
    try {
        await db.execute('DELETE FROM home');
    }
    catch { }
    const alice = { email: 'alice@demo.com', name: 'Alice' };
    const bob = { email: 'bob@demo.com', name: 'Bob' };
    const charlie = { email: 'charlie@demo.com', name: 'Charlie' };
    await db.insert(schema_1.users).values([alice, bob, charlie]);
    const [home] = await db
        .insert(schema_1.homes)
        .values({ name: 'Demo House', weeklyPointQuota: 120 })
        .returning();
    await db.insert(schema_1.userHomes).values([
        { userEmail: alice.email, homeId: home.id, points: 40 },
        { userEmail: bob.email, homeId: home.id, points: 15 },
        { userEmail: charlie.email, homeId: home.id, points: 0 },
    ]);
    const [c1] = await db.insert(schema_1.chores).values({
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
    const [c2] = await db.insert(schema_1.chores).values({
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
    const [c3] = await db.insert(schema_1.chores).values({
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
    const [c4] = await db.insert(schema_1.chores).values({
        name: 'Take Out Trash',
        description: 'Empty all bins and take out the trash.',
        time: minutesFromNow(45),
        icon: '🗑️',
        status: 'unapproved',
        userEmail: null,
        homeId: home.id,
        points: 10,
    }).returning();
    await db.insert(schema_1.todoItems).values([
        { choreId: c1.uuid, name: 'Load dishwasher', order: 0 },
        { choreId: c1.uuid, name: 'Run cycle', order: 1 },
        { choreId: c1.uuid, name: 'Unload dishes', order: 2 },
        { choreId: c3.uuid, name: 'Wash', order: 0 },
        { choreId: c3.uuid, name: 'Dry', order: 1 },
        { choreId: c3.uuid, name: 'Fold', order: 2 },
    ]);
    await db.insert(schema_1.choreApprovals).values({ choreUuid: c4.uuid, userEmail: alice.email });
    await client.end();
    console.log('✓ Seed complete');
}
main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
