import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Create indexes to speed up recent activity queries
  await knex.raw(
    "CREATE INDEX IF NOT EXISTS idx_chores_completed_at ON chores (completed_at)"
  );
  await knex.raw(
    "CREATE INDEX IF NOT EXISTS idx_chores_status_completed_at ON chores (status, completed_at)"
  );
  await knex.raw(
    "CREATE INDEX IF NOT EXISTS idx_chores_home_status_completed_at ON chores (home_id, status, completed_at)"
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("DROP INDEX IF EXISTS idx_chores_home_status_completed_at");
  await knex.raw("DROP INDEX IF EXISTS idx_chores_status_completed_at");
  await knex.raw("DROP INDEX IF EXISTS idx_chores_completed_at");
}


