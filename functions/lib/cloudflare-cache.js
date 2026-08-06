import { normalize } from "../../scripts/search.js";

/**
 * cloudflare-cache.js — Cloudflare Cache API adapter
 * Opportunistic data-center-local cache. Not globally consistent.
 */
export function createCloudflareCache(cachesObj, baseUrl) {
  const cache = cachesObj && cachesObj.default ? cachesObj.default : (cachesObj || null);

  async function computeKey(opts) {
    const raw = JSON.stringify([
      normalize(opts.question || ""),
      opts.currentUrl || "",
      opts.knowledgeVersion || "0",
      opts.promptVersion || "1",
      opts.provider || "unknown",
      opts.model || "",
      String(opts.thinkingEnabled === true),
      opts.reasoningEffort || "",
      String(opts.maxOutputTokens ?? 800),
      opts.providerConfigVersion || "1",
      opts.cacheVersion || "1",
    ]);
    const data = new TextEncoder().encode(raw);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return "/__ai_cache/" + hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async function get(opts) {
    if (!cache) return null;
    try {
      const key = await computeKey(opts);
      const req = new Request(new URL(key, baseUrl || "https://lyhhub.pages.dev").href, { method: "GET" });
      const response = await cache.match(req);
      if (!response) return null;
      const json = await response.json();
      if (!json || typeof json.answer !== "string") return null;
      return { answer: json.answer, sources: json.sources || [], scope: json.scope || "success" };
    } catch { return null; }
  }

  async function put(opts, result, ctx) {
    if (!cache) return;
    try {
      const key = await computeKey(opts);
      const body = JSON.stringify({ answer: result.answer, sources: result.sources, scope: result.scope });
      const response = new Response(body, {
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=" + (opts.ttlSeconds ?? 3600) },
      });
      const req = new Request(new URL(key, baseUrl || "https://lyhhub.pages.dev").href, { method: "GET" });
      const write = cache.put(req, response.clone()).catch(() => {});
      if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(write);
      else await write;
    } catch { /* cache write failure is non-blocking */ }
  }

  return { get, put };
}
