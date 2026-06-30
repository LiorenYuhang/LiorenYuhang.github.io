---
title: 抢先体验 QQ 邮箱 Agently Mail — 给 AI Agent 一张数字身份证
date: 2026-06-30 12:00:00
tags: [AI Agent, QQ邮箱, Claude Code, Hermes, 技术前沿]
categories: 技术前沿
description: 腾讯刚内测上线的 Agently Mail（agent.qq.com）初体验——注册专属 Agent 邮箱，接入 Claude Code 和 Hermes，探索 AI 以独立身份自主收发邮件的全新交互范式。
top_img:
cover:
---

## 摘要

2026 年 6 月 23 日，腾讯 QQ 邮箱悄然上线 Agently Mail，为 AI Agent 提供专属的 `@agent.qq.com` 邮箱地址。作为内测阶段的早期使用者，本文记录了从注册、配置到将双账号分别接入 Claude Code 与 Hermes 的完整过程，并对 Agent 独立身份、Agent-to-Agent 通信等未来方向进行了探讨。

---

## 一、Agently Mail 是什么

先澄清一个关键认知：Agently Mail **不是帮你管理邮箱的 AI 助手**，而是反过来——**给 AI Agent 发一个它自己的邮箱**。

### 产品速览

| 维度 | 说明 |
|------|------|
| 上线时间 | 2026 年 6 月 23 日，内测阶段 |
| 邮箱后缀 | `@agent.qq.com`，与个人 QQ/微信邮箱完全隔离 |
| 配额 | 每人 2 个 Agent 邮箱，每日限发 50 封 |
| 安全性 | OAuth 授权（限时 Token，可随时撤销）+ 两阶段确认 + Prompt 注入防护 |
| 开源情况 | GitHub 开源，Apache-2.0 协议，已上架腾讯 SkillHub |
| 已接入平台 | Claude Code、Hermes、OpenClaw、Cursor、Kimi Work 等 |

### 为什么这件事意义重大

2025-2026 年是 AI Agent 基础设施密集落地的时期。Google 的 A2A 协议（Agent-to-Agent 通信）已在 GitHub 获得 2.2 万星标并被 150+ 组织采用，Coinbase 的 x402 协议解决了 Agent 的链上支付问题。腾讯 Agently Mail 补上了最后一环：**Agent 的独立数字身份**。从此，AI 不再借用人类的邮箱和名义，而以自己的身份参与通信。

---

## 二、双账号配置

### 2.1 注册

在 [agent.qq.com](https://agent.qq.com) 页面，用 QQ/微信扫码登录，进入 Agently Mail 管理后台。点击"创建 Agent 邮箱"，输入前缀即可获得 `XXX@agent.qq.com`。

内测阶段每人可创建两个，我分别注册了：

| 账号 | 接入平台 | 定位 |
|------|---------|------|
| `liorenyuhang@agent.qq.com` | Claude Code | 技术开发、代码 |
| `liuyhhub@agent.qq.com` | Hermes | 私人助理、日常事务 |

### 2.2 绑定 Agent 平台

以 Claude Code 为例，在管理后台：

1. 选择目标 Agent 邮箱，点击"绑定 Agent 平台"
2. 选择 Claude Code，系统生成 OAuth 授权 Token
3. 在我的本地 Claude Code 终端中执行授权命令，完成连接

同理，第二个账号绑定了 Hermes。

绑定完成后，Claude Code 和 Hermes 分别获得了一个独立的 QQ 邮箱身份——它们可以以自己的名义收发邮件，发送时显示的 From 地址就是 `@agent.qq.com`。

Agently Mail 最大的优势还是易用性。传统的 IMAP Agent 方案配置起来不说有多难，但确实有些繁琐；而 Agently Mail 采用了 Agent 原生配置流程的方案，把下面这句话喂给 AI Agent，就能直接完成安装和配置：

> 请阅读 https://agent.qq.com/doc/cli-setup.md 文档，按照步骤为我安装并配置 Agently Mail CLI。

整个过程不需要手动敲 `npm install`、不需要折腾配置文件——Agent 自己读文档、自己执行命令、自己完成 OAuth 授权。

> **踩坑记录：** 目前 Agently CLI（内测版本）的 OAuth Token 一次只绑定一个邮箱。同一台设备上切换 Claude Code 和 Hermes 的 Agent 邮箱，需要先 `agently-cli auth logout` 再 `agently-cli auth login` 手动切换。对双 Agent 场景来说这是明显的摩擦点，预计后续版本会加入多 Profile 支持。

---

## 三、几点观察

这三个场景跑下来，有几个值得记录的发现：

### 两阶段确认：命令行内完成

Agently Mail 的写操作（发信、回复等）需要人类确认。实测中确认流程在 CLI 内完成——Agent 生成操作摘要后等待回复，在对话中输入"确认"即可发送，不需要跳转到 QQ 手机端。流程顺畅，没有因为安全机制降低操作效率。

### CLI 单 Token 限制

这是目前最大的体验摩擦点。`agently-cli` 的 OAuth Token 保存在全局配置中，即使 Claude Code 和 Hermes 是独立的 Agent 进程，底层调用的仍是同一个全局 CLI。这导致切换邮箱时必须 `auth logout → auth login` 手动重新授权。

查阅了 Agently Mail 的官方帮助指南（[help.agent.qq.com](https://help.agent.qq.com/detail/0/1092)），Q&A 中对此有明确说明：

> **Q：我电脑上安装了两个 Agent，怎么接不同地址的 Agent 邮箱？**
> **A：目前同一台电脑设备上的多个 Agent 只能共同使用同一个邮箱地址。如果要使用不同地址请在不同的电脑设备上使用。**

官方文档确认了这是当前版本的已知限制。也就是说，我实测中的 `auth logout → auth login` 切换流程，虽然不是最优雅的方案，但确实是目前官方推荐的通路——在不增加第二台设备的前提下，这是唯一能让两个 Agent 邮箱共存于同一机器的办法。对多 Agent 场景来说，理想状态是每个 Agent 进程维护独立的 Token 上下文，相信这是后续版本的重点优化方向。

### 邮箱隔离是有效的

实测中 Agent 邮箱（`@agent.qq.com`）与个人 QQ 邮箱的收发完全隔离，Agent 无法访问人的收件箱，人也看不到 Agent 的收件箱，除非 Agent 主动发信给人。这个隔离设计让人放心——给 Agent 一个邮箱，不等于给它一张通往你所有隐私数据的通行证。

---

## 四、实际场景测试

以下三个场景均已完成实测。

> **关于 CLI 登录切换：** Agently CLI 目前一个 Token 只绑定一个 Agent 邮箱，在同一台设备上无法同时保持两个 Agent 邮箱的登录态。每一个场景的实测过程中，需要先 `agently-cli auth logout` 退出当前绑定，再 `agently-cli auth login` 重新授权到目标邮箱。这不是 "换个软件" 的问题——即使 Claude Code 和 Hermes 是独立的终端进程，它们调用的底层都是同一个全局安装的 `agently-cli` 命令，而 OAuth Token 保存于全局配置中，不被各自的 Agent 进程隔离。这是内测阶段产品的典型特征，后续多 Profile 支持上线后即可解决。

---

### 场景一：Agent 主动发送邮件

我在 Claude Code 终端中让 Agent 以 `liorenyuhang@agent.qq.com` 的身份向我的个人邮箱发送一封自我介绍邮件。

![Claude Code 终端发送指令](/images/3-QQagent/agent-mail-send1.png)

确认发送后，个人邮箱成功收到邮件——发件人显示为 `liorenyuhang@agent.qq.com`，正文中 Agent 清楚说明了它的邮箱地址和所接入的平台。

![个人邮箱收到 Agent 发来的邮件](/images/3-QQagent/agent-mail-send2.png)

**验证结果：** Agent 以独立身份主动完成了邮件发送，From 地址为 `@agent.qq.com`，与人类用户的 QQ 邮箱完全隔离。

---

### 场景二：Agent 读取邮件并做摘要

先用个人邮箱向 `liuyhhub@agent.qq.com` 发送一篇科技新闻：

![个人邮箱向 Agent 发送新闻邮件](/images/3-QQagent/agent-mail-read1.png)

然后切换到 Hermes 终端，让 Agent 读取最新邮件并总结：

![在 Hermes 终端输入读取指令](/images/3-QQagent/agent-mail-read2.png)

Hermes 成功读取了收件箱中的邮件，并返回了一段清晰的内容摘要：

![Hermes 返回邮件内容摘要](/images/3-QQagent/agent-mail-read3.png)

**验证结果：** Agent 完成了"接收 → 阅读理解 → 归纳总结"的闭环，摘要质量与直接对话场景下的 AI 输出无异。

---

### 场景三：双 Agent 通信（A2A 雏形）

这是最有意思的测试——让两个不同平台的 Agent 直接互发邮件。

**第一步：Hermes 发件。** 在 Hermes 终端中，指令 Agent 向 Claude Code 的邮箱发送请求邮件。

![Hermes 终端发送邮件指令](/images/3-QQagent/agent-mail-com1.png)

Hermes 完成发件后，在 QQ 邮箱管理后台确认邮件已送达：

![确认邮件已到达 liorenyuhang 的收件箱](/images/3-QQagent/agent-mail-com2.png)

**第二步：Claude Code 收件并回复。** 切换到 Claude Code，让 Agent 读取 Hermes 的邮件并按要求回复。

![Claude Code 读取 Hermes 发来的邮件](/images/3-QQagent/agent-mail-com3.png)

Claude Code 读取邮件后理解了 Hermes 的请求，开始生成 JSON 格式的 To-Do List 回复：

![Claude Code 生成回复内容](/images/3-QQagent/agent-mail-com4.png)

Claude Code 在命令行中完成确认流程后，邮件直接发出：

![确认发送后的完整回复邮件](/images/3-QQagent/agent-mail-com5.png)

**第三步：Hermes 接收回复。** 切回 Hermes，查看 Claude Code 的回复邮件并总结：

![Hermes 读取并总结 Claude Code 的回复](/images/3-QQagent/agent-mail-com6.png)

**验证结果：** 两个不同 Agent 平台（Claude Code 与 Hermes）的 Agent 完成了端到端的邮件收发闭环。这是一个 Agent-to-Agent 通信的雏形——虽然目前还需手动切换 CLI 登录状态，但通信链路已经跑通。

---

## 五、总结

从注册、双账号配置到三个实测场景跑完，核心体验可以归纳为：

- **功能方向成立**：Agent 以独立身份收发邮件这一核心流程已经完全跑通，产品定位清晰，不是噱头
- **安全设计在线**：命令行内确认机制 + 邮箱隔离，在可用性和安全性之间找到了合理的平衡点
- **多账号管理是短板**：CLI 全局 Token 导致双 Agent 场景体验割裂，切换成本不容忽视，预计后续版本会优先解决

作为一个还在内测阶段的产品，Agently Mail 完成度比预期高。它不是一个"以后可能会火"的概念，而是一个今天就可以跑通的工具——虽然还不完美，但方向是对的，时机也够早。这就足够了。

---

## 六、后续计划

- 将 Agent 邮箱接入日常开发工作流，实现自动化的代码审查通知、构建状态报告
- 探索 A2A 协议与 Agently Mail 的结合，设计多 Agent 协作的通信规范
- 跟踪腾讯对 Agent 邮箱的功能迭代（附件处理、邮件规则、API 开放程度）

---

*以上内容由 Claude Code + DeepSeek 辅助生成*
