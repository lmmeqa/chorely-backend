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
  points: number;
  completed_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export default class Chore {
  static async create(data: Omit<ChoreRow, "uuid" | "status" | "user_email" | "completed_at" | "created_at" | "updated_at">) {
    return dbGuard(async () => {
      try {
        const result = await db<ChoreRow>("chores")
          .insert({ ...data, status: "unapproved", completed_at: null })
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
      return formatRowTimestamps(row);
    }, "Failed to fetch chore");
  }

  static async available(homeId: string): Promise<ChoreRow[]> {
    const results = await db<ChoreRow>("chores").where({ home_id: homeId, status: "unclaimed" }).andWhere("user_email", null);
    return results.map(formatRowTimestamps);
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
          .update({ status: "claimed", user_email: email });
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

          // Auto-award points to the assignee
          if (chore.user_email && chore.points > 0) {
            await trx("user_homes")
              .where({ home_id: chore.home_id, user_email: chore.user_email })
              .increment("points", chore.points);
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