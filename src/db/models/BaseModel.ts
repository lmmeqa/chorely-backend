import { db } from "./index";

// ────────────────────────────────
// Shared Error Class
// ────────────────────────────────
export class ModelError extends Error {
  code: string;
  http: number;
  
  constructor(code: string, message: string, http = 400) {
    super(message);
    this.code = code;
    this.http = http;
  }
}

// ────────────────────────────────
// Shared Database Utilities
// ────────────────────────────────
export const dbGuard = async <T>(fn: () => Promise<T>, msg: string): Promise<T> => {
  try {
    return await fn();
  } catch (e: any) {
    if (e instanceof ModelError) throw e;
    throw new ModelError("DB_ERROR", e?.message || msg, 500);
  }
};

export const mapFk = (e: any, fallback = "FK violation") => {
  if (e?.code === "23503") {
    const d = String(e?.detail || "");
    if (d.includes("home_id")) return new ModelError("HOME_NOT_FOUND", "Home not found", 404);
    if (d.includes("user_email")) return new ModelError("USER_NOT_FOUND", "User not found", 404);
    if (d.includes("chore_id") || d.includes("chore_uuid")) return new ModelError("CHORE_NOT_FOUND", "Chore not found", 404);
    if (d.includes("disputer_email")) return new ModelError("USER_NOT_FOUND", "User not found", 404);
    return new ModelError("FK_VIOLATION", fallback, 409);
  }
  return new ModelError("DB_ERROR", e?.message || fallback, 500);
};

// ────────────────────────────────
// Validation Utilities
// ────────────────────────────────
export const isEmail = (v: unknown): v is string => 
  typeof v === "string" && /.+@.+\..+/.test(v);

export const ensureEmail = (email: string) => {
  if (!isEmail(email)) throw new ModelError("INVALID_EMAIL", "'email' must be a valid email");
};

export const ensureHomeId = (homeId: string) => {
  if (!(typeof homeId === "string" && homeId.length > 0)) {
    throw new ModelError("INVALID_HOME_ID", "'homeId' is required");
  }
};

export const ensureUuid = (uuid: string) => {
  if (!(typeof uuid === "string" && uuid.length > 0)) {
    throw new ModelError("INVALID_UUID", "'uuid' is required");
  }
};

// ────────────────────────────────
// Base Model Class
// ────────────────────────────────
export abstract class BaseModel<T> {
  protected static async getOrThrow<T>(
    table: string, 
    where: Record<string, any>, 
    errorMsg: string
  ): Promise<T> {
    const row = await db(table).where(where).first();
    if (!row) throw new ModelError("NOT_FOUND", errorMsg, 404);
    return row;
  }

  protected static async updateOrThrow(
    table: string, 
    where: Record<string, any>, 
    data: Record<string, any>,
    errorMsg: string
  ): Promise<void> {
    const n = await db(table).where(where).update(data);
    if (!n) throw new ModelError("NOT_FOUND", errorMsg, 404);
  }

  protected static async deleteOrThrow(
    table: string, 
    where: Record<string, any>, 
    errorMsg: string
  ): Promise<void> {
    const n = await db(table).where(where).del();
    if (!n) throw new ModelError("NOT_FOUND", errorMsg, 404);
  }
}
