# Playwright 可视化流程编辑器 Spec

## Why
目前使用 Playwright 进行浏览器自动化需要编写大量代码，对非技术人员门槛较高。通过可视化拖拽方式构建自动化流程，可以大幅降低使用门槛，让更多人能够快速搭建网页自动化任务。

## What Changes
- 新增可视化流程编辑器页面，支持拖拽式构建 Playwright 自动化流程
- 定义可拖拽的指令节点系统，覆盖常用 Playwright 操作
- 实现节点连接与流程控制（顺序执行、条件分支、循环）
- 实现流程配置持久化存储（JSON 格式）
- 实现流程执行引擎，将可视化流程转换为 Playwright 代码并运行
- 提供执行结果展示与日志输出

## Impact
- 新增能力：可视化编辑、流程执行、节点管理
- 新增页面：流程编辑器主页面
- 新增模块：节点定义、流程引擎、执行器

## ADDED Requirements

### Requirement: 节点系统
The system SHALL 提供一组可拖拽的指令节点，每个节点对应一个 Playwright 操作或控制逻辑。

#### Scenario: 浏览器基础操作节点
- **WHEN** 用户从左侧节点面板拖拽节点到画布
- **THEN** 画布上显示对应的节点，包含可配置的参数

支持的节点类型：
- `open` - 打开浏览器（参数：url, browserType, headless）
- `goto` - 导航到页面（参数：url, waitUntil）
- `click` - 点击元素（参数：selector, timeout）
- `fill` - 填充输入框（参数：selector, value, submit）
- `type` - 输入文本（参数：selector, text, delay）
- `screenshot` - 截图（参数：path, fullPage）
- `waitForSelector` - 等待元素（参数：selector, timeout, state）
- `waitForTimeout` - 固定等待（参数：timeout）
- `close` - 关闭浏览器

#### Scenario: 流程控制节点
- **WHEN** 用户需要条件判断或循环逻辑
- **THEN** 可以使用控制流节点实现复杂逻辑

支持的控制节点：
- `if` - 条件判断（参数：condition 表达式，如 `selectorExists`）
- `while` - 循环执行（参数：condition, maxIterations）
- `foreach` - 遍历元素列表（参数：selector）

#### Scenario: 变量与数据节点
- **WHEN** 用户需要在步骤间传递数据
- **THEN** 可以使用变量节点存储和读取数据

支持的变量节点：
- `setVariable` - 设置变量（参数：name, value）
- `getVariable` - 读取变量（参数：name）
- `extract` - 提取页面数据（参数：selector, attribute）

### Requirement: 画布交互
The system SHALL 提供可视化画布，支持节点的拖拽、连接和配置。

#### Scenario: 节点拖拽
- **WHEN** 用户从左侧节点面板拖拽节点到画布
- **THEN** 节点被放置到画布上，显示节点类型和默认参数

#### Scenario: 节点连接
- **WHEN** 用户点击节点的输出端口并拖拽到另一个节点的输入端口
- **THEN** 两个节点之间建立连接，表示执行顺序

#### Scenario: 节点配置
- **WHEN** 用户双击节点或点击配置按钮
- **THEN** 弹出配置面板，可编辑节点参数

#### Scenario: 画布操作
- **WHEN** 用户使用鼠标操作画布
- **THEN** 支持缩放（滚轮）、平移（拖拽空白处）、框选、删除节点

### Requirement: 流程执行引擎
The system SHALL 将可视化流程转换为可执行的 Playwright 代码并运行。

#### Scenario: 代码生成
- **WHEN** 用户点击"生成代码"按钮
- **THEN** 系统根据画布上的节点和连接，生成对应的 Playwright JavaScript/TypeScript 代码

#### Scenario: 流程执行
- **WHEN** 用户点击"运行"按钮
- **THEN** 系统按顺序执行节点，在浏览器中完成自动化操作

#### Scenario: 执行日志
- **WHEN** 流程执行过程中
- **THEN** 实时显示执行日志，包括每个步骤的成功/失败状态、耗时、错误信息

### Requirement: 流程持久化
The system SHALL 支持保存和加载流程配置。

#### Scenario: 保存流程
- **WHEN** 用户点击"保存"按钮
- **THEN** 将画布上的节点和连接序列化为 JSON 并保存到本地文件

#### Scenario: 加载流程
- **WHEN** 用户点击"加载"按钮或选择历史流程
- **THEN** 从 JSON 文件恢复画布状态

### Requirement: 执行结果展示
The system SHALL 展示流程执行的结果和状态。

#### Scenario: 执行状态
- **WHEN** 流程执行时
- **THEN** 高亮当前执行的节点，显示整体进度

#### Scenario: 结果查看
- **WHEN** 流程执行完成
- **THEN** 显示执行结果摘要，包括成功/失败步骤数、总耗时、截图预览
