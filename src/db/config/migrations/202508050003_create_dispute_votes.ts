import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Create vote_type enum
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE vote_type AS ENUM ('approve', 'reject');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create dispute_votes table for voting on disputes
  await knex.schema.createTable("dispute_votes", (t) => {
    t.uuid("dispute_uuid")
      .notNullable()
      .references("uuid")
      .inTable("disputes")
      .onDelete("CASCADE");
    t.string("user_email")
      .notNullable()
      .references("email")
      .inTable("users")
      .onDelete("CASCADE");
    t.specificType("vote", "vote_type").notNullable(); // 'approve' or 'reject'
    t.timestamp("created_at").defaultTo(knex.raw("get_pacific_timestamp()"));
    t.primary(["dispute_uuid", "user_email"]);
    t.index(["dispute_uuid"]);
    t.index(["user_email"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("dispute_votes");
  // Note: We don't drop the enum type as it might be used elsewhere
} 