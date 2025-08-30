-- Drop and recreate status_events to ensure clean state
DROP TABLE IF EXISTS "status_events";

CREATE TABLE "status_events" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"home_id" uuid NOT NULL,
	"chore_uuid" uuid NOT NULL,
	"type" text NOT NULL,
	"new_status" text NOT NULL,
	"actor_email" text NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "status_events" ADD CONSTRAINT "status_events_home_id_home_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "status_events" ADD CONSTRAINT "status_events_chore_uuid_chores_uuid_fk" FOREIGN KEY ("chore_uuid") REFERENCES "public"."chores"("uuid") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "status_events" ADD CONSTRAINT "status_events_actor_email_users_email_fk" FOREIGN KEY ("actor_email") REFERENCES "public"."users"("email") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;