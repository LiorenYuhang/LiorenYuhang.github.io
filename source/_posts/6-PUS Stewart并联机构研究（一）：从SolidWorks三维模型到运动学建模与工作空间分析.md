---
title: 6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析
date: 2026-08-05 16:00:00
tags: [Stewart平台, 并联机器人, 6-PUS, MATLAB, 运动学, 工作空间]
categories: 机器人
description: 面向一台具体的6-PUS Stewart并联机构，记录从几何参数、坐标系和正逆运动学到工作空间验证的建模过程。
mathjax: true
---

## 摘要

本文面向一台采用竖直电动缸驱动的 6-PUS Stewart 并联机构，记录从 CAD 构型、参数化几何到运动学与工作空间分析的完整建模过程。机构由六条 P-U-S 支链构成：P 副沿固定坐标系 Z 轴运动，U 副连接定长连杆，S 副连接动平台。首先依据实际机构参数建立两平台铰点坐标与 ZYX 欧拉角位姿描述；随后以闭环矢量约束导出解析逆运动学，并以 Newton-Raphson 迭代求解正运动学。在 MATLAB 中，通过“目标位姿—逆解—正解—误差回代”验证计算一致性。最后，分别计算闭环几何与 P 副行程约束下的可达空间，以及进一步加入 U/S 关节安全摆角后的工程工作空间。该模型为后续样机搭建、参数标定、视觉测量与闭环控制研究提供统一基础。

## 1. 研究对象与问题定义

串联机器人通常沿单一运动链将关节变量映射到末端位姿：

$$
q \rightarrow X.
$$

对于 6-PUS Stewart 平台，六条支链同时闭环约束动平台，其位姿与驱动量满足隐式方程

$$
f(X,q)=0.
$$

因此，给定位姿求六个 P 副位移的逆运动学相对直接；而给定六个驱动量求动平台位姿的正运动学则是非线性方程组求解问题。本文不泛泛介绍 Stewart 平台，而是围绕当前样机的真实几何、驱动方式和关节约束建立可复用计算模型。

## 2. 6-PUS 机构与几何参数

单条支链的拓扑为：

```text
固定平台 → P副（竖直主动滑块）→ U副 → 定长连杆 → S副 → 动平台
```

动平台具有三平移与三转动自由度，驱动输入为

$$
q=[q_1,q_2,q_3,q_4,q_5,q_6]^T.
$$

| 参数 | 符号 | 数值 |
| --- | --- | --- |
| 基座铰点分布圆半径 | $c$ | 40 mm |
| 动平台铰点分布圆半径 | $d$ | 27.5 mm |
| U 副中心至 S 副中心距离 | $e$ | 84 mm |
| 基座每对内夹角 | $\lambda$ | 30° |
| 动平台每对内夹角 | $\mu$ | 60° |
| P 副行程 | $q_i$ | 25–75 mm |

零姿态下，机构的水平投影距离为 15.2057 mm，对应动平台标称高度为 132.6123 mm。六条支链按照 $a_i\leftrightarrow b_i$ 一一连接；基座与动平台铰点对的编号方式不同，但不改变代码中的支链对应关系。

![图1：6-PUS 样机的外观与内部驱动布局](/images/4-stewart-1/1机构图/1-机构外观与内部驱动对比.png)

*图1：左图为装配护筒后的整体构型，右图为移除护筒后暴露六个驱动单元的内部布局。两种视图共同说明了机构的紧凑封装方式与 P-U-S 支链配置。*

*Figure 1. Overall CAD renders of the 6-PUS mechanism: enclosed configuration (left) and exposed actuator layout (right).*

## 3. 坐标系与位姿描述

固定坐标系记为 $O-XYZ$，原点位于基座圆心，$Z$ 轴垂直基座向上。动坐标系记为 $O'-X'Y'Z'$，原点位于动平台圆心。动平台参考点位置为

$$
P=[x,y,z]^T.
$$

姿态采用 ZYX 欧拉角，旋转矩阵定义为

$$
R=R_z(\gamma)R_y(\beta)R_x(\alpha).
$$

这一定义在所有运动学与工作空间程序中保持一致；角度计算单位为弧度。动平台局部铰点 $b_i$ 转换到固定坐标系后为

$$
B_i=P+Rb_i.
$$

为便于将 PDF 中的机构表示与当前 MATLAB 模型对应起来，本文将 P 副零面上的投影点记为 $O_i$，滑块上端 U 副中心记为 $U_i$，动平台球铰中心记为 $B_i$。其中 $O_i$ 与 $U_i$ 具有相同的 $X,Y$ 坐标，P 副位移只改变 $U_i$ 的 Z 坐标；这正是竖直 6-PUS 支链能够采用闭环长度方程求逆解的原因。

对应的 ZYX 旋转矩阵为

$$
R=\left[\begin{array}{ccc}
c_\gamma c_\beta & c_\gamma s_\beta s_\alpha-s_\gamma c_\alpha & c_\gamma s_\beta c_\alpha+s_\gamma s_\alpha\\\\
s_\gamma c_\beta & s_\gamma s_\beta s_\alpha+c_\gamma c_\alpha & s_\gamma s_\beta c_\alpha-c_\gamma s_\alpha\\\\
-s_\beta & c_\beta s_\alpha & c_\beta c_\alpha
\end{array}\right],
$$

其中 $c_{(\cdot)}$ 与 $s_{(\cdot)}$ 分别表示余弦与正弦。该表达式与 `inver.m`、`forward_kinematics.m` 中的实现完全一致。

![图2：6-PUS 机构简图与坐标系定义](/images/4-stewart-1/1机构图/2-机构简图.png)

*图2：机构简图。$O_i$ 为 P 副零面上的投影点，$A_i$ 为 U 副中心，$B_i$ 为动平台 S 副中心；图中同时给出了固定坐标系与动坐标系。*

*Figure 2. Kinematic schematic of the mechanism, showing the fixed and moving coordinate frames and the joint-point notation.*

## 4. 逆运动学：由位姿到六个驱动量

运动学分析以 MATLAB 工程为载体组织。逆解、正解和两套工作空间计算共用同一参数定义，因此将代码结构置于本节开头，以便公式、实现和验证结果能够对应追溯。

```text
6PUS
├── Kinematics
│   ├── params.m
│   ├── inver.m
│   ├── forward_kinematics.m
│   └── test.m
├── workspace
│   ├── monte_carlo_workspace.m
│   └── compute_workspace_grid.m
└── workspace_joint_constrained
    ├── monte_carlo_workspace_joint_constrained.m
    └── compute_workspace_grid_joint_constrained.m
```

第 $i$ 条支链中，基座端 U 副中心为

$$
U_i=[a_{ix},a_{iy},q_i]^T.
$$

连杆长度恒为 $e$，故闭环约束为

$$
\|B_i-U_i\|=e.
$$

展开后得到

$$
(B_{ix}-a_{ix})^2+(B_{iy}-a_{iy})^2+(B_{iz}-q_i)^2=e^2.
$$

选择与当前竖直滑块物理构型一致的根，可得

$$
q_i=B_{iz}-\sqrt{e^2-(B_{ix}-a_{ix})^2-(B_{iy}-a_{iy})^2}.
$$

计算时还需检查根号项非负；若需要获得可执行驱动命令，则额外要求 $25\leq q_i\leq75\ \mathrm{mm}$。该方程由 `Kinematics/inver.m` 实现。

![图3：标称与耦合位姿下的机构运动学构型](/images/4-stewart-1/2运动学/01_机构运动学构型.png)

*图3：左图为标称位姿，右图为平移与转动耦合位姿。六条支链的伸缩量随动平台位姿同时变化。*

*Figure 3. Kinematic configurations at the nominal pose (left) and a coupled translational-rotational pose (right).*

![图4：连续位姿轨迹的逆运动学驱动结果](/images/4-stewart-1/2运动学/02_逆运动学驱动位移.png)

*图4：连续目标轨迹对应的六个 P 副位移。整个轨迹中的驱动量位于 25–75 mm 行程范围内。*

*Figure 4. Inverse-kinematic prismatic-joint displacements along the prescribed continuous trajectory.*

## 5. 正运动学：由驱动量恢复平台位姿

正运动学以六个驱动量为输入，求解

$$
X=[x,y,z,\alpha,\beta,\gamma]^T.
$$

程序将每条支链的闭环方程组织为残差向量 $F(X)$，并在标称位姿附近以 Newton-Raphson 方法迭代：

$$
J(X_k)\Delta X=-F(X_k),\qquad X_{k+1}=X_k+\Delta X.
$$

其中 Jacobian 由有限差分数值计算，默认初值为 $[0,0,z_{\mathrm{nom}},0,0,0]^T$，收敛容差可设置为 $10^{-7}$。该策略避免了对复杂空间闭环方程强行构造解析正解，也便于将来替换为解析 Jacobian 或加入阻尼项。

## 6. 正逆运动学往返验证

验证采用以下闭环流程：

```text
目标平台位姿 → 逆运动学 → 六个 P 副驱动量 → 正运动学 → 位姿与驱动量误差比较
```

`Kinematics/test.m` 覆盖标称位姿、平移与旋转耦合、纯平移、纯旋转、大范围运动，以及 P 副上下行程边界等测试。每组测试将正解结果再次代入逆解，分别检查位置误差、姿态误差和驱动量误差，从而验证模型内部的一致性。

![图5：正运动学对设定位姿的重构](/images/4-stewart-1/2运动学/03_正运动学位姿重构.png)

*图5：由逆解驱动量经 Newton-Raphson 正解恢复的六维位姿，与设定轨迹在图中重合。*

*Figure 5. Forward-kinematic reconstruction of the prescribed six-degree-of-freedom pose trajectory.*

![图6：正逆运动学闭环误差](/images/4-stewart-1/2运动学/04_正逆运动学闭环误差.png)

*图6：位置、姿态和驱动量的闭环误差均处于数值计算精度量级，说明正逆解模型在该测试轨迹上自洽。*

*Figure 6. Closed-loop errors of the inverse-forward kinematic validation on a logarithmic scale.*

![图7：六条支链的独立几何约束残差](/images/4-stewart-1/2运动学/05_连杆长度约束残差.png)

*图7：各支链的最大绝对残差约为 $10^{-14}\ \mathrm{mm}$，进一步验证了 $|B_i-U_i|=e$ 的闭环长度约束。*

*Figure 7. Independent residual verification of the fixed-length constraint for all six links.*

![图8：正逆运动学往返验证测试](/images/4-stewart-1/2运动学/07运动学正逆解验证.png)

*图8：六组代表性位姿的“给定位姿 → 逆解求 $q$ → 正解恢复位姿 → 比较误差”往返验证，覆盖标称、耦合、纯平移、纯旋转、大范围运动和 P 副行程边界工况。*

*Figure 8. Inverse-forward kinematic round-trip validation for six representative poses, including nominal, coupled, translational, rotational, large-motion, and actuator-stroke-limit cases.*

## 7. 工作空间：两层约束口径

工作空间不应只被描述为一个单一体积。对于当前样机，本文采用两层逐步收紧的定义。

### 7.1 闭环几何与 P 副行程工作空间

第一层工作空间保留机构的基本物理边界：连杆闭环方程必须存在实数解，且六个 P 副必须位于实际行程 $[25,75]\ \mathrm{mm}$ 内。这里的“无约束”特指**不额外施加 U/S 被动关节摆角和结构干涉约束**，并不意味着取消驱动器本身的有限行程。

判据为

$$
e^2-(B_{ix}-a_{ix})^2-(B_{iy}-a_{iy})^2\geq0,
$$

并同时满足

$$
q_{min}\leq q_i\leq q_{max}.
$$

计算采用蒙特卡洛采样与网格搜索两种方式；网格程序还会比较零姿态固定时的截面工作空间与允许搜索姿态后的可达工作空间。图9给出了标称高度 $z=132.61\ \mathrm{mm}$、零姿态下的 X-Y 截面：色阶表示距不可达边界的最小剩余行程，中心区域的驱动裕量较大，接近边界时裕量逐步减小。

![图9：标称高度零姿态下的 X-Y 可达工作空间截面](/images/4-stewart-1/2运动学/06_xy工作空间截面.png)

*图9：闭环几何与 P 副行程约束下的 X-Y 工作空间截面，星号表示标称中心位姿。*

*Figure 9. X-Y reachable-workspace section at the nominal height and zero orientation; color indicates the minimum remaining actuator stroke.*

![图10：三种行程高度下的无 U/S 关节约束 XOY 工作空间](/images/4-stewart-1/3工作空间/1-4三行程叠加对比.png)

*图10：仅考虑闭环几何与 P 副行程时，在下限、中位和近上限高度的 XOY 截面叠加。平台高度升高后，横向可达范围明显收缩。*

*Figure 10. Superposed XOY workspace sections at three actuator-stroke levels under geometric and prismatic-stroke constraints.*

![图11：几何与 P 副行程约束下的三维工作空间](/images/4-stewart-1/3工作空间/1-10工作空间三维体积.png)

*图11：网格搜索得到的三维工作空间；图中同时给出了固定零姿态截面与经过姿态搜索后的可达区域。*

*Figure 11. Three-dimensional workspace obtained by grid search under geometric and prismatic-stroke constraints.*

### 7.2 P/U/S 关节约束工作空间

第二层在上一层基础上加入真实关节安全范围：U 副厂家允许总动作角为 30°，计算中预留 3°安全裕量，采用 27°；S 副同样采用 27°安全摆角。支链方向与基座 Z 轴、动平台法向之间的夹角分别用于判断 U 副和 S 副约束。

![图12：三种行程高度下含 P/U/S 关节约束的 XOY 工作空间](/images/4-stewart-1/3工作空间/2-4三行程叠加对比.png)

*图12：加入 U/S 副 27°安全摆角后，三种高度的横向可达范围均显著收缩。*

*Figure 12. Superposed XOY workspace sections at three actuator-stroke levels with P/U/S joint safety constraints.*

![图13：含 P/U/S 关节安全约束的三维工作空间](/images/4-stewart-1/3工作空间/2-10工作空间三维体积.png)

*图13：关节约束后的三维可达工作空间。计算结果显示可达体积为 80040 mm³，固定零姿态工作空间体积为 79704 mm³。*

*Figure 13. Three-dimensional reachable workspace with P/U/S joint safety constraints.*

### 7.3 对比与工程含义

两类空间的差别体现了“几何上存在解”与“样机能够安全工作”之间的距离。P 副行程首先限制平台的高度范围；U/S 副摆角进一步削减大横移、大倾角和靠近边界的姿态。图14与图15的垂直截面尤其直观：加入关节摆角限制后，横向范围由约 $\pm60\ \mathrm{mm}$ 缩小至约 $\pm25\ \mathrm{mm}$。当前模型尚未包含连杆、平台、紧固件和电动缸之间的碰撞检测，因此结果应被视为关节运动范围约束下的工程可达空间，而不是最终的无碰撞工作空间。

| 工作空间 | 已考虑因素 | 用途 |
| --- | --- | --- |
| 闭环几何与 P 副行程 | 连杆长度、几何实解、P 副 25–75 mm 行程 | 描述驱动器可执行的基础可达范围 |
| P/U/S 关节约束 | 上述因素 + U/S 副 27°安全摆角 | 描述更接近样机安全使用条件的范围 |

![图14：无 U/S 关节约束的工作空间竖直截面](/images/4-stewart-1/3工作空间/1-11工作空间竖直截面.png)

*图14：仅受闭环几何和 P 副行程限制时的 XOZ、YOZ 截面。*

*Figure 14. XOZ and YOZ vertical sections under geometric and prismatic-stroke constraints.*

![图15：含 P/U/S 关节约束的工作空间竖直截面](/images/4-stewart-1/3工作空间/2-11工作空间竖直截面.png)

*图15：加入 U/S 关节摆角安全限制后的 XOZ、YOZ 截面。*

*Figure 15. XOZ and YOZ vertical sections with P/U/S joint safety constraints.*

## 8. 总结与后续工作

本文针对具体 6-PUS 样机完成了机构参数归档、坐标系建立、闭环矢量建模、解析逆运动学、数值正运动学、往返验证与两层工作空间分析。模型的价值不止于给出一组公式：它统一了 CAD 几何、驱动坐标、MATLAB 程序和后续实验的位姿描述。

后续工作将在这一基础上进入实验系统搭建、几何参数标定、视觉/IMU 测量、运动控制以及奇异性、碰撞与刚度等性能约束分析。

## 附录：工作空间完整结果集

为保留计算过程的完整性，下列图组给出两套约束口径下的全部高度切片、面积变化和三维结果。图10–15用于正文比较；本附录补充其余结果，便于后续复核参数、扫描步长和边界变化。

### A. 闭环几何与 P 副行程约束

![A1：下限行程 XOY 截面](/images/4-stewart-1/3工作空间/1-1XOY下限行程.png)

*图A1：下限行程下的 XOY 工作空间截面。*

*Figure A1. XOY workspace section at the lower actuator-stroke level.*

![A2：中位行程 XOY 截面](/images/4-stewart-1/3工作空间/1-2XOY居中行程.png)

*图A2：中位行程下的 XOY 工作空间截面。*

*Figure A2. XOY workspace section at the mid-stroke level.*

![A3：近上限行程 XOY 截面](/images/4-stewart-1/3工作空间/1-3XOY近上限行程.png)

*图A3：近上限行程下的 XOY 工作空间截面。*

*Figure A3. XOY workspace section near the upper actuator-stroke level.*

![A4：蒙特卡洛三维工作空间](/images/4-stewart-1/3工作空间/1-5工作空间3D.png)

*图A4：蒙特卡洛采样得到的三维工作空间。*

*Figure A4. Three-dimensional workspace estimated by Monte Carlo sampling.*

![A5：蒙特卡洛截面积随高度变化](/images/4-stewart-1/3工作空间/1-6XOY截面积随Z高度变化.png)

*图A5：蒙特卡洛采样下 XOY 截面积随平台高度的变化。*

*Figure A5. XOY cross-sectional area as a function of platform height from Monte Carlo sampling.*

![A6：网格分层 XOY 截面](/images/4-stewart-1/3工作空间/1-7XOY平面分层界面（14个Z层）.png)

*图A6：网格搜索结果的分层 XOY 工作空间截面。*

*Figure A6. Layered XOY workspace sections from the grid-search result.*

![A7：网格截面积随高度变化](/images/4-stewart-1/3工作空间/1-8工作空间截面积随高度变化.png)

*图A7：网格搜索下 XOY 截面积随平台高度的变化。*

*Figure A7. XOY cross-sectional area as a function of platform height from grid search.*

![A8：不同高度的网格 XOY 截面](/images/4-stewart-1/3工作空间/1-9工作空间不同高度XOY截面.png)

*图A8：不同平台高度下的网格搜索 XOY 工作空间截面。*

*Figure A8. Grid-search XOY workspace sections at selected platform heights.*

### B. 含 P/U/S 关节安全约束

![B1：下限行程 XOY 截面](/images/4-stewart-1/3工作空间/2-1XOY下限行程.png)

*图B1：含 P/U/S 关节安全约束时，下限行程下的 XOY 工作空间截面。*

*Figure B1. XOY workspace section at the lower actuator-stroke level with P/U/S joint safety constraints.*

![B2：中位行程 XOY 截面](/images/4-stewart-1/3工作空间/2-2XOY居中行程.png)

*图B2：含 P/U/S 关节安全约束时，中位行程下的 XOY 工作空间截面。*

*Figure B2. XOY workspace section at the mid-stroke level with P/U/S joint safety constraints.*

![B3：近上限行程 XOY 截面](/images/4-stewart-1/3工作空间/2-3XOY近上限行程.png)

*图B3：含 P/U/S 关节安全约束时，近上限行程下的 XOY 工作空间截面。*

*Figure B3. XOY workspace section near the upper actuator-stroke level with P/U/S joint safety constraints.*

![B4：蒙特卡洛三维工作空间](/images/4-stewart-1/3工作空间/2-5工作空间3D.png)

*图B4：含 P/U/S 关节安全约束时，蒙特卡洛采样得到的三维工作空间。*

*Figure B4. Three-dimensional workspace estimated by Monte Carlo sampling with P/U/S joint safety constraints.*

![B5：蒙特卡洛截面积随高度变化](/images/4-stewart-1/3工作空间/2-6XOY截面积随Z高度变化.png)

*图B5：含 P/U/S 关节安全约束时，XOY 截面积随平台高度的变化。*

*Figure B5. XOY cross-sectional area as a function of platform height with P/U/S joint safety constraints.*

![B6：网格分层 XOY 截面](/images/4-stewart-1/3工作空间/2-7XOY平面分层界面（14个Z层）.png)

*图B6：含 P/U/S 关节安全约束时，网格搜索结果的分层 XOY 工作空间截面。*

*Figure B6. Layered XOY workspace sections from grid search with P/U/S joint safety constraints.*

![B7：网格截面积随高度变化](/images/4-stewart-1/3工作空间/2-8工作空间截面积随高度变化.png)

*图B7：含 P/U/S 关节安全约束时，网格搜索下 XOY 截面积随平台高度的变化。*

*Figure B7. XOY cross-sectional area as a function of platform height from grid search with P/U/S joint safety constraints.*

![B8：不同高度的网格 XOY 截面](/images/4-stewart-1/3工作空间/2-9工作空间不同高度XOY截面.png)

*图B8：含 P/U/S 关节安全约束时，不同平台高度下的网格搜索 XOY 工作空间截面。*

*Figure B8. Grid-search XOY workspace sections at selected platform heights with P/U/S joint safety constraints.*
