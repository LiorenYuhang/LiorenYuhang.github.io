/**
 * search.js v3.1
 * Fixed scoring: document metadata vs chunk relevance, currentUrl support
 */
'use strict';

var CJK_RE = /[一-鿿㐀-䶿]+/g;
var PUNCT_RE = /[，。！？、；：""''（）【】《》\s,!.?;:'"()\[\]{}]/g;
var MIN_SCORE = 1;
var CURRENT_PAGE_TERMS = /(这篇文章|当前页面|本文|这里主要讲什么|本页|此页)/;
var LIST_INTENT_TERMS = /(有哪些.*文章|哪些.*文章|文章列表|网站.*有哪些.*内容|分类.*有哪些|类有.*哪些)/;
// Summary intent: "what is this page/article about" — trigger summary ordering
var SUMMARY_INTENT_TERMS = /(这篇文章主要|这篇文章.*讲|当前页面.*内容|本文介绍|这里.*主要.*讲|本页.*内容|概括|总结.*一下)/;
// Topic-filtered list: has a topic qualifier before/after "articles about X"
var TOPIC_LIST_TERMS = /(关于.*的|.*相关.*文章|.*分类.*哪些|有哪些.*关于)/;

function normalize(text) {
  return text.toLowerCase()
    .replace(/[！-～]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
    .replace(PUNCT_RE, ' ').replace(/\s+/g, ' ').trim();
}

function dedupe(arr) {
  var seen = {}, out = [];
  for (var i = 0; i < arr.length; i++) { if (!seen[arr[i]]) { seen[arr[i]] = true; out.push(arr[i]); } }
  return out;
}

function tokenize(text) {
  var cleaned = normalize(text);
  var words = cleaned.split(' ').filter(function (w) { return w.length > 0; });
  var bigrams = [];
  CJK_RE.lastIndex = 0;
  var m;
  while ((m = CJK_RE.exec(text)) !== null) {
    var run = m[0];
    for (var i = 0; i < run.length - 1; i++) bigrams.push(run.slice(i, i + 2));
  }
  return { words: dedupe(words), bigrams: dedupe(bigrams) };
}

/* ================================================================
   Document-level metadata scoring (title, tags, categories)
   ================================================================ */
function scoreDocumentMetadata(doc, qNorm, qTokens) {
  var score = 0;
  var reasons = [];

  // Title exact match (weight 25)
  var normTitle = normalize(doc.title);
  if (normTitle.indexOf(qNorm) !== -1 && qNorm.length >= 2) { score += 25; reasons.push('title_exact'); }

  // Title bigram overlap (weight 4 per overlap)
  var tTokens = tokenize(doc.title);
  var tBgSet = {}; tTokens.bigrams.forEach(function (b) { tBgSet[b] = true; });
  var tBgHits = 0; qTokens.bigrams.forEach(function (b) { if (tBgSet[b]) tBgHits++; });
  if (tBgHits >= 2) { score += tBgHits * 4; reasons.push('title_bigram:' + tBgHits); }

  // Title word overlap (weight 3 per word)
  var tWSet = {}; tTokens.words.forEach(function (w) { tWSet[w] = true; });
  var tWHits = 0; qTokens.words.forEach(function (w) { if (tWSet[w] && w.length >= 2) tWHits++; });
  if (tWHits >= 1) { score += tWHits * 3; reasons.push('title_word:' + tWHits); }

  // Tag match (weight 10)
  var tagsN = (doc.tags || []).map(function (t) { return normalize(t); });
  var tagHit = tagsN.some(function (t) { return t.indexOf(qNorm) !== -1 || (qNorm.length >= 2 && qNorm.indexOf(t) !== -1); });
  if (tagHit) { score += 10; reasons.push('tag_match'); }

  // Category match (weight 8)
  var catsN = (doc.categories || []).map(function (c) { return normalize(c); });
  var catHit = catsN.some(function (c) { return c.indexOf(qNorm) !== -1 || (qNorm.length >= 2 && qNorm.indexOf(c) !== -1); });
  if (catHit) { score += 8; reasons.push('category_match'); }

  return { score: score, reasons: reasons };
}

/* ================================================================
   Chunk-level relevance scoring (section + content)
   ================================================================ */
function scoreChunkRelevance(doc, qNorm, qTokens) {
  var score = 0;
  var reasons = [];

  // Section heading match (weight 6)
  if (doc.section && normalize(doc.section).indexOf(qNorm) !== -1) { score += 6; reasons.push('section_match'); }

  // Content bigram overlap (weight 1 per overlap)
  var dTokens = tokenize(doc.content);
  var dBgSet = {}; dTokens.bigrams.forEach(function (b) { dBgSet[b] = true; });
  var bgHits = 0; qTokens.bigrams.forEach(function (b) { if (dBgSet[b]) bgHits++; });
  score += bgHits;
  if (bgHits >= 2) reasons.push('content_bigram:' + bgHits);

  // Content word overlap (weight 2 per word)
  var dWSet = {}; dTokens.words.forEach(function (w) { dWSet[w] = true; });
  var wHits = 0; qTokens.words.forEach(function (w) { if (dWSet[w] && w.length >= 2) wHits++; });
  score += wHits * 2;
  if (wHits >= 1) reasons.push('content_word:' + wHits);

  // Raw substring in content (weight 1, min 3 chars)
  if (qNorm.length >= 3 && doc.content.indexOf(qNorm) !== -1) { score += 2; reasons.push('content_raw'); }

  return { score: score, reasons: reasons };
}

/* ================================================================
   Main search
   ================================================================ */
function search(query, documents, opts) {
  opts = opts || {};
  var k = opts.k || 5;
  var threshold = opts.threshold != null ? opts.threshold : MIN_SCORE;
  var currentUrl = opts.currentUrl || null;

  if (!query || !query.trim()) return [];

  var q = query.trim();
  var qNorm = normalize(q);

  // Current-page query without currentUrl → return empty (can't answer "this article" without context)
  if (CURRENT_PAGE_TERMS.test(q) && !currentUrl) return [];

  // Check for current-page intent with valid currentUrl
  var isCurrentPageQuery = CURRENT_PAGE_TERMS.test(q) && currentUrl;
  var isContextualQuery = !isCurrentPageQuery && !!currentUrl; // has page_context but not explicit "this article"
  var currentDocs = [];
  if (isCurrentPageQuery) {
    currentDocs = documents.filter(function (d) { return d.url === currentUrl; });
    if (!currentDocs.length) return []; // URL not in knowledge base
  }

  // Tokenize once
  var qTokens = tokenize(q);

  // Score each chunk: document metadata + chunk relevance
  var scored = documents.map(function (doc) {
    var metaScore = scoreDocumentMetadata(doc, qNorm, qTokens);
    var chunkScore = scoreChunkRelevance(doc, qNorm, qTokens);
    var totalScore = metaScore.score + chunkScore.score;
    var allReasons = metaScore.reasons.concat(chunkScore.reasons);

    // Tiered current-page boost
    if (doc.url === currentUrl) {
      if (isCurrentPageQuery) {
        // Tier 1: explicit "this article" → double chunk relevance
        totalScore += chunkScore.score;
        allReasons.push('current_page_boost');
      } else if (isContextualQuery) {
        // Tier 2: has page_context → moderate boost (+50% chunk score, min +2)
        var ctxBoost = Math.max(2, Math.floor(chunkScore.score * 0.5));
        totalScore += ctxBoost;
        allReasons.push('context_page_boost:' + ctxBoost);
      }
    }

    // Dynamic threshold: require at least 2 bigram/word hits OR metadata match
    var contentSignal = chunkScore.score >= 3; // at least 3 from chunk content

    return {
      doc: doc,
      score: totalScore,
      reasons: allReasons,
      metaScore: metaScore.score,
      chunkScore: chunkScore.score,
      passesContentThreshold: contentSignal
    };
  });

  // Filter: must pass score threshold AND (metadata match OR content signal OR current-page)
  scored = scored.filter(function (s) {
    if (s.score < threshold) return false;
    if (s.metaScore >= 8) return true;
    if (s.passesContentThreshold) return true;
    // Current-page query: lower bar for same-URL docs
    if (isCurrentPageQuery && s.doc.url === currentUrl && s.score >= 1) return true;
    return false;
  });

  // Sort by score desc
  scored.sort(function (a, b) { return b.score - a.score; });

  // Current-page summary intent: force summary ordering
  var isSummaryIntent = SUMMARY_INTENT_TERMS.test(q) && currentUrl;
  if (isCurrentPageQuery && currentDocs.length) {
    var sameUrl = scored.filter(function (s) { return s.doc.url === currentUrl; });
    var other = scored.filter(function (s) { return s.doc.url !== currentUrl; });

    if (isSummaryIntent) {
      // Summary intent: build sorted list from ALL current-page chunks by structural order,
      // merging in any scored results so high-relevance technical chunks can still surface.
      // Non-summary (technical) queries that also match current-page terms just use normal scoring.
      var orderedFromAll = currentDocs.map(function (d) {
        var orderScore = currentPageChunkOrder(d);
        // Check if this chunk is in the scored results
        var inScored = sameUrl.filter(function (s) { return s.doc.id === d.id; });
        var baseScore = inScored.length ? inScored[0].score : 0;
        return {
          doc: d,
          score: baseScore || orderScore,
          reasons: inScored.length ? inScored[0].reasons : ['current_page_ordered'],
          metaScore: 0,
          chunkScore: baseScore || orderScore,
          passesContentThreshold: true
        };
      });
      orderedFromAll.sort(function (a, b) {
        return currentPageChunkOrder(b.doc) - currentPageChunkOrder(a.doc) || b.score - a.score;
      });
      sameUrl = orderedFromAll.slice(0, k);
    } else if (!sameUrl.length) {
      // Current-page query but not summary intent and no scored results
      sameUrl = currentDocs.map(function (d) {
        var orderScore = currentPageChunkOrder(d);
        return { doc: d, score: orderScore, reasons: ['current_page_fallback'], metaScore: 0, chunkScore: orderScore, passesContentThreshold: true };
      }).sort(function (a, b) { return b.score - a.score; }).slice(0, k);
    }
    scored = sameUrl.concat(other);
  }

  // List intent: deduplicate by document_id
  var isListIntent = LIST_INTENT_TERMS.test(q);
  var isTopicList = isListIntent && TOPIC_LIST_TERMS.test(q);

  if (isListIntent) {
    var seenDocs = {};
    var deduped = [];
    scored.sort(function (a, b) {
      var aOrder = summarizeChunkOrder(a.doc);
      var bOrder = summarizeChunkOrder(b.doc);
      return aOrder - bOrder || b.score - a.score;
    });
    scored.forEach(function (s) {
      if (!seenDocs[s.doc.document_id]) {
        // Topic-filtered list: require tag/category/title match
        if (isTopicList) {
          var qNorm = normalize(q);
          var tagsN = (s.doc.tags || []).map(function (t) { return normalize(t); });
          var catsN = (s.doc.categories || []).map(function (c) { return normalize(c); });
          var hasTagMatch = tagsN.some(function (t) { return t.indexOf(qNorm) !== -1 || qNorm.indexOf(t) !== -1; });
          var hasCatMatch = catsN.some(function (c) { return c.indexOf(qNorm) !== -1 || qNorm.indexOf(c) !== -1; });
          var normTitle = normalize(s.doc.title);
          var hasTitleMatch = normTitle.indexOf(qNorm) !== -1;
          var hasStrongContent = s.score >= 12; // strong content match
          if (!hasTagMatch && !hasCatMatch && !hasTitleMatch && !hasStrongContent) return;
        }
        seenDocs[s.doc.document_id] = true;
        deduped.push(s);
      }
    });
    scored = deduped;
  }

  // Take top K
  return scored.slice(0, k).map(function (s) {
    return {
      id: s.doc.id,
      document_id: s.doc.document_id,
      title: s.doc.title,
      url: s.doc.url,
      section: s.doc.section || null,
      content: s.doc.content,
      excerpt: s.doc.content.slice(0, 200),
      content_type: s.doc.content_type,
      tags: s.doc.tags || [],
      categories: s.doc.categories || [],
      links: s.doc.links || [],
      score: s.score,
      reasons: s.reasons
    };
  });
}

/* ================================================================
   Chunk ordering helpers
   ================================================================ */
function currentPageChunkOrder(doc) {
  var s = (doc.section || '').toLowerCase();
  // 1. Abstract/summary first
  if (/摘要/.test(s)) return 50;
  // 2. Conclusion/future work
  if (/总结|结论|后续工作/.test(s)) return 40;
  // 3. Other paragraph sections (by position: earlier = higher fallback, reversed)
  if (doc.content_type === 'paragraph') return 30;
  // 4. Code last
  return 10;
}

function summarizeChunkOrder(doc) {
  var s = (doc.section || '').toLowerCase();
  var t = (doc.title || '').toLowerCase();
  // Prefer abstract/intro sections
  if (/摘要|abstract|introduction/.test(s)) return 0;
  // Then section starts that look like overviews
  if (/概述|简介|介绍|背景/.test(s)) return 1;
  // Then first few sections (any section is better than none)
  if (doc.section && doc.content_type === 'paragraph') return 2;
  // Code blocks last
  if (doc.content_type === 'code') return 4;
  return 3;
}

function dedupeByDocument(results) {
  var seen = {}, out = [];
  for (var i = 0; i < results.length; i++) {
    if (!seen[results[i].document_id]) { seen[results[i].document_id] = true; out.push(results[i]); }
  }
  return out;
}

module.exports = { search: search, tokenize: tokenize, normalize: normalize, dedupeByDocument: dedupeByDocument, MIN_SCORE: MIN_SCORE };
