/**
 * deepseek-provider.js — DeepSeek API v4 provider
 * Uses Workers-native fetch. No OpenAI SDK. No Node.js deps.
 */
const MODEL_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/i;
const DEPRECATED_MODELS = new Set(["deepseek-chat", "deepseek-reasoner"]);

export function createDeepSeekProvider(config) {
  const apiKey = config.apiKey;
  const baseUrl = normalizeBaseUrl(config.baseUrl ?? "https://api.deepseek.com");
  const model = config.model ?? "deepseek-v4-flash";
  const thinkingEnabled = config.thinking === "enabled";
  const reasoningEffort = config.reasoningEffort || "high";
  const fetchImpl = config.fetch || fetch;

  if (!apiKey) throw new Error("provider_config_error: DEEPSEEK_API_KEY missing");
  if (DEPRECATED_MODELS.has(model)) throw new Error("provider_config_error: deprecated model " + model);
  if (!MODEL_NAME_PATTERN.test(model)) throw new Error("provider_config_error: invalid model name " + model);

  return {
    config: { model, baseUrl, maxOutputTokens: config.maxOutputTokens ?? 800, timeoutMs: config.timeoutMs ?? 15000, thinkingEnabled },
    generateAnswer(params) {
      const { systemPrompt, userPrompt, maxOutputTokens, timeoutMs, signal } = params;
      const url = baseUrl + "/chat/completions";

      const body = {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: maxOutputTokens ?? config.maxOutputTokens ?? 800,
        stream: false,
      };

      if (thinkingEnabled) {
        body.thinking = { type: "enabled" };
        body.reasoning_effort = reasoningEffort;
      } else {
        body.thinking = { type: "disabled" };
      }

      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      headers.set("Authorization", "Bearer " + apiKey);

      const controller = new AbortController();
      const linkedSignal = signal
        ? (signal.aborted ? null : (signal.addEventListener("abort", () => controller.abort(), { once: true }), controller.signal))
        : controller.signal;

      if (signal && signal.aborted) {
        return Promise.resolve({ text: "", usage: { input_tokens: 0, output_tokens: 0 }, model, provider_request_id: null, aborted: true });
      }

      return fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: linkedSignal,
      }).then(async (response) => {
        const status = response.status;
        let json;
        try { json = await response.json(); } catch { json = null; }

        if (status < 200 || status >= 300) throw providerHttpError(status);

        if (!json || typeof json !== "object") throw Object.assign(new Error("provider_invalid_response"), { code: "provider_invalid_response" });
        if (!Array.isArray(json.choices) || !json.choices.length) throw Object.assign(new Error("provider_invalid_response"), { code: "provider_invalid_response" });

        const content = json.choices[0].message?.content;
        if (typeof content !== "string" || !content.trim()) throw Object.assign(new Error("provider_empty_response"), { code: "provider_empty_response" });

        const usage = json.usage;
        if (!usage || !Number.isInteger(usage.prompt_tokens) || !Number.isInteger(usage.completion_tokens) || usage.prompt_tokens < 0 || usage.completion_tokens < 0) {
          throw Object.assign(new Error("provider_invalid_usage"), { code: "provider_invalid_usage" });
        }
        if (typeof json.model !== "string" || json.model !== model) {
          throw Object.assign(new Error("provider_model_mismatch"), { code: "provider_model_mismatch" });
        }

        return {
          text: content.trim(),
          usage: { input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens },
          model: json.model,
          provider_request_id: json.id || null,
        };
      }).catch(err => {
        if (err.name === "AbortError" || err.code === "provider_aborted") {
          return { text: "", usage: { input_tokens: 0, output_tokens: 0 }, model, provider_request_id: null, aborted: true };
        }
        if (err.code) throw err; // already formatted
        throw Object.assign(new Error("provider_network_error"), { code: "provider_network_error" });
      });
    },
  };
}

function normalizeBaseUrl(raw) {
  let parsed;
  try { parsed = new URL(raw); }
  catch { throw new Error("provider_config_error: invalid base URL"); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("provider_config_error: unsafe base URL");
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.href.replace(/\/$/, "");
}

function providerHttpError(status) {
  let code = "provider_upstream_error";
  if (status === 400 || status === 422) code = "provider_request_error";
  else if (status === 401) code = "provider_auth_error";
  else if (status === 402) code = "provider_balance_error";
  else if (status === 403) code = "provider_forbidden";
  else if (status === 404) code = "provider_model_unavailable";
  else if (status === 429) code = "provider_rate_limited";
  return Object.assign(new Error(code), { code, status });
}
