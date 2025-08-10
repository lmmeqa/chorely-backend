import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Set timezone to Pacific time for this session
  await knex.raw("SET timezone = 'America/Los_Angeles'");
  
  // Create a function to get current Pacific time as timestamp (no timezone)
  await knex.raw(`
    CREATE OR REPLACE FUNCTION get_pacific_timestamp()
    RETURNS timestamp AS $$
    BEGIN
      RETURN (NOW() AT TIME ZONE 'America/Los_Angeles')::timestamp;
    END;
    $$ LANGUAGE plpgsql;
  `);
  
  // 🔥 Always start clean: drop known tables if they exist (child → parent + legacy names)
  const drops = [
    "disputes",
    "chore_approvals",
    "todo_items",
    "chores",
    "user_homes",
    "users",
    "home",
    "homes" // legacy plural, if any
  ];
  for (const tbl of drops) {
    // dropTableIfExists is idempotent and won't error if the table isn't there
    // dropping children first avoids FK issues without needing CASCADE
    // eslint-disable-next-line no-await-in-loop
    await knex.schema.dropTableIfExists(tbl);
  }

  /* home (singular) */
  await knex.schema.createTable("home", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    t.string("name").notNullable();
    t.integer("weekly_point_quota").notNullable().defaultTo(100);
    t.timestamp("created_at").defaultTo(knex.raw("get_pacific_timestamp()"));
    t.timestamp("updated_at").defaultTo(knex.raw("get_pacific_timestamp()"));
  });

  /* users (keep id, but relationships use email) */
  await knex.schema.createTable("users", (t) => {
    t.string("email").primary();
    t.string("name").notNullable();
    t.timestamp("created_at").defaultTo(knex.raw("get_pacific_timestamp()"));
    t.timestamp("updated_at").defaultTo(knex.raw("get_pacific_timestamp()"));
  });

  /* user_homes (email-based FK) */
  await knex.schema.createTable("user_homes", (t) => {
    t.string("user_email")
      .notNullable()
      .references("email")
      .inTable("users")
      .onDelete("CASCADE");
    t.uuid("home_id")
      .notNullable()
      .references("id")
      .inTable("home")
      .onDelete("CASCADE");
    t.integer("points").notNullable().defaultTo(0);
    t.primary(["user_email", "home_id"]);
  });

  /* chores (email-based FK, completed_at) */
  await knex.schema.createTable("chores", (t) => {
    t.uuid("uuid").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    t.string("name").notNullable();
    t.text("description").notNullable();
    t.timestamp("time").notNullable();
    t.string("icon").notNullable();
    t.specificType("status", "chore_status").notNullable().defaultTo("unapproved");
    t.string("user_email")
      .nullable()
      .references("email")
      .inTable("users")
      .onDelete("SET NULL");
    t.uuid("home_id")
      .notNullable()
      .references("id")
      .inTable("home")
      .onDelete("CASCADE");
    t.integer("points").notNullable().defaultTo(10);
    t.timestamp("completed_at").nullable().defaultTo(null);
    t.timestamp("claimed_at").nullable().defaultTo(null);
    t.timestamp("created_at").defaultTo(knex.raw("get_pacific_timestamp()"));
    t.timestamp("updated_at").defaultTo(knex.raw("get_pacific_timestamp()"));

    t.index(["home_id"]);
    t.index(["status"]);
    t.index(["user_email"]);
  });

  /* todo_items */
  await knex.schema.createTable("todo_items", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("chore_id")
      .notNullable()
      .references("uuid")
      .inTable("chores")
      .onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").notNullable();
    t.integer("order").notNullable().defaultTo(0);
  });

  /* chore_approvals (email-based FK) */
  await knex.schema.createTable("chore_approvals", (t) => {
    t.uuid("chore_uuid")
      .notNullable()
      .references("uuid")
      .inTable("chores")
      .onDelete("CASCADE");
    t.string("user_email")
      .notNullable()
      .references("email")
      .inTable("users")
      .onDelete("CASCADE");
    t.primary(["chore_uuid", "user_email"]);
    t.index(["user_email"]);
  });

  /* disputes */
  await knex.schema.createTable("disputes", (t) => {
    t.uuid("uuid").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("chore_id")
      .notNullable()
      .references("uuid")
      .inTable("chores")
      .onDelete("CASCADE");
    t.string("disputer_email")
      .notNullable()
      .references("email")
      .inTable("users")
      .onDelete("CASCADE");
    t.text("reason").notNullable();
    t.string("image_url").nullable();
    t.specificType("status", "dispute_status").notNullable().defaultTo("pending");
    t.timestamp("created_at").defaultTo(knex.raw("get_pacific_timestamp()"));
    t.timestamp("updated_at").defaultTo(knex.raw("get_pacific_timestamp()"));

    t.index(["status"]);
    t.index(["chore_id"]);
    t.index(["disputer_email"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  // Also destructive on down for symmetry
  await knex.schema.dropTableIfExists("disputes");
  await knex.schema.dropTableIfExists("chore_approvals");
  await knex.schema.dropTableIfExists("todo_items");
  await knex.schema.dropTableIfExists("chores");
  await knex.schema.dropTableIfExists("user_homes");
  await knex.schema.dropTableIfExists("users");
  await knex.schema.dropTableIfExists("home");
  await knex.schema.dropTableIfExists("homes"); // legacy
}
