import db from "./db";
import User, { UserRow } from "./User";

export type ChoreStatus = "unapproved" | "unclaimed" | "claimed" | "complete";

export interface ChoreRow {
  uuid: string;
  name: string;
  description: string;
  time: string;
  icon: string;
  status: ChoreStatus;
  user_id: string | null;
  home_id: string;
  created_at?: Date;
  updated_at?: Date;
}

export default class Chore {
  /* ───────── create ───────── */
  static async create(data: Omit<ChoreRow, "uuid" | "status" | "user_id">) {
    return (
      await db<ChoreRow>("chores")
        .insert({ ...data, status: "unapproved", user_id: null })
        .returning("*")
    )[0];
  }

  /* ───────── lookup helpers ───────── */
  static async findByUuid(uuid: string) {
    const row = await db<ChoreRow>("chores").where({ uuid }).first();
    if (!row) throw new Error(`Chore '${uuid}' not found`);
    return row;
  }

  static byStatus(home_id: string, status: ChoreStatus) {
    return db<ChoreRow>("chores").where({ home_id, status });
  }

  static available(homeId: string) {
    return this.byStatus(homeId, "unclaimed").whereNull("user_id");
  }

  static unapproved(homeId: string) {
    return this.byStatus(homeId, "unapproved");
  }

  /* ───────── user-scoped list ───────── */
  static async forUser(email: string, statuses?: ChoreStatus[]) {
    const user = await User.findByEmail(email);              // throws if absent
    let q = db<ChoreRow>("chores").where({ user_id: user.id });
    if (statuses?.length) q = q.whereIn("status", statuses);
    return q.orderBy("created_at", "desc");
  }

  /* ───────── state transitions ───────── */
  static async approve(uuid: string) {
    await db("chores").where({ uuid, status: "unapproved" }).update({ status: "unclaimed" });
  }

  static async claim(uuid: string, userId: string) {
    const updated = await db("chores")
      .where({ uuid, status: "unclaimed" })
      .update({ status: "claimed", user_id: userId });
    if (!updated) throw new Error("Chore is already claimed or not available");
  }

  static async complete(uuid: string) {
    await db("chores").where({ uuid }).update({ status: "complete" });
  }

  static async verify(uuid: string) {
    // business rule: verifying sets to complete as well
    await db("chores").where({ uuid }).update({ status: "complete" });
  }
}
