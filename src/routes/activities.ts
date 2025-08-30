import { Hono } from "hono";
import { dbFromEnv } from "../lib/db";
import { requireUser } from "../lib/auth";
import { chores, disputes, statusEvents } from "../db/schema";
import { and, desc, eq, notInArray, gt, lte } from "drizzle-orm";
import { createSignedUrlForPath, isStoragePath } from "../lib/uploads";
import { listActivities } from '../repos/ActivitiesRepo';

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
  
  const choreRows = await listActivities(
    homeId, 
    fromTs ? new Date(Number(fromTs)) : undefined,
    toTs ? new Date(Number(toTs)) : undefined,
    c.env
  );
  
  // Get STATUS_CHANGED events for this home
  const db = dbFromEnv(c.env as any);
  let eventRows = [];
  try {
    // Build conditions for events (similar to listActivities)
    const eventConditions = [eq(statusEvents.homeId, homeId)];
    
    // Add bounds filtering if provided (same logic as listActivities)
    if (fromTs) {
      eventConditions.push(gt(statusEvents.ts, new Date(Number(fromTs)))); // fromTs exclusive
    }
    if (toTs) {
      eventConditions.push(lte(statusEvents.ts, new Date(Number(toTs)))); // toTs inclusive
    }
    
    eventRows = await db
      .select()
      .from(statusEvents)
      .where(and(...eventConditions))
      .orderBy(desc(statusEvents.ts), desc(statusEvents.uuid));
  } catch (e) {
    console.error('[activities] Error fetching status events:', e);
    // Fall back to empty array if statusEvents table doesn't exist
    eventRows = [];
  }
  
  console.log(`[activities] Found ${choreRows.length} completed chores, ${eventRows.length} status events for home ${homeId}`);
  console.log(`[activities] TimeFrame: ${timeFrame}, startDate: ${startDate.toISOString()}`);
  
  // Filter chores by timeFrame and convert to signed URLs
  const filteredChoreRows = choreRows.filter(r => r.completedAt && new Date(r.completedAt) >= startDate);
  
  // Filter events by timeFrame  
  const filteredEventRows = eventRows.filter(r => r.ts && new Date(r.ts) >= startDate);
  
  // Sign photo URLs for chore rows
  const signedChoreRows = await Promise.all(
    filteredChoreRows.map(async (r) => await withSignedPhoto(r, c.env))
  );
  

  // Combine chores and events
  const choreActivities = signedChoreRows.map((r) => ({
    uuid: r.uuid,
    ts: r.updatedAt ? new Date(r.updatedAt).getTime() : 0,
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
    activityType: 'chore',
  }));

  const eventActivities = filteredEventRows.map((e) => ({
    id: e.uuid,
    uuid: e.uuid,
    ts: e.ts ? new Date(e.ts).getTime() : 0,
    type: e.type,
    newStatus: e.newStatus?.toUpperCase(),
    actor: { email: e.actorEmail },
    actorEmail: e.actorEmail,
    choreUuid: e.choreUuid,
    homeId: e.homeId,
    homeID: e.homeId,
    activityType: 'event',
    // Add timestamp fields for consistent sorting
    updatedAt: e.ts,
    createdAt: e.ts,
  }));

  const out = [...choreActivities, ...eventActivities].sort((a, b) => {
    // Primary sort: timestamp descending
    if (b.ts !== a.ts) return b.ts - a.ts;
    
    // Tie-breaker: UUID descending  
    const aId = String(a.uuid || '');
    const bId = String(b.uuid || '');
    return bId > aId ? 1 : bId < aId ? -1 : 0;
  });

  console.log(`[activities] Returning ${out.length} activities after timeFrame filtering`);

  return c.json(out, 200);
});


