---
title: 从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程
date: 2026-06-10 18:03:07
tags: [教程, Hexo, GitHub Pages]
categories: 教程
description: 从零开始，一步步教你用 Hexo + NexT + GitHub Pages 搭建免费个人网站
top_img:
cover:
---

## 你好，世界！

这是一句工科生熟悉的不能再熟悉的话 

我用 **Hexo + NexT** 搭建了一个自己的个人网站，通过 GitHub Pages 和 Netlify 双线托管。

## 为什么要建个人网站？

- 📝 记录学习和成长
- 🚀 展示项目和作品
- 🌐 拥有自己的互联网角落

## 搭建过程

### 1. 环境准备

首先你需要安装：

| 工具 | 下载 |
|------|------|
| **Node.js**（LTS 版） | https://nodejs.org/ |
| **Git** | https://git-scm.com/downloads |
| **VS Code**（推荐编辑器） | https://code.visualstudio.com/ |

安装后验证：

```bash
node --version
git --version
```

配置 Git 用户名和邮箱：

```bash
git config --global user.name "你的GitHub用户名"
git config --global user.email "你的邮箱"
```

### 2. 安装 Hexo

```bash
npm install -g hexo-cli
```

### 3. 创建项目

```bash
cd 你的项目目录
hexo init .
npm install
```

安装必备插件：

```bash
npm install hexo-generator-search   # 本地搜索
npm install hexo-deployer-git       # 一键部署
npm install hexo-wordcount          # 字数统计
```

### 4. 选择主题

我选了 **NexT Gemini**——工科极简风，默认黑白配色就很好看，也支持暗色模式。

```bash
npm install hexo-theme-next
```

然后在 `_config.yml` 中设置：

```yaml
theme: next
```

创建 `_config.next.yml` 放入主题配置。NexT 提供四种方案：Muse / Mist / Pisces / **Gemini**（我选的卡片式布局）。

### 5. 写文章

```bash
npx hexo new "文章标题"
```

Markdown 文件生成在 `source/_posts/` 下，直接编辑即可。本地预览：

```bash
npx hexo server
# 浏览器打开 http://localhost:4000
```

### 6. 部署上线

**创建 GitHub 仓库**：[github.com/new](https://github.com/new)，名字必须是 `你的用户名.github.io`，选择 Public。

> ⚠️ 注意：Add README、.gitignore、License 三个选项**全部不勾**，否则推送会冲突。

**推送到 GitHub：**

```bash
git init
git add -A
git commit -m "初始化网站"
git branch -M main
git remote add origin https://github.com/你的用户名/你的用户名.github.io.git
git push -u origin main
```

**GitHub Pages 部署**（自动）——创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: write
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - run: npm ci
      - run: npx hexo generate
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./public
          publish_branch: gh-pages
```

然后去 GitHub 仓库 → Settings → Pages → Source 选 `gh-pages` 分支 → Save。1 分钟后网站就在 `https://你的用户名.github.io` 上线了。

**Netlify 双线托管**（可选，获得短域名）：

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

得到一个 `xxx.netlify.app` 短域名，在后台可改名。

### 7. 日常使用

```bash
npx hexo new "新文章"                          # 创建
# 编辑 source/_posts/新文章.md
npx hexo server                                 # 本地预览
git add -A && git commit -m "新文章" && git push # 发布
```

推送后 GitHub Actions 和 Netlify 自动构建部署，全程免费。

> 这只是开始，后面会慢慢完善网站内容和样式。一个机器人方向的博士生的科研。



---

*以上内容与网站由 Claude Code + DeepSeek 辅助生成*
