-- 0. shared helpers -----------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE chore_status AS ENUM (
  'unapproved',  -- needs an admin ✓ before it can be claimed
  'unclaimed',   -- open to everyone
  'claimed',     -- someone is working on it
  'complete'     -- finished and verified
);

-- utility function for automatic updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

-------------------------------------------------------------------------------
-- 1. people -------------------------------------------------------------------
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_users_timestamp
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-------------------------------------------------------------------------------
-- 2. chore templates  (optional) ---------------------------------------------
-- If you want reusable templates, keep them here.
CREATE TABLE chore_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  default_time INTERVAL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_templates_timestamp
  BEFORE UPDATE ON chore_templates FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-------------------------------------------------------------------------------
-- 3. chores -------------------------------------------------------------------
CREATE TABLE chores (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id  UUID REFERENCES chore_templates(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  estimate     INTERVAL,            -- “1h 15m” → INTERVAL '1h 15m'
  icon         TEXT,
  status       chore_status NOT NULL DEFAULT 'unapproved',
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX chores_status_idx ON chores(status);
CREATE TRIGGER trg_chores_timestamp
  BEFORE UPDATE ON chores FOR EACH ROW EXECUTE PROCEDURE set_updated_at();



-------------------------------------------------------------------------------
-- 6. audit log  (keeps every status change) ----------------------------------
CREATE TABLE chore_events (
  id          BIGSERIAL PRIMARY KEY,
  chore_id    UUID REFERENCES chores(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,      -- 'created','approved','claimed','completed', etc.
  user_id     UUID REFERENCES users(id),
  payload     JSONB,              -- anything interesting
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX chore_events_chore_idx ON chore_events(chore_id);
