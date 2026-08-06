import { createDeepSeekProvider } from "../functions/lib/deepseek-provider.js";
let pass = 0, fail = 0;
function t(n, ok) { ok ? pass++ : fail++; console.log("[" + (ok ? "PASS" : "FAIL") + "] " + n); }
function mockFetch(responseFactory) { return (...args) => Promise.resolve(responseFactory(...args)); }

async function run() {
  console.log("DeepSeek Provider Tests");

  // Valid provider
  const p = createDeepSeekProvider({ apiKey: "sk-test", model: "deepseek-v4-flash", maxOutputTokens: 800, timeoutMs: 5000, fetch: mockFetch((url, init) => {
    const body = JSON.parse(init.body);
    t("D1 URL correct", url === "https://api.deepseek.com/chat/completions");
    t("D2 model", body.model === "deepseek-v4-flash");
    t("D3 max_tokens", body.max_tokens === 800);
    t("D4 stream=false", body.stream === false);
    t("D5 thinking disabled", body.thinking.type === "disabled");
    t("D6 system role", body.messages[0].role === "system");
    t("D7 user role", body.messages[1].role === "user");
    t("D8 auth header", init.headers.get("Authorization") === "Bearer sk-test");
    return { status: 200, json: () => Promise.resolve({ choices: [{ message: { content: "Hello" } }], usage: { prompt_tokens: 10, completion_tokens: 5 }, model: "deepseek-v4-flash", id: "req_123" }) };
  })});
  const r = await p.generateAnswer({ systemPrompt: "sys", userPrompt: "usr", maxOutputTokens: 800, signal: null });
  t("D9 text ok", r.text === "Hello");
  t("D10 usage", r.usage.input_tokens === 10 && r.usage.output_tokens === 5);
  t("D11 provider_request_id", r.provider_request_id === "req_123");

  // Deprecated model rejected
  try { createDeepSeekProvider({ apiKey: "sk", model: "deepseek-chat" }); t("D12 deprecated", false); }
  catch (e) { t("D12 deprecated rejected", e.message.includes("deprecated")); }

  // Missing API key
  try { createDeepSeekProvider({ apiKey: "", model: "deepseek-v4-flash" }); t("D13 no key", false); }
  catch (e) { t("D13 no key rejected", e.message.includes("API_KEY")); }

  // Error mapping: 401, 402, 429, 500, non-json, empty choices, no usage
  const errTests = [
    ["D14 400", 400, "provider_request_error"],
    ["D15 401", 401, "provider_auth_error"],
    ["D16 402", 402, "provider_balance_error"],
    ["D17 403", 403, "provider_forbidden"],
    ["D18 404", 404, "provider_model_unavailable"],
    ["D19 429", 429, "provider_rate_limited"],
    ["D20 500", 500, "provider_upstream_error"],
    ["D21 unknown non-2xx", 418, "provider_upstream_error"],
  ];
  for (const [name, status, code] of errTests) {
    const ep = createDeepSeekProvider({ apiKey: "sk", model: "deepseek-v4-flash", fetch: mockFetch(() => ({ status, json: () => Promise.resolve({}) })) });
    try { await ep.generateAnswer({ systemPrompt: "", userPrompt: "", maxOutputTokens: 100, signal: null }); t(name, false); }
    catch (e) { t(name + " " + code, e.code === code); }
  }

  // Non-JSON response
  const nj = createDeepSeekProvider({ apiKey: "sk", model: "deepseek-v4-flash", fetch: mockFetch(() => ({ status: 200, json: () => Promise.reject(new Error("parse")) })) });
  try { await nj.generateAnswer({ systemPrompt: "", userPrompt: "", maxOutputTokens: 100, signal: null }); t("D22 non-JSON", false); }
  catch (e) { t("D22 non-JSON rejected", e.code === "provider_invalid_response"); }

  // Empty choices
  const ec = createDeepSeekProvider({ apiKey: "sk", model: "deepseek-v4-flash", fetch: mockFetch(() => ({ status: 200, json: () => Promise.resolve({ choices: [] }) })) });
  try { await ec.generateAnswer({ systemPrompt: "", userPrompt: "", maxOutputTokens: 100, signal: null }); t("D23 empty choices", false); }
  catch (e) { t("D23 empty choices rejected", e.code === "provider_invalid_response"); }

  // Empty content
  const ectx = createDeepSeekProvider({ apiKey: "sk", model: "deepseek-v4-flash", fetch: mockFetch(() => ({ status: 200, json: () => Promise.resolve({ choices: [{ message: { content: "" } }] }) })) });
  try { await ectx.generateAnswer({ systemPrompt: "", userPrompt: "", maxOutputTokens: 100, signal: null }); t("D24 empty content", false); }
  catch (e) { t("D24 empty content rejected", e.code === "provider_empty_response"); }

  // No usage
  const nu = createDeepSeekProvider({ apiKey: "sk", model: "deepseek-v4-flash", fetch: mockFetch(() => ({ status: 200, json: () => Promise.resolve({ choices: [{ message: { content: "hi" } }] }) })) });
  try { await nu.generateAnswer({ systemPrompt: "", userPrompt: "", maxOutputTokens: 100, signal: null }); t("D25 no usage", false); }
  catch (e) { t("D25 no usage rejected", e.code === "provider_invalid_usage"); }

  const fractional = createDeepSeekProvider({ apiKey: "sk", model: "deepseek-v4-flash", fetch: mockFetch(() => ({ status: 200, json: () => Promise.resolve({ choices: [{ message: { content: "hi" } }], usage: { prompt_tokens: 1.5, completion_tokens: 1 }, model: "deepseek-v4-flash" }) })) });
  try { await fractional.generateAnswer({ systemPrompt: "", userPrompt: "", maxOutputTokens: 100, signal: null }); t("D26 fractional usage", false); }
  catch (e) { t("D26 fractional usage rejected", e.code === "provider_invalid_usage"); }

  const mismatch = createDeepSeekProvider({ apiKey: "sk", model: "deepseek-v4-flash", fetch: mockFetch(() => ({ status: 200, json: () => Promise.resolve({ choices: [{ message: { content: "hi" } }], usage: { prompt_tokens: 1, completion_tokens: 1 }, model: "different-model" }) })) });
  try { await mismatch.generateAnswer({ systemPrompt: "", userPrompt: "", maxOutputTokens: 100, signal: null }); t("D27 model mismatch", false); }
  catch (e) { t("D27 model mismatch rejected", e.code === "provider_model_mismatch"); }

  try { createDeepSeekProvider({ apiKey: "sk", model: "deepseek-v4-flash", baseUrl: "http://api.deepseek.com" }); t("D28 unsafe base URL", false); }
  catch (e) { t("D28 unsafe base URL rejected", e.message.includes("unsafe base URL")); }

  // AbortSignal
  const ac = new AbortController();
  ac.abort();
  const ap = createDeepSeekProvider({ apiKey: "sk", model: "deepseek-v4-flash" });
  const ar = await ap.generateAnswer({ systemPrompt: "", userPrompt: "", maxOutputTokens: 100, signal: ac.signal });
  t("D29 aborted signal", ar.aborted === true);

  console.log("\n" + pass + "/" + (pass+fail) + " passed");
}
run().then(() => process.exitCode = fail > 0 ? 1 : 0).catch(e => { console.error(e); process.exitCode = 1; });
