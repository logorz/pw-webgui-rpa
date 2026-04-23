# pw-webgui-rpa

基于 React Flow 和 Playwright 的可视化 RPA 流程编辑器。

## 功能特性

- ✅ **拖拽式节点编辑** - 15 种预定义节点类型，包括浏览器操作、流程控制和变量操作
- ✅ **真实 Playwright 执行** - 支持模拟执行和真实浏览器执行
- ✅ **代码生成** - 一键生成可运行的 Playwright JavaScript 代码
- ✅ **条件控制** - 支持 if/while/foreach 节点
- ✅ **工作流保存** - 本地存储和 JSON 文件导入/导出
- ✅ **撤销/重做** - 支持 50 步历史记录
- ✅ **实时执行日志** - 可视化执行过程和结果
- ✅ **服务状态检测** - 自动降级为模拟模式

## 节点类型

### 浏览器操作
- 打开浏览器 - 启动浏览器并可选导航到 URL
- 跳转页面 - 导航到指定 URL
- 点击元素 - 点击页面上的元素
- 填充输入 - 填充输入框内容
- 输入文本 - 模拟键盘输入
- 截图 - 保存页面截图
- 等待元素 - 等待元素出现
- 等待时间 - 固定等待时长
- 关闭浏览器 - 关闭浏览器实例

### 流程控制
- 条件判断 - if/else 分支
- 循环执行 - while 循环
- 遍历元素 - foreach 遍历选择器

### 变量数据
- 设置变量 - 定义变量
- 提取内容 - 从页面提取内容到变量

## 快速开始

```bash
# 安装依赖
npm install

# 安装 Playwright 浏览器（首次使用）
npx playwright install chromium

# 启动执行服务器
npm run server

# 启动前端开发服务器（新终端）
npm run dev

# 或同时启动前端和服务器
npm run dev:all
```

访问 http://localhost:5173 即可使用编辑器。

## 使用流程

1. 从左侧节点面板拖拽节点到画布
2. 双击节点配置参数
3. 连接节点创建工作流
4. 点击"运行"按钮执行流程
5. 点击"生成代码"查看 Playwright 代码

## 项目结构

```
pw-webgui-rpa/
├── src/
│   ├── components/      # React 组件
│   │   ├── NodePanel.tsx
│   │   ├── FlowCanvas.tsx
│   │   ├── CustomNode.tsx
│   │   ├── NodeConfigPanel.tsx
│   │   ├── LogPanel.tsx
│   │   ├── Toolbar.tsx
│   │   └── CodePreview.tsx
│   ├── engine/          # 执行引擎
│   │   ├── executor.ts
│   │   └── codeGenerator.ts
│   ├── hooks/           # 自定义 Hooks
│   │   └── useUndoRedo.ts
│   ├── types/           # 类型定义
│   │   └── nodes.ts
│   ├── utils/           # 工具函数
│   │   └── persistence.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── server/
│   └── execution-server.mjs  # Playwright 执行服务
└── package.json
```

## 技术栈

- React 19
- Vite
- TypeScript
- @xyflow/react (React Flow)
- Tailwind CSS
- Playwright
- Lucide React (图标)

## 许可证

MIT
