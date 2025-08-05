import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  down(knex)
  return knex.schema.createTable("users", (table) => {
    table.uuid("uuid").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("email").notNullable().unique();
    table.integer("home").notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists("users");
}
