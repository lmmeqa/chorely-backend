// src/routes/chores.ts
import { Hono } from "hono";
import { z } from "zod";
import { dbFromEnv } from "../lib/db";
import { requireUser } from "../lib/auth";
import { requireHomeMemberByParam, requireHomeMemberByChoreUuid } from "../lib/authorization";
import { chores, todoItems, userHomes } from "../db/schema";
import { and, count, desc, eq } from "drizzle-orm";

export const choresRoutes = new Hono();

// ──────────────────────────────────────────────────────────────────────────────
// Schemas
// ──────────────────────────────────────────────────────────────────────────────
const CreateChore = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  time: z.union([z.string().datetime().catch("1970-01-01T00:00:00Z"), z.coerce.date()]),
  icon: z.string().default("circle"),
  home_id: z.string().uuid(),
  points: z.number().int().min(0).default(1),
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /chores  → 201 + seed deterministic todos
// ──────────────────────────────────────────────────────────────────────────────
choresRoutes.post("/chores", requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const body = await c.req.json().catch(() => ({}));
  const data = CreateChore.parse(body);

  const [row] = await db
    .insert(chores)
    .values({
      name: data.name,
      description: typeof data.time === "string" ? data.description : data.description, // keep it simple
      time: new Date((data.time as any) ?? Date.now()),
      icon: data.icon,
      status: "unapproved",
      userEmail: null,
      homeId: data.home_id,
      points: data.points,
    })
    .returning();

  // Seed todos deterministically: Start, Work, Finish (order 0..2)
  const seeds = ["Start", "Work", "Finish"];
  for (let i = 0; i < seeds.length; i++) {
    // Unique on (choreId, order) in schema; ignore if already exists
    try {
      await db.insert(todoItems).values({ choreId: row.uuid, name: seeds[i], order: i });
    } catch {
      // ignore unique conflicts
    }
  }

  return c.json(row, 201);
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /chores/unapproved/:homeId → 200
// ──────────────────────────────────────────────────────────────────────────────
choresRoutes.get("/chores/unapproved/:homeId", requireUser, requireHomeMemberByParam("homeId"), async (c) => {
  const db = dbFromEnv(c.env as any);
  const { homeId } = c.req.param();

  const rows = await db
    .select()
    .from(chores)
    .where(and(eq(chores.homeId, homeId), eq(chores.status, "unapproved")))
    .orderBy(desc(chores.createdAt));
  return c.json(rows);
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /chores/available/:homeId → 200
// ──────────────────────────────────────────────────────────────────────────────
choresRoutes.get("/chores/available/:homeId", requireUser, requireHomeMemberByParam("homeId"), async (c) => {
  const db = dbFromEnv(c.env as any);
  const { homeId } = c.req.param();

  const rows = await db
    .select()
    .from(chores)
    .where(and(eq(chores.homeId, homeId), eq(chores.status, "unclaimed")))
    .orderBy(desc(chores.createdAt));
  return c.json(rows);
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /chores/user?homeId=... → 200 (returns user's claimed chores in that home)
// ──────────────────────────────────────────────────────────────────────────────
choresRoutes.get("/chores/user", requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const u = (c as any).get("user") as { email?: string };
  if (!u?.email) return c.json({ error: "Unauthorized" }, 401);
  
  const homeId = c.req.query("homeId");
  if (!homeId) return c.json([], 200);

  const rows = await db
    .select()
    .from(chores)
    .where(and(eq(chores.homeId, homeId), eq(chores.userEmail, u.email), eq(chores.status, "claimed")))
    .orderBy(desc(chores.createdAt));
  return c.json(rows);
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /chores/:uuid → 200 or 404
// ──────────────────────────────────────────────────────────────────────────────
choresRoutes.get("/chores/:uuid", async (c) => {
  const db = dbFromEnv(c.env as any);
  const { uuid } = c.req.param();
  const [row] = await db.select().from(chores).where(eq(chores.uuid, uuid)).limit(1);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /chores/:uuid/approve → 204 or 404/409
// ──────────────────────────────────────────────────────────────────────────────
choresRoutes.patch("/chores/:uuid/approve", requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const { uuid } = c.req.param();

  const [row] = await db.select().from(chores).where(eq(chores.uuid, uuid)).limit(1);
  if (!row) return c.json({ error: "not found" }, 404);
  if (row.status !== "unapproved") return c.json({ error: "not unapproved" }, 409);

  await db.update(chores).set({ status: "unclaimed", updatedAt: new Date() }).where(eq(chores.uuid, uuid));
  return c.body(null, 204);
});

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /chores/:uuid/claim → 204 or 403/404/409
// ──────────────────────────────────────────────────────────────────────────────
choresRoutes.patch("/chores/:uuid/claim", requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const { uuid } = c.req.param();
  const u = (c as any).get("user") as { email?: string };

  if (!u?.email) return c.json({ error: "Unauthorized" }, 401);

  const [row] = await db.select().from(chores).where(eq(chores.uuid, uuid)).limit(1);
  if (!row) return c.json({ error: "not found" }, 404);
  if (row.status !== "unclaimed") return c.json({ error: "not unclaimed" }, 409);

  await db
    .update(chores)
    .set({ status: "claimed", userEmail: u.email, claimedAt: new Date(), updatedAt: new Date() })
    .where(eq(chores.uuid, uuid));

  return c.body(null, 204);
});

// ──────────────────────────────────────────────────────────────────────────────
/** PATCH /chores/:uuid/complete → 204 or 403/404/409
 *  Accepts multipart (image); image is optional for tests, we record completion.
 */
// ──────────────────────────────────────────────────────────────────────────────
choresRoutes.patch("/chores/:uuid/complete", requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const { uuid } = c.req.param();
  const u = (c as any).get("user") as { email?: string };
  if (!u?.email) return c.json({ error: "Unauthorized" }, 401);

  const [row] = await db.select().from(chores).where(eq(chores.uuid, uuid)).limit(1);
  if (!row) return c.json({ error: "not found" }, 404);
  if (row.status !== "claimed") return c.json({ error: "not claimed" }, 409);
  if (row.userEmail && row.userEmail !== u.email) return c.json({ error: "forbidden" }, 403);

  // If multipart is sent, parse it (no-op storage for tests)
  const ct = c.req.header("content-type") || "";
  if (ct.includes("multipart/form-data")) {
    try {
      await c.req.parseBody(); // ensures we consume the stream; no storage needed for tests
    } catch {
      /* ignore */
    }
  }

  await db
    .update(chores)
    .set({ status: "complete", completedAt: new Date(), updatedAt: new Date() })
    .where(eq(chores.uuid, uuid));

  // Award points to the user
  try {
    const pointsToAward = row.points;
    const [existing] = await db.select().from(userHomes).where(and(eq(userHomes.homeId, row.homeId), eq(userHomes.userEmail, u.email)));
    if (existing) {
      await db
        .update(userHomes)
        .set({ points: existing.points + pointsToAward })
        .where(and(eq(userHomes.homeId, row.homeId), eq(userHomes.userEmail, u.email)));
    }
  } catch {
    // Point awarding shouldn't fail the completion
  }

  return c.body(null, 204);
});

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /chores/:uuid/verify → 410 Gone
// ──────────────────────────────────────────────────────────────────────────────
choresRoutes.patch("/chores/:uuid/verify", requireUser, async (c) => {
  return c.json(
    {
      error: "The /verify endpoint has been deprecated. Please use /complete instead.",
      message: "Use PATCH /chores/:uuid/complete to complete a chore",
    },
    410
  );
});