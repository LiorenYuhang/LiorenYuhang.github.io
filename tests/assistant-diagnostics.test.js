import assert from "node:assert/strict";
import { onRequest } from "../functions/api/assistant.js";
import { createDiagnostics, diagnosticLogFields, diagnosticProviderResult, diagnosticModelName } from "../functions/lib/assistant-diagnostics.js";
import knowledgeBase from "../knowledge-base.generated.mjs";

const PRIVATE = "DO_NOT_LOG_private@example.invalid_secret_prompt_answer";
const originalFetch = globalThis.fetch;
const originalCaches = globalThis.caches;
const originalLog = console.log;
let count = 0;

async function check(name, options = {}) {
  const logs = [], calls = [], prompts = [], contents = knowledgeBase.map(d => d.content);
  const db = { prepare(sql) { return { bind() { return this; }, async run() {
    if (sql.includes("state='settled'")) {
      calls.push("settle");
      if (options.settleThrow) throw Object.assign(new Error(PRIVATE), options.secretCode ? { code: PRIVATE } : {});
      if (options.settleFalse) return { meta: { rows_written: 0 } };
      if (options.sourcesThrow) knowledgeBase.forEach(d => { d.content = 42; });
    } else if (sql.includes("state='unknown'")) calls.push("unknown");
    else if (sql.includes("state='rejected'")) calls.push("rejected");
    else if (sql.includes("state='dispatched'")) calls.push("dispatch");
    else if (sql.includes("INSERT INTO ai_budget_reservations")) calls.push("reserve");
    return { meta: { rows_written: 1 } };
  } }; } };
  globalThis.caches = { default: {
    async match() { return undefined; },
    async put() { calls.push("cache"); if (options.cacheThrow) throw new Error(PRIVATE); },
  } };
  globalThis.fetch = async (url, init) => {
    calls.push("fetch");
    const requestBody = JSON.parse(init.body);
    prompts.push(...requestBody.messages.map(message => message.content));
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    assert.equal(requestBody.stream, false);
    assert.deepEqual(requestBody.thinking, { type: "disabled" });
    assert.equal(init.headers.get("Authorization"), "Bearer " + PRIVATE);
    assert.equal("diagnostics" in requestBody, false);
    if (options.network) throw new TypeError(PRIVATE);
    if (options.timeout) return new Promise((resolve, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error(PRIVATE), { name: "AbortError" })), { once: true }));
    let body = { choices: [{ message: { content: PRIVATE } }], usage: { prompt_tokens: 10, completion_tokens: 2 }, model: "diagnostic-model" };
    if (options.transform) body = options.transform(body);
    return { status: options.status || 200, async json() {
      if (options.parse) throw new SyntaxError(PRIVATE);
      return body;
    } };
  };
  console.log = line => logs.push(JSON.parse(line));
  try {
    const response = await onRequest({
      request: new Request("https://test.local/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: options.direct ? "这个网站主要有哪些内容" : "Stewart" }) }),
      env: { AI_ASSISTANT_ENABLED: "true", AI_PROVIDER: "deepseek", AI_RUNTIME_ENV: "production", DEEPSEEK_API_KEY: PRIVATE, DEEPSEEK_MODEL: "diagnostic-model", AI_BUDGET_DB: db, AI_PROVIDER_CONFIG_VERSION: name, AI_REQUEST_TIMEOUT_MS: options.timeout ? "10" : "1000" },
    });
    const payload = await response.json();
    const log = logs.at(-1);
    assert.equal(response.status, options.http || 503, name);
    assert.equal(payload.scope, options.scope || "upstream_error", name);
    assert.equal(payload.request_id, log.rid);
    assert.equal(log.failure_stage, options.stage ?? null, name);
    assert.equal(log.error_category, options.category ?? null, name);
    if (options.result) assert.equal(log.provider_result, options.result, name);
    if (options.expected) for (const [key, value] of Object.entries(options.expected)) assert.equal(log[key], value, name + ": " + key);
    assert.equal(logs.length, 1);
    assert.equal(JSON.stringify(logs).includes(PRIVATE), false, "no private strings in log");
    for (const prompt of prompts) assert.equal(JSON.stringify(logs).includes(JSON.stringify(prompt).slice(1, -1)), false, "no prompts in log");
    assert.equal(JSON.stringify(logs).includes("Stewart"), false, "no question text in log");
    for (const key of ["answer", "prompt", "question", "Authorization", "usage", "sources", "sql"]) assert.equal(key in log, false, key);
    for (const key of Object.keys(createDiagnostics())) assert.equal(key in payload, false, "diagnostics are server-only");
    assert.equal(calls.filter(c => c === "fetch").length, options.direct ? 0 : 1, "no retry");
    if (options.calls) assert.deepEqual(calls, options.calls, name);
    if (response.status === 200 && !options.direct) assert.equal(payload.answer, PRIVATE, "answer unchanged");
    if (payload.scope === "upstream_error") assert.equal(payload.answer, "AI 助手暂时不可用。", "failure answer unchanged");
    count++;
    originalLog("[PASS] " + name);
    return log;
  } finally {
    console.log = originalLog;
    knowledgeBase.forEach((d, i) => { d.content = contents[i]; });
  }
}

try {
  await check("fetch rejection", { network: true, stage: "provider_fetch", category: "network", result: "provider_network_error", expected: { upstream_status: null, response_json_ok: null, settle_success_started: false }, calls: ["reserve", "dispatch", "fetch", "unknown"] });
  for (const status of [400, 401, 402, 403, 404, 422, 429, 500, 502, 503]) {
    await check("http " + status, { status, stage: "provider_http", category: "http", scope: [401, 402, 403].includes(status) ? "disabled" : status === 429 ? "upstream_busy" : "upstream_error", expected: { upstream_status: status, provider_http_ok: false, response_json_ok: true, settle_success_started: false } });
  }
  await check("non-json 500 keeps HTTP priority", { status: 500, parse: true, stage: "provider_http", category: "http", expected: { response_json_ok: false } });
  await check("json parse", { parse: true, stage: "provider_json_parse", category: "parse", result: "provider_invalid_response", expected: { provider_http_ok: true, response_json_ok: false } });
  for (const [name, transform] of [
    ["null json", () => null], ["missing choices", b => ({ ...b, choices: undefined })],
    ["empty choices", b => ({ ...b, choices: [] })], ["missing message", b => ({ ...b, choices: [{}] })],
    ["empty content", b => ({ ...b, choices: [{ message: { content: "  " } }] })],
  ]) await check(name, { transform, stage: "provider_content_validation", category: "validation" });
  await check("null choice TypeError is not a network diagnosis", { transform: b => ({ ...b, choices: [null] }), stage: "provider_content_validation", category: "unexpected_exception", result: "provider_network_error", expected: { provider_http_ok: true, response_json_ok: true } });
  for (const usage of [undefined, {}, { prompt_tokens: -1, completion_tokens: 2 }, { prompt_tokens: 1.5, completion_tokens: 2 }]) {
    await check("usage " + count, { transform: b => ({ ...b, usage }), stage: "provider_usage_validation", category: "validation", result: "provider_invalid_usage", expected: { content_ok: true, usage_ok: false, model_ok: null } });
  }
  await check("model mismatch", { transform: b => ({ ...b, model: PRIVATE }), stage: "provider_model_validation", category: "validation", result: "provider_model_mismatch", expected: { content_ok: true, usage_ok: true, model_ok: false } });
  await check("model names logged without accepting mismatch", { transform: b => ({ ...b, model: "diagnostic-model-canonical" }), stage: "provider_model_validation", category: "validation", result: "provider_model_mismatch", expected: { configured_model: "diagnostic-model", response_model: "diagnostic-model-canonical", model_ok: false } });
  await check("matching model names logged", { http: 200, scope: "success", expected: { configured_model: "diagnostic-model", response_model: "diagnostic-model", model_ok: true } });
  await check("settle returns false", { settleFalse: true, stage: "budget_settle_success", category: "validation", result: "budget_settlement_failed", expected: { provider_answer_ok: true, settle_success_started: true, settle_success_ok: false, settle_success_threw: false, sources_ok: null }, calls: ["reserve", "dispatch", "fetch", "settle", "unknown"] });
  await check("settle throws", { settleThrow: true, stage: "budget_settle_success", category: "unexpected_exception", result: "provider_exception", expected: { provider_answer_ok: true, settle_success_started: true, settle_success_ok: false, settle_success_threw: true, sources_ok: null } });
  await check("untrusted error code is not logged", { settleThrow: true, secretCode: true, stage: "budget_settle_success", category: "unexpected_exception", result: "unexpected_exception" });
  await check("sources throws after settlement", { sourcesThrow: true, stage: "sources_build", category: "unexpected_exception", expected: { provider_answer_ok: true, settle_success_ok: true, settle_success_threw: false, sources_ok: false }, calls: ["reserve", "dispatch", "fetch", "settle"] });
  await check("timeout unchanged", { timeout: true, http: 504, scope: "timeout", stage: "provider_fetch", category: "timeout", result: "timeout" });
  await check("cache failure remains success", { cacheThrow: true, http: 200, scope: "success", expected: { sources_ok: true, settle_success_ok: true } });
  const success = await check("success", { http: 200, scope: "success", expected: { stage: "success", provider_http_ok: true, response_json_ok: true, content_ok: true, usage_ok: true, model_ok: true, provider_answer_ok: true, settle_success_started: true, settle_success_ok: true, settle_success_threw: false, sources_ok: true }, calls: ["reserve", "dispatch", "fetch", "settle", "cache"] });
  await check("direct has no fabricated provider success", { direct: true, http: 200, scope: "success", expected: { provider_http_ok: null, provider_answer_ok: null, settle_success_started: false, settle_success_ok: null, sources_ok: null }, calls: [] });
  const unsafe = Object.fromEntries(Object.keys(createDiagnostics()).map(key => [key, PRIVATE]));
  assert.equal(JSON.stringify(diagnosticLogFields(unsafe)).includes(PRIVATE), false);
  assert.equal(diagnosticProviderResult(PRIVATE), "unexpected_exception");
  for (const value of ["sk-test-secret", "Bearer token", "private@example.invalid", "model\nsecret", "x".repeat(129), {}, null]) assert.equal(diagnosticModelName(value), null);
  assert.equal(diagnosticModelName("opaque-key", "opaque-key"), null);
  originalLog("Diagnostic cases passed: " + count);
  originalLog("Local synthetic example: " + JSON.stringify(diagnosticLogFields(success)));
} finally {
  console.log = originalLog;
  globalThis.fetch = originalFetch;
  if (originalCaches === undefined) delete globalThis.caches;
  else globalThis.caches = originalCaches;
}
