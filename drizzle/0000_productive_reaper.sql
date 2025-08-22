CREATE TYPE "public"."chore_status" AS ENUM('unapproved', 'unclaimed', 'claimed', 'complete');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('pending', 'sustained', 'overruled');--> statement-breakpoint
CREATE TYPE "public"."vote_type" AS ENUM('sustain', 'overrule');--> statement-breakpoint
CREATE TABLE "chore_approvals" (
	"chore_uuid" uuid NOT NULL,
	"user_email" text NOT NULL,
	CONSTRAINT "chore_approvals_chore_uuid_user_email_pk" PRIMARY KEY("chore_uuid","user_email")
);
--> statement-breakpoint
CREATE TABLE "chores" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"time" timestamp NOT NULL,
	"icon" text NOT NULL,
	"status" "chore_status" DEFAULT 'unapproved' NOT NULL,
	"user_email" text,
	"home_id" uuid NOT NULL,
	"points" integer DEFAULT 10 NOT NULL,
	"completed_at" timestamp,
	"claimed_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"photo_url" text
);
--> statement-breakpoint
CREATE TABLE "dispute_votes" (
	"dispute_uuid" uuid NOT NULL,
	"user_email" text NOT NULL,
	"vote" "vote_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dispute_votes_dispute_uuid_user_email_pk" PRIMARY KEY("dispute_uuid","user_email")
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chore_id" uuid NOT NULL,
	"disputer_email" text NOT NULL,
	"reason" text NOT NULL,
	"image_url" text,
	"status" "dispute_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"photo_url" text
);
--> statement-breakpoint
CREATE TABLE "home" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"weekly_point_quota" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "todo_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chore_id" uuid NOT NULL,
	"name" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_homes" (
	"user_email" text NOT NULL,
	"home_id" uuid NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_homes_user_email_home_id_pk" PRIMARY KEY("user_email","home_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"email" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"supabase_user_id" uuid,
	"auth_user_id" uuid,
	"avatar_url" text,
	"last_provider" text,
	"last_login" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_supabase_user_id_unique" UNIQUE("supabase_user_id"),
	CONSTRAINT "users_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
ALTER TABLE "chore_approvals" ADD CONSTRAINT "chore_approvals_chore_uuid_chores_uuid_fk" FOREIGN KEY ("chore_uuid") REFERENCES "public"."chores"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_approvals" ADD CONSTRAINT "chore_approvals_user_email_users_email_fk" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_user_email_users_email_fk" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_home_id_home_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_votes" ADD CONSTRAINT "dispute_votes_dispute_uuid_disputes_uuid_fk" FOREIGN KEY ("dispute_uuid") REFERENCES "public"."disputes"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_votes" ADD CONSTRAINT "dispute_votes_user_email_users_email_fk" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_chore_id_chores_uuid_fk" FOREIGN KEY ("chore_id") REFERENCES "public"."chores"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_disputer_email_users_email_fk" FOREIGN KEY ("disputer_email") REFERENCES "public"."users"("email") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_items" ADD CONSTRAINT "todo_items_chore_id_chores_uuid_fk" FOREIGN KEY ("chore_id") REFERENCES "public"."chores"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_homes" ADD CONSTRAINT "user_homes_user_email_users_email_fk" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_homes" ADD CONSTRAINT "user_homes_home_id_home_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chore_approvals_user_email" ON "chore_approvals" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX "idx_chores_home_id" ON "chores" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "idx_chores_status" ON "chores" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_chores_user_email" ON "chores" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX "idx_chores_completed_at" ON "chores" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "idx_chores_status_completed_at" ON "chores" USING btree ("status","completed_at");--> statement-breakpoint
CREATE INDEX "idx_chores_home_status_completed_at" ON "chores" USING btree ("home_id","status","completed_at");--> statement-breakpoint
CREATE INDEX "idx_dispute_votes_dispute_uuid" ON "dispute_votes" USING btree ("dispute_uuid");--> statement-breakpoint
CREATE INDEX "idx_dispute_votes_user_email" ON "dispute_votes" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX "idx_disputes_status" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_disputes_chore_id" ON "disputes" USING btree ("chore_id");--> statement-breakpoint
CREATE INDEX "idx_disputes_disputer_email" ON "disputes" USING btree ("disputer_email");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_todo_items_chore_order_unique" ON "todo_items" USING btree ("chore_id","order");