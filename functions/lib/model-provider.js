export function validateProviderConfig(env) {
  return {
    model: env.DEEPSEEK_MODEL || "deepseek-chat",
    baseUrl: env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    apiKey: env.DEEPSEEK_API_KEY || "",
    maxOutputTokens: parsePositiveInt(env.AI_MAX_OUTPUT_TOKENS, 1000),
    timeoutMs: parsePositiveInt(env.AI_REQUEST_TIMEOUT_MS, 15000),
  };
}

export function createProvider(env) {
  return { config: validateProviderConfig(env), generateAnswer() { throw new Error("Provider not initialized"); } };
}

export function parsePositiveInt(s, fallback) {
  if (typeof s === "number") return Number.isSafeInteger(s) && s > 0 ? s : fallback;
  if (typeof s !== "string" || !/^[1-9]\d*$/.test(s)) return fallback;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : fallback;
}
