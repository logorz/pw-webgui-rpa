# Data Model: 代码质量改进

## Entity: `graphUtils` (共享图工具)

提取 `executor.ts` 和 `codeGenerator.ts` 中共用的图遍历工具函数。

```typescript
// src/engine/graphUtils.ts

interface BranchMap {
  trueBranch: string[];
  falseBranch: string[];
  bodyBranch: string[];
  doneBranch: string[];
  tryBranch: string[];
  catchBranch: string[];
  default: string[];
}

function buildExecutionTree(
  nodes: Node<FlowNodeData>[],
  edges: Edge[]
): Map<string, BranchMap>

function findRootNodes(
  nodes: Node<FlowNodeData>[],
  edges: Edge[]
): Node<FlowNodeData>[]

function resolveVariables(
  params: Record<string, string | number | boolean>,
  variables: Record<string, string>
): Record<string, string | number | boolean>
```

**变更**: 从 executor.ts 和 codeGenerator.ts 移除上述重复函数，改为统一引用 `graphUtils.ts`。

---

## Entity: `NodeType` 枚举

```typescript
// src/types/nodes.ts (新增)
export const NodeType = {
  OPEN_BROWSER: 'open',
  GOTO: 'goto',
  CLICK: 'click',
  FILL: 'fill',
  TYPE: 'type',
  PRESS: 'press',
  CHECKBOX: 'checkbox',
  SELECT_OPTION: 'selectOption',
  UPLOAD: 'upload',
  HOVER: 'hover',
  SCREENSHOT: 'screenshot',
  WAIT_FOR_SELECTOR: 'waitForSelector',
  WAIT_FOR_TIMEOUT: 'waitForTimeout',
  WAIT_FOR_URL: 'waitForUrl',
  WAIT_FOR_LOAD_STATE: 'waitForLoadState',
  CLOSE: 'close',
  SWITCH_PAGE: 'switchPage',
  IF: 'if',
  WHILE: 'while',
  FOREACH: 'foreach',
  TRY_CATCH: 'tryCatch',
  BREAK_LOOP: 'breakLoop',
  CALL_SUBFLOW: 'callSubflow',
  LOG: 'log',
  SET_VARIABLE: 'setVariable',
  EXTRACT: 'extract',
  EVALUATE: 'evaluate',
  ASSERT_VISIBLE: 'assertVisible',
  ASSERT_TEXT: 'assertText',
  ASSERT_URL: 'assertUrl',
  ASSERT_TITLE: 'assertTitle',
  ASSERT_ELEMENT_COUNT: 'assertElementCount',
  ASSERT_ATTRIBUTE: 'assertAttribute',
  SAVE_AUTH: 'saveAuth',
  LOAD_AUTH: 'loadAuth',
  HANDLE_DIALOG: 'handleDialog',
  DOWNLOAD: 'download',
  ROUTE_MOCK: 'routeMock',
  ROUTE_ABORT: 'routeAbort',
  WAIT_FOR_RESPONSE: 'waitForResponse',
} as const;

export type NodeType = typeof NodeType[keyof typeof NodeType];
```

---

## Entity: `ErrorBoundary`

```typescript
// src/components/ErrorBoundary.tsx
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}
```

---

## Entity: 修改范围摘要

| 文件 | 修改类型 | 变更内容 |
|------|---------|---------|
| src/engine/graphUtils.ts | **新增** | 提取 buildExecutionTree, findRootNodes, resolveVariables |
| src/engine/executor.ts | **修改** | 导入 graphUtils, 删除重复函数, 修复 foreach 变量类型 |
| src/engine/codeGenerator.ts | **修改** | 导入 graphUtils, 删除重复函数 |
| src/types/nodes.ts | **修改** | 添加 NodeType 枚举 |
| src/components/FlowCanvas.tsx | **修改** | 移除 ReactFlowProvider, 修复 any 类型 |
| src/components/ErrorBoundary.tsx | **新增** | 错误边界组件 |
| src/App.tsx | **修改** | 修复 export, nodeIdCounter, ErrorBoundary, Clear确认 |
| src/hooks/useUndoRedo.ts | **修改** | JSON.parse → structuredClone |
