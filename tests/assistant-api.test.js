import { validateRequest, normalizeSitePath } from "../functions/lib/request-validation.js";
import { buildSources } from "../functions/lib/source-builder.js";
import { classifySiteQuery, buildSiteOverviewAnswer, buildArticleSources } from "../functions/lib/site-router.js";
import { classifyContactQuery, buildContactAnswer, buildContactSources } from "../functions/lib/contact-router.js";
import { onRequest, createHandler } from "../functions/api/assistant.js";
import knowledgeBase from "../knowledge-base.generated.mjs";

let pass = 0, fail = 0;
const originalProcess = globalThis.process;

function t(n, ok) { ok ? pass++ : fail++; console.log("[" + (ok ? "PASS" : "FAIL") + "] " + n); }

function ctx(q, m, e) {
  m = m || "POST"; e = e || {};
  const h = new Headers();
  const s = (m !== "GET" && q !== undefined) ? (typeof q === "string" ? q : JSON.stringify(q)) : null;
  if (s) { h.set("Content-Length", String(new TextEncoder().encode(s).length)); h.set("Content-Type", "application/json"); }
  return { request: new Request("https://test.local/api/assistant", { method: m, headers: h, body: s }),
    env: Object.assign({ AI_ASSISTANT_ENABLED: "true", AI_PROVIDER: "mock", AI_RUNTIME_ENV: "development", DEEPSEEK_MODEL: "t", AI_MAX_OUTPUT_TOKENS: "1000", AI_REQUEST_TIMEOUT_MS: "500", AI_DAILY_REQUEST_LIMIT: "500", AI_PROMPT_VERSION: "1", AI_MOCK_BEHAVIOR: "success" }, e),
    waitUntil: () => {} };
}

async function run() {
  console.log("normalizeSitePath");
  t("P1 root", normalizeSitePath("/") === "/");
  t("P2 /about/", normalizeSitePath("/about/") === "/about/");
  t("P3 chinese", normalizeSitePath("/2026/08/05/中文文章/") === "/2026/08/05/中文文章/");
  t("P4 encoded", normalizeSitePath("/2026/08/05/%E4%B8%AD%E6%96%87%E6%96%87%E7%AB%A0/") === "/2026/08/05/中文文章/");
  t("P5 //evil null", normalizeSitePath("//evil.com") === null);
  t("P6 https null", normalizeSitePath("https://evil.com") === null);
  t("P7 encoded // null", normalizeSitePath("%2F%2Fevil.com") === null);
  t("P8 encoded backslash null", normalizeSitePath("%5Cevil") === null);
  t("P9 collapse ///", normalizeSitePath("///about/") === "/about/");
  t("P10 no trail", normalizeSitePath("/about") === "/about/");
  t("P11 //恶意", normalizeSitePath("//恶意.com/path") === null);
  t("P12 //_evil", normalizeSitePath("//_evil/path") === null);
  t("P13 //évil", normalizeSitePath("//évil.com/path") === null);
  t("P14 enc//恶意", normalizeSitePath("/%2F%E6%81%B6%E6%84%8F.com/path") === null);

  console.log("Validation");
  const L = { maxQuestionLength: 500 };
  t("V1 valid", validateRequest({ question: "hello" }, L).ok);
  t("V2 //evil 400", !validateRequest({ question: "hi", page_context: { url: "//evil.com" } }, L).ok);
  t("V3 backslash 400", !validateRequest({ question: "hi", page_context: { url: "/foo\\bar" } }, L).ok);
  globalThis.process = undefined;
  try { t("V4 no process", validateRequest({ question: "hello" }, L).ok); }
  finally { globalThis.process = originalProcess; }
  t("V5 process restored", typeof globalThis.process !== "undefined");

  console.log("Provider");
  let r = await onRequest(ctx({ question: "机器人" }, "POST", { AI_PROVIDER: undefined }));
  t("R1 no provider 503", r.status === 503);
  r = await onRequest(ctx({ question: "机器人" }, "POST", { AI_RUNTIME_ENV: undefined }));
  t("R2 mock w/o dev 503", r.status === 503);
  r = await onRequest(ctx({ question: "机器人" }));
  t("R3 dev+mock 200", r.status === 200);

  console.log("Cache");
  const rt = createHandler(ctx().env, true);
  const r1 = await rt.core.handle({ question: "机器人", conversation: [], page_context: null }, "r1");
  t("C1 first ok", r1.ok);
  const r2 = await rt.core.handle({ question: "机器人", conversation: [], page_context: null }, "r2");
  t("C2 cache hit", r2._meta && r2._meta.cache_hit === true);
  t("C3 calls=1", rt.provider.callCount() === 1);

  console.log("Budget release");
  const bRt = createHandler(ctx({ question: "机器人" }, "POST", { AI_DAILY_REQUEST_LIMIT: "500" }).env, true);
  // Test throw recovery
  const badProvider = { config: { model: "t" }, callCount: () => 0, generateAnswer: () => { throw new Error("BOOM"); } };
  const badCore = (await import("../functions/lib/assistant-core.js")).createAssistantCore({
    knowledgeBase, provider: badProvider, budget: bRt.budget, cache: null, enabled: true, promptVersion: "1", maxOutputTokens: 1000, timeoutMs: 15000
  });
  const usageBefore = bRt.budget.getDailyUsage().requests;
  await badCore.handle({ question: "机器人", conversation: [], page_context: null }, "b1");
  t("B1 post-dispatch throw keeps request count", bRt.budget.getDailyUsage().requests === usageBefore + 1);

  console.log("Budget limit");
  const lRt = createHandler(ctx({ question: "机器人" }, "POST", { AI_DAILY_REQUEST_LIMIT: "1" }).env, true);
  t("B2 req1 ok", (await lRt.core.handle({ question: "机器人", conversation: [], page_context: null }, "b2")).ok);
  t("B3 req2 429", !(await lRt.core.handle({ question: "Stewart", conversation: [], page_context: null }, "b3")).ok);


  console.log("Provider responses");
  // 429 with empty text
  const p429 = { config: { model: "t" }, callCount: () => 0, generateAnswer: () => Promise.resolve({ status: 429, text: "", usage: { input_tokens: 0, output_tokens: 0 } }) };
  const c429 = (await import("../functions/lib/assistant-core.js")).createAssistantCore({ knowledgeBase, provider: p429, budget: createHandler(ctx().env, true).budget, cache: null, enabled: true, promptVersion: "1", maxOutputTokens: 1000, timeoutMs: 15000 });
  const r429 = await c429.handle({ question: "机器人", conversation: [], page_context: null }, "p429");
  t("P1 upstream 429 scope", r429.scope === "upstream_busy");

  // 500
  const p500 = { config: { model: "t" }, callCount: () => 0, generateAnswer: () => Promise.resolve({ status: 500, text: "", usage: { input_tokens: 0, output_tokens: 0 } }) };
  const c500 = (await import("../functions/lib/assistant-core.js")).createAssistantCore({ knowledgeBase, provider: p500, budget: createHandler(ctx().env, true).budget, cache: null, enabled: true, promptVersion: "1", maxOutputTokens: 1000, timeoutMs: 15000 });
  const r500 = await c500.handle({ question: "机器人", conversation: [], page_context: null }, "p500");
  t("P2 500 upstream error", r500.scope === "upstream_error");

  // empty text with usage
  const pEmpty = { config: { model: "t" }, callCount: () => 0, generateAnswer: () => Promise.resolve({ text: "", usage: { input_tokens: 100, output_tokens: 0 } }) };
  const cEmpty = (await import("../functions/lib/assistant-core.js")).createAssistantCore({ knowledgeBase, provider: pEmpty, budget: createHandler(ctx().env, true).budget, cache: null, enabled: true, promptVersion: "1", maxOutputTokens: 1000, timeoutMs: 15000 });
  const rEmpty = await cEmpty.handle({ question: "机器人", conversation: [], page_context: null }, "pEmpty");
  t("P3 empty text error", !rEmpty.ok);

  // no usage
  const pNoUsage = { config: { model: "t" }, callCount: () => 0, generateAnswer: () => Promise.resolve({ text: "hello" }) };
  const cNoUsage = (await import("../functions/lib/assistant-core.js")).createAssistantCore({ knowledgeBase, provider: pNoUsage, budget: createHandler(ctx().env, true).budget, cache: null, enabled: true, promptVersion: "1", maxOutputTokens: 1000, timeoutMs: 15000 });
  const rNoUsage = await cNoUsage.handle({ question: "机器人", conversation: [], page_context: null }, "pNoU");
  t("P4 no usage error", !rNoUsage.ok);

  console.log("Timeout");
  const tRt = createHandler(ctx({ question: "机器人" }, "POST", { AI_MOCK_BEHAVIOR: "ignore_abort", AI_REQUEST_TIMEOUT_MS: "200" }).env, true);
  const t0 = Date.now();
  const tR = await tRt.core.handle({ question: "机器人", conversation: [], page_context: null }, "t1");
  t("T1 ignore_abort 504", !tR.ok && tR.scope === "timeout");
  t("T2 fast", (Date.now() - t0) < 1000);

  console.log("Current page with encoded URL");
  const stewartUrl = "/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/";
  const encodedStewart = encodeURI(stewartUrl);
  const cpNorm = (await import("../functions/lib/request-validation.js")).normalizeSitePath(encodedStewart);
  t("CP1 encoded normalize OK", cpNorm !== null && cpNorm === (await import("../functions/lib/request-validation.js")).normalizeSitePath(stewartUrl));
  const cpR = await rt.core.handle({ question: "这篇文章主要讲了什么", conversation: [], page_context: { url: encodedStewart } }, "cp1");
  t("CP2 curpage hit Stewart", cpR.ok && cpR.sources.length > 0 && cpR.sources[0].section && cpR.sources[0].section.includes("摘要"));

  console.log("Site Router");
  t("SR1 site_overview intent", classifySiteQuery("这个网站主要有哪些内容？") === "site_overview");
  t("SR2 recent intent", classifySiteQuery("最近发布了哪些文章？") === "recent_articles");
  t("SR3 all_articles intent", classifySiteQuery("文章列表") === "all_articles");
  t("SR4 topic list not routed", classifySiteQuery("有哪些机器人相关文章？") === null);
  t("SR5 overview answer lists articles", buildSiteOverviewAnswer(knowledgeBase).indexOf("已发布文章") !== -1);
  t("SR6 sources exclude about", buildArticleSources(knowledgeBase, 5).every(s => s.url !== "/about/"));

  const srCalls = rt.provider.callCount();
  const srR = await rt.core.handle({ question: "这个网站主要有哪些内容？", conversation: [], page_context: null }, "sr1");
  t("SR7 site_overview direct", srR.ok && srR._meta.provider_result === "site_overview_direct");
  t("SR8 site_overview no LLM", rt.provider.callCount() === srCalls);
  t("SR9 site_overview sources", srR.sources.length > 0);
  const srR2 = await rt.core.handle({ question: "最近发布了哪些文章？", conversation: [], page_context: null }, "sr2");
  t("SR10 recent direct", srR2.ok && srR2._meta.provider_result === "recent_articles_direct");

  console.log("Contact Router");
  t("CR1 contact intent 联系方式", classifyContactQuery("网站作者联系方式是什么？") === "contact");
  t("CR2 contact intent 怎么联系", classifyContactQuery("作者怎么联系？") === "contact");
  t("CR3 contact intent 邮箱", classifyContactQuery("作者邮箱是什么？") === "contact");
  t("CR4 contact intent GitHub", classifyContactQuery("作者的 GitHub 是什么？") === "contact");
  t("CR5 not routed site overview", classifyContactQuery("这个网站主要有哪些内容？") === null);
  t("CR6 answer from KB", buildContactAnswer(knowledgeBase).indexOf("GitHub") !== -1);
  t("CR7 sources about", buildContactSources(knowledgeBase)[0].url === "/about/");

  const crR = await rt.core.handle({ question: "网站作者联系方式是什么？", conversation: [], page_context: null }, "cr1");
  t("CR8 contact direct", crR.ok && crR._meta.provider_result === "contact_direct");
  t("CR9 contact sources", crR.sources.length > 0 && crR.sources[0].url === "/about/");

  console.log("HTTP");
  r = await onRequest(ctx({ question: "机器人" }));
  t("H1 200", r.status === 200);
  const j = await r.json();
  t("H2 no _meta", j._meta === undefined);
  t("H3 rid", j.request_id.startsWith("req_"));
  t("H4 no CORS", !r.headers.get("Access-Control-Allow-Origin"));
  r = await onRequest(ctx({ question: "hi" }, "GET"));
  t("H5 GET 405", r.status === 405);
  r = await onRequest(ctx("bad"));
  t("H6 bad JSON 400", r.status === 400);
  r = await onRequest(ctx({ question: "hi", page_context: { url: "//evil" } }));
  t("H7 //URL 400", r.status === 400);
  r = await onRequest(ctx({ question: "hi", conversation: [{ role: "system", content: "x" }] }));
  t("H8 sys 400", r.status === 400);
  r = await onRequest(ctx({ question: "x".repeat(100000) }));
  t("H9 oversize 413", r.status === 413);
  r = await onRequest(ctx({ question: "hi" }, "POST", { AI_ASSISTANT_ENABLED: "false" }));
  t("H10 disabled 503", r.status === 503);
  r = await onRequest(ctx({ question: "摄影技巧" }));
  t("H11 no_results 200", r.status === 200);
  r = await onRequest(ctx({ question: "机器人" }));
  t("H12 sources from KB", (await r.json()).sources.some(s => s.url.startsWith("/")));
  const noContentType = { request: new Request("https://test.local/api/assistant", { method: "POST", body: JSON.stringify({ question: "hi" }) }), env: ctx().env };
  r = await onRequest(noContentType);
  t("H13 missing content type 400", r.status === 400);

  console.log("\n" + pass + "/" + (pass + fail) + " passed");
  if (originalProcess) originalProcess.exitCode = fail > 0 ? 1 : 0;
}
run().catch(e => { console.error(e); if (originalProcess) originalProcess.exitCode = 1; });
