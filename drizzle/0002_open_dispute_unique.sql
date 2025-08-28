-- One OPEN dispute per chore
CREATE UNIQUE INDEX IF NOT EXISTS disputes_open_unique
ON disputes (chore_uuid)
WHERE status = 'pending';
