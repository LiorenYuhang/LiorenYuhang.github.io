---
title: 6-PUS Stewart并联机构研究（二）：从Simscape简化建模到PID/ADRC闭环控制
date: 2026-08-27 11:24:12
tags: [Stewart平台, 并联机器人, 6-PUS, Simscape, PID控制, 自抗扰控制, ADRC, 多体动力学]
categories: 机器人
description: 记录 6-PUS Stewart 并联机构从 CAD 导入、参数化 Simscape Multibody 建模、运动学闭环检验，到力驱动关节空间 PID 内环与集中式 MIMO-LADRC 控制器的完整演进与仿真对比。
mathjax: true
---

<style>
.article-table-wrap { max-width: 100%; margin: 1em 0; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.article-table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.article-table th { text-align: center !important; white-space: nowrap; }
.article-table td.text { text-align: left !important; }
.article-table td.number { text-align: right !important; white-space: nowrap; }
.article-table td.status { text-align: center !important; white-space: nowrap; }
.article-table td.number mjx-container { display: inline-block !important; text-align: right !important; }
.article-table td.status mjx-container { display: inline-block !important; text-align: center !important; }
.geometry-grid { min-width: 760px; table-layout: fixed; }
.geometry-grid td { width: 33.333%; padding: .65em .45em !important; text-align: center !important; vertical-align: middle; }
.geometry-grid .coordinate-vector { display: block; white-space: nowrap; }
@media (max-width: 767px) { .article-table { min-width: 720px; } }
</style>

## 前言

在[上一篇文章](/2026/08/05/6-PUS%20Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/)中，我完成了 6-PUS 并联机构的机械构型分析、逆运动学推导以及理论工作空间求解。逆运动学回答了一个基础数学问题：*“当动平台需要达到特定的笛卡尔位姿时，六条支链执行器理论上应该伸缩到什么位置？”*

然而，在机器人与控制工程中，**逆运动学解算（Kinematics）并不等同于控制（Control）**。哪怕逆运动学数学公式完全精确，物理执行器也不会瞬间瞬移到目标位置——它们必须通过电机施加驱动力、克服惯性、重力与机构耦合阻力，在存在测量噪声与外部扰动的动态环境中实现稳定跟踪。

本文记录我如何将 6-PUS Stewart 机构从 CAD 多体模型逐步提炼为适合控制算法研究的参数化 Simscape Multibody 仿真环境，并经历“**运动学驱动 $\to$ 力驱动内环 $\to$ 六支链 PID $\to$ 集中式 MIMO-LADRC**”的完整控制架构演进历程。

---

## 1. 机构演进全景与技术主线

在进入具体细节之前，先梳理本项目从纯机构几何走向执行器级闭环控制的完整演进脉络：

```text
SolidWorks CAD 机械模型
  │ (Simscape Multibody Link 自动导出)
  ▼
Simscape 复杂导入模型
  [问题：装配层级深、存在隐式配合约束与坐标系转换，不适合作控制研究的标准被控对象]
  │
  ▼
从零构建参数化 6-PUS Simscape 模型
  [原则：严格保留 6P+6U+6S 拓扑与关键几何尺寸，参数由 MATLAB 集中驱动]
  │
  ▼
阶段 0：运动学与多体几何一致性验证 (Prescribed Motion)
  [验证：目标位姿 → 逆运动学 → 六支链位移约束 → Transform Sensor (数值精度一致)]
  │
  ▼
执行器模式转换：Motion Input → Force Actuation
  [跨越：Prismatic Joint 切换为力输入 (N)，由正向多体动力学求解运动因果]
  │
  ▼
阶段 1：六支链独立 PID 位置内环
  [实现：统一 PI-D 参数 + Back-Calculation 抗饱和，结合运动学前馈完成 6DOF 防抖验证]
  │
  ▼
阶段 2：集中式 MIMO-LADRC 内环
  [探索：18 状态 LESO + B₀ 增益矩阵辨识 + 固定 DSVD 阻尼分配器，实现扰动估计与解耦]
  │
  ▼
分层架构总结与基准冻结
  [定位：确立标准执行器内环接口，为后续任务空间外环与高级算法留出扩展空间]
```

这一演进过程体现了严谨的工程逻辑：**每一次架构调整，都是为了解决上一阶段暴露的具体物理或控制瓶颈，而非盲目堆砌控制理论**。

---

## 2. 为什么重新建立参数化 6-PUS Simscape 模型

### 2.1 完整 CAD 导入模型的局限

在项目初期，我基于 SolidWorks 建立了完整的 6-PUS 机械装配体，并通过 Simscape Multibody Link 工具将其导入 Simscape。

![图1：CAD 导出完整模型与装配体层级结构](/images/6-stewart-2/01-cad-complex-model.png)
*图1：CAD 导出完整多体模型与装配结构（左图为装配护筒后的整体外观，右图为六支链电动缸内部布局）。*

完整 CAD 多体模型在机构设计阶段具有重要价值（直观展示装配干涉、视觉效果逼真），但在进入控制算法闭环研究时，一系列阻碍迅速显现：
1. **多体装配约束繁重与冗余自由度**：CAD 配合关系转换到 Simscape 中会生成大量中间刚体坐标系与配合约束，甚至在部分子装配中引入了非理论必要的微小 Prismatic 或 Revolute 自由度；
2. **坐标系映射混淆**：CAD 导出模型的坐标系通常由主装配体原点决定（例如早期 CAD Y 轴对应理论垂直 Z 轴），导致逆运动学与多体传感之间需要反复进行旋转投影转换；
3. **求解器初始化敏感与性能损耗**：由于存在深层嵌套的刚体惯量矩阵与运动副配合，ODE 变步长求解器在初始化装配（Assembly）阶段容易出现约束不一致报警，仿真计算开销显著增加；
4. **控制调试归因困难**：当闭环出现超调或抖动时，研发人员很难迅速定位究竟是**控制器参数不良**、**逆运动学坐标对齐错误**，还是 **CAD 模型内部装配副的微小约束干涉**。

### 2.2 参数化简化建模的核心原则

为了给控制算法提供一个力学拓扑清晰、参数可编程控制的被控对象（plant），我决定从零搭建参数化的 6-PUS Simscape Multibody 模型。

> **必须明确**：所谓“简化”，**绝非降低机构的运动学真实性或削弱自由度**，而是：
> - 剔除对宏观刚体动力学无直接影响的螺钉、外壳等 CAD 几何细节；
> - 严格保留真实 6-PUS 并联机构的 **6P + 6U + 6S 拓扑构型**；
> - 严格保留基座铰点半径 $c$、动平台铰点半径 $d$、连杆杆长 $e$ 以及铰点分布角 $\lambda, \mu$ 等全部关键几何尺寸；
> - 严格保留电缸 25–75 mm 的物理行程限制；
> - 将机构完全参数化，使所有几何尺寸均由 MATLAB 脚本集中驱动。

从这一步开始，我不再将 Simscape 模型视为 CAD 图纸的“数字复刻品”，而是将其定义为**可供控制算法交互与迭代的仿真被控对象**。

---

## 3. 参数化 6-PUS Simscape Multibody 模型构建

### 3.1 机构运动副拓扑

简化模型严格由定平台（Base Platform）、6 条完全相同的 P-U-S 支链以及动平台（Moving Platform）构成。单条支链的拓扑序列如下：

```text
World Frame (世界坐标系，位于定平台几何中心 O)
  │
  ├── Base Platform (定平台刚体，固定于 World Frame)
  │     └── Rigid Transform Base_Ai: [Ai_x, Ai_y, 25 mm]
  │           │
  │           ▼
  │     Prismatic Joint (P_i，主动直线驱动，沿理论 +Z 方向)
  │           │
  │           ▼
  │     Slider (滑块刚体，提供直线运动质量)
  │           │
  │           ▼
  │     Universal Joint (U_i，虎克铰/十字铰，2-DOF 被动旋转)
  │           │
  │           ▼
  │     Rod (84 mm 刚性定长连杆)
  │           │
  │           ▼
  │     Spherical Joint (S_i，球铰，3-DOF 被动旋转)
  │           │
  │           ▼
  │     Rigid Transform Platform_Bi: [Bi_x, Bi_y, 0 mm]
  │           │
  └── Moving Platform (动平台刚体，6-DOF 自由空间运动)
        └── Platform Transform Sensor (测量动平台中心相对于 World Frame 的位姿)
```

整个多体系统中严格只包含：
- **6 个 Prismatic Joint**（各支链唯一的直线运动自由度）；
- **6 个 Universal Joint**（被动 2 自由度旋转）；
- **6 个 Spherical Joint**（被动 3 自由度旋转）；
- **14 个刚体 Solid**（Base、Platform、6 个 Slider、6 根定长 Rod）。
系统中不存在任何多余的浮动或约束关节。

模型内部仍使用刚体坐标变换将连杆两端放到 U 副与 S 副的几何中心，但这些局部偏移只服务于装配定位，不改变 P-U-S 拓扑，因此正文不再逐项展开。

![图2：参数化简化 6-PUS Simscape Multibody 拓扑架构](/images/6-stewart-2/02-parametric-6pus-model.svg)
*图2：参数化简化 6-PUS Simscape Multibody 拓扑架构。六条对称 P-U-S 支链连接定平台与动平台，Transform Sensor 独立输出动平台位姿。*

### 3.2 权威几何参数与位姿基准

根据机构几何定义与参数脚本，全系统核心几何参数设定如下：

<div class="article-table-wrap">
<table class="article-table">
<thead><tr><th>参数名称</th><th>符号</th><th>设定数值</th><th>单位</th><th>物理意义与说明</th></tr></thead>
<tbody>
<tr><td class="text">定平台铰点分布圆半径</td><td class="status">$c$</td><td class="number">40.0</td><td class="status">mm</td><td class="text">基座各滑块轴线所在的节圆半径</td></tr>
<tr><td class="text">动平台铰点分布圆半径</td><td class="status">$d$</td><td class="number">27.5</td><td class="status">mm</td><td class="text">动平台各球铰中心所在的节圆半径</td></tr>
<tr><td class="text">连杆长度</td><td class="status">$e$</td><td class="number">84.0</td><td class="status">mm</td><td class="text">虎克铰旋转中心至球铰球心的刚性几何距离</td></tr>
<tr><td class="text">定平台相邻铰点对夹角</td><td class="status">$\lambda$</td><td class="number">30.0 ($\pi/6$)</td><td class="status">deg</td><td class="text">基座同一安装对内两铰点的圆心角间隔</td></tr>
<tr><td class="text">动平台相邻铰点对夹角</td><td class="status">$\mu$</td><td class="number">60.0 ($\pi/3$)</td><td class="status">deg</td><td class="text">动平台同一安装对内两铰点的圆心角间隔</td></tr>
<tr><td class="text">电缸绝对行程范围</td><td class="status">$q_{abs}$</td><td class="number">[25.0, 75.0]</td><td class="status">mm</td><td class="text">物理滑块在基座导轨上的绝对位置范围（总行程 50 mm）</td></tr>
<tr><td class="text">Simscape 滑块位移范围</td><td class="status">$q_{sim}$</td><td class="number">[0.0, 50.0]</td><td class="status">mm</td><td class="text">定义 $q_{sim}=q_{abs}-25\,\mathrm{mm}$，零位对应机械下限</td></tr>
<tr><td class="text">动平台最低标称高度</td><td class="status">$z_{min}$</td><td class="number">107.61226796</td><td class="status">mm</td><td class="text">$q_{abs}=25\,\mathrm{mm}$（$q_{sim}=0$）时的水平动平台中心高度</td></tr>
<tr><td class="text">动平台中立标称高度</td><td class="status">$z_{mid}$</td><td class="number">132.61226796</td><td class="status">mm</td><td class="text">$q_{abs}=50\,\mathrm{mm}$（$q_{sim}=25\,\mathrm{mm}$）时的水平动平台中心高度</td></tr>
<tr><td class="text">动平台最高标称高度</td><td class="status">$z_{max}$</td><td class="number">157.61226796</td><td class="status">mm</td><td class="text">$q_{abs}=75\,\mathrm{mm}$（$q_{sim}=50\,\mathrm{mm}$）时的水平动平台中心高度</td></tr>
</tbody></table></div>

定平台 6 个导轨在水平面的安装位置 $A_i$ 与动平台 6 个球铰在动系中的安装位置 $b_i$ 严格按照解析几何展开：

<div class="article-table-wrap">
<table class="article-table geometry-grid">
<tbody>
<tr>
<td><span class="coordinate-vector">$A_1=\left[\begin{array}{c}-c\sin(\lambda/2)\\c\cos(\lambda/2)\\0\end{array}\right]$</span></td>
<td><span class="coordinate-vector">$A_2=\left[\begin{array}{c}-c\cos(\pi/6-\lambda/2)\\-c\sin(\pi/6-\lambda/2)\\0\end{array}\right]$</span></td>
<td><span class="coordinate-vector">$A_3=\left[\begin{array}{c}-c\cos(\pi/6+\lambda/2)\\-c\sin(\pi/6+\lambda/2)\\0\end{array}\right]$</span></td>
</tr>
<tr>
<td><span class="coordinate-vector">$A_4=\left[\begin{array}{c}c\cos(\pi/6+\lambda/2)\\-c\sin(\pi/6+\lambda/2)\\0\end{array}\right]$</span></td>
<td><span class="coordinate-vector">$A_5=\left[\begin{array}{c}c\cos(\pi/6-\lambda/2)\\-c\sin(\pi/6-\lambda/2)\\0\end{array}\right]$</span></td>
<td><span class="coordinate-vector">$A_6=\left[\begin{array}{c}c\sin(\lambda/2)\\c\cos(\lambda/2)\\0\end{array}\right]$</span></td>
</tr>
</tbody>
</table>
</div>

<div class="article-table-wrap">
<table class="article-table geometry-grid">
<tbody>
<tr>
<td><span class="coordinate-vector">$b_1=\left[\begin{array}{c}-d\cos(\pi/6+\mu/2)\\d\sin(\pi/6+\mu/2)\\0\end{array}\right]$</span></td>
<td><span class="coordinate-vector">$b_2=\left[\begin{array}{c}-d\cos(\pi/6-\mu/2)\\d\sin(\pi/6-\mu/2)\\0\end{array}\right]$</span></td>
<td><span class="coordinate-vector">$b_3=\left[\begin{array}{c}-d\sin(\mu/2)\\-d\cos(\mu/2)\\0\end{array}\right]$</span></td>
</tr>
<tr>
<td><span class="coordinate-vector">$b_4=\left[\begin{array}{c}d\sin(\mu/2)\\-d\cos(\mu/2)\\0\end{array}\right]$</span></td>
<td><span class="coordinate-vector">$b_5=\left[\begin{array}{c}d\cos(\pi/6-\mu/2)\\d\sin(\pi/6-\mu/2)\\0\end{array}\right]$</span></td>
<td><span class="coordinate-vector">$b_6=\left[\begin{array}{c}d\cos(\pi/6+\mu/2)\\d\sin(\pi/6+\mu/2)\\0\end{array}\right]$</span></td>
</tr>
</tbody>
</table>
</div>

### 3.3 坐标系与欧拉角转换约定

为消除坐标轴系定义上的歧义，模型确立如下约定：
- **全局参考系 $O-XYZ$**：原点位于定平台基准圆心，+Z 轴竖直向上；
- **动平台坐标系 $O'-X'Y'Z'$**：原点位于动平台几何中心，+Z' 垂直于动平台向上；
- **姿态旋转矩阵**：采用标准的 **ZYX 顺规欧拉角**（先绕全局 Z 轴转 $\gamma$，再绕新 Y 轴转 $\beta$，最后绕新 X 轴转 $\alpha$）：

$$
R = R_z(\gamma) R_y(\beta) R_x(\alpha)
$$

- **Transform Sensor 读数一致性**：Simscape Transform Sensor 配置为输出 ZYX 欧拉角序列 $[\gamma, \beta, \alpha]$，经前端重排后得到 $[\alpha, \beta, \gamma]$，与逆运动学姿态输入完全对齐。

### 3.4 简化模型的有效性边界

> **模型有效性边界说明**：
> 当前参数化多体模型已严格验证了几何拓扑与运动学的一致性，能够有效支持控制算法架构演化、力驱动闭环分析及控制器横向对比。但需要指出的是，该模型基于刚体多体动力学假设，目前尚未包含电机反电动势、绕组电气动态、传动齿隙背隙、连杆弹性柔性、摩擦非线性以及通信延迟等实物动力学特性。因此，该模型是控制算法开发的可靠仿真基准，但尚不能等同于物理样机的高保真数字孪生。

---

## 4. 运动学闭环与多体一致性验证

在给机构添加受控动力学之前，必须首先进行**运动学闭环一致性检验（Kinematic Consistency Check）**。

### 4.1 这一阶段在验证什么？

这一阶段并非在检验“控制器的跟踪能力”，而是在验证一个几何与数学事实：
> **如果在 MATLAB 算法中输入一个笛卡尔目标位姿 $[x, y, z, \alpha, \beta, \gamma]$，通过逆运动学解析求出六个电缸位移 $q_{\mathrm{sim},1\dots 6}$，再将其直接作为 Prismatic Joint 的位置输入，那么 Simscape 经多体运动学约束求解后，Transform Sensor 测得的实际位姿是否与目标位姿重合？**

这是并联机构控制体系成立的几何基准。

### 4.2 实测验证结果

我在 MATLAB 环境下执行了涵盖纯平移、单轴姿态旋转以及极限行程边界的 8 类典型测试：

![图3：典型工况下的数值精度汇总与六支链位移分配](/images/6-stewart-2/03-kinematic-validation.svg)
*图3：阶段 0 运动学闭环一致性验证。上方直接给出最大误差，避免用对数坐标增加读图门槛；下方展示八类工况对应的六支链绝对行程分配。*

测试结果汇总如下：

<div class="article-table-wrap">
<table class="article-table">
<thead><tr><th>测试工况编号与内容</th><th>目标位姿 $[x,y,z,\alpha,\beta,\gamma]$<br>(mm, deg)</th><th>逆解理论 $q_{abs}$<br>(mm)</th><th>最大位置误差<br>(mm)</th><th>最大角度误差<br>(rad)</th><th>判定</th></tr></thead>
<tbody>
<tr><td class="text"><strong>Test 1：机械下限水平位姿</strong></td><td class="number">$[0,0,107.6123,0,0,0]$</td><td class="number">$[25,25,25,25,25,25]$</td><td class="number">$2.06\times10^{-9}$</td><td class="number">$0$</td><td class="status"><strong>PASS</strong></td></tr>
<tr><td class="text"><strong>Test 2：中立水平位姿</strong></td><td class="number">$[0,0,132.6123,0,0,0]$</td><td class="number">$[50,50,50,50,50,50]$</td><td class="number">$1.02\times10^{-13}$</td><td class="number">$0$</td><td class="status"><strong>PASS</strong></td></tr>
<tr><td class="text"><strong>Test 3：机械上限水平位姿</strong></td><td class="number">$[0,0,157.6123,0,0,0]$</td><td class="number">$[75,75,75,75,75,75]$</td><td class="number">$7.29\times10^{-14}$</td><td class="number">$0$</td><td class="status"><strong>PASS</strong></td></tr>
<tr><td class="text"><strong>Test 4：X 方向平移 +5 mm</strong></td><td class="number">$[5,0,132.6123,0,0,0]$</td><td class="number">$[49.95,50.83,51.04,49.27,49.48,50.36]$</td><td class="number">$4.51\times10^{-14}$</td><td class="number">$0$</td><td class="status"><strong>PASS</strong></td></tr>
<tr><td class="text"><strong>Test 5：Y 方向平移 +5 mm</strong></td><td class="number">$[0,5,132.6123,0,0,0]$</td><td class="number">$[49.26,50.78,50.42,50.42,50.78,49.26]$</td><td class="number">$8.33\times10^{-14}$</td><td class="number">$0$</td><td class="status"><strong>PASS</strong></td></tr>
<tr><td class="text"><strong>Test 6：绕 X 轴旋转 $\alpha=+5^\circ$</strong></td><td class="number">$[0,0,132.6123,5^\circ,0,0]$</td><td class="number">$[52.09,50.00,47.93,47.93,50.00,52.09]$</td><td class="number">$0$</td><td class="number">$4.77\times10^{-16}$</td><td class="status"><strong>PASS</strong></td></tr>
<tr><td class="text"><strong>Test 7：绕 Y 轴旋转 $\beta=+5^\circ$</strong></td><td class="number">$[0,0,132.6123,0,5^\circ,0]$</td><td class="number">$[51.20,52.41,51.21,48.81,47.62,48.80]$</td><td class="number">$0$</td><td class="number">$4.70\times10^{-15}$</td><td class="status"><strong>PASS</strong></td></tr>
<tr><td class="text"><strong>Test 8：绕 Z 轴旋转 $\gamma=+5^\circ$</strong></td><td class="number">$[0,0,132.6123,0,0,5^\circ]$</td><td class="number">$[50.35,49.75,50.35,49.75,50.35,49.75]$</td><td class="number">$0$</td><td class="number">$6.23\times10^{-16}$</td><td class="status"><strong>PASS</strong></td></tr>
</tbody></table></div>

实测数据表明：
- 在所覆盖的 8 组典型位姿工况下，**最大笛卡尔位置误差**为 $2.06 \times 10^{-9}$ mm；
- **最大关节位置误差**为 $1.42 \times 10^{-14}$ mm；
- **最大姿态角误差**为 $4.70 \times 10^{-15}$ rad。

上述微小误差完全处于双精度浮点数运算与 ODE15s 求解器的数值截断误差范围内。这证明了在所测试的代表性工况下，**MATLAB 独立逆运动学函数、Simscape 几何参数化拓扑与 ZYX 姿态测量链路在数值精度上保持了一致**。

---

## 5. 范式转换：从理想运动输入到力驱动闭环

### 5.1 为什么运动学驱动还不是闭环控制？

在上述运动学验证中，Prismatic Joint 的配置模式为：
```text
Actuation:
  Motion: Provided by Input
  Force:  Automatically Computed
```
这意味着，Simscape 求解器在每个时间步将给定的运动轨迹作为**刚性运动学约束**强加于 Prismatic Joint，并由多体求解器隐式计算维持该约束所需的反作用力。**运动轨迹本身完全由外部输入直接规定，而非由执行器的受控动力学响应产生。**

但在真实的 6-PUS 机器人样机中：
- 控制器无法直接向物理空间“指定”位置轨迹；
- 控制器输出的是**控制量（如推力 $F_i$、电流或 PWM 占空比）**；
- 机构最终产生多大的加速度与位移，由**牛顿-欧拉动力学方程、机构惯量、重力与外力平衡**共同决定。

因此，**理想运动学驱动（Prescribed Motion）属于“运动学轨迹规划与几何验证”，尚未触及“动力学与反馈控制”问题**。

### 5.2 切换至力驱动（Force Actuation）

为了构建具有动力学意义的多体闭环仿真，我对六个 Prismatic Joint 进行了模式重构：

```text
Actuation:
  Force:  Provided by Input (N)
  Motion: Automatically Computed
```

![图4：运动学驱动与力驱动闭环控制架构对比](/images/6-stewart-2/04-motion-vs-force.svg)
*图4：运动学驱动（Prescribed Motion）把关节轨迹作为几何约束；力驱动（Force Actuation）由控制器输出推力，并通过关节位置与速度反馈形成动力学闭环。*

切换之后，系统的物理因果律发生根本变化：
- 控制器输出物理量为**推力 $F_i \in \mathbb{R}$（单位：N）**；
- 六个滑块的位置反馈 $q_{sim,meas}$ 与速度反馈 $\dot{q}_{sim,meas}$ 由 Simscape 传感端口实时测得，并反馈至控制器形成闭环；
- 六条支链的推力共同作用于动平台，系统呈现出受控刚体多体动力学响应。

> **多体测试工程规则：避免混合驱动测试**
> 在多体动力学测试中，不应采用部分支链运动输入、部分支链力输入的混合测试模型。因为规定运动的支链会施加强运动学约束，改变全系统力驱动时的自然动力学响应与支链耦合特性，导致测试无法真实反映目标六支链力驱动系统的动态行为。因此，单轴控制器的预调应在独立的单轴测试台（Single-Axis Test Harness）上完成；而在完整 6-PUS 机构仿真中，六条支链统一切换为力驱动。

---

## 6. 六支链 PID 位置内环设计与基准建立

PID 控制器是工业界成熟、直观的控制基准。在本项目中，我首先建立**六支链独立关节/执行器空间 PID 位置内环**，作为全系统的基准控制器。

### 6.1 控制架构与空间定位

必须首先澄清控制器的作用空间：
> **本阶段的 PID 控制器工作在关节/执行器空间（joint/actuator space），而非笛卡尔任务空间（Cartesian task space）。**

任务空间目标先经解析逆运动学映射为六支链期望位移；每个内环再比较期望位移与实测位移，输出对应支链推力。任务空间负责“平台要去哪里”，关节/执行器空间内环负责“六条支链如何跟上”。图 5 给出了其中一个通道的完整闭环结构。

逆运动学充当了从“任务空间”到“执行器空间”的参考映射器；而 PID 负责确保六个执行器能够稳定跟踪各自的位移目标。

### 6.2 采用的 PI-D 数学结构与抗饱和设计

为了避免阶跃设定值引入“微分冲击（derivative kick）”，我采用了工程上常见的 **PI-D 结构**。这里的 PI-D 表示比例项与积分项作用在位置误差上，而 D 项不直接对误差求导，而是通过实测速度反馈提供阻尼；名称中间的连字符只是强调这种结构拆分，并不是额外的减法运算。

对于第 $i$ 条支链（$i = 1, \dots, 6$）：

**1. 位置跟踪误差**：

记位移偏差为 $\Delta q_i(t) = q_{\mathrm{sim},i}^{\mathrm{des}}(t) - q_{\mathrm{sim},i}^{\mathrm{meas}}(t)$，则

$$
e_i(t) = 10^{-3}\Delta q_i(t) \quad [\mathrm{m}]
$$

**2. 积分力状态动态方程（含反算抗饱和回路）**：

记反算校正量为 $\Delta F_i(t) = F_{\mathrm{cmd},i}(t) - F_{\mathrm{unsat},i}(t)$，积分力状态 $F_{I,i}(t)$ 的微分方程为：

$$
\frac{\mathrm{d}F_{I,i}(t)}{\mathrm{d}t}
= K_i e_i(t) + K_{\mathrm{aw}}\Delta F_i(t)
$$

积分力状态由其变化率积分得到：

$$
F_{I,i}(t) = \int_0^t \dot{F}_{I,i}(\tau)\,\mathrm{d}\tau
$$

其中 $F_{I,i}$ 的单位为 N。反算抗饱和跟踪增益为：

$$
K_{\mathrm{aw}} = 20\,\mathrm{s}^{-1}
$$

**3. 未饱和总控制力输出**：

以 $v_i(t) = \dot{q}_{\mathrm{sim},i}^{\mathrm{meas}}(t)$ 表示实测关节速度，则

$$
F_{\mathrm{unsat},i}(t) = K_p e_i(t) + F_{I,i}(t) - K_d v_i(t)
$$

**4. 仿真推力限幅输出**：

$$
F_{\mathrm{hi},i}(t) = \min\left(15\,\mathrm{N},\ F_{\mathrm{unsat},i}(t)\right)
$$

$$
F_{\mathrm{cmd},i}(t) = \max\left(-15\,\mathrm{N},\ F_{\mathrm{hi},i}(t)\right)
$$

*注：$\pm 15$ N 为当前仿真环境设定的控制力饱和限幅值。*

![图5：六支链独立 PI-D 控制器单通道结构](/images/6-stewart-2/05-pid-inner-loop.svg)
*图5：六支链独立 PI-D 控制器的单通道结构。P、I 两项处理位置误差，D 通道以实测速度的负反馈形式提供阻尼；饱和前后推力差经 back-calculation 回送积分器，实现抗积分饱和。*

### 6.3 权威冻结参数

经过单轴预调与多轴测试，六条支链基于对称性采用了统一基准参数：

<div class="article-table-wrap">
<table class="article-table">
<thead><tr><th>参数名称</th><th>符号</th><th>权威数值</th><th>单位</th><th>物理意义与整定考量</th></tr></thead>
<tbody>
<tr><td class="text">比例增益</td><td class="status">$K_p$</td><td class="number">3000.0</td><td class="status">N/m</td><td class="text">提供主要的位置恢复刚度</td></tr>
<tr><td class="text">积分增益</td><td class="status">$K_i$</td><td class="number">400.0</td><td class="status">N/(m·s)</td><td class="text">消除重力、静态载荷与稳态静差</td></tr>
<tr><td class="text">微分/速度阻尼增益</td><td class="status">$K_d$</td><td class="number">18.0</td><td class="status">N·s/m</td><td class="text">抑制多体振荡，提供阻尼</td></tr>
<tr><td class="text">仿真推力限幅</td><td class="status">$F_{limit}$</td><td class="number">$\pm15.0$</td><td class="status">N</td><td class="text">仿真设定的执行器推力饱和边界</td></tr>
<tr><td class="text">反算抗饱和增益</td><td class="status">$K_{aw}$</td><td class="number">20.0</td><td class="status">$\mathrm{s}^{-1}$</td><td class="text">保证力饱和退出后积分状态迅速恢复</td></tr>
</tbody></table></div>

在 Simscape 环境中，重力设为恒定值 $[0, 0, -9.80665]\text{ m/s}^2$；定平台质量 0.1835 kg，动平台质量 0.0623 kg，单滑块质量 0.00163 kg，单连杆质量 0.00641 kg。

---

## 7. PID 闭环的系统级性能验证

PID 内环的验证覆盖了多轴轨迹跟踪、基座单轴防抖补偿以及全 6DOF 复杂复合扰动工况。所有数据均来自真实仿真测试。

### 7.1 PID-4：逆运动学重连多轴跟踪性能

在动平台各独立轴上施加标准幅值与频率的连续参考轨迹，检验六支链 PID 的跟踪精度：

<div class="article-table-wrap">
<table class="article-table">
<thead><tr><th>激发运动轴向</th><th>最大关节 RMSE<br>(mm)</th><th>动平台末端位姿 RMSE</th><th>执行器峰值推力<br>(N)</th><th>实测行程范围<br>(mm)</th><th>饱和发生判定</th></tr></thead>
<tbody>
<tr><td class="text"><strong>X 轴平移</strong></td><td class="number">0.03563</td><td class="number">0.01873 mm</td><td class="number">0.1995</td><td class="number">24.8836–25.0752</td><td class="status"><strong>0 s（无饱和）</strong></td></tr>
<tr><td class="text"><strong>Y 轴平移</strong></td><td class="number">0.03560</td><td class="number">0.01873 mm</td><td class="number">0.1995</td><td class="number">24.8834–25.0751</td><td class="status"><strong>0 s（无饱和）</strong></td></tr>
<tr><td class="text"><strong>Z 轴平移</strong></td><td class="number">0.03562</td><td class="number">0.03562 mm</td><td class="number">0.1995</td><td class="number">24.4808–25.4742</td><td class="status"><strong>0 s（无饱和）</strong></td></tr>
<tr><td class="text"><strong>Rx 轴旋转</strong></td><td class="number">0.03555</td><td class="number">$6.54\times10^{-6}$ rad</td><td class="number">0.1995</td><td class="number">24.9321–25.0229</td><td class="status"><strong>0 s（无饱和）</strong></td></tr>
<tr><td class="text"><strong>Ry 轴旋转</strong></td><td class="number">0.03555</td><td class="number">$6.54\times10^{-6}$ rad</td><td class="number">0.1995</td><td class="number">24.9257–25.0293</td><td class="status"><strong>0 s（无饱和）</strong></td></tr>
<tr><td class="text"><strong>Rz 轴旋转</strong></td><td class="number">0.03556</td><td class="number">$4.47\times10^{-5}$ rad</td><td class="number">0.1995</td><td class="number">24.9400–25.0000</td><td class="status"><strong>0 s（无饱和）</strong></td></tr>
</tbody></table></div>

各工况最大关节 RMSE 均处于 **0.036 mm 以内**（最大值为 0.03563 mm），峰值推力仅约 **0.20 N**，处于 $\pm 15$ N 仿真限幅范围内。

### 7.2 PID-5 ~ PID-7：前馈运动学补偿与 PID 内环的系统防抖响应

在基座施加外生运动扰动（模拟船舶晃动或车载颠簸），通过**刚体运动学前馈补偿层** $T_{BP}^{des} = T_{WB}^{-1} T_{WP}^{des}$ 计算执行器期望位移，并由 **PID 执行器内环**进行闭环跟踪：

> **防抖效果的技术归因**：
> PID-5 至 PID-7 的防抖衰减表现是**上层刚体运动学前馈补偿与底层 PID 执行器跟踪内环协同工作的系统级结果**。其中，前馈补偿层负责根据基座扰动实时计算反向抵消位姿，而 PID 内环负责精确驱动六条支链跟踪该补偿轨迹。

![图6：基座扰动下动平台防抖响应曲线](/images/6-stewart-2/06-pid-antivibration.png)
*图6：刚体运动学前馈补偿结合 PID 执行器内环的 X 向防抖响应。上图为基座扰动，中图对比关闭/开启补偿后的动平台世界坐标位移，下图为对应残差；开启补偿后残差衰减达 -22.22 dB。原始数据曲线保持不变。*

- **PID-5（单轴 X 扰动）**：动平台残余位移抑制比 $R_X = 0.0775$（衰减达 **-22.22 dB**），残余位移改善倍率达 **12.99 倍**；
- **PID-6（六轴独立扰动）**：各轴抑制比在 **0.0232 至 0.0775** 之间，全轴无饱和；
- **PID-7（复合六自由度扰动）**：在全 6DOF 复合扰动下，所有受控轴的残余抑制比均低于 **0.138**，最大关节 RMSE 为 0.0293 mm，峰值推力 0.2656 N（有效均方根力 0.1894 N），行程维持在 23.04–27.15 mm（完全处于 0–50 mm 范围内）。

### 7.3 PID 阶段的技术总结

PID baseline 的成功建立给项目带来了重要的工程结论：
1. 参数化简化 6-PUS 模型完全能够支持正向力驱动闭环控制；
2. 统一增益的六支链独立 PID 能够在多体系统内部耦合存在的情况下维持闭环稳定跟踪，实现全轴最大关节 RMSE 约 0.036 mm 的跟踪表现；
3. **确立了标准内环接口**：后续无论更换何种高级控制器，都可以**严格保持被控对象、逆运动学、输入输出接口与物理参数完全不变**，从而确保不同控制算法之间的严格可比性。

---

## 8. 从 PID 到 ADRC/LADRC：强耦合与扰动估计需求

### 8.1 为什么继续探索自抗扰控制（ADRC）？

PID 取得了良好的基准表现，但在并联机构的深入研究中，我继续探索自抗扰控制（ADRC），主要出于以下科研目标：
- **支链间的动力学耦合分析**：动平台空间惯量由六条支链共同驱动，单支链的推力变化会通过动平台传递到其余支链；
- **显式扰动估计与状态重构**：希望利用**线性扩张状态观测器（Linear Extended State Observer, LESO）**实时估计未建模动态与外扰构成的“总扰动”并在控制律中进行扰动补偿；
- **为后续高级控制提供观测支撑**：LESO 能够输出滤波位置、速度及总扰动估计，为后续多变量控制与外环研究提供丰富的状态接口。

### 8.2 独立单通道 ADRC 的局限性

在初期探索中，我尝试为六条支链分别配置独立的单输入单输出（SISO）线性自抗扰控制器（LADRC）。

六个独立的 SISO 控制器并未显式建模各支链之间的交叉输入耦合，而是试图将通道间的力学耦合全部归入各自通道的“总扰动”中由 SISO LESO 进行估计。在 6-PUS 机构多轴强耦合运动时，这种未显式解耦的结构会加重观测器的估计负担，影响观测精度与瞬态响应。

这促使我进一步研究**集中式六输入六输出关节空间线性自抗扰控制（MIMO-LADRC）**。

### 8.3 局部输入增益矩阵 $B_0$ 与固定 DSVD 阻尼分配器

在标称平衡工作点 $q_0 = [25, 25, 25, 25, 25, 25]^T\,\mathrm{mm}$ 处，我通过对多体系统施加微小测试信号，辨识出局部有效输入增益矩阵 $B_0 = B_{\mathrm{eff}}(q_0) \in \mathbb{R}^{6 \times 6}$（单位：$(\mathrm{m/s}^2)/\mathrm{N}$）。

对 $B_0$ 进行奇异值分解（SVD）：$B_0 = U \Sigma V^T$，得到的 6 个奇异值依次为 61.020、61.020、54.253、1.506、0.627、0.627。

矩阵二范数条件数为 $\mathrm{cond}_2(B_0) = 97.32$。

**特征分析与分配器设计**：
- 前 3 个模态奇异值较大（$54 \sim 61$），代表易于激发的强主导运动模态；而后 2 个模态奇异值仅为 $0.627$，代表在局部 $B_0$ 映射下输入对加速度控制效能较弱（low input-to-acceleration authority）的方向；
- 若直接采用标准 Moore-Penrose 伪逆求逆（$B^\dagger = B_0^{-1}$），弱模态的逆增益高达 $1/0.627 \approx 1.595$，容易在控制分配中放大传感器高频噪声；
- 为此，我设计了**固定阻尼定向 SVD 分配器（Directional Damped SVD, DSVD）**：设定阻尼向量 $\lambda = [0, 0, 0, 0, 0.1, 0.1]$，并构造离线固定的阻尼逆分配矩阵：

$$
B_{\mathrm{DSVD}}^{\dagger} = V\,\mathrm{diag}\left(\frac{\sigma_i}{\sigma_i^2 + \lambda_i}\right)U^T
$$

- $B_{\mathrm{DSVD}}^{\dagger}$ 的二范数降至 **$1.2714$**（相比标准伪逆降低 20.3%），有效抑制了弱模态的反转增益放大；该矩阵离线固定，在线执行仅需一次 $6 \times 6$ 矩阵乘法。

---

## 9. 集中式 MIMO-LADRC 架构设计与验证

### 9.1 增量平衡模型与 18 状态 LESO

MIMO-LADRC 建立在增量控制模型之上：

$$
u_{total} = u_{bias} + \Delta u, \qquad \ddot{q} = B_0 \Delta u + d
$$

其中 $u_{bias} = 0.1807565 \times \mathbf{1}_6\text{ N}$ 为标称工作点处平衡重力的开环静态支撑推力（在数值模型上平衡重力加速度）。

1. **18 状态集中式 LESO**：观测状态包含位置 $Z_1$、速度 $Z_2$ 与总扰动 $Z_3$（各 6 维）。观测器接收实际饱和后的增量推力 $\Delta u_{actual} = u_{total,actual} - u_{bias}$，确保观测器动力学与执行器输出一致；
2. **虚拟加速度与推力分配**：计算虚拟加速度 $v = K_p (V_1 - Z_1) + K_d (V_2 - Z_2) - Z_3$，再由 DSVD 分配矩阵求得增量推力 $\Delta u = B_{\mathrm{DSVD}}^{\dagger}v$。

### 9.2 权威冻结参数

参数采用经典的 Gao 频域带宽整定法：

<div class="article-table-wrap">
<table class="article-table">
<thead><tr><th>控制器模块</th><th>参数符号</th><th>数值</th><th>换算公式 / 物理说明</th></tr></thead>
<tbody>
<tr><td class="text">控制器带宽</td><td class="status">$\omega_c$</td><td class="number">30.0 rad/s</td><td class="text">决定闭环响应刚度</td></tr>
<tr><td class="text">观测器带宽</td><td class="status">$\omega_o$</td><td class="number">120.0 rad/s</td><td class="text">设定为 $4\omega_c$，兼顾扰动估计速度与测噪敏感度</td></tr>
<tr><td class="text">跟踪微分器带宽</td><td class="status">$\omega_{td}$</td><td class="number">60.0 rad/s</td><td class="text">安排过渡过程，滤除输入突变</td></tr>
<tr><td class="text">虚拟 PD 增益</td><td class="status">$K_p,K_d$</td><td class="number">$900.0\,\mathrm{s}^{-2},\ 60.0\,\mathrm{s}^{-1}$</td><td class="text">$K_p=\omega_c^2,\ K_d=2\zeta_c\omega_c\ (\zeta_c=1)$</td></tr>
<tr><td class="text">LESO 观测增益</td><td class="status">$\beta_1,\beta_2,\beta_3$</td><td class="number">$360\,\mathrm{s}^{-1},\ 43200\,\mathrm{s}^{-2},\ 1728000\,\mathrm{s}^{-3}$</td><td class="text">$\beta_1=3\omega_o,\ \beta_2=3\omega_o^2,\ \beta_3=\omega_o^3$</td></tr>
<tr><td class="text">静态支撑偏置</td><td class="status">$u_{bias}$</td><td class="number">$0.1807565\times\mathbf{1}_6$ N</td><td class="text">平衡标称点重力</td></tr>
<tr><td class="text">仿真推力限幅</td><td class="status">$F_{limit}$</td><td class="number">$\pm15.0$ N</td><td class="text">每通道总力限幅</td></tr>
<tr><td class="text">DSVD 阻尼向量</td><td class="status">$\lambda$</td><td class="number">$[0,0,0,0,0.1,0.1]$</td><td class="text">定向抑制弱模态反转增益</td></tr>
</tbody></table></div>

> **启动瞬态（Initialization Transients）消除**：
> 在初始状态下，必须规范初始化条件：$V_1(0) = q_d(0), V_2(0) = 0$；$Z_1(0) = q_{meas}(0), Z_2(0) = \dot{q}_{meas}(0), Z_3(0) = 0$；$u_{total}(0) = u_{bias}$。这有效消除了初始时刻因位置阶跃误判引发的控制力饱和冲击。

### 9.3 动态轨迹跟踪与扰动估计实测

我在多轴连续跟踪实验中测试了 0.5 Hz、幅值 1 mm 的同相输入与正负交替输入。交替工况的幅值向量为 $[+1,-1,+1,-1,+1,-1]^T\,\mathrm{mm}$；受机构对称性影响，部分支链曲线成对重合，图中视觉上出现的独立曲线数少于六条。

![图7：集中式 MIMO-LADRC 代表性多轴跟踪与扰动估计总览](/images/6-stewart-2/07-mimo-ladrc-overview.png)
*图7：集中式 MIMO-LADRC 代表性多轴跟踪、控制力与 LESO 总扰动估计。该图对应正负交替输入工况；由于对称通道响应高度重合，图中多条曲线相互覆盖。*

实验指标记录如下：
- **同相轨迹（In-phase）**：六关节最大跟踪误差 0.1300 mm，控制力峰值 0.1818 N，无力饱和；
- **非对称交替轨迹（Asymmetric）**：六关节最大跟踪误差 0.1286 mm，控制力峰值 0.3400 N，LESO $Z_3$ 估计峰值 $0.2377\text{ m/s}^2$，DSVD 实时分配残差二范数处于 $10^{-8}\text{ m/s}^2$ 极小量级，全程无饱和。

---

## 10. PID 与 ADRC 在本项目中的客观对比与工程角色定位

### 10.1 客观特性对比

基于代表性特性测试（characterization tests），我对 PID 与 MIMO-LADRC 进行了多维对比：

| 对比维度 | 六支链独立 PID 内环 | 集中式 MIMO-LADRC 内环 |
| :--- | :--- | :--- |
| **算法结构** | 六个独立标量控制回路，无显式跨通道解耦 | 集中式 18 状态观测器 + $6\times 6$ DSVD 分配 |
| **参数物理意义** | $K_p, K_i, K_d$ 直观对应刚度、稳态精度与阻尼 | $\omega_c, \omega_o, \omega_{td}, B_0, \lambda$ 对应系统频域带宽与解耦空间 |
| **计算与实现开销** | 极低（标量运算） | 较高（18 阶微分方程组与矩阵向量积） |
| **标称轨迹跟踪 (4s 0.5Hz 1mm 特性测试)** | **RMSE 约 0.0494 mm**（相位滞后约 $1.09^\circ$） | **RMSE 约 0.0760 mm**（相位滞后约 $6.12^\circ$） |
| **微小推力扰动响应 ($\le 0.05$ N)** | 响应平稳，误差衰减良好 | 响应平稳，$Z_3$ 可清晰重构扰动形态 |
| **大推力扰动响应 ($1.0$ N 执行器扰动)** | 保持闭环稳定并完成测试 | 在 1.10 s 触发位移安全保护停机 |
| **质量参数摄动容忍 (+20% 动平台质量)** | 平稳完成全时长仿真 | 短时测试通过，长时间仿真出现求解器明显减速 |
| **对上层高级控制的接口价值** | 提供标准底层位置随动闭环 | **提供状态与总扰动估计 ($Z_1, Z_2, Z_3$)，可作为上层算法的丰富观测接口** |

*注：上述标称跟踪数据来自 4 s 0.5 Hz 1 mm 同相特性的代表性测试记录。*

### 10.2 关键工程发现与局限性剖析

对比测试揭示了局部模型的物理特性：
1. **局部线性化模型的边界**：$B_0$ 是在零位平衡点辨识的局部增益矩阵。当受到 1.0 N 大扰动产生较大幅度位移时，机构状态偏离标称点，真实多体动力学与固定 $B_0$ 出现失配；
2. **积分作用与观测器带宽权衡**：PID 积分项对直流载荷具有高增益；而 LESO 的估计速度受限于有限带宽 $\omega_o = 120$ rad/s，面对大幅突变时存在瞬态延迟；
3. **工程定位**：MIMO-LADRC 的核心价值在于构建了一个包含多轴解耦与状态/扰动观测的现代控制框架，为后续任务空间补偿与高级算法研究提供了标准化的状态观测接口。

---

## 11. 当前内环架构与后续任务空间补偿接口

### 11.1 当前控制系统分层架构

经过本阶段的研究，6-PUS 并联机构的控制系统形成了清晰的层次划分：

![图8：6-PUS 并联机构分层控制体系与任务空间接口](/images/6-stewart-2/08-layered-architecture.svg)
*图8：6-PUS 分层控制架构。实线区域表示本阶段已完成或已验证的刚体运动学补偿、逆运动学、执行器内环与多体被控对象；浅色虚线区域表示未来可接入的任务空间反馈外环。*

### 11.2 为什么真正的防抖控制发生在 IK 之前？

必须明确控制层次的职责：
> **当前建立的 PID 与 ADRC 解决的是六支链执行器的“位置跟踪内环”问题。而平台防抖（Stabilization）的核心逻辑，发生在逆运动学之前！**

当安装 6-PUS 的基座发生空间晃动（$T_{WB}$ 变化）时，要使动平台在惯性空间中保持稳定，必须在任务空间中实时生成动平台相对于基座的补偿指令：

$$
T_{BP}^{cmd}(t) = T_{WB}^{-1}(t) \cdot T_{WP}^{des}
$$

其中，基座位姿扰动 $T_{WB}$ 在仿真中由预设基座运动或 Transform Sensor 提供，未来在物理样机上则由 IMU 或外部位姿测量系统提供。

这为**后续任务空间外环研究**确立了清晰的接口边界：
- 已经验证的**刚体运动学前馈补偿**在几何层面计算理论反向位姿；
- 后续可探索在任务空间引入外环反馈（如外环 PI、任务空间 ADRC 或 SAC 强化学习残差补偿）以进一步消除残余姿态抖动；
- 底层被控对象始终是 6-PUS 多体模型，已冻结的 PID 与 MIMO-LADRC 内环为上层算法提供了可靠的执行器闭环基线。

---

## 12. 总结

在本篇博客中，我完整走过了 6-PUS Stewart 并联机构从机械几何走向闭环控制系统的全过程：
1. **从 CAD 导入到参数化多体建模**：明确了简化机械几何而不改变运动学拓扑的原则，搭建了 6P+6U+6S Simscape Multibody 仿真平台；
2. **完成了运动学闭环检验**：验证了典型位姿下解析逆解与多体几何的数值一致性；
3. **实现了从运动驱动到力驱动的范式转换**：将动力学因果律引入仿真，使执行器受控推力成为唯一的运动输入；
4. **建立了六支链 PID 稳定基准**：统一 PI-D 参数在多轴轨迹跟踪中实现最大关节 RMSE 约 0.036 mm，并结合刚体前馈补偿完成 6DOF 扰动下的系统级防抖验证；
5. **深入研究了集中式 MIMO-LADRC**：通过输入增益矩阵辨识与固定 DSVD 阻尼分配器，探索了多轴解耦与状态/扰动观测架构。

在本系列的下一篇文章中，我将把目光投向物理样机——**探讨如何将仿真控制架构落地到真实的 6-PUS 机械系统上，通过 UART 通信、ROS2 控制节点与六轴协同驱动器，实现实体机器人的连续运动控制。**
