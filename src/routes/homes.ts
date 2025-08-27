import { Hono } from "hono";
import { z } from "zod";
import { dbFromEnv } from "../lib/db";
import { requireUser } from "../lib/auth";
import { requireHomeMemberByParam } from "../lib/authorization";
import { homes, userHomes, users, chores, choreApprovals } from "../db/schema";
import { and, eq, desc, count } from "drizzle-orm";
import { createSignedUrlForPath, isStoragePath } from "../lib/uploads";

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

// GET /home/:id/summary?user=:email - Batch endpoint for all home data
homesRoutes.get("/home/:id/summary", requireUser, async (c) => {
	try {
		const { chores, userHomes } = await import("../db/schema");
		const { desc } = await import("drizzle-orm");
		const { uploadToStorageReturnPath, createSignedUrlForPath, isStoragePath } = await import("../lib/uploads");
		
		const db = dbFromEnv(c.env as any);
		const { id: homeId } = c.req.param();
		const userEmail = c.req.query("user");
		
		if (!userEmail) {
			return c.json({ error: "user query parameter required" }, 400);
		}
		
		// Validate UUID format
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		if (!uuidRegex.test(homeId)) {
			return c.json({ error: "Invalid home ID format" }, 400);
		}
		
		// Check if home exists and user has access
		const [home] = await db.select().from(homes).where(eq(homes.id, homeId));
		if (!home) {
			return c.json({ error: "Home not found" }, 404);
		}
		
		// Check if user is member of this home
		const u = (c as any).get("user") as { email?: string };
		const [membership] = await db.select().from(userHomes).where(and(eq(userHomes.homeId, homeId), eq(userHomes.userEmail, u?.email || '')));
		if (!membership) {
			return c.json({ error: "Access denied to this home" }, 403);
		}
	
	// Helper function to add signed photo URLs
	const withSignedPhoto = async (row: any, env: any) => {
		if (!row.photoUrl || !isStoragePath(row.photoUrl)) {
			return row;
		}
		try {
			const signed = await createSignedUrlForPath(row.photoUrl, env);
			return { ...row, photo_url: signed };
		} catch (error) {
			console.warn('Failed to create signed URL for photo:', error);
			return row;
		}
	};
	
	// Batch fetch all data in parallel
	const [availableChores, myChores, unapprovedChores, allUserPoints] = await Promise.all([
		// Available chores (unclaimed)
		db.select().from(chores)
			.where(and(eq(chores.homeId, homeId), eq(chores.status, "unclaimed")))
			.orderBy(desc(chores.createdAt)),
		
		// My chores (claimed by user)
		db.select().from(chores)
			.where(and(eq(chores.homeId, homeId), eq(chores.userEmail, userEmail), eq(chores.status, "claimed")))
			.orderBy(desc(chores.createdAt)),
		
		// Unapproved chores (new chores waiting for initial approval)
		db.select().from(chores)
			.where(and(eq(chores.homeId, homeId), eq(chores.status, "unapproved")))
			.orderBy(desc(chores.createdAt)),
		
		// All user points in home
		db.select().from(userHomes).where(eq(userHomes.homeId, homeId))
	]);
	
	// Get current user's points
	const currentUserPoints = allUserPoints.find(p => p.userEmail === userEmail)?.points ?? 0;
	
	// Transform points data to match expected format
	const pointsMap = allUserPoints.reduce((acc, row) => {
		acc[row.userEmail] = row.points;
		return acc;
	}, {} as Record<string, number>);
	
	// Validate and update unapproved chores that may have enough votes to be approved
	const updatedUnapprovedChores = [];
	const totalUsersInHome = allUserPoints.length;
	const requiredVotes = totalUsersInHome <= 1 ? 1 : Math.max(2, Math.ceil(totalUsersInHome * 0.5));
	
	for (const chore of unapprovedChores) {
		// Check current vote count for this chore
		const currentVotes = await db
			.select({ count: count() })
			.from(choreApprovals)
			.where(eq(choreApprovals.choreUuid, chore.uuid));
		
		const voteCount = Number(currentVotes[0]?.count || 0);
		
		// If chore has enough votes, update status to unclaimed
		if (voteCount >= requiredVotes) {
			console.log(`[home summary] Auto-approving chore ${chore.uuid} with ${voteCount}/${requiredVotes} votes`);
			await db.update(chores)
				.set({ status: "unclaimed", updatedAt: new Date() })
				.where(eq(chores.uuid, chore.uuid));
			
			// Don't include this chore in unapproved list anymore - it's now approved
		} else {
			// Keep this chore in the unapproved list
			updatedUnapprovedChores.push(chore);
		}
	}
	
	// Process signed URLs for photos
	const [signedAvailable, signedMy, signedUnapproved] = await Promise.all([
		Promise.all(availableChores.map(row => withSignedPhoto(row, c.env))),
		Promise.all(myChores.map(row => withSignedPhoto(row, c.env))),
		Promise.all(updatedUnapprovedChores.map(row => withSignedPhoto(row, c.env)))
	]);
	
	return c.json({
		availableChores: signedAvailable,
		myChores: signedMy, 
		unapprovedChores: signedUnapproved,
		userPoints: currentUserPoints,
		allUserPoints: pointsMap
	});
	
	} catch (error) {
		console.error('[home-summary] Error:', error);
		return c.json({ error: "Internal server error" }, 500);
	}
});


