import { Hono } from 'hono';
import { z } from 'zod';
import { dbFromEnv } from '../lib/db';
import { requireUser } from '../lib/auth';
import { disputes, disputeVotes, chores, userHomes } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { uploadImageToStorage } from '../lib/uploads';

export const disputesRoutes = new Hono();

const createDisputeSchema = z.object({
  choreId: z.string().uuid(),
  reason: z.string().min(1),
  imageUrl: z.string().url().optional(),
});

// POST /disputes → 201
disputesRoutes.post('/disputes', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const u = (c as any).get('user') as { email?: string };
  if (!u?.email) return c.json({ error: 'Unauthorized' }, 401);

  const ct = (c.req.header('content-type') || '').toLowerCase();
  let payload: { choreId: string; reason: string; imageUrl?: string } = { choreId: '', reason: '' };
  let uploadedUrl: string | undefined;

  if (ct.includes('multipart/form-data')) {
    const form: any = await c.req.parseBody().catch(() => ({}));
    payload.choreId = String(form?.choreId || '');
    payload.reason = String(form?.reason || '');
    const image: File | undefined = (form as any)?.image;
    if (image && (image as any).size > 0) {
      try {
        uploadedUrl = await uploadImageToStorage(image, {
          prefix: `proofs/disputes/${payload.choreId}`,
          filename: (image as any).name || 'photo.jpg',
          contentType: (image as any).type || 'image/jpeg',
        });
      } catch (e: any) {
        console.error('[dispute create] image upload failed:', e?.message || e);
      }
    }
  } else {
    const body = await c.req.json().catch(() => ({}));
    payload = createDisputeSchema.parse(body);
  }

  if (!payload.choreId) return c.json({ error: 'Missing choreId' }, 400);
  if (!payload.reason) return c.json({ error: 'Missing reason' }, 400);

  // Ensure chore exists + user is a member of the chore's home
  const [chore] = await db.select().from(chores).where(eq(chores.uuid, payload.choreId)).limit(1);
  if (!chore) return c.json({ error: 'Chore not found' }, 404);

  const [m] = await db
    .select({ userEmail: userHomes.userEmail })
    .from(userHomes)
    .where(and(eq(userHomes.homeId, chore.homeId), eq(userHomes.userEmail, u.email as string)))
    .limit(1);
  if (!m) return c.json({ error: 'Forbidden: not a member of this home' }, 403);

  const [row] = await db
    .insert(disputes)
    .values({
      choreId: payload.choreId,
      disputerEmail: u.email!,
      reason: payload.reason,
      imageUrl: uploadedUrl || payload.imageUrl || null,
      status: 'pending',
    })
    .returning();
  return c.json(row, 201);
});

// POST /disputes/:uuid/vote { vote: 'sustain'|'overrule' }
disputesRoutes.post('/disputes/:uuid/vote', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const u = (c as any).get('user') as { email?: string };
  if (!u?.email) return c.json({ error: 'auth email required' }, 400);
  const { uuid } = c.req.param();
  const { vote } = (await c.req.json().catch(() => ({}))) as { vote?: 'sustain' | 'overrule' };
  if (vote !== 'sustain' && vote !== 'overrule') return c.json({ error: 'invalid vote' }, 400);

  await db
    .insert(disputeVotes)
    .values({ disputeUuid: uuid, userEmail: u.email, vote, createdAt: new Date() as any })
    .onConflictDoUpdate({
      target: [disputeVotes.disputeUuid, disputeVotes.userEmail],
      set: { vote, createdAt: new Date() as any },
    });

  return c.body(null, 204);
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

// GET /disputes/:uuid → 200
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
  const [row] = await db
    .update(disputes)
    .set({ status: 'sustained', updatedAt: new Date() as any })
    .where(eq(disputes.uuid, uuid))
    .returning();
  if (!row) return c.json({ error: 'not found' }, 404);
  return c.body(null, 204);
});

// PATCH /disputes/:uuid/overrule
disputesRoutes.patch('/disputes/:uuid/overrule', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const { uuid } = c.req.param();
  const [row] = await db
    .update(disputes)
    .set({ status: 'overruled', updatedAt: new Date() as any })
    .where(eq(disputes.uuid, uuid))
    .returning();
  if (!row) return c.json({ error: 'not found' }, 404);
  return c.body(null, 204);
});