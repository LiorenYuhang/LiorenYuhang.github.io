/**
 * build-knowledge-base.js v3.1
 * Uses hexo-front-matter, stable IDs, semantic chunking, link metadata.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const frontMatter = require('hexo-front-matter');

const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'source', '_posts');
const ABOUT_FILE = path.join(ROOT, 'source', 'about', 'index.md');
const CONFIG_FILE = path.join(ROOT, '_config.yml');
const OUTPUT = path.join(ROOT, 'knowledge-base.json');
const MODULE_OUTPUT = path.join(ROOT, 'knowledge-base.generated.mjs');

/* ================================================================
   URL generation — reads Hexo permalink config
   ================================================================ */
function loadPermalinkPattern() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const m = raw.match(/^permalink:\s*(.+)$/m);
    return m ? m[1].trim() : ':year/:month/:day/:title/';
  } catch (e) { return ':year/:month/:day/:title/'; }
}

function generateURL(data, pattern, sourceFile) {
  if (data.permalink) return '/' + data.permalink.replace(/\/$/, '') + '/';
  const d = data.date ? new Date(data.date) : new Date();
  const slug = sourceFile ? sourceFile.replace(/\.md$/, '') : (data.title || 'untitled');
  return '/' + pattern
    .replace(':year', String(d.getFullYear()))
    .replace(':month', String(d.getMonth() + 1).padStart(2, '0'))
    .replace(':day', String(d.getDate()).padStart(2, '0'))
    .replace(':title', slug)
    .replace(/\/:id\/?/g, '').replace(/\/:category\/?/g, '')
    .replace(/\/$/, '') + '/';
}

/* ================================================================
   Stable document_id: short hash of URL
   ================================================================ */
function docId(url) {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 10);
}

/* ================================================================
   Markdown cleaning — remove syntax, preserve content
   ================================================================ */
function cleanMarkdown(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, function (_, alt) { return alt ? '[图：' + alt + ']' : ''; })
    .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1').replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^>\s?/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
}

/* ================================================================
   Extract links from raw markdown lines (per-section)
   ================================================================ */
function extractLinksFromLines(lines) {
  var text = lines.join('\n');
  var links = [];
  var mdRe = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  var m;
  while ((m = mdRe.exec(text)) !== null) links.push({ text: m[1], url: m[2] });
  // Bare URLs
  var bareRe = /(?<!\]\()https?:\/\/[^\s<>)\]]+/g;
  while ((m = bareRe.exec(text)) !== null) {
    var url = m[0].replace(/[.,;:!?)\]}>]+$/, '');
    if (!links.some(function (l) { return l.url === url; })) links.push({ text: url, url: url });
  }
  // Filter invalid
  links = links.filter(function (l) {
    var url = l.url;
    var text = (l.text || '').toLowerCase();
    // Placeholder patterns
    if (/你的用户名|your.username|username\.github|yourname|example\.com|placeholder|占位/.test(url)) return false;
    if (/反引号|尖括号|`|<>|%3C|%3E/.test(url)) return false;
    // Must have valid TLD-like structure
    try {
      var u = new URL(url);
      var hn = u.hostname;
      if (hn === 'localhost' || hn === '127.0.0.1') return false;
      if (/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(hn)) return false;
    } catch (e) { return false; }
    return true;
  });
  var seen = {};
  return links.filter(function (l) { if (seen[l.url]) return false; seen[l.url] = true; return true; });
}

/* ================================================================
   Normalize tags/categories to flat string arrays
   ================================================================ */
function normalizeTags(data) {
  let tags = data.tags;
  if (!tags) return [];
  if (typeof tags === 'string') tags = [tags];
  if (!Array.isArray(tags)) return [];
  return tags.map(function (t) { return String(t).trim(); }).filter(Boolean);
}

function normalizeCategories(data) {
  let cats = data.categories || data.category;
  if (!cats) return [];
  if (typeof cats === 'string') return cats.split(',').map(function (c) { return c.trim(); }).filter(Boolean);
  if (!Array.isArray(cats)) return [];
  return cats.map(function (c) { return String(c).trim(); }).filter(Boolean);
}

/* ================================================================
   Semantic chunking — merge adjacent content, target 300-800 chars
   ================================================================ */
function chunkMarkdown(body) {
  // Split by H2 headings
  var lines = body.split('\n');
  var sections = [];         // [{heading, lines[]}]
  var currentHeading = '';
  var currentLines = [];
  var headingStack = [];     // track H2/H3 hierarchy

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var h2 = line.match(/^## (?=\S)(.+)/);
    var h3 = line.match(/^### (?=\S)(.+)/);

    if (h2) {
      // flush previous
      if (currentLines.length) sections.push({ heading: currentHeading, lines: currentLines.slice() });
      currentHeading = h2[1].trim();
      headingStack = [currentHeading];
      currentLines = [];
    } else if (h3) {
      if (currentLines.length) sections.push({ heading: currentHeading, lines: currentLines.slice() });
      var h3t = h3[1].trim();
      if (headingStack[headingStack.length - 1] !== h3t) {
        currentHeading = headingStack[0] + ' › ' + h3t;
        headingStack.push(h3t);
      } else {
        // duplicate H3 — keep existing heading
        currentHeading = headingStack.join(' › ');
      }
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length) sections.push({ heading: currentHeading, lines: currentLines.slice() });

  // Process each section into chunks
  var chunks = [];
  var allLinks = [];

  sections.forEach(function (sec) {
    // Extract links from raw section lines
    var secLinks = extractLinksFromLines(sec.lines);
    allLinks = allLinks.concat(secLinks);

    // Separate code blocks from text, tracking links per block
    var textBlocks = [];   // [{type:'text'|'code', lines[], links[]}]
    var currentBlock = { type: 'text', lines: [], links: [] };

    for (var j = 0; j < sec.lines.length; j++) {
      var l = sec.lines[j];
      if (/^```/.test(l.trim())) {
        if (currentBlock.type === 'code') {
          if (currentBlock.lines.length) textBlocks.push(currentBlock);
          currentBlock = { type: 'text', lines: [], links: [] };
        } else {
          if (currentBlock.lines.length) textBlocks.push(currentBlock);
          currentBlock = { type: 'code', lines: [l], links: [] };
        }
      } else {
        currentBlock.lines.push(l);
      }
    }
    if (currentBlock.lines.length) textBlocks.push(currentBlock);

    // Assign links from section to blocks based on URL proximity in raw text
    textBlocks.forEach(function (blk) {
      var blkText = blk.lines.join('\n');
      secLinks.forEach(function (l) {
        if (blkText.indexOf(l.url) !== -1 || blkText.indexOf(l.text) !== -1) {
          blk.links.push(l);
        }
      });
    });

    // Merge adjacent text blocks, split large ones
    var textBuffer = [];
    var codeBuffer = [];
    var linkBuffer = [];

    for (var k = 0; k < textBlocks.length; k++) {
      var block = textBlocks[k];

      if (block.type === 'code') {
        if (textBuffer.length) {
          var text = cleanMarkdown(textBuffer.join('\n'));
          var links = linkBuffer.slice();
          textBuffer = []; linkBuffer = [];
          if (text.length > 20) {
            if (codeBuffer.length) {
              var desc = cleanMarkdown(codeBuffer.join('\n'));
              codeBuffer = [];
              if (desc) text = desc + '\n\n' + text;
            }
            chunks.push({ section: sec.heading || null, content_type: 'paragraph', content: text, links: links });
          }
        }
        var code = block.lines.join('\n').replace(/^```\w*\n?/gm, '').replace(/```$/gm, '').trim();
        if (code) chunks.push({ section: sec.heading || null, content_type: 'code', content: code, links: (block.links || []) });
      } else {
        textBuffer.push.apply(textBuffer, block.lines);
        linkBuffer.push.apply(linkBuffer, block.links || []);
        var accText = cleanMarkdown(textBuffer.join('\n'));
        if (accText.length > 1200) {
          var parts = accText.split(/(?<=[。！？\.!\?])\s*/);
          var merged = '';
          parts.forEach(function (p) {
            if ((merged + p).length > 1000 && merged.length > 200) {
              chunks.push({ section: sec.heading || null, content_type: 'paragraph', content: merged.trim(), links: linkBuffer.slice() });
              merged = p;
            } else { merged += (merged ? ' ' : '') + p; }
          });
          textBuffer = []; linkBuffer = [];
          if (merged.trim().length > 20) chunks.push({ section: sec.heading || null, content_type: 'paragraph', content: merged.trim(), links: [] });
        }
      }
    }
    if (textBuffer.length) {
      var t = cleanMarkdown(textBuffer.join('\n'));
      if (t.length > 20) chunks.push({ section: sec.heading || null, content_type: 'paragraph', content: t, links: linkBuffer.slice() });
      textBuffer = []; linkBuffer = [];
    }
  });

  // Deduplicate links within each chunk
  chunks.forEach(function (ch) {
    if (!ch.links || !ch.links.length) { ch.links = []; return; }
    var seen = {};
    ch.links = ch.links.filter(function (l) { if (seen[l.url]) return false; seen[l.url] = true; return true; });
  });

  return { chunks: chunks, allLinks: allLinks };
}

/* ================================================================
   Build
   ================================================================ */
function build() {
  var pattern = loadPermalinkPattern();
  console.log('Permalink pattern:', pattern);

  var documents = [];
  var warnings = [];

  // Deterministic file order
  var files = fs.readdirSync(POSTS_DIR).filter(function (f) { return f.endsWith('.md'); }).sort();
  console.log('Posts found:', files.length);

  files.forEach(function (file) {
    var filePath = path.join(POSTS_DIR, file);
    var raw = fs.readFileSync(filePath, 'utf-8');
    var parsed = frontMatter.parse(raw);
    var data = parsed;
    var body = parsed._content || '';

    // Remove _content from data so we can serialize clean metadata
    delete data._content;

    if (data.draft || data.published === false) {
      warnings.push('SKIPPED draft: ' + file);
      return;
    }

    var title = data.title || file.replace(/\.md$/, '');
    var url = generateURL(data, pattern, file);
    var id = docId(url);
    var tags = normalizeTags(data);
    var categories = normalizeCategories(data);
    var date = data.date ? new Date(data.date).toISOString().split('T')[0] : null;

    var result = chunkMarkdown(body);
    var chunks = result.chunks;
    var contentHash = crypto.createHash('sha256').update(body).digest('hex').slice(0, 16);

    chunks.forEach(function (ch, idx) {
      var chunkHash = crypto.createHash('sha256').update(ch.content).digest('hex').slice(0, 8);
      documents.push({
        id: id + '-' + String(idx).padStart(3, '0'),
        document_id: id,
        title: title,
        url: url,
        section: ch.section || null,
        content: ch.content,
        content_type: ch.content_type,
        tags: tags,
        categories: categories,
        published_at: date,
        content_hash: contentHash,
        links: ch.links || []
      });
    });

    console.log('  ' + id + ': "' + title + '" → ' + chunks.length + ' chunks, ' + result.allLinks.length + ' links');
    console.log('    URL: ' + url + ' tags: [' + tags.join(', ') + '] cats: [' + categories.join(', ') + ']');
    if (result.allLinks.length) result.allLinks.forEach(function (l) { console.log('    link: ' + l.url + ' (' + l.text + ')'); });
  });

  // About page
  if (fs.existsSync(ABOUT_FILE)) {
    var raw = fs.readFileSync(ABOUT_FILE, 'utf-8');
    var parsed = frontMatter.parse(raw);
    var body = parsed._content || '';
    delete parsed._content;
    var title = parsed.title || '关于我';
    var url = '/about/';
    var id = docId(url);
    var cleaned = cleanMarkdown(body);

    if (cleaned && cleaned.length > 10) {
      documents.push({
        id: id + '-000',
        document_id: id,
        title: title,
        url: url,
        section: null,
        content: cleaned,
        content_type: 'paragraph',
        tags: [],
        categories: [],
        published_at: null,
        content_hash: crypto.createHash('sha256').update(body).digest('hex').slice(0, 16),
        links: []
      });
    }
    console.log('  ' + id + ': "' + title + '" → 1 chunk');
    console.log('    URL: /about/');
  }

  // Write output
  var serialized = JSON.stringify(documents, null, 2);
  fs.writeFileSync(OUTPUT, serialized, 'utf-8');
  fs.writeFileSync(MODULE_OUTPUT, 'export default ' + serialized + ';\n', 'utf-8');
  console.log('\nOutput: ' + OUTPUT + ' (' + documents.length + ' chunks)');
  console.log('Module: ' + MODULE_OUTPUT);

  // Stats
  var stats = { documents: 0, chunks: documents.length, by_type: {}, total_chars: 0, avg_len: 0, max_len: 0, warnings: warnings };
  var ids = {};
  documents.forEach(function (d) {
    stats.by_type[d.content_type] = (stats.by_type[d.content_type] || 0) + 1;
    stats.total_chars += d.content.length;
    if (d.content.length > stats.max_len) stats.max_len = d.content.length;
    ids[d.document_id] = true;
  });
  stats.documents = Object.keys(ids).length;
  stats.avg_len = Math.round(stats.total_chars / stats.chunks);

  console.log('\n=== Stats ===');
  console.log('Documents: ' + stats.documents);
  console.log('Chunks:   ' + stats.chunks);
  console.log('Avg len:  ' + stats.avg_len + ' chars');
  console.log('Max len:  ' + stats.max_len + ' chars');
  console.log('By type:  ' + JSON.stringify(stats.by_type));
  console.log('Total chars: ' + stats.total_chars);
  if (warnings.length) { console.log('Warnings: ' + warnings.length); warnings.forEach(function (w) { console.log('  ' + w); }); }

  // Random sample of 10 chunks
  console.log('\n=== Random Sample (10 chunks) ===');
  var sample = documents.sort(function () { return Math.random() - 0.5; }).slice(0, 10);
  sample.forEach(function (d, i) {
    console.log('\n--- Sample ' + (i + 1) + ' ---');
    console.log('ID: ' + d.id + ' | doc: ' + d.document_id);
    console.log('Title: ' + d.title);
    console.log('Section: ' + (d.section || '(none)'));
    console.log('Type: ' + d.content_type + ' | Len: ' + d.content.length + ' chars');
    console.log('Links: ' + (d.links || []).map(function (l) { return l.url; }).join(', '));
    console.log('Content (first 150): ' + d.content.slice(0, 150) + '...');
  });

  return { documents: documents, stats: stats };
}

if (require.main === module) build();

module.exports = { build: build, generateURL: generateURL, docId: docId, chunkMarkdown: chunkMarkdown, cleanMarkdown: cleanMarkdown, extractLinksFromLines: extractLinksFromLines, normalizeTags: normalizeTags };
