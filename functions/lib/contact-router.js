/**
 * contact-router.js — 确定性的作者联系方式直接路由
 *
 * "作者联系方式/邮箱/GitHub" 是确定性查询：联系方式是 About 页的稳定公开数据，
 * 且 query 用词（作者/联系方式）与 About 正文用词（我是/联系我）存在 token 缺口，
 * BM25 无法召回。因此走代码直返，从知识库 About 页提取联系方式，不经过 RAG/LLM。
 */

const CONTACT_SUBJECT_RE = /(作者|站长|博主|网站作者|网站主人)/;
const CONTACT_CHANNEL_RE = /(联系|邮箱|邮件|github|email)/i;

const ABOUT_URL = "/about/";
const EMAIL_RE = /[\w.-]+@[\w.-]+\.[a-z]{2,}/i;
const GITHUB_RE = /github[：:]\s*([^\s]+)/i;

export function classifyContactQuery(question) {
  if (!question || typeof question !== "string") return null;
  const q = question.trim();
  if (!q) return null;
  if (CONTACT_SUBJECT_RE.test(q) && CONTACT_CHANNEL_RE.test(q)) return "contact";
  return null;
}

function findAbout(knowledgeBase) {
  if (!knowledgeBase || !knowledgeBase.length) return null;
  return knowledgeBase.find((d) => d.url === ABOUT_URL) || null;
}

export function buildContactAnswer(knowledgeBase) {
  const about = findAbout(knowledgeBase);
  if (!about || !about.content) return null;
  const content = about.content;
  const email = (content.match(EMAIL_RE) || [null])[0];
  const github = (content.match(GITHUB_RE) || [null, null])[1];
  if (!email && !github) return null;

  const lines = ["根据本站“关于我”页面的公开信息，作者的联系方式如下："];
  if (github) lines.push("- GitHub：" + github);
  if (email) lines.push("- 邮箱：" + email);
  return lines.join("\n");
}

export function buildContactSources(knowledgeBase) {
  const about = findAbout(knowledgeBase);
  if (!about) return [];
  return [{
    title: about.title || "关于我",
    url: about.url,
    section: null,
    excerpt: (about.content || "").slice(0, 100),
  }];
}
