import { search, dedupeByDocument } from "../../scripts/search.js";
import { buildSystemPrompt, buildUserPrompt, estimateTokens, trimReferencesToLimit } from "./prompt-builder.js";
import { buildSources } from "./source-builder.js";
import { classifySiteQuery, buildSiteOverviewAnswer, buildRecentArticlesAnswer, buildAllArticlesAnswer, buildArticleSources } from "./site-router.js";
import { classifyContactQuery, buildContactAnswer, buildContactSources } from "./contact-router.js";
import { isCriticalInjection } from "./security.js";
import { computeKnowledgeVersion } from "./cache.js";
import { normalizeSitePath } from "./request-validation.js";

const MAX_CONTEXT_TOKENS = 6000;

// ---- Metadata direct-return: bypass LLM for deterministic queries ----
// Strict patterns: must include a page-context term AND a metadata keyword.
// Standalone keywords ("标题是什么") allowed only with question particles.
const METADATA_RULES = [
  {
    // "这篇文章的标题/页面标题/标题是什么"
    re: /(?:这篇文章|当前页面|本文|本页|此页|页面)(?:的)?(?:标题|名称|题目)|(?:^标题).*(?:是什么|叫什么|是啥|多少)/,
    field: "title",
    format: (v) => `这篇文章的标题是：${v}`,
  },
  {
    // "URL/网址/链接/地址是什么"
    re: /(?:这篇文章|当前页面|本文|本页|此页|页面)(?:的)?(?:URL|网址|链接|地址)|(?:^URL|^网址|^链接|^地址).*(?:是什么|多少)/,
    field: "url",
    format: (v) => `当前页面的链接是：${v}`,
  },
  {
    // "发布日期/发布时间/什么时候发布"
    re: /(?:这篇文章|当前页面|本文|本页|此页|页面)(?:的)?(?:发布[日期时间]|什么(?:时候|时间)发[布表]|何时发[布表]|哪天发[布表])/,
    field: "published_at",
    format: (v) => `这篇文章发布于：${v}`,
  },
];

function detectMetadataQuery(question) {
  for (const rule of METADATA_RULES) {
    if (rule.re.test(question)) return rule;
  }
  return null;
}

export function createAssistantCore(opts) {
  const knowledgeBase = opts.knowledgeBase;
  const provider = opts.provider;
  const budget = opts.budget;
  const cache = opts.cache;
  const enabled = opts.enabled === true;
  const promptVersion = opts.promptVersion || "1";
  const maxOutputTokens = opts.maxOutputTokens ?? 1000;
  const timeoutMs = opts.timeoutMs ?? 15000;
  const cacheTtlSeconds = opts.cacheTtlSeconds ?? 3600;
  const cacheConfig = {
    provider: opts.providerType || "unknown",
    thinkingEnabled: opts.thinkingEnabled === true,
    reasoningEffort: opts.reasoningEffort || "",
    providerConfigVersion: opts.providerConfigVersion || "1",
    cacheVersion: opts.cacheVersion || "1",
  };
  const knowledgeVersion = computeKnowledgeVersion(knowledgeBase);

  const canonicalByNorm = new Map();
  if (knowledgeBase) {
    knowledgeBase.forEach(d => {
      const norm = normalizeSitePath(d.url);
      if (norm && !canonicalByNorm.has(norm)) {
        canonicalByNorm.set(norm, { url: d.url, title: d.title, published_at: d.published_at || null });
      }
    });
  }

  function r_async(rid, ok, answer, sources, scope, meta) { return { ok, answer, sources: sources || [], scope, request_id: rid, _meta: meta }; }

  function resolveCurrentUrl(rawUrl) {
    if (!rawUrl) return null;
    const norm = normalizeSitePath(rawUrl);
    if (!norm) return null;
    const info = canonicalByNorm.get(norm);
    return info ? info.url : norm;
  }

  function makeCacheKey(question, currentUrl) {
    return {
      question,
      currentUrl: currentUrl || "",
      knowledgeVersion,
      promptVersion,
      provider: cacheConfig.provider,
      model: provider.config.model,
      thinkingEnabled: cacheConfig.thinkingEnabled,
      reasoningEffort: cacheConfig.reasoningEffort,
      maxOutputTokens,
      providerConfigVersion: cacheConfig.providerConfigVersion,
      cacheVersion: cacheConfig.cacheVersion,
      ttlMs: cacheTtlSeconds * 1000,
      ttlSeconds: cacheTtlSeconds,
    };
  }

  async function readCache(key) {
    try { return await cache.get(key); }
    catch { return null; }
  }

  async function writeCache(key, value, ctx) {
    try { await cache.put(key, value, ctx); }
    catch { /* cache failures must not affect the answer */ }
  }

  // Normalize all KB URLs once

  function log(level, rid, msg) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), level, rid, msg }));
  }

  async function handle(validated, rid, ctx) {
    const meta = { retrieval_count: 0, cache_hit: false, provider_result: null, provider_type: cacheConfig.provider };
    if (!enabled) return r_async(rid, false, "AI 助手暂时不可用。", [], "disabled", meta);

    const q = validated.question;
    const conv = validated.conversation || [];
    const rawUrl = (validated.page_context && validated.page_context.url) || null;
    const currentUrl = resolveCurrentUrl(rawUrl);

    // Build currentPageInfo from canonical knowledge base entry
    let currentPageInfo = null;
    if (currentUrl) {
      const norm = normalizeSitePath(currentUrl);
      const info = canonicalByNorm.get(norm);
      if (info) {
        currentPageInfo = { title: info.title, url: info.url, published_at: info.published_at || null };
      }
    }

    if (isCriticalInjection(q)) {
      meta.provider_result = "injection_rejected";
      return { ok: true, answer: "抱歉，我无法回应这个请求。", sources: [], scope: "success", request_id: rid, _meta: meta };
    }

    // Metadata query: direct return from currentPageInfo, bypass LLM
    if (currentPageInfo) {
      const metaRule = detectMetadataQuery(q);
      if (metaRule) {
        const value = currentPageInfo[metaRule.field];
        if (value) {
          meta.provider_result = "metadata_direct";
          return r_async(rid, true, metaRule.format(value), [], "success", meta);
        }
      }
    }

    // Site overview / article list: deterministic direct-return, no LLM / no RAG
    const siteKind = classifySiteQuery(q);
    if (siteKind) {
      const answer = siteKind === "site_overview"
        ? buildSiteOverviewAnswer(knowledgeBase)
        : siteKind === "recent_articles"
          ? buildRecentArticlesAnswer(knowledgeBase)
          : buildAllArticlesAnswer(knowledgeBase);
      meta.provider_result = siteKind + "_direct";
      return r_async(rid, true, answer, buildArticleSources(knowledgeBase, 5), "success", meta);
    }

    // Contact info: deterministic direct-return from About page, no LLM / no RAG
    if (classifyContactQuery(q)) {
      const contactAnswer = buildContactAnswer(knowledgeBase);
      if (contactAnswer) {
        meta.provider_result = "contact_direct";
        return r_async(rid, true, contactAnswer, buildContactSources(knowledgeBase), "success", meta);
      }
    }

    const cacheKey = !conv.length && cache ? makeCacheKey(q, currentUrl) : null;
    if (cacheKey) {
      const cached = await readCache(cacheKey);
      if (cached) { meta.cache_hit = true; meta.provider_result = "cache_hit"; return { ok: true, answer: cached.answer, sources: cached.sources, scope: cached.scope, request_id: rid, _meta: meta }; }
    }

    const results = search(q, knowledgeBase, { k: 5, currentUrl: currentUrl || undefined });
    meta.retrieval_count = results.length;

    if (!results.length) {
      if (cacheKey) await writeCache(cacheKey, { answer: "当前网站的公开内容中没有找到足够相关的信息。", sources: [], scope: "no_results" }, ctx);
      meta.provider_result = "no_results";
      return r_async(rid, true, "当前网站的公开内容中没有找到足够相关的信息。", [], "no_results", meta);
    }

    const refs = trimReferencesToLimit(results.map(r => ({ title: r.title, url: r.url, section: r.section, content: r.content, links: r.links || [], id: r.id })), MAX_CONTEXT_TOKENS);
    let systemPrompt;
    let userPrompt;
    let estimatedInput;
    try {
      systemPrompt = buildSystemPrompt({ promptVersion });
      userPrompt = buildUserPrompt(q, refs, conv, currentPageInfo);
      estimatedInput = estimateTokens(systemPrompt) + estimateTokens(userPrompt);
    } catch {
      meta.provider_result = "prompt_build_failed";
      return r_async(rid, false, "AI 助手暂时不可用。", [], "error", meta);
    }

    let reservationActive = false;
    if (budget) {
      const res = await budget.reserveRequest({ requestId: rid, estimatedInputTokens: estimatedInput });
      if (!res.ok) { meta.budget_result = res.reason || "budget_exceeded"; return r_async(rid, false, "请求过于频繁，请稍后再试。", [], "rate_limited", meta); }
      const dispatch = await budget.markDispatched({ requestId: rid });
      if (!dispatch || dispatch.ok !== true) {
        try { await budget.cancelBeforeDispatch({ requestId: rid, reason: "dispatch_failed" }); } catch {}
        meta.budget_result = "dispatch_failed";
        return r_async(rid, false, "AI 助手暂时不可用。", [], "error", meta);
      }
      reservationActive = true;
    }

    const controller = new AbortController();
    let timedOut = false;
    let deadlineTimer = null;

    try {
      const providerPromise = provider.generateAnswer({ systemPrompt, userPrompt, maxOutputTokens, timeoutMs, signal: controller.signal });
      const deadlinePromise = new Promise((resolve) => {
        deadlineTimer = setTimeout(() => { timedOut = true; controller.abort(); resolve(null); }, timeoutMs);
      });
      const modelResult = await Promise.race([providerPromise, deadlinePromise]);

      if (timedOut || (modelResult && modelResult.aborted)) {
        if (reservationActive) { try { await budget.settleUnknown({ requestId: rid, reason: "timeout" }); } catch {} reservationActive = false; }
        meta.provider_result = "timeout";
        return { ok: false, answer: "AI 服务响应超时，请稍后重试。", sources: [], scope: "timeout", request_id: rid, _meta: meta };
      }

      // Validate response structure
      if (!modelResult || typeof modelResult !== "object") {
        if (reservationActive) { try { await budget.settleUnknown({ requestId: rid, reason: "invalid_response" }); } catch {} reservationActive = false; }
        meta.provider_result = "invalid_response";
        return r_async(rid, false, "AI 服务返回异常响应。", [], "error", meta);
      }
      if (timedOut || modelResult.aborted) {
        if (reservationActive) { try { await budget.settleUnknown({ requestId: rid, reason: "timeout" }); } catch {} reservationActive = false; }
        meta.provider_result = "timeout";
        return { ok: false, answer: "AI 服务响应超时，请稍后重试。", sources: [], scope: "timeout", request_id: rid, _meta: meta };
      }
      if (modelResult.status && (modelResult.status < 200 || modelResult.status >= 300)) {
        const error = new Error("provider_http_error");
        error.status = modelResult.status;
        throw error;
      }
      if (typeof modelResult.text !== "string" || !modelResult.text.trim()) {
        if (reservationActive) { try { await budget.settleUnknown({ requestId: rid, reason: "invalid_response" }); } catch {} reservationActive = false; }
        meta.provider_result = "invalid_response";
        return { ok: false, answer: "AI 服务返回异常响应。", sources: [], scope: "error", request_id: rid, _meta: meta };
      }
      const usage = modelResult.usage;
      if (!usage || !Number.isInteger(usage.input_tokens) || !Number.isInteger(usage.output_tokens) || usage.input_tokens < 0 || usage.output_tokens < 0) {
        if (reservationActive) { try { await budget.settleUnknown({ requestId: rid, reason: "invalid_usage" }); } catch {} reservationActive = false; }
        meta.provider_result = "invalid_usage";
        return { ok: false, answer: "AI 服务返回异常响应。", sources: [], scope: "error", request_id: rid, _meta: meta };
      }



      // Success
      if (reservationActive) {
        const settled = await budget.settleSuccess({ requestId: rid, actualInputTokens: usage.input_tokens, actualOutputTokens: usage.output_tokens });
        if (!settled || settled.ok !== true) throw Object.assign(new Error("budget_settlement_failed"), { code: "budget_settlement_failed" });
        reservationActive = false;
      }
      meta.provider_result = "success";

      const sources = buildSources(dedupeByDocument(results), knowledgeBase);
      if (cacheKey) await writeCache(cacheKey, { answer: modelResult.text, sources, scope: "success" }, ctx);

      return { ok: true, answer: modelResult.text, sources, scope: "success", request_id: rid, _meta: meta };
    } catch (err) {
      const classification = classifyProviderError(err, timedOut);
      if (reservationActive) {
        const settle = classification.settlement === "rejected" ? budget.settleRejected : budget.settleUnknown;
        try { await settle({ requestId: rid, reason: classification.providerResult }); } catch {}
        reservationActive = false;
      }
      meta.provider_result = classification.providerResult;
      return r_async(rid, false, classification.answer, [], classification.scope, meta);
    } finally {
      if (deadlineTimer) clearTimeout(deadlineTimer);
    }
  }

  return { handle };
}

function classifyProviderError(error, timedOut) {
  const code = error && error.code;
  const status = error && error.status;
  if (timedOut || code === "provider_aborted" || (error && error.name === "AbortError")) {
    return { settlement: "unknown", scope: "timeout", providerResult: "timeout", answer: "AI 服务响应超时，请稍后重试。" };
  }
  if (code === "provider_auth_error" || code === "provider_balance_error" || code === "provider_forbidden" || [401, 402, 403].includes(status)) {
    return { settlement: "rejected", scope: "disabled", providerResult: code || "provider_disabled", answer: "AI 助手暂时不可用。" };
  }
  if (code === "provider_model_unavailable" || status === 404) {
    return { settlement: "rejected", scope: "upstream_error", providerResult: "model_unavailable", answer: "AI 助手暂时不可用。" };
  }
  if (code === "provider_rate_limited" || status === 429) {
    return { settlement: "rejected", scope: "upstream_busy", providerResult: "upstream_429", answer: "AI 服务繁忙，请稍后再试。" };
  }
  if (code === "provider_request_error" || status === 400 || status === 422) {
    return { settlement: "rejected", scope: "upstream_error", providerResult: "provider_request_rejected", answer: "AI 助手暂时不可用。" };
  }
  return { settlement: "unknown", scope: "upstream_error", providerResult: code || "provider_exception", answer: "AI 助手暂时不可用。" };
}
