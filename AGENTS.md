# AGENTS.md — 个人技术网站项目工程规范

> 本文件是整个项目的总工程规范，适用于所有开发任务（网站、博客、AI 助手、部署）。
> 最后更新：2026-09-17

---

## 1. 项目定位

### 1.1 项目概述

**个人技术网站**，包含博客文章 + 站内 AI 导览助手。

- **线上入口**：`https://lyhhub.pages.dev`（Cloudflare Pages，主站）
- **备用入口**：`https://liorenyuhang.github.io`（GitHub Pages，镜像）
- **代码仓库**：`E:\CODE\web`
- **工程文档**：`E:\CODE\webdocs`（独立于代码仓库）

### 1.2 项目发展历史

| 阶段 | 内容 |
|------|------|
| **最初** | GitHub Pages 个人博客，Hexo + NexT 主题 |
| **后续** | 网站 UI 持续优化、博客体系建设、Cloudflare 迁移部署 |
| **当前** | 静态网站 + AI Agent + RAG 知识库 + DeepSeek v4 |

### 1.3 整体架构

```
source/                           Cloudflare Pages
  ├── _posts/ （博客文章）             ├── public/ （Hexo 生成的静态站）
  ├── _drafts/ （草稿）               ├── functions/ （Pages Functions 后端）
  ├── _data/ （自定义 CSS/JS/模板）     │     ├── api/assistant.js （AI API 入口）
  ├── js/ （前端 JS）                  │     └── lib/ （核心模块）
  └── images/ （图片资源）             └── D1 数据库（AI 调用预算）
        │
        ▼
  Hexo 构建 ──→ public/ ──→ Cloudflare Pages 部署
        │
        ▼
  build-knowledge-base.js ──→ knowledge-base.json ──→ AI RAG 检索
```

---

## 2. 技术栈

### 2.1 网站

| 技术 | 版本/说明 |
|------|-----------|
| Hexo | 8.1.2，静态网站生成器 |
| NexT 主题 | 8.27.0，Gemini 方案（卡片式双栏） |
| Node.js | 20（构建环境） |
| Markdown 渲染 | hexo-renderer-marked 7.x |
| CSS 预处理 | hexo-renderer-stylus 3.x |
| 数学公式 | hexo-filter-mathjax 0.11.x |

### 2.2 部署

| 技术 | 用途 |
|------|------|
| Cloudflare Pages | 主站托管 + Functions 运行时 |
| Cloudflare D1 | AI 调用预算数据库（SQLite） |
| Cloudflare Cache API | AI 回答缓存 |
| GitHub Pages | 备用镜像（gh-pages 分支） |
| Wrangler CLI | Cloudflare 本地开发与部署 |

### 2.3 AI 助手

| 技术 | 用途 |
|------|------|
| DeepSeek v4 | LLM Provider（flash + thinking 模式） |
| BM25 + Bigram 分词 | 站内中文检索（零外部依赖） |
| knowledge-base.json | 本地知识库（semantic chunking） |

---

## 3. 目录结构

```
E:\CODE\web/
├── _config.yml                 # Hexo 主配置
├── _config.next.yml            # NexT 主题配置
├── package.json                # 依赖与 npm scripts
├── wrangler.jsonc              # Cloudflare Pages 配置
├── .dev.vars.example           # 本地环境变量模板
├── .dev.vars                   # 本地环境变量（不提交）
├── .gitignore
│
├── layouts/                    # 自定义布局覆盖
│   ├── home.njk                # Content Hub 聚合大厅页面模板
│   └── languages/              # 布局多语言包
│
├── source/                     # Hexo 源文件目录
│   ├── _posts/                 # 已发布博客文章
│   ├── _drafts/                # 博客草稿
│   ├── _data/                  # 自定义数据与注入文件
│   │   ├── head.njk            # <head> 注入
│   │   ├── body-end.njk        # </body> 前注入
│   │   ├── home.yml            # Content Hub 大厅展示配置
│   │   └── styles.styl         # 自定义 CSS（Stylus）
│   ├── js/
│   │   ├── ai-assistant.js     # AI 助手前端面板
│   │   ├── ai-markdown.js      # 前端安全 Markdown 渲染器
│   │   └── click-effect.js     # 点击波纹特效
│   ├── images/                 # 文章图片资源
│   ├── about/index.md          # 关于页面
│   ├── categories/index.md     # 分类页面
│   ├── tags/index.md           # 标签页面
│   └── _routes.json            # Cloudflare Pages 路由配置
│
├── functions/                  # Cloudflare Pages Functions
│   ├── api/
│   │   ├── assistant.js        # AI API 入口（POST /api/assistant）
│   │   └── debug/env.js        # 调试端点（仅开发/Preview）
│   └── lib/
│       ├── assistant-core.js   # 核心编排
│       ├── assistant-diagnostics.js # 运行时健康诊断与自检
│       ├── request-validation.js # 请求校验 + URL 规范化
│       ├── site-router.js      # 站内页面与专栏路由直达
│       ├── contact-router.js   # 站长联系与社交通道路由直达
│       ├── prompt-builder.js   # System/User Prompt 构建
│       ├── source-builder.js   # 来源回查与验证
│       ├── security.js         # Prompt 注入防护
│       ├── deepseek-provider.js # DeepSeek API Provider
│       ├── mock-provider.js    # 开发用 Mock Provider
│       ├── model-provider.js   # Provider 配置提取
│       ├── cache.js            # 内存缓存（开发）
│       ├── cloudflare-cache.js # Cloudflare Cache API（生产）
│       ├── budget-store.js     # 内存预算（开发）
│       └── d1-budget-store.js  # D1 预算（生产）
│
├── scripts/                    # 构建与检索脚本
│   ├── build-knowledge-base.js # Markdown → JSON 知识库构建
│   ├── search.js               # BM25 站内检索核心
│   ├── home.js                 # Content Hub 聚合大厅数据发生器
│   ├── tagcloud-order.js       # 标签云排序插件
│   └── copy-routes.js          # 路由配置复制到 public/
│
├── tests/                      # 测试文件
│   ├── search.test.js          # BM25 检索与双评分基准测试（59 tests）
│   ├── search-regression.test.js # 检索边界与 Badcase 回归测试（5 tests）
│   ├── assistant-api.test.js   # API 入口与 Core 组合测试
│   ├── assistant-diagnostics.test.js # 运行时自检测试
│   ├── assistant-4b-integration.test.js  # Core 生命周期集成测试
│   ├── assistant-worker-integration.test.js # Worker onRequest 集成测试
│   ├── deepseek-provider.test.js   # Provider 接口测试
│   ├── d1-budget.test.js       # D1 状态机单元测试
│   ├── d1-local.integration.test.js  # 本地 D1 集成测试
│   ├── cloudflare-cache.test.js     # Cache 测试
│   ├── prompt-injection.test.js     # 注入防护测试
│   ├── ai-assistant-frontend.test.js # 前端组件测试
│   └── ai-markdown.test.js     # 前端 Markdown 渲染与 XSS 测试
│
├── migrations/                 # D1 数据库迁移
│   ├── 0001_create_ai_budget.sql
│   └── 0002_budget_atomic_triggers.sql
│
├── tools/                      # 工具脚本
│   └── run-local-d1-migrations.js
│
├── public/                     # 构建输出（不提交）
└── knowledge-base.json         # 生成的知识库（构建产物）
```

---

## 4. 网站开发规范

### 4.1 Hexo 使用规则

**构建命令**：
```bash
npm run build     # 知识库构建 + Hexo 生成 + 路由复制
npx hexo server   # 本地开发服务器
npx hexo clean    # 清理 public/
```

**配置文件**：
- `_config.yml` — Hexo 核心配置（网站信息、URL、部署等）
- `_config.next.yml` — NexT 主题配置（外观、菜单、侧边栏等）

**修改配置时**：
- 两个配置文件职责分明，不要混淆
- `_config.yml` 中的 `deploy` 配置指向旧 GitHub Pages，Cloudflare 部署不依赖它
- 修改 `theme:` 字段会影响整个站点外观

### 4.2 NexT 主题修改规则

**主题安装方式**：通过 npm（`hexo-theme-next`），不是直接 clone 到 `themes/`。

**规则**：
- **不要直接修改 `node_modules/hexo-theme-next/` 中的文件** — npm install 会覆盖
- **所有自定义通过 `source/_data/` 注入**：
  - `head.njk` → 注入到 `<head>`
  - `body-end.njk` → 注入到 `</body>` 前
  - `styles.styl` → 自定义 CSS（Stylus 语法）
- NexT 主题升级前先在本地验证兼容性
- 不要随意更换主题方案（当前 Gemini），除非有明确需求

### 4.3 CSS/JS 修改规则

**自定义 CSS**（`source/_data/styles.styl`）：
- 使用 Stylus 语法（与 NexT 一致）
- 已定制内容：黑白极简风格、霞鹜文楷字体、Fira Code 等宽、头像圆形、卡片圆角阴影、暗色模式渐变、AI 面板暗色适配
- 修改视觉样式前先确认不会破坏暗色模式

**自定义 JS**：
- `source/js/click-effect.js` — 点击波纹特效，纯装饰
- `source/js/ai-assistant.js` — AI 助手前端面板，核心功能
- `source/_data/body-end.njk` — 菜单重排、邮箱复制等 DOM 操作

**规则**：
- AI 助手 JS 的视觉样式已稳定，不要随意修改
- CSS 修改后需验证亮色/暗色两种模式
- 新增 JS 文件应考虑放在 `source/js/` 并在 `body-end.njk` 中引用

### 4.4 页面修改注意事项

- **关于页** (`source/about/index.md`) — `head.njk` 中有特殊 CSS 控制侧边栏显示
- **归档页** — `body-end.njk` 中有定制化标题文案
- **分类/标签页** — 由 Hexo 自动生成，内容来自文章 Front-matter
- **首页** — Content Hub 聚合大厅（通过 `scripts/home.js`、`source/_data/home.yml` 与 `layouts/home.njk` 自定义生成，不再是纯文章列表分页）

---

## 5. 博客管理规范

### 5.1 文章目录

| 目录 | 用途 |
|------|------|
| `source/_posts/` | 已发布文章 |
| `source/_drafts/` | 草稿（未发布） |

### 5.2 Markdown 规范

**Front-matter 格式**：
```yaml
---
title: 文章标题
date: YYYY-MM-DD HH:mm:ss
tags: [标签1, 标签2]
categories: [分类]
---
```

**规则**：
- 标题使用中文，文件名可包含中文
- 使用 `<!-- more -->` 控制首页摘要截断
- 数学公式使用 `$...$`（行内）和 `$$...$$`（块级），由 MathJax 渲染
- 代码块使用三个反引号 + 语言标识

### 5.3 图片管理

- 图片放在 `source/images/` 下，按文章/主题分目录
- 文章内使用相对路径引用：`![](/images/目录/文件名.png)`
- 图片文件名可包含中文
- 建议压缩大图（>1MB）后再放入

### 5.4 发布流程

```
1. 在 source/_drafts/ 中写草稿
2. npx hexo server 本地预览
3. 确认无误后移动到 source/_posts/
4. npm run build 验证构建
5. Git 提交
6. Cloudflare Pages 自动部署
```

**规则**：
- 不要直接将草稿推送到生产环境
- 未经用户明确要求，不要自动将 draft 移入 _posts
- 不要自动发布文章

---

## 6. 部署流程

### 6.1 部署架构

```
本地修改 → npm run build → 测试 → Git 提交 → git push
                                                    ↓
                                              GitHub（源码）
                                                    ↓
                                          Cloudflare Pages（自动部署）
                                          ├── 静态站点（public/）
                                          └── Functions（functions/）
```

### 6.2 部署方式

| 方式 | 说明 | 状态 |
|------|------|------|
| Cloudflare Pages | 主站，自动从 main 分支部署 | **当前使用** |
| GitHub Pages | 旧方式，通过 `hexo-deployer-git` 部署到 gh-pages | 历史保留 |

### 6.3 Cloudflare Pages 配置

- **项目名**：`lyhhub`
- **构建输出目录**：`public`
- **构建命令**：`npm run build`
- **Functions 目录**：`functions/`
- **D1 数据库**：`ai-budget-staging`（binding: `AI_BUDGET_DB`）
- **路由**：`/api/*` 由 Functions 处理（`source/_routes.json` → `public/_routes.json`）

### 6.4 部署规则

- main 是 Production 基线，不要直接在 main 上随意修改
- 重要功能开发使用 feature/preview 分支
- Preview 环境验证通过后再合并到 main
- 不要混淆 Preview URL 和 Production URL
- 推送前必须：`git status` → `git diff` → `git diff --cached --check`

### 6.5 环境变量

环境变量由 Cloudflare Pages Dashboard 和 `.dev.vars`（本地）管理，详见 `.dev.vars.example`。

**绝对禁止**：
- 将 `.dev.vars` 提交到 Git
- 将真实 secret 写入代码
- 在日志或响应中打印 secret

---

## 7. AI 助手系统规范

### 7.1 版本基线

- **v1.0 标签**：`v1.0-ai-assistant`
- **Baseline commit**：`aa49b52`
- **Production 分支**：`main`
- **测试基线**：212/212 PASS（v1.0 发布时）

### 7.2 系统架构

```
浏览器 AI 面板（source/js/ai-assistant.js）
        │
        ▼ POST /api/assistant
Cloudflare Pages Function（functions/api/assistant.js）
        │
        ├── validateRequest()             请求校验 + URL 规范化
        ├── security.js                   注入检测
        ├── cache / cloudflare-cache      缓存检查
        ├── search.js                     BM25 站内检索
        ├── prompt-builder.js             Prompt 构建
        ├── d1-budget-store.js            D1 预算预留
        ├── deepseek-provider.js          DeepSeek API 调用
        ├── d1-budget-store.js            D1 结算
        ├── source-builder.js             来源回查
        ├── cache / cloudflare-cache      缓存写入
        └── security.js                   响应过滤
```

### 7.3 核心模块

| 模块 | 文件 | 职责 |
|------|------|------|
| Worker 入口 | `functions/api/assistant.js` | Runtime 单例、请求分发 |
| 核心编排 | `functions/lib/assistant-core.js` | 检索→Prompt→预算→Provider→来源→缓存 |
| 请求校验 | `functions/lib/request-validation.js` | JSON 解析、字段校验、URL 规范化 |
| Prompt 构建 | `functions/lib/prompt-builder.js` | 系统/用户 Prompt、当前页面信息注入 |
| 来源回查 | `functions/lib/source-builder.js` | ID→知识库→去重→URL 安全校验 |
| 安全 | `functions/lib/security.js` | 注入检测、分隔符转义、响应过滤 |
| DeepSeek | `functions/lib/deepseek-provider.js` | API 调用、错误分类、超时控制 |
| Mock | `functions/lib/mock-provider.js` | 开发用，7 种行为模式 |
| D1 预算 | `functions/lib/d1-budget-store.js` | 原子状态机 |
| 内存预算 | `functions/lib/budget-store.js` | 开发 Mock |
| Cloudflare 缓存 | `functions/lib/cloudflare-cache.js` | SHA-256 键 + waitUntil |
| 内存缓存 | `functions/lib/cache.js` | 开发 Mock，TTL + 版本键 |

### 7.4 RAG 检索

- **知识库构建**：`scripts/build-knowledge-base.js` — Markdown → semantic chunking → `knowledge-base.json`
- **检索**：`scripts/search.js` — 中文 bigram 分词 + BM25 + 双评分体系
- **评分体系**：Document Metadata Scoring + Chunk Relevance Scoring + Tiered Page Context Boost

**核心维护与排障规则（强制）**：
1. **严禁手工修改构建产物**：严禁直接编辑 `knowledge-base.json` 或 `public/` 试图“修 RAG”或修复线上表现。所有知识库数据必须由 `source/_posts/` 文章源文件经 `npm run build` 自动生成。若知识库内容有误，必须定位源文章或 `scripts/build-knowledge-base.js` 并重新构建。
2. **端到端链路诊断优先，严禁盲调权重**：当回答不符合预期时，禁止直接盲目调节 BM25 权重或 Boost 常量。必须按标准链路自检定位问题所在层级：
   - Step 1: Query Intent（是否为 direct routing、列表查询还是普通问答）
   - Step 2: Page Context（`page_context.url` 规范化是否正确，是否触发 Tiered Boost 抑制）
   - Step 3: Chunk Recall（实际召回了哪些 chunk，分词与 score 是否合理）
   - Step 4: Reranking & Budget（排序截断与 token 预算是否丢弃了关键信息）
   - Step 5: Prompt Assembly（System/User Prompt 中 reference 组装是否完整准确）
   - Step 6: Model Generation（是否属于模型理解偏差而非检索失败）

### 7.5 关键架构决策

以下机制均来自实际调试中发现的真实问题，**不要轻易删除或绕过**：

1. **Metadata Direct Routing** — 确定性查询直接代码返回，不经过 LLM
2. **Current Page Context** — 前端传递 `page_context.url`，服务端解析当前页面信息注入 Prompt
3. **List Intent Boost Suppression** — 列表查询抑制 current-page boost
4. **Source Document Deduplication** — LLM 保留多 chunk，前端 Sources 按 document 去重
5. **Budget Lifecycle** — D1 原子状态机，不得破坏
6. **Cache Versioning** — 多维度 cache key，版本变更时 bump `AI_CACHE_VERSION`
7. **Prompt Injection Protection** — 输入转义 + 来源可信回查 + 响应内部字段过滤
8. **URL Validation** — Unicode/编码/协议防护，中文 URL 全路径匹配

### 7.6 Provider 规则

- DeepSeek API key 仅存在服务端环境变量（Secrets），前端绝对无法获取，严禁通过任何接口下发
- model 由环境变量控制，不要在代码中硬编码模型 allowlist
- 不要静默自动升级模型
- timeout 必须受控，AbortSignal 应正常工作

### 7.7 预算与缓存

- **预算状态机**：`reserved → dispatched → settled/rejected/unknown/cancelled`
- **缓存键维度**：question + currentUrl + knowledgeVersion + promptVersion + provider + model + thinkingEnabled + reasoningEffort + maxOutputTokens + providerConfigVersion + cacheVersion
- 修改回答行为/Prompt 语义时 bump `AI_CACHE_VERSION`
- 不要因单次测试异常就清空所有缓存

### 7.8 安全规则

- 禁止把用户完整请求内容写入生产日志
- 日志优先结构化：request_id、status、scope、elapsed_ms、cache_hit 等
- API Key 等敏感凭据绝对不进入生产日志或错误响应
- Debug endpoint `/api/debug/env` 仅开发/Preview，Production 应返回 404

### 7.9 测试规则

- **测试体系构成**：
  1. **Functions 后端全量测试**（`npm run test:4b`）：
     - 运行 11 个核心测试套件（当前 71 个测试用例，覆盖 API 入口、Core 编排、Provider、Diagnostics、D1 状态机与触发器、Cache API、Prompt 注入防护、前端组件与 Markdown 渲染）。
     - 本地运行依赖 Miniflare 虚拟环境和本地 SQLite D1 迁移。
  2. **BM25 站内检索与回归测试**（需独立运行）：
     - `node tests/search.test.js`：59 个检索基准与双评分机制测试。
     - `node tests/search-regression.test.js`：5 个检索边界与历史 Badcase 回归测试。
  3. **静态站点构建与路由校验**（`npm run build`）：
     - 必须依次完成 `build-knowledge-base.js`、`hexo generate`、`copy-routes.js`。
- **发布与修改要求**：
  - 任何改动后，先运行改动模块对应的针对性单测。
  - 准备提交前，必须确保 `npm run test:4b` 全绿、检索测试（59+5）全绿、`npm run build` 成功且 `git diff --check` 无空白异常。

### 7.10 前端规则

- 前端默认应真实调用 `POST /api/assistant`
- Demo/mock 模式必须显式开启
- 不要随意修改已稳定的 AI 助手 UI（面板、气泡、来源卡片、输入框）
- 后端修改不应顺带改前端，反之亦然

---

## 8. 文档管理规范

### 8.1 长期维护文档体系（“3+2”架构）

为避免工程文档过度膨胀并确保文档与代码事实高度一致，本项目采用精炼的“3+2”长期维护文档体系：

```
代码仓库 (E:\CODE\web\)
├── AGENTS.md                   # 本文件：项目总工程规范（Single Source of Truth）
└── CLAUDE.md                   # AI 极简启动引导与常用命令（~50 行）

工程文档 (E:\CODE\webdocs\)
├── AI助手维护与排障.md           # AI 助手完整技术参考、数据流、排障手册与高风险踩坑点
├── Cloudflare运维与安全.md       # Pages/D1 架构、凭据安全、Token 轮换 SOP 与生产部署排障
└── AI助手用户反馈与迭代记录.md    # 真实用户反馈收集、复现、修复状态跟踪与待办迭代
```

**维护原则**：
- 日常维护、Bug 修复、技术排查均以以上 5 份长期文档为准。
- `webdocs` 是独立于代码仓库的外部工程文档，默认不进入 `E:\CODE\web` 的 Git 提交。

### 8.2 历史文档归档状态

- `E:\CODE\web\docs/` 目录下的 20 份早期文档为阶段性开发草案与初版方案，已自然过时。其关键架构事实已完整沉淀至 `AGENTS.md` 与 `AI助手维护与排障.md`。
- `E:\CODE\webdocs/` 中原有的 8 份过程文档（包括《项目总览》、《架构设计》、《开发日志》、《测试记录》、《项目待办》、《交接单》、《项目规范》、《Codex踩坑记录》等）的技术要点已全部抽取合并至 `AI助手维护与排障.md`、`Cloudflare运维与安全.md` 及 `AGENTS.md`。
- 历史开发过程与草稿不再维护，禁止再依赖已废弃的旧文档做决策。

---

## 9. Git 规范

### 9.1 提交规范

**禁止默认使用 `git add .`**。

原因：本地曾存在或可能存在不应提交的文件（`.dev.vars`、`.wrangler/`、临时调试脚本、本地测试凭据等）。

提交时必须精确指定文件：
```bash
git add <file1> <file2> ...
```

执行 commit 前必须：
```bash
git status
git diff
git diff --cached --check
```

确认：
- 没有 secret
- 没有临时文件
- 没有与本任务无关的修改
- 没有误提交本地工具

**禁止行为**（除非用户明确要求）：
- `git reset --hard`
- `git clean -fd`
- force push
- 删除分支
- 重写历史
- 修改 main 历史

### 9.2 分支策略

```
main（Production 基线）
  └── feature/preview 分支 → 本地测试 → Preview 验证 → merge main
```

- 不要在 main 上直接开发
- 历史 Preview 分支 `codex/ai-assistant-preview` 已合并，不要默认复用
- 新阶段开发前根据用户要求决定：新建分支、新建 preview 分支、或复用已有分支

### 9.3 提交消息格式

```
<type>: <description>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

---

## 10. 修改代码时的行为要求

### 10.1 核心原则

1. **修改前先理解架构** — 阅读相关代码和文档，不要根据旧报告猜测当前实现
2. **先定位问题再修复** — 复现 → 收集事实 → 缩小范围 → 分析根因 → 最小方案 → 修改 → 测试
3. **不盲目修改** — 代码事实优先于历史文档；如果文档和代码冲突，指出冲突，不得静默猜测
4. **不随意重构** — 不要为了"顺便优化"而重构无关代码
5. **保留测试** — 修改后运行测试，确保已有功能不被破坏
6. **不删除历史功能** — 现有机制来自真实问题的调试，不要轻易删除

### 10.2 修改范围

- 只修改与任务直接相关的文件
- 不"顺便"改样式、重构、清理代码
- 如果任务只涉及后端 RAG，不应顺便改 UI
- 如果用户要求"只分析"，则不得修改任何代码

### 10.3 验证要求

**代码任务完成标准**：
- 根因明确
- 修改范围最小
- 无无关改动
- 相关测试通过
- 全量测试按需要通过
- `npm run build` 成功
- `git diff --check` 成功
- 未泄露 secret
- Preview 按需要验证
- 文档按需要同步

**文档任务完成标准**：
- 基于真实代码和真实历史
- 不编造
- 不删除重要历史
- 标记当前版本状态

### 10.4 任务完成后报告

必须报告：
- 修改的文件及原因
- 测试命令和结果
- Git 状态
- 剩余风险

不得把"应该通过"写成"已经通过"。

### 10.5 禁止行为

- 不默默扩大任务范围
- 不擅自 git commit / push / merge（需用户明确允许）
- 不在没有验证根因的情况下连续修改多个模块
- 不声称测试通过除非实际运行过
- 不声称 Cloudflare/DeepSeek/D1 线上行为正确除非有真实验证

---

## 11. 关键约束总结

1. **不要破坏 v1.0 基线**
2. **优先使用代码解决确定性任务，需要 NL 理解和内容综合时才用 RAG + LLM**
3. **小型个人网站不要过度设计**（不需要 1000+ 文档优化、多租户、多 Agent、复杂向量数据库）
4. **简单 > 可验证 > 可回退 > 可维护**
5. **安全第一** — API key 永不在前端、用户内容永不在日志、来源可信链不可绕过
