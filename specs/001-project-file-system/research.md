# Research: 项目代码质量改进

## Research Tasks

### RT-1: ReactFlowProvider 嵌套问题
**Investigation**: 确认 @xyflow/react 中 ReactFlowProvider 嵌套的影响。

**Findings**:
- `App.tsx:537` 和 `FlowCanvas.tsx:110` 各有一个 `<ReactFlowProvider>`
- React Flow 使用 React Context 来共享 ReactFlow 实例状态
- 嵌套 Provider 不会报错，但内部 hooks（useNodesState, useEdgesState, useReactFlow）会在最近的 Provider 祖先中查找
- FlowCanvas 内创建的 Provider 会遮蔽 App.tsx 中创建的 Provider，可能导致跨组件状态不一致
- 如果后续在 App 层级使用 `useReactFlow()`，会因为找不到正确 Provider 而失败

**Decision**: 移除 `FlowCanvas.tsx` 中的 `<ReactFlowProvider>`，只在 `App.tsx` 保留一个。

**Alternatives considered**: 
- 两个 Provider 都保留：无意义且增加混淆，否决
- 移除 App.tsx 中的 Provider 保留 FlowCanvas 中的：限制 App 层使用 React Flow API，否决

---

### RT-2: buildExecutionTree/findRootNodes 重复
**Investigation**: 确认两处代码是否完全一致。

**Findings**:
- `executor.ts:567-614` 的 `buildExecutionTree()` 与 `codeGenerator.ts:501-553` 的 `buildExecutionTree()` 函数签名、逻辑、实现完全一致
- `executor.ts:611-614` 的 `findRootNodes()` 与 `codeGenerator.ts:550-553` 的 `findRootNodes()` 完全一致
- 如果修改一处的分支逻辑，必须同步修改另一处
- 两个函数都不依赖于所在类的实例状态（不访问 `this`）

**Decision**: 提取到共享模块 `src/engine/graphUtils.ts`，两处统一引用。

**Alternatives considered**:
- 复制粘贴：当前做法，维护成本高，否决
- 在其中一个文件中导出供另一个引用：引入循环依赖风险，否决
- 抽取到独立的工具模块：最干净的方式，采纳

---

### RT-3: handleExport 行为不一致
**Investigation**: 确认 handleExport 的实际行为与预期。

**Findings**:
- `App.tsx:367-372` 中 `handleExport` 调用 `generatePlaywrightCode`，与 `handleGenerateCode` 完全一致
- Toolbar 上 "导出" 按钮预期行为应是导出 `.pwg` 格式的工程文件（JSON 格式），而非生成 Playwright 脚本
- spec.md 中 FR-012 和 FR-013 指出导出应生成 `.spec.ts` 测试脚本
- 但 spec.md 中 User Story 4 提到"导出为 Playwright 脚本"是通过 Code Preview 面板实现的
- "Export" 按钮（导出图标）在 toolbar 中和 "Generate Code"（代码图标）作为两个独立按钮，Export 应导出文件，Generate Code 应生成代码

**Decision**: 修改 `handleExport` 调用 `exportFlowToFile` 导出 `.pwg` JSON 文件（或 downloadFlowFile）。

**Alternatives considered**:
- 合并 Export 和 Generate Code：用户需要区分"导出文件"和"生成代码"，否决
- Export 什么都不做：退化用户体验，否决
- Export 导出 .pwg 文件：符合用户预期，采纳

---

### RT-4: nodeIdCounter 不重置
**Investigation**: `App.tsx:26` 的模块级变量在 SPA 生命周期内持续增长。

**Findings**:
- `let nodeIdCounter = 0` 定义在 App 模块顶层，非 React 状态
- 创建新项目、导入项目、清空画布后 `nodeIdCounter` 不会归零
- 极端情况下，经过大量操作后可能超过 `Number.MAX_SAFE_INTEGER` (9e15)
- JavaScript 的 number 是 float64，超过 2^53 时精度会丢失
- 虽然实际使用中几乎不可能达到上限，但语义上不干净

**Decision**: 改为 `useRef(0)` + `getNodeId()` 函数中使用 ref，创建新项目时重置到 0。

**Alternatives considered**:
- 使用 Date.now() + 随机数：可保证唯一性但不可读，且对于调试不友好
- 保持现状：不干净，否决
- 使用 useRef + 重置：简洁且可预测，采纳

---

### RT-5: foreach 变量类型问题
**Investigation**: `executor.ts:219` 中存储 Playwright Locator 对象到变量。

**Findings**:
- 代码中 `ctx.variables[varName] = el` 存储 Playwright 的 `Locator` 对象
- `resolveVariables()` (line 303-318) 使用 `value.replace(/\$\{(\w+)\}/g, ...)` 做字符串替换
- JavaScript 对象 toString() 会得到 `"[object Object]"`
- 在 `codeGenerator.ts:646-647` 中，生成的代码 `for (const ${varName} of _elements)` 是正确的，因为生成的代码直接在 Playwright 上下文中运行

**Decision**: 执行器中使用 `el.textContent()` 将元素内容提取为字符串存储到变量，而非直接存储 Locator 对象。同时在代码生成器中使用 `el.innerText()` 获取文本内容。

**Alternatives considered**:
- 存储 Locator 并序列化：Locator 无法被有意义地序列化，否决
- 修改 resolveVariables 支持对象：破坏了变量的字符串语义，否决
- 提取文本内容：与用户预期一致（用户期望遍历时获取文本），采纳

---

### RT-6: JSON.parse(JSON.stringify()) 替代方案
**Investigation**: 浏览器和 React 生态的深拷贝选项。

**Findings**:
- `structuredClone()` 是 Web API 标准，所有现代浏览器（Chrome 98+, Firefox 94+, Safari 15.4+）都支持
- 比 JSON.parse/stringify 的优势：
  - 保留 `undefined`（JSON 会丢弃）
  - 支持 Date、Map、Set、RegExp、Blob 等类型
  - 性能更好（V8 原生实现）
  - 支持循环引用
- 在 React Flow 场景中，nodes/edges 数据通常是可序列化的（无 Date/Map 等）
- 但 `structuredClone` 更加语义化

**Decision**: 在 `useUndoRedo.ts` 中将 `JSON.parse(JSON.stringify(...))` 替换为 `structuredClone(...)`。

**Alternatives considered**:
- 使用 immer 库：太重，仅为深拷贝引入库不合理，否决
- 保持现状：类型丢失风险，否决
- structuredClone：标准 API、更安全、更快，采纳

---

### RT-7: Error Boundary 方案
**Investigation**: React Error Boundary 在 React 19 中的使用方式。

**Findings**:
- React Error Boundary 仍然是 class component 模式（React 19 未改变）
- 需要实现 `componentDidCatch` 和 `getDerivedStateFromError`
- 可为 Canvas、PageExplorer 分别包裹 Error Boundary
- 显示"出现错误，请刷新重试"的友好提示

**Decision**: 创建 `ErrorBoundary.tsx` class component，在 Canvas 和 PageExplorer 区域包裹。

**Alternatives considered**:
- react-error-boundary 库：轻量但额外依赖，否决
- 不添加 Error Boundary：任何组件 crash 导致白屏，否决
- 自定义 ErrorBoundary：零依赖、完全控制，采纳

---

### RT-8: FlowCanvas any 类型
**Investigation**: 确认 @xyflow/react 导出的正确类型。

**Findings**:
- `@xyflow/react` 导出 `OnNodesChange` 和 `OnEdgesChange` 类型
- 源码位置：`@xyflow/react/dist/types` 
- 应使用 `OnNodesChange<Node<FlowNodeData>[]>` 而非 `(changes: any[]) => void`

**Decision**: 替换 `any[]` 为 `OnNodesChange` / `OnEdgesChange` 类型。

---

### RT-9: 空 catch 块
**Investigation**: 检查所有空 catch 的影响。

**Findings**:
- executor.ts 中 5 处空 catch（lines 115, 129, 163, 237, 266）
- PageExplorer.tsx 中 2 处空 catch（lines 237, 266）
- 主要是在 cleanup/close 操作中的静默异常处理
- 至少应 `console.warn` 记录

**Decision**: 所有空 catch 块添加 `console.warn` 日志（不影响业务逻辑的静默处理）。

---

### RT-10: Clear 无确认
**Investigation**: 检查 handleClear 安全风险。

**Findings**:
- `App.tsx:388-392` 直接清空节点和连线，无二次确认
- Toolbar 中 Clear 按钮样式为 danger（红色）
- 无未保存修改提示
- 用户在不小心点击时可能丢失工作

**Decision**: 添加 `window.confirm('确定要清空所有节点吗？此操作不可撤销。')`。

---

### RT-11: 节点类型魔数
**Investigation**: 统计项目中出现的字符串类型引用。

**Findings**:
- 在 executor.ts、codeGenerator.ts、App.tsx 中大量使用 `node.data.type === 'if'`、`'while'`、`'foreach'` 等字符串
- 拼写错误无法在编译期发现（如 `'foreache'`）
- IDE 无法提供自动补全和跳转

**Decision**: 在 `types/nodes.ts` 中添加 `NodeType` 字符串枚举，逐步替换散落的字符串字面量。
