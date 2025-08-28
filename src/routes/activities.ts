import { Hono } from "hono";
import { dbFromEnv } from "../lib/db";
import { requireUser } from "../lib/auth";
import { chores, disputes } from "../db/schema";
import { and, desc, eq, notInArray, gt, lte } from "drizzle-orm";
import { createSignedUrlForPath, isStoragePath } from "../lib/uploads";

export const activitiesRoutes = new Hono();

// Helper to sign a chore's photo on the fly
async function withSignedPhoto(row: any, env?: any) {
  if (row?.photoUrl && isStoragePath(row.photoUrl)) {
    console.log(`[withSignedPhoto] Processing photoUrl: ${row.photoUrl}`);
    try {
      const url = await createSignedUrlForPath(row.photoUrl, { env });
      console.log(`[withSignedPhoto] Generated signed URL: ${url}`);
      return { ...row, photoUrl: url };
    } catch (e) {
      console.error(`[withSignedPhoto] Failed to sign URL for ${row.photoUrl}:`, e);
      // Fall back to returning null photo_url so frontend knows image failed to load
      console.log(`[withSignedPhoto] Returning null photoUrl due to signing failure`);
      return { ...row, photoUrl: null };
    }
  }
  // For local seed paths (starting with /seed/), pass through unchanged
  return row;
}

// GET /activities?homeId=...&timeFrame=1d|3d|7d|30d&fromTs=...&toTs=...
activitiesRoutes.get("/activities", requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const homeId = c.req.query("homeId");
  const timeFrame = c.req.query("timeFrame") || "3d";
  const fromTs = c.req.query("fromTs");
  const toTs = c.req.query("toTs");
  
  if (!homeId) return c.json([], 200);
  
  // Calculate the date range based on timeFrame
  const currentTime = new Date();
  let startDate: Date;
  
  switch (timeFrame) {
    case "1d":
      startDate = new Date(currentTime.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      startDate = new Date(currentTime.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      startDate = new Date(currentTime.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default: // 3d
      startDate = new Date(currentTime.getTime() - 3 * 24 * 60 * 60 * 1000);
  }
  
  // Get chore IDs that have active disputes
  const disputedChoreIds = await db
    .select({ choreId: disputes.choreId })
    .from(disputes)
    .where(eq(disputes.status, "pending"));

  const disputedIds = disputedChoreIds.map(d => d.choreId);

  // Build where conditions
  const conditions = [
    eq(chores.homeId, homeId as any),
    eq(chores.status, "complete"),
    // Exclude chores that have active disputes
    disputedIds.length > 0 ? notInArray(chores.uuid, disputedIds) : undefined
  ].filter(Boolean);

  // Add bounds filtering if provided
  if (fromTs) {
    conditions.push(gt(chores.updatedAt, new Date(Number(fromTs)))); // fromTs exclusive
  }
  if (toTs) {
    conditions.push(lte(chores.updatedAt, new Date(Number(toTs)))); // toTs inclusive
  }

  const rows = await db
    .select()
    .from(chores)
    .where(and(...conditions))
    .orderBy(desc(chores.updatedAt), desc(chores.uuid)); // tie-break on uuid
  
  console.log(`[activities] Found ${rows.length} completed chores (no active disputes) for home ${homeId}`);
  console.log(`[activities] Excluded ${disputedIds.length} chores with active disputes`);
  console.log(`[activities] TimeFrame: ${timeFrame}, startDate: ${startDate.toISOString()}`);
  
  // Filter by timeFrame and convert to signed URLs
  const filteredRows = rows.filter(r => r.completedAt && new Date(r.completedAt) >= startDate);
  
  // Sign photo URLs for each row
  const signedRows = await Promise.all(
    filteredRows.map(async (r) => await withSignedPhoto(r, c.env))
  );
  
  // --- map chores to activity items with numeric id ---
  function uuidToNumericId(uuid: string): number {
    // Use last 12 hex (48 bits) to stay within Number.MAX_SAFE_INTEGER
    const hex = uuid.replace(/-/g, "");
    const tail12 = hex.slice(-12);
    const n = Number.parseInt(tail12, 16);
    return Number.isFinite(n) ? n : 0;
  }

  const out = signedRows.map((r) => {
    const ts = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
    return {
      // numeric id for tie-break
      id: uuidToNumericId(r.uuid),
      ts,
      uuid: r.uuid,
      name: r.name,
      description: r.description,
      time: r.time,
      icon: r.icon,
      status: r.status,
      user_email: r.userEmail,
      homeID: r.homeId,
      points: r.points,
      completed_at: r.completedAt,
      claimed_at: r.claimedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      photo_url: r.photoUrl,
      todos: [],
      approvalList: [],
    };
  });

  console.log(`[activities] Returning ${out.length} activities after timeFrame filtering`);

  // --- lightweight STATUS_CHANGED events (numeric id too) ---
  const now = Date.now();
  const recent = rows.filter((r) => {
    const updatedTime = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
    return updatedTime >= now - 10_000;
  });

  const statusEvents = recent.map((r, i) => ({
    // give events a string id as expected by tests
    id: `ev-${r.uuid}`,
    ts: r.updatedAt ? new Date(r.updatedAt).getTime() : 0,
    type: "STATUS_CHANGED",
    actor: { email: r.userEmail ?? "system" },
    homeId: r.homeId,
    choreUuid: r.uuid,
    newStatus: r.status === 'unclaimed' ? 'UNCLAIMED' : 
               r.status === 'claimed' ? 'CLAIMED' : 
               r.status === 'complete' ? 'COMPLETED' : 
               r.status.toUpperCase(), // Map to expected values
  }));

  // --- final, authoritative sort (ts desc, id desc) ---
  const items = [...statusEvents, ...out].sort((a, b) => {
    const byTs = (b.ts || 0) - (a.ts || 0);
    if (byTs !== 0) return byTs;
    // Handle mixed types: string IDs for events, numeric IDs for chores
    if (typeof a.id === 'string' && typeof b.id === 'string') {
      return b.id.localeCompare(a.id);
    }
    if (typeof a.id === 'number' && typeof b.id === 'number') {
      return b.id - a.id;
    }
    // String IDs sort before numeric IDs
    return typeof a.id === 'string' ? -1 : 1;
  });

  return c.json(items, 200);
});


