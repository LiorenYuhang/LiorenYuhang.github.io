import { createCloudflareCache } from "../functions/lib/cloudflare-cache.js";
let pass = 0, fail = 0;
function t(n, ok) { ok ? pass++ : fail++; console.log("[" + (ok ? "PASS" : "FAIL") + "] " + n); }

async function run() {
  console.log("Cloudflare Cache Tests");
  const store = new Map();
  const mockCaches = { default: { match: (req) => Promise.resolve(store.get(req.url)), put: (req, res) => { store.set(req.url, res.clone()); return Promise.resolve(); } } };

  const cache = createCloudflareCache(mockCaches, "https://test.local");
  const opts = { question: "test", currentUrl: "/about/", knowledgeVersion: "v1", promptVersion: "1", model: "deepseek-v4-flash", thinkingEnabled: false, maxOutputTokens: 800, ttlSeconds: 60 };

  // Put and get
  await cache.put(opts, { answer: "hello", sources: [], scope: "success" }, null);
  const hit = await cache.get(opts);
  t("C1 cache hit", hit !== null && hit.answer === "hello");
  t("C2 scope correct", hit.scope === "success");

  // Different question miss
  const miss = await cache.get({ ...opts, question: "different" });
  t("C3 different question miss", miss === null);

  // Different model miss
  const miss2 = await cache.get({ ...opts, model: "deepseek-v4-pro" });
  t("C4 different model miss", miss2 === null);

  // Different knowledgeVersion miss
  const miss3 = await cache.get({ ...opts, knowledgeVersion: "v2" });
  t("C5 different version miss", miss3 === null);

  const miss4 = await cache.get({ ...opts, thinkingEnabled: true });
  t("C6 thinking mode changes the key", miss4 === null);

  const miss5 = await cache.get({ ...opts, providerConfigVersion: "2" });
  t("C7 provider config version changes the key", miss5 === null);

  const miss6 = await cache.get({ ...opts, cacheVersion: "2" });
  t("C8 cache version changes the key", miss6 === null);

  // No request_id in cached content
  await cache.put(opts, { answer: "hi", sources: [], scope: "success", request_id: "should_not_be_cached" }, null);
  const hit2 = await cache.get(opts);
  t("C9 no request_id in cache", hit2 && hit2.request_id === undefined);

  let waited = false;
  await cache.put({ ...opts, question: "waitUntil" }, { answer: "queued", sources: [], scope: "success" }, { waitUntil(promise) { waited = promise instanceof Promise; } });
  t("C10 cache writes can be attached to waitUntil", waited);

  // Cache with null caches (graceful degradation)
  const nc = createCloudflareCache(null);
  const nr = await nc.get(opts);
  t("C11 null cache returns null", nr === null);
  await nc.put(opts, { answer: "x" }, null); // should not throw
  t("C12 null cache put no throw", true);

  console.log("\n" + pass + "/" + (pass+fail) + " passed");
}
run().then(() => process.exitCode = fail > 0 ? 1 : 0);
