export function buildSources(retrievalResults, knowledgeBase) {
  if (!retrievalResults || !retrievalResults.length) return [];
  // Build lookup by id
  const kbMap = new Map();
  if (knowledgeBase) knowledgeBase.forEach((d) => kbMap.set(d.id, d));

  const sources = [];
  const seen = new Set();
  for (const r of retrievalResults) {
    // Must have a valid id present in knowledge base
    if (!r.id || !kbMap.has(r.id)) continue;
    const kb = kbMap.get(r.id);
    // Title, URL, section, excerpt ALL from knowledge base — never trust retrieval result
    const url = kb.url;
    if (!url || !/^\/[^/]/.test(url)) continue; // must start with single /
    if (/^\/\//.test(url)) continue; // no protocol-relative
    const key = kb.document_id + "|" + (kb.section || "");
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({
      title: kb.title,
      url: kb.url,
      section: kb.section || null,
      excerpt: (kb.content || "").slice(0, 200),
    });
    if (sources.length >= 5) break;
  }
  return sources;
}
