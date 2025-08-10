import knex from "knex";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require("../config/knexfile");

// ────────────────────────────────
// Database Connection with Logging
// ────────────────────────────────
const dbInstance = knex(config);

// Add query logging
dbInstance.on('query', (query) => {
  // Skip if DB logging is muted
  if (process.env.MUTE_DB_LOGS === 'true') return;
  
  // Extract table name from SQL or query object
  let tableName = 'unknown';
  if (query.table) {
    tableName = query.table;
  } else if (query.sql) {
    // Try to extract table name from SQL
    const match = query.sql.match(/(?:from|into|update)\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/i);
    if (match) {
      tableName = match[1];
    }
  }
  
  // Show SQL with actual values substituted
  let sqlWithValues = query.sql;
  if (query.bindings && query.bindings.length > 0) {
    query.bindings.forEach((binding: any, index: number) => {
      const placeholder = `$${index + 1}`;
      const value = typeof binding === 'string' ? `'${binding}'` : binding;
      sqlWithValues = sqlWithValues.replace(placeholder, value);
    });
  }
  
  console.log(`\x1b[36m[DB]\x1b[0m ${query.method} ${tableName} - ${sqlWithValues}`);
});

dbInstance.on('query-error', (error, query) => {
  // Skip if DB error logging is muted
  if (process.env.MUTE_DB_LOGS === 'true') return;
  
  console.error(`\x1b[31m[DB ERROR]\x1b[0m ${error.message}`, {
    sql: query.sql,
    method: query.method
  });
});

export const db = dbInstance;
export default db;

// ────────────────────────────────
// Shared Utilities & Base Classes
// ────────────────────────────────
export { ModelError } from "./ModelError";
export {
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
export { default as DisputeVote } from "./DisputeVote";
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
export type { DisputeVoteRow, VoteType, DisputeVoteStatus } from "./DisputeVote";
export type { TodoRow } from "./Todo";
export type { UserHomeRow } from "./Points";