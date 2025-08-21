import { db } from "./index";
import { ModelError, dbGuard, mapFk, ensureUuid, formatRowTimestamps } from "./BaseModel";
import { TodoItem, TodoRow } from "./index";

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
  photo_url?: string | null;
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
  
  // Fix floating-point precision by using a more precise calculation
  const exactPoints = basePoints * bonusMultiplier;
  // Use a more explicit rounding approach to handle floating-point precision
  return Math.round(Math.round(exactPoints * 1000000) / 1000000);
};

export default class Chore {
  static async create(data: Omit<ChoreRow, "uuid" | "status" | "completed_at"| "user_email" | "claimed_at" | "created_at" | "updated_at">) {
    return dbGuard(async () => {
      try {
        const [createdChore] = await db<ChoreRow>("chores")
          .insert({ ...data, status: "unapproved", user_email: null })
          .returning("*");
        return formatRowTimestamps(createdChore);
      } catch (e: any) {
        throw mapFk(e, "Failed to create chore");
      }
    }, "Failed to create chore");
  }

  static async addTodos(choreUuid: string, todos: Array<{ name: string }>) {
    ensureUuid(choreUuid);
    return dbGuard(async () => {
      // Use TodoItem.create for each todo to respect order management
      for (const todo of todos) {
        await TodoItem.create({
          chore_id: choreUuid,
          name: todo.name,
          // Let TodoItem.create handle order assignment
        });
      }
    }, "Failed to add todos to chore");
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
    return results.map((chore: ChoreRow) => {
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
    const results = await db<ChoreRow>("chores").where({ user_email: email, home_id: homeId }).whereIn("status", ["claimed"]);
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
    await Chore.setStatus(uuid, "unclaimed");
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
      await db.transaction(async (trx: any) => {
        // Lock row and re-check state for idempotency
        const chore = await trx("chores").where({ uuid }).forUpdate().first();
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
              // Fix floating-point precision by using a more precise calculation
              const exactPoints = chore.points * bonusMultiplier;
              // Use a more explicit rounding approach to handle floating-point precision
              pointsToAward = Math.round(Math.round(exactPoints * 1000000) / 1000000);
            }
            
            await trx("user_homes")
              .where({ home_id: chore.home_id, user_email: chore.user_email })
              .increment("points", pointsToAward);
          }
        }
      });
    }, "Failed to complete chore");
  }

  static async recentActivity(threshold: Date, homeId?: string): Promise<ChoreRow[]> {
    // Use a more efficient query that excludes pending disputes directly, and optionally filter by home
    const q = db<ChoreRow>("chores")
      .where("chores.completed_at", ">=", threshold)
      .where("chores.status", "complete")
      .whereNotExists(function (this: any) {
        this.select("*")
          .from("disputes")
          .whereRaw("disputes.chore_id = chores.uuid")
          .where("disputes.status", "pending");
      });

    if (homeId) {
      q.andWhere("chores.home_id", homeId);
    }

    const results = await q.orderBy("chores.completed_at", "desc").limit(50);
    return results.map(formatRowTimestamps);
  }
}