# Quickstart: 代码质量改进

## 改进清单

按执行顺序排列：

### 1. 提取共享工具函数
- 创建 `src/engine/graphUtils.ts`
- 从 executor.ts 和 codeGenerator.ts 提取 `buildExecutionTree`, `findRootNodes`, `resolveVariables`
- 两处改为 import 引用

### 2. 修复 ReactFlowProvider 嵌套
- 移除 `FlowCanvas.tsx` 中的 `<ReactFlowProvider>` 包裹
- 保留 `App.tsx` 中的 Provider

### 3. 修复 FlowCanvas 类型
- 替换 `onNodesChange: (changes: any[]) => void` → `OnNodesChange`
- 替换 `onEdgesChange: (changes: any[]) => void` → `OnEdgesChange`

### 4. 修复 export 行为
- `handleExport` 改为调用 `exportFlowToFile` 导出 .pwg JSON
- `handleGenerateCode` 保留生成 Playwright 脚本

### 5. 修复 nodeIdCounter
- 模块级变量 → `useRef`
- 新建/导入项目时重置

### 6. 添加 Error Boundary
- 创建 `ErrorBoundary.tsx`
- 在 App.tsx 中包裹 Canvas 区域

### 7. 添加 Clear 确认
- 在 `handleClear` 中添加 `window.confirm`

### 8. 修复 foreach 变量类型
- executor.ts 中 `el.textContent()` 提取文本而非存 Locator

### 9. 优化 useUndoRedo 深拷贝
- `JSON.parse(JSON.stringify(...))` → `structuredClone(...)`

### 10. 空 catch 块添加日志
- executor.ts 和 PageExplorer.tsx 中空 catch 加 `console.warn`

### 11. (可选) 添加 NodeType 枚举
- `types/nodes.ts` 中添加 `NodeType` 常量对象
- 逐步替换字符串字面量

## 验证方式
1. `npm run build` 通过
2. `npm run dev` 启动无报错
3. 画布拖拽、连接、编辑正常
4. 新建/保存/打开工程正常
5. 执行和代码生成正常
6. Clear 按钮弹出确认框
7. 组件错误不导致白屏
