---
title: 从一个 ROS 环境问题开始：Docker 入门、ROS 实践与真实硬件部署
date: 2026-09-19 10:30:00
tags: [ROS 2, Docker, Ubuntu, Jazzy, Lyrical, ROS 1, Noetic, 机器人]
categories: 机器人
description: 从实验室一个真实 ROS 环境问题出发，完整记录 Docker 入门、多版本 ROS、Bind Mount、DDS、真实 IMU、Dockerfile 与 Compose 的实践过程。
---

## 引言：一台不能随便重装的 ROS 1 NUC

最近我在帮组里一位同门处理 ROS 环境问题。实验室里还有一些 Ubuntu 20.04 + ROS 1 Noetic 的机器人 NUC；他一直用 ROS 1 控制 Franka。机器并不是不能用，驱动、Workspace 和脚本都已经配好，平时实验跑得很稳定。考虑到 ROS 1 Noetic 已经结束官方维护，我建议后续开发逐渐转向 ROS 2，但不想为此打乱现有环境。

如果只为换一个 ROS 版本，就把整台工作电脑的 Ubuntu、驱动和依赖重装一遍，代价太大。我想弄清楚的是：**能不能保留 Ubuntu 20.04 + ROS 1，同时获得一套新的 ROS 2 环境？**

那台 Franka NUC 还在工作，我没有直接拿它练习。自己的 NUC 正好是 Ubuntu 24.04 + ROS 2 Jazzy，这也成了我第一次比较完整地学习 Docker：先试着运行三种 ROS 环境，再把 Workspace、DDS 通信和真实 H30 IMU 接进来，最后用 Dockerfile 和 Compose 固定已经跑通的构建与启动过程。

我的主机基线是 **Ubuntu 24.04.4 LTS、x86_64、内核 `7.0.0-31-generic`**；原生 `ROS_DISTRO=jazzy`，`ros2` 位于 `/opt/ros/jazzy/bin/ros2`。下图是系统版本、内核与 ROS 路径的终端记录。

<figure>
  <img src="/images/8-docker-ROS/s01-ubuntu24-04-ros2-jazzy-host-baseline.png" alt="Ubuntu 24.04.4 主机与原生 ROS 2 Jazzy 环境">
  <figcaption>图 1：Ubuntu 24.04 与原生 Jazzy 环境</figcaption>
</figure>

<!-- more -->

## 1. ROS 为什么经常和 Ubuntu 版本绑定

开始之前，先把“版本对不上”说清楚。ROS 安装包还依赖 Python、编译器、共享库和大量 Ubuntu 软件包。发行版维护者需要选定平台来构建和测试这些包，因此“能不能自己想办法装上”和“是否有官方二进制支持”是两回事。Ubuntu 20.04 并非绝对不能运行 ROS 2；这里讨论的是使用对应发行版的现成环境。

| 本文环境 | Ubuntu 用户空间 | 用途 |
| --- | --- | --- |
| ROS 2 Lyrical | 26.04 | 观察较新的 ROS 环境 |
| ROS 2 Jazzy | 24.04 | 与本文主机原生 ROS 对应 |
| ROS 1 Noetic | 20.04 | 验证较旧 ROS 1 环境 |

版本对应关系可查 [ROS 2 Lyrical 发布资料](https://docs.ros.org/en/kilted/Releases/Release-Lyrical-Luth.html) 和 [Jazzy Ubuntu 安装文档](https://docs.ros.org/en/jazzy/Installation/Ubuntu-Install-Debs.html)。Noetic 已于 2025 年 5 月 31 日结束官方维护；本文把它作为旧机器人环境来研究，而不是推荐新项目采用 ROS 1。[ROS 官方 EOL 说明](https://www.ros.org/blog/noetic-eol/)也解释了这一点。

## 2. Docker 在这里到底解决什么

Docker Image（镜像）可以先理解为准备好的软件环境，Container（容器）则是从镜像启动的运行实例。对这篇文章最重要的一点是：**容器有自己的 Ubuntu 用户空间，却与 Linux 主机共享内核**。我的 Ubuntu 24.04 NUC 因而可以同时运行基于 26.04、24.04 和 20.04 用户空间的 ROS 容器。

```text
Ubuntu 24.04 Host：内核 + 原生 ROS 2 Jazzy
│
├── Ubuntu 26.04 userspace + ROS 2 Lyrical
├── Ubuntu 24.04 userspace + ROS 2 Jazzy
└── Ubuntu 20.04 userspace + ROS 1 Noetic
```

这样做不必直接改动主机已有的 ROS 安装。至于代码、网络和硬件怎样与容器配合，后面会用真实 H30 一步步试出来。

## 3. Docker 安装与基础验证

在安装之前，我先看主机架构和 Docker 是否已经存在：

```bash
dpkg --print-architecture
docker --version
docker compose version
```

第一条查询 Debian 风格的架构名称（这台 x86_64 机器显示为 `amd64`）；后两条分别检查 Docker 与 Compose 是否已有可用命令。

### 我这次怎么安装 Docker

[鱼香 ROS 安装项目](https://github.com/fishros/install)提供交互式工具。我这次运行下面的命令，在当时的菜单里选了 **8：一键安装 Docker**，而不是“ROS Docker 版”。菜单编号可能变化，照着选项文字选择即可。

```bash
source <(wget -qO- http://fishros.com/install)
```

这条命令会下载并执行第三方脚本，运行前要确认来源和内容。我的安装结果是 Docker **29.8.1**、Compose **v5.5.1**。

### 想走官方安装也可以

如果不使用第三方安装工具，可以按 [Docker 官方 Ubuntu 安装文档](https://docs.docker.com/engine/install/ubuntu/)配置 apt 仓库，再安装 Engine 和 Compose 插件。这是另一条可行路线，不是本文这次实际采用的安装过程。已有 Docker 的机器先确认原配置与冲突包，不要直接照搬卸载步骤。

安装后，我用下面三个命令分别检查客户端、Compose 插件和容器运行：

```bash
docker --version
docker compose version
docker run --rm hello-world
```

最后一条会拉取 `hello-world` 镜像并启动容器，我的终端打印出了 Docker 的欢迎信息。

<figure>
  <img src="/images/8-docker-ROS/s02-docker-installation-hello-world.png" alt="Docker、Compose 与 hello-world 验证">
  <figcaption>图 2：Docker、Compose 与 hello-world 验证</figcaption>
</figure>

### 安装后的真实踩坑：docker group 已配置，旧 Session 尚未生效

安装脚本已经把我的用户 `lyapunov` 加入 `docker` 组，但安装后的旧登录 Session 还保留着原来的 supplementary groups。于是 `docker info` 能显示客户端版本，连接 `/var/run/docker.sock` 时却报 `permission denied`。我检查了系统中的组记录和 `root:docker` 的 socket 权限，再用 `sg docker -c "docker info"` 访问成功，才确定问题出在旧 Session 的组身份。

<figure>
  <img src="/images/8-docker-ROS/s03-docker-group-session-permission-denied.png" alt="旧登录 Session 尚未获得 docker group 权限">
  <figcaption>图 3：旧登录 Session 尚未获得 docker group 权限</figcaption>
</figure>

临时跑一条命令可以用 `sg docker -c "..."`；想刷新当前 shell 的组环境，可以考虑 `newgrp docker`。更正常的长期做法是**注销并重新登录**。重新登录后，在终端输入下面的命令并回车，就能查看当前用户所属的组：

```bash
id
```

我的输出中出现了 `984(docker)`，之后普通用户直接运行 `docker` 命令也正常了。不要用 `chmod 666 /var/run/docker.sock` 绕过权限问题；Docker 组本身有较高的主机权限，详见 [Docker 安装后设置](https://docs.docker.com/engine/install/linux-postinstall/)。

如果你习惯用 Codex、Claude Code 或其他 Agent，这类重复操作也可以直接交给它做，但先把边界说清楚。

<details>
<summary>用 Agent 完成这一节</summary>

```bash
先检查当前 Ubuntu / ROS / Docker 环境，并告诉我 Docker 是否已经安装。

请输出：
- Ubuntu 版本、Kernel、CPU 架构；
- ROS_DISTRO；
- Docker 与 Compose 状态。

如果 Docker 已安装：
直接运行 hello-world 验证。

如果 Docker 未安装：
先给出适合当前 Ubuntu 的安装方案和将要执行的系统修改，等我确认后再安装。

不要卸载已有软件，不要修改 Host ROS 环境。
最后给出实际执行命令和验证结果。
```

</details>

## 4. ROS Docker Image 应该怎么选

[Docker Official Image `ros`](https://hub.docker.com/_/ros)提供 `ros-core`、`ros-base` 等层级。我先用 `ros-base` 跑命令行和驱动，不额外处理图形界面。[OSRF 的 `osrf/ros`](https://hub.docker.com/r/osrf/ros/tags)还提供 `desktop` 镜像，需要 RViz 等工具时再考虑。三个镜像都把 ROS 发行版和 Ubuntu 代号写在标签中：

| 实验 | 镜像标签 | 本次 Image ID | 本次显示大小 |
| --- | --- | --- | --- |
| 较新环境 | `ros:lyrical-ros-base-resolute` | `0c19f326a339` | 1.50 GB |
| 对应环境 | `ros:jazzy-ros-base-noble` | `c3706ef0a0aa` | 1.32 GB |
| 较旧环境 | `ros:noetic-ros-base-focal` | `72b8bc59035d` | 2.94 GB |

这三组都已在 NUC 上拉取。`docker images ros` 可以核对本机标签、Image ID 和大小；表格记录的是本次结果，Image ID 不是固定不变的版本号。

<figure>
  <img src="/images/8-docker-ROS/s04-three-ros-docker-images.png" alt="使用的三组 ROS Docker Image">
  <figcaption>图 4：使用的三组 ROS Docker Image</figcaption>
</figure>

<details>
<summary>用 Agent 完成这一节</summary>

```bash
请依次拉取 ros:lyrical-ros-base-resolute、ros:jazzy-ros-base-noble 和 ros:noetic-ros-base-focal。
记录每组 Image 的 tag、Image ID 和大小，整理成简表。
不要删除现有 Image；最后附上实际执行的命令和结果。
```

</details>

## 5. 实验一：Lyrical——Host 不升级也能用新的 ROS 2

第一站是比主机更新的 Lyrical。我想看看：Ubuntu 24.04 不升级，能否直接使用 Ubuntu 26.04 对应的 ROS 用户空间？先记下主机的系统、内核与 ROS：

```bash
cat /etc/os-release
uname -r
echo "$ROS_DISTRO"
```

`/etc/os-release`显示用户空间版本，`uname -r`显示内核版本，`ROS_DISTRO`显示当前终端加载的 ROS。接着拉取并进入 Lyrical 镜像：

```bash
docker pull ros:lyrical-ros-base-resolute
docker run --rm -it ros:lyrical-ros-base-resolute bash
```

`pull`下载镜像；`run`启动容器，`--rm`使其退出后自动删除，`-it`提供交互终端。进入容器后看同样几项：

```bash
cat /etc/os-release
uname -r
echo "$ROS_DISTRO"
which ros2
```

容器里读到 **Ubuntu 26.04.1 LTS（Resolute Raccoon）**、`ROS_DISTRO=lyrical`，`ros2` 在 `/opt/ros/lyrical/bin/ros2`；Python 是 **3.14.4**。而 `uname -r` 仍是主机的 `7.0.0-31-generic`。较新的 ROS 环境确实进来了，主机系统却没有跟着升级。

<figure>
  <img src="/images/8-docker-ROS/s05-ros2-lyrical-ubuntu26-container.png" alt="Ubuntu 26.04 与 ROS 2 Lyrical Container">
  <figcaption>图 5：ROS 2 Lyrical Container 运行结果</figcaption>
</figure>

<details>
<summary>用 Agent 完成这一节</summary>

```bash
请在当前 Ubuntu 24.04 Host 上完成 Lyrical Container 操作。
拉取 ros:lyrical-ros-base-resolute，启动退出后自动清理的临时 Container，读取其中的 Ubuntu 版本、ROS_DISTRO、ros2 路径、Python 版本和 uname -r。
同时读取 Host 的 Ubuntu 版本与 Kernel，将两边结果并排总结。
不要修改 Host ROS 环境；最后附实际命令和输出。
```

</details>

## 6. 实验二：Jazzy——Host 已经有了，为什么还要放进 Docker

第二组看起来有点多此一举：我的主机本来就是 Ubuntu 24.04，也原生装了 Jazzy，为什么还要在 Docker 里再运行一次 Jazzy？

因为机器人项目不只有一个。项目 A 可能需要一组 Python 库和 ROS package，项目 B 又需要另一组。都直接装在 Host 上，项目多了以后，更新一个依赖可能影响另一个已经工作的环境。我更希望 Host 保持自己的 Jazzy 开发环境，让每个项目把所需软件放进各自的容器。将来换电脑、交给组里其他人或部署到另一台 NUC，需要迁移的就不只是源码，还有项目的环境定义。

如果用过 Python 的 `venv` 或 Conda，可以借这个思路理解 Docker：别让不同项目的依赖互相打架。Docker 管得更宽，除了 Python package，Ubuntu 用户空间、系统库、ROS package 和启动方式也可以放进项目自己的环境里。

所以我用相同的步骤，再启动一套 Jazzy：

```bash
docker pull ros:jazzy-ros-base-noble
docker run --rm -it ros:jazzy-ros-base-noble bash
```

容器内用前一节的四条检查命令，得到 **Ubuntu 24.04.5 LTS（Noble Numbat）**、`ROS_DISTRO=jazzy`、`/opt/ros/jazzy/bin/ros2` 和同一个内核 `7.0.0-31-generic`；Python 为 **3.12.3**。

<figure>
  <img src="/images/8-docker-ROS/s06-ros2-jazzy-ubuntu24-container.png" alt="Ubuntu 24.04 与 ROS 2 Jazzy Container">
  <figcaption>图 6：Ubuntu 24.04 与 ROS 2 Jazzy Container</figcaption>
</figure>

<details>
<summary>用 Agent 完成这一节</summary>

```bash
当前 Host 已有 Ubuntu 24.04 + ROS 2 Jazzy。请用 ros:jazzy-ros-base-noble 再启动一套退出后自动清理的 Jazzy Container。
读取 Host 和 Container 各自的 Ubuntu 版本、ROS_DISTRO、ros2 路径、Python 版本与 Kernel。
并排比较用户空间和共享内核，附实际命令与结果；不要修改 Host 环境。
```

</details>

## 7. 实验三：Noetic——在新系统里保留 ROS 1 环境

前两个都是 ROS 2，容易让人以为 Docker 是专门给 ROS 2 用的。其实 Docker 隔离的是用户空间和软件环境，并不关心里面跑的是 ROS 1 还是 ROS 2。所以第三组我反过来试：**在较新的 Ubuntu 24.04 + Jazzy 主机上，运行 Ubuntu 20.04 + ROS 1 Noetic。**

使用的仍是 Docker Official Image：

```bash
docker pull ros:noetic-ros-base-focal
docker run --rm -it ros:noetic-ros-base-focal bash
```

进入容器后检查：

```bash
cat /etc/os-release
uname -r
echo "$ROS_DISTRO"
which roscore
```

这里查 ROS 1 的 `roscore` 路径。本次得到 **Ubuntu 20.04.6 LTS（Focal Fossa）**、`ROS_DISTRO=noetic`、`/opt/ros/noetic/bin/roscore`，Python 为 **3.8.10**；内核依然是主机的 `7.0.0-31-generic`。旧主机可以借容器使用新环境；反过来，新主机也能保留旧项目需要的软件环境。

<figure>
  <img src="/images/8-docker-ROS/s07-ros1-noetic-ubuntu20-container.png" alt="Ubuntu 20.04 与 ROS 1 Noetic Container">
  <figcaption>图 7：Ubuntu 20.04 与 ROS 1 Noetic Container</figcaption>
</figure>

<details>
<summary>用 Agent 完成这一节</summary>

```bash
请在当前 Ubuntu 24.04 Host 上运行退出后自动清理的 ros:noetic-ros-base-focal Container。
读取 Container 的 Ubuntu 版本、ROS_DISTRO、roscore 路径、Python 版本和 uname -r，同时读取 Host Kernel。
根据实际输出说明 Noetic 用户空间是否能运行、它看到的 Kernel 来自哪里；不要修改 Host ROS 2 环境。
最后附命令和结果。
```

</details>

## 8. 三种环境放在同一台 NUC 上

把刚才看到的版本排在一起，差别就很清楚了：

| 环境 | Ubuntu 用户空间 | `uname -r` | ROS 发行版 |
| --- | --- | --- | --- |
| Host 原生 Jazzy | 24.04.4 LTS | `7.0.0-31-generic` | ROS 2 Jazzy |
| Lyrical 容器 | 26.04.1 LTS | `7.0.0-31-generic` | ROS 2 Lyrical |
| Jazzy 容器 | 24.04.5 LTS | `7.0.0-31-generic` | ROS 2 Jazzy |
| Noetic 容器 | 20.04.6 LTS | `7.0.0-31-generic` | ROS 1 Noetic |

我的 NUC 仍然是 Ubuntu 24.04。三个容器分别有 26.04、24.04 和 20.04 的用户空间，但 `uname -r` 都指向同一个 Host Kernel。Docker 给了我多套 ROS 环境，并没有把主机“升级”为 Ubuntu 26.04。

<figure>
  <img src="/images/8-docker-ROS/s08-three-ros-environments-comparison.png" alt="三组 Container 用户空间与 Host Kernel 对比">
  <figcaption>图 8：三组 Container 用户空间与 Host Kernel 对比</figcaption>
</figure>

### 如果你只是想先学会 Docker，到这里已经够了

到这里，Docker 最核心的入门操作其实已经走完了：安装 Docker、拉取 Image、启动 Container，以及理解 Host 和 Container 之间的 Ubuntu 用户空间与 Kernel 关系。

如果你只是想解决“我的 Ubuntu 和 ROS 版本对不上”，做到这里其实已经可以开始自己用了。

不过我还想再往前走一步。Docker 真正放进机器人项目以后，代码放哪儿？ROS 节点怎么通信？真实串口设备怎么进 Container？最后又怎么把这些命令固定下来？

所以接下来的第 9～13 节，是我继续把 Docker 用到机器人开发里的过程。第一次接触 Docker 不必一次把这些内容全吃透，可以先看看每一节在解决什么，再按自己的需要往下做。

| 接下来解决的问题 | |
| --- | --- |
| Bind Mount | 代码怎么留在 Host |
| DDS | Host 和 Container 里的 ROS 2 怎么通信 |
| H30 IMU | Container 怎么访问真实硬件 |
| Dockerfile | 怎么把环境和驱动做进 Image |
| Compose | 怎么把启动参数固定下来 |

## 9. Bind Mount：代码留在 Host

Container 能跑了，但代码总不能一直放在临时 Container 里。退出时 Container 被删除，里面的修改也可能随之消失。我希望源码仍留在 Host，用 [Bind Mount](https://docs.docker.com/engine/storage/bind-mounts/)把主机目录呈现给 Container。这里用显式的 `--mount type=bind`，Host 源目录写错时会直接报错。

我单独建了一个 `mount_demo` 目录，映射到 Jazzy Container 的 `/workspace`，再查看 Container 身份和目录：

```bash
mkdir -p "$HOME/docker_ros_blog_lab/mount_demo"
docker run --rm \
  --mount type=bind,source="$HOME/docker_ros_blog_lab/mount_demo",target=/workspace \
  ros:jazzy-ros-base-noble \
  bash -c 'id; ls -ln /workspace'
```

`--mount`共享的是同一目录，不是复制文件。我先在 Host 写下 `from_host.txt`，进容器确认能读；再反过来，在容器写下 `from_container.txt`，回到 Host 也看到了它。文件确实共享了，但马上又冒出一个 Docker 新手容易忽略的问题：谁创建的文件，回到 Host 后到底属于谁？这次容器默认以 `uid=0(root) gid=0(root)` 运行，Host 创建的文件是 `1000:1000`，容器创建的文件则是 `0:0`。我没有用 `chmod` 或 `chown` 把差异盖掉；以后长期开发还得安排合适的容器用户。

<figure>
  <img src="/images/8-docker-ROS/s09-bind-mount-host-container.png" alt="Bind Mount 双向文件共享及 UID/GID 差异">
  <figcaption>图 9：Bind Mount 双向共享与 UID/GID 差异</figcaption>
</figure>

<details>
<summary>用 Agent 完成这一节</summary>

```bash
请创建独立的 mount_demo 目录，用 Bind Mount 挂入临时 Jazzy Container。
在 Host 创建文件并从 Container 读取，再由 Container 创建文件并回到 Host 读取；显示两边文件的 UID/GID。
只操作测试目录，不用 chmod 或 chown 掩盖差异；最后给出命令和实际结果。
```

</details>

## 10. DDS：Container 和 Host 能不能直接通信

代码能共享了，接下来是通信。我先让两端都用 Jazzy：一边是原生 Host，另一边是容器，这样先不引入跨 ROS 版本的问题。我一开始最关心的也不是 `topic list` 里能不能看到名字，而是另一端到底有没有收到消息。

### 先分清“环境变量未设置”和“实际 RMW”

| 位置 | `RMW_IMPLEMENTATION` | 实际加载 | 可用实现 |
| --- | --- | --- | --- |
| Host 原生 Jazzy | `NOT_SET` | `rmw_fastrtps_cpp` | `['rmw_fastrtps_cpp']` |
| Jazzy 容器 | `NOT_SET` | `rmw_fastrtps_cpp` | `['rmw_fastrtps_cpp']` |

两边的 `ROS_DOMAIN_ID`、`ROS_LOCALHOST_ONLY` 环境变量在基线中也都未显式设置。这里有个容易看错的地方：`RMW_IMPLEMENTATION=NOT_SET` 只是没有用环境变量指定实现，**实际加载的仍是 `rmw_fastrtps_cpp`**。通信测试时，我临时让两边都使用 `ROS_DOMAIN_ID=42`，没有把它写进 `.bashrc`。

### 默认 bridge：两个方向都收到实际 String 消息

我先用普通 `docker run`，让容器走 Docker 默认 bridge。容器发布 `/docker_blog_chatter`，Host 用同一 domain 订阅：

```bash
docker run --rm -it -e ROS_DOMAIN_ID=42 ros:jazzy-ros-base-noble \
  ros2 topic pub --rate 2 /docker_blog_chatter std_msgs/msg/String \
  "{data: 'hello from docker bridge'}"
```

```bash
ROS_DOMAIN_ID=42 ros2 topic echo /docker_blog_chatter
```

`-e` 把本次 domain 值传进容器，`topic pub` 周期性发送 `std_msgs/msg/String`。Host 的 `topic echo` 收到了 `data: hello from docker bridge`；我再反过来让 Host 在 `/host_blog_chatter` 发布 `hello from native jazzy host`，容器也收到了。在这台 NUC 上，普通 bridge 就完成了两个方向的消息传递。

<figure>
  <a href="/images/8-docker-ROS/s10-jazzy-container-host-dds.png" target="_blank" rel="noopener"><img src="/images/8-docker-ROS/s10-jazzy-container-host-dds.png" alt="Jazzy Container 与 Host 的 DDS 通信"></a>
  <figcaption>图 10：Container 与 Host 的 DDS 通信</figcaption>
</figure>

图 10 拍的是容器到 Host；反方向也在同一轮实验中收到了消息。

### host network + IPC 对照：发现成功，数据接收失败

普通 bridge 已经能通信后，我又顺手试了 `--network host` 加 `--ipc host`。结果反而有点意外：节点能发现对方，Host 却在 15 秒内没收到实际 String 数据。`/dev/shm` 里同时出现了 Container root 创建、owner 为 `root:root` 的 Fast DDS SHM 对象。当时比较可疑的是这里的权限问题，不过我没有继续做独立实验去证明两者之间的因果关系。

后面的 H30 实验继续用已经收到双向消息的普通 bridge。[Docker 文档](https://docs.docker.com/engine/network/drivers/host/)介绍了 host 网络模式共享主机网络命名空间的含义。

<details>
<summary>用 Agent 完成这一节</summary>

```bash
请完成一次 Host Jazzy 与 Jazzy Container 的 ROS 2 双向通信实验。

开始前：
- 记录 Host 和 Container 实际加载的 RMW；
- 两边临时使用相同 ROS_DOMAIN_ID；
- 先使用普通 docker run 默认 bridge，不改 Host 网络配置。

然后分别完成：
1. Container 发布 String，Host 实际收到；
2. Host 发布 String，Container 实际收到。

不要只根据 topic list 判断成功。
所有持续 pub / echo 命令都设置 timeout。

结束后清理临时 Container 和 ROS 进程。
最后给出实际命令、两个方向收到的消息和结果。
```

</details>

## 11. 真实硬件：让 Container 读取 H30 IMU

前面都还在软件环境里打转。对机器人开发来说，我更想知道：**Container 到底能不能碰到真实硬件？** 我的 NUC 接着两只 H30 IMU，这里只取其中一只 Base H30，把整条链走通：

```text
H30 → /dev/ttyACM0 → --device → Jazzy Container → h30_imu
    → /imu/data → Docker bridge → Host 原生 Jazzy
```

Host 当时枚举到 `/dev/ttyACM0` 和 `/dev/ttyACM1` 两个串口。结合稳定的 by-id 路径和现有 H30 配置，我这次选 Base H30 对应的 `/dev/ttyACM0` 做实验；它的 by-id 是 `/dev/serial/by-id/usb-1a86_USB_Single_Serial_5B32028000-if00`。图 11 拍下了当时的设备节点和 USB 属性。USB 重新插拔后，`ttyACM` 编号可能改变。

<figure>
  <img src="/images/8-docker-ROS/s11-dual-h30-imu-serial-devices.png" alt="Host 枚举到的两路 H30 串口设备">
  <figcaption>图 11：Host 枚举到的两路 H30 串口设备</figcaption>
</figure>

驱动原本在 `/home/lyapunov/bone_drill/bone_ws/src/h30_imu`。为了不碰已经工作的项目，我把这个 ROS package 单独复制到实验 Workspace `/home/lyapunov/docker_ros_blog_lab/ros2_ws/src/h30_imu`。它用到了 `rclcpp`、`sensor_msgs`、`geometry_msgs`、`tf2_ros` 和 POSIX termios，这次没有额外安装 ROS package 就在 `ros:jazzy-ros-base-noble` 中完成构建：

```bash
source /opt/ros/jazzy/setup.bash
cd /workspace/ros2_ws
colcon build --symlink-install
```

构建输出是 `Finished <<< h30_imu [8.19s]`、`Summary: 1 package finished [8.30s]`。

接着才让容器访问设备。[Docker 的 `--device`](https://docs.docker.com/engine/containers/run/)可以只开放指定设备。我这里只需要一个串口，就用 `--device=/dev/ttyACM0:/dev/ttyACM0`，没有为了它给容器开启 `--privileged`。运行时把独立 Workspace 映射进去，并让容器使用本次测试的 `ROS_DOMAIN_ID=42`：

```bash
docker run --rm -it \
  --device=/dev/ttyACM0:/dev/ttyACM0 \
  --mount type=bind,source=/home/lyapunov/docker_ros_blog_lab/ros2_ws,target=/workspace/ros2_ws \
  -e ROS_DOMAIN_ID=42 \
  ros:jazzy-ros-base-noble \
  bash -c 'source /opt/ros/jazzy/setup.bash && source /workspace/ros2_ws/install/setup.bash && ros2 launch h30_imu h30.launch.py port:=/dev/ttyACM0'
```

驱动日志显示 `Opened H30 serial port /dev/ttyACM0`，串口配置为 **460800 baud**。容器内运行的节点是 `/h30_imu`，可见 `/imu/data`、`/imu/euler`、`/imu/temperature` 和 `/tf`；其中 `/imu/data` 是 `sensor_msgs/msg/Imu`，`ros2 topic hz /imu/data` 测得约 **200 Hz**。图 12 左侧是设备映射与驱动日志，右侧是容器内的 Topic 和频率。

<figure>
  <a href="/images/8-docker-ROS/s12-docker-h30-imu.png" target="_blank" rel="noopener"><img src="/images/8-docker-ROS/s12-docker-h30-imu.png" alt="Container 内 H30 Driver 与约 200 Hz IMU Topic"></a>
  <figcaption>图 12：Container 内 H30 与约 200 Hz IMU Topic</figcaption>
</figure>

但我的目标不只是容器自己看见数据。沿用上一节已经跑通的普通 Docker bridge，我在 Host 原生 Jazzy 中使用相同的 domain 查询：

```bash
ROS_DOMAIN_ID=42 ros2 topic list | grep '^/imu'
timeout 6s env ROS_DOMAIN_ID=42 ros2 topic hz /imu/data
ROS_DOMAIN_ID=42 ros2 topic echo --once /imu/data
```

Host 发现了 `/imu/data`、`/imu/euler`、`/imu/temperature`，并以约 **200 Hz** 收到 `/imu/data`，还实际解析出一帧 `sensor_msgs/msg/Imu`。这帧包含姿态四元数、三轴角速度和三轴线加速度；静止时记录的 `linear_acceleration.z=9.787308 m/s²` 与 **1g 的量级一致**。频率统计本身不能逐帧核对数据是否全部送达。

<figure>
  <a href="/images/8-docker-ROS/s13-container-imu-host-subscriber.png" target="_blank" rel="noopener"><img src="/images/8-docker-ROS/s13-container-imu-host-subscriber.png" alt="H30 数据从 Container 到达 Host 原生 Jazzy"></a>
  <figcaption>图 13：H30 数据到达 Host 原生 Jazzy</figcaption>
</figure>

图 13 保留了 Topic、频率和 IMU 消息开头。下面折叠保存同次 Host 端的完整终端输出：

<details>
<summary>展开查看 Host 端完整 IMU 接收结果</summary>

```text
=== HOST TOPICS ===
/imu/data
/imu/euler
/imu/temperature

=== HOST /imu/data RATE ===
average rate: 200.207
   min: 0.003s max: 0.007s std dev: 0.00110s window: 201
average rate: 200.079
   min: 0.003s max: 0.007s std dev: 0.00106s window: 401
average rate: 200.051
   min: 0.003s max: 0.007s std dev: 0.00105s window: 601
average rate: 200.006
   min: 0.003s max: 0.007s std dev: 0.00105s window: 802
average rate: 199.988
   min: 0.003s max: 0.007s std dev: 0.00105s window: 1002

=== HOST REAL IMU SAMPLE ===
header:
  stamp:
    sec: 1789733353
    nanosec: 692897321
  frame_id: imu_link
orientation:
  x: 0.022615016607637543
  y: 0.006782004980455353
  z: -0.7447135468902752
  w: 0.6669664897956922
orientation_covariance:
- 0.0
- 0.0
- 0.0
- 0.0
- 0.0
- 0.0
- 0.0
- 0.0
- 0.0
angular_velocity:
  x: -0.0008171282491987052
  y: 0.0013967346404935022
  z: 0.0007764969842122771
angular_velocity_covariance:
- 0.0
- 0.0
- 0.0
- 0.0
- 0.0
- 0.0
- 0.0
- 0.0
- 0.0
linear_acceleration:
  x: -0.414803
  y: 0.195497
  z: 9.787308
linear_acceleration_covariance:
- 0.0
- 0.0
- 0.0
- 0.0
- 0.0
- 0.0
- 0.0
- 0.0
- 0.0
```

</details>

<details>
<summary>用 Agent 完成这一节</summary>

```bash
请把一个已经能在 Host 上工作的 ROS 2 串口传感器驱动放进 Jazzy Container 运行。

开始前先确认：
- 目标串口当前真实路径；
- 驱动 package 的位置；
- baudrate；
- Host 当前 ROS_DOMAIN_ID / RMW。

不要修改原机器人项目。
把驱动复制到独立测试 Workspace，再在 ros:jazzy-ros-base-noble 中构建。

只用 --device 精确映射目标串口，不用 --privileged。
如果缺依赖或 build 失败，先报告，不要随意修改原 package 或安装一堆软件。

启动 Driver 后检查：
- Container 内真实 Topic、消息类型和频率；
- Host 使用相同 ROS_DOMAIN_ID 后是否实际收到传感器消息。

所有持续命令设置 timeout。
结束后清理临时 Container / ROS 进程，并汇总实际命令与结果。
```

</details>

## 12. Dockerfile：把驱动做进镜像

前面 H30 已经跑起来了，但驱动源码还放在 Host 的独立 Workspace 中，Container 靠 Bind Mount 才拿得到它。开发时这样很方便；如果要把环境交给组里其他人，总不能每次都先解释“请把这个目录放到这个路径，再挂进去”。既然流程已经走通，我就想试着把 Jazzy 环境和 `h30_imu` 驱动真正做进 Image。

最终使用的 `docker/Dockerfile` 很短：

```dockerfile
FROM ros:jazzy-ros-base-noble

WORKDIR /opt/h30_ws

COPY ros2_ws/src/h30_imu /opt/h30_ws/src/h30_imu

RUN . /opt/ros/jazzy/setup.sh && \
    colcon build --symlink-install

CMD ["bash", "-c", "source /opt/ros/jazzy/setup.bash && source /opt/h30_ws/install/setup.bash && ros2 launch h30_imu h30.launch.py port:=/dev/ttyACM0"]
```

`FROM`沿用前面验证的 Jazzy `ros-base`；`COPY`取的是独立实验 Workspace 中的驱动副本；`RUN`在构建时完成 `colcon build`；`CMD`让容器启动后直接运行 H30 节点。从实验目录 `/home/lyapunov/docker_ros_blog_lab` 构建时，我执行的是：

```bash
docker build --no-cache --progress=plain \
  -f docker/Dockerfile -t docker-ros-h30:jazzy .
```

日志中出现 `Finished <<< h30_imu` 与 `Summary: 1 package finished`，生成 `docker-ros-h30:jazzy`。这次 `docker images` 显示镜像约 **1.31 GB**。

<figure>
  <a href="/images/8-docker-ROS/s14-dockerfile-build.png" target="_blank" rel="noopener"><img src="/images/8-docker-ROS/s14-dockerfile-build.png" alt="Dockerfile 构建 h30_imu 自定义镜像"></a>
  <figcaption>图 14：Dockerfile 构建 H30 镜像</figcaption>
</figure>

我还单独运行了这个新镜像：只映射 `/dev/ttyACM0`，**不再挂载 Host 的 `ros2_ws`**。驱动照样启动，容器内有 `/imu/data`、`/imu/euler`、`/imu/temperature`、`/tf`，`/imu/data` 约 **199.98 Hz**；Host 原生 Jazzy 约 **199.93 Hz**，并收到真实 `sensor_msgs/msg/Imu`。

做到这里我才觉得 Dockerfile 真正有用了：以后不用再记得“当时这台电脑到底怎么配出来的”，环境本身也有了可以重新构建的来源。

<details>
<summary>用 Agent 完成这一节</summary>

```bash
请把前面已经跑通的 ROS 2 传感器流程固化成最小 Dockerfile。

要求：
- 使用已经验证的 ROS base image；
- COPY 独立实验 Workspace 中的目标 package；
- 在 build 时完成 colcon build；
- 不修改原机器人项目；
- 不为了“优化”额外安装未经验证的依赖。

Build 自定义 Image 后，
不要再挂载 Host ROS Workspace，只映射真实硬件设备重新启动 Driver。

确认 Container Topic 和 Host 实际消息都正常。
最后给出 Dockerfile、build 命令、Image 信息和运行结果。
```

</details>

## 13. Compose：把启动参数写进配置

Dockerfile 解决后，还有最后一个麻烦：环境不用重新配了，但每次启动 H30 仍要记得 `--device`、`ROS_DOMAIN_ID` 和那串 `docker run` 参数。这些是服务**启动时**需要的条件，我把它们收进 `docker/compose.yaml`：

```yaml
services:
  h30_imu:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    image: docker-ros-h30:jazzy
    devices:
      - /dev/ttyACM0:/dev/ttyACM0
    environment:
      - ROS_DOMAIN_ID=42
    restart: unless-stopped
```

这里的 `build.context: ..` 相对 `docker` 目录指向实验根目录，`Dockerfile` 因而能 COPY 那份独立的 `h30_imu` 源码。`image` 命名构建结果；`devices` 精确开放串口；`environment` 沿用已验证的 domain。驱动启动命令已经写在镜像的 `CMD` 中。进入 `docker` 目录后，启动只需：

```bash
docker compose up
```

Compose 会创建自己的项目网络，不等于普通 `docker run` 的默认 bridge。我原本想，如果默认网络不通，就回到前面用过的 bridge。结果没指定 `network_mode` 也通了：Compose 创建 `docker_default` 后，Host 看到了 IMU Topic，还收到了约 **200 Hz** 的 `/imu/data` 和真实 `sensor_msgs/msg/Imu` 消息。最终就没额外写网络参数。

<figure>
  <a href="/images/8-docker-ROS/s15-docker-compose-validation.png" target="_blank" rel="noopener"><img src="/images/8-docker-ROS/s15-docker-compose-validation.png" alt="Docker Compose 启动 H30 并由 Host 接收 IMU 数据"></a>
  <figcaption>图 15：Compose 启动 H30 并向 Host 发布数据</figcaption>
</figure>

<details>
<summary>用 Agent 完成这一节</summary>

```bash
请把已经验证通过的 docker run 启动方式改成最小 compose.yaml。

固化：
- image / build；
- 目标设备映射；
- ROS_DOMAIN_ID；
- Driver 启动方式。

不要使用 privileged，也不要预先加入 host network。

先运行 docker compose config 检查最终配置，
再 docker compose up。

使用 Compose 默认网络，
确认 Container 内传感器 Topic 正常，并确认 Host 实际收到消息。

如果默认网络失败，先报告现象，不要自动尝试一堆网络方案。

验证完成后 docker compose down。
最后给出 compose.yaml、实际启动命令和结果。
```

</details>

## 14. 常见问题与排错

这次最费解的并不是镜像命令，而是“明明进了 `docker` 组，却访问不了 socket”。如果你也遇到 `docker info` 的 `permission denied`，先看系统组记录、socket owner 和当前 Session 的 `id`。旧登录会话没刷新时，可以临时用 `sg docker -c "命令"`，或在当前 shell 考虑 `newgrp docker`；长期还是注销重登。别用 `chmod 666 /var/run/docker.sock` 把 socket 向所有用户开放。

其余问题我习惯沿着链路往下查，而不是一看到没有数据就怪 DDS 或传感器：

| 看到什么 | 接着查什么 |
| --- | --- |
| 容器没有预期 ROS 命令 | 镜像标签、ROS 环境是否加载 |
| Workspace 文件不可见或不能写 | Bind Mount 源目录、容器身份、文件 UID/GID |
| Host 找不到容器 Topic | 两边节点是否启动、`ROS_DOMAIN_ID`、实际 RMW、网络 |
| 只能在 `topic list` 看到名称 | 再用 `ros2 topic hz` 和 `ros2 topic echo` 看真实消息 |
| 容器看不到 IMU 串口 | Host 设备是否仍存在、`--device` 是否映射、容器内设备节点 |
| 串口可见但 H30 Node 打不开 | `port`、460800 baud、权限、是否有进程占用 |
| 容器有 `/imu/data`，Host 没数据 | domain、RMW、网络、消息类型，再看 Host 的 `hz` 与 `echo` |

本文的 H30 排查顺序就是 **Host Device → `--device` → `port` / baudrate → Node → Topic → Host Subscriber**。

## 15. 回到最初那台 ROS 1 NUC

那台 Franka NUC 还在正常跑实验，所以这次我一直没去动它。前面的多版本 ROS、DDS 和真实 H30 都是在自己的 Ubuntu 24.04 NUC 上试的。

以后真的要迁过去，我会先把原来的 Ubuntu 20.04 + ROS 1 环境完整保留，再按那台机器自己的 CPU、Kernel、Franka 驱动和网络条件，把 Jazzy Container 一点点加进去。至少现在已经不是“Docker 到底能不能干这个”的问题了，而只是换一台机器重新把条件核对一遍。

换到另一台机器后，软件环境可以复用，但 Kernel、架构和硬件还是它自己的。

## 16. Docker 能解决什么，不能解决什么

| Docker 帮我做的事 | Docker 本身替代不了的事 |
| --- | --- |
| 隔离 Ubuntu / ROS 用户空间 | Host Kernel 与底层硬件驱动 |
| 把依赖和启动方式写进镜像与 Compose | ROS 1 代码迁移到 ROS 2 |
| 让项目环境更容易复现、迁移和部署 | 另一种 CPU 架构的兼容性 |
| 精确映射本文需要的串口 | 设备实际存在、权限和传感器状态 |

## 17. 总结

最开始做这件事，其实只是因为那台 Ubuntu 20.04 + ROS 1 NUC 不方便重装。我想找一种不破坏原环境，又能继续尝试新 ROS 环境的方法，所以才真正开始用 Docker。

自己完整走一遍之后，我对 Docker 的理解已经不只是“在 Ubuntu 里再跑一个 Ubuntu”了。代码怎么留在 Host、ROS 2 怎么跨 Container 通信、真实串口设备怎么进去、驱动怎么做进 Image、启动参数怎么交给 Compose，这些都是机器人项目里迟早会碰到的问题。

对我来说，这次最大的变化不是记住了多少 Docker 命令，而是以后再遇到一台“已经配好、不能随便重装，但又需要新环境”的机器人电脑时，多了一条可以先试的路。当然 Docker 也不是万能层，Kernel、硬件和 ROS 1 到 ROS 2 的代码迁移还是各自的问题。
