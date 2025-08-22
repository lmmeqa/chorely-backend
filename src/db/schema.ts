import { pgTable, uuid, text, timestamp, integer, pgEnum, index, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";

// Enums
export const choreStatusEnum = pgEnum("chore_status", ["unapproved", "unclaimed", "claimed", "complete"]);
export const disputeStatusEnum = pgEnum("dispute_status", ["pending", "sustained", "overruled"]);
export const voteTypeEnum = pgEnum("vote_type", ["sustain", "overrule"]);

// Tables
export const homes = pgTable("home", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  weeklyPointQuota: integer("weekly_point_quota").notNull().default(100),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  email: text("email").primaryKey(),
  name: text("name").notNull(),
  // Supabase identity cache
  supabaseUserId: uuid("supabase_user_id").unique(),
  authUserId: uuid("auth_user_id").unique(), // Supabase JWT `sub`
  avatarUrl: text("avatar_url"),
  lastProvider: text("last_provider"),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userHomes = pgTable("user_homes", {
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  homeId: uuid("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  points: integer("points").notNull().default(0),
}, (table) => ({
  pk: primaryKey({ columns: [table.userEmail, table.homeId] }),
}));

export const chores = pgTable("chores", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  time: timestamp("time").notNull(),
  icon: text("icon").notNull(),
  status: choreStatusEnum("status").notNull().default("unapproved"),
  userEmail: text("user_email").references(() => users.email, { onDelete: "set null" }),
  homeId: uuid("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  points: integer("points").notNull().default(10),
  completedAt: timestamp("completed_at"),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  photoUrl: text("photo_url"),
}, (table) => ({
  // Basic indexes
  homeIdIdx: index("idx_chores_home_id").on(table.homeId),
  statusIdx: index("idx_chores_status").on(table.status),
  userEmailIdx: index("idx_chores_user_email").on(table.userEmail),
  
  // Activity indexes (from add_activity_indexes.ts)
  completedAtIdx: index("idx_chores_completed_at").on(table.completedAt),
  statusCompletedAtIdx: index("idx_chores_status_completed_at").on(table.status, table.completedAt),
  homeStatusCompletedAtIdx: index("idx_chores_home_status_completed_at").on(table.homeId, table.status, table.completedAt),
}));

export const todoItems = pgTable("todo_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  choreId: uuid("chore_id").notNull().references(() => chores.uuid, { onDelete: "cascade" }),
  name: text("name").notNull(),
  order: integer("order").notNull().default(0),
}, (table) => ({
  choreOrderUnique: uniqueIndex("idx_todo_items_chore_order_unique").on(table.choreId, table.order),
}));

export const choreApprovals = pgTable("chore_approvals", {
  choreUuid: uuid("chore_uuid").notNull().references(() => chores.uuid, { onDelete: "cascade" }),
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.choreUuid, table.userEmail] }),
  userEmailIdx: index("idx_chore_approvals_user_email").on(table.userEmail),
}));

export const disputes = pgTable("disputes", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  choreId: uuid("chore_id").notNull().references(() => chores.uuid, { onDelete: "cascade" }),
  disputerEmail: text("disputer_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  imageUrl: text("image_url"),
  status: disputeStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  photoUrl: text("photo_url"),
}, (table) => ({
  statusIdx: index("idx_disputes_status").on(table.status),
  choreIdIdx: index("idx_disputes_chore_id").on(table.choreId),
  disputerEmailIdx: index("idx_disputes_disputer_email").on(table.disputerEmail),
}));

export const disputeVotes = pgTable("dispute_votes", {
  disputeUuid: uuid("dispute_uuid").notNull().references(() => disputes.uuid, { onDelete: "cascade" }),
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  vote: voteTypeEnum("vote").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.disputeUuid, table.userEmail] }),
  disputeUuidIdx: index("idx_dispute_votes_dispute_uuid").on(table.disputeUuid),
  userEmailIdx: index("idx_dispute_votes_user_email").on(table.userEmail),
}));
