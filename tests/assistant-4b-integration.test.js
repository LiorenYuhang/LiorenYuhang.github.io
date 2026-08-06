import { createAssistantCore } from "../functions/lib/assistant-core.js";
import { createMemoryCache } from "../functions/lib/cache.js";
import knowledgeBase from "../knowledge-base.generated.mjs";

let pass = 0;
let fail = 0;

function test(name, ok) {
  ok ? pass++ : fail++;
  console.log("[" + (ok ? "PASS" : "FAIL") + "] " + name);
}

function createBudget({ reserveOk = true, dispatchOk = true } = {}) {
  const calls = [];
  return {
    calls,
    async reserveRequest() { calls.push("reserve"); return { ok: reserveOk, reason: reserveOk ? undefined : "budget_exceeded" }; },
    async markDispatched() { calls.push("dispatch"); return { ok: dispatchOk }; },
    async settleSuccess() { calls.push("settleSuccess"); return { ok: true }; },
    async settleRejected() { calls.push("settleRejected"); return { ok: true }; },
    async settleUnknown() { calls.push("settleUnknown"); return { ok: true }; },
    async cancelBeforeDispatch() { calls.push("cancelBeforeDispatch"); return { ok: true }; },
  };
}

function createProvider(result) {
  let calls = 0;
  return {
    config: { model: "test-model" },
    get calls() { return calls; },
    async generateAnswer() { calls++; return result; },
  };
}

function createRejectingProvider(error) {
  let calls = 0;
  return {
    config: { model: "test-model" },
    get calls() { return calls; },
    async generateAnswer() { calls++; throw error; },
  };
}

function createCore(provider, budget, cache) {
  return createAssistantCore({
    knowledgeBase,
    provider,
    budget,
    cache,
    enabled: true,
    promptVersion: "1",
    maxOutputTokens: 800,
    timeoutMs: 1000,
  });
}

async function run() {
  const cache = createMemoryCache();
  const provider = createProvider({ text: "OK", usage: { input_tokens: 10, output_tokens: 5 } });
  const budget = createBudget();
  const core = createCore(provider, budget, cache);

  const success = await core.handle({ question: "Stewart", conversation: [], page_context: null }, "success");
  test("success response", success.ok && success.scope === "success");
  test("success lifecycle", budget.calls.join(",") === "reserve,dispatch,settleSuccess");
  test("provider called once", provider.calls === 1);

  const cached = await core.handle({ question: "Stewart", conversation: [], page_context: null }, "cached");
  test("cache hit", cached.ok && cached._meta.cache_hit === true);
  test("cache skips D1 and provider", budget.calls.length === 3 && provider.calls === 1);

  const rejectedBudget = createBudget();
  const rejectedProvider = createRejectingProvider(Object.assign(new Error("rate"), { code: "provider_rate_limited", status: 429 }));
  const rejected = await createCore(rejectedProvider, rejectedBudget, null).handle({ question: "Stewart", conversation: [], page_context: null }, "rejected");
  test("provider rejection settles rejected", rejectedBudget.calls.join(",") === "reserve,dispatch,settleRejected");
  test("upstream 429 is distinct from site budget", rejected.scope === "upstream_busy");

  const failedDispatchBudget = createBudget({ dispatchOk: false });
  const failedDispatchProvider = createProvider({ text: "unexpected", usage: { input_tokens: 1, output_tokens: 1 } });
  const failedDispatch = await createCore(failedDispatchProvider, failedDispatchBudget, null).handle({ question: "Stewart", conversation: [], page_context: null }, "dispatch-failed");
  test("dispatch failure cancels reservation", failedDispatchBudget.calls.join(",") === "reserve,dispatch,cancelBeforeDispatch");
  test("dispatch failure skips provider", failedDispatchProvider.calls === 0 && failedDispatch.scope === "error");

  const siteBudget = createBudget({ reserveOk: false });
  const siteBudgetProvider = createProvider({ text: "unexpected", usage: { input_tokens: 1, output_tokens: 1 } });
  const limited = await createCore(siteBudgetProvider, siteBudget, null).handle({ question: "Stewart", conversation: [], page_context: null }, "site-limited");
  test("site budget returns rate_limited", limited.scope === "rate_limited");
  test("site budget skips dispatch and provider", siteBudget.calls.join(",") === "reserve" && siteBudgetProvider.calls === 0);

  const authBudget = createBudget();
  const authProvider = createRejectingProvider(Object.assign(new Error("auth"), { code: "provider_auth_error", status: 401 }));
  const auth = await createCore(authProvider, authBudget, null).handle({ question: "Stewart", conversation: [], page_context: null }, "auth");
  test("401 settles rejected", authBudget.calls.join(",") === "reserve,dispatch,settleRejected");
  test("401 disables provider without leaking error", auth.scope === "disabled" && !auth.answer.includes("auth"));

  const upstreamBudget = createBudget();
  const upstreamProvider = createRejectingProvider(Object.assign(new Error("upstream"), { code: "provider_upstream_error", status: 500 }));
  const upstream = await createCore(upstreamProvider, upstreamBudget, null).handle({ question: "Stewart", conversation: [], page_context: null }, "upstream");
  test("500 settles unknown", upstreamBudget.calls.join(",") === "reserve,dispatch,settleUnknown");
  test("500 maps to upstream_error", upstream.scope === "upstream_error");

  const noResultBudget = createBudget();
  const noResultProvider = createProvider({ text: "unexpected", usage: { input_tokens: 1, output_tokens: 1 } });
  const noResult = await createCore(noResultProvider, noResultBudget, null).handle({ question: "摄影旅游美食", conversation: [], page_context: null }, "no-results");
  test("no_results skips budget and provider", noResult.scope === "no_results" && noResultBudget.calls.length === 0 && noResultProvider.calls === 0);

  const failingCacheBudget = createBudget();
  const failingCacheProvider = createProvider({ text: "OK", usage: { input_tokens: 1, output_tokens: 1 } });
  const failingCache = { async get() { throw new Error("cache read"); }, async put() { throw new Error("cache write"); } };
  const cacheFallback = await createCore(failingCacheProvider, failingCacheBudget, failingCache).handle({ question: "Stewart", conversation: [], page_context: null }, "cache-fallback");
  test("cache failures degrade safely", cacheFallback.ok && failingCacheProvider.calls === 1 && failingCacheBudget.calls.includes("settleSuccess"));

  console.log("\n" + pass + "/" + (pass + fail) + " passed");
  process.exitCode = fail > 0 ? 1 : 0;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
