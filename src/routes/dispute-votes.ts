import { Hono } from 'hono';
import { requireUser } from '../lib/auth';
import { dbFromEnv } from '../lib/db';
import { disputes, disputeVotes, chores, userHomes } from '../db/schema';
import { and, count, eq } from 'drizzle-orm';

export const disputeVotesRoutes = new Hono();

disputeVotesRoutes.post('/dispute-votes/:disputeUuid/vote', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const u = (c as any).get('user') as { email?: string };
  if (!u?.email) return c.json({ error: 'Unauthorized' }, 401);
  const { disputeUuid } = c.req.param();
  const body = await c.req.json().catch(() => ({} as any));
  
  // Handle multiple vote formats: { choice: 'sustain' }, { vote: 'sustain' }, { sustain: true }, { overrule: true }
  let choice = '';
  if (body.choice) {
    choice = body.choice.toString().toLowerCase();
  } else if (body.vote) {
    choice = body.vote.toString().toLowerCase();
  } else if (body.sustain) {
    choice = 'sustain';
  } else if (body.overrule) {
    choice = 'overrule';
  }
  
  const actor = u.email; // authoritative identity - ignore any userEmail in body
  
  if (choice !== 'sustain' && choice !== 'overrule') return c.json({ error: 'invalid vote' }, 400);
  
  // Check if dispute exists and is still pending
  const [dispute] = await db.select().from(disputes).where(eq(disputes.uuid, disputeUuid));
  if (!dispute) return c.json({ error: 'dispute not found' }, 404);
  if (dispute.status !== 'pending') return c.json({ error: 'dispute already resolved' }, 409);
  
  // Get the chore to verify home membership
  const [chore] = await db.select().from(chores).where(eq(chores.uuid, dispute.choreId));
  if (!chore) return c.json({ error: 'chore not found' }, 404);
  
  // Check if user is a member of the home
  const [membership] = await db
    .select({ userEmail: userHomes.userEmail })
    .from(userHomes)
    .where(and(eq(userHomes.homeId, chore.homeId), eq(userHomes.userEmail, actor.toLowerCase())))
    .limit(1);
  if (!membership) return c.json({ error: 'forbidden' }, 403);
  
  // Record the vote
  await db.insert(disputeVotes).values({ disputeUuid, userEmail: actor.toLowerCase(), vote: choice }).onConflictDoUpdate({ target: [disputeVotes.disputeUuid, disputeVotes.userEmail], set: { vote: choice } });
  
  // Check if dispute should be automatically resolved
  try {
    if (!dispute || dispute.status !== 'pending') {
      return c.body(null, 204); // Already resolved or doesn't exist
    }
    
    if (!chore) return c.body(null, 204);
    
    // Calculate voting status
    const [{ cnt: totalEligibleVoters }] = await db.select({ cnt: count() }).from(userHomes).where(eq(userHomes.homeId, chore.homeId));
    const votes = await db.select().from(disputeVotes).where(eq(disputeVotes.disputeUuid, disputeUuid));
    const sustainVotes = votes.filter(r => r.vote === 'sustain').length;
    const overruleVotes = votes.filter(r => r.vote === 'overrule').length;
    const requiredVotes = Number(totalEligibleVoters) <= 1 ? 1 : Math.max(1, Math.ceil(Number(totalEligibleVoters) * 0.5));
    
    // Automatically resolve if threshold is reached
    if (sustainVotes >= requiredVotes) {
      // Sustain the dispute
      await db.update(disputes).set({ status: 'sustained', updatedAt: new Date() as any }).where(eq(disputes.uuid, disputeUuid));
      
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
          console.error('[auto dispute sustain] failed to revert chore or deduct points:', e);
        }
      }
    } else if (overruleVotes >= requiredVotes) {
      // Overrule the dispute
      await db.update(disputes).set({ status: 'overruled', updatedAt: new Date() as any }).where(eq(disputes.uuid, disputeUuid));
    }
  } catch (e) {
    console.error('[auto dispute resolution] failed:', e);
  }

  // Get updated dispute and vote counts for response
  const [updatedDispute] = await db.select().from(disputes).where(eq(disputes.uuid, disputeUuid));
  const votes = await db.select().from(disputeVotes).where(eq(disputeVotes.disputeUuid, disputeUuid));
  const sustainVotes = votes.filter(r => r.vote === 'sustain').length;
  const overruleVotes = votes.filter(r => r.vote === 'overrule').length;
  
  // Get total eligible voters (home members)
  const [{ cnt: totalMembers }] = chore ? 
    await db.select({ cnt: count() }).from(userHomes).where(eq(userHomes.homeId, chore.homeId)) :
    [{ cnt: 0 }];

  const isResolved = updatedDispute?.status === 'sustained' || updatedDispute?.status === 'overruled';
  const resolution = updatedDispute?.status === 'sustained' ? 'sustain' : 
                    updatedDispute?.status === 'overruled' ? 'overrule' : null;

  // Return 200 with vote status for successful vote recording
  return c.json({
    disputeUuid,
    resolved: isResolved,
    resolution,
    counts: {
      sustain: sustainVotes,
      overrule: overruleVotes,
      totalMembers: Number(totalMembers)
    }
  }, 200);
});

disputeVotesRoutes.delete('/dispute-votes/:disputeUuid/vote', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const u = (c as any).get('user') as { email?: string };
  if (!u?.email) return c.json({ error: 'Unauthorized' }, 401);
  const { disputeUuid } = c.req.param();
  await db.delete(disputeVotes).where(and(eq(disputeVotes.disputeUuid, disputeUuid), eq(disputeVotes.userEmail, u.email.toLowerCase())));
  return c.body(null, 204);
});

disputeVotesRoutes.get('/dispute-votes/:disputeUuid/status', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const { disputeUuid } = c.req.param();
  const [d] = await db.select().from(disputes).where(eq(disputes.uuid, disputeUuid));
  if (!d) return c.json({ error: 'not found' }, 404);
  const [ch] = await db.select().from(chores).where(eq(chores.uuid, d.choreId));
  if (!ch) return c.json({ error: 'chore not found' }, 404);
  const [{ cnt: totalEligibleVoters }] = await db.select({ cnt: count() }).from(userHomes).where(eq(userHomes.homeId, ch.homeId));
  const rows = await db.select().from(disputeVotes).where(eq(disputeVotes.disputeUuid, disputeUuid));
  const sustainVotes = rows.filter(r => r.vote === 'sustain').length;
  const overruleVotes = rows.filter(r => r.vote === 'overrule').length;
  const totalVotes = rows.length;
  const requiredVotes = Number(totalEligibleVoters) <= 1 ? 1 : Math.max(1, Math.ceil(Number(totalEligibleVoters) * 0.5));
  return c.json({
    dispute_uuid: disputeUuid,
    sustain_votes: sustainVotes,
    overrule_votes: overruleVotes,
    total_votes: totalVotes,
    required_votes: requiredVotes,
    total_eligible_voters: Number(totalEligibleVoters),
    is_sustained: sustainVotes >= requiredVotes,
    is_overruled: overruleVotes >= requiredVotes,
    voters: rows.map(r => ({ email: r.userEmail, vote: r.vote })),
  });
});

disputeVotesRoutes.get('/dispute-votes/:disputeUuid/user/:userEmail', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const { disputeUuid, userEmail } = c.req.param();
  const [row] = await db.select().from(disputeVotes).where(and(eq(disputeVotes.disputeUuid, disputeUuid), eq(disputeVotes.userEmail, decodeURIComponent(userEmail).toLowerCase())));
  return c.json({ vote: row?.vote ?? null });
});