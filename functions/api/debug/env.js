/**
 * Temporary diagnostic endpoint — /api/debug/env
 * Reports presence of required env vars without exposing values.
 * REMOVE before production release.
 */
export async function onRequest(context) {
  const { env } = context;

  if (env.AI_RUNTIME_ENV !== "development") {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const diag = {
    AI_ASSISTANT_ENABLED: env.AI_ASSISTANT_ENABLED,
    AI_ASSISTANT_ENABLED_eval: env.AI_ASSISTANT_ENABLED === "true",
    AI_PROVIDER: env.AI_PROVIDER || null,
    HAS_DEEPSEEK_KEY: !!env.DEEPSEEK_API_KEY,
    HAS_D1: !!env.AI_BUDGET_DB,
    D1_typeof: typeof env.AI_BUDGET_DB,
  };

  return new Response(JSON.stringify(diag, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
