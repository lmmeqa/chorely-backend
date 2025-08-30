import { dbFromEnv } from '../lib/db';
import { chores, disputes } from '../db/schema';
import { and, desc, eq, notInArray, gt, lte } from 'drizzle-orm';

export async function listActivities(homeId: string, fromTs?: Date, toTs?: Date, env?: any) {
  const db = dbFromEnv(env as any);
  
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
    conditions.push(gt(chores.updatedAt, fromTs)); // fromTs exclusive
  }
  if (toTs) {
    conditions.push(lte(chores.updatedAt, toTs)); // toTs inclusive
  }

  const rows = await db
    .select()
    .from(chores)
    .where(and(...conditions))
    .orderBy(desc(chores.updatedAt), desc(chores.uuid));
  
  return rows;
}
