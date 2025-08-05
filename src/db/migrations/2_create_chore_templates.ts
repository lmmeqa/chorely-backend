import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {

  return knex.schema.createTable("chore_templates", (table) => {
    table.uuid("uuid").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("name").notNullable();
    table.text("description");
    table.string("icon").notNullable();
    table.integer("default_time").defaultTo(30);
    table.jsonb("todos").defaultTo("[]");
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists("chore_templates");
}
