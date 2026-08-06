/**
 * d1-budget-store.js v4B.1.1 — atomic D1 budget with state machine
 * States: reserved -> dispatched -> settled | rejected | cancelled | unknown
 */
export function createD1BudgetStore(db, limits) {
  limits = limits || {};
  const dailyLimit = validateLimit("dailyRequestLimit", limits.dailyRequestLimit ?? 100);
  const inputLimit = validateLimit("dailyInputTokenLimit", limits.dailyInputTokenLimit ?? 200000);
  const outputLimit = validateLimit("dailyOutputTokenLimit", limits.dailyOutputTokenLimit ?? 50000);
  const maxOutput = validateLimit("maxOutputTokens", limits.maxOutputTokens ?? 800);

  function today() { return new Date().toISOString().slice(0, 10); }
  function now() { return Math.floor(Date.now() / 1000); }
  function v(name, val) { if (!Number.isInteger(val) || val < 0) throw new Error("invalid_parameter: "+name); return val; }

  async function reserveRequest({ requestId, estimatedInputTokens }) {
    if (!db) throw new Error("budget_unavailable");
    const d = today(), t = now(), est = v("estimatedInputTokens", estimatedInputTokens), mo = maxOutput;
    await db.prepare("INSERT OR IGNORE INTO ai_daily_usage(day,request_count,active_reservations,reserved_input_tokens,reserved_output_tokens,actual_input_tokens,actual_output_tokens,created_at,updated_at) VALUES(?1,0,0,0,0,0,0,?2,?2)").bind(d, t).run();
    const inserted = await db.prepare(
      "INSERT INTO ai_budget_reservations(request_id,day,estimated_input_tokens,reserved_output_tokens,state,created_at,updated_at) " +
      "SELECT ?1,?2,?3,?4,'reserved',?5,?5 " +
      "WHERE NOT EXISTS (SELECT 1 FROM ai_budget_reservations WHERE request_id=?1) " +
      "AND EXISTS (SELECT 1 FROM ai_daily_usage WHERE day=?2 AND request_count<?6 " +
      "AND (actual_input_tokens+reserved_input_tokens+?3)<=?7 " +
      "AND (actual_output_tokens+reserved_output_tokens+?4)<=?8) " +
      "ON CONFLICT(request_id) DO NOTHING"
    ).bind(requestId, d, est, mo, t, dailyLimit, inputLimit, outputLimit).run();
    // Miniflare local D1 counts trigger-side writes in rows_written too,
    // so an INSERT + trigger UPDATE reports 2 instead of 1.  Use > 0 and
    // fall back to .changes for compatibility with both runtimes.
    if ((inserted.meta.rows_written ?? inserted.meta.changes ?? 0) > 0) return { ok: true, day: d };
    const existing = await db.prepare("SELECT request_id FROM ai_budget_reservations WHERE request_id=?1").bind(requestId).first();
    return existing
      ? { ok: false, reason: "duplicate_reservation" }
      : { ok: false, reason: "budget_exceeded" };
  }

  async function markDispatched({ requestId }) {
    if (!db) throw new Error("budget_unavailable");
    const r = await db.prepare("UPDATE ai_budget_reservations SET state='dispatched', updated_at=?1 WHERE request_id=?2 AND state='reserved'").bind(now(), requestId).run();
    return (r.meta.rows_written ?? r.meta.changes ?? 0) > 0
      ? { ok: true }
      : { ok: false, reason: "reservation_not_reserved" };
  }

  async function settleSuccess({ requestId, actualInputTokens, actualOutputTokens }) {
    if (!db) throw new Error("budget_unavailable");
    const ai = v("actualInputTokens", actualInputTokens), ao = v("actualOutputTokens", actualOutputTokens);
    const r = await db.prepare("UPDATE ai_budget_reservations SET state='settled', actual_input_tokens=?1, actual_output_tokens=?2, updated_at=?3 WHERE request_id=?4 AND state='dispatched'").bind(ai, ao, now(), requestId).run();
    return (r.meta.rows_written ?? r.meta.changes ?? 0) > 0
      ? { ok: true }
      : { ok: false, reason: "reservation_not_dispatched" };
  }

  async function cancelBeforeDispatch({ requestId, reason }) {
    if (!db) throw new Error("budget_unavailable");
    const r = await db.prepare("UPDATE ai_budget_reservations SET state='cancelled', updated_at=?1 WHERE request_id=?2 AND state='reserved'").bind(now(), requestId).run();
    return (r.meta.rows_written ?? r.meta.changes ?? 0) > 0
      ? { ok: true }
      : { ok: false, reason: "reservation_not_reserved" };
  }

  async function settleRejected({ requestId, reason }) {
    if (!db) throw new Error("budget_unavailable");
    const r = await db.prepare("UPDATE ai_budget_reservations SET state='rejected', updated_at=?1 WHERE request_id=?2 AND state='dispatched'").bind(now(), requestId).run();
    return (r.meta.rows_written ?? r.meta.changes ?? 0) > 0
      ? { ok: true }
      : { ok: false, reason: "reservation_not_dispatched" };
  }

  async function settleUnknown({ requestId, reason }) {
    if (!db) throw new Error("budget_unavailable");
    const r = await db.prepare("UPDATE ai_budget_reservations SET state='unknown', updated_at=?1 WHERE request_id=?2 AND state='dispatched'").bind(now(), requestId).run();
    return (r.meta.rows_written ?? r.meta.changes ?? 0) > 0
      ? { ok: true }
      : { ok: false, reason: "reservation_not_dispatched" };
  }

  async function getDailyUsage(d) {
    if (!db) return { requests: 0, inputTokens: 0, outputTokens: 0 };
    const row = await db.prepare("SELECT * FROM ai_daily_usage WHERE day=?1").bind(d || today()).first();
    return row ? { requests: row.request_count, inputTokens: row.actual_input_tokens, outputTokens: row.actual_output_tokens } : { requests: 0, inputTokens: 0, outputTokens: 0 };
  }

  return { reserveRequest, markDispatched, settleSuccess, cancelBeforeDispatch, settleRejected, settleUnknown, getDailyUsage, config: { dailyLimit, inputLimit, outputLimit, maxOutput } };
}

function validateLimit(name, value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("invalid_parameter: " + name);
  return value;
}
