/***********************
 * src/db/models/User.ts
 ***********************/
import { db } from "./index";
import { ModelError, dbGuard, mapFk, ensureEmail, ensureHomeId, BaseModel, formatRowTimestamps } from "./BaseModel";


export interface UserRow {
  email: string;  // PK
  name: string;
  created_at?: string;
  updated_at?: string;
}

export default class User extends BaseModel<UserRow> {
  // ────────────────────────────────
  // Private helper methods
  // ────────────────────────────────
  private static async getUserOrThrow(email: string): Promise<UserRow> {
    return this.getOrThrow("users", { email }, `User not found: '${email}'`);
  }

  private static async getHomeOrThrow(homeId: string) {
    return this.getOrThrow("home", { id: homeId }, "Home not found");
  }

  // ────────────────────────────────
  // Create and Find Methods
  // ────────────────────────────────
  static async create(email: string, homeIds: string[], name = ""): Promise<UserRow> {
    ensureEmail(email);
    const ids = (Array.isArray(homeIds) ? homeIds : []).filter(Boolean);

    return dbGuard(async () => {
      const user = (await db<UserRow>("users")
        .insert({ email, name })
        .onConflict("email")
        .merge()
        .returning("*"))[0];

      if (ids.length) {
        // validate all homes exist before inserting links
        const existing = await db("home").whereIn("id", ids).pluck("id");
        if (existing.length !== ids.length) {
          throw new ModelError("HOME_NOT_FOUND", "One or more homes do not exist", 404);
        }
        await db("user_homes")
          .insert(ids.map((home_id) => ({ user_email: email, home_id })))
          .onConflict(["user_email", "home_id"]).ignore();
      }

      return formatRowTimestamps(user);
    }, "Failed to create user");
  }

  static async findByEmail(email: string): Promise<UserRow> {
    ensureEmail(email);
    return dbGuard(() => this.getUserOrThrow(email), "Failed to fetch user");
  }

  // ────────────────────────────────
  // Home Relations
  // ────────────────────────────────
  static async homes(email: string) {
    ensureEmail(email);
    return dbGuard(async () => {
      await this.getUserOrThrow(email);
      const rows = await db("home")
        .join("user_homes", "home.id", "user_homes.home_id")
        .where({ user_email: email })
        .select("home.*");
      if (!rows.length) throw new ModelError("NO_HOMES", `User '${email}' has no homes`, 404);
      return rows.map(formatRowTimestamps);
    }, "Failed to fetch user homes");
  }

  static async joinHome(email: string, homeId: string) {
    ensureEmail(email);
    ensureHomeId(homeId);
    return dbGuard(async () => {
      await this.getUserOrThrow(email);
      await this.getHomeOrThrow(homeId);
      await db("user_homes")
        .insert({ user_email: email, home_id: homeId })
        .onConflict(["user_email", "home_id"]).ignore();
    }, "Failed to join home");
  }

  static async leaveHome(email: string, homeId: string) {
    ensureEmail(email);
    ensureHomeId(homeId);
    return dbGuard(async () => {
      await this.getUserOrThrow(email);
      await this.getHomeOrThrow(homeId);

      await db.transaction(async (trx) => {
        const deleted = await trx("user_homes")
          .where({ user_email: email, home_id: homeId })
          .del();
        if (!deleted) throw new ModelError("NOT_MEMBER", `User '${email}' is not in home '${homeId}'`, 404);

        const remaining = await trx("user_homes").where({ user_email: email }).first();
        if (!remaining) throw new ModelError("LAST_HOME", `Cannot remove last home for '${email}'`, 409);
      });
    }, "Failed to leave home");
  }

  static async byHome(homeId: string) {
    ensureHomeId(homeId);
    return dbGuard(async () => {
      await this.getHomeOrThrow(homeId);
      const rows = await db("users")
        .join("user_homes", "users.email", "user_homes.user_email")
        .where("user_homes.home_id", homeId)
        .select("users.*");
      // returning [] is acceptable here (home exists; no members)
      return rows.map(formatRowTimestamps);
    }, "Failed to fetch users by home");
  }
}