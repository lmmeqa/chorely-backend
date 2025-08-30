-- Add partial unique index to prevent multiple pending disputes per chore
-- Drop existing if present
DROP INDEX IF EXISTS "idx_disputes_open_unique";
-- Create with proper enum casting
CREATE UNIQUE INDEX "idx_disputes_open_unique" ON "disputes" ("chore_id") WHERE "status" = 'pending'::dispute_status;