import { rmSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { createD1BudgetStore } from "../functions/lib/d1-budget-store.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stateRoot = join(root, ".wrangler", "d1-integration-test");
const stateDir = join(stateRoot, `run-${process.pid}`);
let passed = 0;
let failed = 0;

function check(name, condition) {
  condition ? passed++ : failed++;
  console.log(`[${condition ? "PASS" : "FAIL"}] ${name}`);
}

/**
 * Split a SQL string into individual statements.
 *
 * Simple `sql.split(';')` breaks on semicolons inside trigger bodies
 * (BEGIN...END) and CASE...END expressions.  This function tracks
 * BEGIN/CASE → END nesting so that only top-level semicolons act as
 * statement terminators.
 */
function splitSQLStatements(sql) {
  const statements = [];
  let current = "";
  let depth = 0;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (ch === ";" && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      continue;
    }

    current += ch;

    // Keywords that open a block terminated by END
    const remaining = sql.substring(i);
    if (/^BEGIN\b/i.test(remaining)) {
      depth++;
    } else if (/^CASE\b/i.test(remaining)) {
      depth++;
    } else if (/^END\b/i.test(remaining)) {
      depth = Math.max(0, depth - 1);
    }
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);

  return statements;
}

/**
 * Execute a migration file by splitting it into individual statements
 * and running each one separately.  This avoids "incomplete input"
 * errors that Miniflare's D1 exec() returns for multi-statement SQL
 * containing triggers (whose bodies have internal semicolons).
 */
async function applyMigration(db, filePath) {
  const sql = readFileSync(filePath, "utf8");
  const statements = splitSQLStatements(sql);
  for (const stmt of statements) {
    await db.prepare(stmt).run();
  }
}

async function reset(db) {
  await db.exec("DELETE FROM ai_budget_reservations; DELETE FROM ai_daily_usage;");
}

async function row(db, sql, ...values) {
  return db.prepare(sql).bind(...values).first();
}

async function run() {
  rmSync(stateDir, { recursive: true, force: true });
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    compatibilityDate: "2024-12-18",
    d1Databases: { AI_BUDGET_DB: "ai-budget-test" },
    d1Persist: stateDir,
  });

  try {
    const db = await mf.getD1Database("AI_BUDGET_DB");
    await applyMigration(db, join(root, "migrations", "0001_create_ai_budget.sql"));
    await applyMigration(db, join(root, "migrations", "0002_budget_atomic_triggers.sql"));
    check("L1 migrations apply to a real local D1 runtime", true);

    let store = createD1BudgetStore(db, {
      dailyRequestLimit: 1,
      dailyInputTokenLimit: 1000,
      dailyOutputTokenLimit: 1000,
      maxOutputTokens: 100,
    });
    const concurrent = await Promise.all(Array.from({ length: 20 }, (_, i) =>
      store.reserveRequest({ requestId: `limit-1-${i}`, estimatedInputTokens: 10 })
    ));
    const usage1 = await row(db, "SELECT * FROM ai_daily_usage");
    check("L2 concurrent request limit=1 admits exactly one", concurrent.filter(x => x.ok).length === 1);
    check("L3 limit=1 counters match the admitted reservation", usage1.request_count === 1 && usage1.active_reservations === 1 && usage1.reserved_input_tokens === 10 && usage1.reserved_output_tokens === 100);

    await reset(db);
    store = createD1BudgetStore(db, {
      dailyRequestLimit: 5,
      dailyInputTokenLimit: 1000,
      dailyOutputTokenLimit: 1000,
      maxOutputTokens: 100,
    });
    const concurrentFive = await Promise.all(Array.from({ length: 20 }, (_, i) =>
      store.reserveRequest({ requestId: `limit-5-${i}`, estimatedInputTokens: 10 })
    ));
    const usage5 = await row(db, "SELECT * FROM ai_daily_usage");
    check("L4 concurrent request limit=5 admits exactly five", concurrentFive.filter(x => x.ok).length === 5);
    check("L5 limit=5 counters remain consistent", usage5.request_count === 5 && usage5.active_reservations === 5 && usage5.reserved_input_tokens === 50 && usage5.reserved_output_tokens === 500);

    await reset(db);
    store = createD1BudgetStore(db, {
      dailyRequestLimit: 10,
      dailyInputTokenLimit: 100,
      dailyOutputTokenLimit: 100,
      maxOutputTokens: 40,
    });
    const first = await store.reserveRequest({ requestId: "actual-1", estimatedInputTokens: 50 });
    await store.markDispatched({ requestId: "actual-1" });
    await store.settleSuccess({ requestId: "actual-1", actualInputTokens: 90, actualOutputTokens: 30 });
    const blockedByActual = await store.reserveRequest({ requestId: "actual-2", estimatedInputTokens: 11 });
    const actualUsage = await row(db, "SELECT * FROM ai_daily_usage");
    check("L6 settled actual usage is charged", first.ok && actualUsage.actual_input_tokens === 90 && actualUsage.actual_output_tokens === 30 && actualUsage.active_reservations === 0);
    check("L7 actual usage constrains the next reservation", !blockedByActual.ok && blockedByActual.reason === "budget_exceeded");

    await reset(db);
    store = createD1BudgetStore(db, {
      dailyRequestLimit: 10,
      dailyInputTokenLimit: 1000,
      dailyOutputTokenLimit: 1000,
      maxOutputTokens: 100,
    });
    await store.reserveRequest({ requestId: "duplicate", estimatedInputTokens: 25 });
    const duplicate = await store.reserveRequest({ requestId: "duplicate", estimatedInputTokens: 25 });
    await store.markDispatched({ requestId: "duplicate" });
    const firstSettle = await store.settleSuccess({ requestId: "duplicate", actualInputTokens: 20, actualOutputTokens: 10 });
    const secondSettle = await store.settleSuccess({ requestId: "duplicate", actualInputTokens: 20, actualOutputTokens: 10 });
    const duplicateUsage = await row(db, "SELECT * FROM ai_daily_usage");
    check("L8 duplicate request ID is rejected without changing the original", !duplicate.ok && duplicate.reason === "duplicate_reservation" && duplicateUsage.request_count === 1);
    check("L9 settlement is idempotent", firstSettle.ok && !secondSettle.ok && duplicateUsage.actual_input_tokens === 20 && duplicateUsage.actual_output_tokens === 10);

    await reset(db);
    store = createD1BudgetStore(db, {
      dailyRequestLimit: 10,
      dailyInputTokenLimit: 1000,
      dailyOutputTokenLimit: 1000,
      maxOutputTokens: 100,
    });
    await store.reserveRequest({ requestId: "unknown", estimatedInputTokens: 30 });
    await store.markDispatched({ requestId: "unknown" });
    await store.settleUnknown({ requestId: "unknown", reason: "timeout" });
    const unknownUsage = await row(db, "SELECT * FROM ai_daily_usage");
    check("L10 unknown outcome charges the conservative reservation", unknownUsage.request_count === 1 && unknownUsage.active_reservations === 0 && unknownUsage.actual_input_tokens === 30 && unknownUsage.actual_output_tokens === 100);

    const pastDay = "2000-01-01";
    const now = Math.floor(Date.now() / 1000);
    await db.prepare("INSERT INTO ai_daily_usage(day,created_at,updated_at) VALUES(?1,?2,?2)").bind(pastDay, now).run();
    await db.prepare("INSERT INTO ai_budget_reservations(request_id,day,estimated_input_tokens,reserved_output_tokens,state,created_at,updated_at) VALUES(?1,?2,?3,?4,'reserved',?5,?5)").bind("past-day", pastDay, 12, 34, now).run();
    await store.markDispatched({ requestId: "past-day" });
    await store.settleRejected({ requestId: "past-day", reason: "provider_429" });
    const pastUsage = await row(db, "SELECT * FROM ai_daily_usage WHERE day=?1", pastDay);
    const currentUsage = await row(db, "SELECT * FROM ai_daily_usage WHERE day<>?1", pastDay);
    check("L11 settlement updates the reservation day, not the current UTC day", pastUsage.request_count === 1 && pastUsage.active_reservations === 0 && currentUsage.request_count === 1);

    const snapshot = await db.prepare("SELECT day,request_count,active_reservations,reserved_input_tokens,reserved_output_tokens,actual_input_tokens,actual_output_tokens FROM ai_daily_usage ORDER BY day").all();
    console.log("D1 sanitized snapshot:", JSON.stringify(snapshot.results));
  } finally {
    try {
      await mf.dispose();
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
  }

  console.log(`\n${passed}/${passed + failed} passed`);
  process.exitCode = failed ? 1 : 0;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
