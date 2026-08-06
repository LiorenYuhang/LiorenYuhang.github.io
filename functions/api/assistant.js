import { validateRequest, MAX_BODY } from "../lib/request-validation.js";
import { generateRequestId, filterResponseForClient } from "../lib/security.js";
import { createAssistantCore } from "../lib/assistant-core.js";
import { createMockProvider } from "../lib/mock-provider.js";
import { createDeepSeekProvider } from "../lib/deepseek-provider.js";
import { createMemoryBudgetStore } from "../lib/budget-store.js";
import { createD1BudgetStore } from "../lib/d1-budget-store.js";
import { createMemoryCache, computeKnowledgeVersion } from "../lib/cache.js";
import { createCloudflareCache } from "../lib/cloudflare-cache.js";
import { parsePositiveInt } from "../lib/model-provider.js";
import knowledgeBase from "../../knowledge-base.generated.mjs";

// ---- Runtime singleton (per Worker isolate) ----
let _runtime = null;
let _runtimeFingerprint = null;
const KNOWLEDGE_VERSION = computeKnowledgeVersion(knowledgeBase);

function getRuntimeFingerprint(env) {
  return [
    env.AI_ASSISTANT_ENABLED,
    env.AI_PROVIDER,
    env.DEEPSEEK_MODEL,
    env.DEEPSEEK_BASE_URL,
    env.DEEPSEEK_THINKING,
    env.DEEPSEEK_REASONING_EFFORT,
    env.AI_REQUEST_TIMEOUT_MS,
    env.AI_MAX_OUTPUT_TOKENS,
    env.AI_DAILY_REQUEST_LIMIT,
    env.AI_DAILY_INPUT_TOKEN_LIMIT,
    env.AI_DAILY_OUTPUT_TOKEN_LIMIT,
    env.AI_PROMPT_VERSION,
    env.AI_CACHE_TTL_SECONDS,
    env.AI_PROVIDER_CONFIG_VERSION,
    env.AI_CACHE_VERSION,
    env.SITE_URL,
    env.AI_RUNTIME_ENV,
    env.AI_MOCK_BEHAVIOR,
    KNOWLEDGE_VERSION,
    String(!!env.DEEPSEEK_API_KEY),
  ].join("|");
}

function createRuntime(env) {
  const enabled = env.AI_ASSISTANT_ENABLED === "true";
  const providerType = env.AI_PROVIDER;
  const runtimeEnv = env.AI_RUNTIME_ENV || "";

  // Valid provider: only "mock" in development for Phase 4A
  let provider = null;
  if (enabled) {
    if (!providerType) {
      // Missing provider → disabled
      return createDisabledRuntime("AI_PROVIDER not configured");
    }
    if (providerType === "mock") {
      if (runtimeEnv !== "development") {
        return createDisabledRuntime("mock provider requires AI_RUNTIME_ENV=development");
      }
      provider = createMockProvider({
        model: env.DEEPSEEK_MODEL || "mock-model",
        maxOutputTokens: parsePositiveInt(env.AI_MAX_OUTPUT_TOKENS, 800),
        timeoutMs: parsePositiveInt(env.AI_REQUEST_TIMEOUT_MS, 15000),
        mockBehavior: env.AI_MOCK_BEHAVIOR || "success",
      });
    } else if (providerType === "deepseek") {
      if (!env.DEEPSEEK_API_KEY) return createDisabledRuntime("deepseek requires DEEPSEEK_API_KEY");
      provider = createDeepSeekProvider({
        apiKey: env.DEEPSEEK_API_KEY,
        baseUrl: env.DEEPSEEK_BASE_URL,
        model: env.DEEPSEEK_MODEL,
        thinking: env.DEEPSEEK_THINKING || "disabled",
        reasoningEffort: env.DEEPSEEK_REASONING_EFFORT,
        maxOutputTokens: parsePositiveInt(env.AI_MAX_OUTPUT_TOKENS, 800),
        timeoutMs: parsePositiveInt(env.AI_REQUEST_TIMEOUT_MS, 15000),
      });
    } else {
      return createDisabledRuntime("provider " + providerType + " not implemented");
    }
  }

  if (providerType === "deepseek" && !env.AI_BUDGET_DB) {
      return createDisabledRuntime("deepseek requires D1 binding AI_BUDGET_DB");
    }
    const budget = (providerType === "deepseek")
    ? createD1BudgetStore(env.AI_BUDGET_DB, {
        dailyRequestLimit: parsePositiveInt(env.AI_DAILY_REQUEST_LIMIT, 100),
        dailyInputTokenLimit: parsePositiveInt(env.AI_DAILY_INPUT_TOKEN_LIMIT, 200000),
        dailyOutputTokenLimit: parsePositiveInt(env.AI_DAILY_OUTPUT_TOKEN_LIMIT, 50000),
        maxOutputTokens: parsePositiveInt(env.AI_MAX_OUTPUT_TOKENS, 800),
      })
    : createMemoryBudgetStore({ dailyRequestLimit: parsePositiveInt(env.AI_DAILY_REQUEST_LIMIT, 500) });
  const siteUrl = normalizeSiteUrl(env.SITE_URL || "https://lyhhub.pages.dev");
  if (!siteUrl) return createDisabledRuntime("SITE_URL must be a credential-free HTTPS origin");
  const cache = (providerType === "deepseek" && typeof caches !== "undefined")
    ? createCloudflareCache(caches, siteUrl)
    : createMemoryCache();

  const core = createAssistantCore({
    knowledgeBase,
    provider,
    budget,
    cache,
    enabled,
    promptVersion: env.AI_PROMPT_VERSION || "1",
    maxOutputTokens: parsePositiveInt(env.AI_MAX_OUTPUT_TOKENS, 800),
    timeoutMs: parsePositiveInt(env.AI_REQUEST_TIMEOUT_MS, 15000),
    cacheTtlSeconds: parsePositiveInt(env.AI_CACHE_TTL_SECONDS, 3600),
    providerType,
    thinkingEnabled: env.DEEPSEEK_THINKING === "enabled",
    reasoningEffort: env.DEEPSEEK_REASONING_EFFORT || "",
    providerConfigVersion: env.AI_PROVIDER_CONFIG_VERSION || "1",
    cacheVersion: env.AI_CACHE_VERSION || "1",
  });

  return { core, provider, budget, cache, enabled };
}

function createDisabledRuntime(reason) {
  const core = createAssistantCore({
    knowledgeBase, provider: null, budget: null, cache: null,
    enabled: false, promptVersion: "1", maxOutputTokens: 1000, timeoutMs: 15000,
  });
  return { core, provider: null, budget: null, cache: null, enabled: false, _disabledReason: reason };
}

function getRuntime(env) {
  const fp = getRuntimeFingerprint(env);
  if (_runtime && _runtimeFingerprint === fp) return _runtime;
  _runtime = createRuntime(env);
  _runtimeFingerprint = fp;
  return _runtime;
}

export function createHandler(env, testDeps) {
  if (testDeps) {
    return createRuntime(env);
  }
  return getRuntime(env);
}

// ---- CF Pages entry ----
export async function onRequest(context) {
  const { request, env } = context;
  const rid = generateRequestId();
  const startMs = Date.now();

  try {
    if (request.method !== "POST") {
      return json(405, { ok: false, answer: "Method not allowed", sources: [], scope: "error", request_id: rid });
    }

    const contentType = request.headers.get("Content-Type") || "";
    if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
      return json(400, { ok: false, answer: "Content-Type必须是application/json", sources: [], scope: "bad_request", request_id: rid });
    }

    const cl = parseInt(request.headers.get("Content-Length") || "0", 10);
    if (cl > MAX_BODY) {
      return json(413, { ok: false, answer: "请求体过大", sources: [], scope: "bad_request", request_id: rid });
    }

    let body;
    try {
      const text = await request.text();
      console.log("[DEBUG]", "body_len:", text.length, "body_head:", JSON.stringify(text.substring(0, 100)), "content_type:", request.headers.get("Content-Type"), "rid:", rid);
      if (new TextEncoder().encode(text).length > MAX_BODY) {
        return json(413, { ok: false, answer: "请求体过大", sources: [], scope: "bad_request", request_id: rid });
      }
      body = JSON.parse(text);
    } catch {
      return json(400, { ok: false, answer: "请求格式错误", sources: [], scope: "bad_request", request_id: rid });
    }

    const limits = {
      maxQuestionLength: parsePositiveInt(env.AI_MAX_QUESTION_LENGTH, 500),
      maxConversationMessages: 6,
      maxMessageLength: 1000,
    };
    const validated = validateRequest(body, limits);
    if (!validated.ok) {
      return json(validated.code || 400, { ok: false, answer: validated.message, sources: [], scope: validated.scope, request_id: rid });
    }

    const runtime = getRuntime(env);
    const result = await runtime.core.handle(validated, rid, {
      waitUntil: typeof context.waitUntil === "function" ? context.waitUntil.bind(context) : null,
      requestUrl: request.url,
    });

    // Log from _meta
    const meta = result._meta || {};
    const clientResp = filterResponseForClient(result);
    const elapsed = Date.now() - startMs;
    const statusMap = { success: 200, no_results: 200, bad_request: 400, rate_limited: 429, upstream_busy: 503, upstream_error: 503, disabled: 503, error: 503, timeout: 504 };
    const status = statusMap[result.scope] || 503;
    console.log(JSON.stringify({ ts: new Date().toISOString(), rid, scope: result.scope, status, elapsed_ms: elapsed, retrieval_count: meta.retrieval_count || 0, cache_hit: meta.cache_hit || false, provider_result: meta.provider_result || "none" }));
    return json(status, clientResp);
  } catch (err) {
    const elapsed = Date.now() - startMs;
    console.log(JSON.stringify({ ts: new Date().toISOString(), rid, scope: "error", status: 503, elapsed_ms: elapsed, provider_result: "unhandled_exception" }));
    return json(503, { ok: false, answer: "AI 助手暂时不可用。", sources: [], scope: "error", request_id: rid });
  }
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

function normalizeSiteUrl(raw) {
  let parsed;
  try { parsed = new URL(raw); }
  catch { return null; }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  return parsed.origin;
}
