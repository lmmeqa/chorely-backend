// Legacy BaseModel used in unit tests; the real app uses Drizzle via Worker.
export const db: any = (table: string) => ({
  where: (_criteria: any) => ({ first: async () => undefined, update: async () => 0, del: async () => 0 }),
  fn: { now: () => new Date().toISOString() },
});
import { ModelError } from "./ModelError";
export { ModelError } from "./ModelError";

// ────────────────────────────────
// Base Model Class
// ────────────────────────────────
export abstract class BaseModel<T> {
  protected static async getOrThrow<R>(
    table: string, 
    where: Record<string, any>, 
    errorMsg: string
  ): Promise<R> {
    const row = await db(table).where(where).first();
    if (!row) throw new ModelError("NOT_FOUND", errorMsg, 404);
    return formatRowTimestamps(row);
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

// ────────────────────────────────
// Shared Database Utilities
// ────────────────────────────────
export const dbGuard = async <T>(fn: () => Promise<T>, operation: string): Promise<T> => {
  try {
    const result = await fn();
    return result;
  } catch (e: any) {
    // Skip if DB logging is muted
    if (process.env.MUTE_DB_LOGS !== 'true') {
      console.error(`\x1b[31m[DB]\x1b[0m ${operation} failed: ${e.message}`);
    }
    if (e instanceof ModelError) throw e;
    throw new ModelError("DB_ERROR", e?.message || `Database operation failed: ${operation}`, 500);
  }
};

export const mapFk = (e: any, fallback = "Database constraint violation") => {
  // Preserve explicit model errors with their original HTTP status codes
  if (e instanceof ModelError) return e;
  if (e?.code === "23503") {
    const detail = String(e?.detail || "");
    const match = detail.match(/Key \((.*?)\)=\((.*?)\)/);
    const field = match?.[1];
    const value = match?.[2];
    
    if (detail.includes("home_id")) 
      return new ModelError("HOME_NOT_FOUND", `Home '${value}' does not exist`, 404);
    if (detail.includes("user_email")) 
      return new ModelError("USER_NOT_FOUND", `User with email '${value}' does not exist`, 404);
    if (detail.includes("chore_id") || detail.includes("chore_uuid")) 
      return new ModelError("CHORE_NOT_FOUND", `Chore '${value}' does not exist`, 404);
    if (detail.includes("disputer_email")) 
      return new ModelError("USER_NOT_FOUND", `User with email '${value}' does not exist`, 404);
    
    return new ModelError(
      "FK_VIOLATION", 
      `Referenced ${field} '${value}' does not exist`, 
      409
    );
  }
  
  // Handle unique constraint violations
  if (e?.code === "23505") {
    const match = e.detail?.match(/Key \((.*?)\)=\((.*?)\)/);
    const field = match?.[1];
    const value = match?.[2];
    return new ModelError(
      "DUPLICATE", 
      `A record with ${field} '${value}' already exists`, 
      409
    );
  }
  
  return new ModelError("DB_ERROR", e?.message || fallback, 500);
};

// ────────────────────────────────
// Validation Utilities
// ────────────────────────────────
export const isEmail = (v: unknown): v is string => 
  typeof v === "string" && /.+@.+\..+/.test(v);

export const ensureEmail = (email: string) => {
  if (!isEmail(email)) throw new ModelError("INVALID_EMAIL", `'${email}' is not a valid email address`);
};

export const ensureHomeId = (homeId: string) => {
  if (!(typeof homeId === "string" && homeId.length > 0)) {
    throw new ModelError("INVALID_HOME_ID", "Home ID is required and must be a non-empty string");
  }
};

export const ensureUuid = (uuid: string) => {
  if (!(typeof uuid === "string" && uuid.length > 0)) {
    throw new ModelError("INVALID_UUID", "UUID is required and must be a non-empty string");
  }
};

// ────────────────────────────────
// Timestamp Utilities
// ────────────────────────────────
export const formatTimestampToPacific = (timestamp: string | Date | null): string | null => {
  if (!timestamp) return null;
  
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+):(\d+)/, "$3-$1-$2T$4:$5:$6");
};

export const formatRowTimestamps = <T extends Record<string, any>>(row: T): T => {
  const formatted = { ...row } as any;
  if (formatted.created_at) {
    formatted.created_at = formatTimestampToPacific(formatted.created_at);
  }
  if (formatted.updated_at) {
    formatted.updated_at = formatTimestampToPacific(formatted.updated_at);
  }
  if (formatted.completed_at) {
    formatted.completed_at = formatTimestampToPacific(formatted.completed_at);
  }
  if (formatted.claimed_at) {
    formatted.claimed_at = formatTimestampToPacific(formatted.claimed_at);
  }
  if (formatted.time) {
    formatted.time = formatTimestampToPacific(formatted.time);
  }
  return formatted as T;
};