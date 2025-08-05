import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {

  return knex.schema.createTable("chores", (table) => {
    table.uuid("uuid").primary().defaultTo(knex.raw("gen_random_uuid()"));
    // table.uuid("template_id").references("id").inTable("chore_templates").onDelete("CASCADE");
    // table.uuid("user_id").references("id").inTable("users").defaultTo("NULL");
    table.string("status").notNullable().defaultTo("unapproved");
    // table.integer("time").notNullable().defaultTo(30);
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists("chores");
}
