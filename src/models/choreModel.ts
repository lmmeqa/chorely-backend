/**
 * Data-access utilities for Chore records.
 * Pure SQL ☞ no business logic: controllers own that.
 */

import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
type ChoreStatus = "unapproved" | "unclaimed" | "claimed" | "complete";

/* A single shared connection-pool – pg handles pooling internally */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/* ---------- CRUD helpers ---------- */

/** INSERT a brand-new chore in “unapproved” state and return it */
export const createChore = async (
  payload: { name: string; description: string; time?: string; icon?: string }
) => {
  const uuid = uuidv4();

  await pool.query(
    `INSERT INTO chores (uuid,name,description,time,icon,status)
     VALUES ($1,$2,$3,$4,$5,'unapproved')`,
    [uuid, payload.name, payload.description, payload.time, payload.icon]
  );

  return getChore(uuid);
};

/** Fetch a single chore row (or undefined) */
export const getChore = async (uuid: string) => {
  const { rows } = await pool.query(
    `SELECT * FROM chores WHERE uuid = $1`,
    [uuid]
  );
  return rows[0];
};

/** List chores by status, optionally filtered by user_email */
export const listByStatus = async (
  status: ChoreStatus,
  email?: string
) => {
  const { rows } = await pool.query(
    `SELECT * FROM chores
       WHERE status = $1
         AND ($2::text IS NULL OR user_email = $2)`,
    [status, email ?? null]
  );
  return rows;
};

/** Update status (+ optionally claim/release user) and return row */
export const updateStatus = async (
  uuid: string,
  status: ChoreStatus,
  email?: string | null
) => {
  await pool.query(
    `UPDATE chores
        SET status     = $2,
            user_email = COALESCE($3,user_email)
      WHERE uuid = $1`,
    [uuid, status, email]
  );
  return getChore(uuid);
};
