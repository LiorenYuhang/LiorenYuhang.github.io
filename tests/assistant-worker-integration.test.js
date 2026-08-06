import { onRequest } from "../functions/api/assistant.js";
import { onRequest as onDebugRequest } from "../functions/api/debug/env.js";

let pass = 0;
let fail = 0;

function test(name, ok) {
  ok ? pass++ : fail++;
  console.log("[" + (ok ? "PASS" : "FAIL") + "] " + name);
}

function context(method, body, envOverrides = {}, extra = {}) {
  const text = body === undefined ? null : JSON.stringify(body);
  const headers = new Headers();
  if (text !== null && extra.contentType !== false) headers.set("Content-Type", "application/json");
  return {
    request: new Request("https://test.local/api/assistant", { method, headers, body: text }),
    env: {
      AI_ASSISTANT_ENABLED: "true",
      AI_PROVIDER: "mock",
      AI_RUNTIME_ENV: "development",
      DEEPSEEK_MODEL: "worker-test-model",
      AI_MOCK_BEHAVIOR: "success",
      AI_REQUEST_TIMEOUT_MS: "1000",
      AI_DAILY_REQUEST_LIMIT: "10",
      AI_PROVIDER_CONFIG_VERSION: extra.version || "worker-default",
      SITE_URL: "https://test.local",
      ...envOverrides,
    },
    waitUntil: extra.waitUntil,
  };
}

function createD1Stub() {
  const reservations = new Map();
  let calls = 0;
  return {
    get calls() { return calls; },
    prepare(sql) {
      const statement = {
        args: [],
        bind(...args) { this.args = args; return this; },
        async first() {
          calls++;
          if (sql.includes("FROM ai_budget_reservations")) return reservations.get(this.args[0]) || null;
          return null;
        },
        async run() {
          calls++;
          if (sql.includes("INSERT OR IGNORE INTO ai_daily_usage")) return { meta: { rows_written: 1 } };
          if (sql.includes("INSERT INTO ai_budget_reservations")) {
            const [requestId, day, estimatedInputTokens, reservedOutputTokens] = this.args;
            if (reservations.has(requestId)) return { meta: { rows_written: 0 } };
            reservations.set(requestId, { request_id: requestId, day, estimated_input_tokens: estimatedInputTokens, reserved_output_tokens: reservedOutputTokens, state: "reserved" });
            return { meta: { rows_written: 1 } };
          }
          if (sql.includes("state='settled'")) {
            const reservation = reservations.get(this.args[3]);
            if (!reservation || reservation.state !== "dispatched") return { meta: { rows_written: 0 } };
            reservation.state = "settled";
            return { meta: { rows_written: 1 } };
          }
          if (sql.includes("SET state='dispatched'")) {
            const reservation = reservations.get(this.args[1]);
            if (!reservation || reservation.state !== "reserved") return { meta: { rows_written: 0 } };
            reservation.state = "dispatched";
            return { meta: { rows_written: 1 } };
          }
          return { meta: { rows_written: 0 } };
        },
      };
      return statement;
    },
  };
}

async function run() {
  const productionDebug = await onDebugRequest({ env: { AI_RUNTIME_ENV: "production" } });
  test("production debug endpoint is hidden", productionDebug.status === 404);

  const defaultDebug = await onDebugRequest({ env: {} });
  test("debug endpoint fails closed without runtime env", defaultDebug.status === 404);

  const developmentDebug = await onDebugRequest({ env: { AI_RUNTIME_ENV: "development", DEEPSEEK_API_KEY: "test-only" } });
  const developmentDebugPayload = await developmentDebug.json();
  test("development debug endpoint remains available", developmentDebug.status === 200 && developmentDebugPayload.HAS_DEEPSEEK_KEY === true);
  test("development debug endpoint does not expose key value", JSON.stringify(developmentDebugPayload).includes("test-only") === false);

  const success = await onRequest(context("POST", { question: "Stewart" }));
  const payload = await success.json();
  test("development mock reaches assembled runtime", success.status === 200 && payload.ok === true);
  test("worker strips internal metadata", payload._meta === undefined && payload.request_id.startsWith("req_"));
  test("client response is no-store", success.headers.get("Cache-Control") === "no-store");

  const second = await onRequest(context("POST", { question: "Stewart" }));
  const secondPayload = await second.json();
  test("request ids are unique", secondPayload.request_id !== payload.request_id);

  const method = await onRequest(context("GET"));
  test("non-POST is rejected before runtime", method.status === 405);

  const missingContentType = await onRequest(context("POST", { question: "Stewart" }, {}, { contentType: false }));
  test("missing content type is rejected", missingContentType.status === 400);

  const disabled = await onRequest(context("POST", { question: "Stewart" }, { AI_ASSISTANT_ENABLED: "false" }, { version: "disabled" }));
  test("disabled runtime returns 503", disabled.status === 503);

  const productionMock = await onRequest(context("POST", { question: "Stewart" }, { AI_RUNTIME_ENV: "production" }, { version: "production-mock" }));
  test("production mock is disabled", productionMock.status === 503);

  const missingKey = await onRequest(context("POST", { question: "Stewart" }, { AI_PROVIDER: "deepseek", AI_RUNTIME_ENV: "production", DEEPSEEK_API_KEY: "", AI_BUDGET_DB: createD1Stub() }, { version: "missing-key" }));
  test("DeepSeek missing key is disabled", missingKey.status === 503);

  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  const cacheStore = new Map();
  const waitUntilPromises = [];
  globalThis.fetch = async () => {
    fetchCalls++;
    return new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }], usage: { prompt_tokens: 10, completion_tokens: 5 }, model: "worker-deepseek", id: "internal-id" }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  globalThis.caches = { default: {
    async match(request) { return cacheStore.get(request.url) || null; },
    async put(request, response) { cacheStore.set(request.url, response.clone()); },
  } };

  try {
    const noD1 = await onRequest(context("POST", { question: "Stewart" }, { AI_PROVIDER: "deepseek", AI_RUNTIME_ENV: "production", DEEPSEEK_API_KEY: "test-only", DEEPSEEK_MODEL: "worker-deepseek", AI_BUDGET_DB: undefined }, { version: "missing-d1" }));
    test("DeepSeek missing D1 is disabled before fetch", noD1.status === 503 && fetchCalls === 0);

    const db = createD1Stub();
    const deepseekEnv = { AI_PROVIDER: "deepseek", AI_RUNTIME_ENV: "production", DEEPSEEK_API_KEY: "test-only", DEEPSEEK_MODEL: "worker-deepseek", AI_BUDGET_DB: db };
    const firstDeepSeek = await onRequest(context("POST", { question: "Stewart" }, deepseekEnv, { version: "deepseek-cache", waitUntil: (promise) => waitUntilPromises.push(promise) }));
    const firstDeepSeekPayload = await firstDeepSeek.json();
    await Promise.all(waitUntilPromises);
    test("DeepSeek mock fetch completes assembled D1 path", firstDeepSeek.status === 200 && firstDeepSeekPayload.ok && fetchCalls === 1 && db.calls > 0);
    test("waitUntil receives cache write", waitUntilPromises.length === 1);
    test("provider internals are filtered", firstDeepSeekPayload.provider_request_id === undefined && firstDeepSeekPayload.usage === undefined && firstDeepSeekPayload._meta === undefined);

    const d1CallsBeforeHit = db.calls;
    const cachedDeepSeek = await onRequest(context("POST", { question: "Stewart" }, deepseekEnv, { version: "deepseek-cache", waitUntil: (promise) => waitUntilPromises.push(promise) }));
    test("cache hit skips D1 and Provider", cachedDeepSeek.status === 200 && fetchCalls === 1 && db.calls === d1CallsBeforeHit);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  }

  console.log("\n" + pass + "/" + (pass + fail) + " passed");
  process.exitCode = fail > 0 ? 1 : 0;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
