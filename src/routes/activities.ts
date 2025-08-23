import { Hono } from "hono";
import { dbFromEnv } from "../lib/db";
import { requireUser } from "../lib/auth";
import { chores, disputes } from "../db/schema";
import { and, desc, eq, notInArray } from "drizzle-orm";
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
  return row;
}

// GET /activities?homeId=...&timeFrame=1d|3d|7d|30d
activitiesRoutes.get("/activities", requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const homeId = c.req.query("homeId");
  const timeFrame = c.req.query("timeFrame") || "3d";
  
  if (!homeId) return c.json([], 200);
  
  // Calculate the date range based on timeFrame
  const now = new Date();
  let startDate: Date;
  
  switch (timeFrame) {
    case "1d":
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default: // 3d
      startDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  }
  
  // Get chore IDs that have active disputes
  const disputedChoreIds = await db
    .select({ choreId: disputes.choreId })
    .from(disputes)
    .where(eq(disputes.status, "pending"));

  const disputedIds = disputedChoreIds.map(d => d.choreId);

  const rows = await db
    .select()
    .from(chores)
    .where(
      and(
        eq(chores.homeId, homeId as any),
        eq(chores.status, "complete"),
        // Exclude chores that have active disputes
        disputedIds.length > 0 ? notInArray(chores.uuid, disputedIds) : undefined
      )
    )
    .orderBy(desc(chores.completedAt));
  
  console.log(`[activities] Found ${rows.length} completed chores (no active disputes) for home ${homeId}`);
  console.log(`[activities] Excluded ${disputedIds.length} chores with active disputes`);
  console.log(`[activities] TimeFrame: ${timeFrame}, startDate: ${startDate.toISOString()}`);
  
  // Filter by timeFrame and convert to signed URLs
  const filteredRows = rows.filter(r => r.completedAt && new Date(r.completedAt) >= startDate);
  
  // Sign photo URLs for each row
  const signedRows = await Promise.all(
    filteredRows.map(async (r) => await withSignedPhoto(r, c.env))
  );
  
  // Map to expected Chore format
  const out = signedRows.map(r => ({
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
    photo_url: r.photoUrl, // This will now be a signed URL
    todos: [], // Will be populated separately if needed
    approvalList: [] // Will be populated separately if needed
  }));
  
  console.log(`[activities] Returning ${out.length} activities after timeFrame filtering`);
  
  return c.json(out);
});


