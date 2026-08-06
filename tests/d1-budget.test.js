import { createD1BudgetStore } from "../functions/lib/d1-budget-store.js";
let pass = 0, fail = 0;
function t(n, ok) { ok ? pass++ : fail++; console.log("[" + (ok ? "PASS" : "FAIL") + "] " + n); }

function mockD1() {
  let usage = { day: new Date().toISOString().slice(0, 10), request_count: 0, active_reservations: 0, reserved_input_tokens: 0, reserved_output_tokens: 0, actual_input_tokens: 0, actual_output_tokens: 0 };
  const reservations = new Map();
  const db = {
    prepare(sql) {
      return {
        bind(...args) { this._args = args; return this; },
        async run() {
          if (sql.includes("INSERT OR IGNORE INTO ai_daily_usage") && sql.includes("0,0,0,0,0,0")) return { meta: { rows_written: 0 } };
          if (sql.includes("INSERT INTO ai_budget_reservations")) {
            const [rid, day, estIn, maxOut, ts, dLimit, inLimit, outLimit] = this._args;
            if (reservations.has(rid)) return { meta: { rows_written: 0 } };
            if (usage.request_count >= dLimit || (usage.actual_input_tokens + usage.reserved_input_tokens + estIn) > inLimit || (usage.actual_output_tokens + usage.reserved_output_tokens + maxOut) > outLimit) return { meta: { rows_written: 0 } };
            reservations.set(rid, { request_id: rid, day, estimated_input_tokens: estIn, reserved_output_tokens: maxOut, state: "reserved", actual_input_tokens: null, actual_output_tokens: null });
            usage.request_count++;
            usage.active_reservations++;
            usage.reserved_input_tokens += estIn;
            usage.reserved_output_tokens += maxOut;
            return { meta: { rows_written: 1 } };
          }
          if (sql.includes("SET state='dispatched'")) {
            const [ts, rid] = this._args;
            const r = reservations.get(rid);
            if (r && r.state === "reserved") { r.state = "dispatched"; return { meta: { rows_written: 1 } }; }
            return { meta: { rows_written: 0 } };
          }
          if (sql.includes("SET state='settled'")) {
            const [actIn, actOut, ts, rid] = this._args;
            const r = reservations.get(rid);
            if (r && r.state === "dispatched") { r.state = "settled"; r.actual_input_tokens = actIn; r.actual_output_tokens = actOut; usage.active_reservations = Math.max(0, usage.active_reservations - 1); usage.reserved_input_tokens = Math.max(0, usage.reserved_input_tokens - r.estimated_input_tokens); usage.reserved_output_tokens = Math.max(0, usage.reserved_output_tokens - r.reserved_output_tokens); usage.actual_input_tokens += actIn; usage.actual_output_tokens += actOut; return { meta: { rows_written: 1 } }; }
            return { meta: { rows_written: 0 } };
          }
          if (sql.includes("SET state='cancelled'")) {
            const [ts, rid] = this._args;
            const r = reservations.get(rid);
            if (r && r.state === "reserved") { r.state = "cancelled"; usage.request_count = Math.max(0, usage.request_count - 1); usage.active_reservations = Math.max(0, usage.active_reservations - 1); usage.reserved_input_tokens = Math.max(0, usage.reserved_input_tokens - r.estimated_input_tokens); usage.reserved_output_tokens = Math.max(0, usage.reserved_output_tokens - r.reserved_output_tokens); return { meta: { rows_written: 1 } }; }
            return { meta: { rows_written: 0 } };
          }
          if (sql.includes("SET state='unknown'")) {
            const [ts, rid] = this._args;
            const r = reservations.get(rid);
            if (r && r.state === "dispatched") { r.state = "unknown"; usage.active_reservations--; usage.reserved_input_tokens -= r.estimated_input_tokens; usage.reserved_output_tokens -= r.reserved_output_tokens; usage.actual_input_tokens += r.estimated_input_tokens; usage.actual_output_tokens += r.reserved_output_tokens; return { meta: { rows_written: 1 } }; }
            return { meta: { rows_written: 0 } };
          }
          if (sql.includes("SET state='rejected'")) {
            const [ts, rid] = this._args;
            const r = reservations.get(rid);
            if (r && r.state === "dispatched") { r.state = "rejected"; usage.active_reservations--; usage.reserved_input_tokens -= r.estimated_input_tokens; usage.reserved_output_tokens -= r.reserved_output_tokens; return { meta: { rows_written: 1 } }; }
            return { meta: { rows_written: 0 } };
          }
          return { meta: { rows_written: 1 } };
        },
        async first() {
          if (sql.includes("FROM ai_budget_reservations")) {
            const rid = this._args[0];
            return reservations.get(rid) || null;
          }
          if (sql.includes("SELECT * FROM ai_daily_usage")) {
            const day = this._args[0];
            return day === usage.day ? { ...usage } : null;
          }
          return null;
        },
      };
    },
    async batch(stmts) {
      const results = [];
      for (const s of stmts) results.push(await s.run());
      return results;
    },
  };
  return { db, getState: () => ({ usage: { ...usage }, reservations: new Map(reservations) }) };
}

async function run() {
  console.log("D1 Budget Tests");

  let mock = mockD1();
  let b = createD1BudgetStore(mock.db, { dailyRequestLimit: 2, dailyInputTokenLimit: 1000, dailyOutputTokenLimit: 500, maxOutputTokens: 100 });

  // Reserve
  const r1 = await b.reserveRequest({ requestId: "r1", estimatedInputTokens: 100 });
  t("B1 reserve ok", r1.ok);

  // Dispatch
  const dispatch = await b.markDispatched({ requestId: "r1" });
  t("B2 dispatch succeeds", dispatch.ok === true);

  // Settle success
  await b.settleSuccess({ requestId: "r1", actualInputTokens: 80, actualOutputTokens: 30 });
  const usage = await b.getDailyUsage();
  const r1State = mock.getState();
  t("B3 usage requests=1", usage.requests === 1);
  t("B4 dispatched/settled path", r1State.reservations.get("r1").state === "settled" && r1State.usage.actual_input_tokens === 80 && r1State.usage.actual_output_tokens === 30);

  // Second reserve
  const r2 = await b.reserveRequest({ requestId: "r2", estimatedInputTokens: 100 });
  t("B5 second reserve ok", r2.ok);

  // Cancel
  await b.cancelBeforeDispatch({ requestId: "r2" });
  const u2 = await b.getDailyUsage();
  const r2State = mock.getState();
  t("B6 cancel releases reservation", u2.requests === 1 && r2State.usage.active_reservations === 0 && r2State.usage.reserved_input_tokens === 0 && r2State.reservations.get("r2").state === "cancelled");

  // Hit limit
  await b.reserveRequest({ requestId: "r3", estimatedInputTokens: 100 });
  await b.markDispatched({ requestId: "r3" });
  await b.settleSuccess({ requestId: "r3", actualInputTokens: 50, actualOutputTokens: 20 });
  const r4 = await b.reserveRequest({ requestId: "r4", estimatedInputTokens: 100 });
  t("B7 limit exhausted", !r4.ok);

  // settleUnknown
  let mock2 = mockD1();
  let b2 = createD1BudgetStore(mock2.db, { dailyRequestLimit: 5, dailyInputTokenLimit: 5000, dailyOutputTokenLimit: 2000, maxOutputTokens: 100 });
  await b2.reserveRequest({ requestId: "ux1", estimatedInputTokens: 100 });
  await b2.markDispatched({ requestId: "ux1" });
  await b2.settleUnknown({ requestId: "ux1" });
  const u3 = await b2.getDailyUsage();
  t("B8 settleUnknown keeps request count", u3.requests === 1);
  const unknownState = mock2.getState();
  t("B9 settleUnknown releases reserve and charges estimate", unknownState.usage.active_reservations === 0 && unknownState.usage.reserved_input_tokens === 0 && unknownState.usage.actual_input_tokens === 100 && unknownState.usage.actual_output_tokens === 100);

  const duplicate = await b.reserveRequest({ requestId: "r1", estimatedInputTokens: 100 });
  const duplicateState = mock.getState();
  t("B10 duplicate preserves original record", !duplicate.ok && duplicate.reason === "duplicate_reservation" && duplicateState.reservations.get("r1").state === "settled" && duplicateState.usage.request_count === 2);

  const beforeExceeded = mock.getState();
  const exceeded = await b.reserveRequest({ requestId: "over-limit", estimatedInputTokens: 100 });
  const afterExceeded = mock.getState();
  t("B11 budget exceeded leaves no reservation or counter change", !exceeded.ok && !afterExceeded.reservations.has("over-limit") && JSON.stringify(beforeExceeded.usage) === JSON.stringify(afterExceeded.usage));

  const repeatedSettle = await b.settleSuccess({ requestId: "r1", actualInputTokens: 80, actualOutputTokens: 30 });
  const afterRepeatedSettle = mock.getState();
  t("B12 repeated settle is idempotent", repeatedSettle.ok === false && JSON.stringify(afterRepeatedSettle.usage) === JSON.stringify(afterExceeded.usage));

  let invalidTokensThrow = false;
  try { await b.reserveRequest({ requestId: "fractional", estimatedInputTokens: 1.5 }); }
  catch (error) { invalidTokensThrow = error.message.includes("invalid_parameter"); }
  t("B13 fractional token reservation rejected", invalidTokensThrow);

  const unavailable = createD1BudgetStore(null, {});
  let unavailableThrows = false;
  try { await unavailable.reserveRequest({ requestId: "null-db", estimatedInputTokens: 1 }); }
  catch (error) { unavailableThrows = error.message === "budget_unavailable"; }
  t("B14 null db rejects reservation", unavailableThrows);

  // Duplicate reserve rejected

  console.log("\n" + pass + "/" + (pass+fail) + " passed");
}
run().then(() => process.exitCode = fail > 0 ? 1 : 0).catch((error) => { console.error(error); process.exitCode = 1; });
