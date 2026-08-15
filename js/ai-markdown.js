/**
 * AI Assistant — 安全 Markdown / LaTeX 渲染器
 *
 * 设计约束：
 * 1. 绝不把模型输出写入 innerHTML；所有节点通过 createElement / createTextNode 构建。
 * 2. 只做轻量 Markdown（粗体/斜体/行内代码/代码块/列表/标题/链接），
 *    不引入第三方 Markdown 库。
 * 3. LaTeX 由 MathJax 渲染：解析器只负责识别并原样保留公式分隔符
 *    （\(..\)、\[..\]、$$..$$、$..$），typeset 交给 AI 面板的 MathJax 懒加载。
 *
 * UMD 导出，便于 Node 单测（parseMarkdown / parseInline / hasMath 为纯函数，不依赖 DOM）。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AIMarkdown = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 安全链接：仅允许 http(s)、相对路径与锚点，拒绝 javascript:/data:/vbscript: 等
  function isSafeUrl(href) {
    if (!href) return false;
    return /^(https?:\/\/|\/|\.{1,2}\/|#)/i.test(String(href));
  }

  // 是否含 LaTeX（用于决定是否懒加载 MathJax）。
  // $[^$\s\d] 匹配 $x 这类公式，同时避免 $5 等货币误判。
  function hasMath(text) {
    if (!text) return false;
    return /\\\(|\\\[|\$\$|\$[^$\s\d]/.test(String(text));
  }

  /* ---------------- inline 解析（纯函数） ---------------- */

  function parseInline(text) {
    var tokens = [];
    var buf = '';
    var i = 0;
    var n = text.length;

    function flush() {
      if (buf) { tokens.push({ type: 'text', text: buf }); buf = ''; }
    }

    while (i < n) {
      var ch = text[i];

      // 1) \(...\) / \[...\] 行内与块公式
      if (ch === '\\' && (text[i + 1] === '(' || text[i + 1] === '[')) {
        var open2 = text[i + 1];
        var closer = open2 === '(' ? '\\)' : '\\]';
        var end = text.indexOf(closer, i + 2);
        if (end !== -1) {
          flush();
          tokens.push({ type: 'math', display: open2 === '[', text: text.slice(i, end + 2) });
          i = end + 2;
          continue;
        }
      }

      // 2) $$...$$ 块公式
      if (ch === '$' && text[i + 1] === '$') {
        var end2 = text.indexOf('$$', i + 2);
        if (end2 !== -1) {
          flush();
          tokens.push({ type: 'math', display: true, text: text.slice(i, end2 + 2) });
          i = end2 + 2;
          continue;
        }
      }

      // 3) $...$ 行内公式（保守：前一个字符非字母数字、后一个字符非空白/$，且闭合 $ 后非字母数字）
      if (ch === '$' && i + 1 < n && !/[\s$]/.test(text[i + 1]) &&
          (i === 0 || !/[0-9A-Za-z]/.test(text[i - 1]))) {
        var end3 = text.indexOf('$', i + 1);
        if (end3 !== -1 && end3 > i + 1 &&
            (end3 + 1 >= n || !/[0-9A-Za-z]/.test(text[end3 + 1]))) {
          var body3 = text.slice(i + 1, end3);
          if (!/\n/.test(body3)) {
            flush();
            tokens.push({ type: 'math', display: false, text: text.slice(i, end3 + 1) });
            i = end3 + 1;
            continue;
          }
        }
      }

      // 4) `...` 行内代码
      if (ch === '`') {
        var end4 = text.indexOf('`', i + 1);
        if (end4 !== -1 && end4 > i + 1 && !/\n/.test(text.slice(i + 1, end4))) {
          flush();
          tokens.push({ type: 'code', text: text.slice(i + 1, end4) });
          i = end4 + 1;
          continue;
        }
      }

      // 5) **...** 粗体
      if (ch === '*' && text[i + 1] === '*') {
        var end5 = text.indexOf('**', i + 2);
        if (end5 !== -1 && end5 > i + 2) {
          flush();
          tokens.push({ type: 'strong', children: parseInline(text.slice(i + 2, end5)) });
          i = end5 + 2;
          continue;
        }
      }

      // 6) *...* 斜体（单个 *，且不是 ** 的一部分）
      if (ch === '*' && text[i + 1] !== '*' && (i === 0 || text[i - 1] !== '*')) {
        var end6 = text.indexOf('*', i + 1);
        if (end6 !== -1 && end6 > i + 1 &&
            !/\s/.test(text[i + 1]) && !/\s/.test(text[end6 - 1])) {
          flush();
          tokens.push({ type: 'em', children: parseInline(text.slice(i + 1, end6)) });
          i = end6 + 1;
          continue;
        }
      }

      // 7) [text](url) 链接
      if (ch === '[') {
        var end7 = text.indexOf(']', i + 1);
        if (end7 !== -1 && text[end7 + 1] === '(') {
          var endParen = text.indexOf(')', end7 + 2);
          if (endParen !== -1) {
            var href = text.slice(end7 + 2, endParen).trim();
            if (isSafeUrl(href)) {
              flush();
              tokens.push({ type: 'link', href: href, children: parseInline(text.slice(i + 1, end7)) });
              i = endParen + 1;
              continue;
            }
          }
        }
      }

      buf += ch;
      i++;
    }
    flush();
    return tokens;
  }

  /* ---------------- block 解析（纯函数） ---------------- */

  var LIST_RE = /^(\s*)([-*+]|\d+\.)\s+(.*)$/;

  function parseMarkdown(text) {
    if (text == null) return [];
    var src = String(text).replace(/\r\n?/g, '\n');
    var lines = src.split('\n');
    var blocks = [];
    var i = 0;
    var n = lines.length;

    while (i < n) {
      var line = lines[i];

      if (/^\s*$/.test(line)) { i++; continue; }

      // 围栏代码块 ``` / ~~~
      var fence = /^\s*(```|~~~)/.exec(line);
      if (fence) {
        var lang = line.trim().slice(3).trim();
        var codeLines = [];
        i++;
        while (i < n) {
          if (/^`{3,}\s*$/.test(lines[i].trim()) || /^~{3,}\s*$/.test(lines[i].trim())) { i++; break; }
          codeLines.push(lines[i]);
          i++;
        }
        blocks.push({ type: 'code', lang: lang, text: codeLines.join('\n') });
        continue;
      }

      // 块级公式：$$...$$ 或 \[...\]（允许跨行）
      var bm = /^\s*(\$\$|\\\[)/.exec(line);
      if (bm) {
        var open = bm[1];
        var close = open === '$$' ? '$$' : '\\]';
        var body = line.slice(bm[0].length);
        var closeIdx = body.indexOf(close);
        while (closeIdx === -1 && i < n - 1) {
          i++;
          body += '\n' + lines[i];
          closeIdx = body.indexOf(close);
        }
        if (closeIdx !== -1) body = body.slice(0, closeIdx);
        blocks.push({ type: 'math', display: true, text: open + body + close });
        i++;
        continue;
      }

      // 标题 # ... ###### ...
      var h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) {
        blocks.push({ type: 'heading', level: h[1].length, children: parseInline(h[2]) });
        i++;
        continue;
      }

      // 列表 - / * / + / 1.
      var li = LIST_RE.exec(line);
      if (li) {
        var ordered = /^\d+\.$/.test(li[2]);
        var items = [];
        while (i < n) {
          var l2 = LIST_RE.exec(lines[i]);
          if (!l2 || (/^\d+\.$/.test(l2[2])) !== ordered) break;
          items.push({ children: parseInline(l2[3]) });
          i++;
        }
        blocks.push({ type: 'list', ordered: ordered, items: items });
        continue;
      }

      // 段落：累积连续非空、非特殊行
      var paraLines = [line];
      i++;
      while (i < n) {
        var ln = lines[i];
        if (/^\s*$/.test(ln)) break;
        if (/^\s*(```|~~~)/.test(ln)) break;
        if (/^\s*(\$\$|\\\[)/.test(ln)) break;
        if (/^(#{1,6})\s+/.test(ln)) break;
        if (LIST_RE.test(ln)) break;
        paraLines.push(ln);
        i++;
      }
      blocks.push({ type: 'paragraph', children: parseInline(paraLines.join('\n')) });
    }

    return blocks;
  }

  /* ---------------- DOM 渲染（安全：无 innerHTML） ---------------- */

  function appendTextWithBreaks(parent, text, doc) {
    var parts = String(text).split('\n');
    for (var idx = 0; idx < parts.length; idx++) {
      if (idx > 0) parent.appendChild(doc.createElement('br'));
      parent.appendChild(doc.createTextNode(parts[idx]));
    }
  }

  function appendInline(parent, tokens, doc) {
    for (var k = 0; k < tokens.length; k++) {
      var t = tokens[k];
      if (t.type === 'text') {
        appendTextWithBreaks(parent, t.text, doc);
      } else if (t.type === 'strong') {
        var s = doc.createElement('strong');
        appendInline(s, t.children, doc);
        parent.appendChild(s);
      } else if (t.type === 'em') {
        var em = doc.createElement('em');
        appendInline(em, t.children, doc);
        parent.appendChild(em);
      } else if (t.type === 'code') {
        var c = doc.createElement('code');
        c.className = 'ai-md-inline-code';
        c.textContent = t.text;
        parent.appendChild(c);
      } else if (t.type === 'link') {
        var a = doc.createElement('a');
        a.href = t.href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        appendInline(a, t.children, doc);
        parent.appendChild(a);
      } else if (t.type === 'math') {
        var m = doc.createElement(t.display ? 'div' : 'span');
        m.className = t.display ? 'ai-md-math-display' : 'ai-md-math-inline';
        m.textContent = t.text; // 保留原始 TeX 分隔符，交由 MathJax typeset
        parent.appendChild(m);
      }
    }
  }

  function renderBlock(b, doc) {
    if (b.type === 'paragraph') {
      var p = doc.createElement('div');
      p.className = 'ai-md-p';
      appendInline(p, b.children, doc);
      return p;
    }
    if (b.type === 'heading') {
      var h = doc.createElement('div');
      h.className = 'ai-md-heading ai-md-h' + b.level;
      appendInline(h, b.children, doc);
      return h;
    }
    if (b.type === 'code') {
      var pre = doc.createElement('pre');
      pre.className = 'ai-md-code';
      var code = doc.createElement('code');
      code.textContent = b.text;
      pre.appendChild(code);
      return pre;
    }
    if (b.type === 'list') {
      var ul = doc.createElement(b.ordered ? 'ol' : 'ul');
      ul.className = 'ai-md-list';
      for (var k = 0; k < b.items.length; k++) {
        var li = doc.createElement('li');
        appendInline(li, b.items[k].children, doc);
        ul.appendChild(li);
      }
      return ul;
    }
    if (b.type === 'math') {
      var m = doc.createElement(b.display ? 'div' : 'span');
      m.className = b.display ? 'ai-md-math-display' : 'ai-md-math-inline';
      m.textContent = b.text;
      return m;
    }
    return doc.createTextNode('');
  }

  function renderMarkdown(text, doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    var frag = doc.createDocumentFragment();
    var blocks = parseMarkdown(text);
    for (var k = 0; k < blocks.length; k++) frag.appendChild(renderBlock(blocks[k], doc));
    return frag;
  }

  return {
    parseMarkdown: parseMarkdown,
    parseInline: parseInline,
    hasMath: hasMath,
    renderMarkdown: renderMarkdown,
    isSafeUrl: isSafeUrl
  };
});
