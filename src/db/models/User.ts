/***********************
 * src/db/models/User.ts
 ***********************/
import db from "./db";

export interface UserRow {
  id: string;
  email: string;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Many-to-many: users ↔ homes via `user_homes`.
 * Every user *must* be linked to at least one home.
 */
export default class User {
  /** create the user *and* attach to at least one home */
  static async create(email: string, homeIds: string[]): Promise<UserRow> {
    if (!homeIds.length) {
      throw new Error("A user must belong to at least one home");
    }

    return await db.transaction(async (trx) => {
      // 1. insert user
      const user = (
        await trx("users").insert({ email }).returning<UserRow[]>("*")
      )[0];

      // 2. link to homes
      const rows = homeIds.map((home_id) => ({
        user_id: user.id,
        home_id,
      }));
      await trx("user_homes").insert(rows);

      return user;
    });
  }

  static async findByEmail(email: string) {
    return db<UserRow>("users").where({ email }).first();
  }

  /** all homes for a user */
  static async homes(userId: string) {
    return db("homes")
      .join("user_homes", "homes.id", "user_homes.home_id")
      .where("user_homes.user_id", userId)
      .select("homes.*");
  }

  /** add user to an existing home (keeps invariant) */
  static async joinHome(userId: string, homeId: string) {
    await db("user_homes").insert({ user_id: userId, home_id: homeId });
  }

  /** remove user from a home – prevents orphaning */
  static async leaveHome(userId: string, homeId: string) {
    await db.transaction(async (trx) => {
      await trx("user_homes").where({ user_id: userId, home_id: homeId }).del();

      const remaining = await trx("user_homes")
        .where({ user_id: userId })
        .first();

      if (!remaining) {
        throw new Error("User must belong to at least one home");
      }
    });
  }
}
