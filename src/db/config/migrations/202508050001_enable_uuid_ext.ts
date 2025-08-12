import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chore_status') THEN
        CREATE TYPE chore_status AS ENUM ('unapproved','unclaimed','claimed','complete');
      END IF;
    END $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_status') THEN
        CREATE TYPE dispute_status AS ENUM ('pending','approved','rejected');
      END IF;
    END $$;
  `);
    // Create vote_type enum
    await knex.raw(`
      DO $$ BEGIN
        CREATE TYPE vote_type AS ENUM ('approve', 'reject');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
}


export async function down(knex: Knex): Promise<void> {
  // Keep uuid-ossp installed (avoids failure if any table defaults use uuid_generate_v4()).
  await knex.raw(`DROP TYPE IF EXISTS dispute_status CASCADE`);
  await knex.raw(`DROP TYPE IF EXISTS chore_status CASCADE`);
  await knex.raw(`DROP TYPE IF EXISTS vote_type CASCADE`);
}
