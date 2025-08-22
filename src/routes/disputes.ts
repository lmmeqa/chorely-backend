import { Hono } from 'hono';
import { z } from 'zod';
import { dbFromEnv } from '../lib/db';
import { requireUser } from '../lib/auth';
import { disputes, disputeVotes, chores } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';

export const disputesRoutes = new Hono();

const createDisputeSchema = z.object({ choreId: z.string().uuid(), reason: z.string().min(1), imageUrl: z.string().url().optional() });

// POST /disputes → 201
disputesRoutes.post('/disputes', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const u = c.get('user') as { email?: string };
  if (!u?.email) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json().catch(() => ({}));
  const data = createDisputeSchema.parse(body);
  const [row] = await db.insert(disputes).values({ choreId: data.choreId, disputerEmail: u.email, reason: data.reason, imageUrl: data.imageUrl ?? null, status: 'pending' }).returning();
  return c.json(row, 201);
});

// POST /disputes/:uuid/vote { vote: 'sustain'|'overrule' }
disputesRoutes.post('/disputes/:uuid/vote', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const u = c.get('user') as { email?: string };
  if (!u?.email) return c.json({ error: 'auth email required' }, 400);
  const { uuid } = c.req.param();
  const { vote } = (await c.req.json()) as { vote: 'sustain' | 'overrule' };
  if (vote !== 'sustain' && vote !== 'overrule') return c.json({ error: 'invalid vote' }, 400);
  const [row] = await db.insert(disputeVotes).values({ disputeUuid: uuid, userEmail: u.email, vote }).onConflictDoUpdate({ target: [disputeVotes.disputeUuid, disputeVotes.userEmail], set: { vote } }).returning();
  return c.json({ vote: row });
});

// GET /disputes?homeId=...&status=...
disputesRoutes.get('/disputes', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const homeId = c.req.query('homeId');
  const status = c.req.query('status');
  
  if (!homeId) {
    return c.json({ error: 'homeId required' }, 400);
  }
  
  // Query disputes for the specific home
  let query = db
    .select({
      uuid: disputes.uuid,
      choreId: disputes.choreId,
      disputerEmail: disputes.disputerEmail,
      reason: disputes.reason,
      imageUrl: disputes.imageUrl,
      status: disputes.status,
      createdAt: disputes.createdAt,
    })
    .from(disputes)
    .innerJoin(chores, eq(disputes.choreId, chores.uuid))
    .where(eq(chores.homeId, homeId))
    .orderBy(desc(disputes.createdAt));
    
  const rows = await query;
    
  return c.json(rows);
});

// GET /disputes/:uuid
disputesRoutes.get('/disputes/:uuid', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const { uuid } = c.req.param();
  const [row] = await db.select().from(disputes).where(eq(disputes.uuid, uuid)).limit(1);
  if (!row) return c.json({ error: 'not found' }, 404);
  return c.json(row);
});

// PATCH /disputes/:uuid/sustain
disputesRoutes.patch('/disputes/:uuid/sustain', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const { uuid } = c.req.param();
  const [row] = await db.update(disputes).set({ status: 'sustained', updatedAt: new Date() as any }).where(eq(disputes.uuid, uuid)).returning();
  if (!row) return c.json({ error: 'not found' }, 404);
  return c.body(null, 204);
});

// PATCH /disputes/:uuid/overrule
disputesRoutes.patch('/disputes/:uuid/overrule', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const { uuid } = c.req.param();
  const [row] = await db.update(disputes).set({ status: 'overruled', updatedAt: new Date() as any }).where(eq(disputes.uuid, uuid)).returning();
  if (!row) return c.json({ error: 'not found' }, 404);
  return c.body(null, 204);
});