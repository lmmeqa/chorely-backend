import { Knex } from "knex";
export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await knex.raw(`
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chore_status') THEN
    CREATE TYPE chore_status AS ENUM
      ('unapproved','unclaimed','claimed','complete');
  END IF;
END$$;
`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP EXTENSION IF EXISTS "uuid-ossp"');
}
