import { db } from "./index";
import { ModelError, dbGuard, mapFk, ensureUuid } from "./BaseModel";

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
  static async create(data: Omit<ChoreRow, "uuid" | "status" | "user_email" | "completed_at" | "created_at" | "updated_at"> & { user_email?: string | null }) {
    return dbGuard(async () => {
      try {
        return (await db<ChoreRow>("chores")
          .insert({ ...data, status: "unapproved", user_email: data.user_email ?? null, completed_at: null })
          .returning("*"))[0];
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
      return row;
    }, "Failed to fetch chore");
  }

  static available(homeId: string) {
    return db<ChoreRow>("chores").where({ home_id: homeId, status: "unclaimed" }).andWhere("user_email", null);
  }

  static unapproved(homeId: string) {
    return db<ChoreRow>("chores").where({ home_id: homeId, status: "unapproved" });
  }

  static forUser(email: string, homeId: string) {
    return db<ChoreRow>("chores").where({ user_email: email, home_id: homeId }).whereIn("status", ["claimed", "complete"]);
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
      const n = await db("chores").where({ uuid }).update({ status: "complete", completed_at: db.fn.now() });
      if (!n) throw new ModelError("CHORE_NOT_FOUND", `Chore not found: '${uuid}'`, 404);
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