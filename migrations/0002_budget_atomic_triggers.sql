-- 1. Reservation insert validation ------------------------------------------

CREATE TRIGGER IF NOT EXISTS ai_budget_validate_reservation_insert
BEFORE INSERT ON ai_budget_reservations
WHEN typeof(NEW.estimated_input_tokens) <> 'integer'
  OR NEW.estimated_input_tokens < 0
  OR typeof(NEW.reserved_output_tokens) <> 'integer'
  OR NEW.reserved_output_tokens < 0
BEGIN
  SELECT RAISE(ABORT, 'invalid_reservation_tokens');
END;

-- 2. State transition validation --------------------------------------------

CREATE TRIGGER IF NOT EXISTS ai_budget_validate_state_transition
BEFORE UPDATE OF state ON ai_budget_reservations
WHEN NOT (
  (OLD.state = 'reserved' AND NEW.state IN ('dispatched', 'cancelled'))
  OR (OLD.state = 'dispatched' AND NEW.state IN ('settled', 'rejected', 'unknown'))
)
BEGIN
  SELECT RAISE(ABORT, 'invalid_budget_state_transition');
END;

-- 3. Settled token validation -----------------------------------------------

CREATE TRIGGER IF NOT EXISTS ai_budget_validate_settled_tokens
BEFORE UPDATE OF state ON ai_budget_reservations
WHEN NEW.state = 'settled' AND (
  typeof(NEW.actual_input_tokens) <> 'integer'
  OR NEW.actual_input_tokens < 0
  OR typeof(NEW.actual_output_tokens) <> 'integer'
  OR NEW.actual_output_tokens < 0
)
BEGIN
  SELECT RAISE(ABORT, 'invalid_actual_tokens');
END;

-- 4. Reserve → day-existence check (BEFORE) ---------------------------------

CREATE TRIGGER IF NOT EXISTS ai_budget_before_reserve_check
BEFORE INSERT ON ai_budget_reservations
WHEN NEW.state = 'reserved' AND NOT EXISTS (
  SELECT 1 FROM ai_daily_usage WHERE day = NEW.day
)
BEGIN
  SELECT RAISE(ABORT, 'daily_usage_missing');
END;

-- 5. Cancel → day-existence check (BEFORE) ----------------------------------

CREATE TRIGGER IF NOT EXISTS ai_budget_before_cancel_check
BEFORE UPDATE OF state ON ai_budget_reservations
WHEN OLD.state = 'reserved' AND NEW.state = 'cancelled' AND NOT EXISTS (
  SELECT 1 FROM ai_daily_usage WHERE day = OLD.day
)
BEGIN
  SELECT RAISE(ABORT, 'daily_usage_missing');
END;

-- 6. Settle → day-existence check (BEFORE) ----------------------------------

CREATE TRIGGER IF NOT EXISTS ai_budget_before_settle_check
BEFORE UPDATE OF state ON ai_budget_reservations
WHEN OLD.state = 'dispatched' AND NEW.state = 'settled' AND NOT EXISTS (
  SELECT 1 FROM ai_daily_usage WHERE day = OLD.day
)
BEGIN
  SELECT RAISE(ABORT, 'daily_usage_missing');
END;

-- 7. Reject → day-existence check (BEFORE) ----------------------------------

CREATE TRIGGER IF NOT EXISTS ai_budget_before_reject_check
BEFORE UPDATE OF state ON ai_budget_reservations
WHEN OLD.state = 'dispatched' AND NEW.state = 'rejected' AND NOT EXISTS (
  SELECT 1 FROM ai_daily_usage WHERE day = OLD.day
)
BEGIN
  SELECT RAISE(ABORT, 'daily_usage_missing');
END;

-- 8. Unknown → day-existence check (BEFORE) ---------------------------------

CREATE TRIGGER IF NOT EXISTS ai_budget_before_unknown_check
BEFORE UPDATE OF state ON ai_budget_reservations
WHEN OLD.state = 'dispatched' AND NEW.state = 'unknown' AND NOT EXISTS (
  SELECT 1 FROM ai_daily_usage WHERE day = OLD.day
)
BEGIN
  SELECT RAISE(ABORT, 'daily_usage_missing');
END;

-- 9. Reserve → update daily_usage counters (AFTER) --------------------------

CREATE TRIGGER IF NOT EXISTS ai_budget_after_reserve
AFTER INSERT ON ai_budget_reservations
WHEN NEW.state = 'reserved'
BEGIN
  UPDATE ai_daily_usage
  SET request_count = request_count + 1,
      active_reservations = active_reservations + 1,
      reserved_input_tokens = reserved_input_tokens + NEW.estimated_input_tokens,
      reserved_output_tokens = reserved_output_tokens + NEW.reserved_output_tokens,
      updated_at = NEW.updated_at
  WHERE day = NEW.day;
END;

-- 10. Cancel → update daily_usage counters (AFTER) --------------------------

CREATE TRIGGER IF NOT EXISTS ai_budget_after_cancel
AFTER UPDATE OF state ON ai_budget_reservations
WHEN OLD.state = 'reserved' AND NEW.state = 'cancelled'
BEGIN
  UPDATE ai_daily_usage
  SET request_count = request_count - 1,
      active_reservations = active_reservations - 1,
      reserved_input_tokens = reserved_input_tokens - OLD.estimated_input_tokens,
      reserved_output_tokens = reserved_output_tokens - OLD.reserved_output_tokens,
      updated_at = NEW.updated_at
  WHERE day = OLD.day;
END;

-- 11. Settle → update daily_usage counters (AFTER) --------------------------

CREATE TRIGGER IF NOT EXISTS ai_budget_after_settle
AFTER UPDATE OF state ON ai_budget_reservations
WHEN OLD.state = 'dispatched' AND NEW.state = 'settled'
BEGIN
  UPDATE ai_daily_usage
  SET active_reservations = active_reservations - 1,
      reserved_input_tokens = reserved_input_tokens - OLD.estimated_input_tokens,
      reserved_output_tokens = reserved_output_tokens - OLD.reserved_output_tokens,
      actual_input_tokens = actual_input_tokens + NEW.actual_input_tokens,
      actual_output_tokens = actual_output_tokens + NEW.actual_output_tokens,
      updated_at = NEW.updated_at
  WHERE day = OLD.day;
END;

-- 12. Reject → update daily_usage counters (AFTER) --------------------------

CREATE TRIGGER IF NOT EXISTS ai_budget_after_reject
AFTER UPDATE OF state ON ai_budget_reservations
WHEN OLD.state = 'dispatched' AND NEW.state = 'rejected'
BEGIN
  UPDATE ai_daily_usage
  SET active_reservations = active_reservations - 1,
      reserved_input_tokens = reserved_input_tokens - OLD.estimated_input_tokens,
      reserved_output_tokens = reserved_output_tokens - OLD.reserved_output_tokens,
      updated_at = NEW.updated_at
  WHERE day = OLD.day;
END;

-- 13. Unknown → update daily_usage counters (AFTER) -------------------------

CREATE TRIGGER IF NOT EXISTS ai_budget_after_unknown
AFTER UPDATE OF state ON ai_budget_reservations
WHEN OLD.state = 'dispatched' AND NEW.state = 'unknown'
BEGIN
  UPDATE ai_daily_usage
  SET active_reservations = active_reservations - 1,
      reserved_input_tokens = reserved_input_tokens - OLD.estimated_input_tokens,
      reserved_output_tokens = reserved_output_tokens - OLD.reserved_output_tokens,
      actual_input_tokens = actual_input_tokens + OLD.estimated_input_tokens,
      actual_output_tokens = actual_output_tokens + OLD.reserved_output_tokens,
      updated_at = NEW.updated_at
  WHERE day = OLD.day;
END;
