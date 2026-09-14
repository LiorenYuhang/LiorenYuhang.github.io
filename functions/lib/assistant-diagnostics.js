// Request-local, log-only state. Never attach upstream data or exception text.
export function createDiagnostics() {
  return {
    stage: null, failure_stage: null, error_category: null,
    upstream_status: null, provider_http_ok: null, response_json_ok: null,
    content_ok: null, usage_ok: null, model_ok: null, provider_answer_ok: null,
    settle_success_started: false, settle_success_ok: null,
    settle_success_threw: null, sources_ok: null,
  };
}

export function failDiagnostics(diagnostics, category) {
  if (!diagnostics.failure_stage) {
    diagnostics.failure_stage = diagnostics.stage;
    diagnostics.error_category = category;
  }
}

const STAGES = new Set([
  "runtime", "budget_reserve", "budget_dispatch", "provider_fetch", "provider_http",
  "provider_json_parse", "provider_content_validation", "provider_usage_validation",
  "provider_model_validation", "budget_settle_success", "sources_build", "success",
  "response_mapping",
]);
const CATEGORIES = new Set(["network", "http", "parse", "validation", "unexpected_exception", "timeout"]);
const PROVIDER_RESULTS = new Set([
  "none", "success", "cache_hit", "no_results", "injection_rejected", "metadata_direct",
  "site_overview_direct", "recent_articles_direct", "all_articles_direct", "contact_direct",
  "prompt_build_failed", "timeout", "invalid_response", "invalid_usage", "provider_disabled",
  "provider_auth_error", "provider_balance_error", "provider_forbidden", "model_unavailable",
  "upstream_429", "provider_request_rejected", "provider_upstream_error", "provider_network_error",
  "provider_invalid_response", "provider_empty_response", "provider_invalid_usage",
  "provider_model_mismatch", "budget_settlement_failed", "provider_exception", "unhandled_exception",
]);

export function diagnosticProviderResult(value) {
  return PROVIDER_RESULTS.has(value) ? value : "unexpected_exception";
}

// Explicit allowlist: no arbitrary strings, error messages, models or data objects.
export function diagnosticLogFields(diagnostics) {
  const out = createDiagnostics();
  for (const key of Object.keys(out)) {
    const value = diagnostics[key];
    if (key === "stage" || key === "failure_stage") out[key] = STAGES.has(value) ? value : null;
    else if (key === "error_category") out[key] = CATEGORIES.has(value) ? value : null;
    else if (key === "upstream_status") out[key] = Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
    else out[key] = typeof value === "boolean" ? value : null;
  }
  return out;
}
