import { Hono } from "hono";
import { requireUser } from "../lib/auth";
import { dbFromEnv } from "../lib/db.worker";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const usersRoutes = new Hono();

usersRoutes.get("/me", requireUser, async (c) => {
	const db = dbFromEnv(c.env as any);
	const u = c.get("user") as { id: string; email?: string; claims?: any };
	if (!u?.email) return c.json({ error: "Missing email in token" }, 400);

	const meta = (u.claims?.user_metadata ?? {}) as Record<string, any>;
	const provider =
		u.claims?.app_metadata?.provider ??
		u.claims?.provider ??
		(Array.isArray(u.claims?.identities) ? u.claims.identities[0]?.provider : undefined);

	const values = {
		email: u.email,
		name: (meta.full_name ?? meta.name ?? u.email.split("@")[0]) as string,
		supabaseUserId: u.id,
		authUserId: u.id,
		avatarUrl: (meta.avatar_url ?? null) as string | null,
		lastProvider: (provider ?? null) as string | null,
		lastLogin: new Date(),
		updatedAt: new Date(),
	};

	const [profile] = await db
		.insert(users)
		.values(values)
		.onConflictDoUpdate({
			target: users.email,
			set: {
				name: values.name,
				supabaseUserId: values.supabaseUserId,
				authUserId: values.authUserId,
				avatarUrl: values.avatarUrl,
				lastProvider: values.lastProvider,
				lastLogin: values.lastLogin,
				updatedAt: values.updatedAt,
			},
		})
		.returning();

	return c.json({ user: { id: u.id, email: u.email }, profile });
});

// Legacy Express-compatible auth endpoints used by tests
usersRoutes.post("/auth/authenticate", requireUser, async (c) => {
	const db = dbFromEnv(c.env as any);
	const u = c.get("user") as { id: string; email?: string; claims?: any };
	if (!u?.email) return c.json({ error: "Missing email in token" }, 400);

	const meta = (u.claims?.user_metadata ?? {}) as Record<string, any>;
	const provider =
		u.claims?.app_metadata?.provider ??
		u.claims?.provider ??
		(Array.isArray(u.claims?.identities) ? u.claims.identities[0]?.provider : undefined);

	const values = {
		email: u.email.toLowerCase(),
		name: (meta.full_name ?? meta.name ?? u.email.split("@")[0]) as string,
		supabaseUserId: u.id,
		authUserId: u.id,
		avatarUrl: (meta.avatar_url ?? null) as string | null,
		lastProvider: (provider ?? null) as string | null,
		lastLogin: new Date(),
		updatedAt: new Date(),
	};

	await db
		.insert(users)
		.values(values)
		.onConflictDoUpdate({
			target: users.email,
			set: {
				name: values.name,
				supabaseUserId: values.supabaseUserId,
				authUserId: values.authUserId,
				avatarUrl: values.avatarUrl,
				lastProvider: values.lastProvider,
				lastLogin: values.lastLogin,
				updatedAt: values.updatedAt,
			},
		});

	return c.json({ email: u.email.toLowerCase() });
});

usersRoutes.get("/auth/me", requireUser, async (c) => {
	const u = c.get("user") as { id: string; email?: string };
	if (!u?.email) return c.json({ error: "Missing email in token" }, 400);
	return c.json({ email: u.email.toLowerCase() });
});

// Legacy Express-compatible user creation and join endpoints used by tests
usersRoutes.post("/user", async (c) => {
    const db = dbFromEnv(c.env as any);
    const Body = z.object({
        email: z.string().email(),
        name: z.string().min(1).optional(),
        homeIds: z.array(z.string().uuid()).optional(),
    });
    const body = Body.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: "INVALID_BODY" }, 400);
    const email = body.data.email.toLowerCase();
    const name = (body.data.name ?? email.split("@")[0]);
    const homeIds = body.data.homeIds ?? [];

    // Optional: ensure provided homes exist
    if (homeIds.length > 0) {
        const { homes } = await import("../db/schema");
        const { inArray } = await import("drizzle-orm");
        const existing = await db.select({ id: homes.id }).from(homes).where(inArray(homes.id, homeIds));
        if (existing.length !== homeIds.length) {
            return c.json({ error: "HOME_NOT_FOUND" }, 404);
        }
    }

    // idempotent create
    const [profile] = await db.insert(users).values({
        email,
        name,
        lastLogin: new Date(),
        updatedAt: new Date(),
    }).onConflictDoNothing().returning();

    if (!profile) {
        // already exists
        return c.json({ error: "exists" }, 409);
    }

    for (const homeId of homeIds) {
        await db.insert((await import("../db/schema")).userHomes).values({ userEmail: email, homeId, points: 0 }).onConflictDoNothing();
    }
    return c.json({ email }, 201);
});

usersRoutes.post("/user/join", async (c) => {
    const db = dbFromEnv(c.env as any);
    const body = await c.req.json();
    const email = String(body.email).toLowerCase();
    const homeId = String(body.homeId);
    
    // Check if home exists first
    const { homes } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    const [existingHome] = await db.select({ id: homes.id }).from(homes).where(eq(homes.id, homeId)).limit(1);
    if (!existingHome) {
        return c.json({ error: 'Home not found' }, 404);
    }
    
    try {
        await db.insert((await import("../db/schema")).userHomes).values({ userEmail: email, homeId, points: 0 }).onConflictDoNothing();
        return c.body(null, 204);
    } catch (e: any) {
        return c.json({ error: 'join failed', message: String(e?.message || e) }, 500);
    }
});

// GET /user/:email/homes
usersRoutes.get("/user/:email/homes", async (c) => {
    const db = dbFromEnv(c.env as any);
    const email = String(c.req.param("email")).toLowerCase();
    const { userHomes, homes } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db
        .select({ id: homes.id, name: homes.name, weeklyPointQuota: homes.weeklyPointQuota })
        .from(userHomes)
        .innerJoin(homes, eq(userHomes.homeId, homes.id))
        .where(eq(userHomes.userEmail, email));
    return c.json(rows);
});

// Alias expected by tests: /user/:email/home
usersRoutes.get("/user/:email/home", async (c) => {
    const db = dbFromEnv(c.env as any);
    const email = String(c.req.param("email")).toLowerCase();
    const { userHomes, homes } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db
        .select({ id: homes.id, name: homes.name, weeklyPointQuota: homes.weeklyPointQuota })
        .from(userHomes)
        .innerJoin(homes, eq(userHomes.homeId, homes.id))
        .where(eq(userHomes.userEmail, email));
    return c.json(rows);
});


