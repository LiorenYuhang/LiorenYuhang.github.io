CREATE TABLE IF NOT EXISTS ai_daily_usage (
  day TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0,
  active_reservations INTEGER NOT NULL DEFAULT 0,
  reserved_input_tokens INTEGER NOT NULL DEFAULT 0,
  reserved_output_tokens INTEGER NOT NULL DEFAULT 0,
  actual_input_tokens INTEGER NOT NULL DEFAULT 0,
  actual_output_tokens INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (request_count >= 0),
  CHECK (active_reservations >= 0),
  CHECK (reserved_input_tokens >= 0),
  CHECK (reserved_output_tokens >= 0),
  CHECK (actual_input_tokens >= 0),
  CHECK (actual_output_tokens >= 0)
);

CREATE TABLE IF NOT EXISTS ai_budget_reservations (
  request_id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  estimated_input_tokens INTEGER NOT NULL,
  reserved_output_tokens INTEGER NOT NULL,
  actual_input_tokens INTEGER,
  actual_output_tokens INTEGER,
  state TEXT NOT NULL DEFAULT 'reserved',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (state IN ('reserved','dispatched','settled','rejected','cancelled','unknown'))
);

CREATE INDEX IF NOT EXISTS idx_reservations_day ON ai_budget_reservations(day);
CREATE INDEX IF NOT EXISTS idx_reservations_state ON ai_budget_reservations(state);
