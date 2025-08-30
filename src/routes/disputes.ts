import { Hono } from 'hono';
import { z } from 'zod';
import { dbFromEnv } from '../lib/db';
import { requireUser } from '../lib/auth';
import { disputes, disputeVotes, chores, userHomes, homes, statusEvents } from '../db/schema';
import { eq, desc, and, count } from 'drizzle-orm';
import { uploadToStorageReturnPath, createSignedUrlForPath, isStoragePath } from '../lib/uploads';
import { requireUuidParam, ensureFound } from '../middleware/validators';
import { DisputeCreate, parseDisputeCreate } from '../schemas/disputes';
import { isUuidLoose } from '../http/validators';
import * as crypto from 'crypto';

export const disputesRoutes = new Hono();



// POST /disputes → 201
disputesRoutes.post('/disputes', requireUser, async (c) => {
  console.log('[disputes] POST /disputes start, user:', (c as any).get('user')?.email);
  const db = dbFromEnv(c.env as any);
  const u = (c as any).get('user') as { email?: string } | null;
  if (!u?.email) return c.json({ error: 'Unauthorized' }, 401);

  // Validate input FIRST (before any DB operations)
  const body = await c.req.json().catch(() => ({}));
  const parsed = parseDisputeCreate(body);
  if ('error' in parsed) return c.json({ error: parsed.error }, parsed.status as any);

  const { choreId, reason } = parsed;

  // Find chore and home
  const chore = await db.select().from(chores).where(eq(chores.uuid, choreId)).limit(1);
  const row = chore[0];
  if (!row) return c.json({ error: 'chore not found' }, 404);

  // Membership check
  const [m] = await db
    .select({ userEmail: userHomes.userEmail })
    .from(userHomes)
    .where(and(eq(userHomes.homeId, row.homeId), eq(userHomes.userEmail, u.email as string)))
    .limit(1);
  if (!m) return c.json({ error: 'forbidden' }, 403);

  // Create dispute - let database constraint handle duplicates atomically
  try {
    console.log('[disputes] About to insert dispute for chore:', choreId, 'user:', u.email);
    const created = await db.insert(disputes)
      .values({ 
        choreId: choreId, 
        disputerEmail: u.email, 
        reason
      })
      .returning();
    console.log('[disputes] Insert successful:', created[0].uuid);
    return c.json(created[0], 201);
  } catch (err: any) {
    console.log('[disputes] Insert error caught:', {
      code: err?.code,
      constraint: err?.constraint,
      message: err?.message,
      sqlState: err?.sqlState,
      detail: err?.detail,
      cause: err?.cause?.code || err?.cause?.constraint
    });
    
    // Check for PostgreSQL unique constraint violation (23505)
    const isConstraintViolation = err?.code === '23505' || 
                                 err?.cause?.code === '23505' ||
                                 err?.message?.includes('unique constraint') ||
                                 err?.message?.includes('idx_disputes_open_unique');
    
    if (isConstraintViolation) {
      console.log('[disputes] Constraint violation detected - returning 409');
      return c.json({ error: 'DUPLICATE_DISPUTE' }, 409);
    }
    throw err;
  }
});

// POST /disputes/:uuid/vote { vote: 'sustain'|'overrule' }
disputesRoutes.post('/disputes/:uuid/vote', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const u = (c as any).get('user') as { email?: string } | null;
  if (!u?.email) return c.json({ error: 'auth email required' }, 400);
  const { uuid } = c.req.param();
  const { vote } = (await c.req.json().catch(() => ({}))) as { vote?: 'sustain' | 'overrule' };
  if (vote !== 'sustain' && vote !== 'overrule') return c.json({ error: 'invalid vote' }, 400);

  // Record the vote
  await db
    .insert(disputeVotes)
    .values({ disputeUuid: uuid, userEmail: u.email, vote, createdAt: new Date() as any })
    .onConflictDoUpdate({
      target: [disputeVotes.disputeUuid, disputeVotes.userEmail],
      set: { vote, createdAt: new Date() as any },
    });

  // Check if dispute should be automatically resolved (same logic as dispute-votes route)
  try {
    const [dispute] = await db.select().from(disputes).where(eq(disputes.uuid, uuid));
    if (!dispute || dispute.status !== 'pending') {
      return c.body(null, 204); // Already resolved or doesn't exist
    }
    
    const [chore] = await db.select().from(chores).where(eq(chores.uuid, dispute.choreId));
    if (!chore) return c.body(null, 204);
    
    // Calculate voting status
    const [{ cnt: totalEligibleVoters }] = await db.select({ cnt: count() }).from(userHomes).where(eq(userHomes.homeId, chore.homeId));
    const votes = await db.select().from(disputeVotes).where(eq(disputeVotes.disputeUuid, uuid));
    const sustainVotes = votes.filter(r => r.vote === 'sustain').length;
    const overruleVotes = votes.filter(r => r.vote === 'overrule').length;
    const requiredVotes = Number(totalEligibleVoters) <= 1 ? 1 : Math.max(1, Math.ceil(Number(totalEligibleVoters) * 0.5));
    
    // Automatically resolve if threshold is reached
    if (sustainVotes >= requiredVotes) {
      console.log(`[auto dispute resolution] Sustaining dispute ${uuid} with ${sustainVotes}/${requiredVotes} votes`);
      // Sustain the dispute
      await db.update(disputes).set({ status: 'sustained', updatedAt: new Date() as any }).where(eq(disputes.uuid, uuid));
      
      // If chore is completed, revert it back to claimed and deduct points
      if (chore.status === 'complete' && chore.userEmail) {
        try {
          console.log(`[auto dispute resolution] Reverting chore ${chore.uuid} from complete to claimed`);
          // Revert chore status back to claimed
          await db
            .update(chores)
            .set({ status: 'claimed', completedAt: null, updatedAt: new Date() as any })
            .where(eq(chores.uuid, dispute.choreId));
          
          // Deduct points from the user
          const pointsToDeduct = chore.points;
          const [userHome] = await db
            .select()
            .from(userHomes)
            .where(and(eq(userHomes.homeId, chore.homeId), eq(userHomes.userEmail, chore.userEmail)))
            .limit(1);
          
          if (userHome) {
            console.log(`[auto dispute resolution] Deducting ${pointsToDeduct} points from ${chore.userEmail}`);
            await db
              .update(userHomes)
              .set({ points: Math.max(0, userHome.points - pointsToDeduct) })
              .where(and(eq(userHomes.homeId, chore.homeId), eq(userHomes.userEmail, chore.userEmail)));
          }
        } catch (e) {
          console.error('[auto dispute sustain] failed to revert chore or deduct points:', e);
        }
      }
    } else if (overruleVotes >= requiredVotes) {
      console.log(`[auto dispute resolution] Overruling dispute ${uuid} with ${overruleVotes}/${requiredVotes} votes`);
      // Overrule the dispute
      await db.update(disputes).set({ status: 'overruled', updatedAt: new Date() as any }).where(eq(disputes.uuid, uuid));
    }
  } catch (e) {
    console.error('[auto dispute resolution] failed:', e);
  }

  return c.body(null, 204);
});

// Helper to sign a dispute row on the fly
async function withSignedDispute(row: any, env?: any) {
  if (row?.imageUrl && isStoragePath(row.imageUrl)) {
    try {
      const url = await createSignedUrlForPath(row.imageUrl, { env });
      return { ...row, imageUrl: url };
    } catch {
      return row;
    }
  }
  // For local seed paths (starting with /seed/), pass through unchanged
  return row;
}

// GET /disputes?homeId=...&status=pending → 200, 400 if missing  
disputesRoutes.get('/disputes', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const u = (c as any).get('user') as { email?: string } | null;
  
  const homeId = c.req.query('homeId');
  const status = c.req.query('status'); // Optional status filter
  
  if (!homeId) return c.json({ error: 'homeId required' }, 400);
  if (!isUuidLoose(homeId)) return c.json({ error: 'malformed homeId' }, 400);

  const home = await db.select().from(homes).where(eq(homes.id, homeId)).limit(1);
  if (!home[0]) return c.json({ error: 'home not found' }, 404);

  const isMember = await db
    .select({ userEmail: userHomes.userEmail })
    .from(userHomes)
    .where(and(eq(userHomes.homeId, homeId), eq(userHomes.userEmail, (u?.email || '') as string)))
    .limit(1);
  if (!isMember[0]) return c.json({ error: 'forbidden' }, 403);

  // Build where condition - filter by home and optionally by status
  const whereConditions = [eq(chores.homeId, homeId)];
  if (status && ['pending', 'sustained', 'overruled'].includes(status)) {
    whereConditions.push(eq(disputes.status, status as any));
  }

  // Filter disputes by home via join to chores
  const rows = await db
    .select({
      uuid: disputes.uuid,
      choreId: disputes.choreId,
      disputerEmail: disputes.disputerEmail,
      reason: disputes.reason,
      imageUrl: disputes.imageUrl,
      status: disputes.status,
      createdAt: disputes.createdAt,
      updatedAt: disputes.updatedAt,
      // Include chore information
      chore_name: chores.name,
      chore_description: chores.description,
      chore_icon: chores.icon,
      chore_user_email: chores.userEmail,
      chore_photo_url: chores.photoUrl,
      chore_points: chores.points,
    })
    .from(disputes)
    .innerJoin(chores, eq(disputes.choreId, chores.uuid))
    .where(whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions))
    .orderBy(desc(disputes.createdAt));

  const signed = await Promise.all(rows.map(row => withSignedDispute(row, c.env)));
  return c.json(signed);
});

// GET /disputes/:uuid → 200
disputesRoutes.get('/disputes/:uuid', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const u = (c as any).get('user') as { email?: string } | null;
  
  const id = c.req.param('uuid');
  if (!isUuidLoose(id)) {
    return c.json({ error: 'uuid must be UUID' }, 400);
  }
  
  const [row] = await db.select().from(disputes).where(eq(disputes.uuid, id)).limit(1);
  if (!row) return c.json({ error: 'dispute not found' }, 404);

  // Get the chore to check home membership
  const [chore] = await db.select().from(chores).where(eq(chores.uuid, row.choreId)).limit(1);
  if (!chore) return c.json({ error: 'chore not found' }, 404);

  // Membership check
  const [m] = await db
    .select({ userEmail: userHomes.userEmail })
    .from(userHomes)
    .where(and(eq(userHomes.homeId, chore.homeId), eq(userHomes.userEmail, (u?.email || '') as string)))
    .limit(1);
  if (!m) return c.json({ error: 'forbidden' }, 403);

  const signed = await withSignedDispute(row, c.env);
  return c.json(signed);
});

// PATCH /disputes/:uuid/sustain
disputesRoutes.patch('/disputes/:uuid/sustain', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const { uuid } = c.req.param();
  const user = (c as any).get('user') as { email?: string };
  
  // Get the dispute and associated chore
  const [dispute] = await db.select().from(disputes).where(eq(disputes.uuid, uuid)).limit(1);
  if (!dispute) return c.json({ error: 'not found' }, 404);
  if (dispute.status !== 'pending') return c.json({ error: 'dispute already closed' }, 409);
  
  const [chore] = await db.select().from(chores).where(eq(chores.uuid, dispute.choreId)).limit(1);
  if (!chore) return c.json({ error: 'chore not found' }, 404);
  
  // Update dispute status to sustained
  await db
    .update(disputes)
    .set({ status: 'sustained', updatedAt: new Date() as any })
    .where(eq(disputes.uuid, uuid));
  
  // If chore is completed, revert it back to claimed and deduct points
  if (chore.status === 'complete' && chore.userEmail) {
    try {
      // Revert chore status back to claimed
      await db
        .update(chores)
        .set({ status: 'claimed', completedAt: null, updatedAt: new Date() as any })
        .where(eq(chores.uuid, dispute.choreId));
      
      // Emit STATUS_CHANGED event for sustain → revert to claimed
      await db.insert(statusEvents).values({
        uuid: crypto.randomUUID(),
        homeId: chore.homeId,
        choreUuid: dispute.choreId,
        type: 'STATUS_CHANGED',
        newStatus: 'claimed',
        actorEmail: user.email!,
        ts: new Date(),
      });
      
      // Deduct points from the user
      const pointsToDeduct = chore.points;
      const [userHome] = await db
        .select()
        .from(userHomes)
        .where(and(eq(userHomes.homeId, chore.homeId), eq(userHomes.userEmail, chore.userEmail)))
        .limit(1);
      
      if (userHome) {
        await db
          .update(userHomes)
          .set({ points: Math.max(0, userHome.points - pointsToDeduct) })
          .where(and(eq(userHomes.homeId, chore.homeId), eq(userHomes.userEmail, chore.userEmail)));
      }
    } catch (e) {
      console.error('[dispute sustain] failed to revert chore or deduct points:', e);
    }
  }
  
  return c.body(null, 204);
});

// PATCH /disputes/:uuid/overrule
disputesRoutes.patch('/disputes/:uuid/overrule', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const { uuid } = c.req.param();
  const user = (c as any).get('user') as { email?: string };
  
  // Get the dispute and associated chore
  const [dispute] = await db.select().from(disputes).where(eq(disputes.uuid, uuid)).limit(1);
  if (!dispute) return c.json({ error: 'not found' }, 404);
  if (dispute.status !== 'pending') return c.json({ error: 'dispute already closed' }, 409);
  
  const [chore] = await db.select().from(chores).where(eq(chores.uuid, dispute.choreId)).limit(1);
  if (!chore) return c.json({ error: 'chore not found' }, 404);
  
  // Update dispute status to overruled
  await db
    .update(disputes)
    .set({ status: 'overruled', updatedAt: new Date() as any })
    .where(eq(disputes.uuid, uuid));
  
  // Emit STATUS_CHANGED event for overrule → keep complete
  await db.insert(statusEvents).values({
    uuid: crypto.randomUUID(),
    homeId: chore.homeId,
    choreUuid: dispute.choreId,
    type: 'STATUS_CHANGED',
    newStatus: 'complete',
    actorEmail: user.email!,
    ts: new Date(),
  });
  
  return c.body(null, 204);
});