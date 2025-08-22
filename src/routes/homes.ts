import { Hono } from "hono";
import { z } from "zod";
import { dbFromEnv } from "../lib/db";
import { homes, userHomes, users } from "../db/schema";
import { and, eq } from "drizzle-orm";

export const homesRoutes = new Hono();

const createHomeSchema = z.object({
	name: z.string().min(1),
	weeklyPointQuota: z.number().int().min(0).default(100),
});

// POST /homes (unprotected to match legacy tests)
homesRoutes.post("/homes", async (c) => {
	const db = dbFromEnv(c.env as any);
	try {
		console.log('[homes] POST /homes start');
		const body = await c.req.json().catch((e) => { console.error('[homes] json parse error', e); throw e; });
		console.log('[homes] body', body);
		const { name, weeklyPointQuota } = createHomeSchema.parse(body);
		const [home] = await db.insert(homes).values({ name, weeklyPointQuota }).returning();
		console.log('[homes] created', home);
		return c.json(home, 201);
	} catch (e: any) {
		console.error('[homes] error', e);
		return c.json({ error: 'homes create failed', message: String(e?.message || e) }, 500);
	}
});

// GET /homes (simple list)
homesRoutes.get("/homes", async (c) => {
	const db = dbFromEnv(c.env as any);
	const rows = await db.select().from(homes);
	return c.json(rows);
});

// GET /homes/:id
homesRoutes.get("/homes/:id", async (c) => {
	const db = dbFromEnv(c.env as any);
	const { id } = c.req.param();
	const [row] = await db.select().from(homes).where(eq(homes.id, id));
	if (!row) return c.json({ error: "not found" }, 404);
	return c.json(row);
});

// GET /homes/:homeId/users (legacy path)
homesRoutes.get("/homes/:homeId/users", async (c) => {
	const db = dbFromEnv(c.env as any);
	const { homeId } = c.req.param();

	const rows = await db
		.select({ email: users.email, name: users.name, points: userHomes.points })
		.from(userHomes)
		.innerJoin(users, eq(userHomes.userEmail, users.email))
		.where(eq(userHomes.homeId, homeId));

	return c.json(rows);
});

// PATCH /homes/:id/quota { weeklyPointQuota }
homesRoutes.patch("/homes/:id/quota", async (c) => {
	const db = dbFromEnv(c.env as any);
	const { id } = c.req.param();
	const body = await c.req.json();
	const quota = (z.object({ weeklyPointQuota: z.number().int().min(0) }).parse(body)).weeklyPointQuota;
	const [updated] = await db.update(homes).set({ weeklyPointQuota: quota }).where(eq(homes.id, id)).returning();
	if (!updated) return c.json({ error: "not found" }, 404);
	return c.json({ weeklyPointQuota: updated.weeklyPointQuota });
});


