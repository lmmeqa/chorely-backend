import { Hono } from 'hono';
import { z } from 'zod';
import { dbFromEnv } from '../lib/db';
import { requireUser } from '../lib/auth';
import { disputes, disputeVotes, chores, userHomes } from '../db/schema';
import { eq, desc, and, count } from 'drizzle-orm';
import { uploadToStorageReturnPath, createSignedUrlForPath, isStoragePath } from '../lib/uploads';

export const disputesRoutes = new Hono();

const createDisputeSchema = z.object({
  choreId: z.string().uuid(),
  reason: z.string().min(1),
  imageUrl: z.string().url().optional(),
});

// POST /disputes → 201
disputesRoutes.post('/disputes', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const u = (c as any).get('user') as { email?: string } | null;
  if (!u?.email) return c.json({ error: 'Unauthorized' }, 401);

  const ct = (c.req.header('content-type') || '').toLowerCase();
  let payload: { choreId: string; reason: string; imageUrl?: string } = { choreId: '', reason: '' };
  let uploadedPath: string | undefined;

  if (ct.includes('multipart/form-data')) {
    console.log('[dispute create] Processing multipart form data');
    const form: any = await c.req.parseBody().catch(() => ({}));
    console.log('[dispute create] Parsed form keys:', Object.keys(form || {}));
    console.log('[dispute create] Form choreId:', form?.choreId);
    console.log('[dispute create] Form reason:', form?.reason);
    payload.choreId = String(form?.choreId || '');
    payload.reason = String(form?.reason || '');
    const image: File | undefined = (form as any)?.image;
    if (image && (image as any).size > 0) {
      try {
        uploadedPath = await uploadToStorageReturnPath(image, {
          prefix: `proofs/disputes/${payload.choreId}`,
          filename: (image as any).name || 'photo.jpg',
          contentType: (image as any).type || 'image/jpeg',
        });
      } catch (e: any) {
        console.error('[dispute create] image upload failed:', e?.message || e);
      }
    }
  } else {
    console.log('[dispute create] Processing JSON data');
    const body = await c.req.json().catch(() => ({}));
    console.log('[dispute create] JSON body:', body);
    
    // Handle base64 image format (same as chore completion)
    if (body.image && body.image.data) {
      console.log('[dispute create] Processing base64 image data');
      console.log('[dispute create] Base64 data length:', body.image.data.length, 'chars');
      
      try {
        // Decode base64 to binary
        const binaryString = atob(body.image.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        console.log('[dispute create] Decoded binary data - size:', bytes.length, 'bytes');
        
        // Check if it's a valid JPEG
        const firstBytes = bytes.slice(0, 20);
        console.log('[dispute create] First 20 bytes (hex):', Array.from(firstBytes).map(b => b.toString(16).padStart(2, '0')).join(''));
        console.log('[dispute create] Starts with JPEG marker:', firstBytes[0] === 0xFF && firstBytes[1] === 0xD8);
        
        // Upload to storage
        uploadedPath = await uploadToStorageReturnPath(bytes, {
          prefix: `proofs/disputes/${body.choreId}`,
          filename: body.image.filename || 'dispute.jpg',
          contentType: body.image.contentType || 'image/jpeg',
        });
        console.log('[dispute create] Base64 image uploaded successfully to:', uploadedPath);
      } catch (e: any) {
        console.error('[dispute create] base64 image upload failed:', e?.message || e);
      }
    }
    
    // Extract basic fields
    payload.choreId = body.choreId || '';
    payload.reason = body.reason || '';
    payload.imageUrl = body.imageUrl;
  }

  console.log('[dispute create] Final payload:', payload);
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
      imageUrl: uploadedPath || payload.imageUrl || null, // store path if we uploaded, else external URL
      status: 'pending',
    })
    .returning();
  return c.json(row, 201);
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
async function withSignedDispute(row: any) {
  if (row?.imageUrl && isStoragePath(row.imageUrl)) {
    try {
      const url = await createSignedUrlForPath(row.imageUrl);
      return { ...row, imageUrl: url };
    } catch {
      return row;
    }
  }
  return row;
}

// GET /disputes?homeId=...&status=pending → 200, 400 if missing
disputesRoutes.get('/disputes', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const u = (c as any).get('user') as { email?: string } | null;
  const homeId = c.req.query('homeId');
  const status = c.req.query('status'); // Optional status filter
  if (!homeId) return c.json({ error: 'homeId required' }, 400);

  // Membership guard
  const [m] = await db
    .select({ userEmail: userHomes.userEmail })
    .from(userHomes)
    .where(and(eq(userHomes.homeId, homeId), eq(userHomes.userEmail, (u?.email || '') as string)))
    .limit(1);
  if (!m) return c.json({ error: 'Forbidden: not a member of this home' }, 403);

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

  const signed = await Promise.all(rows.map(withSignedDispute));
  return c.json(signed);
});

// GET /disputes/:uuid → 200
disputesRoutes.get('/disputes/:uuid', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const { uuid } = c.req.param();
  const [row] = await db.select().from(disputes).where(eq(disputes.uuid, uuid)).limit(1);
  if (!row) return c.json({ error: 'not found' }, 404);
  const signed = await withSignedDispute(row);
  return c.json(signed);
});

// PATCH /disputes/:uuid/sustain
disputesRoutes.patch('/disputes/:uuid/sustain', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const { uuid } = c.req.param();
  
  // Get the dispute and associated chore
  const [dispute] = await db.select().from(disputes).where(eq(disputes.uuid, uuid)).limit(1);
  if (!dispute) return c.json({ error: 'not found' }, 404);
  
  const [chore] = await db.select().from(chores).where(eq(chores.uuid, dispute.choreId)).limit(1);
  if (!chore) return c.json({ error: 'chore not found' }, 404);
  
  // Update dispute status to sustained
  const [row] = await db
    .update(disputes)
    .set({ status: 'sustained', updatedAt: new Date() as any })
    .where(eq(disputes.uuid, uuid))
    .returning();
  
  // If chore is completed, revert it back to claimed and deduct points
  if (chore.status === 'complete' && chore.userEmail) {
    try {
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
  const [row] = await db
    .update(disputes)
    .set({ status: 'overruled', updatedAt: new Date() as any })
    .where(eq(disputes.uuid, uuid))
    .returning();
  if (!row) return c.json({ error: 'not found' }, 404);
  return c.body(null, 204);
});