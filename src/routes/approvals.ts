import { Hono } from "hono";
import { z } from "zod";
import { dbFromEnv } from "../lib/db";
import { requireUser } from "../lib/auth";
import { requireHomeMemberByChoreUuid } from "../lib/authorization";
import { choreApprovals, chores, userHomes } from "../db/schema";
import { and, count, eq, inArray } from "drizzle-orm";

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

  // Check if chore exists and is in correct state for voting
  const [chore] = await db.select().from(chores).where(eq(chores.uuid, uuid)).limit(1);
  if (!chore) return c.json({ error: "chore not found" }, 404);
  
  // Only allow voting on unapproved chores
  if (chore.status !== "unapproved") {
    return c.json({ error: "can only vote on unapproved chores" }, 409);
  }

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
  
  const voters = await db.select().from(choreApprovals).where(eq(choreApprovals.choreUuid, uuid));
  const [{ cnt }] = await db.select({ cnt: count() }).from(userHomes).where(eq(userHomes.homeId, chore.homeId));
  const required = Number(cnt) <= 1 ? 1 : Math.max(2, Math.ceil(Number(cnt) * 0.5));
  
  if (voters.length >= required) {
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

// POST /approvals/batch { uuids: string[] } - Batch endpoint for approval statuses
approvalsRoutes.post("/approvals/batch", requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const body = await c.req.json().catch(() => ({}));
  
  const requestSchema = z.object({
    uuids: z.array(z.string().uuid())
  });
  
  let uuids: string[];
  try {
    ({ uuids } = requestSchema.parse(body));
  } catch (error) {
    return c.json({ error: "Invalid request body. Expected { uuids: string[] }" }, 400);
  }
  
  if (uuids.length === 0) {
    return c.json([]);
  }
  
  // Fetch all chores in batch - filter valid UUIDs only
  let choreList: any[] = [];
  try {
    choreList = await db.select().from(chores).where(inArray(chores.uuid, uuids));
  } catch (error) {
    // Handle case where some UUIDs are invalid
    choreList = [];
  }
  
  if (choreList.length === 0) {
    return c.json([]);
  }
  
  // Group chores by home to get user counts efficiently
  const homeIds = [...new Set(choreList.map(c => c.homeId))];
  const homeCounts = await Promise.all(
    homeIds.map(async (homeId) => {
      const [{ cnt }] = await db
        .select({ cnt: count() })
        .from(userHomes)
        .where(eq(userHomes.homeId, homeId));
      return { homeId, count: Number(cnt) };
    })
  );
  
  const homeCountMap = homeCounts.reduce((acc, { homeId, count }) => {
    acc[homeId] = count;
    return acc;
  }, {} as Record<string, number>);
  
  // Fetch all voters for all chores in batch
  const allVoters = await db
    .select({ 
      choreUuid: choreApprovals.choreUuid, 
      userEmail: choreApprovals.userEmail 
    })
    .from(choreApprovals)
    .where(inArray(choreApprovals.choreUuid, uuids));
  
  // Group voters by chore UUID
  const votersByChore = allVoters.reduce((acc, { choreUuid, userEmail }) => {
    if (!acc[choreUuid]) acc[choreUuid] = [];
    acc[choreUuid].push(userEmail);
    return acc;
  }, {} as Record<string, string[]>);
  
  // Build response for each chore
  const results = choreList.map(chore => {
    const voters = votersByChore[chore.uuid] || [];
    const totalUsers = homeCountMap[chore.homeId] || 0;
    const required = calcRequired(totalUsers);
    
    return {
      uuid: chore.uuid,
      status: chore.status,
      voters,
      votes: voters.length,
      required,
      total_users: totalUsers,
    };
  });
  
  return c.json(results);
});


