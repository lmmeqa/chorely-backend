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
  const vote = (body.vote as 'sustain'|'overrule') || null;
  if (vote !== 'sustain' && vote !== 'overrule') return c.json({ error: 'invalid vote' }, 400);
  await db.insert(disputeVotes).values({ disputeUuid, userEmail: u.email.toLowerCase(), vote }).onConflictDoUpdate({ target: [disputeVotes.disputeUuid, disputeVotes.userEmail], set: { vote } });
  return c.body(null, 204);
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
  });
});

disputeVotesRoutes.get('/dispute-votes/:disputeUuid/user/:userEmail', requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const { disputeUuid, userEmail } = c.req.param();
  const [row] = await db.select().from(disputeVotes).where(and(eq(disputeVotes.disputeUuid, disputeUuid), eq(disputeVotes.userEmail, decodeURIComponent(userEmail).toLowerCase())));
  return c.json({ vote: row?.vote ?? null });
});