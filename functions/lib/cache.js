import { normalize } from "../../scripts/search.js";

export function createMemoryCache() {
  const store = new Map();

  function makeKey(opts) {
    const parts = [
      normalize(opts.question || ""),
      opts.currentUrl || "",
      opts.knowledgeVersion || "0",
      opts.promptVersion || "1",
      opts.provider || "unknown",
      opts.model || "default",
      String(opts.thinkingEnabled === true),
      opts.reasoningEffort || "",
      String(opts.maxOutputTokens ?? 1000),
      opts.providerConfigVersion || "1",
      opts.cacheVersion || "1",
    ];
    return JSON.stringify(parts);
  }

  return {
    async get(opts) {
      const key = makeKey(opts);
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() - entry.ts > (opts.ttlMs ?? 600000)) {
        store.delete(key);
        return null;
      }
      return { answer: entry.answer, sources: entry.sources, scope: entry.scope };
    },
    async put(opts, result, ctx) {
      store.set(makeKey(opts), { answer: result.answer, sources: result.sources, scope: result.scope, ts: Date.now() });
    },
    clear() { store.clear(); },
  };
}

export function computeKnowledgeVersion(knowledgeBase) {
  if (!knowledgeBase || !knowledgeBase.length) return "0";
  const ids = new Set();
  const hashes = new Set();
  knowledgeBase.forEach((d) => {
    ids.add(d.document_id);
    if (d.content_hash) hashes.add(d.document_id + ":" + d.content_hash);
  });
  const sorted = [...hashes].sort().join(",");
  // Simple hash of the version string
  let h = 0;
  for (let i = 0; i < sorted.length; i++) h = ((h << 5) - h + sorted.charCodeAt(i)) | 0;
  return "kv" + Math.abs(h).toString(36);
}
