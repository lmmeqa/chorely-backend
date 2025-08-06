
/***********************
 * src/models/Chore
 * src/models/Chore.ts
 ***********************/
import db from "./db";
export interface ChoreRow {
  uuid: string;
  name: string;
  description: string;
  time: string;
  icon: string;
  status: "unapproved" | "unclaimed" | "claimed" | "complete";
  user_id: string | null;
  home_id: string;
}
export default class Chore {
  static async create(data: Omit<ChoreRow, "uuid">): Promise<ChoreRow> {
    return (await db("chores").insert(data).returning("*"))[0];
  }

  static byStatus(home_id: string, status: ChoreRow["status"]) {
    return db<ChoreRow>("chores").where({ home_id, status });
  }

  static async claim(uuid: string, user_id: string) {
    await db("chores").where({ uuid, status: "unclaimed" }).update({ status: "claimed", user_id });
  }

  static async complete(uuid: string) {
    await db("chores").where({ uuid }).update({ status: "complete" });
  }
}
