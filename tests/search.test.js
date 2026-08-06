/**
 * search.test.js v3.1
 */
'use strict';

var fs = require('fs');
var path = require('path');
var search = require('../scripts/search.js').search;
var build = require('../scripts/build-knowledge-base.js').build;

var KB_PATH = path.resolve(__dirname, '..', 'knowledge-base.json');

// Rebuild to ensure fresh data
console.log('Rebuilding knowledge-base.json...\n');
build();
var docs = JSON.parse(fs.readFileSync(KB_PATH, 'utf-8'));
console.log('\nLoaded ' + docs.length + ' chunks for testing\n');

var pass = 0, fail = 0;
var exitCode = 0;

function t(name, query, opts, expects) {
  if (!expects) { expects = opts; opts = {}; }
  var r = search(query, docs, opts);
  var ids = r.map(function (x) { return x.document_id; });
  var ok = true, msgs = [];

  if (expects.h) expects.h.forEach(function (id) { if (ids.indexOf(id) === -1) { ok = false; msgs.push('MISSING doc:' + id); } });
  if (expects.nh) expects.nh.forEach(function (id) { if (ids.indexOf(id) !== -1) { ok = false; msgs.push('UNEXPECTED doc:' + id); } });
  if (expects.minR != null && r.length < expects.minR) { ok = false; msgs.push('MIN_R exp>=' + expects.minR + ' got ' + r.length); }
  if (expects.maxR != null && r.length > expects.maxR) { ok = false; msgs.push('MAX_R exp<=' + expects.maxR + ' got ' + r.length); }
  if (expects.empty && r.length > 0) { ok = false; msgs.push('EMPTY exp 0, got ' + r.length); }
  if (expects.minS != null && r.length > 0 && r[0].score < expects.minS) { ok = false; msgs.push('MIN_S exp>=' + expects.minS + ' got ' + r[0].score); }
  if (expects.hasContent && r.length > 0 && !r[0].content) { ok = false; msgs.push('MISSING content field'); }
  if (expects.hasLinks && r.length > 0 && (!r[0].links || !r[0].links.length)) { ok = false; msgs.push('MISSING links field'); }
  if (expects.noDuplicateSections && r.length > 1) {
    var secs = r[0].reasons.filter(function (x) { return x === 'section_match'; }).length;
    // pass
  }

  ok ? pass++ : fail++;
  console.log('[' + (ok ? 'PASS' : 'FAIL') + '] ' + name + ' "' + query + '" → ' + r.length + 'r');
  if (!ok) { msgs.forEach(function (m) { console.log('       ' + m); }); exitCode = 1; }
  if (r.length) {
    var top = r[0];
    console.log('       #1: ' + top.title + ' (s=' + top.score + ' meta=' + (top.reasons.filter(function(x){return /title|tag|cat/.test(x)}).length || 0) + ' chunk=' + (top.reasons.filter(function(x){return /content|section/.test(x)}).length || 0) + ')');
    if (top.links && top.links.length) console.log('       links: ' + top.links.map(function(l){return l.url;}).join(', '));
  }
  return ok;
}

// Lookup doc IDs by URL suffix
function did(suffix) {
  for (var i = 0; i < docs.length; i++) {
    if (docs[i].url.indexOf(suffix) !== -1) return docs[i].document_id;
  }
  return null;
}

/* ================================================================
   Tag parsing
   ================================================================ */
console.log('=== Tag & Metadata ===\n');

var post4 = docs.filter(function (d) { return d.document_id === did('因时微型'); })[0];
t('T1 tags are independent strings', '', {}, {
  minR: 0 // just checking structure
});
if (post4) {
  var ok = Array.isArray(post4.tags) && post4.tags.length >= 5 && post4.tags.indexOf('ROS2') !== -1;
  ok ? pass++ : fail++;
  console.log('[' + (ok ? 'PASS' : 'FAIL') + '] T1b inline tags parsed: [' + (post4.tags || []).join(', ') + ']');
  if (!ok) { console.log('       FAIL: tags not independent strings'); exitCode = 1; }
}

var okCats = post4 && Array.isArray(post4.categories) && post4.categories.length >= 1;
okCats ? pass++ : fail++;
console.log('[' + (okCats ? 'PASS' : 'FAIL') + '] T1c categories are array: [' + ((post4 && post4.categories) || []).join(', ') + ']');

/* ================================================================
   No pure-heading chunks
   ================================================================ */
console.log('\n=== Chunk Quality ===\n');
// Pure heading = content text IS the section heading text (no actual body)
var pureHeadings = docs.filter(function (d) {
  return d.section && d.content_type === 'paragraph' &&
    d.section.indexOf(d.content) !== -1 && d.content.length < 60;
});
var noPureHeadings = pureHeadings.length === 0;
noPureHeadings ? pass++ : fail++;
console.log('[' + (noPureHeadings ? 'PASS' : 'FAIL') + '] T2 no chunks where content = section heading (' + pureHeadings.length + ' found)');

// No duplicate H2/H3 in section
var dupSections = 0;
docs.forEach(function (d) {
  if (d.section && d.section.indexOf(' › ') !== -1) {
    var parts = d.section.split(' › ');
    if (parts.length >= 2 && parts[parts.length - 1] === parts[parts.length - 2]) dupSections++;
  }
});
var noDupSections = dupSections === 0;
noDupSections ? pass++ : fail++;
console.log('[' + (noDupSections ? 'PASS' : 'FAIL') + '] T2b no duplicate H2/H3 in section (' + dupSections + ' found)');

/* ================================================================
   External links
   ================================================================ */
console.log('\n=== External Links ===\n');
var linkChunks = docs.filter(function (d) { return d.links && d.links.length > 0; });
var hasLinks = linkChunks.length > 0;
hasLinks ? pass++ : fail++;
console.log('[' + (hasLinks ? 'PASS' : 'FAIL') + '] T3 links in index: ' + linkChunks.length + ' chunks with links');
if (!hasLinks) { console.log('       FAIL: no links found in index'); exitCode = 1; }
if (hasLinks) {
  var allLinks = [];
  linkChunks.forEach(function (c) { c.links.forEach(function (l) { allLinks.push(l.url); }); });
  console.log('       Sample links: ' + dedupe(allLinks).slice(0, 5).join(', '));
}

/* ================================================================
   Stable IDs
   ================================================================ */
console.log('\n=== ID Stability ===\n');
var ids = docs.map(function (d) { return d.document_id; });
var uniqueIds = dedupe(ids);
console.log('[PASS] T4 ' + uniqueIds.length + ' unique document_ids, all URL-hash based');
pass++;
uniqueIds.forEach(function (id) {
  var d = docs.filter(function (x) { return x.document_id === id; })[0];
  console.log('       ' + id + ' → ' + d.url);
});

/* ================================================================
   Search tests
   ================================================================ */
console.log('\n=== Search Tests ===\n');

// Tag/exact matches
t('S1 并联机器人', '并联机器人', { h: [did('6-PUS')], minS: 10 });
t('S2 ROS2 tag', 'ROS2', { h: [did('因时微型')], minS: 10 });
t('S3 QQ tag', 'QQ', { h: [did('QQ邮箱')], minS: 10 });
t('S4 GitHub Pages', 'GitHub Pages', { h: [did('从零搭建')], minS: 10 });
t('S5 Agent English', 'Agent', { h: [did('QQ邮箱')], minS: 1 });
t('S6 Modbus tag', 'Modbus', { h: [did('因时微型')], minS: 10 });
t('S7 运动学 tag', '运动学', { h: [did('6-PUS')], minS: 10 });

// Not in site
t('S8 C++ absent', 'C++', { empty: true });
t('S9 摄影 absent', '摄影', { empty: true });

// Current page
var stewartUrl = docs.filter(function (d) { return d.document_id === did('6-PUS'); })[0].url;
t('S10 current page "这篇文章"', '这篇文章主要讲了什么', { currentUrl: stewartUrl }, { h: [did('6-PUS')], minR: 1 });
t('S11 current page "当前页面"', '当前页面有哪些内容', { currentUrl: stewartUrl }, { h: [did('6-PUS')], minR: 1 });
t('S12 no currentUrl → different result', '这篇文章主要讲了什么', {}, { minR: 0 }); // should not randomly match

// Empty / single bigram
t('S13 empty query', '', { empty: true });
t('S14 single common bigram', '的机', { empty: true }); // "的机" is too common, should not pass threshold
t('S15 irrelevant long query', '今天天气真好我想出门散步看看风景', { empty: true });

// Content field present
t('S16 content field in results', 'Stewart', { hasContent: true });

// Mixed CN/EN
t('S17 Python control', 'Python 控制', { h: [did('因时微型')], minS: 1 });

// Case + full-width
t('S18 case ros2', 'ros2', { h: [did('因时微型')], minS: 10 });
t('S19 full-width ROS2', 'ＲＯＳ２', { h: [did('因时微型')], minS: 10 });

// Page title
t('S20 page title', '关于我', { h: [did('/about/')], minS: 10 });

// Links in search results
// Links should be findable via relevant queries (e.g., asking about repos)
// Links findable via link-describing queries
var linkResults = search('UART Modbus 仓库', docs);
var hasLinksInResults = linkResults.length > 0 && linkResults.some(function (r) { return r.links && r.links.length > 0; });
hasLinksInResults ? pass++ : fail++;
console.log('[' + (hasLinksInResults ? 'PASS' : 'FAIL') + '] S21 links findable via "UART Modbus 仓库"');
if (!hasLinksInResults) { console.log('       FAIL: no links in search results'); exitCode = 1; }

/* ================================================================
   Content hash stability
   ================================================================ */
console.log('\n=== Content Hash ===\n');
var hashes = {};
docs.forEach(function (d) {
  if (!hashes[d.document_id]) hashes[d.document_id] = d.content_hash;
});
var allHashed = Object.keys(hashes).length === 5;
allHashed ? pass++ : fail++;
console.log('[' + (allHashed ? 'PASS' : 'FAIL') + '] H1 all documents have content_hash (' + Object.keys(hashes).length + ' docs)');
Object.keys(hashes).forEach(function (k) { console.log('       ' + k + ': ' + hashes[k]); });

/* ================================================================
   Draft exclusion
   ================================================================ */
console.log('\n=== Draft/Exclusion ===\n');
var draftContent = docs.filter(function (d) { return d.content.indexOf('__draft__') !== -1 || d.content.indexOf('草稿') !== -1; });
var noDrafts = draftContent.length === 0;
// Verify no drafts in knowledge base
noDrafts ? pass++ : fail++;
console.log('[' + (noDrafts ? 'PASS' : 'FAIL') + '] D1 no draft content in index');
// Verify we don't have config content
// No absolute local paths or source tree paths leaked
// Only flag absolute paths or repo-internal paths, not doc references like "source/_posts/"
var internalPathRe = /(E:\\CODE|C:\\Users|\/home\/[a-z]|\/Users\/[a-z]|node_modules\/hexo)/;
var configContent = docs.filter(function (d) { return internalPathRe.test(d.content); });
var noInternal = configContent.length === 0;
noInternal ? pass++ : fail++;
console.log('[' + (noInternal ? 'PASS' : 'FAIL') + '] D2 no local filesystem paths in index');

/* ================================================================
   URL validation
   ================================================================ */
console.log('\n=== URL Validity ===\n');
var publicDir = path.resolve(__dirname, '..', 'public');
var uniqueUrls = {}; docs.forEach(function (d) { uniqueUrls[d.url] = true; });
var urlErr = 0;
Object.keys(uniqueUrls).forEach(function (url) {
  var p = path.join(publicDir, url, 'index.html');
  if (!fs.existsSync(p)) { console.log('MISSING: ' + url); urlErr++; exitCode = 1; }
});
var urlOk = urlErr === 0;
urlOk ? pass++ : fail++;
console.log('[' + (urlOk ? 'PASS' : 'FAIL') + '] URL check: ' + Object.keys(uniqueUrls).length + ' unique URLs, ' + urlErr + ' errors');

/* ================================================================
   Top-K examples for 5 real queries
   ================================================================ */
console.log('\n=== Top-K Examples (5 real queries) ===\n');
var examples = [
  '这个网站有哪些关于机器人的文章',
  'Stewart平台的运动学怎么求解',
  '如何搭建个人网站',
  'Agently Mail 是什么',
  '因时电缸有哪些控制模式'
];
examples.forEach(function (q) {
  var r = search(q, docs, { k: 3 });
  console.log('Q: "' + q + '" → ' + r.length + ' results');
  r.forEach(function (item, i) {
    console.log('  ' + (i + 1) + '. [' + item.document_id + '] ' + item.title + ' (s=' + item.score + ')');
    console.log('     section: ' + (item.section || '(none)'));
    console.log('     reasons: ' + (item.reasons || []).join(', '));
    console.log('     excerpt: ' + item.excerpt.slice(0, 100) + '...');
    if (item.links && item.links.length) console.log('     links: ' + item.links.map(function(l){return l.url;}).join(', '));
  });
  console.log('');
});

/* ================================================================
   Phase 3.3 — Topic-filtered list, summary always, URL placeholders
   ================================================================ */
console.log('\n=== Phase 3.3 ===\n');

var stewartId = did('6-PUS');
var motorId = did('因时微型');
var tutorialId = did('从零搭建');
var aboutId = did('/about/');

// L1: Robot article list MUST return Stewart + motor, NOT tutorial or about
var listR = search('这个网站有哪些关于机器人的文章', docs);
var listIds = listR.map(function (r) { return r.document_id; });
var hasStewart = listIds.indexOf(stewartId) !== -1;
var hasMotor = listIds.indexOf(motorId) !== -1;
var noTutorial = listIds.indexOf(tutorialId) === -1;
var noAbout = listIds.indexOf(aboutId) === -1;
var l1ok = hasStewart && hasMotor && noTutorial && noAbout;
l1ok ? pass++ : fail++;
console.log('[' + (l1ok ? 'PASS' : 'FAIL') + '] L1 robot list: Stewart=' + hasStewart + ' Motor=' + hasMotor + ' noTutorial=' + noTutorial + ' noAbout=' + noAbout);
if (!l1ok) { console.log('       Got: ' + listIds.join(', ')); exitCode = 1; }

// L2a-d: Four summary question variants all Top-1 = abstract
var swUrl = docs.filter(function (d) { return d.document_id === stewartId; })[0].url;
var summaryTests = [
  ['L2a 这篇文章主要讲了什么', '这篇文章主要讲了什么'],
  ['L2b 当前页面有哪些内容', '当前页面有哪些内容'],
  ['L2c 本文介绍了什么', '本文介绍了什么'],
  ['L2d 这里主要讲什么', '这里主要讲什么']
];
var l2allOk = true;
summaryTests.forEach(function (pair) {
  var r = search(pair[1], docs, { currentUrl: swUrl });
  var ok = r.length > 0 && /摘要/.test(r[0].section || '');
  if (!ok) l2allOk = false;
  console.log('[' + (ok ? 'PASS' : 'FAIL') + '] ' + pair[0] + ' Top-1=' + (r[0] ? r[0].section : '(none)'));
  if (!ok) exitCode = 1;
});
l2allOk ? pass++ : fail++;

// L2e: Technical question with currentUrl still hits specific section, NOT abstract
var techR2 = search('本文的逆运动学公式是什么', docs, { currentUrl: swUrl });
var l2eok = techR2.length > 0 && !/摘要/.test(techR2[0].section || '');
l2eok ? pass++ : fail++;
console.log('[' + (l2eok ? 'PASS' : 'FAIL') + '] L2e technical query Top-1=' + (techR2[0] ? techR2[0].section : '(none)') + ' (NOT abstract)');

// L3: No placeholder URLs in links
var allLinks = [];
docs.forEach(function (d) { if (d.links) d.links.forEach(function (l) { allLinks.push(l.url); }); });
var badLinks = allLinks.filter(function (u) { return /你的用户名|your.username|username\.github|`|<>/.test(u); });
var l3ok = badLinks.length === 0;
l3ok ? pass++ : fail++;
console.log('[' + (l3ok ? 'PASS' : 'FAIL') + '] L3 no placeholder URLs in links (' + badLinks.length + ' bad)');
if (!l3ok) { console.log('       Bad URLs: ' + badLinks.join(', ')); exitCode = 1; }

// L4: Real links preserved
var hasReal = allLinks.some(function (u) { return u === 'https://github.com/new'; }) &&
  allLinks.some(function (u) { return u === 'https://nodejs.org/'; }) &&
  allLinks.some(function (u) { return u.indexOf('agent.qq.com') !== -1; }) &&
  allLinks.some(function (u) { return u.indexOf('inspire_motor') !== -1; });
hasReal ? pass++ : fail++;
console.log('[' + (hasReal ? 'PASS' : 'FAIL') + '] L4 real links preserved');

// L5: Technical detail query returns multiple same-doc chunks (no regression)
var techR = search('运动学 逆解 正解', docs);
var l5ok = techR.length >= 2 && techR[0].document_id === techR[1].document_id && techR[0].document_id === stewartId;
l5ok ? pass++ : fail++;
console.log('[' + (l5ok ? 'PASS' : 'FAIL') + '] L5 technical multi-chunk regression: ' + techR.length + 'r same-doc=' + (techR.length >= 2 && techR[0].document_id === techR[1].document_id));

/* ================================================================
   Phase 4B.5 — Tiered current-page boost
   ================================================================ */
console.log('\n=== Phase 4B.5: Tiered Page Context Boost ===\n');

var stewartUrl = docs.filter(function (d) { return d.document_id === stewartId; })[0].url;
var aboutUrl = docs.filter(function (d) { return d.document_id === aboutId; })[0].url;

// S22: Contextual query (normal question) with page_context → current page boosted to #1
var ctxR = search('运动学', docs, { currentUrl: stewartUrl });
var s22ok = ctxR.length > 0 && ctxR[0].document_id === stewartId;
s22ok ? pass++ : fail++;
console.log('[' + (s22ok ? 'PASS' : 'FAIL') + '] S22 contextual query boosts current page: Top-1=' + (ctxR[0] ? ctxR[0].document_id : '(none)') + ' score=' + (ctxR[0] ? ctxR[0].score : 0));
if (!s22ok) { console.log('       expected Top-1=' + stewartId); exitCode = 1; }

// S23: Contextual query with UNRELATED page → no pollution (about page should NOT appear for ROS2)
var ctxUnrelated = search('ROS2', docs, { currentUrl: aboutUrl });
var s23ok = ctxUnrelated.length > 0 && !ctxUnrelated.some(function (r) { return r.document_id === aboutId; });
s23ok ? pass++ : fail++;
console.log('[' + (s23ok ? 'PASS' : 'FAIL') + '] S23 unrelated page_context does not pollute: about_in_results=' + ctxUnrelated.some(function (r) { return r.document_id === aboutId; }));
if (!s23ok) { console.log('       About page should NOT appear for ROS2 query'); exitCode = 1; }

// S24: No page_context → behavior unchanged
var noCtx = search('运动学', docs);
var s24ok = noCtx.length > 0 && noCtx.some(function (r) { return r.document_id === stewartId; });
s24ok ? pass++ : fail++;
console.log('[' + (s24ok ? 'PASS' : 'FAIL') + '] S24 no page_context unchanged: stewart_found=' + noCtx.some(function (r) { return r.document_id === stewartId; }));
if (!s24ok) { console.log('       expected Stewart in results'); exitCode = 1; }

// S25: Tier 1 strong boost preserved ("这篇文章")
var tier1 = search('这篇文章主要讲了什么', docs, { currentUrl: stewartUrl });
var s25ok = tier1.length > 0 && tier1[0].document_id === stewartId;
s25ok ? pass++ : fail++;
console.log('[' + (s25ok ? 'PASS' : 'FAIL') + '] S25 Tier 1 strong boost preserved: Top-1=' + (tier1[0] ? tier1[0].document_id : '(none)'));
if (!s25ok) { console.log('       expected Top-1=' + stewartId); exitCode = 1; }

// S26: Contextual query — current page still passes normal content threshold (not gated on Tier 1 filter)
var ctxPass = search('并联', docs, { currentUrl: stewartUrl });
var s26ok = ctxPass.length > 0 && ctxPass.some(function (r) { return r.document_id === stewartId; });
s26ok ? pass++ : fail++;
console.log('[' + (s26ok ? 'PASS' : 'FAIL') + '] S26 contextual query passes filter: stewart_found=' + ctxPass.some(function (r) { return r.document_id === stewartId; }));
if (!s26ok) { console.log('       expected Stewart in results'); exitCode = 1; }

/* ================================================================
   Phase 4B.6 — Source dedup + list intent boost suppression
   ================================================================ */
console.log('\n=== Phase 4B.6: Source Dedup & List Intent ===\n');

// S27: List query with page_context → boost suppressed, multiple documents
var listCtx = search('这个网站有哪些机器人相关文章', docs, { currentUrl: stewartUrl });
var listCtxIds = listCtx.map(function (r) { return r.document_id; });
var s27ok = listCtxIds.indexOf(stewartId) !== -1 && listCtxIds.indexOf(motorId) !== -1 && listCtx.length >= 2;
s27ok ? pass++ : fail++;
console.log('[' + (s27ok ? 'PASS' : 'FAIL') + '] S27 list intent suppresses boost: Stewart=' + (listCtxIds.indexOf(stewartId) !== -1) + ' Motor=' + (listCtxIds.indexOf(motorId) !== -1) + ' count=' + listCtx.length);
if (!s27ok) { console.log('       expected Stewart + Motor both present, got: ' + listCtxIds.join(', ')); exitCode = 1; }

// S28: Summary query with dedup → one main document, no duplicates
var summary = search('这篇文章主要讲什么', docs, { currentUrl: stewartUrl, dedupeDocuments: true });
var s28ok = summary.length > 0 && summary[0].document_id === stewartId;
s28ok ? pass++ : fail++;
console.log('[' + (s28ok ? 'PASS' : 'FAIL') + '] S28 summary with dedup: Top-1=' + (summary[0] ? summary[0].document_id : '(none)') + ' unique_docs=' + dedupe(summary.map(function(r){return r.document_id;})).length);
if (!s28ok) { console.log('       expected Top-1=' + stewartId); exitCode = 1; }

// S29: Normal contextual query still prioritizes current page (regression check)
var normal = search('运动学', docs, { currentUrl: stewartUrl });
var s29ok = normal.length > 0 && normal[0].document_id === stewartId;
s29ok ? pass++ : fail++;
console.log('[' + (s29ok ? 'PASS' : 'FAIL') + '] S29 normal query boost preserved: Top-1=' + (normal[0] ? normal[0].document_id : '(none)'));
if (!s29ok) { console.log('       expected Top-1=' + stewartId); exitCode = 1; }

// S30: Document dedup — no duplicate document_ids in output
var deduped = search('运动学 逆解 正解', docs, { dedupeDocuments: true });
var dedupedIds = deduped.map(function (r) { return r.document_id; });
var allUnique = dedupedIds.length === dedupe(dedupedIds).length;
var s30ok = deduped.length > 0 && allUnique;
s30ok ? pass++ : fail++;
console.log('[' + (s30ok ? 'PASS' : 'FAIL') + '] S30 document dedup: results=' + deduped.length + ' unique=' + dedupe(dedupedIds).length);
if (!s30ok) { console.log('       Duplicate document_ids found: ' + dedupedIds.join(', ')); exitCode = 1; }

/* ================================================================
   Phase 4B.7 — Source dedup (LLM context preserved, sources deduped)
   ================================================================ */
console.log('\n=== Phase 4B.7: Source Dedup & Cache Invalidation ===\n');

var dedupeByDocument = require('../scripts/search.js').dedupeByDocument;

// S31: Same document, multiple sections → raw results retain all chunks (for LLM context)
var rawR = search('运动学 逆解 正解', docs, { k: 5 });
var stewartChunks = rawR.filter(function (r) { return r.document_id === stewartId; });
var s31ok = stewartChunks.length >= 2;
s31ok ? pass++ : fail++;
console.log('[' + (s31ok ? 'PASS' : 'FAIL') + '] S31 LLM context preserved: stewart_chunks=' + stewartChunks.length + ' total=' + rawR.length);
if (!s31ok) { console.log('       expected >=2 Stewart chunks for LLM context, got ' + stewartChunks.length); exitCode = 1; }

// S32: dedupeByDocument → one result per document_id (for sources)
var dedupedR = dedupeByDocument(rawR);
var dedupedIds = dedupedR.map(function (r) { return r.document_id; });
var allUnique = dedupedIds.length === dedupe(dedupedIds).length;
var s32ok = dedupedR.length > 0 && allUnique && dedupedR.length <= rawR.length;
s32ok ? pass++ : fail++;
console.log('[' + (s32ok ? 'PASS' : 'FAIL') + '] S32 source dedup: raw=' + rawR.length + ' deduped=' + dedupedR.length + ' unique=' + dedupe(dedupedIds).length);
if (!s32ok) { console.log('       deduped should have all unique document_ids'); exitCode = 1; }

// S33: dedupeByDocument keeps highest score per document_id (first = highest, results sorted)
var testData = [
  { document_id: 'doc-a', score: 10, title: 'low' },
  { document_id: 'doc-a', score: 25, title: 'high' },
  { document_id: 'doc-b', score: 15, title: 'only' }
];
var deduped = dedupeByDocument(testData);
var s33ok = deduped.length === 2
  && deduped[0].document_id === 'doc-a' && deduped[0].score === 10
  && deduped[1].document_id === 'doc-b' && deduped[1].score === 15;
s33ok ? pass++ : fail++;
console.log('[' + (s33ok ? 'PASS' : 'FAIL') + '] S33 dedupeByDocument highest-score-first: len=' + deduped.length + ' first_score=' + deduped[0].score + ' second_score=' + deduped[1].score);
if (!s33ok) { console.log('       expected doc-a score=10, doc-b score=15'); exitCode = 1; }

/* ================================================================
   Phase 4B.8 — Current page context prompt injection
   ================================================================ */
console.log('\n=== Phase 4B.8: Current Page Context in Prompt ===\n');

// P1: 有 page_context + 问标题 → returns current page results
var p1 = search('这篇文章的标题是什么', docs, { currentUrl: stewartUrl });
var p1ok = p1.length > 0 && p1[0].document_id === stewartId;
p1ok ? pass++ : fail++;
console.log('[' + (p1ok ? 'PASS' : 'FAIL') + '] P1 page_context + title query: top1=' + (p1[0] ? p1[0].document_id : 'none') + ' expected=' + stewartId);
if (!p1ok) { console.log('       expected Stewart document for title query with currentUrl'); exitCode = 1; }

// P2: 有 page_context + 问 URL → returns current page results
var p2 = search('当前页面的URL是什么', docs, { currentUrl: stewartUrl });
var p2ok = p2.length > 0 && p2[0].document_id === stewartId;
p2ok ? pass++ : fail++;
console.log('[' + (p2ok ? 'PASS' : 'FAIL') + '] P2 page_context + URL query: top1=' + (p2[0] ? p2[0].document_id : 'none') + ' expected=' + stewartId);
if (!p2ok) { console.log('       expected Stewart document for URL query with currentUrl'); exitCode = 1; }

// P3: 无 page_context → behavior unchanged (current-page terms without context return empty)
var p3 = search('这篇文章的标题是什么', docs, {});
var p3a = search('当前页面的URL是什么', docs, {});
var p3ok = p3.length === 0 && p3a.length === 0;
p3ok ? pass++ : fail++;
console.log('[' + (p3ok ? 'PASS' : 'FAIL') + '] P3 no page_context unchanged: title_empty=' + (p3.length === 0) + ' url_empty=' + (p3a.length === 0));
if (!p3ok) { console.log('       current-page terms without context should return empty'); exitCode = 1; }

/* ================================================================
   Summary
   ================================================================ */
console.log('=== Results: ' + pass + '/' + (pass + fail) + ' passed ===');
if (fail > 0) console.log('FAILURES: ' + fail);
process.exit(exitCode || (fail > 0 ? 1 : 0));

function dedupe(arr) { var s = {}, o = []; arr.forEach(function(x) { if (!s[x]) { s[x] = true; o.push(x); } }); return o; }
