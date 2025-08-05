import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("chores", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("template_id").references("id").inTable("chore_templates").onDelete("SET NULL");
    table.uuid("user_id").references("id").inTable("users").defaultTo("NULL");
    table.string("status").notNullable().defaultTo("unapproved");
    table.string("time").notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists("chores");
}
