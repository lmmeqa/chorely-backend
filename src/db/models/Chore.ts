import { db } from "./index";
import { ModelError, dbGuard, mapFk, ensureUuid, formatRowTimestamps } from "./BaseModel";

export type ChoreStatus = "unapproved" | "unclaimed" | "claimed" | "complete";

export interface ChoreRow {
  uuid: string;
  name: string;
  description: string;
  time: string; // timestamptz
  icon: string;
  status: ChoreStatus;
  user_email: string | null; // Can be null when user is deleted
  home_id: string;
  points: number; // Base points value
  completed_at: string | null;
  claimed_at: string | null;
  created_at?: string;
  updated_at?: string;
}

// Helper function to calculate dynamic points based on time unclaimed
const calculateDynamicPoints = (basePoints: number, createdAt: string, status: ChoreStatus): number => {
  if (status !== "unclaimed") {
    return basePoints; // No bonus for claimed or completed chores
  }
  
  const now = new Date();
  const created = new Date(createdAt);
  const hoursUnclaimed = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
  
  // Increase points by 10% every 24 hours, capped at 100% increase (double points)
  const bonusMultiplier = Math.min(1 + (hoursUnclaimed / 24) * 0.1, 2.0);
  
  return Math.round(basePoints * bonusMultiplier);
};

export default class Chore {
  static async create(data: Omit<ChoreRow, "uuid" | "status" | "user_email" | "completed_at" | "claimed_at" | "created_at" | "updated_at">) {
    return dbGuard(async () => {
      try {
        const result = await db<ChoreRow>("chores")
          .insert({ ...data, status: "unapproved" })
          .returning("*");
        return formatRowTimestamps(result[0]);
      } catch (e: any) {
        throw mapFk(e, "Failed to create chore");
      }
    }, "Failed to create chore");
  }

  static async findByUuid(uuid: string): Promise<ChoreRow> {
    ensureUuid(uuid);
    return dbGuard(async () => {
      const row = await db<ChoreRow>("chores").where({ uuid }).first();
      if (!row) throw new ModelError("CHORE_NOT_FOUND", `Chore not found: '${uuid}'`, 404);
      const formatted = formatRowTimestamps(row);
      // Apply dynamic points calculation
      formatted.points = calculateDynamicPoints(row.points, row.created_at!, row.status);
      return formatted;
    }, "Failed to fetch chore");
  }

  static async available(homeId: string): Promise<ChoreRow[]> {
    const results = await db<ChoreRow>("chores").where({ home_id: homeId, status: "unclaimed" }).andWhere("user_email", null);
    return results.map(chore => {
      const formatted = formatRowTimestamps(chore);
      // Apply dynamic points calculation for unclaimed chores
      formatted.points = calculateDynamicPoints(chore.points, chore.created_at!, chore.status);
      return formatted;
    });
  }

  static async unapproved(homeId: string): Promise<ChoreRow[]> {
    const results = await db<ChoreRow>("chores").where({ home_id: homeId, status: "unapproved" });
    return results.map(formatRowTimestamps);
  }

  static async forUser(email: string, homeId: string): Promise<ChoreRow[]> {
    const results = await db<ChoreRow>("chores").where({ user_email: email, home_id: homeId }).whereIn("status", ["claimed", "complete"]);
    return results.map(formatRowTimestamps);
  }

  static async setStatus(uuid: string, status: ChoreStatus) {
    ensureUuid(uuid);
    return dbGuard(async () => {
      const n = await db("chores").where({ uuid }).update({ status });
      if (!n) throw new ModelError("CHORE_NOT_FOUND", `Chore not found: '${uuid}'`, 404);
    }, "Failed to update chore status");
  }
  
  static async approve(uuid: string) {
    await this.setStatus(uuid, "unclaimed");
  }

  static async claim(uuid: string, email: string) {
    ensureUuid(uuid);
    return dbGuard(async () => {
      try {
        const n = await db("chores")
          .where({ uuid, status: "unclaimed" })
          .update({ 
            status: "claimed", 
            user_email: email,
            claimed_at: db.fn.now()
          });
        if (!n) throw new ModelError("CHORE_NOT_CLAIMABLE", "Chore is already claimed or not available", 409);
      } catch (e: any) {
        throw mapFk(e, "User does not exist for claim");
      }
    }, "Failed to claim chore");
  }

  static async verify(uuid: string) {
    ensureUuid(uuid);
    return dbGuard(async () => {
      await db.transaction(async (trx) => {
        // Lock row and re-check state for idempotency
        const chore = await trx<ChoreRow>("chores").where({ uuid }).forUpdate().first();
        if (!chore) throw new ModelError("CHORE_NOT_FOUND", `Chore not found: '${uuid}'`, 404);

        // Only apply changes if not already complete
        if (chore.status !== "complete") {
          await trx("chores").where({ uuid }).update({ status: "complete", completed_at: trx.fn.now() });

          // Auto-award dynamic points to the assignee based on when they claimed it
          if (chore.user_email && chore.points > 0) {
            let pointsToAward = chore.points;
            
            // Use the claimed_at timestamp for accurate calculation
            if (chore.claimed_at) {
              const created = new Date(chore.created_at!);
              const claimed = new Date(chore.claimed_at);
              const hoursUnclaimed = (claimed.getTime() - created.getTime()) / (1000 * 60 * 60);
              const bonusMultiplier = Math.min(1 + (hoursUnclaimed / 24) * 0.1, 2.0);
              pointsToAward = Math.round(chore.points * bonusMultiplier);
            }
            
            await trx("user_homes")
              .where({ home_id: chore.home_id, user_email: chore.user_email })
              .increment("points", pointsToAward);
          }
        }
      });
    }, "Failed to complete chore");
  }

  static recentActivity(threshold: Date) {
    return db<ChoreRow>("chores")
      .where("completed_at", ">=", threshold)
      .where("status", "complete")
      .orderBy("completed_at", "desc")
      .limit(50);
  }
}