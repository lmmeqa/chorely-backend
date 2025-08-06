import { Knex } from "knex";
export async function up(knex: Knex) {
  /* homes */
  await knex.schema.createTable("homes", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    t.string("name").notNullable();
    t.string("address").notNullable();
    t.timestamps(true, true);
  });

  /* users */
  await knex.schema.createTable("users", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    t.string("email").notNullable().unique();
    t.timestamps(true, true);
  });

  /* many‑to‑many join */
  await knex.schema.createTable("user_homes", (t) => {
    t.uuid("user_id").references("id").inTable("users").onDelete("CASCADE");
    t.uuid("home_id").references("id").inTable("homes").onDelete("CASCADE");
    t.primary(["user_id", "home_id"]);
  });


  /* chores */
  await knex.schema.createTable("chores", (t) => {
    t.uuid("uuid").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    t.string("name").notNullable();
    t.text("description").notNullable();
    t.string("time").notNullable();
    t.string("icon").notNullable();
    t.specificType("status", "chore_status").notNullable().defaultTo("unapproved");
    t.uuid("user_id").references("id").inTable("users").onDelete("SET NULL");
    t.uuid("home_id").references("id").inTable("homes").onDelete("CASCADE");
    t.timestamps(true, true);
  });

  /* todo_items */
  await knex.schema.createTable("todo_items", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("chore_id").references("uuid").inTable("chores").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").notNullable();
    t.integer("order").notNullable().defaultTo(0);
  });
}
export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists("todo_items");
  await knex.schema.dropTableIfExists("chores");
  await knex.schema.dropTableIfExists("user_homes");
  await knex.schema.dropTableIfExists("users");
  await knex.schema.dropTableIfExists("homes");
  await knex.raw("DROP TYPE IF EXISTS chore_status");
}
