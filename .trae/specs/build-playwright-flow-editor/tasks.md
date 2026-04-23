# Tasks

- [ ] Task 1: 初始化项目与安装依赖
  - [ ] SubTask 1.1: 初始化 Vite + React + TypeScript 项目
  - [ ] SubTask 1.2: 安装 React Flow 依赖
  - [ ] SubTask 1.3: 安装 UI 组件库（shadcn/ui 或 Ant Design）
  - [ ] SubTask 1.4: 安装 Playwright 依赖

- [ ] Task 2: 定义节点类型系统
  - [ ] SubTask 2.1: 创建节点类型定义（NodeType）
  - [ ] SubTask 2.2: 定义浏览器基础操作节点（open, goto, click, fill, type, screenshot, waitForSelector, waitForTimeout, close）
  - [ ] SubTask 2.3: 定义流程控制节点（if, while, foreach）
  - [ ] SubTask 2.4: 定义变量与数据节点（setVariable, getVariable, extract）
  - [ ] SubTask 2.5: 创建节点参数配置 Schema

- [ ] Task 3: 构建左侧节点面板
  - [ ] SubTask 3.1: 创建节点分类（浏览器操作、流程控制、变量数据）
  - [ ] SubTask 3.2: 实现可拖拽节点项
  - [ ] SubTask 3.3: 添加节点图标和描述

- [ ] Task 4: 实现可视化画布
  - [ ] SubTask 4.1: 集成 React Flow 画布组件
  - [ ] SubTask 4.2: 实现节点放置（从面板拖拽到画布）
  - [ ] SubTask 4.3: 实现节点连接（输出端口到输入端口）
  - [ ] SubTask 4.4: 实现画布操作（缩放、平移、框选、删除）
  - [ ] SubTask 4.5: 自定义节点样式（不同颜色区分节点类型）

- [ ] Task 5: 实现节点配置面板
  - [ ] SubTask 5.1: 创建配置面板 UI
  - [ ] SubTask 5.2: 根据节点类型动态渲染表单字段
  - [ ] SubTask 5.3: 实现参数验证

- [ ] Task 6: 实现流程执行引擎
  - [ ] SubTask 6.1: 将画布节点转换为执行树
  - [ ] SubTask 6.2: 实现顺序执行逻辑
  - [ ] SubTask 6.3: 实现条件分支执行（if）
  - [ ] SubTask 6.4: 实现循环执行（while, foreach）
  - [ ] SubTask 6.5: 集成 Playwright 执行器

- [ ] Task 7: 实现代码生成器
  - [ ] SubTask 7.1: 将节点转换为 Playwright JavaScript 代码
  - [ ] SubTask 7.2: 支持代码预览和复制

- [ ] Task 8: 实现流程持久化
  - [ ] SubTask 8.1: 实现保存流程为 JSON
  - [ ] SubTask 8.2: 实现从 JSON 加载流程

- [ ] Task 9: 实现执行结果展示
  - [ ] SubTask 9.1: 实现执行日志面板
  - [ ] SubTask 9.2: 实现节点高亮（执行中、成功、失败）
  - [ ] SubTask 9.3: 实现结果摘要展示

- [ ] Task 10: 完善 UI 与交互
  - [ ] SubTask 10.1: 实现顶部工具栏（保存、加载、运行、生成代码）
  - [ ] SubTask 10.2: 实现整体布局（面板、画布、日志）
  - [ ] SubTask 10.3: 添加加载状态和错误处理

# Task Dependencies
- Task 2 依赖 Task 1
- Task 3 依赖 Task 2
- Task 4 依赖 Task 3
- Task 5 依赖 Task 4
- Task 6 依赖 Task 4
- Task 7 依赖 Task 4
- Task 8 依赖 Task 4
- Task 9 依赖 Task 6
- Task 10 依赖 Task 5, Task 6, Task 7, Task 8, Task 9
