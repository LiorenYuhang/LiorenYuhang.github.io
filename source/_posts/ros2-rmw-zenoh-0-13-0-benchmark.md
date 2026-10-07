---
title: ROS 2 换掉 DDS 会发生什么？实测 rmw_zenoh 0.13.0、Fast DDS 与 Cyclone DDS
date: 2026-10-07 00:00:00
permalink: 2026/10/07/ros2-rmw-zenoh-0-13-0-benchmark/
tags: [ROS 2, Zenoh, 性能测试]
categories: 机器人
description: 在同一套 ROS 2 Rolling 应用、二进制、消息和 QoS 下，对比 Fast DDS、Cyclone DDS 与 rmw_zenoh_cpp 0.13.0 的 RTT，观察载荷、发送节奏、尾延迟与重复性如何改变工程选型判断。
---

## 1. rmw_zenoh 0.13.0 发布后，我重新做了一次 RMW 对比

`rmw_zenoh_cpp 0.13.0` 在 **2026 年 9 月 11 日**发布时，我已经注意到了这次更新。可惜 9 月开学后，科研、项目和其他事情比较集中，真正抽出完整时间，在同一套 benchmark 下系统测试 Fast DDS、Cyclone DDS 和 Zenoh 0.13.0，已经到了 10 月。

截至本文整理时的 **2026-10-07**，0.13.0 是当时最新的正式发布版本。日期可查[官方 changelog](https://github.com/ros2/rmw_zenoh/blob/0.13.0/rmw_zenoh_cpp/CHANGELOG.rst) 的 `0.13.0 (2026-09-11)` 条目，以及对应的 [0.13.0 release tag](https://github.com/ros2/rmw_zenoh/tree/0.13.0)。我测的是这个明确的版本包，不是不断变化的 Rolling HEAD。

我关注它，是因为 Zenoh 已经通过 RMW 接到了 ROS 2 的应用接口下。对一个已有的机器人软件项目，这意味着一个值得实测的问题：**如果 application、消息和业务逻辑完全不变，只替换 RMW，往返通信会发生什么？**

先透露一组结果：1 MiB、back-to-back request/reply 下，Fast DDS 的 pooled median 约 **2.01 ms**，P99 约 **24.26 ms**；Zenoh 0.13.0 的 median 约 **2.76 ms**，P99 约 **5.37 ms**。只看 median，Fast DDS 更低；换成 P99，Zenoh 又明显更低。

同一组对照里，Cyclone DDS 的 median 约 **1.61 ms**，P99 约 **3.84 ms**。这些数值来自同一套应用条件，但选择看分布的哪个位置，会改变我对其中两个实现的判断。

所以我想问的不只是“谁更快”，还包括：小包和大包会不会得到不同答案？回复后停一段时间，与立即继续发送有什么差别？一条漂亮的汇总曲线能否经得住重复运行？下面从 RMW 的可替换位置出发，把这几个问题拆开看。

<!-- more -->

## 2. RMW：ROS 2 为什么能“只换底层”

要让“应用不变，只换底层”成为一个有意义的实验，先要知道切换发生在哪里。用 `rclcpp` 写节点时，应用面对的是 ROS 2 的消息、节点和通信接口；下面经过 `rcl`，再由 RMW 对接具体中间件。业务逻辑因此不必直接绑定到某一家 DDS 的 API。

这一层也给非 DDS 实现留下了位置：`rmw_fastrtps_cpp` 对接 Fast DDS，`rmw_cyclonedds_cpp` 对接 Cyclone DDS，`rmw_zenoh_cpp` 则对接 Zenoh。ROS 2 官方的 [RMW 实现说明](https://github.com/ros2/ros2_documentation/blob/rolling/source/ROS-Framework/client-libraries/About-Middleware-Implementations.rst) 已将两类实现放在同一接口体系中讨论。

<figure>
  <img src="/images/9-ros2-rmw-zenoh-0-13-0-benchmark/01-rmw-abstraction.svg" alt="ROS 2 Application 经 rclcpp、rcl 和 RMW 选择 Fast DDS、Cyclone DDS 或 Zenoh 的分层架构">
  <figcaption>
图 1：同一应用下的三种 RMW 可替换方案。每次运行选择一个分支，三个分支不是同时参与同一次测量。<br>
<em>Fig. 1. ROS 2 RMW abstraction and interchangeable middleware implementations.</em>
</figcaption>
</figure>

在支持运行时选择、已安装对应实现和消息 type support 的环境里，可以在进程启动前设置 `RMW_IMPLEMENTATION`。例如下面三行分别代表三种运行选择，不是一起执行的启动脚本：

```bash
export RMW_IMPLEMENTATION=rmw_fastrtps_cpp
export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp
export RMW_IMPLEMENTATION=rmw_zenoh_cpp
```

官方的[多 RMW 使用说明](https://github.com/ros2/ros2_documentation/blob/rolling/source/Get-Started/Installation/RMW-Implementations/Working-with-multiple-RMW-implementations.rst)解释了这种选择方式；[RMW 实现指南](https://github.com/ros2/ros2_documentation/blob/rolling/source/ROS-Framework/client-libraries/Working-with-Client-Libraries/Creating-An-RMW-Implementation.rst)进一步说明了运行时加载机制。

这里切换的是进程启动时使用的实现，不是对一个正在运行的节点做热切换。Ping 和 Pong 也始终使用同一个 RMW；这里不讨论不同实现之间能否互通。

图 1 要表达的就是这个替换位置：上面保留同一套应用，下面每次选择一个分支。这样做 same-source benchmark，我就不用拿三份实现方式不同的 Ping/Pong 程序比较，而能让同一套源码和二进制走不同 RMW，观察应用最终看到的 RTT。

## 3. 我怎么把三种 RMW 放到同一条起跑线上

我先遇到的其实是环境问题。实验 Host 原本承担 ROS 2 Jazzy 和机器人实机任务，我不想为一次中间件比较打乱它。因此保留 Host Jazzy，在 Docker 中准备 **基于 Ubuntu 26.04.1 LTS 的 ROS 2 Rolling 环境**，再冻结实验 image。

三个实现使用**同一 image、相同源码、同一次构建生成的 Ping/Pong 二进制、相同消息和 QoS**。Ping 发布 `BenchmarkPacket`，Pong 收到后原样回发，组成 **Ping → Pong → Ping**。固定载荷和发送节奏后，应用通过 `RMW_IMPLEMENTATION` 选择实现；程序也检查 requested 与 actual RMW identifier，确认真正加载的中间件。

QoS 统一为 **KEEP_LAST、depth 10、RELIABLE、VOLATILE**。中间件保持各自默认配置，Zenoh 使用默认的 `rmw_zenohd`。这条“起跑线”约束的是应用与环境，不代表三种实现内部走相同的传输路径。

我选了 **64 B、1 KiB、16 KiB、64 KiB、1 MiB** 五档 payload，搭配两种节奏：

- **paced_10ms**：收到回复并完成处理后，等待 10,000 μs 再发下一条。周期还包含 RTT 和处理时间，因此不是严格 100 Hz。
- **back_to_back**：回复处理完就立即发送下一条，但始终只有 **1 个 request in flight**。它仍是 request/reply，不是 streaming throughput 或最大吞吐量测试。

每个 RMW × payload × mode 组合称为一个 cell。矩阵为 **3 middleware × 5 payload × 2 modes × 5 repeats**，共 **150 个 clean runs、30 个 experimental cells、150,000 个有效 RTT samples**，**0 timeout、0 invalid echo**。每个 cell 合并 5,000 个 samples 用来描述分布，重复运行的单位是 **5 repeats**，不能称为 5,000 次独立实验，也不假定五次运行在统计上完全独立。

RTT 用同一个 Ping 的 `std::chrono::steady_clock` 计时，衡量应用端到端往返时间。它不是 one-way latency，也不能直接除以二当成单向延迟。实验期间曾检测到一次环境冲突，对应结果被排除并重新完成测试。正式统计只纳入 clean runs，没有按延迟高低筛选数据，也没有删除 outlier。

理解这些条件，就可以继续看结果。精确版本、计时边界和统计实现放在下面，方便需要复核时展开。

<details>
<summary>展开查看完整实验版本与统计口径</summary>

版本选择还有一个具体原因：这台 Host 的早期 Jazzy 环境记录中，`rmw_zenoh_cpp` 为 **0.2.10**。它与本文要测试的 0.13.0 不是同一个版本。为获取当时可用的官方 0.13.0 二进制包，我选择 Docker 内的 ROS 2 Rolling 环境，而不是改变 Host 的 Jazzy。

正式实验使用**基于 Ubuntu 26.04.1 LTS 的 ROS 2 Rolling 环境**，运行参数包含 `--network host --init --rm`。三个实现共用冻结后的 image：`ros2-rmw-benchmark:rolling-zenoh-0.13.0-20261006`。

| 项目 | 本次正式实验版本 |
| --- | --- |
| Host / CPU | Ubuntu 24.04.4 LTS / Intel Core i5-1340P |
| Host CPU 状态 | intel_pstate / powersave |
| Fast DDS / RMW | 3.6.2 / rmw_fastrtps_cpp 9.6.0 |
| Cyclone DDS / RMW | 11.0.1 / rmw_cyclonedds_cpp 4.2.1 |
| Zenoh RMW / vendor | rmw_zenoh_cpp 0.13.0 / zenoh_cpp_vendor 0.13.0 |
| Zenoh 底层库 | zenoh-c 1.8.0 / zenoh-cpp 1.9.0 |

0.13.0 是 RMW 包版本，不能把它当成底层 Zenoh 库的版本。本次安装的 `ros-rolling-rmw-zenoh-cpp` Debian 包为 `0.13.0-1resolute.20260915.140302`，来自官方 image 配置的 ROS **testing channel**。上游正式版本、二进制发布渠道和 ROS 发行版是三件事；这不意味着 Rolling 是稳定发行版。

Docker 在这里承担的是环境隔离和快照作用。`--network host` 使容器使用 Linux Host 的网络命名空间，但测量仍包含容器、进程、ROS 调用和中间件的整体条件，不能据此把结果称为裸机或纯网络延迟。

| 条件 | 设置 |
| --- | --- |
| 消息 payload 字段 | 64 B、1 KiB、16 KiB、64 KiB、1 MiB |
| 应用节奏 | paced_10ms、back_to_back |
| QoS | KEEP_LAST，depth 10，RELIABLE，VOLATILE |
| 在途请求 | 始终只有 1 个 request in flight |
| 每次 run | 100 次 warmup + 1,000 次正式测量 |
| 每个 cell | 同一 RMW × payload × mode，重复运行 5 次 |
| 超时门限 | 每请求 2,000 ms |
| 进程条件 | 每个 run 使用全新容器与全新 ROS 进程 |

环境冲突对应的结果没有进入正式统计，重新完成对应测试后，最终纳入完整的 150 个 clean runs。数据没有按延迟高低筛选，也没有删除 outlier、trim 或 winsorization。

RTT 由同一个 Ping 进程的 `std::chrono::steady_clock` 计时：发送前取时，包含 deadline reset 和 publish 路径，结束于回复接收回调入口。当前回复的 payload 校验和实验结束后的 CSV 写入不计入该条 RTT。它衡量的是**应用端到端往返时间**，不能当成 one-way latency，也不能除以二就认定单向延迟。

这里的 payload 是消息中 payload 字段的长度，不是 serialized size 或 wire size。统计使用 Type 7 线性插值百分位；下文主曲线为每个 cell 的 5,000 个 samples 合并后得到的 **pooled median / P99**，图中阴影是 5 次重复运行对应指标的 min–max，不是置信区间。

5,000 个 samples 用于描述分布，重复运行的单位是 **5 repeats**。我不会把它写成 5,000 次独立实验，也不假定这 5 次运行在统计上完全独立；本次没有做显著性检验。

repeat median CV 使用五个 repeat median 的 population std / mean，描述重复之间的相对波动；它与 cell 内 raw RTT 的 CV 不是同一个指标，也不是预设合格门限。

实验期间还有约 **138.79 分钟**的中断恢复间隔。排除已识别的冲突数据，并不代表不同时段的 Host 状态完全相同。执行顺序做了确定性轮转，但不是随机化实验，因此这里采用描述性结论，不把同编号 repeat 的顺序比较当成严格配对试验。

</details>

Docker 和 Agent 在这里都是搭建与验证环境的工具，本文关注的仍是 RMW 的表现。下面的提示词只用于建立隔离环境并验证三个实现能否运行，不会重跑完整 benchmark，也不能用来复现本文的 RTT 数值；它采用独立容器网络，与上面实验的 host network 条件不同。

<details>
<summary>用 Agent 搭建三种 RMW 的隔离验证环境</summary>

```text
请建立一套隔离的 ROS 2 Rolling RMW 测试环境，只完成运行验证。
不要运行本文的 150 次正式 benchmark，也不要做性能排名。
先阅读官方 rmw_zenoh 0.13.0 的安装和 Test 说明：
https://github.com/ros2/rmw_zenoh/blob/0.13.0/README.md

先做 Host 只读检查：
记录操作系统、CPU 架构、已有 ROS 发行版与当前 RMW 设置。
检查 Docker CLI、daemon、当前 context 和已有容器，避免名称冲突。
不要启动、停止或修改已有机器人 ROS 2 项目及其容器。
若 Docker 不可用或权限不足，报告缺口并停止，不自行改系统。
不要在 Host 安装 ROS 包、修改默认 RMW 或写入 .bashrc。
不要挂载已有 ROS workspace，也不要读取或改写项目凭据。

准备 Docker 环境：
使用官方 ros:rolling-ros-base image，并记录 digest 和容器系统版本。
为本测试建立独立命名的网络和容器，不使用 host network / host IPC。
所有 smoke test 进程都在同一个测试容器内，不映射端口到 Host。
将所用 Dockerfile、安装命令和测试日志保存在独立工作目录。
仅在 Dockerfile / 容器内执行 apt-get update，再通过官方 ROS apt 源安装：
ros-rolling-rmw-fastrtps-cpp
ros-rolling-rmw-cyclonedds-cpp
ros-rolling-rmw-zenoh-cpp
ros-rolling-demo-nodes-cpp
记录 apt 源、三个 RMW 的完整 Debian 包版本及相关依赖版本。
source /opt/ros/rolling/setup.bash 后，检查三个包均能被 ROS 找到。
通过安装目录的 package.xml 确认 rmw_zenoh_cpp 为 0.13.0。
只有版本确认为 0.13.0 才继续；否则停止并报告可用版本。
若官方源仍提供所需版本，可显式指定完整 Deb 版本并重新核验。
不要用其他版本冒充 0.13.0，不混装未知来源或偷偷改成源码构建。

分别验证三个 RMW：
为本测试选择独立 ROS_DOMAIN_ID，talker、listener、router 保持一致。
每种实现单独启动全新进程，切换前结束本测试上一组进程。
只在容器内处理测试 daemon；不要对 Host 执行全局 pkill。
每个进程在临时 shell 中 source Rolling，并设置 RMW_IMPLEMENTATION。
依次选择 rmw_fastrtps_cpp、rmw_cyclonedds_cpp、rmw_zenoh_cpp。
对 Zenoh，按官方说明先执行 ros2 run rmw_zenoh_cpp rmw_zenohd。
确认 router 正常运行后，再启动 Zenoh 的 talker 与 listener。
talker 命令：ros2 run demo_nodes_cpp talker
listener 命令：ros2 run demo_nodes_cpp listener
为每组设置有限测试时长，以 listener 连续收到对应消息为 PASS 证据。
保存发送、接收与进程错误日志；仅能列出包或节点不算 PASS。
若某组失败，标记 FAIL 并定位当前失败层，不改 Host 来绕过问题。

三种 RMW 均 PASS 后停止，不扩展为完整 benchmark。
输出 image digest、实际版本、每组命令、PASS / FAIL 和日志路径。
结束本测试创建的进程和容器；保留复现文件，不清理已有资源。
若有版本或运行缺口，如实报告，不宣称复现了文章的性能结果。
```

</details>

## 4. 第一眼：只看 Median，会得到什么答案

如果先不看开头的 P99，只问“典型的一次往返要多久”，median 是一个直观的入口。图 2 的横轴是 payload 字段长度（log2），纵轴是 RTT，单位 μs（log10）；主线是每个 cell 的 pooled median，阴影是 5 次 repeat 的 min–max，不是置信区间。后面三张总览图沿用这个读法。

<figure>
  <img src="/images/9-ros2-rmw-zenoh-0-13-0-benchmark/02-rtt-median-paced-10ms.png" alt="paced_10ms 下三个 RMW 的 pooled median RTT 随 payload 变化，阴影显示五次重复范围">
  <figcaption>
图 2：paced_10ms 的 median RTT。主线是每个 cell 的 pooled median，阴影是 5 次 repeat 的 min–max；坐标使用对数尺度。<br>
<em>Fig. 2. Median RTT versus payload under paced_10ms.</em>
</figcaption>
</figure>

在全部 5 个 payload 下，**Cyclone DDS 的 pooled median 最低**。64 B 到 64 KiB 时，Zenoh 0.13.0 的 pooled median 高于两种 DDS；到 1 MiB，Zenoh 为约 **5.14 ms**，低于 Fast DDS 的约 **13.12 ms**，但仍高于 Cyclone DDS 的约 **4.39 ms**。

如果只看到这里，我会倾向于先验证 Cyclone DDS。但图 2 还有一处值得记住：Zenoh 与 Fast DDS 在大包处交换了相对位置，不能拿一个小包数值概括整个载荷范围。

接着只改变发送节奏，收到回复后立即继续。图 3 与图 2 共用 median 的纵轴范围，可以直接看出曲线整体下移了多少；再沿横轴看，相对顺序有没有变化。

<figure>
  <img src="/images/9-ros2-rmw-zenoh-0-13-0-benchmark/03-rtt-median-back-to-back.png" alt="back_to_back 下三个 RMW 的 pooled median RTT 随 payload 变化，使用与 paced median 图相同的纵轴范围">
  <figcaption>
图 3：back_to_back 的 median RTT。与图 2 共用 median 的纵轴范围，便于比较发送节奏造成的变化。<br>
<em>Fig. 3. Median RTT versus payload under back-to-back request/reply.</em>
</figcaption>
</figure>

64 B 时，Fast DDS 的 pooled median 约 **63.46 μs**，Cyclone DDS 约 **70.59 μs**；其余 4 个 payload 则是 Cyclone DDS 更低。仅看汇总表，小包处像是一次排名反转。

但这两个 64 B 数字之间只差约 **7.14 μs**。按同编号 repeat 比较，Fast DDS 在 3/5 次更低，Cyclone DDS 在 2/5 次更低。这只是 pooled 排序的局部变化，还不足以支持迁移中间件：这个小差异在重复运行中也会反转。

## 5. 真正改变判断的是 P99

到这里，典型往返的表现已经比较清楚。但如果系统在意较慢的那部分请求，一个 median 还不够；平均值虽然会受尾部影响，也不能单独告诉我尾部到了哪里。

我把 P95、P99 放进来继续看。图 4、图 5 的主线改为 pooled P99，阴影相应变为五次 repeat 的 P99 范围；横轴仍为 log2、纵轴仍为 μs 的 log10，这两张 P99 图共用纵轴范围。P95/P99 是经验分位数，不是未来运行的硬性上界或 real-time deadline 保证。

<figure>
  <img src="/images/9-ros2-rmw-zenoh-0-13-0-benchmark/04-rtt-p99-paced-10ms.png" alt="paced_10ms 下三个 RMW 的 pooled P99 RTT，展示大 payload 的尾延迟差异">
  <figcaption>
图 4：paced_10ms 的 P99 RTT。阴影为 5 次 repeat 的 P99 范围，不能解读为置信区间。<br>
<em>Fig. 4. P99 RTT versus payload under paced_10ms.</em>
</figcaption>
</figure>

paced 下，Cyclone DDS 在全部 5 个 payload 的 **pooled P95 和 P99 都最低**。不过，“这次 pooled 值最低”和“每次都稳定领先”仍然不同。例如 1 MiB paced 的 Cyclone 与 Zenoh P99 约为 **7.12 ms** 和 **7.44 ms**，两者 repeat 范围重叠，Zenoh 在 2/5 次 repeat 的 P99 更低，不能夸大这里的微小排序。

<figure>
  <img src="/images/9-ros2-rmw-zenoh-0-13-0-benchmark/05-rtt-p99-back-to-back.png" alt="back_to_back 下三个 RMW 的 pooled P99 RTT，Fast DDS 在 1 MiB 处保持较高尾延迟">
  <figcaption>
图 5：back_to_back 的 P99 RTT。与图 4 共用 P99 的纵轴范围；1 MiB 下 median 的下降没有消除 Fast DDS 的高尾部。<br>
<em>Fig. 5. P99 RTT versus payload under back-to-back request/reply.</em>
</figcaption>
</figure>

1 MiB back-to-back 是本文最值得放在一起看的一组对照。下面数值取自正式汇总，单位统一为 ms，显示到两位小数：

| Middleware | Median (ms) | P95 (ms) | P99 (ms) |
| --- | ---: | ---: | ---: |
| Fast DDS | 2.01 | 23.18 | 24.26 |
| Cyclone DDS | 1.61 | 2.92 | 3.84 |
| Zenoh 0.13.0 | 2.76 | 4.42 | 5.37 |

如果只看 median，Fast DDS 比 Zenoh 更低；看 P99，Zenoh 又明显低于 Fast DDS。Cyclone DDS 在这组 pooled median 和 P99 上都更低。

这就是开头那组结果最值得展开的地方：**同一工况，只把评价指标从 median 换成 P99，Zenoh 与 Fast DDS 的工程判断就发生了变化**。相对 Fast DDS，Zenoh 的典型往返更慢，尾延迟却更低。选择哪个，取决于应用在意分布的哪一部分；“Zenoh 比 Fast DDS 快”无法表达这件事。

back-to-back 的 64 KiB 还有一个局部交叉：Fast DDS 的 pooled P95/P99 低于 Cyclone DDS，其余 payload 是 Cyclone DDS 更低。这个点的 P99 顺序也会在 repeats 间反转，同样不能泛化成稳定优势。

## 6. 大包和通信节奏如何放大尾部

图 5 的大包尾部让我想继续追问：这种差距是怎样拉开的？从 64 B 增大到 1 MiB，Fast DDS 在 back-to-back 下的 pooled P99 增长约 **119.44 倍**。其中 64 KiB → 1 MiB 这段，P99 增长约 **64.98 倍**，是当前离散矩阵中很明显的尾部陡增区间。

我没有据此给出某个精确 payload 阈值：64 KiB 和 1 MiB 之间没有其他测点，连接两点的线只能帮助阅读，不能证明中间载荷的变化路径。

接下来要看完整分布，而不是仅盯着一个最大值。ECDF 的纵轴表示“不超过当前 RTT 的样本比例”；同一比例下，曲线越靠左表示对应 RTT 越低，曲线交叉则意味着不同分位数可能给出不同排序。

<figure>
  <img src="/images/9-ros2-rmw-zenoh-0-13-0-benchmark/06-rtt-ecdf-64b-1mib.png" alt="64 B 与 1 MiB 在两种发送节奏下的完整 RTT ECDF，保留所有样本及最大值端点">
  <figcaption>
图 6：64 B 与 1 MiB 的 RTT ECDF。每条曲线包含该 cell 全部 5,000 个 samples，横轴为 log10，纵轴覆盖完整 0–1，不裁剪尾部。<br>
<em>Fig. 6. RTT ECDFs for 64 B and 1 MiB payloads.</em>
</figcaption>
</figure>

Fast DDS 1 MiB 的 ECDF 有平台和分段上升，主体与较高 RTT 区间存在分离。这说明一个 median 无法充分表达其分布形状，但 pooled 曲线本身仍可能混合了 repeat 之间的差异。

要判断是不是某一个异常 run 拉高了 P99，还需要回到重复级结果。Fast DDS 1 MiB 的五次 repeat 中，paced P99 均在约 **24.90–25.12 ms**，back-to-back P99 均在约 **23.84–24.35 ms**。结合 ECDF，持续的高尾部不能只归结为一个 max 或一个特别差的 repeat。

目前能确认的是分布现象。本次没有做正式多峰检验，也没有测 allocator、scheduler、copy 或 SHM 各自的耗时。将平台或分段形状直接解释成某个底层机制，会超出这组数据能支持的范围。

再把两种发送节奏放在一起看，全部 **15 个 RMW × payload 组合**的 back-to-back pooled median、P95、P99 都低于 paced。但不同指标下降的幅度并不一致，应用节奏也改变了部分 middleware 的相对顺序。

Fast DDS 1 MiB 是一个清楚的例子：从 paced 切到 back-to-back，median 从约 **13.12 ms** 降到 **2.01 ms**，降幅约 **84.65%**；P99 从约 **25.08 ms** 到 **24.26 ms**，只降低约 **3.24%**。

典型 RTT 因而大幅改善，尾部却仍然处于较高区间。我用 pooled P99 / pooled median 定义 tail amplification，两种节奏下分别约为 **1.91×** 和 **12.04×**。图 7 将这个比值放到整个载荷范围里看：横轴仍为 payload 的 log2，纵轴改为从 0 开始的线性尺度。

<figure>
  <img src="/images/9-ros2-rmw-zenoh-0-13-0-benchmark/07-tail-amplification.png" alt="两种发送节奏下各 RMW 的 pooled P99 与 pooled median 比值，Fast DDS 1 MiB back-to-back 约为 12.04">
  <figcaption>
图 7：尾部放大比 P99/median。纵轴为从 0 开始的线性尺度；比值描述相对尾部，不是绝对延迟，也不是 repeat 置信区间。<br>
<em>Fig. 7. Tail amplification ratio (P99/median) across payloads and communication modes.</em>
</figcaption>
</figure>

这并不意味着 back-to-back 让 Fast DDS 的绝对 P99 更差：它实际上略有下降。真正变化的是 median 大幅降低，而 P99 没有同比改善，因此尾部相对主体显得更突出。

同样，较小的 P99/median 也不自动代表更低的绝对 RTT；如果 median 本来就高，比值可以较小。选型时仍需把两项绝对值放回来看。

发送节奏也是测试条件的一部分：回复之后停一段时间，与持续 request/reply，观察到的 RTT 并不等价。这是已有结果支持的条件差异；具体为何出现，还需要另外测量，不能凭本次数据猜测 CPU 电源状态或调度路径。

## 7. 再看 Repeat：pooled 结果不等于稳定优势

看完这些曲线，我还不能直接按 pooled 值选实现。把 5 次 run 的 5,000 个 samples 合在一起，可能会把一次较快、一次较慢的运行揉成一条平滑曲线；重复运行能否得到相近结果，需要另看。

这组结果中，paced 的 **repeat median CV** 范围约为 **1.48%–6.92%**，back-to-back 为 **5.97%–45.28%**。这里看的是五次 median 之间的波动，不是单个 cell 内样本的离散程度；计算口径见前面的折叠区。

例如 Cyclone DDS 的 64 KiB back-to-back，五次 median 分别约为 **122.02、94.09、69.99、110.25、235.27 μs**，整体范围为 **69.99–235.27 μs**。它的 pooled median 仍然很低，但不能因此说这个点的重复性最好。

<figure>
  <img src="/images/9-ros2-rmw-zenoh-0-13-0-benchmark/08-rtt-ecdf-64kib.png" alt="补充分析：64 KiB 两种发送节奏下的完整 RTT ECDF，展示分布平台与相对顺序交叉">
  <figcaption>
图 8（补充）：64 KiB 的 ECDF。用于观察 pooled 分布交叉；判断重复波动仍要结合每个 run 的 median/P99，不能只看这张合并曲线。<br>
<em>Fig. 8. RTT ECDFs for 64 KiB payloads.</em>
</figcaption>
</figure>

图 8 的读法沿用前面的 ECDF，可以看到 pooled 分布的平台与交叉；判断重复性仍需结合上面的 run 级数值。**pooled ranking 不等于 repeatability**，只展示最好的一次运行会漏掉这种波动。

## 8. rmw_zenoh 0.13.0 到底表现到什么程度

在这组 localhost RTT 对照中，Cyclone DDS 的 pooled median/P95/P99 整体更有优势；Zenoh 0.13.0 的特点则出现在部分大包尾部与 Fast DDS 的取舍上。它值得进入后续候选，但是否适合复杂网络仍需要单独验证。这里需要区分三类结论：实验直接测得的结果、由结果引出的工程判断，以及当前数据无法回答的问题。

**已测得（MEASURED）**：在这里的默认配置、Rolling、localhost 和固定硬件下，Zenoh 0.13.0 在 64 B–64 KiB 范围内的 pooled median/P95/P99，没有形成对 Fast DDS 和 Cyclone DDS 的整体优势。paced 全部 payload 的这三项 pooled 指标都是 Cyclone DDS 更低。

到了 1 MiB paced，Zenoh 的 pooled median 和 P99 均低于 Fast DDS，但高于 Cyclone DDS 的对应 pooled 值。Zenoh 相比 Fast DDS 的 P99 降低约 **70.32%**；在 1 MiB back-to-back，Zenoh 的 median 高于 Fast DDS，P99 则降低约 **77.86%**。这两种节奏下的 P99 比较均为 5/5 repeats 同方向。

三种实现都完成了这套受限协议的功能与 RTT 测试，但还没有回答长时间稳定性、全量 ROS 功能兼容性或生产系统验证的问题。

**由结果引出的判断（INFERRED）**：Zenoh 在部分大 payload 尾部指标上与 Fast DDS 呈现不同表现，值得将其作为有具体目标的候选继续评估。Fast DDS 的大包高尾部也给出了明确的后续诊断范围。这些判断用于决定下一步测什么，不能证明某个实现的设计天然优越或存在某个组件缺陷。

**尚未确认（UNKNOWN）**：scheduler、CPU 频率/电源状态、allocator、copy、SHM、router 和 transport 各自贡献多少，当前没有分解测量。默认 router 是 Zenoh 部署的一部分，但本次 RTT 不能估计它单独的代价；同样也不能从 DDS 的 RTT 反推出实际走了哪条默认传输路径。

在这些边界下，Zenoh 仍值得继续评估，但当前结果不足以支持“全面优于 DDS”这样的结论。是否用于具体机器人系统，还需要在目标系统的网络、功能和负载条件下进一步验证。

## 9. 从实验结果到 RMW 选型

如果这是一个新的 ROS 2 项目，而且通信条件接近本文的 localhost request/reply，我会先把 Cyclone DDS 作为验证起点。paced 全载荷的 pooled median/P95/P99，以及 1 MiB back-to-back 的 median/P99 都较低，足以支持这个初步选择。但 64 KiB back-to-back 的 repeat 波动同样需要关注，较低的 pooled 值不等于所有场景下都更稳健。

如果系统已经围绕 Fast DDS 跑得成熟，我不会因为这一次 benchmark 就迁移。它在某些典型延迟指标上仍有竞争力，已有系统还要考虑兼容性、维护成本和此前完成的验证。如果实际业务包含大 payload，或对尾延迟敏感，就需要在实际硬件和负载下做一次针对性复测。

如果需求包含边缘设备、复杂网络、跨网段通信，或者明确需要 Zenoh router 与原生 Zenoh 能力，我会把 rmw_zenoh 0.13.0 纳入后续候选。官方 [0.13.0 README](https://github.com/ros2/rmw_zenoh/blob/0.13.0/README.md)提供了 router 与跨 Host 连接的配置说明；本文没有测试这些场景下的表现，仍需在目标拓扑中单独验证。

新项目从哪里开始验证、已有系统是否值得迁移，以及哪些实现需要继续纳入候选，是三个不同的问题，不能压成一个 middleware 总排名。

不过，这次实验仍有一组没有回答的问题：

- 仅一台 Linux Host、一种硬件平台上的 localhost + Docker host network，没有跨设备、有线网络或 Wi-Fi 对照。
- 仅测试精确版本和 default configs，没有寻找最优参数，也没有隔离 SHM、router 或传输组件。
- 仅覆盖单请求在途的 echo，没有多节点并发或真实机器人控制链测试。
- 没有正式 throughput、discovery 或 CPU/RAM benchmark。
- 只有 5 repeats，且有中断恢复间隔；未做显著性检验，min–max 不是置信区间。
- 载荷点离散且间隔较大，不能确定 64 KiB 到 1 MiB 之间的精确阈值；ECDF 分段也不是多峰机制证明。

这些结果不代表所有 DDS、所有 Zenoh 或所有 ROS 2 系统，也不提供机器人控制的实时性保证。

## 10. 结语

如果 ROS 2 application 不变，只替换 RMW，到底会发生什么？这组结果没有给出一个简单的“速度排名”：payload、通信节奏、典型延迟、尾延迟与重复性，会让同一次比较得到不同答案。

Cyclone DDS 在这组 localhost RTT 测试中的 pooled 指标整体表现突出；Fast DDS 在 1 MiB 条件下出现了持续的高尾部；Zenoh 0.13.0 没有全面领先 DDS，但在大 payload 的 tail latency 上，与 Fast DDS 呈现出明显不同的取舍。这些现象限定在本文的实验条件内。

如果继续这条线，下一步更值得做的是把同一套比较带到跨设备网络、throughput、discovery 和真实机器人通信链路里。RMW 让 middleware 从业务代码中抽离，成为可以独立测量、比较和重新选择的工程变量。这次测试没有找到适用于所有场景的“最快中间件”，但它把原本容易沿用默认值的 middleware 选择，变成了一个可以用数据检验的工程决策。
