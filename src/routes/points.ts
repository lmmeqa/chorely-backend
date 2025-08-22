import { Hono } from "hono";
import { dbFromEnv } from "../lib/db";
import { requireUser } from "../lib/auth";
import { requireHomeMemberByParam } from "../lib/authorization";
import { userHomes } from "../db/schema";
import { and, eq } from "drizzle-orm";

export const pointsRoutes = new Hono();

// GET /points/:homeId — list points for all users in a home
pointsRoutes.get("/points/:homeId", requireUser, requireHomeMemberByParam("homeId"), async (c) => {
  const db = dbFromEnv(c.env as any);
  const { homeId } = c.req.param();
  const rows = await db.select().from(userHomes).where(eq(userHomes.homeId, homeId));
  return c.json(rows.map(r => ({ user_email: r.userEmail, points: r.points })));
});

// GET /points/:homeId/:email — points for a single user
pointsRoutes.get("/points/:homeId/:email", requireUser, requireHomeMemberByParam("homeId"), async (c) => {
  const db = dbFromEnv(c.env as any);
  const { homeId, email } = c.req.param();
  const [row] = await db.select().from(userHomes).where(and(eq(userHomes.homeId, homeId), eq(userHomes.userEmail, decodeURIComponent(email))));
  return c.json({ points: row?.points ?? 0 });
});

// POST /points/:homeId/:email { delta }
pointsRoutes.post("/points/:homeId/:email", requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const { homeId, email } = c.req.param();
  const body = await c.req.json();
  const delta = Number(body?.delta ?? 0);
  const [row] = await db.select().from(userHomes).where(and(eq(userHomes.homeId, homeId), eq(userHomes.userEmail, decodeURIComponent(email))));
  const newPoints = (row?.points ?? 0) + delta;
  const [updated] = await db.update(userHomes).set({ points: newPoints }).where(and(eq(userHomes.homeId, homeId), eq(userHomes.userEmail, decodeURIComponent(email)))).returning();
  return c.json({ points: updated?.points ?? newPoints });
});

// PUT /points/:homeId/:email { points }
pointsRoutes.put("/points/:homeId/:email", requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const { homeId, email } = c.req.param();
  const body = await c.req.json();
  const points = Number(body?.points ?? 0);
  const [updated] = await db.update(userHomes).set({ points }).where(and(eq(userHomes.homeId, homeId), eq(userHomes.userEmail, decodeURIComponent(email)))).returning();
  return c.json({ points: updated?.points ?? points });
});


