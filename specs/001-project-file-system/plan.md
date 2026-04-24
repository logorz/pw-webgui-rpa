# Implementation Plan: 项目代码质量改进

**Branch**: `001-project-file-system` | **Date**: 2026-04-25 | **Spec**: `specs/001-project-file-system/spec.md`
**Input**: Feature specification + 代码审查结果

## Summary

基于代码审查发现的 20+ 个改进点，优先修复关键问题（重复 ReactFlowProvider、重复工具函数、Export 行为不一致），同步修复中低优先级问题（类型安全、错误处理、性能优化）。

## Technical Context

**Language/Version**: TypeScript 6.0 / React 19  
**Primary Dependencies**: @xyflow/react 12.10.2, Playwright 1.59.1, TailwindCSS 4, Vite 8  
**Storage**: File System Access API + IndexedDB (最近文件), 降级: 下载/上传  
**Testing**: Playwright E2E (tests/quick-add.spec.ts)  
**Target Platform**: 桌面 Chrome 86+ (SPA Web 应用)  
**Project Type**: 单页 Web 应用 (可视化 RPA 流程编辑器)  
**Performance Goals**: 200 节点流程打开 < 500ms, 自动保存 2 秒防抖  
**Constraints**: 必须支持 File System API 降级路径, 全中文 UI  
**Scale/Scope**: 20+ 组件, 30+ 节点类型, 单用户编辑器

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Justification |
|------|--------|---------------|
| **TypeScript strict: 禁止 `any` 类型** | ⚠️ VIOLATION | FlowCanvas 中 `onNodesChange`/`onEdgesChange` 使用了 `any[]`，需要在改进中修复 |
| **CSS 使用 CSS Modules 替代全局样式** | ⚠️ VIOLATION | App.css 2193 行全局样式，HomePage 使用 Tailwind 而编辑器使用纯 CSS，风格不统一。但本次改进范围不包括 CSS 重构（工作量大且与功能无关），记录为已知技术债 |
| **路由管理使用 react-router-dom** | ⚠️ VIOLATION | 当前使用 `page: 'home' \| 'editor'` 状态切换，但 spec 中已确认此设计（Q1）。当前路由方案满足需求，不做修改 |
| **文件系统操作集中在 projectStorage.ts** | ✅ PASS | 已集中在 `src/utils/projectStorage.ts` |
| **函数有明确参数和返回类型** | ⚠️ PARTIAL | FlowCanvas.tsx 使用 `any[]`，其余文件类型定义良好 |
| **工程文件优先 (Constitution I)** | ✅ PASS | 已使用 .pwg 文件格式 |
| **渐进增强 (Constitution IV)** | ✅ PASS | 已实现双路径 |
| **未保存提示 (Constitution V)** | ✅ PASS | 已实现 beforeunload |
| **关注点分离 (Constitution VI)** | ⚠️ PARTIAL | buildExecutionTree/findRootNodes 在 executor.ts 和 codeGenerator.ts 中重复，需抽取共享 |

### Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| CSS 不统一 (Tailwind + 全局 CSS) | 本次为 Bug 修复 & 架构改进，CSS 重排规模过大 | 增量引入 CSS Modules 需全量改动 20+ 组件，超出本次范围 |
| 非 react-router-dom 路由 | spec Q1 已决策，两个页面无需路由库 | 引入 react-router-dom 增加打包体积，当前方案足够 |

## Project Structure

### Documentation (this feature)

```text
specs/001-project-file-system/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── engine/
│   ├── executor.ts           # 执行引擎 (移除重复函数)
│   ├── codeGenerator.ts      # 代码生成器 (移除重复函数)
│   └── graphUtils.ts         # [NEW] 共享图工具函数
├── components/
│   ├── FlowCanvas.tsx        # 移除 ReactFlowProvider, 修复 any 类型
│   └── ErrorBoundary.tsx     # [NEW] 错误边界组件
├── hooks/
│   └── useUndoRedo.ts        # 优化深拷贝
├── App.tsx                   # 修复 Export, nodeIdCounter, 添加 ErrorBoundary
└── types/
    └── nodes.ts              # 添加 NodeType 枚举
```

**Structure Decision**: 在现有单项目结构上做增量修改，新增 `engine/graphUtils.ts` 和 `components/ErrorBoundary.tsx`，其余文件在原有基础上修改。
