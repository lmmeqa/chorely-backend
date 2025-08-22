import { Hono } from "hono";
import { dbFromEnv } from "../lib/db";
import { requireUser } from "../lib/auth";
import { chores } from "../db/schema";
import { and, desc, eq } from "drizzle-orm";

export const activitiesRoutes = new Hono();

// GET /activities?homeId=...&timeFrame=1d|3d|7d|30d
activitiesRoutes.get("/activities", requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const homeId = c.req.query("homeId");
  // timeFrame input accepted but for MVP just return recent completed chores
  if (!homeId) return c.json([], 200);
  const rows = await db
    .select({ uuid: chores.uuid, status: chores.status, completedAt: chores.completedAt, createdAt: chores.createdAt })
    .from(chores)
    .where(and(eq(chores.homeId, homeId as any)))
    .orderBy(desc(chores.completedAt));
  // Map to expected minimal shape with ts
  const out = rows
    .filter(r => r.completedAt)
    .map(r => ({ uuid: r.uuid, ts: new Date(r.completedAt as any).getTime(), status: r.status, created_at: r.createdAt }));
  return c.json(out);
});


