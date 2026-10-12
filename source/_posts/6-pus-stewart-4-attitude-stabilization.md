---
title: 6-PUS Stewart并联机构研究（四）：主动姿态稳定——控制方案对比与工程实践
date: 2026-10-12 00:00:00
permalink: 2026/10/12/6-pus-stewart-4-attitude-stabilization/
tags: [Stewart平台, 并联机器人, 6-PUS, ROS 2, 实机控制, 双IMU, PID控制, LADRC, 主动姿态稳定]
categories: 机器人
description: 基于双 IMU 与共同的 SO(3) 前馈链路，比较 6-PUS Stewart 实机的 PID、LADRC 姿态残差控制，分析人工扰动、输出限幅、偏心负载、过流与输入时效对控制效果和运行可靠性的影响。
mathjax: true
---

<style>
.stewart4-table { max-width: 100%; margin: 1em 0; }
.stewart4-table table { min-width: 600px; font-variant-numeric: tabular-nums; }
.stewart4-table th, .stewart4-table td { white-space: nowrap; }
.stewart4-table.compact table { min-width: 420px; }
.stewart4-table.wide table { min-width: 850px; }
</style>

## 引言：从实机运动到主动稳定

在前面的研究中，我已经完成了 6-PUS Stewart 平台的运动学建模、仿真以及 [ROS 2 实机控制](/2026/09/16/6-pus-stewart-3-ros2-real-hardware/)。接下来，就要让这套机构真正发挥主动姿态稳定的作用：当手持基座发生倾斜或晃动时，如何让动平台尽可能保持原来的姿态？

仅依靠运动学补偿是否足够？加入姿态反馈和扰动估计后，又能带来怎样的变化？为了回答这些问题，我分别尝试了前馈、PID 和 LADRC 控制，并开展了一系列真机实验。在介绍具体方法之前，先看一段主动稳定的实际效果（图 1）。

<figure style="display: flex; flex-direction: column; align-items: center; margin: 1.5em auto;">
  <picture style="display: block; width: 100%; max-width: 360px; line-height: 0; flex: none;">
    <source srcset="/images/11-stewart-4/01-attitude-stabilization.webp" type="image/webp">
    <img src="/images/11-stewart-4/01-attitude-stabilization.gif" alt="手动倾斜定平台时，6-PUS 动平台主动补偿姿态的 PID 实机演示" style="display: block; width: 100%; height: auto; margin: 0;">
  </picture>
  <figcaption style="position: static; display: block; width: 100%; margin: 12px auto 0; line-height: 1.6; font-weight: normal; text-align: center;">图 1：6-PUS Stewart 平台主动姿态稳定实机演示。<br>Figure 1. 6-PUS Stewart platform attitude-stabilization demonstration.</figcaption>
</figure>

<!-- more -->

## 1. 主动姿态稳定的三种控制方案

### 1.1 SO(3) 姿态前馈

基座倾斜后，要让动平台保持原来的朝向，就需要根据基座的变化生成反向补偿。Base IMU 安装在定平台上，测量基座相对于捕获参考的姿态；Platform IMU 安装在动平台上，观察补偿后的实际姿态。用 $W$、$B$、$P$ 分别表示计算世界系、基座系和动平台系，$R\_{WB}$ 把基座系向量变换到世界系，$R\_{BP}$ 表示动平台相对于基座的旋转。二者满足：

$$
R\_{WP}=R\_{WB}R\_{BP}.
$$

要保持目标朝向 $R\_{WP,\mathrm{des}}$，前馈命令应取：

$$
R\_{BP,\mathrm{FF}}=R\_{WB}^{\mathsf T}R\_{WP,\mathrm{des}}.
$$

当前实现捕获两路 IMU 的零参考后，以单位旋转表示目标朝向，因此基础补偿为 $R\_{BP,\mathrm{FF}}=R\_{WB}^{\mathsf T}$：基座怎样旋转，就通过它的逆旋转抵消对动平台朝向的影响。这里的世界系由参考捕获和坐标约定建立，评价围绕各次捕获参考展开，没有外部光学系统对绝对姿态的标定。

本文关注相对于捕获参考的三轴姿态稳定；平移目标沿用既有执行链路，尚未验证世界系 XYZ 位置也同时不变。

SO(3) 是三维旋转矩阵组成的集合，它让多个方向的转动按正确顺序合成。采用逆旋转，而不是直接把 Roll、Pitch、Yaw 分别取负，是因为复合转动存在顺序与耦合关系。生成的姿态命令随后进入逆运动学（IK）、轨迹整形和六轴执行器，使动平台进行补偿运动。

纯前馈不使用动平台姿态误差生成附加纠偏量，执行器自身的控制仍然工作。真实机构和执行器并非理想系统：命令到达、机构响应、模型与测量都可能存在偏差，动平台仍会留下姿态残余。要继续修正这些残余，就需要把 Platform IMU 的观测引入反馈。

### 1.2 PID 姿态反馈

PID 根据动平台偏离目标的程度继续纠偏，姿态观测来自 Platform IMU。与前馈只看基座变化不同，反馈直接使用动平台的实测姿态。控制误差定义在世界系中：

$$
\mathbf e\_W=\mathrm{Log}\left(R\_{WP,\mathrm{des}}R\_{WP}^{\mathsf T}\right)^\vee.
$$

$\mathbf e\_W$ 是旋转向量，内部单位为 rad，方向表示从测得姿态回到目标姿态所需的修正。$\mathrm{Log}$ 取旋转矩阵的对数，$\vee$ 将相应反对称矩阵写成三分量向量；这样，三轴控制器可以在同一坐标系中计算纠偏量。比例项响应当前误差，积分项累积持续偏差，导数项响应误差变化，最终输出任务空间补偿角 $\mathbf u\_W$。它与[第二篇的 Simscape 力驱动控制](/2026/08/27/6-pus-stewart-2-simscape-pid-adrc/)所用的推力输出不同，参数不能直接搬用。

实际实现采用离散计算，并对导数项进行低通滤波。各轴使用自己的增益，以下省略轴下标：

$$
u\_k^{\mathrm{raw}}=K\_p e\_k+K\_i I\_k+K\_d d\_k.
$$

$$
v\_k=\frac{e\_k-e\_{k-1}}{T\_k}.
$$

$$
d\_k=\alpha\_k d\_{k-1}+(1-\alpha\_k)v\_k.
$$

$$
\alpha\_k=\frac{\tau}{\tau+T\_k},\qquad \tau=\frac{1}{2\pi f\_c}.
$$

$T\_k$ 为控制器本次计算使用的有效采样间隔。若采样间隔不是有限值或小于 1 ms，控制器保持上一周期输出；若超过 100 ms，则按 100 ms 的上限参与本次计算；其余情况使用实际间隔。$I\_k$ 是按误差积分累积、带边界约束的状态，$d\_k$ 是原始误差差分 $v\_k$ 的低通输出。程序先对三个贡献项求和，再逐轴限幅。首次可计算的导数用于初始化滤波状态，后续才按上式递推；这有别于直接把 IMU 角速度当作 D 项。

积分状态设有边界；如果上一周期已饱和，且当前误差会继续把命令推向同一限幅方向，对应轴暂停积分增长。本次参数的 $K\_i$ 均为零，因此 Roll 使用 P，Pitch、Yaw 使用 PD，以下沿用 PID 分支的名称。

经过实机调试，最终采用的 PID 参数如下。

<div class="stewart4-table compact">

| 轴 | $K\_p$ | $K\_i$（s⁻¹） | $K\_d$（s） |
| --- | ---: | ---: | ---: |
| Roll | 0.050 | 0 | 0 |
| Pitch | 0.050 | 0 | 0.0015 |
| Yaw | 0.025 | 0 | 0.0015 |

</div>

导数项由相邻误差差分得到，再通过 5 Hz 低通滤波；各轴残差输出限制为 ±0.5°。基座大角度变化所需的主要补偿仍由前馈承担，这个限幅约束的是附加纠偏量，不是平台整体运动范围。保留小残差预算有助于约束反馈对执行链路的额外冲击，同时也限定了反馈能够弥补的偏差。

补偿角仍需按旋转关系作用到平台，不能直接加到基座系欧拉角上。实现先用 $\mathrm{Exp}$ 把世界系补偿向量转成修正旋转，再通过基座姿态变换到基座系，并与前馈左乘合成：

$$
\Delta R\_W=\mathrm{Exp}([\mathbf u\_W]\_{\times}).
$$

$$
\Delta R\_B=R\_{WB}^{\mathsf T}\Delta R\_W R\_{WB}.
$$

$$
R\_{BP,\mathrm{cmd}}=\Delta R\_B R\_{BP,\mathrm{FF}}.
$$

这条合成关系也用于后面的 LADRC，因此两种反馈比较的是同一几何补偿基础上的不同残差生成方式。

### 1.3 LADRC 与扩张状态观测器

PID 根据姿态误差及其变化生成反馈补偿，但真实机构中的负载变化、轴间耦合和执行动态不会被固定增益逐项描述。引入自抗扰控制（ADRC），是希望在误差反馈之外增加一个机制：在线估计难以直接建模的综合影响，再把估计结果用于补偿。

这个机制的核心是扩张状态观测器（Extended State Observer，ESO）。它利用已有的误差测量与控制输入，一边估计误差状态，一边把模型中未知的综合影响作为额外状态估计，所以称为“扩张”。这里没有增加一个直接测量外部扰动力矩的传感器；观测器得到的是误差动态中的等效集总项。

如果负载或运行状态改变，固定反馈参数仍按原来的比例响应，而观测器有机会把变化体现到估计状态中，生成相应补偿。这是它在负载变化问题上值得研究的潜在价值，实际能否减小误差，还要看估计是否及时、模型是否合适，以及执行链路能否落实这份补偿。

本篇采用线性自抗扰控制（LADRC），三轴分别使用一阶误差模型：

$$
\dot e=f-b\_0u.
$$

$e$、$u$ 均为角度量，内部单位 rad；$b\_0>0$ 的单位为 s⁻¹，描述名义补偿角对误差变化率的作用；$f$ 的单位为 rad/s，把名义输入作用之外的变化合并为一个集总项。模型中的负号表示正补偿在名义对象上减小正误差，$f$ 不是外部负载力矩的直接测量值。

为估计这个模型，线性扩张状态观测器（LESO）设置两个状态：$z\_1$ 估计误差，$z\_2$ 估计集总项。观测器先利用控制输入预测误差如何变化，再用测得误差与预测值的差修正状态；这样，误差测量中尚未被名义输入解释的变化会影响集总项估计。每轴以测量误差 $y=e$ 更新：

$$
\dot z\_1=z\_2-b\_0u\_{\mathrm{sel}}+2\omega\_o(y-z\_1).
$$

$$
\dot z\_2=\omega\_o^2(y-z\_1).
$$

两式中的 $y-z\_1$ 是观测误差，$\omega\_o$ 决定观测器的名义估计响应速度。$z\_1$ 的单位为 rad，$z\_2$ 的单位为 rad/s；前者用于误差反馈，后者换算成附加补偿。实际控制律采用：

$$
u\_{\mathrm{raw}}=\frac{\omega\_c z\_1+z\_2}{b\_0}.
$$

$$
u\_{\mathrm{sel}}=\mathrm{clip}(u\_{\mathrm{raw}},-u\_{\max},u\_{\max}).
$$

这个符号方向与前面的 PID 一致：正误差需要正补偿，而正补偿在名义模型中减小误差。若观测达到 $z\_1=e$、$z\_2=f$，输入映射也符合 $b\_0$，且输出没有饱和，将控制律代回误差模型得到：

$$
\dot e=-\omega\_c e.
$$

由此可以看出两个分子项的作用：$\omega\_c z\_1/b\_0$ 根据估计误差生成反馈，$z\_2/b\_0$ 抵消估计的集总变化。理想情况下，$\omega\_c$ 决定期望误差衰减速度；真实运行中，估计存在滞后，输出有幅值上限，机构响应也未必符合固定 $b\_0$。后面的实验会分别观察这两个贡献项，以及它们相加后有多少能够进入最终命令。

实际程序在零阶保持假设下使用精确离散 LESO，按有效采样间隔更新，并把上一周期最终选用、已经限幅的残差命令回送观测器。这样，软件不会在输出触顶后仍按未执行的原始需求预测输入作用。不过，回送的是任务空间命令，真实机构是否已经完成相应运动仍需执行反馈来观察。

<div class="stewart4-table compact">

| 轴 | $b\_0$（s⁻¹） | $\omega\_c$（rad/s） | $\omega\_o$（rad/s） |
| --- | ---: | ---: | ---: |
| Roll | 20 | 0.80 | 2.5 |
| Pitch | 10 | 1.00 | 4.0 |
| Yaw | 6 | 0.25 | 1.2 |

</div>

残差限幅同样是各轴 ±0.5°，标称更新频率为 50 Hz。上述参数是实机试用参数，一阶模型没有逐项包含执行器动力学、轴间耦合和通信时延，因此需要把控制器的设计性质与整机实测表现分开评价。

### 1.4 三种方案的统一控制架构

三种方案共享 SO(3) 前馈和执行链路。纯前馈不启用附加姿态反馈；PID 与 LADRC 则是二选一的残差控制器，只有选中的输出进入旋转变换与 SO(3) 姿态合成，再由 IK 和实际执行链路完成运动（图 2）。

<figure>
  <img src="/images/11-stewart-4/02-unified-control-architecture.png" alt="共同 SO(3) 前馈链路与 PID 或 LADRC 残差反馈分支的统一架构" style="width: 100%; height: auto;">
  <figcaption style="position: static; display: block; width: 100%; margin: 12px auto 0; line-height: 1.6; font-weight: normal; text-align: center;">图 2：三种主动姿态稳定控制方案的统一架构。<br>Figure 2. Unified architecture of three attitude-stabilization modes.</figcaption>
</figure>

这一架构把几何补偿与残差生成分开：前馈承担主要反向旋转，反馈在共同基础上继续纠偏。下面通过真实输入、平台响应与执行状态，观察这三种方案各自发挥了什么作用。

## 2. 真机实验与控制性能分析

实验通过人工移动定平台施加扰动，两路 IMU 分别记录基座输入和平台响应。各次参考独立捕获，人工运动没有统一回放，因此比较时需要同时看输入规模、误差和执行状态。以下结果用于理解不同工作条件下的响应，不作严格同输入的算法排名。

对选定窗口的 $N$ 个原生样本，RMS 与最大绝对值定义为：

$$
\mathrm{RMS}(x)=\sqrt{\frac{1}{N}\sum\_{k=1}^N x\_k^2}.
$$

$$
\mathrm{Peak}(x)=\max\_k |x\_k|.
$$

RMS 不去均值，反映所选窗口中偏差的整体水平，参考偏置和运动波动都会计入；Peak 保留瞬间较大的偏差。整体误差水平与峰值一起看，才能区分持续残余和短时偏离。统计使用原生样本，不插值或删峰；输出饱和以逐轴遥测标记计数，分母为相应窗口的 ACTIVE 样本数。

### 2.1 实机平台的基础运动与姿态跟踪

主动稳定首先需要可用的运动与观测链路。HOME 附近的局部单轴测试覆盖了 X、Y、Z、Roll、Pitch、Yaw 六个自由度：平移由执行器反馈经正运动学（FK）重建，姿态由 Platform IMU 测量。

<div class="stewart4-table">

| 自由度 | 指令 | 测量结果 | 与指令的绝对差值 |
| --- | ---: | ---: | ---: |
| X | +0.5 mm | FK +0.3311 mm | 0.1689 mm |
| Y | +0.5 mm | FK +0.5184 mm | 0.0184 mm |
| Z | +0.5 mm | FK +0.4769 mm | 0.0231 mm |
| Roll | +0.5° | Platform IMU +0.4486° | 0.0514° |
| Pitch | +0.5° | Platform IMU +0.4995° | 0.0005° |
| Yaw | +2.0° | Platform IMU +1.4825° | 0.5175° |

</div>

平移取动作阶段最后 100 点均值，减去动作前 HOME 阶段最后 100 点均值；姿态取正向动作阶段后一半样本均值，Roll、Pitch、Yaw 分别为 235、258、248 点。

六个自由度都已产生真实响应，但轴向表现不同：X 位移小于指令，Y、Z 较接近指令，Pitch 后段均值接近目标，Yaw 仍有明显残余。FK 使用同一套模型与执行器反馈，不能作为独立的平移精度标定；这些结果描述的是 HOME 附近的局部响应。

有了这项基础，接下来要看的是基座持续运动时，平台能否及时完成反向补偿，以及加入反馈后残余如何变化。

### 2.2 从前馈到 PID：姿态稳定效果的改善

先看纯前馈与 PID 控制时，基座姿态变化和动平台响应（图 3）。前馈统计完整 ACTIVE，共 5929 点、118.580 s；PID 采用 2604 点、52.080 s 的有效窗口，完整 ACTIVE 共 2946 点。两列横轴从各自统计窗口起点计时。

<figure>
  <img src="/images/11-stewart-4/03-feedforward-pid-responses.png" alt="历史统计窗口内纯前馈与 PID 的基座输入及平台三轴欧拉角响应" style="width: 100%; height: auto;">
  <figcaption style="position: static; display: block; width: 100%; margin: 12px auto 0; line-height: 1.6; font-weight: normal; text-align: center;">图 3：纯前馈与 PID 控制下的姿态响应对比。<br>Figure 3. Attitude responses with feedforward only and PID feedback.</figcaption>
</figure>

前馈窗口的平台 Roll/Pitch/Yaw RMS 为 1.035°、1.152°、0.843°，对应基座输入为 2.543°、2.775°、2.894°。平台没有等幅跟随基座，几何补偿已经承担了主要作用；但 SO(3) 误差峰值仍达到 9.953°，说明仅有几何关系并不能消除实际执行中的全部残余。

PID 有效窗口的平台三轴 RMS 为 1.927°、2.085°、1.176°，其绝对值更大，面对的基座 RMS 却也增大到 7.239°、7.999°、5.120°。如果只看平台 RMS，会得出与归一化结果不同的印象。为同时交代输入规模和输出残余，定义平台／基座的响应比值：

$$
G\_{\mathrm{RMS}}=\frac{\mathrm{RMS}(\mathrm{Platform})}{\mathrm{RMS}(\mathrm{Base})}.
$$

$$
G\_{\mathrm{Peak}}=\frac{\mathrm{Peak}(\mathrm{Platform})}{\mathrm{Peak}(\mathrm{Base})}.
$$

逐轴指标中的 Platform、Base 是各自相对参考的同轴欧拉角。SO(3) 整体指标分别采用平台相对于目标的几何姿态误差角、基座相对于捕获参考的几何旋转角。两者都用 ° 计算，比值无量纲；几何角可由旋转矩阵的迹得到：

$$
\theta(R)=\arccos\left(\frac{\mathrm{tr}(R)-1}{2}\right).
$$

平台误差代入相对于目标的误差旋转，基座幅值代入相对于捕获参考的基座旋转。数值计算会将反余弦的输入限制在有效范围内。整体 SO(3) 角不是三个欧拉角的平方和开根号，复合转动下不能互换；它给出了不依赖欧拉角逐轴拆分的总体姿态偏离量。

进一步用相对纯前馈的归一化变化率表示差异：

$$
\Delta G=\left(1-\frac{G\_{\mathrm{controller}}}{G\_{\mathrm{FF}}}\right)\times100\\%.
$$

$G\_{\mathrm{controller}}$ 是加入反馈后的比值，$G\_{\mathrm{FF}}$ 是纯前馈比值，同一次计算使用相同指标定义。$\Delta G>0$ 表示比值下降，等于零表示不变，小于零表示比值上升。结果如下：

<div class="stewart4-table">

| 指标 | 纯前馈 | PID | $\Delta G$ |
| --- | ---: | ---: | ---: |
| Roll $G\_{\mathrm{RMS}}$ | 0.4071 | 0.2662 | +34.6% |
| Pitch $G\_{\mathrm{RMS}}$ | 0.4153 | 0.2607 | +37.2% |
| Yaw $G\_{\mathrm{RMS}}$ | 0.2912 | 0.2297 | +21.1% |
| SO(3) $G\_{\mathrm{RMS}}$ | 0.3713 | 0.2575 | +30.6% |
| Roll $G\_{\mathrm{Peak}}$ | 0.4778 | 0.3107 | +35.0% |
| Pitch $G\_{\mathrm{Peak}}$ | 0.5946 | 0.3279 | +44.8% |
| Yaw $G\_{\mathrm{Peak}}$ | 0.7983 | 0.4424 | +44.6% |
| SO(3) $G\_{\mathrm{Peak}}$ | 0.7353 | 0.3063 | +58.3% |

</div>

例如 Roll 的计算是 $1-0.2662/0.4071$，得到约 34.6%。这表示两组记录中的归一化 Roll 响应比值下降了约 34.6%。百分比使用未四舍五入的数据计算，表中四位小数仅用于展示。

Roll、Pitch、Yaw 的归一化 RMS 分别下降 34.6%、37.2%、21.1%，整体 SO(3) RMS 比值下降 30.6%，Peak 比值下降 58.3%。八项比值均下降，使 PID 成为继续观察主动稳定的工作基线。

这些是不同人工扰动记录中的归一化变化，不是相同输入下的因果改善率。归一化减弱了幅值尺度差异，运动方向、频率成分和时长仍不同；两个 Peak 又各取窗口最大值，不要求同时发生，所以 $G\_{\mathrm{Peak}}$ 也不是瞬时输入输出增益。

### 2.3 PID 与 LADRC：两种反馈方案的实机比较

PID 已经能利用平台姿态残余进行补偿，引入扰动估计后会发生什么变化？先看一段没有额外偏心负载的 LADRC 短测：总记录约 10 s，其中 ACTIVE 为 430 点、8.580 s，三轴实际运动命令由 LADRC 的残差输出生成。图 4 展示平台响应与限幅后的实际输出。

<figure>
  <img src="/images/11-stewart-4/04-ladrc-no-load-response.png" alt="空载 LADRC 运行时的平台姿态响应和实际选用残差" style="width: 100%; height: auto;">
  <figcaption style="position: static; display: block; width: 100%; margin: 12px auto 0; line-height: 1.6; font-weight: normal; text-align: center;">图 4：LADRC 短测中的姿态响应与残差输出。<br>Figure 4. Attitude response and residual output during a short LADRC test.</figcaption>
</figure>

平台三轴 RMS 为 1.776°、2.132°、1.818°。Roll/Pitch/Yaw 饱和分别为 6、134、0 点，Pitch 约 31.2% 的样本触及 ±0.5° 边界。LADRC 已经在驱动真实机构，但平台仍有明显残余，部分补偿需求也受到限幅约束。

沿用前面的指标定义，把这段短测的基座输入、平台响应与归一化比值放在一起：

<div class="stewart4-table wide">

| 指标对象 | 基座 RMS（°） | 平台 RMS（°） | $G\_{\mathrm{RMS}}$ | $G\_{\mathrm{Peak}}$ |
| --- | ---: | ---: | ---: | ---: |
| Roll | 2.1867 | 1.7761 | 0.8122 | 0.9962 |
| Pitch | 2.3378 | 2.1318 | 0.9119 | 0.9681 |
| Yaw | 0.7279 | 1.8180 | 2.4978 | 2.6639 |
| SO(3) | 3.2800 | 3.3128 | 1.0100 | 1.0640 |

</div>

Yaw 的基座 RMS 仅为 0.728°，平台 RMS 为 1.818°，因此响应比值达到 2.4978。小输入分母会放大归一化比值，读图时需要同时保留绝对误差，而不是只看比值大小。

再把更长的 PID、LADRC 记录放到共同窗口中比较。两次分别使用 PID 与三轴 LADRC，共享前馈结构、主要驱动配置和 ±0.5° 残差预算，反馈参数与第一部分一致。参考分别捕获，初始执行器位置不同，额外负载条件没有完整记录。

将各自首次进入 ACTIVE 设为零时刻，取约 23.24 s 的共同持续时间，两组各 1163 个样本；PID 完整 ACTIVE 中多出的 52 点不进入统计。图 5 同时展示基座输入与平台响应，共同窗口统一了统计长度，人工扰动仍未同步回放。

<figure>
  <img src="/images/11-stewart-4/05-common-window-comparison.png" alt="PID 与 LADRC 共同持续时间窗口中的基座输入和平台相对欧拉角残余" style="width: 100%; height: auto;">
  <figcaption style="position: static; display: block; width: 100%; margin: 12px auto 0; line-height: 1.6; font-weight: normal; text-align: center;">图 5：共同统计窗口内的 PID 与 LADRC 姿态响应。<br>Figure 5. PID and LADRC attitude responses over a common-duration window.</figcaption>
</figure>

<div class="stewart4-table wide">

| 轴 | 基座 RMS：PID / LADRC（°） | 平台 RMS：PID / LADRC（°） | 平台 Peak：PID / LADRC（°） |
| --- | ---: | ---: | ---: |
| Roll | 10.758 / 13.314 | 0.982 / 1.602 | 3.811 / 8.441 |
| Pitch | 8.098 / 7.115 | 1.592 / 1.735 | 5.371 / 4.981 |
| Yaw | 2.059 / 3.288 | 1.670 / 3.690 | 7.348 / 13.201 |

</div>

这两段记录中，PID 三轴 RMS 均较低；LADRC 的 Pitch 峰值略小，Roll、Yaw 峰值较大。LADRC 的 Yaw 误差曾达到 −13.201° 的负向极值，对应绝对峰值为 13.201°。与此同时，LADRC 的基座 Roll、Yaw RMS 分别高约 24% 和 60%，Pitch 低约 12%，因此误差还要结合输入方向与幅值理解。

为了避免只看误差绝对值，再计算逐轴平台与基座 RMS 的比值：

$$
G\_{\mathrm{RMS},i}=\frac{\mathrm{RMS}(\theta\_{P,i})}{\mathrm{RMS}(\theta\_{B,i})}.
$$

<figure>
  <img src="/images/11-stewart-4/06-normalized-residual-ratios.png" alt="共同统计窗口内 PID 与 LADRC 三轴平台 RMS 除以基座 RMS 的归一化比值" style="width: 100%; height: auto;">
  <figcaption style="position: static; display: block; width: 100%; margin: 12px auto 0; line-height: 1.6; font-weight: normal; text-align: center;">图 6：PID 与 LADRC 的逐轴归一化 RMS 响应比值。<br>Figure 6. Per-axis normalized RMS response ratios for PID and LADRC.</figcaption>
</figure>

PID 的 Roll/Pitch/Yaw 比值为 0.091、0.197、0.811，LADRC 为 0.120、0.244、1.122，当前记录中 PID 的三轴比值仍较低。LADRC 的 Yaw 比值大于 1，表示平台同轴 RMS 高于基座 RMS；在复合旋转中，其他轴的运动也可能影响该轴误差。这个幅值比值没有统一频率、参考或跨轴输入，不能直接当作闭环不稳定判据或用来估算带宽。

两种反馈都已作用到实机，也都留下了需要解释的误差。接下来考察负载改变时的记录，观察集总扰动估计、补偿需求与机构响应之间的关系。

### 2.4 加入偏心负载之后

LADRC 增加了对综合影响的估计，那么负载改变后，这一机制能否体现出价值？为观察这个问题，我在动平台上增加了一个偏心重物。偏心安装会改变不同构型和运动方向下的受力与执行需求，两次测试保持同一次固定装夹。负载质量与力臂没有精密测量，输入仍由人工施加，因此这里观察同一装夹下的实际响应，不作已知力矩、匹配扰动的抗扰对照。

图 7 左侧展示基座欧拉角，右侧展示世界系 SO(3) 误差向量分量。PID 与 LADRC 的 ACTIVE 分别为 429 点、8.560 s 和 446 点、8.901 s，时间均从各自 ACTIVE 起点计。

<figure>
  <img src="/images/11-stewart-4/07-eccentric-payload-comparison.png" alt="固定偏心负载下 PID 和 LADRC 的基座欧拉角输入及世界系 SO(3) 误差向量分量" style="width: 100%; height: auto;">
  <figcaption style="position: static; display: block; width: 100%; margin: 12px auto 0; line-height: 1.6; font-weight: normal; text-align: center;">图 7：偏心负载下的基座输入与平台姿态误差。<br>Figure 7. Base inputs and platform attitude errors with eccentric payload.</figcaption>
</figure>

<div class="stewart4-table">

| 误差分量 | PID RMS / Peak（°） | LADRC RMS / Peak（°） |
| --- | ---: | ---: |
| Roll | 0.446 / 1.171 | 1.072 / 3.161 |
| Pitch | 0.868 / 2.389 | 1.309 / 4.194 |
| Yaw | 0.608 / 2.758 | 0.441 / 1.364 |

</div>

LADRC 的 Roll、Pitch 误差较大，Yaw 较小；它的基座 Roll/Pitch RMS 也比 PID 高约 90%／50%，Yaw 则低约 48%。轴向输入与误差的变化方向相近，单看某一轴的改善或恶化，还不足以分离控制器和输入各自的影响。

更直接的线索来自补偿预算。PID 实际残差三轴均未饱和，LADRC 的 Pitch 有 73/446 点饱和，约 16.4%。Pitch 原始输出峰值约 1.025°，超过 ±0.5° 的可执行预算；ESO 的 $z\_2$ 峰值约 6.92°/s，经 $b\_0=10$ 换算后，单独的扰动补偿项可达约 0.692°。这些峰值不必同时发生，不能相加当作实测总输出，但已能看到：观测器提出的补偿需求可能超过残差层允许的范围。

执行层的最大命令／反馈快照差，PID、LADRC 分别为 38、80 steps。这个量是驱动坐标中最新命令与最新反馈之差，采样并不同步。它让控制需求与执行状态之间的差距变得可见，却不是同步机械跟踪误差或平台绝对位置精度。观测器生成了补偿，机构能否及时完成，还需要结合执行响应判断。

### 2.5 有了扰动观测器，为什么控制效果仍不理想？

ESO 已经在更新，LADRC 也生成了补偿命令，但平台仍有明显的姿态残余，部分代表性实验中的误差甚至高于 PID。问题出在哪里？先看控制器提出的补偿需求，能否沿着执行链路真正变成平台运动。

**首先，控制器想补偿，输出却有上限。** 每轴附加残差只有 ±0.5°，反馈项与扰动补偿项共享这一范围。共同统计窗口的 1163 个样本中，LADRC 的 Pitch 有 423 次触及限幅，约 36.4%；Roll、Yaw 分别为 36、211 次，约 3.1%、18.1%，PID 三轴则没有残差饱和。Pitch 超过三分之一的样本中，即使控制器提出更大的需求，最终选用输出也只能停在边界。

图 8 把偏心负载和共同窗口 LADRC 记录中的 Pitch 响应放在一起：原始控制输出表示计算出的需求，限幅后输出表示软件实际选用的补偿。两条曲线分开时，就有一部分需求被截去了。图中同时保留实测误差、LESO 状态 $z\_1$、$z\_2$，以及反馈项和扰动补偿项；其中 $z\_2/b\_0$ 是从状态换算的角度补偿贡献。对照 $z\_1$ 与实测误差，可以看估计是否跟上变化；再看两个补偿项与限幅后输出，可以区分估计在变化和补偿被实际选用。

<figure>
  <img src="/images/11-stewart-4/08-ladrc-limits-and-observer.png" alt="两段 LADRC 记录中 Pitch 原始与限幅输出、误差估计及控制贡献" style="width: 100%; height: auto;">
  <figcaption style="position: static; display: block; width: 100%; margin: 12px auto 0; line-height: 1.6; font-weight: normal; text-align: center;">图 8：LADRC 的残差限幅、误差估计与控制贡献。<br>Figure 8. LADRC residual limits, error estimates and control contributions.</figcaption>
</figure>

饱和说明输出受到约束，却不能单凭 36.4% 的占比判断限幅造成了多少姿态误差。误差反馈与扰动估计都可能推高需求，需结合实际响应理解。

**其次，发出命令不等于机构已经完成动作。** 补偿还要经过 SO(3) 姿态合成、IK、轨迹整形和通信，最终由六轴执行器形成平台运动。偏心负载 PID、LADRC 的最大命令／反馈快照差分别为 38、80 steps，说明控制器读取到的目标与反馈位置曾存在差距；两者来自异步消息，不是严格同步的机械跟踪误差。机构需要时间响应，观测器收到限幅后命令，也不等于知道平台已经实现了这份输入。

**最后，观测器的模型也需要与真实系统匹配。** 一阶误差模型通过名义增益 $b\_0$ 描述补偿角对误差变化率的作用。真实机构还包含执行滞后、构型变化和轴间耦合；ESO 将未被名义模型解释的影响归入集总项，但估计能否及时跟随，仍与模型和实际动态有关。$z\_2$ 是误差模型中的等效集总项，不是对外部负载力矩的直接测量。复合运动中，一个轴的动作还可能影响另一个轴的误差；当这些影响随运动变化时，有限带宽的观测器也需要时间跟随。

带宽决定估计和反馈响应变化的速度。Roll/Pitch/Yaw 的控制带宽参数 $\omega\_c$ 为 0.8、1.0、0.25 rad/s，观测带宽 $\omega\_o$ 为 2.5、4.0、1.2 rad/s。增大观测带宽可以加快名义估计，也可能增加对测量噪声的敏感性。测量到达的时效和机构响应同样影响估计所面对的对象，标称 50 Hz 更新频率不能直接当作实机闭环带宽。当前实验尚未独立分离这些因素，也没有确定某个参数是唯一主因。

引入观测器增加了估计与补偿机制，实际稳定效果则取决于估计、输出限制和执行响应能否配合。图中的输出触顶是直接可见的约束，如何让模型和补偿更贴合真实机构，还要结合状态估计与实际运动一起判断。

### 2.6 从慢到快：不同扰动节奏下的主动稳定

前面的代表性实验中，PID 已经表现出较好的姿态稳定效果。但如果基座晃动得越来越快，动平台还能保持同样的效果吗？这次沿用最终保留的 PID 参数，进行约 40 s 的手持扰动，按人工运动节奏划分为慢（Slow）、中（Medium）、快（Fast）三段。这些标签没有经过严格频率标定。

基座持续运动，平台也在主动补偿，但测试过程中的姿态残余明显增大。有效 ACTIVE 段共 2007 点、40.140 s：基座相对参考的 SO(3) 幅值峰值为 21.512°，平台 SO(3) 误差 RMS 为 10.427°、P95 为 22.474°、最大为 29.133°。约 95% 的样本误差不超过 P95，但峰值已接近 30°，表明补偿仍在运行，平台却未能始终贴近目标姿态。

图 9 展示全部 2007 个 ACTIVE 样本中的基座姿态幅值、平台姿态误差，以及每点六轴命令与反馈的最大快照差。

<figure>
  <img src="/images/11-stewart-4/09-high-dynamic-pid-response.png" alt="高动态 PID 手持扰动中的基座 SO(3) 幅值、平台姿态误差与执行器命令反馈快照差" style="width: 100%; height: auto;">
  <figcaption style="position: static; display: block; width: 100%; margin: 12px auto 0; line-height: 1.6; font-weight: normal; text-align: center;">图 9：高动态手持扰动下的姿态响应与执行器快照偏差。<br>Figure 9. Attitude responses and actuator snapshot differences during dynamic manual disturbance.</figcaption>
</figure>

三段统计窗口与结果如下；分段间及末尾的样本仍包含在整段曲线和总体统计中。

<div class="stewart4-table wide">

| 扰动阶段（s） | 基座 SO(3) 幅值均值 / 峰值（°） | 平台 SO(3) 误差均值 / 峰值（°） | 最大快照偏差（steps） | 最大电流（mA） |
| --- | ---: | ---: | ---: | ---: |
| Slow：1.7–15.6 | 8.48 / 15.64 | 3.66 / 10.44 | 67 | 224 |
| Medium：15.8–30.3 | 10.45 / 18.16 | 10.64 / 23.13 | 163 | 468 |
| Fast：30.5–38.4 | 10.94 / 21.51 | 10.75 / 29.13 | 84 | 188 |

</div>

从慢段到中段，平台误差均值由 3.66° 增至 10.64°，稳定效果明显下降。值得注意的是，最大快照差 163 steps 和最大电流 468 mA 都出现在中段，而非快段。执行负担不能只按快慢标签判断：基座幅度、运动方向、机构构型和目标变化过程都可能影响六轴需要完成的动作，当前实验没有单独分离这些因素。

为什么后面会留下较大误差？一个直接限制是反馈附加补偿每轴只有 ±0.5°。整段中，PID 的 Roll/Pitch/Yaw 残差饱和分别为 139/2007、257/2007、10/2007，约 6.9%、12.8%、0.5%。触顶后，需求再增加，最终残差也无法继续增大；基座旋转所需的主要反向运动仍由前馈承担。例如 Pitch 的比例增益为 0.05，仅比例项在误差分量达到 10° 时就会提出 0.5° 补偿需求，叠加导数项后是否触顶还要看两项的实际合成。

与此同时，前馈命令持续变化，六个执行器需要时间完成运动，不同构型下所需的行程变化也不同。163 steps 的最大快照差提示命令与反馈之间曾存在较大差距；它来自异步消息，不能直接当作同步机械跟踪误差。将它与姿态残余一起看，才能理解补偿计算与真实运动之间的距离。限幅和执行响应提供了分析线索，但这次手持实验并未测得精确的频率响应或闭环带宽。

测试最后停止于恢复目标的安全检查：新目标相对驱动保留的衔接位置，最大跳变为 81 steps，超过 80 steps 门限，因此目标更新被拒绝。触发的是目标衔接保护，并非本次过流或电机内部 Fault，也没有机械卡死证据。真实机器人不仅要生成补偿，还要及时完成运动，并在中断后安全衔接目标。

## 3. 失败案例与工程可靠性

前面的实验已经看到，补偿命令从计算到执行，始终受到真实系统约束。除了姿态误差，执行余量、输入时效和安全保护也决定了主动稳定能否持续运行。下面从大角度补偿、测量过期和长时间运行中的具体表现，进一步讨论这些工程问题。

### 3.1 硬件边界：大角度补偿触发过流

一次大角度姿态补偿试验关注基座倾斜较大时，前馈与 PID 能否继续维持平台朝向。机构随后因第五路执行器过流保护停止，这让几何可达与真实执行能力的区别变得具体。

保护触发前的最后一次有效姿态记录中，基座 Roll 为 −38.113°，基座系命令 Roll/Pitch/Yaw 为 38.140°、−4.825°、1.496°，第五路执行器电流为 487 mA。随后故障记录中的电流达到 503 mA，超过当时 500 mA 的软件保护门限。姿态与 503 mA 来自前后两次记录，不能视作同步观测；故障行的默认零姿态也不代表平台已回到参考。

<figure>
  <img src="/images/11-stewart-4/10-large-angle-overcurrent.png" alt="过流前两秒的有效 Roll 姿态命令与六执行器电流，区分最后有效姿态和故障行" style="width: 100%; height: auto;">
  <figcaption style="position: static; display: block; width: 100%; margin: 12px auto 0; line-height: 1.6; font-weight: normal; text-align: center;">图 10：大角度补偿时的姿态命令与过流停止。<br>Figure 10. Attitude commands and overcurrent stop during large-angle compensation.</figcaption>
</figure>

驱动锁存第五路过流并进入停止流程，保护触发前的 PID 残差没有饱和。现有记录没有分离构型受力、摩擦、机械干涉或执行器余量等因素，不能把停止简单归因于 PID 振荡。应按此次生效的 500 mA 门限理解触发，提高门限本身不会增加机构的实际余量。

运动学有解只回答目标是否满足几何关系，不能保证真实闭链机构在该构型下具有足够受力和执行余量。遇到这种停止，应保留电流、最后有效命令和跟踪状态，再检查对应构型，而不是先扩大控制增益或放宽保护。

高动态实验中的 81 steps 恢复目标拒绝，则要求检查中断后的目标衔接。另一段独立 PID 试测把 Pitch 的 $K\_d$ 从 0.0015 s 增到 0.002 s，也遇到目标拒绝，最大跳变为 84 steps，同样超过 80 steps 门限。两次记录说明衔接距离是安全条件，但没有建立增大 $K\_d$ 与超时之间的因果关系。

### 3.2 实时性边界：控制器运行，输入仍可能过期

运行节奏也会限制补偿。一次驱动记录中，两次反馈 ingest 完成之间的 scheduler gap 达到 741.9 ms，超过当时 283.3 ms 的告警门限，研究模式仍继续运行。这是反馈汇集的调度间隔，不能当作单个 UART 读调用耗时；操作系统调度、Python 执行和串口等待各自占了多少，现有日志没有分离。

更直接的问题是控制器实际使用的姿态是否足够新。一次 LADRC 演示进入 ACTIVE 约 26.52 s 后，因 Base IMU 回调 freshness 超过 100 ms 而收到 FAULT 状态通知。最后一条正常遥测的 Base age 为 93.911 ms、Platform age 为 3.086 ms、驱动反馈 age 为 13.043 ms。这些是故障前的有效观测，触发故障的下一次更新没有完整正常遥测。

这里的 age 基于控制器最近一次回调消费时间，不是设备采样时间，也不是某次调用等待了 100 ms。独立 ROS 观察者最后收到 Base 的时间与控制器推得的最近回调接近，而 Platform 仍在故障附近有消息。因此，“系统一直收到 Base，只是控制器没有处理”的单一解释并不符合这次会话的现有观测。

同一 LADRC 运行的内核日志记录了 Base 所在 USB 路径断连与重新枚举，重枚举设备身份与 Base IMU 匹配。内核事件时间显示，断连早于 FAULT 状态通知约 31.7 ms，支持输入链路中断参与这次停止。最后 Base 回调更早，断连前输入为何逐渐过期仍缺少完整消息记录；电气根因也未定位，内核中的 EMI 提示只能作为排查线索。

LADRC 故障后，六轴 Pause 均得到应答，串口释放，没有遗留进程，安全关闭检查通过。但控制过程仍以 FAULT 结束，HOME 恢复按安全策略跳过。重新枚举只说明设备再次出现，应用层重新接管输入并恢复主动控制尚未得到验证。

另一次 PID 短会话在进入 ACTIVE 约 59.24 ms 后，也因输入 freshness 检查停止，退出汇总未满足全部安全关闭条件。它与上述 LADRC 演示是不同运行，测量 age 与关闭结果不能混用。两者共同表明，输入时效和故障收尾都是反馈算法之外的运行条件。

这些案例共同说明，姿态控制还依赖测量到达、回调处理、命令下发和反馈返回的时序。算法公式正常运行，不保证所使用的数据代表当前姿态。关于计时端点、executor 与 UART 链路的通用诊断，见[《能运行，不等于可靠运行：ROS 2 机器人系统的故障诊断与工程实践》](/2026/10/10/ros2-runtime-reliability-diagnostics/)，这里保留与主动稳定直接相关的现象。

### 3.3 运行验证：静态长测与主动会话分别评价

为减小通信等待对控制循环的影响，执行链路采用三进程分工：Parent 接收目标并组织状态，UART Child 持有串口并执行有界通信，Feedback Bridge 将最新反馈送回上层。目标与反馈分离传递，启动前通过 readiness 协调，并保留输入时效检查和故障 Pause。下面分别看静态长测与主动控制的运行表现。

<div class="stewart4-table">

| 测试类型 | 持续时间与样本 | 运行及退出结果 |
| --- | --- | --- |
| 静态长测 | 600 s，29995 个连续周期 | 运行窗口无故障；3 次 deadline 重置；退出有异常标记 |
| PID 主动会话 | 约 60 s，ACTIVE 58.900 s、2945 点 | 无运行超时或故障 |
| LADRC 主动会话 | 约 60 s，ACTIVE 58.880 s、2942 点 | 无运行超时或故障 |

</div>

静态长测中，Child 周期 wall time 最大约 68.375 ms，相邻周期间隔最大约 68.541 ms，Bridge 反馈间隔最大约 80.775 ms。这些量的起止点不同，分别描述执行周期和反馈传递的时间特征。运行窗口虽未记录故障，周期长尾、3 次 deadline 重置以及退出异常仍需要分别评价。

两段主动会话各支持约一分钟的 PID、LADRC 运行验证，ACTIVE 时长略短于会话总长。600 s 长测保持静态，没有验证连续 600 s 主动姿态稳定；两段主动记录也属于独立测试。后续出现的 freshness 停止进一步说明，成功运行覆盖的是对应条件，而不是所有输入和故障状态。

可靠性改进的价值，是让控制过程知道何时还能继续、何时必须停止：输出触顶时识别补偿预算，测量过期时停止使用旧姿态，驱动保护触发时保留最后有效观测。暂停与资源释放已经有实际记录，恢复控制还需重新建立可信输入和安全衔接目标，现有结果没有完成自动恢复验证。

## 实机效果展示

为了更直观地观察主动稳定效果，我在动平台上放置了一枚直立的麻将玩具，随后人工改变基座姿态，让平台进行主动补偿。这段采用 PID 控制的演示中，麻将玩具保持站立（图 11）。

<figure style="display: flex; flex-direction: column; align-items: center; margin: 1.5em auto;">
  <picture style="display: block; width: 100%; max-width: 360px; line-height: 0; flex: none;">
    <source srcset="/images/11-stewart-4/11-pid-toy-demonstration.webp" type="image/webp">
    <img src="/images/11-stewart-4/11-pid-toy-demonstration.gif" alt="直立麻将玩具放在动平台上，PID 控制在人工移动基座时主动补偿姿态" style="display: block; width: 100%; height: auto; margin: 0;">
  </picture>
  <figcaption style="position: static; display: block; width: 100%; margin: 12px auto 0; line-height: 1.6; font-weight: normal; text-align: center;">图 11：动平台麻将玩具保持站立的 PID 实机演示。<br>Figure 11. PID demonstration with a standing toy on the moving platform.</figcaption>
</figure>

## 总结

这次实验进一步验证了 6-PUS Stewart 平台的主动姿态稳定能力：从基于 SO(3) 的姿态前馈，到引入 PID 的闭环纠偏，再到利用 LADRC 估计和补偿集总扰动，三种控制方案在共同的实机执行链路上得到了验证。

实机结果中，PID 的代表性归一化响应比值相对前馈下降；LADRC 的观测器与补偿已经进入实际控制，但误差改善并不一致。偏心负载和动态扰动把残差预算、执行响应与输入条件带入了控制性能的评价。过流、输入过期和目标衔接拒绝则提醒我们，能计算补偿与能持续完成补偿，是不同层面的工程能力。

主动姿态稳定最终要把可靠的姿态测量、正确的旋转计算、及时的执行响应和稳定的运行链路连接起来。控制算法计算的是补偿命令，而真正决定稳定效果的是整套机器人系统能否将这份补偿准确、及时地转化为实际运动。
