import { db } from "./index";
import { ModelError, dbGuard, BaseModel } from "./BaseModel";

export interface HomeRow {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export default class Home extends BaseModel<HomeRow> {
  static async create(name: string): Promise<HomeRow> {
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw new ModelError("INVALID_NAME", "Home name is required");
    }

    return dbGuard(async () => {
      return (await db<HomeRow>("home").insert({ name: name.trim() }).returning("*"))[0];
    }, "Failed to create home");
  }

  static async findById(id: string): Promise<HomeRow | null> {
    return dbGuard(async () => {
      return await db<HomeRow>("home").where({ id }).first() || null;
    }, "Failed to fetch home");
  }

  static async all(): Promise<HomeRow[]> {
    return dbGuard(async () => {
      return await db<HomeRow>("home").orderBy("name");
    }, "Failed to fetch homes");
  }

  static async updateWeeklyQuota(id: string, weeklyPointQuota: number): Promise<void> {
    if (typeof weeklyPointQuota !== "number" || weeklyPointQuota < 0) {
      throw new ModelError("INVALID_QUOTA", "Weekly point quota must be a non-negative number");
    }

    return dbGuard(async () => {
      await this.updateOrThrow("home", { id }, { weekly_point_quota: weeklyPointQuota }, "Home not found");
    }, "Failed to update weekly quota");
  }
}