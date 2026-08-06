const ROLES = { user: 1, assistant: 1 };
const MAX_BODY = 65536;
const MAX_RAW_URL = 2048;
const MAX_NORM_PATH = 512;

export function validateRequest(body, limits) {
  limits = limits || {};
  const maxQLen = limits.maxQuestionLength ?? 500;
  const maxConv = limits.maxConversationMessages ?? 6;
  const maxMLen = limits.maxMessageLength ?? 1000;
  if (!body || typeof body !== "object") return e(400, "请求格式错误");
  if (typeof body.question !== "string") return e(400, "question必须是字符串");
  const q = body.question.trim();
  if (!q.length || q.length > maxQLen) return e(400, "question长度无效");
  const conv = body.conversation;
  let safeConv = [];
  if (conv !== undefined && conv !== null) {
    if (!Array.isArray(conv)) return e(400, "conversation必须是数组");
    const c = conv.length > maxConv ? conv.slice(conv.length - maxConv) : conv;
    for (const m of c) {
      if (!m || typeof m !== "object") return e(400, "conversation元素必须是对象");
      if (!ROLES[m.role]) return e(400, "conversation包含非法role");
      if (typeof m.content !== "string") return e(400, "conversation content必须是字符串");
      safeConv.push({ role: m.role, content: m.content.slice(0, maxMLen) });
    }
  }
  const pc = body.page_context;
  let safePageCtx = null;
  if (pc !== undefined && pc !== null) {
    if (typeof pc !== "object") return e(400, "page_context必须是对象");
    const normalized = normalizeSitePath(pc.url);
    if (normalized === null) return e(400, "page_context.url无效");
    safePageCtx = { url: normalized };
  }
  return { ok: true, question: q, conversation: safeConv, page_context: safePageCtx };
}

export function normalizeSitePath(raw) {
  if (!raw || typeof raw !== "string") return null;
  let u = raw.trim();
  // Allow up to MAX_RAW_URL before decoding (encoded URLs can be long)
  if (!u || u.length > MAX_RAW_URL) return null;
  // Remove fragment and query
  const qi = u.indexOf("?");
  if (qi !== -1) u = u.slice(0, qi);
  const hi = u.indexOf("#");
  if (hi !== -1) u = u.slice(0, hi);
  // Decode percent-encoded sequences
  try { u = decodeURIComponent(u); } catch { return null; }
  // Check dangerous patterns before collapsing slashes
  if (/^(https?:|javascript:|data:|vbscript:)/i.test(u)) return null;
  // Reject protocol-relative //host but allow ///path (redundant slashes)
  if (/^\/\/[^/]/u.test(u)) return null;
  // Reject backslash and control chars
  if (u.indexOf(String.fromCharCode(92)) !== -1) return null;
  if (/[\x00-\x1f\x7f]/.test(u)) return null;
  // Collapse multiple slashes
  u = u.replace(/\/{2,}/g, "/");
  // Root path
  if (u === "/") return "/";
  if (!u.startsWith("/")) return null;
  // Normalize trailing slash
  u = u.replace(/\/$/, "") + "/";
  // Limit decoded path length
  if (u.length > MAX_NORM_PATH) return null;
  return u;
}

function e(code, msg) { return { ok: false, code, scope: "bad_request", message: msg }; }
export { MAX_BODY };
