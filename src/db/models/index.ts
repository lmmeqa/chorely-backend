import knex from "knex";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require("../config/knexfile");

// ────────────────────────────────
// Database Connection
// ────────────────────────────────
export const db = knex(config);
export default db;

// ────────────────────────────────
// Shared Utilities & Base Classes
// ────────────────────────────────
export {
  ModelError,
  dbGuard,
  mapFk,
  isEmail,
  ensureEmail,
  ensureHomeId,
  ensureUuid,
  BaseModel
} from "./BaseModel";

// ────────────────────────────────
// Database Models
// ────────────────────────────────
export { default as User } from "./User";
export { default as Home } from "./Home";
export { default as Chore } from "./Chore";
export { default as Dispute } from "./Dispute";
export { default as Approval } from "./Approval";
export { default as TodoItem } from "./Todo";

export { default as Points } from "./Points";

// ────────────────────────────────
// Type Exports
// ────────────────────────────────
export type { UserRow } from "./User";
export type { HomeRow } from "./Home";
export type { ChoreRow, ChoreStatus } from "./Chore";
export type { DisputeRow, DisputeStatus } from "./Dispute";
export type { TodoRow } from "./Todo";

export type { UserHomeRow } from "./Points";
