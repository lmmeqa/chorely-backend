import { db } from "./index";
import { ModelError, dbGuard, ensureEmail, ensureHomeId, BaseModel } from "./BaseModel";

export interface UserHomeRow {
  user_email: string;
  home_id: string;
  points: number;
}

export default class Points extends BaseModel<UserHomeRow> {
  static async getAll(homeId: string): Promise<UserHomeRow[]> {
    ensureHomeId(homeId);
    return dbGuard(async () => {
      return await db<UserHomeRow>("user_homes").where({ home_id: homeId }).orderBy("points", "desc");
    }, "Failed to fetch points for home");
  }

  static async get(homeId: string, email: string): Promise<number> {
    ensureHomeId(homeId);
    ensureEmail(email);
    return dbGuard(async () => {
      const row = await db<UserHomeRow>("user_homes").where({ home_id: homeId, user_email: email }).first();
      return row?.points || 0;
    }, "Failed to fetch user points");
  }

  static async add(homeId: string, email: string, delta: number): Promise<number> {
    ensureHomeId(homeId);
    ensureEmail(email);
    
    if (typeof delta !== "number" || isNaN(delta)) {
      throw new ModelError("INVALID_DELTA", "Delta must be a valid number");
    }

    return dbGuard(async () => {
      const result = await db("user_homes")
        .insert({ home_id: homeId, user_email: email, points: delta })
        .onConflict(["home_id", "user_email"])
        .merge(db.raw("points = points + ?", [delta]))
        .returning("points");
      
      return result[0]?.points || 0;
    }, "Failed to add points");
  }
}
