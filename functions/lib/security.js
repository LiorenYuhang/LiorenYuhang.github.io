// Only block explicit System Prompt / API key extraction attempts
const CRITICAL_INJECTION = [
  /(忽略|ignore|disregard|forget).*(此前|之前|上面|previous|above).*(指令|指示|instructions?|prompt)/i,
  /(tell|show|reveal|输出|打印).*(system.?prompt|系统.?提示|密钥|api.?key|secret)/i,
  /(what.is|告诉我).*(你的|your).*(system.?prompt|系统.?提示|指令|规则)/i,
];

export function isCriticalInjection(text) {
  if (!text || typeof text !== "string") return false;
  return CRITICAL_INJECTION.some((re) => re.test(text));
}

export function sanitizeForLog(text, maxLen) {
  if (!text) return "";
  return String(text).slice(0, maxLen || 80).replace(/[\n\r\t]/g, " ");
}

export function generateRequestId() {
  return "req_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const SENSITIVE_KEYS = ["answer", "sources", "scope", "request_id", "ok", "retry_after_seconds"];
export function filterResponseForClient(result) {
  const out = {};
  for (const k of SENSITIVE_KEYS) if (k in result) out[k] = result[k];
  out.ok = result.ok !== false;
  out.answer = result.answer || "";
  out.sources = result.sources || [];
  out.scope = result.scope || "error";
  out.request_id = result.request_id || generateRequestId();
  return out;
}

export function escapeDelimiters(text) {
  if (!text) return text;
  return String(text)
    .replace(/\[系统规则\]/g, "[系统 规则]")
    .replace(/\[本站参考内容开始\]/g, "[本站参考 内容开始]")
    .replace(/\[本站参考内容结束\]/g, "[本站参考 内容结束]")
    .replace(/\[最近对话\]/g, "[最近 对话]")
    .replace(/\[用户当前问题\]/g, "[用户 当前问题]");
}
