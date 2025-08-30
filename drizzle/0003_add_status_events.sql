-- Add status events table for activity tracking
CREATE TABLE "status_events" (
  "uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "home_id" uuid NOT NULL REFERENCES "home"("id") ON DELETE CASCADE,
  "chore_uuid" uuid NOT NULL REFERENCES "chores"("uuid") ON DELETE CASCADE,
  "type" text NOT NULL,
  "new_status" text NOT NULL,
  "actor_email" text NOT NULL REFERENCES "users"("email") ON DELETE CASCADE,
  "ts" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX "idx_status_events_home_id" ON "status_events" ("home_id");
CREATE INDEX "idx_status_events_ts_uuid" ON "status_events" ("ts" DESC, "uuid" DESC);
CREATE INDEX "idx_status_events_type" ON "status_events" ("type");