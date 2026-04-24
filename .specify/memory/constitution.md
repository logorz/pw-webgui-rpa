# Playwright CLI GUI Constitution

## Core Principles

### I. 工程文件优先
所有流程数据必须存储在可导出的工程文件（`.pwg` JSON）中。localStorage 仅作为会话级缓存和最近文件列表使用，不能作为主要存储方案。工程文件必须可读、可 diff、可版本控制。

### II. 所见即所得
用户添加/删除/修改节点后，预览面板必须即时反映变化。画布上的每个节点都代表一个可执行的 Playwright 操作，配置面板的参数变化应实时同步到代码预览。

### III. 测试驱动
所有新的持久化功能必须有完整的边界测试：
- 空工程文件的保存和加载
- 大流程（100+ 节点）的序列化/反序列化
- 损坏文件的错误提示
- 并发保存冲突处理

### IV. 渐进增强
File System Access API 是现代浏览器的能力，但不是所有环境都支持。核心功能（新建、打开、保存、导出）必须同时提供两个路径：
- **原生 API 路径**：`showOpenFilePicker` / `showSaveFilePicker`（Chrome 86+）
- **Fallback 路径**：`<input type="file">` / Blob 下载（所有浏览器）

### V. 用户数据安全
- 执行服务器（:3210）不得存储任何用户数据
- 工程文件是用户数据的唯一来源
- 自动保存间隔不超过 5 秒防抖
- 关闭或切换页面时必须有未保存提示

### VI. 关注点分离
- `persistence.ts` / `projectStorage.ts` — 仅负责文件和存储操作
- `App.tsx` — 负责 UI 状态和用户交互
- 应用列表管理页独立于编辑页面，通过路由切换

## 技术标准

### 代码质量
- TypeScript strict mode：禁止 `any` 类型（执行服务器迁移到 TS 后同样适用）
- 新文件必须有类型定义（`interface` / `type`）
- 函数必须有明确的参数和返回类型
- CSS 使用 CSS Modules（`*.module.css`）替代全局样式

### 架构规范
- 文件系统操作集中在 `src/utils/projectStorage.ts` 中
- 路由管理使用 React Router（`react-router-dom`）
- 应用列表页与编辑器页通过路由解耦
- 编辑器页面引用当前工程文件句柄，应用列表页引用已保存文件列表

### 持久化格式（`.pwg` 文件）

```typescript
interface ProjectFile {
  format: 'playwright-cli-gui';       // 格式标识
  version: string;                     // 语义化版本 "1.0", "1.1"
  name: string;                        // 项目名称
  description?: string;                // 可选描述
  createdAt: string;                   // ISO 8601
  updatedAt: string;                   // ISO 8601
  nodes: Node<FlowNodeData>[];         // 流程节点
  edges: Edge[];                       // 连线
  viewport?: { x: number; y: number; zoom: number };  // 画布视口
  settings?: {                         // 全局设置
    headless?: boolean;
    baseUrl?: string;
    defaultTimeout?: number;
  };
  variables?: Record<string, string>;  // 全局变量
}
```

## 决策框架

当在开发中遇到选择时，按以下优先级判断：

1. **用户数据的可移植性是否受影响？** — 如果某个选择导致用户无法自由地移动、分享、版本控制他们的工程文件，这个选择就是错误的。
2. **是否满足渐进增强？** — 如果只实现了原生 API 路径而没有 fallback，需要补充。
3. **是否最小化改动了现有代码？** — 优先做增量修改，保持 `persistence.ts` 的 API 兼容性，再逐步替换。
4. **测试覆盖了吗？** — 新的持久化函数必须有对应的测试用例。

## 治理

本宪法约束所有与持久化、应用管理和编辑体验相关的开发决策。修改宪法需要明确记录修改原因，并经过确认。

**Version**: 1.0.0 | **Ratified**: 2025-04-25 | **Last Amended**: 2025-04-25
