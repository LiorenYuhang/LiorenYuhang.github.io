/**
 * site-router.js — 确定性的站点概览 / 文章列表直接路由
 *
 * 站点级问题（"这个网站主要有哪些内容"、"最近发布了哪些文章"、"文章列表"等）
 * 是确定性任务：答案完全由知识库的文章元数据推导，不需要 RAG 检索，也不需要 LLM。
 * 直接代码返回，避免 BM25 对这类泛化 query 的召回错误（召回 about 页或空结果）。
 *
 * 带主题的列表查询（"有哪些机器人相关文章"）仍走 search，不在此处理。
 */

const SITE_WORD_RE = /(网站|博客|站点)/;
const OVERVIEW_KW_RE = /(主要)?有哪些内容|有什么内容|主要内容|是做什么|做什么|介绍一下|介绍(一下)?|有哪些方向|哪些方向|写什么|写哪些|写(了)?什么|概况|定位|整体/;
const RECENT_RE = /(最近|最新).{0,5}(发布|更新|写|上传|文章)/;
const ALL_ARTICLES_RE = /(文章列表|所有文章|全部文章|有哪些文章|文章有哪些|都有哪些文章|列(一)?下?(文章|所有)|全部的文章)/;

const ABOUT_URL = "/about/";

export function classifySiteQuery(question) {
  if (!question || typeof question !== "string") return null;
  const q = question.trim();
  if (!q) return null;

  if (SITE_WORD_RE.test(q) && OVERVIEW_KW_RE.test(q)) return "site_overview";
  if (RECENT_RE.test(q)) return "recent_articles";
  if (ALL_ARTICLES_RE.test(q)) return "all_articles";
  return null;
}

function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function sortArticles(a, b) {
  const da = a.published_at || "0000-00-00";
  const db = b.published_at || "0000-00-00";
  if (da === db) return 0;
  return da < db ? 1 : -1; // 新 → 旧
}

export function collectArticles(knowledgeBase) {
  if (!knowledgeBase || !knowledgeBase.length) return [];
  const map = new Map();

  knowledgeBase.forEach((d) => {
    if (!d.url || d.url === ABOUT_URL || !d.document_id) return;
    if (map.has(d.document_id)) return;
    map.set(d.document_id, {
      document_id: d.document_id,
      title: d.title || "",
      url: d.url,
      published_at: d.published_at || null,
      categories: d.categories || [],
      tags: d.tags || [],
      summary: "",
    });
  });

  // Fill summary from the abstract chunk (section contains "摘要"), fallback to first paragraph.
  knowledgeBase.forEach((d) => {
    const a = map.get(d.document_id);
    if (!a || a.summary || !d.content) return;
    if (d.section && d.section.indexOf("摘要") !== -1) a.summary = d.content;
  });
  knowledgeBase.forEach((d) => {
    const a = map.get(d.document_id);
    if (!a || a.summary || !d.content) return;
    if (d.content_type === "paragraph") a.summary = d.content;
  });

  return [...map.values()].sort(sortArticles);
}

function groupByCategory(articles) {
  const groups = new Map();
  articles.forEach((a) => {
    const cats = a.categories && a.categories.length ? a.categories : ["未分类"];
    cats.forEach((c) => {
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c).push(a);
    });
  });
  return [...groups.entries()];
}

function formatArticle(a, i) {
  const date = a.published_at ? "（" + a.published_at + "）" : "";
  return (i + 1) + ". 《" + a.title + "》" + date;
}

export function buildSiteOverviewAnswer(knowledgeBase) {
  const articles = collectArticles(knowledgeBase);
  if (!articles.length) return "当前网站还没有已发布的文章。";

  const groups = groupByCategory(articles);
  const catDesc = groups.map(([c, list]) => c + "（" + list.length + " 篇）").join("、");

  const lines = [];
  lines.push("这是一个个人技术博客，目前共有 " + articles.length + " 篇已发布文章。");
  lines.push("内容方向：" + catDesc + "。");
  lines.push("已发布文章（按时间从新到旧）：");
  articles.forEach((a, i) => lines.push(formatArticle(a, i)));
  return lines.join("\n");
}

export function buildRecentArticlesAnswer(knowledgeBase) {
  const articles = collectArticles(knowledgeBase);
  if (!articles.length) return "当前网站还没有已发布的文章。";

  const lines = ["最近发布的文章（按时间从新到旧）："];
  articles.slice(0, 5).forEach((a, i) => lines.push(formatArticle(a, i)));
  return lines.join("\n");
}

export function buildAllArticlesAnswer(knowledgeBase) {
  const articles = collectArticles(knowledgeBase);
  if (!articles.length) return "当前网站还没有已发布的文章。";

  const groups = groupByCategory(articles);
  const lines = ["本站目前共有 " + articles.length + " 篇文章，按分类如下："];
  groups.forEach(([cat, list]) => {
    lines.push("【" + cat + "】" + list.length + " 篇：");
    list.forEach((a, i) => lines.push(formatArticle(a, i)));
  });
  return lines.join("\n");
}

export function buildArticleSources(knowledgeBase, max) {
  return collectArticles(knowledgeBase).slice(0, max || 5).map((a) => ({
    title: a.title,
    url: a.url,
    section: null,
    excerpt: truncate(a.summary || "", 100),
  }));
}
