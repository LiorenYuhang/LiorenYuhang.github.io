export default [
  {
    "id": "604b890b21-000",
    "document_id": "604b890b21",
    "title": "6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析",
    "url": "/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/",
    "section": "摘要",
    "content": "本文面向一台采用竖直电动缸驱动的 6-PUS Stewart 并联机构，记录从 CAD 构型、参数化几何到运动学与工作空间分析的完整建模过程。机构由六条 P-U-S 支链构成：P 副沿固定坐标系 Z 轴运动，U 副连接定长连杆，S 副连接动平台。首先依据实际机构参数建立两平台铰点坐标与 ZYX 欧拉角位姿描述；随后以闭环矢量约束导出解析逆运动学，并以 Newton-Raphson 迭代求解正运动学。在 MATLAB 中，通过“目标位姿—逆解—正解—误差回代”验证计算一致性。最后，分别计算闭环几何与 P 副行程约束下的可达空间，以及进一步加入 U/S 关节安全摆角后的工程工作空间。该模型为后续样机搭建、参数标定、视觉测量与闭环控制研究提供统一基础。",
    "content_type": "paragraph",
    "tags": [
      "Stewart平台",
      "并联机器人",
      "6-PUS",
      "MATLAB",
      "运动学",
      "工作空间"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-08-05",
    "content_hash": "863baf6b74801eba",
    "links": []
  },
  {
    "id": "604b890b21-001",
    "document_id": "604b890b21",
    "title": "6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析",
    "url": "/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/",
    "section": "1. 研究对象与问题定义",
    "content": "串联机器人通常沿单一运动链将关节变量映射到末端位姿：\n\n$$\nq \\rightarrow X.\n$$\n\n对于 6-PUS Stewart 平台，六条支链同时闭环约束动平台，其位姿与驱动量满足隐式方程\n\n$$\nf(X,q)=0.\n$$\n\n因此，给定位姿求六个 P 副位移的逆运动学相对直接；而给定六个驱动量求动平台位姿的正运动学则是非线性方程组求解问题。本文不泛泛介绍 Stewart 平台，而是围绕当前样机的真实几何、驱动方式和关节约束建立可复用计算模型。",
    "content_type": "paragraph",
    "tags": [
      "Stewart平台",
      "并联机器人",
      "6-PUS",
      "MATLAB",
      "运动学",
      "工作空间"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-08-05",
    "content_hash": "863baf6b74801eba",
    "links": []
  },
  {
    "id": "604b890b21-002",
    "document_id": "604b890b21",
    "title": "6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析",
    "url": "/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/",
    "section": "2. 6-PUS 机构与几何参数",
    "content": "固定平台 → P副（竖直主动滑块）→ U副 → 定长连杆 → S副 → 动平台",
    "content_type": "code",
    "tags": [
      "Stewart平台",
      "并联机器人",
      "6-PUS",
      "MATLAB",
      "运动学",
      "工作空间"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-08-05",
    "content_hash": "863baf6b74801eba",
    "links": []
  },
  {
    "id": "604b890b21-003",
    "document_id": "604b890b21",
    "title": "6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析",
    "url": "/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/",
    "section": "2. 6-PUS 机构与几何参数",
    "content": "动平台具有三平移与三转动自由度，驱动输入为\n\n$$\nq=[q1,q2,q3,q4,q5,q6]^T.\n$$\n\n| 参数 | 符号 | 数值 |\n| --- | --- | --- |\n| 基座铰点分布圆半径 | $c$ | 40 mm |\n| 动平台铰点分布圆半径 | $d$ | 27.5 mm |\n| U 副中心至 S 副中心距离 | $e$ | 84 mm |\n| 基座每对内夹角 | $\\lambda$ | 30° |\n| 动平台每对内夹角 | $\\mu$ | 60° |\n| P 副行程 | $qi$ | 25–75 mm |\n\n零姿态下，机构的水平投影距离为 15.2057 mm，对应动平台标称高度为 132.6123 mm。六条支链按照 $ai\\leftrightarrow b_i$ 一一连接；基座与动平台铰点对的编号方式不同，但不改变代码中的支链对应关系。\n\n[图：图1：6-PUS 样机的外观与内部驱动布局]\n\n图1：左图为装配护筒后的整体构型，右图为移除护筒后暴露六个驱动单元的内部布局。两种视图共同说明了机构的紧凑封装方式与 P-U-S 支链配置。\n\nFigure 1. Overall CAD renders of the 6-PUS mechanism: enclosed configuration (left) and exposed actuator layout (right).",
    "content_type": "paragraph",
    "tags": [
      "Stewart平台",
      "并联机器人",
      "6-PUS",
      "MATLAB",
      "运动学",
      "工作空间"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-08-05",
    "content_hash": "863baf6b74801eba",
    "links": []
  },
  {
    "id": "604b890b21-004",
    "document_id": "604b890b21",
    "title": "6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析",
    "url": "/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/",
    "section": "3. 坐标系与位姿描述",
    "content": "固定坐标系记为 $O-XYZ$，原点位于基座圆心，$Z$ 轴垂直基座向上。动坐标系记为 $O'-X'Y'Z'$，原点位于动平台圆心。动平台参考点位置为\n\n$$\nP=[x,y,z]^T.\n$$\n\n姿态采用 ZYX 欧拉角，旋转矩阵定义为\n\n$$\nR=Rz(\\gamma)Ry(\\beta)Rx(\\alpha).\n$$\n\n这一定义在所有运动学与工作空间程序中保持一致；角度计算单位为弧度。动平台局部铰点 $bi$ 转换到固定坐标系后为\n\n$$\nBi=P+Rbi.\n$$\n\n为便于将 PDF 中的机构表示与当前 MATLAB 模型对应起来，本文将 P 副零面上的投影点记为 $Oi$，滑块上端 U 副中心记为 $Ui$，动平台球铰中心记为 $Bi$。其中 $Oi$ 与 $Ui$ 具有相同的 $X,Y$ 坐标，P 副位移只改变 $Ui$ 的 Z 坐标；这正是竖直 6-PUS 支链能够采用闭环长度方程求逆解的原因。\n\n对应的 ZYX 旋转矩阵为\n\n$$\nR=\\left[\\begin{array}{ccc}\nc\\gamma c\\beta & c\\gamma s\\beta s\\alpha-s\\gamma c\\alpha & c\\gamma s\\beta c\\alpha+s\\gamma s\\alpha\\\\\\\\\ns\\gamma c\\beta & s\\gamma s\\beta s\\alpha+c\\gamma c\\alpha & s\\gamma s\\beta c\\alpha-c\\gamma s\\alpha\\\\\\\\\n-s\\beta & c\\beta s\\alpha & c\\beta c\\alpha\n\\end{array}\\right],\n$$\n\n其中 $c{(\\cdot)}$ 与 $s{(\\cdot)}$ 分别表示余弦与正弦。该表达式与 inver.m、forwardkinematics.m 中的实现完全一致。\n\n[图：图2：6-PUS 机构简图与坐标系定义]\n\n图2：机构简图。$Oi$ 为 P 副零面上的投影点，$Ai$ 为 U 副中心，$B_i$ 为动平台 S 副中心；图中同时给出了固定坐标系与动坐标系。\n\nFigure 2. Kinematic schematic of the mechanism, showing the fixed and moving coordinate frames and the joint-point notation.",
    "content_type": "paragraph",
    "tags": [
      "Stewart平台",
      "并联机器人",
      "6-PUS",
      "MATLAB",
      "运动学",
      "工作空间"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-08-05",
    "content_hash": "863baf6b74801eba",
    "links": []
  },
  {
    "id": "604b890b21-005",
    "document_id": "604b890b21",
    "title": "6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析",
    "url": "/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/",
    "section": "4. 逆运动学：由位姿到六个驱动量",
    "content": "运动学分析以 MATLAB 工程为载体组织。逆解、正解和两套工作空间计算共用同一参数定义，因此将代码结构置于本节开头，以便公式、实现和验证结果能够对应追溯。",
    "content_type": "paragraph",
    "tags": [
      "Stewart平台",
      "并联机器人",
      "6-PUS",
      "MATLAB",
      "运动学",
      "工作空间"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-08-05",
    "content_hash": "863baf6b74801eba",
    "links": []
  },
  {
    "id": "604b890b21-006",
    "document_id": "604b890b21",
    "title": "6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析",
    "url": "/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/",
    "section": "4. 逆运动学：由位姿到六个驱动量",
    "content": "6PUS\n├── Kinematics\n│   ├── params.m\n│   ├── inver.m\n│   ├── forward_kinematics.m\n│   └── test.m\n├── workspace\n│   ├── monte_carlo_workspace.m\n│   └── compute_workspace_grid.m\n└── workspace_joint_constrained\n    ├── monte_carlo_workspace_joint_constrained.m\n    └── compute_workspace_grid_joint_constrained.m",
    "content_type": "code",
    "tags": [
      "Stewart平台",
      "并联机器人",
      "6-PUS",
      "MATLAB",
      "运动学",
      "工作空间"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-08-05",
    "content_hash": "863baf6b74801eba",
    "links": []
  },
  {
    "id": "604b890b21-007",
    "document_id": "604b890b21",
    "title": "6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析",
    "url": "/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/",
    "section": "4. 逆运动学：由位姿到六个驱动量",
    "content": "第 $i$ 条支链中，基座端 U 副中心为\n\n$$\nUi=[a{ix},a{iy},qi]^T.\n$$\n\n连杆长度恒为 $e$，故闭环约束为\n\n$$\n\\|Bi-Ui\\|=e.\n$$\n\n展开后得到\n\n$$\n(B{ix}-a{ix})^2+(B{iy}-a{iy})^2+(B{iz}-qi)^2=e^2.\n$$\n\n选择与当前竖直滑块物理构型一致的根，可得\n\n$$\nqi=B{iz}-\\sqrt{e^2-(B{ix}-a{ix})^2-(B{iy}-a{iy})^2}.\n$$\n\n计算时还需检查根号项非负；若需要获得可执行驱动命令，则额外要求 $25\\leq q_i\\leq75\\ \\mathrm{mm}$。该方程由 Kinematics/inver.m 实现。\n\n[图：图3：标称与耦合位姿下的机构运动学构型]\n\n图3：左图为标称位姿，右图为平移与转动耦合位姿。六条支链的伸缩量随动平台位姿同时变化。\n\nFigure 3. Kinematic configurations at the nominal pose (left) and a coupled translational-rotational pose (right).\n\n[图：图4：连续位姿轨迹的逆运动学驱动结果]\n\n图4：连续目标轨迹对应的六个 P 副位移。整个轨迹中的驱动量位于 25–75 mm 行程范围内。\n\nFigure 4. Inverse-kinematic prismatic-joint displacements along the prescribed continuous trajectory.",
    "content_type": "paragraph",
    "tags": [
      "Stewart平台",
      "并联机器人",
      "6-PUS",
      "MATLAB",
      "运动学",
      "工作空间"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-08-05",
    "content_hash": "863baf6b74801eba",
    "links": []
  },
  {
    "id": "604b890b21-008",
    "document_id": "604b890b21",
    "title": "6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析",
    "url": "/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/",
    "section": "5. 正运动学：由驱动量恢复平台位姿",
    "content": "正运动学以六个驱动量为输入，求解\n\n$$\nX=[x,y,z,\\alpha,\\beta,\\gamma]^T.\n$$\n\n程序将每条支链的闭环方程组织为残差向量 $F(X)$，并在标称位姿附近以 Newton-Raphson 方法迭代：\n\n$$\nJ(Xk)\\Delta X=-F(Xk),\\qquad X{k+1}=Xk+\\Delta X.\n$$\n\n其中 Jacobian 由有限差分数值计算，默认初值为 $[0,0,z_{\\mathrm{nom}},0,0,0]^T$，收敛容差可设置为 $10^{-7}$。该策略避免了对复杂空间闭环方程强行构造解析正解，也便于将来替换为解析 Jacobian 或加入阻尼项。",
    "content_type": "paragraph",
    "tags": [
      "Stewart平台",
      "并联机器人",
      "6-PUS",
      "MATLAB",
      "运动学",
      "工作空间"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-08-05",
    "content_hash": "863baf6b74801eba",
    "links": []
  },
  {
    "id": "604b890b21-009",
    "document_id": "604b890b21",
    "title": "6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析",
    "url": "/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/",
    "section": "6. 正逆运动学往返验证",
    "content": "目标平台位姿 → 逆运动学 → 六个 P 副驱动量 → 正运动学 → 位姿与驱动量误差比较",
    "content_type": "code",
    "tags": [
      "Stewart平台",
      "并联机器人",
      "6-PUS",
      "MATLAB",
      "运动学",
      "工作空间"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-08-05",
    "content_hash": "863baf6b74801eba",
    "links": []
  },
  {
    "id": "604b890b21-010",
    "document_id": "604b890b21",
    "title": "6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析",
    "url": "/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/",
    "section": "6. 正逆运动学往返验证",
    "content": "Kinematics/test.m 覆盖标称位姿、平移与旋转耦合、纯平移、纯旋转、大范围运动，以及 P 副上下行程边界等测试。每组测试将正解结果再次代入逆解，分别检查位置误差、姿态误差和驱动量误差，从而验证模型内部的一致性。\n\n[图：图5：正运动学对设定位姿的重构]\n\n图5：由逆解驱动量经 Newton-Raphson 正解恢复的六维位姿，与设定轨迹在图中重合。\n\nFigure 5. Forward-kinematic reconstruction of the prescribed six-degree-of-freedom pose trajectory.\n\n[图：图6：正逆运动学闭环误差]\n\n图6：位置、姿态和驱动量的闭环误差均处于数值计算精度量级，说明正逆解模型在该测试轨迹上自洽。\n\nFigure 6. Closed-loop errors of the inverse-forward kinematic validation on a logarithmic scale.\n\n[图：图7：六条支链的独立几何约束残差]\n\n图7：各支链的最大绝对残差约为 $10^{-14}\\ \\mathrm{mm}$，进一步验证了 $|Bi-Ui|=e$ 的闭环长度约束。\n\nFigure 7. Independent residual verification of the fixed-length constraint for all six links.\n\n[图：图8：正逆运动学往返验证测试]\n\n图8：六组代表性位姿的“给定位姿 → 逆解求 $q$ → 正解恢复位姿 → 比较误差”往返验证，覆盖标称、耦合、纯平移、纯旋转、大范围运动和 P 副行程边界工况。\n\nFigure 8. Inverse-forward kinematic round-trip validation for six representative poses, including nominal, coupled, translational, rotational, large-motion, and actuator-stroke-limit cases.",
    "content_type": "paragraph",
    "tags": [
      "Stewart平台",
      "并联机器人",
      "6-PUS",
      "MATLAB",
      "运动学",
      "工作空间"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-08-05",
    "content_hash": "863baf6b74801eba",
    "links": []
  },
  {
    "id": "604b890b21-011",
    "document_id": "604b890b21",
    "title": "6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析",
    "url": "/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/",
    "section": "7. 工作空间：两层约束口径",
    "content": "工作空间不应只被描述为一个单一体积。对于当前样机，本文采用两层逐步收紧的定义。",
    "content_type": "paragraph",
    "tags": [
      "Stewart平台",
      "并联机器人",
      "6-PUS",
      "MATLAB",
      "运动学",
      "工作空间"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-08-05",
    "content_hash": "863baf6b74801eba",
    "links": []
  },
  {
    "id": "604b890b21-012",
    "document_id": "604b890b21",
    "title": "6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析",
    "url": "/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/",
    "section": "7. 工作空间：两层约束口径 › 7.1 闭环几何与 P 副行程工作空间",
    "content": "第一层工作空间保留机构的基本物理边界：连杆闭环方程必须存在实数解，且六个 P 副必须位于实际行程 $[25,75]\\ \\mathrm{mm}$ 内。这里的“无约束”特指不额外施加 U/S 被动关节摆角和结构干涉约束，并不意味着取消驱动器本身的有限行程。\n\n判据为\n\n$$\ne^2-(B{ix}-a{ix})^2-(B{iy}-a{iy})^2\\geq0,\n$$\n\n并同时满足\n\n$$\nq{min}\\leq qi\\leq q_{max}.\n$$\n\n计算采用蒙特卡洛采样与网格搜索两种方式；网格程序还会比较零姿态固定时的截面工作空间与允许搜索姿态后的可达工作空间。图9给出了标称高度 $z=132.61\\ \\mathrm{mm}$、零姿态下的 X-Y 截面：色阶表示距不可达边界的最小剩余行程，中心区域的驱动裕量较大，接近边界时裕量逐步减小。\n\n[图：图9：标称高度零姿态下的 X-Y 可达工作空间截面]\n\n图9：闭环几何与 P 副行程约束下的 X-Y 工作空间截面，星号表示标称中心位姿。\n\nFigure 9. X-Y reachable-workspace section at the nominal height and zero orientation; color indicates the minimum remaining actuator stroke.\n\n[图：图10：三种行程高度下的无 U/S 关节约束 XOY 工作空间]\n\n图10：仅考虑闭环几何与 P 副行程时，在下限、中位和近上限高度的 XOY 截面叠加。平台高度升高后，横向可达范围明显收缩。\n\nFigure 10. Superposed XOY workspace sections at three actuator-stroke levels under geometric and prismatic-stroke constraints.\n\n[图：图11：几何与 P 副行程约束下的三维工作空间]\n\n图11：网格搜索得到的三维工作空间；图中同时给出了固定零姿态截面与经过姿态搜索后的可达区域。\n\nFigure 11. Three-dimensional workspace obtained by grid search under geometric and prismatic-stroke constraints.",
    "content_type": "paragraph",
    "tags": [
      "Stewart平台",
      "并联机器人",
      "6-PUS",
      "MATLAB",
      "运动学",
      "工作空间"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-08-05",
    "content_hash": "863baf6b74801eba",
    "links": []
  },
  {
    "id": "604b890b21-013",
    "document_id": "604b890b21",
    "title": "6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析",
    "url": "/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/",
    "section": "7. 工作空间：两层约束口径 › 7.2 P/U/S 关节约束工作空间",
    "content": "第二层在上一层基础上加入真实关节安全范围：U 副厂家允许总动作角为 30°，计算中预留 3°安全裕量，采用 27°；S 副同样采用 27°安全摆角。支链方向与基座 Z 轴、动平台法向之间的夹角分别用于判断 U 副和 S 副约束。\n\n[图：图12：三种行程高度下含 P/U/S 关节约束的 XOY 工作空间]\n\n图12：加入 U/S 副 27°安全摆角后，三种高度的横向可达范围均显著收缩。\n\nFigure 12. Superposed XOY workspace sections at three actuator-stroke levels with P/U/S joint safety constraints.\n\n[图：图13：含 P/U/S 关节安全约束的三维工作空间]\n\n图13：关节约束后的三维可达工作空间。计算结果显示可达体积为 80040 mm³，固定零姿态工作空间体积为 79704 mm³。\n\nFigure 13. Three-dimensional reachable workspace with P/U/S joint safety constraints.",
    "content_type": "paragraph",
    "tags": [
      "Stewart平台",
      "并联机器人",
      "6-PUS",
      "MATLAB",
      "运动学",
      "工作空间"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-08-05",
    "content_hash": "863baf6b74801eba",
    "links": []
  },
  {
    "id": "604b890b21-014",
    "document_id": "604b890b21",
    "title": "6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析",
    "url": "/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/",
    "section": "7. 工作空间：两层约束口径 › 7.3 对比与工程含义",
    "content": "两类空间的差别体现了“几何上存在解”与“样机能够安全工作”之间的距离。P 副行程首先限制平台的高度范围；U/S 副摆角进一步削减大横移、大倾角和靠近边界的姿态。图14与图15的垂直截面尤其直观：加入关节摆角限制后，横向范围由约 $\\pm60\\ \\mathrm{mm}$ 缩小至约 $\\pm25\\ \\mathrm{mm}$。当前模型尚未包含连杆、平台、紧固件和电动缸之间的碰撞检测，因此结果应被视为关节运动范围约束下的工程可达空间，而不是最终的无碰撞工作空间。\n\n| 工作空间 | 已考虑因素 | 用途 |\n| --- | --- | --- |\n| 闭环几何与 P 副行程 | 连杆长度、几何实解、P 副 25–75 mm 行程 | 描述驱动器可执行的基础可达范围 |\n| P/U/S 关节约束 | 上述因素 + U/S 副 27°安全摆角 | 描述更接近样机安全使用条件的范围 |\n\n[图：图14：无 U/S 关节约束的工作空间竖直截面]\n\n图14：仅受闭环几何和 P 副行程限制时的 XOZ、YOZ 截面。\n\nFigure 14. XOZ and YOZ vertical sections under geometric and prismatic-stroke constraints.\n\n[图：图15：含 P/U/S 关节约束的工作空间竖直截面]\n\n图15：加入 U/S 关节摆角安全限制后的 XOZ、YOZ 截面。\n\nFigure 15. XOZ and YOZ vertical sections with P/U/S joint safety constraints.",
    "content_type": "paragraph",
    "tags": [
      "Stewart平台",
      "并联机器人",
      "6-PUS",
      "MATLAB",
      "运动学",
      "工作空间"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-08-05",
    "content_hash": "863baf6b74801eba",
    "links": []
  },
  {
    "id": "604b890b21-015",
    "document_id": "604b890b21",
    "title": "6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析",
    "url": "/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/",
    "section": "8. 总结与后续工作",
    "content": "本文针对具体 6-PUS 样机完成了机构参数归档、坐标系建立、闭环矢量建模、解析逆运动学、数值正运动学、往返验证与两层工作空间分析。模型的价值不止于给出一组公式：它统一了 CAD 几何、驱动坐标、MATLAB 程序和后续实验的位姿描述。\n\n后续工作将在这一基础上进入实验系统搭建、几何参数标定、视觉/IMU 测量、运动控制以及奇异性、碰撞与刚度等性能约束分析。",
    "content_type": "paragraph",
    "tags": [
      "Stewart平台",
      "并联机器人",
      "6-PUS",
      "MATLAB",
      "运动学",
      "工作空间"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-08-05",
    "content_hash": "863baf6b74801eba",
    "links": []
  },
  {
    "id": "604b890b21-016",
    "document_id": "604b890b21",
    "title": "6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析",
    "url": "/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/",
    "section": "附录：工作空间完整结果集",
    "content": "为保留计算过程的完整性，下列图组给出两套约束口径下的全部高度切片、面积变化和三维结果。图10–15用于正文比较；本附录补充其余结果，便于后续复核参数、扫描步长和边界变化。",
    "content_type": "paragraph",
    "tags": [
      "Stewart平台",
      "并联机器人",
      "6-PUS",
      "MATLAB",
      "运动学",
      "工作空间"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-08-05",
    "content_hash": "863baf6b74801eba",
    "links": []
  },
  {
    "id": "604b890b21-017",
    "document_id": "604b890b21",
    "title": "6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析",
    "url": "/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/",
    "section": "附录：工作空间完整结果集 › A. 闭环几何与 P 副行程约束",
    "content": "[图：A1：下限行程 XOY 截面]\n\n图A1：下限行程下的 XOY 工作空间截面。\n\nFigure A1. XOY workspace section at the lower actuator-stroke level.\n\n[图：A2：中位行程 XOY 截面]\n\n图A2：中位行程下的 XOY 工作空间截面。\n\nFigure A2. XOY workspace section at the mid-stroke level.\n\n[图：A3：近上限行程 XOY 截面]\n\n图A3：近上限行程下的 XOY 工作空间截面。\n\nFigure A3. XOY workspace section near the upper actuator-stroke level.\n\n[图：A4：蒙特卡洛三维工作空间]\n\n图A4：蒙特卡洛采样得到的三维工作空间。\n\nFigure A4. Three-dimensional workspace estimated by Monte Carlo sampling.\n\n[图：A5：蒙特卡洛截面积随高度变化]\n\n图A5：蒙特卡洛采样下 XOY 截面积随平台高度的变化。\n\nFigure A5. XOY cross-sectional area as a function of platform height from Monte Carlo sampling.\n\n[图：A6：网格分层 XOY 截面]\n\n图A6：网格搜索结果的分层 XOY 工作空间截面。\n\nFigure A6. Layered XOY workspace sections from the grid-search result.\n\n[图：A7：网格截面积随高度变化]\n\n图A7：网格搜索下 XOY 截面积随平台高度的变化。\n\nFigure A7. XOY cross-sectional area as a function of platform height from grid search.\n\n[图：A8：不同高度的网格 XOY 截面]\n\n图A8：不同平台高度下的网格搜索 XOY 工作空间截面。\n\nFigure A8. Grid-search XOY workspace sections at selected platform heights.",
    "content_type": "paragraph",
    "tags": [
      "Stewart平台",
      "并联机器人",
      "6-PUS",
      "MATLAB",
      "运动学",
      "工作空间"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-08-05",
    "content_hash": "863baf6b74801eba",
    "links": []
  },
  {
    "id": "604b890b21-018",
    "document_id": "604b890b21",
    "title": "6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析",
    "url": "/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/",
    "section": "附录：工作空间完整结果集 › B. 含 P/U/S 关节安全约束",
    "content": "[图：B1：下限行程 XOY 截面]\n\n图B1：含 P/U/S 关节安全约束时，下限行程下的 XOY 工作空间截面。 Figure B1. XOY workspace section at the lower actuator-stroke level with P/U/S joint safety constraints. [图：B2：中位行程 XOY 截面]\n\n图B2：含 P/U/S 关节安全约束时，中位行程下的 XOY 工作空间截面。 Figure B2. XOY workspace section at the mid-stroke level with P/U/S joint safety constraints. [图：B3：近上限行程 XOY 截面]\n\n图B3：含 P/U/S 关节安全约束时，近上限行程下的 XOY 工作空间截面。 Figure B3. XOY workspace section near the upper actuator-stroke level with P/U/S joint safety constraints. [图：B4：蒙特卡洛三维工作空间]\n\n图B4：含 P/U/S 关节安全约束时，蒙特卡洛采样得到的三维工作空间。 Figure B4. Three-dimensional workspace estimated by Monte Carlo sampling with P/U/S joint safety constraints. [图：B5：蒙特卡洛截面积随高度变化]\n\n图B5：含 P/U/S 关节安全约束时，XOY 截面积随平台高度的变化。 Figure B5. XOY cross-sectional area as a function of platform height with P/U/S joint safety constraints. [图：B6：网格分层 XOY 截面]\n\n图B6：含 P/U/S 关节安全约束时，网格搜索结果的分层 XOY 工作空间截面。 Figure B6. Layered XOY workspace sections from grid search with P/U/S joint safety constraints.",
    "content_type": "paragraph",
    "tags": [
      "Stewart平台",
      "并联机器人",
      "6-PUS",
      "MATLAB",
      "运动学",
      "工作空间"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-08-05",
    "content_hash": "863baf6b74801eba",
    "links": []
  },
  {
    "id": "604b890b21-019",
    "document_id": "604b890b21",
    "title": "6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析",
    "url": "/2026/08/05/6-PUS Stewart并联机构研究（一）：从SolidWorks三维模型到运动学建模与工作空间分析/",
    "section": "附录：工作空间完整结果集 › B. 含 P/U/S 关节安全约束",
    "content": "[图：B7：网格截面积随高度变化]\n\n图B7：含 P/U/S 关节安全约束时，网格搜索下 XOY 截面积随平台高度的变化。 Figure B7. XOY cross-sectional area as a function of platform height from grid search with P/U/S joint safety constraints. [图：B8：不同高度的网格 XOY 截面]\n\n图B8：含 P/U/S 关节安全约束时，不同平台高度下的网格搜索 XOY 工作空间截面。 Figure B8. Grid-search XOY workspace sections at selected platform heights with P/U/S joint safety constraints.",
    "content_type": "paragraph",
    "tags": [
      "Stewart平台",
      "并联机器人",
      "6-PUS",
      "MATLAB",
      "运动学",
      "工作空间"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-08-05",
    "content_hash": "863baf6b74801eba",
    "links": []
  },
  {
    "id": "b31cc1d6e8-000",
    "document_id": "b31cc1d6e8",
    "title": "QQ 邮箱 Agently Mail 内测初体验 — 给 AI Agent 一张数字身份证",
    "url": "/QQ邮箱Agently-Mail-AI-Agent数字身份证/",
    "section": "摘要",
    "content": "2026 年 6 月 23 日，腾讯 QQ 邮箱悄然上线 Agently Mail，为 AI Agent 提供专属的 @agent.qq.com 邮箱地址。作为内测阶段的早期使用者，本文记录了从注册、配置到将双账号分别接入 Claude Code 与 Hermes 的完整过程，并对 Agent 独立身份、Agent-to-Agent 通信等未来方向进行了探讨。",
    "content_type": "paragraph",
    "tags": [
      "AI Agent",
      "QQ邮箱",
      "Claude Code",
      "Hermes",
      "技术前沿"
    ],
    "categories": [
      "技术前沿"
    ],
    "published_at": "2026-06-30",
    "content_hash": "efe31a319d1ab0ab",
    "links": []
  },
  {
    "id": "b31cc1d6e8-001",
    "document_id": "b31cc1d6e8",
    "title": "QQ 邮箱 Agently Mail 内测初体验 — 给 AI Agent 一张数字身份证",
    "url": "/QQ邮箱Agently-Mail-AI-Agent数字身份证/",
    "section": "一、Agently Mail 是什么",
    "content": "先澄清一个关键认知：Agently Mail 不是帮你管理邮箱的 AI 助手，而是反过来——给 AI Agent 发一个它自己的邮箱。",
    "content_type": "paragraph",
    "tags": [
      "AI Agent",
      "QQ邮箱",
      "Claude Code",
      "Hermes",
      "技术前沿"
    ],
    "categories": [
      "技术前沿"
    ],
    "published_at": "2026-06-30",
    "content_hash": "efe31a319d1ab0ab",
    "links": []
  },
  {
    "id": "b31cc1d6e8-002",
    "document_id": "b31cc1d6e8",
    "title": "QQ 邮箱 Agently Mail 内测初体验 — 给 AI Agent 一张数字身份证",
    "url": "/QQ邮箱Agently-Mail-AI-Agent数字身份证/",
    "section": "一、Agently Mail 是什么 › 产品速览",
    "content": "| 维度 | 说明 |\n|------|------|\n| 上线时间 | 2026 年 6 月 23 日，内测阶段 |\n| 邮箱后缀 | @agent.qq.com，与个人 QQ/微信邮箱完全隔离 |\n| 配额 | 每人 2 个 Agent 邮箱，每日限发 50 封 |\n| 安全性 | OAuth 授权（限时 Token，可随时撤销）+ 两阶段确认 + Prompt 注入防护 |\n| 开源情况 | GitHub 开源，Apache-2.0 协议，已上架腾讯 SkillHub |\n| 已接入平台 | Claude Code、Hermes、OpenClaw、Cursor、Kimi Work 等 |",
    "content_type": "paragraph",
    "tags": [
      "AI Agent",
      "QQ邮箱",
      "Claude Code",
      "Hermes",
      "技术前沿"
    ],
    "categories": [
      "技术前沿"
    ],
    "published_at": "2026-06-30",
    "content_hash": "efe31a319d1ab0ab",
    "links": []
  },
  {
    "id": "b31cc1d6e8-003",
    "document_id": "b31cc1d6e8",
    "title": "QQ 邮箱 Agently Mail 内测初体验 — 给 AI Agent 一张数字身份证",
    "url": "/QQ邮箱Agently-Mail-AI-Agent数字身份证/",
    "section": "一、Agently Mail 是什么 › 为什么这件事意义重大",
    "content": "2025-2026 年是 AI Agent 基础设施密集落地的时期。Google 的 A2A 协议（Agent-to-Agent 通信）已在 GitHub 获得 2.2 万星标并被 150+ 组织采用，Coinbase 的 x402 协议解决了 Agent 的链上支付问题。腾讯 Agently Mail 补上了最后一环：Agent 的独立数字身份。从此，AI 不再借用人类的邮箱和名义，而以自己的身份参与通信。",
    "content_type": "paragraph",
    "tags": [
      "AI Agent",
      "QQ邮箱",
      "Claude Code",
      "Hermes",
      "技术前沿"
    ],
    "categories": [
      "技术前沿"
    ],
    "published_at": "2026-06-30",
    "content_hash": "efe31a319d1ab0ab",
    "links": []
  },
  {
    "id": "b31cc1d6e8-004",
    "document_id": "b31cc1d6e8",
    "title": "QQ 邮箱 Agently Mail 内测初体验 — 给 AI Agent 一张数字身份证",
    "url": "/QQ邮箱Agently-Mail-AI-Agent数字身份证/",
    "section": "二、双账号配置 › 2.1 注册",
    "content": "在 agent.qq.com 页面，用 QQ/微信扫码登录，进入 Agently Mail 管理后台。点击\"创建 Agent 邮箱\"，输入前缀即可获得 XXX@agent.qq.com。\n\n内测阶段每人可创建两个，我分别注册了：\n\n| 账号 | 接入平台 | 定位 |\n|------|---------|------|\n| liorenyuhang@agent.qq.com | Claude Code | 技术开发、代码 |\n| liuyhhub@agent.qq.com | Hermes | 私人助理、日常事务 |",
    "content_type": "paragraph",
    "tags": [
      "AI Agent",
      "QQ邮箱",
      "Claude Code",
      "Hermes",
      "技术前沿"
    ],
    "categories": [
      "技术前沿"
    ],
    "published_at": "2026-06-30",
    "content_hash": "efe31a319d1ab0ab",
    "links": [
      {
        "text": "agent.qq.com",
        "url": "https://agent.qq.com"
      }
    ]
  },
  {
    "id": "b31cc1d6e8-005",
    "document_id": "b31cc1d6e8",
    "title": "QQ 邮箱 Agently Mail 内测初体验 — 给 AI Agent 一张数字身份证",
    "url": "/QQ邮箱Agently-Mail-AI-Agent数字身份证/",
    "section": "二、双账号配置 › 2.2 绑定 Agent 平台",
    "content": "以 Claude Code 为例，在管理后台：\n\n1. 选择目标 Agent 邮箱，点击\"绑定 Agent 平台\"\n2. 选择 Claude Code，系统生成 OAuth 授权 Token\n3. 在我的本地 Claude Code 终端中执行授权命令，完成连接\n\n同理，第二个账号绑定了 Hermes。\n\n绑定完成后，Claude Code 和 Hermes 分别获得了一个独立的 QQ 邮箱身份——它们可以以自己的名义收发邮件，发送时显示的 From 地址就是 @agent.qq.com。\n\nAgently Mail 最大的优势还是易用性。传统的 IMAP Agent 方案配置起来不说有多难，但确实有些繁琐；而 Agently Mail 采用了 Agent 原生配置流程的方案，把下面这句话喂给 AI Agent，就能直接完成安装和配置：\n\n请阅读 https://agent.qq.com/doc/cli-setup.md 文档，按照步骤为我安装并配置 Agently Mail CLI。\n\n整个过程不需要手动敲 npm install、不需要折腾配置文件——Agent 自己读文档、自己执行命令、自己完成 OAuth 授权。\n\n踩坑记录： 目前 Agently CLI（内测版本）的 OAuth Token 一次只绑定一个邮箱。同一台设备上切换 Claude Code 和 Hermes 的 Agent 邮箱，需要先 agently-cli auth logout 再 agently-cli auth login 手动切换。对双 Agent 场景来说这是明显的摩擦点，预计后续版本会加入多 Profile 支持。",
    "content_type": "paragraph",
    "tags": [
      "AI Agent",
      "QQ邮箱",
      "Claude Code",
      "Hermes",
      "技术前沿"
    ],
    "categories": [
      "技术前沿"
    ],
    "published_at": "2026-06-30",
    "content_hash": "efe31a319d1ab0ab",
    "links": [
      {
        "text": "https://agent.qq.com/doc/cli-setup.md",
        "url": "https://agent.qq.com/doc/cli-setup.md"
      }
    ]
  },
  {
    "id": "b31cc1d6e8-006",
    "document_id": "b31cc1d6e8",
    "title": "QQ 邮箱 Agently Mail 内测初体验 — 给 AI Agent 一张数字身份证",
    "url": "/QQ邮箱Agently-Mail-AI-Agent数字身份证/",
    "section": "三、几点观察 › 两阶段确认：命令行内完成",
    "content": "Agently Mail 的写操作（发信、回复等）需要人类确认。实测中确认流程在 CLI 内完成——Agent 生成操作摘要后等待回复，在对话中输入\"确认\"即可发送，不需要跳转到 QQ 手机端。流程顺畅，没有因为安全机制降低操作效率。",
    "content_type": "paragraph",
    "tags": [
      "AI Agent",
      "QQ邮箱",
      "Claude Code",
      "Hermes",
      "技术前沿"
    ],
    "categories": [
      "技术前沿"
    ],
    "published_at": "2026-06-30",
    "content_hash": "efe31a319d1ab0ab",
    "links": []
  },
  {
    "id": "b31cc1d6e8-007",
    "document_id": "b31cc1d6e8",
    "title": "QQ 邮箱 Agently Mail 内测初体验 — 给 AI Agent 一张数字身份证",
    "url": "/QQ邮箱Agently-Mail-AI-Agent数字身份证/",
    "section": "三、几点观察 › CLI 单 Token 限制",
    "content": "这是目前最大的体验摩擦点。agently-cli 的 OAuth Token 保存在全局配置中，即使 Claude Code 和 Hermes 是独立的 Agent 进程，底层调用的仍是同一个全局 CLI。这导致切换邮箱时必须 auth logout → auth login 手动重新授权。\n\n查阅了 Agently Mail 的官方帮助指南（help.agent.qq.com），Q&A 中对此有明确说明：\n\nQ：我电脑上安装了两个 Agent，怎么接不同地址的 Agent 邮箱？\nA：目前同一台电脑设备上的多个 Agent 只能共同使用同一个邮箱地址。如果要使用不同地址请在不同的电脑设备上使用。\n\n官方文档确认了这是当前版本的已知限制。也就是说，我实测中的 auth logout → auth login 切换流程，虽然不是最优雅的方案，但确实是目前官方推荐的通路——在不增加第二台设备的前提下，这是唯一能让两个 Agent 邮箱共存于同一机器的办法。对多 Agent 场景来说，理想状态是每个 Agent 进程维护独立的 Token 上下文，相信这是后续版本的重点优化方向。",
    "content_type": "paragraph",
    "tags": [
      "AI Agent",
      "QQ邮箱",
      "Claude Code",
      "Hermes",
      "技术前沿"
    ],
    "categories": [
      "技术前沿"
    ],
    "published_at": "2026-06-30",
    "content_hash": "efe31a319d1ab0ab",
    "links": [
      {
        "text": "help.agent.qq.com",
        "url": "https://help.agent.qq.com/detail/0/1092"
      }
    ]
  },
  {
    "id": "b31cc1d6e8-008",
    "document_id": "b31cc1d6e8",
    "title": "QQ 邮箱 Agently Mail 内测初体验 — 给 AI Agent 一张数字身份证",
    "url": "/QQ邮箱Agently-Mail-AI-Agent数字身份证/",
    "section": "三、几点观察 › 邮箱隔离是有效的",
    "content": "实测中 Agent 邮箱（@agent.qq.com）与个人 QQ 邮箱的收发完全隔离，Agent 无法访问人的收件箱，人也看不到 Agent 的收件箱，除非 Agent 主动发信给人。这个隔离设计让人放心——给 Agent 一个邮箱，不等于给它一张通往你所有隐私数据的通行证。",
    "content_type": "paragraph",
    "tags": [
      "AI Agent",
      "QQ邮箱",
      "Claude Code",
      "Hermes",
      "技术前沿"
    ],
    "categories": [
      "技术前沿"
    ],
    "published_at": "2026-06-30",
    "content_hash": "efe31a319d1ab0ab",
    "links": []
  },
  {
    "id": "b31cc1d6e8-009",
    "document_id": "b31cc1d6e8",
    "title": "QQ 邮箱 Agently Mail 内测初体验 — 给 AI Agent 一张数字身份证",
    "url": "/QQ邮箱Agently-Mail-AI-Agent数字身份证/",
    "section": "四、实际场景测试",
    "content": "以下三个场景均已完成实测。\n\n关于 CLI 登录切换： Agently CLI 目前一个 Token 只绑定一个 Agent 邮箱，在同一台设备上无法同时保持两个 Agent 邮箱的登录态。每一个场景的实测过程中，需要先 agently-cli auth logout 退出当前绑定，再 agently-cli auth login 重新授权到目标邮箱。这不是 \"换个软件\" 的问题——即使 Claude Code 和 Hermes 是独立的终端进程，它们调用的底层都是同一个全局安装的 agently-cli 命令，而 OAuth Token 保存于全局配置中，不被各自的 Agent 进程隔离。这是内测阶段产品的典型特征，后续多 Profile 支持上线后即可解决。",
    "content_type": "paragraph",
    "tags": [
      "AI Agent",
      "QQ邮箱",
      "Claude Code",
      "Hermes",
      "技术前沿"
    ],
    "categories": [
      "技术前沿"
    ],
    "published_at": "2026-06-30",
    "content_hash": "efe31a319d1ab0ab",
    "links": []
  },
  {
    "id": "b31cc1d6e8-010",
    "document_id": "b31cc1d6e8",
    "title": "QQ 邮箱 Agently Mail 内测初体验 — 给 AI Agent 一张数字身份证",
    "url": "/QQ邮箱Agently-Mail-AI-Agent数字身份证/",
    "section": "四、实际场景测试 › 场景一：Agent 主动发送邮件",
    "content": "我在 Claude Code 终端中让 Agent 以 liorenyuhang@agent.qq.com 的身份向我的个人邮箱发送一封自我介绍邮件。\n\n[图：Claude Code 终端发送指令]\n\n确认发送后，个人邮箱成功收到邮件——发件人显示为 liorenyuhang@agent.qq.com，正文中 Agent 清楚说明了它的邮箱地址和所接入的平台。\n\n[图：个人邮箱收到 Agent 发来的邮件]\n\n验证结果： Agent 以独立身份主动完成了邮件发送，From 地址为 @agent.qq.com，与人类用户的 QQ 邮箱完全隔离。",
    "content_type": "paragraph",
    "tags": [
      "AI Agent",
      "QQ邮箱",
      "Claude Code",
      "Hermes",
      "技术前沿"
    ],
    "categories": [
      "技术前沿"
    ],
    "published_at": "2026-06-30",
    "content_hash": "efe31a319d1ab0ab",
    "links": []
  },
  {
    "id": "b31cc1d6e8-011",
    "document_id": "b31cc1d6e8",
    "title": "QQ 邮箱 Agently Mail 内测初体验 — 给 AI Agent 一张数字身份证",
    "url": "/QQ邮箱Agently-Mail-AI-Agent数字身份证/",
    "section": "四、实际场景测试 › 场景二：Agent 读取邮件并做摘要",
    "content": "先用个人邮箱向 liuyhhub@agent.qq.com 发送一篇科技新闻：\n\n[图：个人邮箱向 Agent 发送新闻邮件]\n\n然后切换到 Hermes 终端，让 Agent 读取最新邮件并总结：\n\n[图：在 Hermes 终端输入读取指令]\n\nHermes 成功读取了收件箱中的邮件，并返回了一段清晰的内容摘要：\n\n[图：Hermes 返回邮件内容摘要]\n\n验证结果： Agent 完成了\"接收 → 阅读理解 → 归纳总结\"的闭环，摘要质量与直接对话场景下的 AI 输出无异。",
    "content_type": "paragraph",
    "tags": [
      "AI Agent",
      "QQ邮箱",
      "Claude Code",
      "Hermes",
      "技术前沿"
    ],
    "categories": [
      "技术前沿"
    ],
    "published_at": "2026-06-30",
    "content_hash": "efe31a319d1ab0ab",
    "links": []
  },
  {
    "id": "b31cc1d6e8-012",
    "document_id": "b31cc1d6e8",
    "title": "QQ 邮箱 Agently Mail 内测初体验 — 给 AI Agent 一张数字身份证",
    "url": "/QQ邮箱Agently-Mail-AI-Agent数字身份证/",
    "section": "四、实际场景测试 › 场景三：双 Agent 通信（A2A 雏形）",
    "content": "这是最有意思的测试——让两个不同平台的 Agent 直接互发邮件。\n\n第一步：Hermes 发件。 在 Hermes 终端中，指令 Agent 向 Claude Code 的邮箱发送请求邮件。\n\n[图：Hermes 终端发送邮件指令]\n\nHermes 完成发件后，在 QQ 邮箱管理后台确认邮件已送达：\n\n[图：确认邮件已到达 liorenyuhang 的收件箱]\n\n第二步：Claude Code 收件并回复。 切换到 Claude Code，让 Agent 读取 Hermes 的邮件并按要求回复。\n\n[图：Claude Code 读取 Hermes 发来的邮件]\n\nClaude Code 读取邮件后理解了 Hermes 的请求，开始生成 JSON 格式的 To-Do List 回复：\n\n[图：Claude Code 生成回复内容]\n\nClaude Code 在命令行中完成确认流程后，邮件直接发出：\n\n[图：确认发送后的完整回复邮件]\n\n第三步：Hermes 接收回复。 切回 Hermes，查看 Claude Code 的回复邮件并总结：\n\n[图：Hermes 读取并总结 Claude Code 的回复]\n\n验证结果： 两个不同 Agent 平台（Claude Code 与 Hermes）的 Agent 完成了端到端的邮件收发闭环。这是一个 Agent-to-Agent 通信的雏形——虽然目前还需手动切换 CLI 登录状态，但通信链路已经跑通。",
    "content_type": "paragraph",
    "tags": [
      "AI Agent",
      "QQ邮箱",
      "Claude Code",
      "Hermes",
      "技术前沿"
    ],
    "categories": [
      "技术前沿"
    ],
    "published_at": "2026-06-30",
    "content_hash": "efe31a319d1ab0ab",
    "links": []
  },
  {
    "id": "b31cc1d6e8-013",
    "document_id": "b31cc1d6e8",
    "title": "QQ 邮箱 Agently Mail 内测初体验 — 给 AI Agent 一张数字身份证",
    "url": "/QQ邮箱Agently-Mail-AI-Agent数字身份证/",
    "section": "五、总结",
    "content": "从注册、双账号配置到三个实测场景跑完，核心体验可以归纳为：\n\n- 功能方向成立：Agent 以独立身份收发邮件这一核心流程已经完全跑通，产品定位清晰，不是噱头\n- 安全设计在线：命令行内确认机制 + 邮箱隔离，在可用性和安全性之间找到了合理的平衡点\n- 多账号管理是短板：CLI 全局 Token 导致双 Agent 场景体验割裂，切换成本不容忽视，预计后续版本会优先解决\n\n作为一个还在内测阶段的产品，Agently Mail 完成度比预期高。它不是一个\"以后可能会火\"的概念，而是一个今天就可以跑通的工具——虽然还不完美，但方向是对的，时机也够早。这就足够了。",
    "content_type": "paragraph",
    "tags": [
      "AI Agent",
      "QQ邮箱",
      "Claude Code",
      "Hermes",
      "技术前沿"
    ],
    "categories": [
      "技术前沿"
    ],
    "published_at": "2026-06-30",
    "content_hash": "efe31a319d1ab0ab",
    "links": []
  },
  {
    "id": "b31cc1d6e8-014",
    "document_id": "b31cc1d6e8",
    "title": "QQ 邮箱 Agently Mail 内测初体验 — 给 AI Agent 一张数字身份证",
    "url": "/QQ邮箱Agently-Mail-AI-Agent数字身份证/",
    "section": "六、后续计划",
    "content": "- 将 Agent 邮箱接入日常开发工作流，实现自动化的代码审查通知、构建状态报告\n- 探索 A2A 协议与 Agently Mail 的结合，设计多 Agent 协作的通信规范\n- 跟踪腾讯对 Agent 邮箱的功能迭代（附件处理、邮件规则、API 开放程度）\n\n以上内容由 Claude Code + DeepSeek 辅助生成",
    "content_type": "paragraph",
    "tags": [
      "AI Agent",
      "QQ邮箱",
      "Claude Code",
      "Hermes",
      "技术前沿"
    ],
    "categories": [
      "技术前沿"
    ],
    "published_at": "2026-06-30",
    "content_hash": "efe31a319d1ab0ab",
    "links": []
  },
  {
    "id": "32a546db63-000",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "Hello World!",
    "content": "这是一句工科生熟悉的不能再熟悉的话 \n\n我用 Hexo + NexT 搭建了一个自己的个人网站，通过 GitHub Pages 托管。",
    "content_type": "paragraph",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": []
  },
  {
    "id": "32a546db63-001",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "为什么要建个人网站？",
    "content": "- 📝 记录学习和成长\n- 🚀 展示项目和作品\n- 🌐 拥有自己的互联网角落",
    "content_type": "paragraph",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": []
  },
  {
    "id": "32a546db63-002",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "搭建过程 › 1. 环境准备",
    "content": "首先你需要安装：\n\n| 工具 | 下载 |\n|------|------|\n| Node.js（LTS 版） | https://nodejs.org/ |\n| Git | https://git-scm.com/downloads |\n| VS Code（推荐编辑器） | https://code.visualstudio.com/ |\n\n安装后验证：",
    "content_type": "paragraph",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": [
      {
        "text": "https://nodejs.org/",
        "url": "https://nodejs.org/"
      },
      {
        "text": "https://git-scm.com/downloads",
        "url": "https://git-scm.com/downloads"
      },
      {
        "text": "https://code.visualstudio.com/",
        "url": "https://code.visualstudio.com/"
      }
    ]
  },
  {
    "id": "32a546db63-003",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "搭建过程 › 1. 环境准备",
    "content": "node --version\ngit --version",
    "content_type": "code",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": []
  },
  {
    "id": "32a546db63-004",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "搭建过程 › 1. 环境准备",
    "content": "git config --global user.name \"你的GitHub用户名\"\ngit config --global user.email \"你的邮箱\"",
    "content_type": "code",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": []
  },
  {
    "id": "32a546db63-005",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "搭建过程 › 2. 安装 Hexo",
    "content": "npm install -g hexo-cli",
    "content_type": "code",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": []
  },
  {
    "id": "32a546db63-006",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "搭建过程 › 3. 创建项目",
    "content": "cd 你的项目目录\nhexo init .\nnpm install",
    "content_type": "code",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": []
  },
  {
    "id": "32a546db63-007",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "搭建过程 › 3. 创建项目",
    "content": "npm install hexo-generator-search   # 本地搜索\nnpm install hexo-deployer-git       # 一键部署\nnpm install hexo-wordcount          # 字数统计",
    "content_type": "code",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": []
  },
  {
    "id": "32a546db63-008",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "搭建过程 › 4. 选择主题",
    "content": "我选了 NexT Gemini——工科极简风，默认黑白配色就很好看，也支持暗色模式。",
    "content_type": "paragraph",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": []
  },
  {
    "id": "32a546db63-009",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "搭建过程 › 4. 选择主题",
    "content": "npm install hexo-theme-next",
    "content_type": "code",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": []
  },
  {
    "id": "32a546db63-010",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "搭建过程 › 4. 选择主题",
    "content": "theme: next",
    "content_type": "code",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": []
  },
  {
    "id": "32a546db63-011",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "搭建过程 › 4. 选择主题",
    "content": "创建 _config.next.yml 放入主题配置。NexT 提供四种方案：Muse / Mist / Pisces / Gemini（我选的卡片式布局）。",
    "content_type": "paragraph",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": []
  },
  {
    "id": "32a546db63-012",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "搭建过程 › 5. 写文章",
    "content": "npx hexo new \"文章标题\"",
    "content_type": "code",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": []
  },
  {
    "id": "32a546db63-013",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "搭建过程 › 5. 写文章",
    "content": "Markdown 文件生成在 source/_posts/ 下，直接编辑即可。本地预览：",
    "content_type": "paragraph",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": []
  },
  {
    "id": "32a546db63-014",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "搭建过程 › 5. 写文章",
    "content": "npx hexo server\n# 浏览器打开 http://localhost:4000",
    "content_type": "code",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": []
  },
  {
    "id": "32a546db63-015",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "搭建过程 › 6. 部署上线",
    "content": "创建 GitHub 仓库：github.com/new，名字必须是 你的用户名.github.io，选择 Public。\n\n⚠️ 注意：Add README、.gitignore、License 三个选项全部不勾，否则推送会冲突。\n\n推送到 GitHub：",
    "content_type": "paragraph",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": [
      {
        "text": "github.com/new",
        "url": "https://github.com/new"
      }
    ]
  },
  {
    "id": "32a546db63-016",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "搭建过程 › 6. 部署上线",
    "content": "git init\ngit add -A\ngit commit -m \"初始化网站\"\ngit branch -M main\ngit remote add origin https://github.com/你的用户名/你的用户名.github.io.git\ngit push -u origin main",
    "content_type": "code",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": []
  },
  {
    "id": "32a546db63-017",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "搭建过程 › 6. 部署上线",
    "content": "GitHub Pages 部署（自动）——创建 .github/workflows/deploy.yml：",
    "content_type": "paragraph",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": []
  },
  {
    "id": "32a546db63-018",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "搭建过程 › 6. 部署上线",
    "content": "name: Deploy to GitHub Pages\non:\n  push:\n    branches: [main]\npermissions:\n  contents: write\njobs:\n  build-and-deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n          cache: npm\n      - run: npm ci\n      - run: npx hexo generate\n      - uses: peaceiris/actions-gh-pages@v3\n        with:\n          github_token: ${{ secrets.GITHUB_TOKEN }}\n          publish_dir: ./public\n          publish_branch: gh-pages",
    "content_type": "code",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": []
  },
  {
    "id": "32a546db63-019",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "搭建过程 › 6. 部署上线",
    "content": "然后去 GitHub 仓库 → Settings → Pages → Source 选 gh-pages 分支 → Save。1 分钟后网站就在 https://你的用户名.github.io 上线了。",
    "content_type": "paragraph",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": []
  },
  {
    "id": "32a546db63-020",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "搭建过程 › 7. 日常使用",
    "content": "npx hexo new \"新文章\"                          # 创建\n# 编辑 source/_posts/新文章.md\nnpx hexo server                                 # 本地预览\ngit add -A && git commit -m \"新文章\" && git push # 发布",
    "content_type": "code",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": []
  },
  {
    "id": "32a546db63-021",
    "document_id": "32a546db63",
    "title": "从零搭建个人网站：Hexo + NexT + GitHub Pages 完整教程",
    "url": "/2026/06/10/从零搭建个人网站-Hexo-NexT-GitHub-Pages-完整教程/",
    "section": "搭建过程 › 7. 日常使用",
    "content": "推送后 GitHub Actions 自动构建部署，全程免费。\n\n这只是开始，后面会慢慢完善网站内容和样式。一个机器人方向的博士生的科研。\n\n以上内容与网站由 Claude Code + DeepSeek 辅助生成",
    "content_type": "paragraph",
    "tags": [
      "教程",
      "Hexo",
      "GitHub Pages"
    ],
    "categories": [
      "教程"
    ],
    "published_at": "2026-06-10",
    "content_hash": "15823b0691959df8",
    "links": []
  },
  {
    "id": "0a70b95af6-000",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "摘要",
    "content": "面向微型并联平台对执行器在尺寸、力控精度与多轴联控方面的综合需求，完成了因时 LAF50-024D 微型伺服电缸的全栈控制系统。工作覆盖硬件层接线与通信链路搭建、二进制协议与 Modbus RTU 协议解析、分层驱动架构设计与实现、ROS2 节点封装与交互式终端开发，以及从单电机 UART 直连到多电机 RS485 总线联控的完整演进。全部代码开源，在 Ubuntu 24.04 + ROS2 Jazzy 环境下通过验证。",
    "content_type": "paragraph",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-001",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "方案对比",
    "content": "| | UART 方案 | Modbus 方案 |\n|------|-----------|-------------|\n| 仓库 | inspiremotoruart | inspiremotormodbus |\n| 通信方式 | USB-TTL，因时自定义二进制协议 | RS485 总线，Modbus RTU |\n| 物理层 | LVTTL 3.3V，点对点 | RS485 差分，一主多从 |\n| 多电机支持 | 每电机独占 USB 串口 | 共享 RS485 总线，从站地址区分 |\n| 依赖库 | pyserial | minimalmodbus |\n| 控制模式 | 6 种（全模式） | 5 种（电压模式未映射） |\n| 定位 | 单电机验证与调试 | 多电机联控与平台部署 |\n\n两套方案共用同一分层架构和 MotorController 对外接口，底层通信方式的切换不影响上层调用。",
    "content_type": "paragraph",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": [
      {
        "text": "inspire_motor_uart",
        "url": "https://github.com/LiorenYuhang/inspire_motor_uart"
      },
      {
        "text": "inspire_motor_modbus",
        "url": "https://github.com/LiorenYuhang/inspire_motor_modbus"
      }
    ]
  },
  {
    "id": "0a70b95af6-002",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "一、硬件选型 › 1.1 需求分析",
    "content": "博士课题研究微型并联平台，对执行器的约束如下：\n\n- 尺寸受限，平台动平台空间狭窄，常规伺服电机与减速器组合无法装入\n- 需要力闭环控制能力，末端操作涉及精密接触，力传感器为必选项\n- 通信接口应支持多设备组网，后期需在单一总线上挂载多台电缸\n- 上位机端需双向指令与状态反馈，不接受开环 PWM 驱动\n\n主流微型舵机仅提供位置环控制，无力反馈通道；工业伺服电机虽具备力控，但尺寸与自重远超平台承载范围。综合评估后选定因时机器人 LAF 系列力闭环微型伺服电缸。",
    "content_type": "paragraph",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-003",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "一、硬件选型 › 1.2 LAF50-024D 规格参数",
    "content": "参数数值参数数值\n行程50 mm最大推拉力50 N\n重量50 g堵转推拉力80 N\n空载速度17 mm/s额定速度8 mm/s\n重复定位精度±0.1 mm最大自锁力80 N\n力传感器范围±100 N力传感器分辨率1 N\n静态电流0.05 A峰值电流2 A\n供电电压DC 8V通信接口D 型（UART, LVTTL 3.3V）\n防护等级IP40控制模式位置/速度/力/电压/伺服/速度力控\n\n内置力传感器与力闭环控制为选型的决定性因素，无需在末端额外串联力传感器，减小了平台动平台的惯量负担。",
    "content_type": "paragraph",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-004",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "二、第一阶段：UART 直连控制 › 2.1 硬件连接",
    "content": "单电机最小系统由一个 USB-TTL 模块（CP2102/CH340，LVTTL 3.3V 电平）、一个 DC 8V/2A 电源与四根杜邦线组成。",
    "content_type": "paragraph",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-005",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "二、第一阶段：UART 直连控制 › 2.1 硬件连接",
    "content": "PC USB → CP2102/CH340 (TTL 3.3V) → 电缸 D 型接口\n                                        ① GND (黑)  ── 电源 GND\n                                        ② VCC (红)  ── 电源 +8V\n                                        ③ RXD (黄)  ← USB-TTL TXD\n                                        ④ TXD (蓝)  → USB-TTL RXD",
    "content_type": "code",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-006",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "二、第一阶段：UART 直连控制 › 2.1 硬件连接",
    "content": "注意事项：\n- USB-TTL 模块须为 LVTTL 3.3V 电平，5V 电平模块会损坏电缸 IO\n- 电源、USB-TTL、电缸三端 GND 共地\n- 禁止带电插拔",
    "content_type": "paragraph",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-007",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "二、第一阶段：UART 直连控制 › 2.2 软件架构",
    "content": "交互层  (motor_node.py)        ROS2 终端节点与用户输入解析\n驱动层  (motor_driver.py)      控制模式封装、状态结构体定义\n协议层  (ins_protocol.py)      二进制帧打包/解包、校验、命令编码\n通信层  (ins_uart.py)          串口读写、字节级收发",
    "content_type": "code",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-008",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "二、第一阶段：UART 直连控制 › 2.2 软件架构",
    "content": "通信层\n\n封装 pyserial 实现字节流收发，不涉及任何协议语义。",
    "content_type": "paragraph",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-009",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "二、第一阶段：UART 直连控制 › 2.2 软件架构",
    "content": "class InsUART:\n    def __init__(self, port, baudrate=921600):\n        self.ser = serial.Serial(port, baudrate, timeout=0.05)\n    \n    def send(self, data: bytes):\n        self.ser.write(data)\n    \n    def recv(self, expected_len: int) -> bytes:\n        return self.ser.read(expected_len)",
    "content_type": "code",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-010",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "二、第一阶段：UART 直连控制 › 2.2 软件架构",
    "content": "协议层\n\n因时自定义二进制帧格式为 | 帧头 0xAA | ID | 长度 | 命令 | 数据 | 校验和 |。协议层负责帧的构造与解析，将上层语义指令映射为字节序列。",
    "content_type": "paragraph",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-011",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "二、第一阶段：UART 直连控制 › 2.2 软件架构",
    "content": "class InsProtocol:\n    CMD_SET_POSITION  = 0x01\n    CMD_SET_SPEED     = 0x02\n    CMD_SET_FORCE     = 0x03\n    CMD_READ_STATUS   = 0x10\n    # 共 20+ 条指令编码\n\n    def pack_position_cmd(self, motor_id, position):\n        frame = bytearray([0xAA, motor_id, 0x04, self.CMD_SET_POSITION])\n        frame.extend(position.to_bytes(2, 'little'))\n        frame.append(self._checksum(frame))\n        return bytes(frame)\n\n    def unpack_status(self, raw_bytes):\n        \"\"\"按协议字段偏移逐字节解析\"\"\"\n        pass",
    "content_type": "code",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-012",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "二、第一阶段：UART 直连控制 › 2.2 软件架构",
    "content": "驱动层\n\n向上层暴露模式控制接口，将通信细节与协议实现完全封装。MotorController 对外仅提供与方法名对应的功能调用，调用方无需了解帧结构。",
    "content_type": "paragraph",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-013",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "二、第一阶段：UART 直连控制 › 2.2 软件架构",
    "content": "class MotorController:\n    def __init__(self, port, motor_id=1):\n        self.uart = InsUART(port)\n        self.proto = InsProtocol()\n        self.motor_id = motor_id\n\n    def move_to_position(self, position):\n        cmd = self.proto.pack_position_cmd(self.motor_id, position)\n        self.uart.send(cmd)\n        resp = self.uart.recv(EXPECTED_LEN)\n        return self.proto.unpack_response(resp)\n\n    def set_force_mode(self, force_target):\n        # 同模式，不同命令码\n        pass\n\n    def read_status(self) -> StatusFeedback:\n        pass",
    "content_type": "code",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-014",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "二、第一阶段：UART 直连控制 › 2.2 软件架构",
    "content": "四层架构的核心收益在于：通信层和协议层可独立替换而不影响驱动层及上层节点。后续由 UART 切换到 Modbus 时，驱动层接口完全保持兼容。",
    "content_type": "paragraph",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-015",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "二、第一阶段：UART 直连控制 › 2.3 控制模式",
    "content": "6 种控制模式均通过实物电缸完成验证：\n\n| 模式 | 功能 | 应用场景 |\n|------|------|---------|\n| 定位 | 给定绝对位置，电缸自动规划到位 | 点到点运动 |\n| 伺服 | ≥50Hz 高频位置指令，电缸实时跟随 | 轨迹跟踪 |\n| 速度 | 以设定速度匀速运行至目标位置停止 | 恒速扫描 |\n| 力控 | 动态调节位置以维持受力在设定值 | 恒力接触操作 |\n| 电压 | 直接设定电机两端电压 | 底层调试与开环控制 |\n| 速度力控 | 设定速度运动，受力超限时自动停止 | 带力保护的夹持 |",
    "content_type": "paragraph",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-016",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "二、第一阶段：UART 直连控制 › 2.4 ROS2 集成",
    "content": "封装为 ROS2 包 insmotordriver（amentcmakepython），包含：\n\n- motornode.py：终端交互节点，启动后显示模式菜单，键盘输入模式与参数，实时回读并打印状态\n- motor_control.launch.py：支持命令行指定串口与电机 ID\n- Python API：可在任意 ROS2 节点中直接 import 调用",
    "content_type": "paragraph",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-017",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "二、第一阶段：UART 直连控制 › 2.4 ROS2 集成",
    "content": "ros2 launch insmotor_driver motor_control.launch.py port:=/dev/ttyUSB0",
    "content_type": "code",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-018",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "三、第二阶段：Modbus 总线联控 › 3.1 切换动机",
    "content": "UART 直连模式下，每台电机独占一个 USB 串口，NUC 主机 USB 接口数量构成硬约束。当平台自由度超过该数量时，需要扩展 USB 或切换通信架构。\n\nRS485 总线支持一主多从拓扑，多个设备挂载在同一差分总线上，通过从站地址区分，无需额外 USB 端口，也便于同步控制逻辑的实现。",
    "content_type": "paragraph",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-019",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "三、第二阶段：Modbus 总线联控 › 3.2 硬件变更",
    "content": "引入因时 AED-LA-92-12MR1 Modbus RTU 转换器，每台电缸配一个转换器。转换器一侧接入 RS485 总线，另一侧通过 4pin 杜邦线与电缸 D 型接口相连。供电由 DC 8V 直供变为 DC 24V 经转换器降压至 8V。",
    "content_type": "paragraph",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-020",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "三、第二阶段：Modbus 总线联控 › 3.2 硬件变更",
    "content": "PC/NUC USB → USB-RS485 模块 → RS485 总线 (A+/B-/GND)\n       ├── 转换器 #1 (addr=1) → 电缸 1\n       ├── 转换器 #2 (addr=2) → 电缸 2\n       └── 转换器 #N (addr=N) → 电缸 N",
    "content_type": "code",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-021",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "三、第二阶段：Modbus 总线联控 › 3.3 软件变更",
    "content": "分层架构下，切换通信方案仅需重写通信层与协议层，驱动层接口保持兼容：\n\n| 层次 | UART 版 | Modbus 版 |\n|------|---------|-----------|\n| 通信层 | insuart.py（pyserial，字节流收发） | insmodbus.py（minimalmodbus，寄存器读写） |\n| 协议层 | insprotocol.py（因时自定义二进制帧） | insmodbusprotocol.py（Modbus 寄存器地址映射） |\n| 驱动层 | motordriver.py（模式封装、状态结构体） | motor_driver.py（API 不变） |\n\n通信层实现变化：",
    "content_type": "paragraph",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-022",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "三、第二阶段：Modbus 总线联控 › 3.3 软件变更",
    "content": "# UART 版\nself.ser.write(frame_bytes)\nresp = self.ser.read(expected_len)\n\n# Modbus 版\nself.instrument.write_register(0x0020, position)\ndata = self.instrument.read_registers(0x0021, 6)",
    "content_type": "code",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-023",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "三、第二阶段：Modbus 总线联控 › 3.4 多电机控制",
    "content": "多台电缸共享同一 RS485 串口，通过从站地址参数区分：",
    "content_type": "paragraph",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-024",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "三、第二阶段：Modbus 总线联控 › 3.4 多电机控制",
    "content": "motors = {\n    f'motor_{i}': MotorController('/dev/ttyUSB0', slave_address=i)\n    for i in range(1, 7)\n}\nmotors['motor_1'].move_to_position(500)\nmotors['motor_2'].set_force_mode(1000)",
    "content_type": "code",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-025",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "三、第二阶段：Modbus 总线联控 › 3.4 多电机控制",
    "content": "注意事项：转换器出厂默认从站地址均为 1，需在独立连接时逐一修改为不同地址并写入 Flash 后，再全部接入总线。多设备地址冲突将导致通信失败。",
    "content_type": "paragraph",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-026",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "三、第二阶段：Modbus 总线联控 › 3.5 通信速率",
    "content": "转换器默认波特率为 9600 bps。6 电机轮询估算：\n\n- 9600 bps：每电机约 40 ms × 6 ≈ 240 ms/轮，有效更新率约 4 Hz\n- 115200 bps：每电机约 3 ms × 6 ≈ 18 ms/轮，有效更新率约 55 Hz\n\n伺服模式要求 ≥50 Hz，9600 无法满足，需在上电初始化时提升至 115200 bps。",
    "content_type": "paragraph",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-027",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "四、文档与可复现性",
    "content": "两个仓库均提供了完整的 README 文档，包括硬件接线图、软件环境配置、编译安装、6 种控制模式的交互式操作说明、Python API 示例、API 速查表、多电机拓扑及故障排查指南。第三方可参照文档独立复现全部实验流程。",
    "content_type": "paragraph",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "0a70b95af6-028",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "五、代码仓库",
    "content": "| 方案 | 仓库 |\n|------|------|\n| UART 直连（单电机） | inspiremotoruart |\n| Modbus 总线（多电机） | inspiremotormodbus |",
    "content_type": "paragraph",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": [
      {
        "text": "inspire_motor_uart",
        "url": "https://github.com/LiorenYuhang/inspire_motor_uart"
      },
      {
        "text": "inspire_motor_modbus",
        "url": "https://github.com/LiorenYuhang/inspire_motor_modbus"
      }
    ]
  },
  {
    "id": "0a70b95af6-029",
    "document_id": "0a70b95af6",
    "title": "因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线",
    "url": "/2026/06/16/因时微型伺服电缸-ROS2控制-从UART到Modbus总线/",
    "section": "六、后续工作",
    "content": "当前已完成单电机全模式控制与多电机总线通信框架的搭建。后续工作的核心方向是将电缸控制集成到微型并联平台的整体控制架构中：\n\n- 多轴运动学集成：将电缸驱动层接入平台的逆运动学解算模块，由末端位姿指令直接解算各支链电缸的目标位置，实现关节空间到操作空间的映射\n- 同步控制与轨迹规划：在 RS485 总线基础上实现多轴同步控制策略，开发多项式插值与 S 曲线轨迹规划器，满足平台末端在笛卡尔空间内的平滑运动需求\n- 力位混合控制：利用 LAF 系列力闭环能力，在并联平台末端引入力位混合控制策略，用于精密装配与接触式操作场景\n- 平台建模与仿真验证：建立并联机构的运动学与动力学模型，在 Gazebo/CoppeliaSim 环境中进行仿真验证后，部署至物理平台\n\n以上内容由 Claude Code + DeepSeek 辅助生成",
    "content_type": "paragraph",
    "tags": [
      "ROS2",
      "机器人",
      "电机控制",
      "Modbus",
      "Python"
    ],
    "categories": [
      "机器人"
    ],
    "published_at": "2026-06-16",
    "content_hash": "df93bfc71ae7b62b",
    "links": []
  },
  {
    "id": "4f10f17be1-000",
    "document_id": "4f10f17be1",
    "title": "关于我",
    "url": "/about/",
    "section": null,
    "content": "👋 你好！\n\n我是 刘宇杭，欢迎来到我的个人网站。\n\n关于我\n\n- 📍 地点：浙江理工大学（Zhejiang Sci-Tech University，ZSTU）\n- 💼 职业：在读博士生\n- 📚 正在学习：并联机器人设计、ROS2开发、机器人控制\n\n这个网站\n\n使用 Hexo 搭建，NexT 主题，托管在 GitHub Pages——完全免费。\n\n联系我\n\n- 🐙 GitHub：LiorenYuhang\n- 📧 邮箱：liu999yh@qq.com",
    "content_type": "paragraph",
    "tags": [],
    "categories": [],
    "published_at": null,
    "content_hash": "d5050937370fd598",
    "links": []
  }
];
