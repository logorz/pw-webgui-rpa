# Contract: graphUtils (共享图工具)

## 职责
提供图遍历和工具函数，供 executor (执行引擎) 和 codeGenerator (代码生成器) 共享使用。

## 导出函数

### `buildExecutionTree(nodes, edges) → Map<string, BranchMap>`
根据节点和边构建执行树（children map），支持以下分支类型：
- **default**: 普通节点的后续节点
- **trueBranch/falseBranch**: if 节点的条件分支
- **bodyBranch/doneBranch**: while/foreach 的循环体/完成分支
- **tryBranch/catchBranch/doneBranch**: tryCatch 的尝试/错误/最终分支

### `findRootNodes(nodes, edges) → Node<FlowNodeData>[]`
找出没有入边的根节点（流程入口节点）。

### `resolveVariables(params, variables) → Record<string, string | number | boolean>`
将参数中的 `${varName}` 模式替换为 variables 中的实际值。

## 依赖
- `@xyflow/react` (Node, Edge 类型)
- `../types/nodes` (FlowNodeData)

## 不变式
- 输入 nodes 和 edges 不可变（纯函数）
- 不修改外部状态
- 不依赖于 React 或浏览器 API
