# 🚀 GitHub Pages 个人网站搭建完整教程（2025-2026）

> **适用对象**：零基础新手，想用 GitHub 免费托管自己的个人网站
>
> **预计耗时**：最快 5 分钟（纯 HTML）到 1-2 小时（静态站点生成器）
>
> **费用**：完全免费（含 HTTPS + 自定义域名支持）

---

## 目录

- [一、什么是 GitHub Pages？](#一什么是-github-pages)
- [二、前置准备](#二前置准备)
- [三、方案选择指南](#三方案选择指南)
- [四、方案 A：纯 HTML/CSS（最简单，5 分钟上线）](#四方案-a纯-htmlcss最简单5-分钟上线)
- [五、方案 B：Jekyll 静态站点生成器（推荐新手）](#五方案-bjekyll-静态站点生成器推荐新手)
- [六、方案 C：Hugo 静态站点生成器（速度最快）](#六方案-chugo-静态站点生成器速度最快)
- [七、方案 D：Hexo 静态站点生成器（Node.js 生态）](#七方案-dhexo-静态站点生成器nodejs-生态)
- [八、自定义域名绑定](#八自定义域名绑定)
- [九、GitHub Actions 自动部署](#九github-actions-自动部署)
- [十、常用 Markdown 语法速查](#十常用-markdown-语法速查)
- [十一、常见问题排查](#十一常见问题排查)
- [十二、推荐学习资源](#十二推荐学习资源)

---

## 一、什么是 GitHub Pages？

GitHub Pages 是 GitHub 提供的**免费静态网站托管服务**。你把网页文件（HTML/CSS/JS）推送到 GitHub 仓库，它就自动变成一个可公开访问的网站。

### 核心优势

| 优势 | 说明 |
|------|------|
| 💰 **完全免费** | 无广告、无流量限制、无需服务器 |
| 🔒 **免费 HTTPS** | 自动提供 SSL 证书，安全有保障 |
| 🔄 **版本控制** | Git 管理所有修改历史，可随时回滚 |
| 🚀 **推送即上线** | `git push` 后自动更新网站 |
| 🌐 **自定义域名** | 支持绑定你自己的域名 |

### 限制说明

| 项目 | 限制 |
|------|------|
| 仓库大小 | 建议不超过 1 GB |
| 网站大小 | 发布内容建议不超过 1 GB |
| 每小时带宽 | 100 GB（软限制） |
| 每小时构建 | 10 次（软限制） |
| **动态功能** | ❌ 不支持 PHP/Python/Node.js 后端 |
| **数据库** | ❌ 纯静态，需要第三方服务（如 Firebase） |

> 💡 **GitHub Pages 只支持静态网站**。如果你需要后端（用户登录、数据库等），建议用 Vercel、Netlify 的 Serverless 方案。

---

## 二、前置准备

### 2.1 必须准备

| 项目 | 说明 | 操作 |
|------|------|------|
| **GitHub 账号** | 托管代码和网站 | 去 [github.com](https://github.com) 免费注册 |
| **Git** | 版本控制工具 | [下载 Git](https://git-scm.com/downloads) 并安装 |
| **文本编辑器** | 编写代码 | 推荐 [VS Code](https://code.visualstudio.com/)（免费） |

### 2.2 Git 初始配置（安装后打开终端执行一次）

```bash
git config --global user.name "你的GitHub用户名"
git config --global user.email "你的GitHub注册邮箱"
```

验证是否配置成功：

```bash
git config --global --list
```

### 2.3 可选准备（按方案选择）

| 方案 | 额外需要 |
|------|----------|
| 纯 HTML | 无 |
| Jekyll | Ruby + Bundler（Windows 需额外步骤） |
| Hugo | Hugo 二进制文件（单文件，很简单） |
| Hexo | Node.js + npm |

---

## 三、方案选择指南

先搞清楚你的需求和背景，选对方案事半功倍：

| 你的情况 | 推荐方案 | 理由 |
|----------|----------|------|
| 🆕 完全零基础、只是想有一个个人主页 | **方案 A**：纯 HTML | 最简单，5 分钟上线 |
| 📝 想写博客、会一点命令行的 | **方案 B**：Jekyll | GitHub Pages 原生支持，主题最多 |
| ⚡ 追求构建速度、网站内容多 | **方案 C**：Hugo | 构建速度最快，单文件运行 |
| 🟢 熟悉 JavaScript / npm | **方案 D**：Hexo | Node.js 生态，中文社区好 |

### 四种方案对比

| | 纯 HTML | Jekyll | Hugo | Hexo |
|------|---------|--------|------|------|
| **上手难度** | ⭐ 极低 | ⭐⭐ 低 | ⭐⭐⭐ 中 | ⭐⭐ 低 |
| **构建速度** | 无构建 | 慢 | ⚡ 极快 | 快 |
| **主题数量** | 自己写 | 🔥 最多 | 多 | 多 |
| **博客功能** | ❌ 无 | ✅ 原生 | ✅ 需配置 | ✅ 丰富 |
| **GitHub Pages 集成** | ✅ 原生 | ✅ 原生 | 需 Actions | 需 Actions |
| **本地预览** | 直接打开 | `bundle exec jekyll serve` | `hugo server` | `hexo server` |
| **Windows 兼容** | ✅ 完美 | ⚠️ Ruby 安装较麻烦 | ✅ 单文件 | ✅ npm |

---

## 四、方案 A：纯 HTML/CSS（最简单，5 分钟上线）

> 🎯 **适合**：只是想有一个个人主页展示基本信息，不想学任何工具

### 4.1 创建仓库

1. 登录 [GitHub](https://github.com)，点击右上角 **"+"** → **"New repository"**
2. **仓库名称**必须填：`你的用户名.github.io`
   - 比如你的用户名是 `zhangsan`，就填 `zhangsan.github.io`
   - ⚠️ 这个名称**绝对不能写错**！
3. 选择 **Public**（公开，必须选这个才能免费）
4. 勾选 ✅ **"Add a README file"**
5. 点击 **"Create repository"**（绿色按钮）

### 4.2 添加首页

1. 在仓库页面，点击 **"Add file"** → **"Create new file"**
2. 文件名输入：`index.html`
3. 在编辑区粘贴以下代码：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>我的个人网站</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }

        .card {
            background: white;
            border-radius: 16px;
            padding: 40px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
        }

        .avatar {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background: #667eea;
            color: white;
            font-size: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
        }

        h1 { color: #333; margin-bottom: 8px; font-size: 28px; }
        .subtitle { color: #888; margin-bottom: 24px; font-size: 16px; }

        .links { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-bottom: 24px; }
        .links a {
            display: inline-block;
            padding: 10px 20px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 25px;
            font-size: 14px;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .links a:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4); }
        .links a.github { background: #333; }

        .about {
            text-align: left;
            color: #555;
            line-height: 1.8;
            font-size: 15px;
        }
        .about h2 { color: #333; margin-bottom: 10px; font-size: 20px; }

        footer { margin-top: 24px; color: #aaa; font-size: 13px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="avatar">👤</div>
        <h1>你好，我是 [你的名字]</h1>
        <p class="subtitle">欢迎来到我的个人网站 🎉</p>

        <div class="links">
            <a href="https://github.com/[你的用户名]" class="github">🐙 GitHub</a>
            <a href="mailto:your_email@example.com">📧 邮箱</a>
        </div>

        <div class="about">
            <h2>📌 关于我</h2>
            <ul>
                <li>📍 地点：[你的城市]</li>
                <li>💼 职业：[你的职业/专业]</li>
                <li>❤️ 兴趣：[你的兴趣爱好]</li>
                <li>📚 正在学习：[你正在学什么]</li>
            </ul>

            <h2>🛠️ 技能</h2>
            <p>[在这里列出你的技能]</p>
        </div>

        <footer>
            © 2025 [你的名字] · 由 GitHub Pages 免费托管
        </footer>
    </div>
</body>
</html>
```

4. 修改内容：
   - 把 `[你的名字]`、`[你的用户名]` 等替换成你自己的信息
   - 可以替换头像（把 `👤` 换成你的照片链接）

5. 点击 **"Commit changes..."**（绿色按钮）
6. 在弹出的对话框中直接点击 **"Commit changes"**

### 4.3 启用 GitHub Pages

1. 进入仓库页面 → 点击 **"Settings"**（顶部标签栏）
2. 左侧菜单点击 **"Pages"**
3. 在 "Branch" 下拉菜单中选择 **main**，文件夹选 **/ (root)**
4. 点击 **"Save"**

### 4.4 访问你的网站

等待 1-2 分钟后，在浏览器中打开：

```
https://你的用户名.github.io
```

🎉 **恭喜！你的个人网站已经上线了！**

### 4.5 后续更新网站

**方法一：直接在 GitHub 网页上编辑**

点击文件 → 点击 ✏️ 编辑图标 → 修改 → Commit changes

**方法二：用 Git 在本地编辑**

```bash
# 1. 克隆仓库到本地
git clone https://github.com/你的用户名/你的用户名.github.io.git
cd 你的用户名.github.io

# 2. 用 VS Code 打开编辑
code .

# 3. 编辑完成后提交
git add .
git commit -m "更新网站内容"
git push origin main
```

> 💡 **提示**：如果你觉得手写 HTML 太麻烦，下面三个方案用静态站点生成器可以让你用 Markdown 写文章，自动生成漂亮的网页。

---

## 五、方案 B：Jekyll 静态站点生成器（推荐新手）

> 🎯 **适合**：想写博客、想要丰富主题、不想手写 HTML
>
> ⚠️ **Windows 用户注意**：Jekyll 基于 Ruby，Windows 安装 Ruby 相对麻烦。如果遇到问题，考虑方案 C（Hugo）或方案 D（Hexo）

### 5.1 安装 Ruby 和 Jekyll

**Windows：**

1. 下载 [RubyInstaller](https://rubyinstaller.org/downloads/)（选择带 Devkit 的版本，如 `Ruby+Devkit 3.2.x (x64)`）
2. 安装时勾选 ✅ "Add Ruby executables to your PATH"
3. 安装完成后，在弹出的命令行窗口中按 Enter 安装 MSYS2
4. 打开新的终端，验证安装：

```bash
ruby --version
gem --version
```

5. 安装 Jekyll 和 Bundler：

```bash
gem install jekyll bundler
```

**macOS：**

```bash
# macOS 自带 Ruby，直接安装即可
gem install jekyll bundler
```

**Linux (Ubuntu/Debian)：**

```bash
sudo apt-get install ruby-full build-essential zlib1g-dev
echo '# Install Ruby Gems to ~/gems' >> ~/.bashrc
echo 'export GEM_HOME="$HOME/gems"' >> ~/.bashrc
echo 'export PATH="$HOME/gems/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
gem install jekyll bundler
```

### 5.2 创建 Jekyll 网站

```bash
# 创建新网站
jekyll new my-website
cd my-website

# 本地预览（打开 http://localhost:4000）
bundle exec jekyll serve
```

浏览器打开 `http://localhost:4000`，你应该看到默认的 Jekyll 网站。

### 5.3 Jekyll 项目结构

```
my-website/
├── _config.yml          # 📝 网站配置（最重要！）
├── _posts/              # 📄 博客文章（Markdown 文件）
├── _layouts/            # 🎨 页面布局模板
├── _includes/           # 🧩 可复用的 HTML 片段
├── _sass/               # 🎨 样式文件
├── assets/              # 📦 图片、CSS、JS
├── _site/               # 🏗️ 生成的静态网站（自动生成，不用管）
├── index.md             # 🏠 首页
├── about.md             # 👤 关于页
└── Gemfile              # 📦 Ruby 依赖
```

### 5.4 配置网站（编辑 `_config.yml`）

```yaml
title: 我的个人网站
email: your_email@example.com
description: >-
  欢迎来到我的个人网站！这里记录我的学习、思考和作品。
baseurl: ""                    # 如果是用户站点，保持为空
url: "https://你的用户名.github.io"
github_username: 你的用户名

# 主题（默认是 minima，可换）
theme: minima

# 社交媒体链接
minima:
  social_links:
    - { platform: github, user_url: "https://github.com/你的用户名" }
```

### 5.5 写一篇博客文章

在 `_posts/` 目录下创建一个文件，文件名格式为 `YYYY-MM-DD-标题.md`：

```markdown
---
layout: post
title: "我的第一篇文章"
date: 2025-01-15 10:00:00 +0800
categories: 随笔
---

这是我的第一篇博客文章！

## 二级标题

这是一段正文。你可以用 **加粗**、*斜体*、`代码` 等格式。

### 代码块

​```python
def hello():
    print("Hello, World!")
​```

> 这是一段引用文字。

- 列表项 1
- 列表项 2
- 列表项 3
```

> 📖 Markdown 语法详见[第十章](#十常用-markdown-语法速查)

### 5.6 更换 Jekyll 主题

**推荐免费主题：**

| 主题名 | 特点 | GitHub Stars |
|--------|------|-------------|
| **Minimal Mistakes** | 功能最全，博客/作品集/文档都行 | ~12.5k ⭐ |
| **Chirpy** | 博客功能丰富，暗色模式 | ~6k ⭐ |
| **Beautiful Jekyll** | 最简单快速上手 | ~5.4k ⭐ |
| **al-folio** | 学术/个人作品集风格 | ~10k ⭐ |
| **jekyllBear** | 极简文字风格，无追踪 | ~200 ⭐ |
| **Sleek** | 开发者风格，性能极致 | ~400 ⭐ |

**更换主题步骤（以 Minimal Mistakes 为例）：**

1. 打开 `Gemfile`，替换内容：

```ruby
source "https://rubygems.org"

gem "jekyll", "~> 4.3"
gem "minimal-mistakes-jekyll"
```

2. 打开 `_config.yml`，把 `theme:` 改为：

```yaml
theme: minimal-mistakes-jekyll
```

3. 更新依赖并预览：

```bash
bundle update
bundle exec jekyll serve
```

### 5.7 部署到 GitHub Pages

**方式一：直接推送源码（GitHub Actions 自动构建）**

在项目根目录创建 `.github/workflows/jekyll.yml`：

```yaml
name: Deploy Jekyll site to Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.2'
          bundler-cache: true
      - name: Setup Pages
        id: pages
        uses: actions/configure-pages@v5
      - name: Build with Jekyll
        run: bundle exec jekyll build --baseurl "${{ steps.pages.outputs.base_path }}"
        env:
          JEKYLL_ENV: production
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

**GitHub 设置：**

1. 仓库 → Settings → Pages → Source 选择 **"GitHub Actions"**
2. 仓库 → Settings → Actions → General → Workflow permissions 选择 **"Read and write permissions"**
3. 推送代码：

```bash
git add .
git commit -m "初始化 Jekyll 网站"
git branch -M main
git remote add origin https://github.com/你的用户名/你的用户名.github.io.git
git push -u origin main
```

推送后，GitHub Actions 会自动构建并部署，1-2 分钟后访问你的网站。

### 5.8 Jekyll 常用命令

```bash
bundle exec jekyll serve           # 本地预览（http://localhost:4000）
bundle exec jekyll serve --drafts   # 预览草稿
bundle exec jekyll build            # 生成静态网站到 _site/
```

---

## 六、方案 C：Hugo 静态站点生成器（速度最快）

> 🎯 **适合**：追求构建速度、网站内容计划很多、Windows 用户友好
>
> ⚡ **Hugo 的构建速度是所有静态站点生成器中最快的**——几百篇文章，毫秒级构建完成

### 6.1 安装 Hugo

**Windows（推荐用包管理器）：**

```powershell
# 方式一：用 winget（Windows 10/11 自带）
winget install Hugo.Hugo.Extended

# 方式二：用 Chocolatey
choco install hugo-extended

# 方式三：手动下载
# 去 https://github.com/gohugoio/hugo/releases
# 下载 hugo_extended_xxx_windows-amd64.zip
# 解压后将 hugo.exe 放到某个目录，添加到 PATH
```

**macOS：**

```bash
brew install hugo
```

**Linux：**

```bash
sudo apt install hugo   # Ubuntu/Debian
# 或
sudo pacman -S hugo     # Arch
```

验证安装：

```bash
hugo version
```

### 6.2 创建 Hugo 网站

```bash
# 创建新网站
hugo new site my-hugo-site
cd my-hugo-site

# 初始化 Git
git init
```

### 6.3 安装主题

Hugo 需要手动安装主题。推荐几个好用的：

| 主题名 | 特点 | 安装方式 |
|--------|------|----------|
| **PaperMod** | 极简、快速、暗色模式 | `git submodule add https://github.com/adityatelange/hugo-PaperMod.git themes/PaperMod` |
| **Stack** | 卡片式布局、图片丰富 | `git submodule add https://github.com/CaiJimmy/hugo-theme-stack.git themes/stack` |
| **LoveIt** | 功能丰富、中文友好 | `git submodule add https://github.com/dillonzq/LoveIt.git themes/LoveIt` |
| **Blowfish** | 现代化、Tailwind CSS | `git submodule add https://github.com/nunocoracao/blowfish.git themes/blowfish` |
| **Coder** | 极简开发者风格 | `git submodule add https://github.com/luizdepra/hugo-coder.git themes/coder` |

以 PaperMod 为例：

```bash
git init
git submodule add https://github.com/adityatelange/hugo-PaperMod.git themes/PaperMod
```

然后在 `hugo.toml`（或 `config.toml`）中添加：

```toml
baseURL = 'https://你的用户名.github.io/'
languageCode = 'zh-cn'
title = '我的个人网站'
theme = 'PaperMod'

[params]
  homeInfoParams = true
  description = "欢迎来到我的个人网站"

  # 社交链接
  [[params.socialIcons]]
    name = "github"
    url = "https://github.com/你的用户名"

# 菜单
[[menu.main]]
  name = "归档"
  url = "/archives"
  weight = 10

[[menu.main]]
  name = "标签"
  url = "/tags"
  weight = 20

[[menu.main]]
  name = "关于"
  url = "/about"
  weight = 30
```

### 6.4 写文章

```bash
# 创建一篇新文章
hugo new posts/my-first-post.md
```

编辑 `content/posts/my-first-post.md`：

```markdown
---
title: "我的第一篇文章"
date: 2025-01-15T10:00:00+08:00
draft: false
tags: ["随笔", "个人"]
categories: ["博客"]
---

这是我的第一篇 Hugo 博客文章！

## 二级标题

正文内容...
```

### 6.5 本地预览

```bash
hugo server -D
```

浏览器打开 `http://localhost:8080`，修改文件后自动刷新。

### 6.6 部署到 GitHub Pages

创建 `.github/workflows/hugo.yml`：

```yaml
name: Deploy Hugo site to Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Setup Hugo
        uses: peaceiris/actions-hugo@v2
        with:
          hugo-version: 'latest'
          extended: true

      - name: Setup Pages
        id: pages
        uses: actions/configure-pages@v5

      - name: Build with Hugo
        run: |
          hugo --gc --minify --baseURL "${{ steps.pages.outputs.base_url }}/"

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./public

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

GitHub 设置：

1. Settings → Pages → Source 选 **"GitHub Actions"**
2. Settings → Actions → General → 勾选 **"Read and write permissions"**
3. 推送代码

### 6.7 Hugo 常用命令

```bash
hugo server -D          # 本地预览（含草稿）
hugo                    # 构建网站到 public/
hugo new posts/xxx.md   # 新建文章
hugo new about.md       # 新建页面
```

---

## 七、方案 D：Hexo 静态站点生成器（Node.js 生态）

> 🎯 **适合**：熟悉 JavaScript/npm 的开发者、中文用户
>
> 🇨🇳 **Hexo 的中文社区和文档质量非常好**，是中文用户的首选

### 7.1 安装 Node.js 和 Hexo

1. 去 [nodejs.org](https://nodejs.org/) 下载 LTS 版本（推荐 v20.x）
2. 安装后验证：

```bash
node --version
npm --version
```

3. 全局安装 Hexo CLI：

```bash
npm install -g hexo-cli
```

### 7.2 创建 Hexo 网站

```bash
hexo init my-hexo-site
cd my-hexo-site
npm install
```

### 7.3 Hexo 项目结构

```
my-hexo-site/
├── _config.yml          # 📝 网站配置
├── package.json         # 📦 项目信息 + 依赖
├── scaffolds/           # 📄 文章模板
├── source/
│   └── _posts/          # 📄 博客文章（Markdown）
├── themes/              # 🎨 主题
└── public/              # 🏗️ 生成的静态网站
```

### 7.4 配置网站（编辑 `_config.yml`）

```yaml
title: 我的个人网站
subtitle: ''
description: '欢迎来到我的个人网站'
keywords:
author: 你的名字
language: zh-CN
timezone: 'Asia/Shanghai'

url: https://你的用户名.github.io
root: /
permalink: :year/:month/:day/:title/

# 主题
theme: landscape

# 部署配置
deploy:
  type: git
  repo: https://github.com/你的用户名/你的用户名.github.io.git
  branch: gh-pages
```

### 7.5 写文章

```bash
# 创建新文章
hexo new "我的第一篇文章"
```

编辑 `source/_posts/我的第一篇文章.md`：

```markdown
---
title: 我的第一篇文章
date: 2025-01-15 10:00:00
tags: [随笔, 个人]
categories: 博客
---

这是我的第一篇 Hexo 博客文章！

## 二级标题

正文内容...

<!-- more -->

<!-- more --> 后面的内容会在列表页显示"阅读全文"。
```

### 7.6 更换主题

推荐 Hexo 主题：

| 主题 | 特点 | 安装 |
|------|------|------|
| **NexT** | 最经典，功能全面，中文友好 | `npm install hexo-theme-next` |
| **Butterfly** | 美观、卡片式、功能丰富 | `npm install hexo-theme-butterfly` |
| **Fluid** | 简约现代，Material Design | `npm install hexo-theme-fluid` |
| **Icarus** | 经典两栏布局 | `npm install hexo-theme-icarus` |
| **Stellar** | 设计精美，适合作品集 | `npm install hexo-theme-stellar` |

以 Fluid 为例：

```bash
npm install hexo-theme-fluid
```

然后在 `_config.yml` 中修改：

```yaml
theme: fluid
```

### 7.7 本地预览

```bash
hexo server
# 或简写
hexo s
```

浏览器打开 `http://localhost:4000`

### 7.8 部署到 GitHub Pages

1. 安装部署插件：

```bash
npm install hexo-deployer-git --save
```

2. 在 `_config.yml` 中配置部署信息（见 7.4 节末尾的 deploy 配置）

3. 执行部署：

```bash
hexo clean    # 清理缓存
hexo generate # 生成静态文件
hexo deploy   # 部署到 GitHub Pages
# 或者一条命令搞定：
hexo clean && hexo deploy --generate
```

**进阶：用 GitHub Actions 自动部署**

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy Hexo to Pages

on:
  push:
    branches: ["main"]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Generate static files
        run: npx hexo generate

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./public
          publish_branch: gh-pages
```

GitHub 设置：Settings → Pages → Source 选 **"Deploy from a branch"**，分支选 `gh-pages`。

### 7.9 Hexo 常用命令

```bash
hexo new "文章标题"    # 新建文章
hexo new page "页面名" # 新建页面
hexo server           # 本地预览
hexo clean            # 清理缓存和生成文件
hexo generate         # 生成静态文件
hexo deploy           # 部署到远程
hexo s                # server 简写
hexo g                # generate 简写
hexo d                # deploy 简写
```

---

## 八、自定义域名绑定

如果你有自己的域名（如 `example.com`），可以绑定到 GitHub Pages。

### 8.1 在仓库中配置

**方式一：在 GitHub 网页上设置（推荐）**

1. 仓库 → Settings → Pages
2. 在 "Custom domain" 输入你的域名（如 `www.example.com` 或 `example.com`）
3. 点击 Save
4. 勾选 ✅ **"Enforce HTTPS"**（等待几分钟等证书生成）

**方式二：创建 CNAME 文件**

在仓库根目录创建一个名为 `CNAME` 的文件（无后缀），内容：

```
example.com
```

### 8.2 在域名注册商配置 DNS

去你的域名注册商（阿里云、腾讯云、Namecheap、Cloudflare 等）的 DNS 管理页面：

**如果你使用裸域名（example.com）：**

添加 **A 记录**：

| 类型 | 主机记录 | 记录值 |
|------|----------|--------|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |

**如果你使用 www 子域名（www.example.com）：**

添加 **CNAME 记录**：

| 类型 | 主机记录 | 记录值 |
|------|----------|--------|
| CNAME | www | 你的用户名.github.io |

**推荐做法**：两个都配置，然后在 GitHub Pages 设置里勾选 "Enforce HTTPS"。

### 8.3 DNS 生效时间

- DNS 修改后最长需要 **24-48 小时** 全球生效
- 通常几分钟到几小时就能生效
- 可以用 [whatsmydns.net](https://www.whatsmydns.net/) 检查 DNS 传播状态

---

## 九、GitHub Actions 自动部署

### 9.1 理解两个分支策略

很多静态站点生成器采用**双分支**策略：

```
main (或 master)  →  存放源代码（Markdown、配置、主题）
gh-pages          →  存放生成的静态文件（HTML/CSS/JS）
```

工作流程：

1. 你在 `main` 分支写 Markdown 文章
2. GitHub Actions 自动构建生成静态文件
3. 自动把静态文件推送到 `gh-pages` 分支
4. GitHub Pages 从 `gh-pages` 分支读取并展示网站

### 9.2 通用 GitHub Actions 配置清单

不管用哪种方案，都需要检查以下 GitHub 设置：

| 设置 | 位置 | 配置 |
|------|------|------|
| Pages Source | Settings → Pages | 选 "GitHub Actions" 或 "Deploy from a branch" → `gh-pages` |
| 读写权限 | Settings → Actions → General | Workflow permissions → **"Read and write permissions"** ✅ |
| 自定义域名 | Settings → Pages | 填入域名，勾选 Enforce HTTPS |

### 9.3 手动触发部署

在仓库页面的 **"Actions"** 标签 → 选择你的 workflow → **"Run workflow"** 按钮，可以手动触发部署。

---

## 十、常用 Markdown 语法速查

所有静态站点生成器都用 Markdown 写文章，以下是常用语法：

### 10.1 基础语法

```markdown
# 一级标题
## 二级标题
### 三级标题

**加粗文字**
*斜体文字*
~~删除线~~

[链接文字](https://example.com)
![图片描述](image.png)

> 引用文字

- 无序列表项 1
- 无序列表项 2

1. 有序列表项 1
2. 有序列表项 2

---    ← 分隔线

`行内代码`
```

### 10.2 代码块

````markdown
```python
def hello():
    print("Hello, World!")
```

```javascript
console.log("Hello, World!");
```

```bash
echo "Hello, World!"
```
````

> 把 `python` 换成对应语言名称即可获得语法高亮

### 10.3 表格

```markdown
| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 内容 | 内容 | 内容 |
| 内容 | 内容 | 内容 |
```

### 10.4 任务列表

```markdown
- [x] 已完成的任务
- [ ] 待完成的任务
- [ ] 另一个待完成的任务
```

### 10.5 插入图片

```markdown
# 方式一：网络图片
![描述](https://example.com/image.png)

# 方式二：本地图片（放在项目的 assets/images/ 目录）
![描述](/assets/images/photo.jpg)
```

---

## 十一、常见问题排查

### ❌ 网站显示 404

**原因排查：**

1. **仓库名对不对？** → 必须是 `用户名.github.io`（用户名大小写要和你的 GitHub 用户名**完全一致**）
2. **仓库是 Public 吗？** → 免费用户必须公开
3. **Pages 设置了吗？** → Settings → Pages 确认分支选对了
4. **分支名对不对？** → 现在是 `main`（不是 `master`）
5. **等了多久？** → 第一次部署可能需要 1-5 分钟

### ❌ 修改后网站不更新

1. **等待** → GitHub Pages 部署需要 1-5 分钟
2. **强制刷新** → 浏览器按 `Ctrl + F5`（不清缓存）
3. **检查 Actions** → 仓库 Actions 标签页看看是否有报错
4. **清除浏览器缓存** → 或者用隐私模式/无痕模式打开

### ❌ 自定义域名不生效

1. DNS 记录添加正确吗？→ 用 [whatsmydns.net](https://www.whatsmydns.net/) 检查
2. 等够了吗？→ DNS 最长需 48 小时
3. CNAME 文件存在吗？→ 检查仓库根目录
4. HTTPS Enforce 勾选了吗？→ Settings → Pages → Enforce HTTPS

### ❌ 图片无法显示

1. **路径问题** → Jekyll/Hugo/Hexo 的图片路径规则不同
   - Jekyll：图片放在 `assets/images/`，引用用 `/assets/images/xxx.png`
   - Hugo：图片放在 `static/images/`，引用用 `/images/xxx.png`
   - Hexo：图片放在 `source/images/`，引用用 `/images/xxx.png`
2. **大小写** → 注意！GitHub Pages 的 Linux 服务器区分大小写，`Image.png` ≠ `image.png`

### ❌ Jekyll 构建报错

```bash
# 常见解决方案：
bundle update              # 更新依赖
bundle exec jekyll serve --trace  # 查看详细错误
```

### ❌ Windows 上 Jekyll 安装失败

如果 Ruby 安装遇到问题，**强烈建议换方案 C（Hugo）或方案 D（Hexo）**，它们在 Windows 上的体验好很多：

- Hugo：下载一个 `.exe` 就行，零依赖
- Windows 安装 Ruby 常见问题：缺少 MSYS2、PATH 未配置、SSL 证书错误

---

## 十二、推荐学习资源

### 官方文档

| 资源 | 链接 |
|------|------|
| GitHub Pages 官方文档 | https://docs.github.com/pages |
| Jekyll 官方文档 | https://jekyllrb.com/docs/ |
| Hugo 官方文档 | https://gohugo.io/documentation/ |
| Hexo 官方文档 | https://hexo.io/zh-cn/docs/ |

### 免费学习平台

| 资源 | 说明 |
|------|------|
| [freeCodeCamp](https://www.freecodecamp.org/) | 免费学 HTML/CSS/JS |
| [MDN Web Docs](https://developer.mozilla.org/zh-CN/) | 最权威的 Web 技术文档 |
| [W3Schools](https://www.w3schools.com/) | 交互式学习 HTML/CSS |

### 免费替代平台（如果 GitHub Pages 不够用）

| 平台 | 特点 | 适合场景 |
|------|------|----------|
| **Vercel** | 自动部署、Serverless 函数 | Next.js/React 项目 |
| **Netlify** | 拖拽部署、表单功能 | 需要表单和后端逻辑 |
| **Cloudflare Pages** | 全球 CDN、速度极快 | 追求访问速度 |
| **GitLab Pages** | 类似 GitHub Pages | 代码托管在 GitLab |

### 推荐图床（免费存图片）

| 图床 | 特点 |
|------|------|
| [GitHub 仓库](https://github.com) | 把图片也放在网站仓库里 |
| [Cloudflare R2](https://www.cloudflare.com/) | 10GB 免费存储 |
| [imgur](https://imgur.com/) | 免费图片托管 |

---

## 🎯 下一步行动计划

根据你的选择，按以下步骤行动：

### 如果你选了方案 A（纯 HTML）
```
1. ✅ 创建 用户名.github.io 仓库
2. ✅ 添加 index.html
3. ✅ 启用 GitHub Pages
4. ✅ 访问你的网站！
```

### 如果你选了方案 B/C/D（静态站点生成器）
```
1. ✅ 安装对应工具
2. ✅ 创建项目并本地预览
3. ✅ 选择一个主题并配置
4. ✅ 写第一篇测试文章
5. ✅ 推送到 GitHub
6. ✅ 配置 GitHub Actions
7. ✅ 验证网站上线
8. ✅（可选）绑定自定义域名
```

---

> 💡 **最后的建议**：先选方案 A 做一个最简单的网页上线，5 分钟就能看到成果增强信心。之后再慢慢研究静态站点生成器，一步一步来。

---

*教程最后更新：2025 年 1 月*
