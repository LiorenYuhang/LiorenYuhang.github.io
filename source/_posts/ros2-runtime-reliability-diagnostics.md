---
title: 能运行，不等于可靠运行：ROS 2 机器人系统的故障诊断与工程实践
date: 2026-10-10 15:01:40
permalink: 2026/10/10/ros2-runtime-reliability-diagnostics/
tags: [ROS 2, 机器人系统, 串行通信, 运行时可靠性]
categories: 机器人
description: 从真实 6PUS 机器人项目中的 UART 超时出发，通过分层测量、反馈时效性分析、驱动三进程架构与 Executor 故障定位，讨论如何验证 ROS 2 系统能否持续、及时、可靠地运行。
---

在进行 6PUS 并联机器人的姿态闭环、连续控制和控制算法阶段性验证时，系统已经能够按照目标完成相应运动，但实机实验中偶尔会出现串口通信超时。

完成当时的算法验证任务后，我将工作重点转向长时间稳定运行、通信可靠性和 ROS 2 运行时故障诊断，开始在明确运行条件下重新捕获和分析这些异常。

排查从串口超时开始。随着测量边界和测试负载逐步扩大，反馈时效性、启动时序和动态输入下的调度问题也成为需要处理的工程问题。本文依据各次独立运行的记录，讨论这些问题如何被定位、系统为何调整，以及修改后实际验证了什么。

<!-- more -->

## 1. 从姿态闭环到长时间运行

项目中的 6PUS 并联机器人用六个直线执行器共同调整动平台位姿。主动稳定控制的目标，是在底座运动时持续调整六轴，使动平台尽量保持期望姿态。

理解本文只需要把系统看作一条周期执行链：传感器提供状态，上层控制器计算补偿位姿，逆运动学和轨迹整形生成六轴目标，驱动再通过共享串行链路发送命令并收集反馈。驱动目标频率为 **50 Hz**，周期预算为 **20 ms**，串口波特率为 **921600 baud**。

本文将六个执行器简称为“六轴”。一个六轴通信周期，是驱动依次发送六个执行器的命令并处理反馈的一轮执行，不是电机完成目标运动所需的时间。

如果某个执行器的串口命令写入超时，驱动无法仅凭异常确认这条命令是否完整发出，也不能将整轮六轴通信视为全部成功。即使写调用正常返回，也不能用这一接口结果代替对执行器反馈和实际运动的检查。通信处于闭环内部，命令发送出现缺口时，让上层控制器继续计算并不能补上执行进度。

### 固定目标下的串口超时

在一轮真机静态运行中，驱动向第一轴发送命令时抛出了 `SerialTimeoutException`。`write_timeout` 配置为 30 ms，`Serial.write` 调用经过时间（wall time）却达到 **288.828 ms**。外围串口封装（wrapper）还负责诊断和度量记录，整个封装的 wall time 为 **289.324 ms**。后面五个执行器的命令尚未开始发送，驱动没有完成本周期的六轴命令写入。

另一轮独立静态运行在第六轴也捕获到自然超时：写调用为 **61.810 ms**，wrapper 为 **61.946 ms**。图 1 保留两笔观测用于比较；下面以第一轴这笔较长事件说明诊断方法。

<figure style="text-align: center; margin: 1.5em 0;">
  <img src="/images/10-ros2-runtime-reliability/01-natural-uart-timeout.png" alt="两次独立真机静态运行中的串口超时事件，比较Serial.write 调用和wrapper的wall time" style="display: block; width: 100%; height: auto; margin: 0 auto;">
  <figcaption style="position: static; display: block; margin-top: 0.7em; font-size: 0.85em; font-weight: normal; line-height: 1.6; color: inherit; text-align: center;">
图 1：两次独立静态真机运行的自然 Timeout 观测。虚线为配置的 30 ms 写超时；柱值为应用层调用与 wrapper 的 wall time，不是 native syscall 耗时，也不是重复试验的分布统计。<br>
<em>Fig. 1. Two natural timeout events from separate static hardware runs. Dashed line: configured 30 ms write timeout. Bars show application call and wrapper wall time, not native syscall duration or a repeated-trial distribution.</em>
  </figcaption>
</figure>

写调用未正常完成，应用实际经过时间也超过了配置超时。PySerial 没有提供异常时的部分写入字节数，因此驱动将这次发送记录为 uncertain，即写入结果不确定。其他执行器的命令也按各自记录区分：写调用正常返回、尝试写入但结果不确定、尚未尝试。六轴候选目标是一组待发送命令，不能仅因已经生成就视为全部发送成功。

超时日志指出了失败的接口，却没有解释为什么应用经过时间远超 30 ms。`Serial.write` 的进入到返回或抛异常，覆盖的是整个 Python 调用区间；底层系统调用（syscall）、等待和线程调度尚未分离，配置超时也不是应用 wall time 的硬上界。

要继续定位，就需要同时观察线程实际执行了多久，以及外围封装在写调用前后做了什么。自然 UART Timeout 的底层根因尚未完全确认，分层测量从这条可记录的调用边界展开。

## 2. 串口超时背后的耗时问题

### 区分经过时间与 CPU 时间

在这笔第一轴超时记录中，写调用经过 **288.828 ms**，写线程实际取得的 CPU 时间却只有约 **8.730 ms**。前者是单调时钟测得的经过时间，在线程等待或暂时未执行时仍会增长；后者是线程获得处理器执行的时间。两者相差很大，排查就不能只盯着写线程计算量，还要观察调用内的等待与调度。

同一事件外围采样的进程 CPU 增量约 **308.016 ms**。进程 CPU 汇总多个线程的活动，采样端点也未与写调用完全重合，因此它高于写调用 wall time 并不矛盾。它用于描述进程整体负载，不用于从调用 wall time 中扣除“等待时间”。这些观测缩小了排查方向，尚未定位具体底层调用、调度竞争或 Python 全局解释器锁（GIL）的独立贡献。

在实际记录中，时间被分成明确的端点：

- **写调用 wall time**：进入 `Serial.write` 前取时，正常返回或抛出异常后取时；同时采集该线程 CPU 端点。
- **wrapper wall time**：外围封装的进入至退出，包含写前队列诊断（queue-before）、写调用、写后队列诊断（queue-after）和其余封装区间。
- **驱动周期 wall time**：本轮六轴周期的开始至结束；**cycle interval** 则是相邻周期开始时间之差。
- **反馈 gap**：相邻反馈接收事件的间隔，用于观察接收节奏。

### 将写调用与外围封装分开测量

Wrapper 是驱动在 `Serial.write` 外围增加的一层串口封装。它除了调用写接口，还负责诊断和度量记录，所以从进入 wrapper 到退出的总时间，覆盖了比写调用更大的区间。

这里的 queue 指串口接口的收发缓冲状态，诊断会查询待发送字节数（`out_waiting`）和待读取字节数（`in_waiting`）。queue-before 在写调用前取得快照，queue-after 在写调用结束后取得快照，并分别记录查询耗时。它们辅助观察接口缓冲状态，不是 ROS 消息队列，也不是六轴目标的排队长度。

`Serial.write` 则把当前执行器的协议帧交给串口写入接口。本文测量它从调用开始到正常返回或抛出异常的经过时间；串口底层 syscall、等待和调度仍包含在这段调用内，写调用结果也不等同于执行器已经完成运动。

对同笔记录，wrapper 总时间包含四个组成区间：**queue-before、Serial.write、queue-after，以及其余封装开销**。其余开销包括这些区间之外的封装工作。记录写调用结束端点时，必须先取 wall 和线程 CPU 时间，再进行 queue-after 查询，才能避免把诊断耗时误记成串口写入耗时。

正常路径和异常路径都按这一原则测量。真实实现捕获写异常后，先记录写调用结束端点，再查询 queue-after、保存度量，最后转换为驱动异常。未处理的异常会在 Python 的 `finally` 结束后继续传播，不能把写在 `try/finally` 后的查询当作异常路径必然执行的操作。

一次独立真机静态测试记录到 **73.388 ms** 的 wrapper 长尾，其中写调用只有 **0.046 ms**。写前查询为 **0.016 ms**，写后查询为 **73.256 ms**，其余封装开销为 **0.069 ms**。

wrapper 和 queue-after 都在 73 ms 左右，是因为后者已包含在前者之中，并占据了绝大部分时间。这一事件的长尾主要发生在写调用结束后；两个数值描述的是总区间与其内部区间，不能再次相加。图 2 保留原始精度，正文各项独立舍入为三位小数。

<figure style="text-align: center; margin: 1.5em 0;">
  <img src="/images/10-ros2-runtime-reliability/02-wrapper-diagnostic-boundaries.png" alt="一笔真机写入的wrapper总时间及其四个内部区间，诊断区间主导长尾" style="display: block; width: 100%; height: auto; margin: 0 auto;">
  <figcaption style="position: static; display: block; margin-top: 0.7em; font-size: 0.85em; font-weight: normal; line-height: 1.6; color: inherit; text-align: center;">
图 2：同笔写入的 wrapper 总时间与内部区间。内部区间横轴为 ms、对数刻度；wrapper 已包含这些区间，不与它们再次相加。<br>
<em>Fig. 2. Wrapper total and internal intervals from one matched write event. Component axis: ms, logarithmic scale. The wrapper already includes these intervals; do not add the total to its components.</em>
  </figcaption>
</figure>

另一次 300 秒运行也保留了类似事件：wrapper 约 **115.562 ms**、写调用约 **0.045 ms**、queue-after 约 **115.454 ms**。类似记录确认了队列诊断区间可以主导 wrapper 长尾，查询本身的执行与调度影响尚未分离。这里定位到的是外围诊断开销，不是物理串口阻塞，也不是所有自然 UART Timeout 的根因。

这笔记录给出了可直接实施的调整：生产运行与资格测试关闭 TX queue 查询，只在 debug 模式保留。改变的是外围诊断路径，串口写调用仍使用原来的测量端点。

关闭后，30 秒、60 秒静态测试的 wrapper 最大值分别约 **0.423 ms**、**0.359 ms**，队列度量不再出现在这条执行路径。运行时长和样本集合不同，最大值比值不用于估计普遍的长尾概率改善倍数。

这次定位也改变了诊断策略：周期路径优先保留端点与序列，细粒度快照按问题开启。日志、对象构建、队列查询和观察线程都需要执行预算，测量能力本身也是运行负载的一部分。

队列诊断长尾是在三进程架构及启动协调完成后定位到的。而在此前的进程隔离实验中，另一类问题已经暴露出来：即使 UART 周期能够持续执行，反馈也未必能及时到达 ROS。

## 3. 串口独立之后，反馈为什么还会延迟

### 消息持续到达，数据却已滞后

为观察 UART 与 ROS 执行路径的相互影响，排查中将 UART 移入独立通信进程，称为 **UART Child**；原驱动的 ROS 进程称为 **Parent**。Child 产生反馈，通过进程间通信（IPC）送到 Parent 接收与发布。串口有了独立执行环境，反馈到达 ROS 的过程仍需检查。

一轮静态测试中，Parent 持续收到反馈，但部分反馈到达时已比 Child 准备好这份数据的时刻晚了数百毫秒。这里用 Age 表示数据相对选定源时刻已有多久，观察的是接收时的反馈新鲜度，不能全部理解为串口传输耗时。

从 **Child feedback-ready 到 Parent receive** 的中位数约 **0.503 ms**，P99（99% 分位数）约 **430.386 ms**，最大值约 **792.706 ms**。常见样本很快，尾部却已远超 20 ms 周期；仅看消息是否持续到达，就会漏掉这类滞后。

另一轮静态测试进一步记录反馈接收、反馈发布路径（telemetry）的唤醒、构建完成、publish 进入和退出时间。图 3 展示这轮测量，而非前一轮数据滞后统计的补充分段。

<figure style="text-align: center; margin: 1.5em 0;">
  <img src="/images/10-ros2-runtime-reliability/03-feedback-freshness-boundaries.png" alt="接收时的数据滞后、telemetry唤醒至构建完成耗时和发布时的数据滞后的分布" style="display: block; width: 100%; height: auto; margin: 0 auto;">
  <figcaption style="position: static; display: block; margin-top: 0.7em; font-size: 0.85em; font-weight: normal; line-height: 1.6; color: inherit; text-align: center;">
图 3：另一轮静态测试的三个指标：接收时的数据滞后、唤醒至构建完成耗时与发布时的数据滞后。接收样本 1435 条，构建／发布样本 1161 条，分位数或最大值不可跨集合相加；横轴为 ms、对数刻度。<br>
<em>Fig. 3. Receive age, wake-to-build duration and publish-exit age from a separate static run. Receive n=1435; build/publish n=1161. Do not add percentiles or maxima across these populations. Horizontal axis: ms, logarithmic scale.</em>
  </figcaption>
</figure>

接收时的数据滞后、唤醒至构建完成耗时、发布时的数据滞后都出现了长尾。分层记录让排查区分两种情况：数据到达发布路径时已经旧了，或发布侧处理又消耗了时间。消息很旧，未必是某一次 publish 调用很慢。

接收与发布样本并非一一对应。该路径使用最新值快照（latest snapshot），更新的反馈会覆盖旧快照，部分接收记录不会成为发布记录。各分布用于寻找延迟位置，不能把它们的最大值相加；不同运行中的极值更不构成同一条消息链。

图中的 **Receive age** 是接收时的数据滞后，即 **IPC age**：接收时刻减去 Child ready 时刻。早期接收者是 Parent，最终架构中是 Bridge。**Publish-exit age** 表示发布时的数据滞后，从 Child ready 量到最后一个记录的 publish 调用退出；它包含此前的等待和处理，不是这一次 publish 调用的耗时。

订阅端完整的 **Message Age** 还需要消费者（consumer）的接收时刻和明确的源时间戳。现有早期实验没有独立 consumer 的接收记录，因此 Publish-exit age 保留为发布时的数据滞后。Child ready 也晚于硬件采样和串行获取；完整 end-to-end age 需要补齐这些上游过程与 consumer 终点，并使用可比较的时钟。

**Feedback Age／watchdog age** 用于看门狗判断反馈是否过期：检查时刻距离上一次有效反馈有多久，必须说明有效反馈在哪一层被确认。**callback gap／feedback gap** 描述相邻事件的节奏，age 描述某份数据的新鲜度。接收者可以持续处理旧数据，也可以跳过中间状态只消费最新值，二者的完整性要求不同。

接收和发布路径都有可见长尾，单独移出 UART 还没有解决反馈及时推进的问题。测量已把需要调整的职责指向反馈消费与发布，但没有直接测出 DDS 队列深度，因此不将消息积压认定为已确认根因。

### 将反馈发布从 Parent 移出

旧驱动在同一进程中安排 ROS callback、UART worker 和 telemetry 发布。保存的旧源码使用三线程 `MultiThreadedExecutor` 调度就绪的 ROS callback，订阅、串口任务定时器（UART worker timer）和状态轮询定时器（poll timer）分属不同回调组（callback group）。

启用独立线程（dedicated-thread）模式时，伺服周期改由独立 Python worker 执行；异步 telemetry 发布也使用自己的 worker。这两类独立 Python worker 不属于 Executor 的三线程池，但仍共享同一进程。

上层控制器和运动学节点已有独立 ROS 进程，此次调整集中在驱动内部。Executor 线程池、Python worker 与通信进程是不同层级，分别承担回调调度、后台任务和串口资源隔离。

UART Child 不加载 ROS，独占串口，承担 50 Hz 六轴通信周期和本地安全检查。反馈仍由 Parent 接收、发布时，前面的数据滞后长尾依然存在，于是进一步增加独立 **Feedback Bridge**，专门消费反馈 IPC、构建并发布 ROS 消息。

最终，Parent 保留命令入口、最新目标缓存、供给有效期（lease）发送和健康协调，UART Child 负责硬件执行，Bridge 负责反馈进入 ROS。

<figure style="text-align: center; margin: 1.5em 0;">
  <img src="/images/10-ros2-runtime-reliability/04-three-process-runtime.png" alt="驱动侧Parent、UART Child和Feedback Bridge的职责、命令和反馈路径" style="display: block; width: 100%; height: auto; margin: 0 auto;">
  <figcaption style="position: static; display: block; margin-top: 0.7em; font-size: 0.85em; font-weight: normal; line-height: 1.6; color: inherit; text-align: center;">
图 4：三个进程划分的是驱动侧职责，上层控制器和运动学节点已有独立进程。反馈 IPC age 量到 Bridge 接收处，下游消费者的完整 Message Age 另需测量。<br>
<em>Fig. 4. The three processes divide driver-side responsibilities; the controller and kinematics nodes already have separate processes. Feedback IPC age ends at Bridge receipt. Full downstream consumer Message Age requires separate measurement.</em>
  </figcaption>
</figure>

这种划分缩小了共享执行环境和资源所有权范围，也让故障可以按进程定位。进程隔离本身不提供严格实时保证；Parent、Bridge 与下游消费者是否及时推进，仍须各自验证。

Parent 收到目标时，以带序列的最新目标记录（latest-target envelope）覆盖尚未消费的旧目标；发送成功后消费它。连续目标控制由此避免在驱动应用层排队执行历史命令。这一策略适用于持续刷新的目标流，离散任务是否允许丢弃历史命令，需要按其语义设计。

有新目标时，Parent 发送携带目标的状态包（state packet）；没有新目标时，仍维持约 **100 ms heartbeat**，以心跳刷新供给有效期。命令 IPC 使用非阻塞 seqpacket，即保留报文边界的进程间套接字，成功发送后才更新本地记录。Child 保存有效 lease 时间，并检查 **1000 ms** 门限。

lease 在这里是 Parent 持续供给状态的应用层有效期。latest target 决定执行哪个目标，lease 检查供给者是否仍在推进。目标超时另有配置，1000 ms 不是允许控制命令陈旧一秒。它也不是 DDS QoS Deadline／Liveliness；本文没有对应 QoS 事件实验。

### 启动时也要保证反馈完整

增加 Bridge 后，还出现过启动缺口：Child 已开始产生周期反馈，Bridge 尚未被协调到同一个启动屏障。

未协调的 30 秒测试中，Child 保存 1500 条周期记录，Bridge 接收 1495 条，缺失序列为 **7～11**；第一条 Bridge 接收记录的 IPC age 约 **244.067 ms**。丢失发生在 Child→Bridge 的 IPC 边界，不是已证实的 ROS 订阅端丢包。

修复后，Parent 等待 Child 和 Bridge 都报告就绪，再授权 servo start，让反馈生产者和消费者从协调后的边界开始工作。

**表 1：协调启动前后的反馈 IPC 完整性。**

| 启动方式／窗口 | Child 周期数 | Bridge 接收数 | 缺失序列 | 重复数 |
| --- | ---: | ---: | --- | ---: |
| 未协调，30 s | 1500 | 1495 | 7～11 | 0 |
| 协调握手，30 s | 1500 | 1500 | 无 | 0 |
| 协调握手，60 s | 3000 | 3000 | 无 | 0 |

两次修复后测试均得到完整的 Child→Bridge 序列。启动窗口摘录支持握手顺序和缺失位置，全程序列集合统计来自实验主机的完整记录重算。该结果验证到 Bridge 接收边界，下游 ROS 订阅端是否逐条接收仍是另一个问题。

最终测试中，从 Child ready 到 Bridge receive 的 IPC age，静态 60 秒运行的 P99 约为 **0.692 ms**，PID 控制和 LADRC 控制动态回归分别约为 **0.666 ms**、**0.665 ms**。这说明修改后的反馈 IPC 路径在这些负载下及时推进，详细统计留在第六章。它们来自不同运行，接收端也从早期 Parent 改为 Bridge，因此不作为严格单变量对照，亦不是完整订阅端 Message Age。

通信执行、命令供给和反馈发布有了明确的进程边界，启动也有了可核对的序列。可靠性验证还要让这套架构承受更长的固定目标运行，以及持续更新目标的真实控制负载。

## 4. 静态测试通过，动态控制却再次停止

### 固定目标运行通过，执行链仍需检查

关闭生产队列诊断、完成启动协调后，真机静态通信扩展到 **600 秒**。该轮保存 **29995 个 Child 周期**，没有 TX Timeout、硬件 fault 或 Child→Bridge 缺失记录，同时发生了 **3 次 deadline re-anchor**。

re-anchor 是周期调度期望时间的重新锚定，不是 IPC 丢包。这轮结果验证了固定目标下的持续通信与反馈完整性，并保留了调度修正记录；它没有达到“严格 30000 周期、零重置”的条件。

固定目标下的十分钟记录尚未覆盖持续变化的命令流。重新接入真实控制负载后，两个惯性测量单元（IMU）的输入、控制器输出、逆运动学、接口适配和命令回调共同运行，验证对象变成这些组件能否持续形成完整执行链。

正常的主动稳定过程中，底座姿态变化后，控制器利用底座和动平台的双 IMU 状态计算补偿目标，经运动学和轨迹整形转换成执行器命令，调整动平台姿态。动态接入检查的，就是这条补偿过程是否真正推进。

动态运行验证分别使用 **PID 控制**和**线性自抗扰控制（LADRC 控制）**，目的是检查真实控制负载下的执行链，本文不比较两种控制算法的抗扰性能。

早期动态接入遇到反馈接口不匹配：独立 Bridge 发布的带时间信息的反馈（timed feedback）需要适配旧接口，JointState 话题也要匹配既有消费者。测试使用消息转接节点（relay）完成兼容，它位于驱动三进程之外，在最终回归中仍参与链路。

然而，在一轮早期动态测试中，底座姿态已经变化，控制器也进入了 ACTIVE，六个执行器的命令却没有出现预期变化。**2945 条 ACTIVE 记录**中，六轴电机命令（motor command）的范围全部为 **0**：每个执行器命令的最大值与最小值相同。

如果只看控制器状态和输入更新，这轮运行似乎已经开始工作；检查命令流后才发现，预期的补偿目标没有表现为变化的六轴命令。命令不变不能直接证明所有电机都没有物理运动，但已经足以促使我们沿控制器输出、运动学目标和驱动写入继续检查，并在回归中同时核对命令与反馈变化。

### STOP 来自 Parent lease 过期

另一次独立真机测试已经启用三进程驱动、协调启动和资格测试（qualification）记录模式，以 PID 控制器产生动态 ROS 目标。Child 从 servo start 到 STOP 约 **9.18 秒**；控制器已进入 ACTIVE，停止原因是 `parent_lease_expired`，而非串口 Timeout。

这轮日志在停止前保留了轻微姿态变化。它是接口接通后的另一次运行，与前面的恒定命令测试及后面的修复回归分别取证，接口问题和这次 STOP 没有被认定为直接因果。

串口没有报错，应用层安全门却触发了。将三个进程的记录按同一时间轴对齐，就能检查谁先失去推进：以 Child STOP 为零点，停止前 Child 仍按周期运行，Bridge 持续接收反馈；Parent 成功发送记录却出现了空白。

最后一次成功 lease 刷新距 STOP 为 **1005.654713 ms**，符合 Child 的 1000 ms 门限。最后一次成功发送到 Parent 下一次发送之间则相隔 **1045.614037 ms**，这是两条成功发送记录之间的供给间隔。一个量到 STOP，另一个量到发送恢复，不能混称为同一个故障延迟。

<figure style="text-align: center; margin: 1.5em 0;">
  <img src="/images/10-ros2-runtime-reliability/05-parent-lease-failure.png" alt="Parent发送中断期间Child周期与Bridge反馈持续推进，Child触发lease停止" style="display: block; width: 100%; height: auto; margin: 0 auto;">
  <figcaption style="position: static; display: block; margin-top: 0.7em; font-size: 0.85em; font-weight: normal; line-height: 1.6; color: inherit; text-align: center;">
图 5：同次真机运行的发送、周期和接收记录，以 Child STOP 为零点。下图曲线由成功发送时间戳重建，并非连续实测的 Child age；STOP 由 Child 记录确认。横向虚线为 1000 ms lease 门限，纵向虚线为 STOP。<br>
<em>Fig. 5. Send, cycle and receive records from one hardware run, aligned to Child STOP at t=0. The lower curve is reconstructed from successful-send timestamps, not continuously measured Child age; STOP is confirmed by the Child log. Dashed lines: horizontal, 1000 ms lease threshold; vertical, STOP.</em>
  </figcaption>
</figure>

这次停止的直接原因是 Parent lease 过期。记录没有 UART Timeout 或 Child 通信 fault，调大 lease 门限只会推迟故障响应，不会补回 Parent 的发送进度。Parent 在同一次运行内随后又发包，记录了发送恢复；这一事后记录未提供中断时刻独立的操作系统存活检查。

通信进程仍在工作，反馈也在流动，供给目标和 lease 的 Parent 却出现了超过一秒的空档。停止的直接原因已经明确，尚需解释的是 Parent 为何没有及时发包。排查因此转向它在动态输入下的执行活动。

## 5. 定位 Parent 的调度异常

### CPU 活跃，命令处理却不足

Parent 的成功发送记录出现超过一秒的空档，而 Child 和 Bridge 仍在运行。要解释这个现象，需要查看 Parent 自己在做什么。后续软件测试保留真实 **50 Hz ROS 消息输入**，用 Mock 替代 UART Child，继续施加命令回调负载，同时把真实串口事务与软件执行路径分开检查。

修复前测试中 Parent 实际接受约 **23.40 Hz**，进程 CPU 中位占用约 **72.61%**，按一核 100% 计。输入仍是 50 Hz，接收却不足一半；CPU 也并不空闲。CPU 占用统计包含整个进程的活动，不能据此认为它正在高效处理命令，于是排查转向执行调度是否消耗了额外开销。

性能剖析（profile）记录函数调用活动，用来观察忙碌的进程究竟在反复做哪些工作。

rclpy 的 **Executor** 负责发现并执行就绪的 ROS callback，相当于 Parent 内部的回调调度入口。修复前它使用 `MultiThreadedExecutor(num_threads=3)`，参数 3 是 callback 线程池的工作线程数，与图 4 的三个进程没有对应关系。此时命令 callback 主要更新有界的最新目标或请求停止，UART 与反馈发布已在其他进程，lease 发送也由独立 Python 线程负责。

为了看调度活动是否真正带来了命令处理，重点检查 `get_nodes`、`EventHandler.is_ready` 与 `_take_subscription`。`get_nodes` 取得 Executor 管理的节点集合，`is_ready` 检查事件是否就绪，二者体现就绪检查路径的活动；`_take_subscription` 与从订阅中获取消息有关。把这些调用与实际命令接收数量放在一起，就能看到检查很多次之后，是否取得了相应的业务进展。

两份原始 profile 中，多线程配置的 `get_nodes`／`EventHandler.is_ready` 调用数为 **31212／311972**，`_take_subscription` 为 **66**；改用单线程后，三项为 **802／8010／400**。两份完整 profile 的实际时长尚未确认一致，这些调用总数不换算成同窗口调用频率或效率倍数。独立 8 秒输入窗口则有明确边界，实际命令接受数从 **65** 变为 **400**。

<figure style="text-align: center; margin: 1.5em 0;">
  <img src="/images/10-ros2-runtime-reliability/06-executor-profile.png" alt="软件Mock诊断的Executor全程调用计数和独立8秒命令窗口" style="display: block; width: 100%; height: auto; margin: 0 auto;">
  <figcaption style="position: static; display: block; margin-top: 0.7em; font-size: 0.85em; font-weight: normal; line-height: 1.6; color: inherit; text-align: center;">
图 6：UART 使用 Mock。上图为含启动、清理的完整 profile 调用总数，两份全程时长未确认一致；下图为独立 8 秒命令窗口。不能据此合成同窗口调用频率；调用数横轴为对数刻度。<br>
<em>Fig. 6. UART is mocked. Top: full-profile call totals including startup and cleanup; equal total durations have not been confirmed. Bottom: a separate 8 s command window. These scopes must not be combined into matched-window call rates. Call-count axis: logarithmic scale.</em>
  </figcaption>
</figure>

修复前的 profile 中，就绪检查调用很多，订阅获取与实际命令接收却少。保存的入口补丁针对 `ProductionDriverNode` 改用 `SingleThreadedExecutor`，让 ROS callback 在 spin 线程内执行；其他驱动分支仍保留原来的三线程配置。关键原始代码如下，节点创建、初始化与退出清理已省略：

```python
executor=(SingleThreadedExecutor() if isinstance(node,ProductionDriverNode)
          else MultiThreadedExecutor(num_threads=3))
executor.add_node(node);executor.spin()
```

Parent 适合尝试单线程，是因为其职责已发生变化：串口事务和反馈发布移出后，留下的是更新最新目标、请求停止等短 callback。单线程 Executor 在 spin 路径内直接执行这些任务，减少了这里对线程池调度的依赖。UART Child 仍作为独立进程执行六轴通信和本地安全检查，并不会随这次修改重新进入 ROS callback；lease 也仍由 Parent 的独立 Python 线程发送。

lease 由独立 Python 线程发送，仍与 Parent 的其他任务共享处理器资源和 Python 运行时。保存的 `send_state()` 源码显示，发送前还需取得状态锁（`self.lock`），读取目标和停止状态。未进入停止流程时，即使没有新目标，满足约 100 ms 的 heartbeat 条件也会尝试发送；只有发送成功才刷新本地 lease 记录。因此，命令接收不足本身并不足以解释 lease 断供。

实验确认了就绪检查调用放大、业务接收不足，以及修改 Executor 后命令和 IPC 供给恢复，强烈支持 **Parent 的 Executor 执行开销与供给异常有关**。补丁提出的机制解释是：就绪订阅的线程池 handler 尚待执行时，Executor 重复扫描 wait-set（等待 ROS 实体就绪的集合）。累计 profile 尚不能确认这一精确时序，也没有直接记录它如何影响独立 lease 线程。

成功发送记录的空档，仍无法区分线程未推进、锁等待或发送尝试未成功。现有摘录缺少完整发送循环、目标移交过程及逐事件的线程调度记录，因此不将具体竞争过程认定为根因；GIL 与 Fast DDS 原生唤醒路径的独立贡献也仍未确认。

这是针对当前短 callback、职责已拆分的 Parent 所作的选择。需要并行处理长 callback 的节点有不同约束，不能据此推广为 ROS 2 一律使用 SingleThreadedExecutor。

### 保留动态输入做软件回归

修复后完成 **60 秒、300 秒动态 Mock 回归**，两轮实际接收均恢复到约 **50 Hz**。Parent CPU 中位占用为 **8.49%／8.35%**；成功 IPC 发送间隔 P99 从约 **276.088 ms** 降为 **21.253 ms／21.291 ms**，最大值为 **30.831 ms／33.636 ms**。串口和反馈进程保持隔离，lease 门限没有改变。

<figure style="text-align: center; margin: 1.5em 0;">
  <img src="/images/10-ros2-runtime-reliability/07-dynamic-ipc-regression.png" alt="50Hz真实ROS输入下动态Mock修复前后成功IPC发送间隔的分位数和最大值" style="display: block; width: 100%; height: auto; margin: 0 auto;">
  <figcaption style="position: static; display: block; margin-top: 0.7em; font-size: 0.85em; font-weight: normal; line-height: 1.6; color: inherit; text-align: center;">
图 7：真实 50 Hz ROS 输入下的动态 Mock 回归。统计各自保存窗口内成功发送记录中 lease 时间戳的相邻间隔，不是反馈 IPC age 或连续 Child lease age；横轴为 ms、对数刻度。<br>
<em>Fig. 7. Dynamic Mock regressions with real 50 Hz ROS input. Statistics use intervals between lease timestamps recorded for successful sends within each saved window, not feedback IPC age or continuous Child lease age. Horizontal axis: ms, logarithmic scale.</em>
  </figcaption>
</figure>

另一次静态 Mock 回归的发送间隔中位数约 **102.138 ms**，对应约 100 ms heartbeat；动态命令输入则约每 20 ms 推进。两类发送策略不同，静态间隔较长不表示修复退化。

CPU 采样包含阶段观察线程，前后观测配置不完全相同，profile 本身也扰动执行。这些数值描述已保存条件下的改善，不作通用 Executor 效率排名或严格单变量因果量化。

300 秒 Mock 中还出现过 Child 约 **110 ms wall／109 ms 线程 CPU** 的计算长尾，Parent 当时仍约 20 ms 发送。这是独立的软件现象，物理 UART 和 Python 垃圾回收（GC）均未被确认为其原因，Parent 修复也没有赋予 Child 严格周期保证。

软件回归验证了动态 ROS 输入下的命令接收和 IPC 供给恢复，真实串口事务、执行器反馈及退出暂停尚未在 Mock 中受到同样检验。最终验证仍要回到实际机器人。

## 6. 真机验证与工程总结

### 回到实际控制负载

修复后的两次独立真机回归分别使用 PID 控制和 LADRC 控制路径，手动扰动底座，使控制器持续产生姿态补偿目标。两轮均记录到六轴命令与反馈范围非零，没有串口 Timeout、Child fault cycle 或 Child→Bridge 缺失，退出暂停得到六轴响应。

PID 控制回归也有 **2945 行 ACTIVE**，与早期恒定命令测试数量相同；但它来自另一轮运行，并具备实际命令、反馈变化。验证结论由这些记录共同决定，不由 ACTIVE 行数单独决定。

**表 2：修复后两次动态真机回归。**

| 验证项 | PID 控制动态回归 | LADRC 控制动态回归 |
| --- | ---: | ---: |
| 控制器记录行数 | 2999 | 2997 |
| 其中 ACTIVE 行数 | 2945 | 2942 |
| Driver session 时长 | 70.567 s | 70.773 s |
| Driver session 周期数 | 3529 | 3539 |
| 六轴命令与反馈范围 | 均非零 | 均非零 |
| 串口 Timeout／Child fault cycle | 0／0 | 0／0 |
| Child→Bridge 缺失／重复 | 0／0 | 0／0 |
| 退出阶段 Pause 响应 | 6/6 | 6/6 |

Pause 响应发生在退出阶段，没有计入 ACTIVE 窗口。两轮控制器记录约 60 秒，ACTIVE 跨度约 **58.9 秒**；driver session 从 servo start 延续到停止，覆盖约 70 秒，包含控制窗口之外的运行。控制器与 Child 分别采样，3529／3539 不能除以名义 3000 来计算控制器周期完整率。

下面保留 P99 与观测最大值，分别展示尾部分布和最慢样本。P99 使用线性插值分位数，最大值不是未来运行的硬上界。表中的反馈 IPC 数据滞后从 Child 准备好反馈量到 Bridge 接收；启动间隔和接收间隔分别取相邻事件的时间差。

**表 3：完整 driver session 的指标；单元格为 P99／Max，单位 ms。**

| 测量指标 | 修复后静态 60 s | PID 控制动态回归 | LADRC 控制动态回归 |
| --- | ---: | ---: | ---: |
| 单轴 Serial.write 调用 wall | 0.104／0.222 | 0.099／1.611 | 0.108／2.874 |
| 单轴 wrapper wall | 0.149／0.359 | 0.150／1.654 | 0.153／2.951 |
| Child 单周期执行耗时 | 7.598／11.471 | 7.618／11.983 | 7.664／10.471 |
| Child 相邻周期启动间隔 | 20.169／20.284 | 20.144／20.687 | 20.123／21.181 |
| 反馈 IPC 数据滞后 | 0.692／0.984 | 0.666／1.336 | 0.665／1.412 |
| Bridge 相邻反馈接收间隔 | 20.850／24.063 | 20.937／24.163 | 21.045／24.203 |

串口写调用（write）样本数为 **18000、21174、21234**，cycle 样本数为 **3000、3529、3539**；相邻 gap 比接收记录少一条，不补首个 0 ms。静态列对应独立的修复后 60 秒运行，未与 600 秒测试混用。

在这两种动态负载下，典型周期和反馈 IPC age 处于接近量级，write 最大值有所不同。保存材料没有给出可复现的施力步骤，也没有相匹配的扰动方向、幅值与时间，因此结果用于验证运行链和时序，不用于 PID 控制与 LADRC 控制的性能排名，也不评价主动稳定精度。

### 恢复与退出的验证边界

早期 Timeout 恢复测试分别覆盖了暂停、反馈刷新和恢复运行。一轮暂停（Pause）得到 **6/6** 响应，但状态刷新不完整；另一轮取得六个执行器的新鲜反馈状态（fresh state）后进入保持状态（HOLD），没有恢复运动；随后一轮按刷新状态重新锚定目标，并首次恢复固定目标运行（static resume），却在继续运行中再次 TX Timeout，最终停止。这里重新锚定的是恢复目标，与第四章周期调度时间的 deadline re-anchor 含义不同。

这些记录分别验证了暂停、状态刷新、目标重新锚定和首次恢复。首次 resume 成功没有覆盖恢复后的持续运行，因此局部成功不能作为完整恢复资格通过。

运行、恢复与退出也应分开看。中间测试出现过重复 shutdown、relay 清理超时；最终两轮退出记录确认串口释放、无残留进程。这些退出结果只描述对应历史运行，既不掩盖运行故障，也不倒写成运行中的 UART 异常。

### 以执行进度判断可靠性

此次改进形成了一组具体结果：生产通信路径移除了队列诊断开销，握手补齐了 Bridge 启动序列，动态输入下 Parent 的命令与 lease 供给恢复，最后又完成了两轮真机运行链验证。

更容易迁移到其他项目的是诊断与验证方式：

1. **以同一事务的端点定位耗时。** 写调用、wrapper、周期、gap 和 age 各自记录，先找到长尾区间，再决定深入哪一层。
2. **沿同一事件链寻找首次失去推进的位置。** 供给流中断时对齐 Parent、Child 和 Bridge，才能区分驱动执行、数据传递与 ROS 调度。
3. **按职责决定执行方式。** 独占硬件、独立反馈消费与短命令 callback，为 Executor 选择提供具体条件。
4. **用真实业务进度验证状态标签。** 静态通信、动态目标、启动、恢复与退出分别取证，ACTIVE 和 Topic 更新都要与实际命令、反馈变化对应。
5. **让修复承受原来的负载。** 保留动态 ROS 输入做软件回归，再回到硬件；同时给测量本身留出执行预算。

自然 UART Timeout 的底层根因、下游完整 Message Age，以及长期动态可靠性仍需要进一步验证。600 秒静态运行、300 秒 Mock 和两次短时动态真机回归，分别回答了不同问题，不能合成一份长期可靠性资格。

机器人按目标运动，是功能链已经接通的证据。持续可靠运行，还需要执行进度、数据新鲜度和故障响应在相应负载与时间窗口下共同成立。这是此次实践最终建立的判断方式。

<details>
<summary>实验环境与测量方法</summary>

硬件记录来自 ROS 2 Jazzy、Python 3.12、`rmw_fastrtps_cpp` 环境；串口为 921600 baud，驱动目标周期为 20 ms。中间件精确小版本未形成完整快照，结果限定在所记录的系统条件下。

数据来自实际运行的时间戳、周期与序列记录，以及原始 profile。序列完整性由实验主机完整日志的集合核对得到；各项计时保留独立端点、样本集合和测试窗口。

软件测试使用真实 ROS 动态输入与 Mock UART Child，真机回归使用真实通信与执行器。两类结果按各自负载和测量边界解释。

</details>
