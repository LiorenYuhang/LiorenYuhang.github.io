/**
 * AI Assistant — Frontend Panel v2.3
 * Fixes: close/reopen race, mobile overlay, PJAX duplicate bind, clear during loading, full bookmark block
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'ai_assistant_session';
  var MAX_MESSAGES = 20;
  var MAX_STORAGE_KB = 50;
  var SESSION_VERSION = 3;
  var config = window.__AI_ASSISTANT_CONFIG__ || {};
  var DEMO_MODE = config.environment === 'development' && config.demoMode === true;
  var API_URL = '/api/assistant';
  var CLOSE_ANIMATION_MS = 220;

  var conversation = [];
  var panelOpen = false;
  var abortController = null;
  var loading = false;
  var closeTimer = null;

  var panelEl, overlayEl, messagesEl, inputEl, sendBtn, stopBtn, closeBtn, statusBarEl, clearBtn;

  if (window.__AI_ASSISTANT_INITIALIZED__) return;
  window.__AI_ASSISTANT_INITIALIZED__ = true;

  /* ================================================================
     sessionStorage
     ================================================================ */
  function saveSession() {
    try {
      var data = { v: SESSION_VERSION, conversation: conversation, panelOpen: panelOpen };
      var json = JSON.stringify(data);
      while (conversation.length > 2 && json.length > MAX_STORAGE_KB * 1024) {
        conversation.splice(0, 2);
        json = JSON.stringify({ v: SESSION_VERSION, conversation: conversation, panelOpen: panelOpen });
      }
      sessionStorage.setItem(STORAGE_KEY, json);
    } catch (e) { /* ignore */ }
  }

  function loadSession() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var data = JSON.parse(raw);
      if (data.v !== SESSION_VERSION) return false;
      conversation = data.conversation || [];
      if (conversation.length > MAX_MESSAGES) conversation = conversation.slice(conversation.length - MAX_MESSAGES);
      panelOpen = !!data.panelOpen;
      return true;
    } catch (e) { return false; }
  }

  function clearSession() {
    // Abort in-flight request
    if (abortController) { abortController.abort(); abortController = null; }
    loading = false;
    setUIState(false);
    conversation = [];
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) { /* */ }
    renderConversation();
    saveSession();
  }

  /* ================================================================
     CSS
     ================================================================ */
  var STYLE_ID = 'ai-assistant-styles';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      '#ai-panel-overlay{position:fixed;inset:0;z-index:1040;display:none;pointer-events:none;}' +
      '#ai-panel-overlay.mobile-visible{pointer-events:auto;background:rgba(0,0,0,.3);}' +
      '#ai-panel{position:fixed;z-index:1050;right:30px;top:40px;width:380px;max-height:calc(100vh - 60px);' +
      'background:#fff;color:#333;border-radius:12px 0 12px 12px;box-shadow:0 4px 24px rgba(0,0,0,.12);' +
      'display:none;flex-direction:column;font-family:"LXGW WenKai","PingFang SC","Microsoft YaHei",sans-serif;' +
      'font-size:14px;line-height:1.6;overflow:hidden;transform-origin:top right;opacity:0;' +
      'transform:translateY(-8px) scale(.96);transition:opacity 180ms ease,transform 200ms ease;}' +
      '#ai-panel.open{opacity:1;transform:translateY(0) scale(1);}' +
      '#ai-panel-header{display:flex;align-items:center;justify-content:space-between;padding:12px 18px 8px;border-bottom:1px solid #eee;flex-shrink:0;}' +
      '#ai-panel-header .ai-title{font-size:15px;font-weight:600;color:#222;}' +
      '#ai-panel-header .ai-subtitle{font-size:11px;color:#999;margin-top:1px;}' +
      '#ai-panel-close{background:none;border:none;cursor:pointer;font-size:20px;color:#999;padding:0 4px;line-height:1;}' +
      '#ai-panel-close:hover{color:#555;}' +
      '#ai-panel-messages{flex:1;overflow-y:auto;padding:12px 18px;min-height:80px;max-height:50vh;}' +
      '#ai-panel-messages::-webkit-scrollbar{width:4px;}#ai-panel-messages::-webkit-scrollbar-thumb{background:#ddd;border-radius:2px;}' +
      '#ai-panel-status{padding:6px 18px;font-size:11px;color:#999;border-top:1px solid #eee;flex-shrink:0;text-align:center;display:flex;align-items:center;justify-content:center;gap:12px;}' +
      '#ai-panel-input-wrap{display:flex;align-items:center;padding:8px 12px 12px;gap:8px;border-top:1px solid #eee;flex-shrink:0;}' +
      '#ai-panel-input{flex:1;border:1px solid #e0e0e0;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;resize:none;outline:none;background:#f9f9f9;color:#333;max-height:80px;}' +
      '#ai-panel-input:focus{border-color:#bbb;background:#fff;}#ai-panel-input:disabled{opacity:.6;}' +
      '.ai-btn{border:none;border-radius:8px;padding:8px 14px;font-size:13px;font-family:inherit;cursor:pointer;white-space:nowrap;flex-shrink:0;}' +
      '.ai-btn-send{background:#222;color:#fff;}.ai-btn-send:hover{background:#444;}.ai-btn-send:disabled{background:#bbb;cursor:not-allowed;}' +
      '.ai-btn-stop{background:#e0e0e0;color:#555;display:none;}.ai-btn-stop:hover{background:#ccc;}' +
      '.ai-btn-clear{background:transparent;color:#999;padding:4px 8px;font-size:11px;border:1px solid #ddd;}.ai-btn-clear:hover{background:#f5f5f5;color:#666;}' +
      '.ai-msg{margin-bottom:14px;max-width:90%;animation:aiFadeIn .2s ease;}' +
      '@keyframes aiFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}' +
      '.ai-msg-user{margin-left:auto;}.ai-msg-user .ai-bubble{background:#e3f2fd;color:#333;border-radius:12px 12px 4px 12px;padding:8px 14px;word-break:break-word;}' +
      '.ai-msg-bot .ai-bubble{background:#f5f5f5;color:#333;border-radius:12px 12px 12px 4px;padding:8px 14px;word-break:break-word;}' +
      '.ai-source-card{display:block;text-decoration:none;color:inherit;background:#fafafa;border:1px solid #eee;border-radius:8px;padding:8px 12px;margin-top:6px;font-size:12px;transition:background .15s;}' +
      '.ai-source-card:hover{background:#f0f0f0;}.ai-source-card .ai-src-title{font-weight:600;color:#222;margin-bottom:2px;}.ai-source-card .ai-src-excerpt{color:#666;font-size:11px;}' +
      '.ai-prompt-tag{display:inline-block;background:#f0f0f0;color:#555;border:1px solid #ddd;border-radius:6px;padding:4px 10px;margin:3px 4px;font-size:12px;cursor:pointer;transition:background .15s;}' +
      '.ai-prompt-tag:hover{background:#e0e0e0;}' +
      '.ai-welcome{text-align:center;padding:20px 10px;color:#888;}.ai-welcome p{margin:0 0 12px;font-size:13px;}' +
      '.ai-spinner{display:inline-block;width:16px;height:16px;border:2px solid #ddd;border-top-color:#555;border-radius:50%;animation:aiSpin .8s linear infinite;vertical-align:middle;margin-right:6px;}' +
      '@keyframes aiSpin{to{transform:rotate(360deg)}}' +
      '.ai-loading-row{padding:8px 0;color:#999;font-size:13px;}' +
      '@media(max-width:767px){#ai-panel{right:0;bottom:0;top:auto;left:0;width:100%;max-height:60vh;border-radius:16px 16px 0 0;transform-origin:bottom center;transform:translateY(100%);}' +
      '#ai-panel.open{transform:translateY(0);}#ai-panel-messages{max-height:30vh;}}';
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ================================================================
     Helpers
     ================================================================ */
  function isMobile() { return window.innerWidth <= 767; }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x) e.textContent = x; return e; }

  var PANEL_ID = 'ai-panel';
  var OVERLAY_ID = 'ai-panel-overlay';

  function buildDOM() {
    if (document.getElementById(PANEL_ID)) return;
    overlayEl = document.createElement('div');
    overlayEl.id = OVERLAY_ID;
    overlayEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlayEl);

    panelEl = document.createElement('div');
    panelEl.id = PANEL_ID;
    panelEl.setAttribute('role', 'dialog');
    panelEl.setAttribute('aria-label', 'AI 助手');
    panelEl.setAttribute('aria-hidden', 'true');

    var hdr = document.createElement('div'); hdr.id = 'ai-panel-header';
    var tw = document.createElement('div');
    tw.appendChild(el('span', 'ai-title', 'AI 助手'));
    tw.appendChild(el('div', 'ai-subtitle', '基于本站公开内容回答'));
    closeBtn = el('button', null, '×');
    closeBtn.id = 'ai-panel-close';
    closeBtn.setAttribute('aria-label', '关闭');
    hdr.appendChild(tw); hdr.appendChild(closeBtn);

    messagesEl = document.createElement('div'); messagesEl.id = 'ai-panel-messages';

    statusBarEl = document.createElement('div'); statusBarEl.id = 'ai-panel-status';
    statusBarEl.appendChild(el('span', null, DEMO_MODE ? '当前为前端演示模式' : '基于本站公开内容回答')).style.cssText = 'font-size:10px;color:#bbb;';
    statusBarEl.appendChild(el('span', null, '请合理使用本站 AI 助手'));
    clearBtn = el('button', 'ai-btn ai-btn-clear', '清空对话');
    statusBarEl.appendChild(clearBtn);

    var iw = document.createElement('div'); iw.id = 'ai-panel-input-wrap';
    inputEl = document.createElement('textarea'); inputEl.id = 'ai-panel-input';
    inputEl.setAttribute('rows', '1'); inputEl.setAttribute('placeholder', '输入问题...'); inputEl.setAttribute('maxlength', '500');
    sendBtn = el('button', 'ai-btn ai-btn-send', '发送');
    stopBtn = el('button', 'ai-btn ai-btn-stop', '停止');
    iw.appendChild(inputEl); iw.appendChild(sendBtn); iw.appendChild(stopBtn);

    panelEl.appendChild(hdr); panelEl.appendChild(messagesEl); panelEl.appendChild(statusBarEl); panelEl.appendChild(iw);
    document.body.appendChild(panelEl);
  }

  /* ================================================================
     Safe DOM rendering
     ================================================================ */
  function userBubble(text) { var d = el('div', 'ai-msg ai-msg-user'), b = el('div', 'ai-bubble', text); d.appendChild(b); return d; }
  function botBubble(text) { var d = el('div', 'ai-msg ai-msg-bot'), b = el('div', 'ai-bubble', text); d.appendChild(b); return d; }
  function sourceCard(s) {
    var a = el('a', 'ai-source-card'); a.href = s.url; a.target = '_blank'; a.rel = 'noopener';
    a.appendChild(el('span', 'ai-src-title', s.title));
    a.appendChild(el('span', 'ai-src-excerpt', ' — ' + s.excerpt));
    return a;
  }
  function promptTag(text) {
    var sp = el('span', 'ai-prompt-tag', text); sp.setAttribute('role', 'button'); sp.setAttribute('tabindex', '0');
    sp.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); submitQuery(text); });
    sp.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); submitQuery(text); } });
    return sp;
  }
  function welcomeBlock() {
    var w = el('div', 'ai-welcome');
    w.appendChild(el('p', null, '我可以帮助你查找和理解本站已经公开的内容。'));
    var row = el('div');
    ['这个网站主要有哪些内容？', '最近发布了哪些文章？', '这篇文章的主要内容是什么？'].forEach(function (t) { row.appendChild(promptTag(t)); });
    w.appendChild(row);
    return w;
  }

  /* ================================================================
     Unified render
     ================================================================ */
  function renderConversation() {
    while (messagesEl.firstChild) messagesEl.removeChild(messagesEl.firstChild);
    if (conversation.length === 0) { messagesEl.appendChild(welcomeBlock()); }
    else {
      for (var i = 0; i < conversation.length; i++) {
        var m = conversation[i];
        if (m.role === 'user') { messagesEl.appendChild(userBubble(m.content)); }
        else if (m.role === 'assistant') {
          messagesEl.appendChild(botBubble(m.content));
          if (m.sources && m.sources.length) m.sources.forEach(function (s) { messagesEl.appendChild(sourceCard(s)); });
        }
      }
    }
    if (loading) {
      var lr = el('div', 'ai-loading-row'); var sp = el('span', 'ai-spinner');
      lr.appendChild(sp); lr.appendChild(document.createTextNode(' 正在查找...'));
      messagesEl.appendChild(lr);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setUIState(isLoading) {
    if (isLoading) { sendBtn.style.display = 'none'; stopBtn.style.display = ''; inputEl.disabled = true; sendBtn.disabled = true; }
    else { sendBtn.style.display = ''; stopBtn.style.display = 'none'; inputEl.disabled = false; sendBtn.disabled = false; }
  }

  /* ================================================================
     Unified DOM visibility sync
     ================================================================ */
  function syncPanelVisibility() {
    if (panelOpen) {
      // Fix #1: clear any pending close timer to prevent race
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
      panelEl.style.display = 'flex';
      panelEl.setAttribute('aria-hidden', 'false');
      overlayEl.style.display = 'block';
      overlayEl.setAttribute('aria-hidden', 'false');
      void panelEl.offsetWidth;
      panelEl.classList.add('open');
      // Fix #2: overlay interaction controlled ONLY by mobile-visible class
      if (isMobile()) { overlayEl.classList.add('mobile-visible'); }
      else { overlayEl.classList.remove('mobile-visible'); }
    } else {
      panelEl.classList.remove('open');
      panelEl.setAttribute('aria-hidden', 'true');
      // Fix #2: remove mobile-visible; no inline pointer-events written
      overlayEl.classList.remove('mobile-visible');
      overlayEl.setAttribute('aria-hidden', 'true');
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(function () {
        // Fix #1: re-check state before hiding
        if (!panelOpen) {
          panelEl.style.display = 'none';
          overlayEl.style.display = 'none';
        }
        closeTimer = null;
      }, CLOSE_ANIMATION_MS);
    }
    saveSession();
  }

  /* ================================================================
     Open / Close
     ================================================================ */
  function openPanel() {
    panelOpen = true;
    // Fix #1: clear closeTimer in open path too
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    syncPanelVisibility();
    renderConversation();
    inputEl.focus();
  }

  function closePanel() {
    // Clear pending timer to prevent race
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    panelOpen = false;
    // Fix #2: do NOT write inline pointer-events:none — CSS handles desktop;
    // mobile overlay interaction is controlled by removing mobile-visible class
    panelEl.classList.remove('open');
    panelEl.setAttribute('aria-hidden', 'true');
    overlayEl.classList.remove('mobile-visible');
    overlayEl.setAttribute('aria-hidden', 'true');
    closeTimer = setTimeout(function () {
      // Fix #1: re-check state before hiding
      if (!panelOpen) {
        panelEl.style.display = 'none';
        overlayEl.style.display = 'none';
      }
      closeTimer = null;
    }, CLOSE_ANIMATION_MS);
    saveSession();
  }

  function togglePanel() { if (panelOpen) closePanel(); else openPanel(); }

  /* ================================================================
     Outside-click: pointerdown capture (desktop), overlay click (mobile)
     ================================================================ */
  function handlePointerDown(e) {
    if (!panelOpen) return;
    var inPanel = panelEl.contains(e.target);
    var onBookmark = e.target.closest('.book-mark-link');
    if (!inPanel && !onBookmark) closePanel();
  }

  /* ================================================================
     Events (idempotent per DOM build)
     ================================================================ */
  var eventsBound = false;
  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;
    closeBtn.addEventListener('click', function (e) { e.stopPropagation(); closePanel(); });
    overlayEl.addEventListener('click', function (e) { if (isMobile() && e.target === overlayEl) closePanel(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panelOpen) { e.stopPropagation(); closePanel(); } });
    sendBtn.addEventListener('click', function () { submitQuery(); });
    stopBtn.addEventListener('click', stopGeneration);
    inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitQuery(); } });
    clearBtn.addEventListener('click', clearSession);
  }

  /* ================================================================
     Bookmark blocking — two layers
     ================================================================ */
  function setupBookmarkBlockers() {
    // Layer 1: pointerdown capture → toggle panel (fires first)
    document.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('.book-mark-link')) return;
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
    }, true);

    // Layer 2: click capture → block NexT handler WITHOUT toggling again
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.book-mark-link')) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      // Do NOT toggle — pointerdown already handled it
    }, true);
  }

  /* ================================================================
     Mock API
     ================================================================ */
  var MOCK = {
    '这个网站主要有哪些内容': {
      answer: '这个网站目前包含 4 篇已发布文章，涵盖三个分类：\n\n1. 教程：从零搭建个人网站的完整教程\n2. 机器人：因时微型伺服电缸的 ROS2 控制、6-PUS Stewart 并联机构\n3. 技术前沿：QQ 邮箱 Agently Mail AI Agent 体验\n\n此外还有关于页面。',
      sources: [
        { title: '从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程', url: '/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/', excerpt: '从零开始搭建个人网站的完整教程' },
        { title: '关于我', url: '/about/', excerpt: '作者刘宇杭的个人介绍页面' }
      ]
    },
    '最近发布了哪些文章': {
      answer: '最近发布的文章是《6-PUS Stewart并联机构研究（一）》（2026年8月5日）。在此之前还有《QQ 邮箱 Agently Mail 内测初体验》（6月30日）和《因时微型伺服电缸的 ROS2 控制》（6月16日）。',
      sources: [
        { title: '6-PUS Stewart并联机构研究（一）', url: '/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/', excerpt: '面向具体 6-PUS Stewart 并联机构的运动学建模与工作空间分析' }
      ]
    },
    '这篇文章的主要内容是什么': { answer: '当前为前端演示模式，尚未连接本站知识库和 AI 模型。', sources: [] }
  };

  function getMock(q) {
    q = q.trim();
    if (q === '__429__') return { scope: 'rate_limited' };
    if (q === '__503__') return { scope: 'disabled' };
    if (q === '__error__') return { scope: 'error', message: '模拟的网络错误' };
    if (q === '__noresults__' || q === '') return { scope: 'no_results' };
    for (var k in MOCK) { if (MOCK.hasOwnProperty(k) && (q.indexOf(k) !== -1 || k.indexOf(q) !== -1)) { var r = MOCK[k]; r.scope = 'success'; return r; } }
    if (DEMO_MODE) return { scope: 'demo', message: '当前为前端演示模式，尚未连接本站知识库和 AI 模型。' };
    return { scope: 'no_results' };
  }

  function simulateAPICall(question) {
    return new Promise(function (resolve) {
      abortController = new AbortController();
      var signal = abortController.signal;
      var t = setTimeout(function () { if (!signal.aborted) resolve(getMock(question)); }, 800 + Math.random() * 700);
      signal.addEventListener('abort', function () { clearTimeout(t); resolve({ scope: 'aborted' }); });
    });
  }

  function callAssistantAPI(question, history) {
    abortController = new AbortController();
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: question,
        conversation: history,
        page_context: { url: window.location.pathname }
      }),
      signal: abortController.signal
    }).then(function (response) {
      return response.json().catch(function () {
        throw new Error('服务器返回了无效响应');
      });
    }).catch(function (error) {
      if (error && error.name === 'AbortError') return { scope: 'aborted' };
      return { scope: 'error', message: '网络连接失败，请稍后再试。' };
    });
  }

  /* ================================================================
     Core flow
     ================================================================ */
  function submitQuery(text) {
    var question = (text || inputEl.value).trim();
    if (!question || loading) return;
    var history = conversation.slice(-6).map(function (message) {
      return { role: message.role, content: message.content };
    });
    inputEl.value = '';
    conversation.push({ role: 'user', content: question });
    if (conversation.length > MAX_MESSAGES) conversation = conversation.slice(conversation.length - MAX_MESSAGES);
    loading = true;
    setUIState(true);
    renderConversation();
    saveSession();
    abortController = null;

    var request = DEMO_MODE ? simulateAPICall(question) : callAssistantAPI(question, history);
    request.then(function (r) {
      // Fix #4: if loading was cleared (clearSession), don't append
      if (!loading) return;
      loading = false;
      setUIState(false);
      var msg = { role: 'assistant', content: '', sources: [] };
      switch (r.scope) {
      case 'success': msg.content = r.answer; msg.sources = r.sources || []; break;
      case 'no_results': msg.content = r.answer || '当前网站的公开内容中没有找到相关信息。'; break;
      case 'rate_limited': msg.content = r.answer || '请求过于频繁，请稍后再试。'; break;
      case 'disabled': msg.content = r.answer || 'AI 助手暂时不可用。'; break;
      case 'upstream_busy': msg.content = r.answer || 'AI 服务繁忙，请稍后再试。'; break;
      case 'upstream_error': msg.content = r.answer || 'AI 服务暂时不可用。'; break;
      case 'timeout': msg.content = r.answer || '请求超时，请稍后再试。'; break;
      case 'bad_request': msg.content = r.answer || '请求格式有误，请刷新页面后重试。'; break;
      case 'demo': msg.content = r.message; break;
      case 'aborted': msg.content = '已停止生成。'; break;
      default: msg.content = r.message || '抱歉，出了点问题。';
      }
      conversation.push(msg);
      if (conversation.length > MAX_MESSAGES) conversation = conversation.slice(conversation.length - MAX_MESSAGES);
      renderConversation();
      saveSession();
      abortController = null;
    });
  }

  function stopGeneration() { if (abortController) abortController.abort(); }

  /* ================================================================
     Init — single entry, guarded by window.__AI_ASSISTANT_INITIALIZED__
     ================================================================ */
  function init() {
    injectStyles();
    buildDOM();
    bindEvents();
    setupBookmarkBlockers();
    document.addEventListener('pointerdown', handlePointerDown, true);

    loadSession();
    if (panelOpen) { panelEl.style.display = 'flex'; overlayEl.style.display = 'block'; }
    syncPanelVisibility();
    renderConversation();

    // PJAX: restore DOM refs + session. Global listeners persist.
    document.addEventListener('pjax:complete', function () {
      injectStyles();
      if (!document.getElementById(PANEL_ID)) {
        buildDOM();
        eventsBound = false;
        bindEvents();
        // re-attach refs
        panelEl = document.getElementById(PANEL_ID);
        overlayEl = document.getElementById(OVERLAY_ID);
        messagesEl = document.getElementById('ai-panel-messages');
        inputEl = document.getElementById('ai-panel-input');
        sendBtn = panelEl.querySelector('.ai-btn-send');
        stopBtn = panelEl.querySelector('.ai-btn-stop');
        closeBtn = document.getElementById('ai-panel-close');
        statusBarEl = document.getElementById('ai-panel-status');
        clearBtn = panelEl.querySelector('.ai-btn-clear');
      }
      loadSession();
      syncPanelVisibility();
      renderConversation();
    });

    window.addEventListener('pageshow', function () {
      loadSession();
      syncPanelVisibility();
      renderConversation();
    });
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
