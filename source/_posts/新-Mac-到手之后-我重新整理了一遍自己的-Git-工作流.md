---
title: 新 Mac 到手之后，我重新整理了一遍自己的 Git 工作流
date: 2026-09-27 20:27:39
tags: [Git, GitHub, macOS, Windows, Ubuntu, SSH, 跨平台开发]
categories: 网站开发
description: 借第一台 Mac 加入开发环境的机会，重新整理 Windows、macOS 与 Ubuntu 之间长期使用的 Git/GitHub 工作流，以及多设备同步、SSH、环境重建、冲突与分支管理中的工程实践。
---

## 引言

最近，我的开发环境里多了一台 MacBook Neo。

买它最初并不是为了专门写代码，也不是原有的 Windows 设备无法开发，而是我需要一台更轻、更便携，适合随身携带和出差的笔记本，用来处理文档、网页、PPT、PDF、远程连接等日常工作。

购买前，我对比过不同轻薄本的重量、尺寸、屏幕、续航、接口、性能、存储、价格和实际使用场景，最后也去线下体验了一遍。综合参数和实际感受后，我选择了 MacBook Neo。这篇文章不是它的硬件测评；真正与本文有关的是，我也因此第一次正式进入了 macOS 生态。

过去我一直听说 macOS 基于 Unix，在终端、Shell 和开发工具链方面与编程、工程开发衔接得比较自然。拿到机器后，Git、SSH、Node.js 和 Hexo 很快跑通，我也就自然产生了一个想法：既然已经有了一台 Unix-like 的移动设备，除了日常办公和远程连接，也可以把个人网站的一部分开发与维护迁移到 Mac 上。

也正因为这次迁移，我重新审视了长期以来一直在使用、却没有专门完整整理过的 Git 工作流。

<!-- more -->

---

## Part I：我的跨平台 Git 工作流

### 1. 为什么现在重新整理 Git

在 Mac 加入之前，Windows 一直是我的绝对主力；Ubuntu 则分别存在于 PC 双系统和机器人 NUC 中，承担 Linux 科研开发与实机控制。Git、GitHub、SSH、commit、push、pull 都不是这次才开始接触的新工具。

Mac 的加入改变的不是我是否使用 Git，而是整个工作流的形状：网站维护多了一个移动节点，Windows、macOS 和两种 Ubuntu 环境第一次形成了一套更完整的跨平台开发体系。这篇文章因此不是 Git 入门，也不是 Mac 配置大全，而是一次阶段性的工作流整理。

### 2. 我的实际开发环境

三套系统并不是地位相同的三台电脑，也不是共同维护同一个项目。Windows 仍然是主力，macOS 和 Ubuntu 分别承担移动与科研场景；其中 Ubuntu 又有 PC 双系统和 NUC 两种实际形态。

| 环境 | 定位 | 主要任务 |
| --- | --- | --- |
| Windows | 主力环境 | 网站开发、文档与日常工作、MATLAB / Simulink、其他工程开发 |
| macOS | 移动开发终端 | 便携办公、出差与随身使用、macOS 生态体验、个人网站开发与维护 |
| Ubuntu PC | Linux 科研环境 | 深度学习、强化学习、对 Linux 环境要求更高的科研开发 |
| Ubuntu NUC | 博士课题实机环境 | ROS 2、Stewart / 6PUS、传感器、电机、控制算法与真实机器人实验 |

它们之间的关系更接近下面这样：

```text
Windows（主力）
├── 网站 / MATLAB / Simulink
├── 文档与日常工程工作
└── Git / GitHub
        │
        ├──────── macOS
        │         ├── 移动办公 / 出差
        │         ├── macOS 生态体验
        │         └── 网站维护 + Git / GitHub
        │
        └──────── Ubuntu
                  ├── PC 双系统：深度学习 / 强化学习 / Linux 科研开发
                  ├── NUC：ROS 2 / Stewart / 6PUS / 实机控制
                  └── 科研项目 + Git / GitHub
```

网站项目主要在 Windows 与 macOS 之间延续；PC 双系统 Ubuntu 管理 Linux 科研项目，Ubuntu NUC 则管理 ROS 2 与机器人实机代码。深度学习和强化学习属于 PC 双系统 Ubuntu 的主要任务，不是 NUC 的主要职责。

GitHub 在这里不是让所有设备共享同一工作目录的网络硬盘，而是多个远程仓库的集合。不同项目对应不同 Repository，每台设备都有自己的本地仓库、工作区和环境；Git 负责记录版本，并在需要时交换提交历史。

### 3. 我的 Git 工作流其实可以压缩成一条线

无论在哪个系统，也无论修改由我还是 Agent 完成，主线都可以压缩成：

```text
Pull
  ↓
Define Task
  ↓
Human / Agent Develop
  ↓
Diff
  ↓
Build / Test
  ↓
Review
  ↓
Commit
  ↓
Push
```

开始工作前先同步并确认状态；随后定义一个边界清楚的任务，由我或 Agent 完成修改；再用 diff、构建和测试检查结果。Review 通过后，修改才成为一个有语义的 commit，最后再 push 到远程仓库。

这里最重要的不是记住命令顺序，而是把“修改文件”“验证结果”“确认版本”“共享历史”分成几个明确步骤。

### 4. Agent 已经是这套工作流的一部分

以前更多是我自己修改、测试，再 commit 和 push。现在，不少网站维护任务已经变成：我先定义目标和边界，Agent 阅读仓库、执行修改并完成初步验证，我再检查 diff 与最终页面，确认后决定是否 commit、push。

```text
我定义任务 → Agent 执行 → Agent 验证 → 我 Review → Commit / Push
```

Agent 并没有让 Git 变得不重要。恰恰相反，Agent 修改得越多，diff、branch、commit 和清晰的版本边界就越重要。具体如何约束 Agent、如何划分修改与发布权限，我会在 Part IV 再展开。

> 如果只是想了解我现在如何在 Windows、macOS、Ubuntu 与 GitHub 之间组织开发，以及 Agent 怎样进入这套流程，那么读到这里已经足够了。
>
> 后面的部分会继续拆开这条主线：一台新设备怎样可靠地接入已有项目，Windows、macOS、Ubuntu 的外围环境有哪些实际差异，以及同步、提交、仓库卫生、冲突、分支和 Agent 权限为什么能够支撑这套工作方式。

---

## Part II：让一台新设备真正加入开发体系

拿到一台新 Mac 或 PC 后，完成 `git clone` 并不等于它已经加入开发体系。对我来说，真正的接入至少包括身份、仓库、环境和验证四层。

### 1. 身份：Git 与 SSH

先确认 Git 已经可用：

```bash
git --version
```

然后为这台设备设置提交身份。这里使用通用占位符，不应把私人邮箱写进公开文章：

```bash
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

这两项决定提交记录里的作者信息，但不等同于 GitHub 登录凭据。真正访问远程仓库时，我使用每台设备各自的 SSH Key，而不会把同一份私钥复制到 Windows、Mac 和 Ubuntu。

将新设备的公钥添加到 GitHub 后，可以验证认证链路：

```bash
ssh -T git@github.com
```

认证成功时，GitHub 通常会显示类似提示：

```text
Hi USERNAME! You've successfully authenticated, but GitHub does not provide shell access.
```

GitHub 官方说明，这条测试命令即使认证成功，也可能正常以退出码 1 结束，因为 GitHub 不提供交互式 shell。因此应主要确认提示中包含 `successfully authenticated` 和正确的 GitHub 用户名，而不能只看退出码是否为 0。

独立密钥让每台设备可以单独授权和撤销，也避免私钥在设备间流转。通过 SSH 访问仓库时，不需要反复输入 GitHub 账户凭据；如果私钥设置了 passphrase，是否需要再次输入则取决于本机 ssh-agent、Keychain 等配置。

### 2. 仓库：Clone、Remote 与 Branch

SSH 验证完成后再 clone 仓库：

```bash
git clone git@github.com:username/repository.git
cd repository
```

进入仓库后，我会先确认远程地址、当前分支和工作区状态：

```bash
git remote -v
git branch --show-current
git status
```

这一步能同时确认：我进入的是正确仓库，连接的是预期 remote，并且处在准备工作的分支上。源码到达电脑，只能证明仓库已经 clone；它并不代表依赖、运行时和构建链路已经建立。

### 3. 环境：依赖应该重建，而不是复制

网站仓库 clone 完成后，需要安装 Node.js 与 npm，再依据锁文件重建依赖：

```bash
node --version
npm --version
npm ci
```

对于当前这个 Hexo 网站，验证链路是：

```bash
npm run build
npm run test:4b
node tests/search.test.js
node tests/search-regression.test.js
npm run server
```

能够安装依赖、完成 build、通过项目已有测试并在本地 preview，才说明新设备真正接入了项目。

从 Windows 切到 Mac 时，我不会复制 Windows 的 `node_modules`。`package.json` 描述需要什么，`package-lock.json` 固定解析后的依赖版本，`npm ci` 根据锁文件重新安装。ROS 2 项目也是同样的原则：源码、接口定义、配置、launch 文件和依赖声明应该进入版本控制；编译产物、缓存、日志及设备相关临时文件不应靠 Git 搬运。

代码同步与环境重建是两个问题：Git 保证源码、配置和版本历史连续；npm、colcon、rosdep 等包管理或构建工具负责恢复运行环境；驱动、系统库、硬件权限和本机密钥仍然属于设备自身。

### 4. Windows、macOS 与 Ubuntu 的外围差异

Git 自身的仓库、分支、提交、工作区和暂存区模型不会因为操作系统变化。下面这些核心命令在三套系统上没有本质区别：

```bash
git status
git pull
git diff
git add path/to/file
git commit -m "type: describe the change"
git push
git log --oneline
git branch
```

真正需要适应的是外围环境。

**路径与 Shell**

Windows 常见路径是 `E:\Code\project`，macOS 是 `/Users/username/Code/project`，Ubuntu 是 `/home/username/project`。Windows 常用 PowerShell 或 Git Bash，macOS 默认使用 zsh，Ubuntu 常见 bash 或 zsh。包含路径、环境变量、管道或系统工具的脚本不一定能直接跨平台运行。

**安装方式与 PATH**

Windows 可以使用安装程序或 `winget`，macOS 常用 Homebrew，Ubuntu 常用 `apt`。安装完成不代表当前 Shell 一定能找到程序；遇到“已经安装但命令不存在”时，我会先检查版本命令和 PATH。

**权限与大小写**

Unix-like 系统会直接暴露可执行权限问题，脚本缺少执行位时可能需要：

```bash
chmod +x scripts/example.sh
```

某些默认文件系统对大小写不敏感，但 Linux 通常严格区分 `Config.js` 和 `config.js`。只修改文件名大小写时，应该明确让 Git 记录重命名，而不要假设所有系统都会得到相同结果。

**换行符**

Windows 常见 CRLF，macOS 与 Ubuntu 常见 LF。`core.autocrlf` 可以参与转换，但我不会在不了解仓库约定时盲目修改全局配置。如果项目确实需要统一规则，更稳定的方式是通过仓库级 `.gitattributes` 明确约定。

### 5. 新设备接入检查清单

最后，我会用一份短清单判断新设备是否已经可靠接入：

1. Git、运行时和构建工具可用，提交身份与独立 SSH Key 正确；
2. 仓库来自正确 remote，当前分支、工作区和跟踪关系清楚；
3. 可以依据锁文件或依赖声明重建环境，而不是复制旧机器的产物；
4. build、test、preview 真正跑通；
5. `.gitignore` 能挡住系统文件、缓存、构建产物和 secret。

---

## Part III：支撑多设备开发的 Git 工程实践

设备接入以后，真正决定工作流能否长期稳定的，是怎样同步版本、保持仓库干净，以及在多设备并行时隔离风险。

### 1. 同步与版本：Pull、Push 和 Commit

我日常开始工作时会先确认位置和状态，再决定是否同步：

```bash
git status -sb
git pull
```

`git status -sb` 的意义之一，就是先确认当前分支和工作区。如果存在未提交修改，应先确认、提交、暂存或妥善处理，再决定是否执行 `git pull`，而不是机械地继续下一条命令。

开发过程中，我会持续检查实际差异：

```bash
git diff
git status
```

完成一个逻辑修改后，再精确暂存并检查即将提交的内容：

```bash
git add path/to/file
git diff --cached
git commit -m "docs: document cross-platform Git workflow"
git push
```

我更倾向于精确指定文件，而不是习惯性执行 `git add .`。push 之前，构建和测试应该已经完成。

以网站项目为例，一次 Windows 与 Mac 的接力可能是：

```text
Windows：修改 → test → commit → push
                         │
                         ▼
                 GitHub Repository
                         │
                         ▼
macOS：           pull → 继续修改 → test → commit → push
                                                     │
                                                     ▼
Windows：                                          pull
```

Push 与 Pull 传递的不是一包“最新版文件”，而是一串有父子关系、有作者、有时间、有说明的提交。Mac pull 下来的不仅是 Windows 修改后的结果，也包括这些结果如何一步步形成。

同样，commit 也不是 Ctrl + S。文件保存只表示编辑器把当前内容写到磁盘；commit 则是在版本历史中建立一个有语义、可定位、可比较的项目状态。我的原则是：一个 commit 对应一个相对完整的逻辑修改，不混入无关变化，message 清楚说明修改目的，提交和 push 前都检查状态。

### 2. 仓库卫生：检查、`.gitignore` 与可重建环境

相比记住几十条命令，我更依赖少量高频检查：

```bash
# 工作区与分支状态
git status -sb

# 尚未暂存与已经暂存的差异
git diff
git diff --cached

# 简洁历史、分支与远程地址
git log --oneline --decorate --graph -n 15
git branch
git remote -v

# 当前仓库根目录
git rev-parse --show-toplevel
```

这些命令共同回答一个问题：我在哪个仓库、哪个分支，改了什么，即将提交什么，历史和 remote 又是什么。

当前网站仓库已经明确忽略了这些典型内容：

```gitignore
.DS_Store
Thumbs.db
node_modules/
public/
.env
.env.*
.wrangler/
```

`.DS_Store` 来自 macOS，`Thumbs.db` 常见于 Windows；`node_modules/` 和 `public/` 分别属于可重建依赖与构建输出；`.env` 一类文件还可能包含敏感配置。让它们进入仓库，只会给其他系统制造无关 diff，甚至带来凭据泄漏风险。

ROS 2 工作区通常还会排除下面这些构建目录：

```gitignore
build/
install/
log/
```

但 `.gitignore` 不能脱离具体仓库照抄。判断标准始终是：它是不是源码、能否重建、是否包含本机状态或敏感信息。仓库应该保留源码、配置与依赖声明，让包管理器和构建系统恢复环境，而不是把某台设备的缓存和产物带到下一台机器。

### 3. 多设备并行：Conflict 与 Branch

假设 Windows 和 Mac 都从提交 A 开始，并且修改了同一段内容：

```text
        ┌── B（Windows 修改并先 push）
A ──────┤
        └── C（macOS 基于旧版本继续修改）
```

当 Mac 随后尝试整合远程的 B 时，Git 可以知道两边都改了，却未必能判断哪一份内容才符合我的真实意图。冲突不是 Git 失效，而是它拒绝替我做一个信息不足的决定。

我降低冲突概率的方法很朴素：开始工作前先 pull；不在多台设备上长期保留未同步修改；一个任务尽量在一个明确分支或主要设备上完成；完成逻辑单元后及时 commit 和 push；避免无意义的全文件格式化和批量换行变化。

Branch 在这里用于隔离风险，而不是增加流程感。当前网站以 `main` 作为生产基线，并没有采用复杂 Git Flow。常见命名可以保持简单：

```text
main          稳定基线
feature/*     相对独立的新功能或内容
fix/*         明确的问题修复
experiment/*  尚未确定是否保留的实验
```

小而明确、可以立即验证的修改不一定需要复杂分支层级；独立功能、高风险变更、较长周期任务、Agent 批量修改或实验性方案，则更适合放进单独分支。个人项目在需要隔离风险时同样适合使用分支，但不需要为了“看起来专业”而复制一套与项目规模不匹配的流程。

---

## Part IV：Agent 时代，我为什么反而更依赖 Git

Agent 辅助开发已经逐渐成为我的日常工作方式。但它带来的并不是“Git 可以省略”，而是修改速度提高以后，版本边界和人工确认变得更加重要。

### 1. 从 Human Develop 到 Human / Agent Develop

现在，我的不少网站维护工作已经不是自己逐行手动修改。更多时候，我先提出目标，再由 ChatGPT、Codex 或其他具备仓库操作能力的 coding agent 阅读项目、分析现有结构、修改文件并运行验证，最后由我检查结果。

```text
我定义任务
  ↓
Agent 阅读仓库
  ↓
Agent 修改
  ↓
Build / Test
  ↓
Diff / Status
  ↓
人工 Review
  ↓
Commit / Push
```

无论文件由我还是 Agent 修改，后半段的工程验证逻辑基本一致。

### 2. 我如何给 Agent 定义任务边界

我通常不会只说一句“帮我改一下网站”，而是尽量给出当前仓库、分支、任务、允许与禁止修改的范围、已冻结内容、构建与测试命令，以及是否允许 commit、push。一个简化后的任务约束可能是：

```text
任务：新增一篇文章

允许：
- 修改指定文章

禁止：
- 修改主题、导航和依赖
- 修改其他文章

验证：
- git diff --check
- npm run build
- 运行已有测试
- git status

不要 commit
不要 push
```

重点不是 Prompt 写得多复杂，而是让任务边界、禁止范围和完成标准都可以检查。Agent 在这里是受到仓库现状、Git 和工程规则约束的开发执行者。

### 3. 修改权限不等于发布权限

Agent 可以阅读和修改代码、新建文件、执行命令、运行 build 和 test、查看 diff、分析错误，但 Modify、Commit 和 Push 是三层不同的权限。

```text
Agent Modify
  ↓
Agent Verify
  ↓
Human Review
  ↓
Commit
  ↓
Push
```

在明确授权的自动化任务中，当然可以进一步放权。但默认情况下，我更倾向于把版本确认保留为独立步骤：Agent 完成修改和验证后，我查看 diff 与 status，确认范围和结果，再决定是否 commit、push。

### 4. 为什么 Agent 越强，Git 越重要

Agent 可以在很短时间里修改多个文件，这使 diff、branch、commit、rollback、可追踪历史和清晰 scope 变得更加重要。Git 不只管理“我的修改”，也负责审计 Agent 的修改范围、隔离实验、比较前后状态，并为人工 Review 提供事实依据。

这篇文章本身就在 `feature/cross-platform-git-workflow` 中完成。它不需要复杂 PR 流程，但仍然遵循清楚的边界：

```text
main
└── feature/cross-platform-git-workflow
      ↓
    Agent 修改
      ↓
    Build / Test
      ↓
    Diff Review
      ↓
    人工确认
      ↓
    Commit
      ↓
    Merge（如需要）
```

分支隔离修改，Git 展示事实，测试验证结果，最后的版本确认仍然是一个独立决定。Commit 形成正式的版本节点；Merge 用于在需要时整合分支历史，可以稍后进行。

### 5. 最终工作流

把设备、仓库和 Agent 放在一起，我现在的整体结构是：

```text
Windows Website Local Repository
              ↕
     Website GitHub Repository
              ↕
macOS Website Local Repository

Ubuntu PC：本地 DL / RL / Linux Research Projects
└── 受 Git 管理的项目 ──按需↔ Remote Repository

Ubuntu NUC：ROS 2 / Stewart / 6PUS Projects
└── 受 Git 管理的项目 ↔ 对应的 Remote Repository

每个仓库内的工作链路：
Pull → Define Task
     → Human / Agent Develop
     → Diff → Build / Test → Review
     → Commit → Push
```

每台设备都有完整的本地历史；网站仓库可以存在于 Windows 和 macOS，科研与机器人项目则有各自独立的 Repository。对于受 Git 管理并需要远程同步或共享的项目，本地仓库再与对应 Remote Repository 交换提交历史。无论一次修改由我还是 Agent 完成，它都要经过 diff、build、test 和 review，再成为正式版本。

---

## 写在最后：为什么把这篇文章送给新 Mac

MacBook Neo 最开始只是为了获得一台更轻、更适合出差和随身携带的电脑。真正使用以后，它又成为了个人开发体系里的一个新节点：网站项目多了一个移动终端，Windows 与 macOS 开始共同参与维护；Ubuntu 的 PC 双系统继续承担 Linux 科研开发，NUC 则继续承载 ROS 2、Stewart / 6PUS 并联机器人和实机控制。

Git 早已是我的日常工具。新 Mac 没有让我突然理解 commit，也不是我第一次把代码 push 到 GitHub。但也正因为这个新节点的加入，我第一次把 Windows、macOS、两种 Ubuntu 环境、GitHub，以及已经逐渐常态化的 Agent 辅助开发工作流放在一起重新审视，也重新看清了这套工作流里最重要的部分。

电脑会更换，操作系统会变化，开发工具和依赖版本也会不断更新。真正让一个项目从旧设备延续到新设备、从一个系统延续到另一个系统的，不是某个被完整复制的文件夹，而是仓库里连续、清楚、可验证的版本历史。

新电脑只是新的工作节点，真正保持项目连续性的，是版本历史本身。

这篇文章既是一次跨平台 Git 工作流整理，也算是送给第一台 Mac 的第一份开发者礼物。
