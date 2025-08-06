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
 * Many-to-many relationship: users ↔ homes via `user_homes`.
 * Invariant: a user must be linked to ≥ 1 home at all times.
 */
export default class User {
  /* ───────────── helpers ───────────── */

  private static async homeExists(homeId: string): Promise<boolean> {
    return !!(await db("homes").where({ id: homeId }).first());
  }

  private static async linkExists(userId: string, homeId: string): Promise<boolean> {
    return !!(await db("user_homes").where({ user_id: userId, home_id: homeId }).first());
  }

  /* ───────────── public API ───────────── */

  /** Create a user *and* attach to at least one existing home. */
  static async create(email: string, homeIds: string[]): Promise<UserRow> {
    if (!homeIds.length) {
      throw new Error("create(): homeIds array is empty – user must belong to at least one home");
    }

    // Verify all supplied homes exist
    const missing = [];
    for (const id of homeIds) {
      if (!(await this.homeExists(id))) missing.push(id);
    }
    if (missing.length) {
      throw new Error(`create(): the following homeIds do not exist: ${missing.join(", ")}`);
    }

    return db.transaction(async (trx) => {
      // 1. insert user
      let user: UserRow;
      try {
        user = (await trx("users").insert({ email }).returning("*"))[0];
      } catch (err: any) {
        if (err.code === "23505") { // unique violation
          throw new Error(`create(): email '${email}' is already registered`);
        }
        throw err;
      }

      // 2. link to homes
      const rows = homeIds.map((home_id) => ({ user_id: user.id, home_id }));
      await trx("user_homes").insert(rows);

      return user;
    });
  }

  /** Look up a user by email; throws if not found. */
  static async findByEmail(email: string): Promise<UserRow> {
    const user = await db<UserRow>("users").where({ email }).first();
    if (!user) throw new Error(`findByEmail(): no user found with email '${email}'`);
    return user;
  }

  /** All homes for a user; throws if userId unknown or has no homes. */
  static async homes(userId: string) {
    const homes = await db("homes")
      .join("user_homes", "homes.id", "user_homes.home_id")
      .where("user_homes.user_id", userId)
      .select("homes.*");

    if (!homes.length) {
      throw new Error(`homes(): user '${userId}' is not linked to any homes`);
    }
    return homes;
  }

  /** Link a user to an existing home; throws on duplicates or bad ids. */
  static async joinHome(userId: string, homeId: string) {
    // Ensure both sides exist
    const [user, home] = await Promise.all([
      db<UserRow>("users").where({ id: userId }).first(),
      db("homes").where({ id: homeId }).first(),
    ]);
    if (!user) throw new Error(`joinHome(): user '${userId}' not found`);
    if (!home) throw new Error(`joinHome(): home '${homeId}' not found`);

    if (await this.linkExists(userId, homeId)) {
      throw new Error(`joinHome(): user '${userId}' is already in home '${homeId}'`);
    }

    await db("user_homes").insert({ user_id: userId, home_id: homeId });
  }

  /** Remove user ↔ home link; prevents orphaning the user. */
  static async leaveHome(userId: string, homeId: string) {
    return db.transaction(async (trx) => {
      const deleted = await trx("user_homes")
        .where({ user_id: userId, home_id: homeId })
        .del();

      if (!deleted) {
        throw new Error(`leaveHome(): user '${userId}' is not linked to home '${homeId}'`);
      }

      const remaining = await trx("user_homes").where({ user_id: userId }).first();
      if (!remaining) {
        throw new Error(`leaveHome(): cannot remove last home – user '${userId}' would be orphaned`);
      }
    });
  }
}
