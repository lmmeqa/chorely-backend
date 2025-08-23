import { Hono } from "hono";
import { dbFromEnv } from "../lib/db";
import { requireUser } from "../lib/auth";
import { requireHomeMemberByChoreUuid } from "../lib/authorization";
import { choreApprovals, chores, userHomes } from "../db/schema";
import { and, count, eq } from "drizzle-orm";

export const approvalsRoutes = new Hono();

function calcRequired(totalUsers: number): number {
  return totalUsers <= 1 ? 1 : Math.max(2, Math.ceil(totalUsers * 0.5));
}

// GET /approvals/:uuid — return { status, votes, required, voters[]?, total_users? }
approvalsRoutes.get("/approvals/:uuid", requireUser, requireHomeMemberByChoreUuid("uuid"), async (c) => {
  const db = dbFromEnv(c.env as any);
  const { uuid } = c.req.param();
  const [chore] = await db.select().from(chores).where(eq(chores.uuid, uuid));
  if (!chore) return c.json({ error: "not found" }, 404);

  const voters = await db
    .select({ userEmail: choreApprovals.userEmail })
    .from(choreApprovals)
    .where(eq(choreApprovals.choreUuid, uuid));

  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(userHomes)
    .where(eq(userHomes.homeId, chore.homeId));

  const required = calcRequired(Number(cnt));
  return c.json({
    status: chore.status,
    voters: voters.map(v => v.userEmail),
    votes: voters.length,
    required,
    total_users: Number(cnt),
  });
});

// POST /approvals/:uuid/vote { userEmail }
approvalsRoutes.post("/approvals/:uuid/vote", requireUser, requireHomeMemberByChoreUuid("uuid"), async (c) => {
  const db = dbFromEnv(c.env as any);
  const u = (c as any).get("user") as { email?: string };
  const { uuid } = c.req.param();
  const body = await c.req.json().catch(() => ({}));
  const email = (body.userEmail as string) || u?.email;
  if (!email) return c.json({ error: "email required" }, 400);

  // Check if vote already exists
  const existing = await db
    .select()
    .from(choreApprovals)
    .where(and(eq(choreApprovals.choreUuid, uuid), eq(choreApprovals.userEmail, email)))
    .limit(1);
  
  if (existing.length > 0) {
    return c.json({ error: "duplicate vote" }, 409);
  }

  await db.insert(choreApprovals).values({ choreUuid: uuid, userEmail: email });
  
  // Check if this vote pushes the chore to approved status
  const [chore] = await db.select().from(chores).where(eq(chores.uuid, uuid)).limit(1);
  if (!chore) return c.json({ error: "chore not found" }, 404);
  
  const voters = await db.select().from(choreApprovals).where(eq(choreApprovals.choreUuid, uuid));
  const [{ cnt }] = await db.select({ cnt: count() }).from(userHomes).where(eq(userHomes.homeId, chore.homeId));
  const required = Number(cnt) <= 1 ? 1 : Math.max(2, Math.ceil(Number(cnt) * 0.5));
  
  if (voters.length >= required && chore.status === "unapproved") {
    await db.update(chores).set({ status: "unclaimed", updatedAt: new Date() }).where(eq(chores.uuid, uuid));
  }

  return c.json({ votes: voters.length, required, approved: voters.length >= required }, 200);
});

// POST /approvals/:uuid/unvote
approvalsRoutes.post("/approvals/:uuid/unvote", requireUser, requireHomeMemberByChoreUuid("uuid"), async (c) => {
  const db = dbFromEnv(c.env as any);
  const u = (c as any).get("user") as { email?: string };
  if (!u?.email) return c.json({ error: "Unauthorized" }, 401);
  const { uuid } = c.req.param();
  await db.delete(choreApprovals).where(and(eq(choreApprovals.choreUuid, uuid), eq(choreApprovals.userEmail, u.email.toLowerCase())));

  const [chore] = await db.select().from(chores).where(eq(chores.uuid, uuid));
  if (!chore) return c.json({ error: "not found" }, 404);
  const voters = await db.select({ userEmail: choreApprovals.userEmail }).from(choreApprovals).where(eq(choreApprovals.choreUuid, uuid));
  const [{ cnt }] = await db.select({ cnt: count() }).from(userHomes).where(eq(userHomes.homeId, chore.homeId));
  const required = calcRequired(Number(cnt));
  if (voters.length < required && chore.status === "unclaimed") {
    await db.update(chores).set({ status: "unapproved", updatedAt: new Date() }).where(eq(chores.uuid, uuid));
  }
  return c.json({ approved: voters.length >= required, votes: voters.length, required, voters: voters.map(v => v.userEmail) });
});


