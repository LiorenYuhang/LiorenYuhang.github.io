---
title: 因时微型伺服电缸的 ROS2 控制：从 UART 直连到 Modbus 总线
date: 2026-06-16 12:00:00
tags: [ROS2, 机器人, 电机控制, Modbus, Python]
categories: 机器人
description: 博士课题中因时 LAF 微型伺服电缸的完整控制方案——从单电机 UART 直连到多电机 Modbus 总线，覆盖 6 种控制模式，分层架构设计，ROS2 Jazzy 集成。
top_img:
cover:
---

## 摘要

面向微型并联平台对执行器在尺寸、力控精度与多轴联控方面的综合需求，完成了因时 LAF50-024D 微型伺服电缸的全栈控制系统。工作覆盖硬件层接线与通信链路搭建、二进制协议与 Modbus RTU 协议解析、分层驱动架构设计与实现、ROS2 节点封装与交互式终端开发，以及从单电机 UART 直连到多电机 RS485 总线联控的完整演进。全部代码开源，在 Ubuntu 24.04 + ROS2 Jazzy 环境下通过验证。

---

## 方案对比

| | UART 方案 | Modbus 方案 |
|------|-----------|-------------|
| 仓库 | [inspire_motor_uart](https://github.com/LiorenYuhang/inspire_motor_uart) | [inspire_motor_modbus](https://github.com/LiorenYuhang/inspire_motor_modbus) |
| 通信方式 | USB-TTL，因时自定义二进制协议 | RS485 总线，Modbus RTU |
| 物理层 | LVTTL 3.3V，点对点 | RS485 差分，一主多从 |
| 多电机支持 | 每电机独占 USB 串口 | 共享 RS485 总线，从站地址区分 |
| 依赖库 | `pyserial` | `minimalmodbus` |
| 控制模式 | 6 种（全模式） | 5 种（电压模式未映射） |
| 定位 | 单电机验证与调试 | 多电机联控与平台部署 |

两套方案共用同一分层架构和 `MotorController` 对外接口，底层通信方式的切换不影响上层调用。

---

## 一、硬件选型

### 1.1 需求分析

博士课题研究微型并联平台，对执行器的约束如下：

- 尺寸受限，平台动平台空间狭窄，常规伺服电机与减速器组合无法装入
- 需要力闭环控制能力，末端操作涉及精密接触，力传感器为必选项
- 通信接口应支持多设备组网，后期需在单一总线上挂载多台电缸
- 上位机端需双向指令与状态反馈，不接受开环 PWM 驱动

主流微型舵机仅提供位置环控制，无力反馈通道；工业伺服电机虽具备力控，但尺寸与自重远超平台承载范围。综合评估后选定因时机器人 LAF 系列力闭环微型伺服电缸。

### 1.2 LAF50-024D 规格参数

| 参数 | 数值 |
|------|------|
| 行程 | 50 mm |
| 重量 | 50 g |
| 最大推拉力 | 50 N |
| 堵转推拉力 | 80 N |
| 最大自锁力 | 80 N |
| 空载速度 | 17 mm/s |
| 额定速度 | 8 mm/s |
| 重复定位精度 | ±0.1 mm |
| 力传感器检测范围 | ±100 N |
| 力传感器分辨率 | 1 N |
| 静态电流 | 0.05 A |
| 峰值电流 | 2 A |
| 供电电压 | DC 8V |
| 通信接口 | D 型（UART，LVTTL 3.3V） |
| 防护等级 | IP40 |
| 控制模式 | 位置 / 速度 / 力 / 电压 / 伺服 / 速度力控 |

内置力传感器与力闭环控制为选型的决定性因素，无需在末端额外串联力传感器，减小了平台动平台的惯量负担。

---

## 二、第一阶段：UART 直连控制

### 2.1 硬件连接

单电机最小系统由一个 USB-TTL 模块（CP2102/CH340，LVTTL 3.3V 电平）、一个 DC 8V/2A 电源与四根杜邦线组成。

```
   PC USB → CP2102/CH340 (TTL 3.3V) → 电缸 D 型接口
                                        ① GND (黑)  ── 电源 GND
                                        ② VCC (红)  ── 电源 +8V
                                        ③ RXD (黄)  ← USB-TTL TXD
                                        ④ TXD (蓝)  → USB-TTL RXD
```

注意事项：
- USB-TTL 模块须为 LVTTL 3.3V 电平，5V 电平模块会损坏电缸 IO
- 电源、USB-TTL、电缸三端 GND 共地
- 禁止带电插拔

### 2.2 软件架构

代码按四层结构组织，各层职责边界明确：

```
交互层  (motor_node.py)        ROS2 终端节点与用户输入解析
驱动层  (motor_driver.py)      控制模式封装、状态结构体定义
协议层  (ins_protocol.py)      二进制帧打包/解包、校验、命令编码
通信层  (ins_uart.py)          串口读写、字节级收发
```

#### 通信层

封装 `pyserial` 实现字节流收发，不涉及任何协议语义。

```python
class InsUART:
    def __init__(self, port, baudrate=921600):
        self.ser = serial.Serial(port, baudrate, timeout=0.05)
    
    def send(self, data: bytes):
        self.ser.write(data)
    
    def recv(self, expected_len: int) -> bytes:
        return self.ser.read(expected_len)
```

#### 协议层

因时自定义二进制帧格式为 `| 帧头 0xAA | ID | 长度 | 命令 | 数据 | 校验和 |`。协议层负责帧的构造与解析，将上层语义指令映射为字节序列。

```python
class InsProtocol:
    CMD_SET_POSITION  = 0x01
    CMD_SET_SPEED     = 0x02
    CMD_SET_FORCE     = 0x03
    CMD_READ_STATUS   = 0x10
    # 共 20+ 条指令编码

    def pack_position_cmd(self, motor_id, position):
        frame = bytearray([0xAA, motor_id, 0x04, self.CMD_SET_POSITION])
        frame.extend(position.to_bytes(2, 'little'))
        frame.append(self._checksum(frame))
        return bytes(frame)

    def unpack_status(self, raw_bytes):
        """按协议字段偏移逐字节解析"""
        pass
```

#### 驱动层

向上层暴露模式控制接口，将通信细节与协议实现完全封装。`MotorController` 对外仅提供与方法名对应的功能调用，调用方无需了解帧结构。

```python
class MotorController:
    def __init__(self, port, motor_id=1):
        self.uart = InsUART(port)
        self.proto = InsProtocol()
        self.motor_id = motor_id

    def move_to_position(self, position):
        cmd = self.proto.pack_position_cmd(self.motor_id, position)
        self.uart.send(cmd)
        resp = self.uart.recv(EXPECTED_LEN)
        return self.proto.unpack_response(resp)

    def set_force_mode(self, force_target):
        # 同模式，不同命令码
        pass

    def read_status(self) -> StatusFeedback:
        pass
```

四层架构的核心收益在于：通信层和协议层可独立替换而不影响驱动层及上层节点。后续由 UART 切换到 Modbus 时，驱动层接口完全保持兼容。

### 2.3 控制模式

6 种控制模式均通过实物电缸完成验证：

| 模式 | 功能 | 应用场景 |
|------|------|---------|
| 定位 | 给定绝对位置，电缸自动规划到位 | 点到点运动 |
| 伺服 | ≥50Hz 高频位置指令，电缸实时跟随 | 轨迹跟踪 |
| 速度 | 以设定速度匀速运行至目标位置停止 | 恒速扫描 |
| 力控 | 动态调节位置以维持受力在设定值 | 恒力接触操作 |
| 电压 | 直接设定电机两端电压 | 底层调试与开环控制 |
| 速度力控 | 设定速度运动，受力超限时自动停止 | 带力保护的夹持 |

### 2.4 ROS2 集成

封装为 ROS2 包 `insmotor_driver`（`ament_cmake_python`），包含：

- `motor_node.py`：终端交互节点，启动后显示模式菜单，键盘输入模式与参数，实时回读并打印状态
- `motor_control.launch.py`：支持命令行指定串口与电机 ID
- Python API：可在任意 ROS2 节点中直接 import 调用

```bash
ros2 launch insmotor_driver motor_control.launch.py port:=/dev/ttyUSB0
```

---

## 三、第二阶段：Modbus 总线联控

### 3.1 切换动机

UART 直连模式下，每台电机独占一个 USB 串口，NUC 主机 USB 接口数量（通常 4 个）构成硬约束。当平台自由度超过该数量时，需要扩展 USB 或切换通信架构。

RS485 总线支持一主多从拓扑，多个设备挂载在同一差分总线上，通过从站地址区分，无需额外 USB 端口，也便于同步控制逻辑的实现。

### 3.2 硬件变更

引入因时 AED-LA-92-12MR1 Modbus RTU 转换器，每台电缸配一个转换器。转换器一侧接入 RS485 总线，另一侧通过 4pin 杜邦线与电缸 D 型接口相连。供电由 DC 8V 直供变为 DC 24V 经转换器降压至 8V。

```
   PC/NUC USB → USB-RS485 模块 → RS485 总线 (A+/B-/GND)
       ├── 转换器 #1 (addr=1) → 电缸 1
       ├── 转换器 #2 (addr=2) → 电缸 2
       └── 转换器 #N (addr=N) → 电缸 N
```

### 3.3 软件变更

分层架构下，切换通信方案仅需重写通信层与协议层。驱动层接口保持兼容。

```
UART 版                             Modbus 版
通信层: ins_uart.py          →      通信层: ins_modbus.py
  (pyserial, 字节流读写)              (minimalmodbus, 寄存器读写)
协议层: ins_protocol.py      →      协议层: ins_modbus_protocol.py
  (自定义帧定义)                       (Modbus 寄存器地址映射)
驱动层: motor_driver.py      →      驱动层: motor_driver.py
  (模式封装与状态解析)                  (API 不变)
```

通信层实现变化：

```python
# UART 版
self.ser.write(frame_bytes)
resp = self.ser.read(expected_len)

# Modbus 版
self.instrument.write_register(0x0020, position)
data = self.instrument.read_registers(0x0021, 6)
```

### 3.4 多电机控制

多台电缸共享同一 RS485 串口，通过从站地址参数区分：

```python
motors = {
    f'motor_{i}': MotorController('/dev/ttyUSB0', slave_address=i)
    for i in range(1, 7)
}
motors['motor_1'].move_to_position(500)
motors['motor_2'].set_force_mode(1000)
```

注意事项：转换器出厂默认从站地址均为 1，需在独立连接时逐一修改为不同地址并写入 Flash 后，再全部接入总线。多设备地址冲突将导致通信失败。

### 3.5 通信速率

转换器默认波特率为 9600 bps。6 电机轮询估算：

- 9600 bps：每电机约 40 ms × 6 ≈ 240 ms/轮，有效更新率约 4 Hz
- 115200 bps：每电机约 3 ms × 6 ≈ 18 ms/轮，有效更新率约 55 Hz

伺服模式要求 ≥50 Hz，9600 无法满足，需在上电初始化时提升至 115200 bps。

---

## 四、文档与可复现性

两个仓库均提供了完整的 README 文档，包括硬件接线图、软件环境配置、编译安装、6 种控制模式的交互式操作说明、Python API 示例、API 速查表、多电机拓扑及故障排查指南。第三方可参照文档独立复现全部实验流程。

---

## 五、代码仓库

| 方案 | 仓库 |
|------|------|
| UART 直连（单电机） | [inspire_motor_uart](https://github.com/LiorenYuhang/inspire_motor_uart) |
| Modbus 总线（多电机） | [inspire_motor_modbus](https://github.com/LiorenYuhang/inspire_motor_modbus) |

---

## 六、后续工作

当前已完成单电机全模式控制与多电机总线通信框架的搭建。后续工作的核心方向是将电缸控制集成到微型并联平台的整体控制架构中：

- **多轴运动学集成**：将电缸驱动层接入平台的逆运动学解算模块，由末端位姿指令直接解算各支链电缸的目标位置，实现关节空间到操作空间的映射
- **同步控制与轨迹规划**：在 RS485 总线基础上实现多轴同步控制策略，开发多项式插值与 S 曲线轨迹规划器，满足平台末端在笛卡尔空间内的平滑运动需求
- **力位混合控制**：利用 LAF 系列力闭环能力，在并联平台末端引入力位混合控制策略，用于精密装配与接触式操作场景
- **平台建模与仿真验证**：建立并联机构的运动学与动力学模型，在 Gazebo/CoppeliaSim 环境中进行仿真验证后，部署至物理平台

---

*以上内容由 Claude Code + DeepSeek 辅助生成*
