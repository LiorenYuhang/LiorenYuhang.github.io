# CLAUDE.md — AI 协作入口指引

> 本项目为个人技术网站（Hexo + NexT + Cloudflare Pages + 站内 AI 助手）。
> AI Agent 进入项目执行任何任务前，请先查阅对应规范。

## 1. 唯一总工程规范 (Single Source of Truth)

开始任何代码修改、博客维护或部署前，必须阅读：
- [`AGENTS.md`](file:///E:/CODE/web/AGENTS.md) — 项目总工程规范，包含架构、目录树、代码与 Git 规范、安全约束与测试要求。

## 2. 核心长期工程文档体系 (3 份外部文档)

外部工程文档位于 `E:\CODE\webdocs`（独立于代码仓库，不执行 git 操作）：
- **AI 助手架构、数据流与排障**：[`webdocs/AI助手维护与排障.md`](file:///E:/CODE/webdocs/AI助手维护与排障.md)
  涵盖端到端请求链路、BM25 双评分、D1 预算状态机、11 类踩坑点与 10 步标准排障自检清单。
- **Cloudflare 运维与凭据安全**：[`webdocs/Cloudflare运维与安全.md`](file:///E:/CODE/webdocs/Cloudflare运维与安全.md)
  涵盖 Pages Git 部署、D1 绑定、环境变量/Secrets、API Token 安全轮换 SOP。
- **线上用户反馈与 Bug 迭代**：[`webdocs/AI助手用户反馈与迭代记录.md`](file:///E:/CODE/webdocs/AI助手用户反馈与迭代记录.md)
  涵盖真实线上反馈追踪、复现分析与修复状态闭环清单。

## 3. 常用开发与测试命令

```bash
npm run build                         # 构建知识库 + Hexo 静态站点 + 复制路由
npm run test:4b                       # Functions 后端测试体系（11 套件，71 用例）
node tests/search.test.js             # BM25 站内检索与双评分基准测试（59 用例）
node tests/search-regression.test.js  # 检索边界与 Badcase 回归测试（5 用例）
npx hexo server                       # 本地 Hexo 预览服务
```

## 4. 黄金工作原则

1. **代码事实优先**：若旧文档与代码冲突，以代码为准；严禁直接修改构建产物（`knowledge-base.json`、`public/`）。
2. **最小修改范围**：专注任务本身，严禁顺便重构无关模块；API Keys 绝不下发客户端与生产日志。
3. **验证闭环**：提交前确保 `npm run test:4b` 全绿、检索单测全绿、`npm run build` 成功且 `git diff --check` 无空白异常。
