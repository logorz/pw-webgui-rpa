---

description: "Task list for code quality improvements across the project"
---

# Tasks: 项目代码质量改进

**Input**: Design documents from `/specs/001-project-file-system/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/graphUtils.md, quickstart.md

**Tests**: No test tasks — this is a code quality improvement pass, not a new feature.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which improvement group this task belongs to
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: No setup needed — project already initialized, build tooling configured.

All tasks are code modifications on the existing codebase.

---

## Phase 2: Foundational (Shared Infrastructure)

**Purpose**: Extract shared utilities that unblock downstream refactoring.

**⚠️ CRITICAL**: T003 must complete before T010/T011 can start.

- [ ] T003 Create `src/engine/graphUtils.ts` with `buildExecutionTree`, `findRootNodes`, `resolveVariables` extracted from executor.ts
- [ ] T004 [P] Add `NodeType` const object and type in `src/types/nodes.ts` for all 40+ node types

**Checkpoint**: Shared utilities ready

---

## Phase 3: Core Architecture Fixes

**Goal**: Fix critical architectural issues — ReactFlowProvider nesting, duplicate code, Export behavior, nodeIdCounter.

**Independent Test**: `npm run dev` starts without errors, save/open flow cycles work correctly.

- [ ] T005 Remove nested `<ReactFlowProvider>` from `src/components/FlowCanvas.tsx` (line ~108-113), keep only the one in `App.tsx`
- [ ] T006 Create `src/components/ErrorBoundary.tsx` as a class component with `componentDidCatch` and `getDerivedStateFromError`
- [ ] T007 [P] Fix `handleExport` in `src/App.tsx` — change from `generatePlaywrightCode` to `exportFlowToFile` / `downloadFlowFile` from `utils/persistence.ts`
- [ ] T008 Fix `nodeIdCounter` in `src/App.tsx` — change from module-level `let` to `useRef`, reset on new/import/clear

**Checkpoint**: Core architecture fixes verified — app starts and basic operations work

---

## Phase 4: Type Safety & Robustness

**Goal**: Fix `any` types, add confirmation dialogs, add logging to empty catches.

**Independent Test**: TypeScript build (`npm run build`) passes without errors.

- [ ] T009 [P] Fix `FlowCanvas.tsx` prop types — replace `(changes: any[]) => void` with `OnNodesChange` / `OnEdgesChange` from `@xyflow/react`
- [ ] T010 Replace duplicate `buildExecutionTree`/`findRootNodes` in `src/engine/executor.ts` with imports from `./graphUtils`
- [ ] T011 Replace duplicate `buildExecutionTree`/`findRootNodes` in `src/engine/codeGenerator.ts` with imports from `./graphUtils`
- [ ] T012 [P] Wrap ErrorBoundary around canvas and PageExplorer areas in `src/App.tsx`
- [ ] T013 [P] Add `window.confirm('确定要清空所有节点吗？此操作不可撤销。')` to `handleClear` in `src/App.tsx`
- [ ] T014 [P] Add `console.warn` logging to all empty `catch {}` blocks in `src/engine/executor.ts` (5 locations)
- [ ] T015 [P] Add `console.warn` logging to empty `catch {}` blocks in `src/components/PageExplorer.tsx` (2 locations)

**Checkpoint**: Type-safe, robust — all empty catches logged, clear operations confirmed

---

## Phase 5: Bug Fix & Performance

**Goal**: Fix foreach variable type issue, optimize undo/redo deep clone.

**Independent Test**: foreach nodes execute correctly in real execution mode; undo/redo works on large flows.

- [ ] T016 Fix `foreach` variable type in `src/engine/executor.ts` — replace `ctx.variables[varName] = el` with `el.textContent()` text extraction
- [ ] T017 Replace `JSON.parse(JSON.stringify(...))` with `structuredClone(...)` in `src/hooks/useUndoRedo.ts`

**Checkpoint**: All 11 improvements implemented

---

## Phase 6: Verification

**Purpose**: Verify all changes work correctly.

- [ ] T018 Verify `npm run build` compiles without TypeScript errors
- [ ] T019 Verify `npm run dev` starts and app loads without console errors
- [ ] T020 Quick smoke test: create nodes, connect, save, load, export, clear

**Checkpoint**: All improvements verified

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies
- **Phase 2 (Foundational)**: No dependencies — T003, T004 can run in parallel
- **Phase 3 (Core Fixes)**: T005-008 are independent of each other — all can be [P]
- **Phase 4 (Type Safety)**: T009-015 independent except T010/T011 depend on T003
- **Phase 5 (Bug Fix)**: T016-T017 independent of each other
- **Phase 6 (Verification)**: Depends on all previous phases

### Critical Path

```
T003 (graphUtils) ──→ T010, T011 (executor/codeGenerator imports)
                        ↕
T005-009, T012-017 ─── All independent of each other
                        ↕
T018-020 (Verification)
```

### Parallel Opportunities

- All tasks marked [P] can run in parallel (different files, no cross-dependencies)
- T009 (FlowCanvas types) + T013 (Clear confirm) + T014 (empty catches executor) + T015 (empty catches PageExplorer) — all independent, 4 files
- T005 (Provider removal) + T007 (Export fix) + T008 (nodeIdCounter) — all in different sections of the codebase

---

## Implementation Strategy

### Recommended Order (Sequential, most impactful first)

1. T003 — graphUtils.ts (unblocks T010, T011)
2. T005 — Remove nested ReactFlowProvider (critical)
3. T006 — ErrorBoundary component
4. T007 — Fix Export behavior
5. T008 — Fix nodeIdCounter
6. T009 — Fix FlowCanvas types
7. T010 — executor.ts → graphUtils imports
8. T011 — codeGenerator.ts → graphUtils imports
9. T012 — Wrap ErrorBoundary in App.tsx
10. T013 — Clear confirmation dialog
11. T014 + T015 — Empty catch logs
12. T016 — foreach variable fix
13. T017 — structuredClone
14. T018-020 — Verification

### Batch Strategy (Parallel execution)

```bash
# Batch 1: Foundational
Task: "Create graphUtils.ts"
Task: "Add NodeType enum"

# Batch 2: Core fixes (all independent)
Task: "Remove ReactFlowProvider from FlowCanvas.tsx"
Task: "Create ErrorBoundary.tsx"
Task: "Fix handleExport in App.tsx"
Task: "Fix nodeIdCounter in App.tsx"

# Batch 3: Type & robustness (all independent)
Task: "Fix FlowCanvas types"
Task: "Replace executor.ts imports"
Task: "Replace codeGenerator.ts imports"
Task: "Add Clear confirm in App.tsx"
Task: "Add empty catch logs in executor.ts"
Task: "Add empty catch logs in PageExplorer.tsx"

# Batch 4: Remaining fixes
Task: "Wrap ErrorBoundary in App.tsx"
Task: "Fix foreach variable in executor.ts"
Task: "Replace JSON.parse with structuredClone in useUndoRedo.ts"

# Batch 5: Verify
Task: "npm run build && npm run dev"
```

---

## Summary

| Category | Task Count | [P] Tasks | Est. Difficulty |
|----------|-----------|-----------|-----------------|
| Foundational | 2 | 1 | Medium |
| Core Architecture | 4 | 3 | Low-Medium |
| Type Safety | 7 | 6 | Low |
| Bug Fix & Perf | 2 | 1 | Low-Medium |
| Verification | 3 | 0 | Low |
| **Total** | **18** | **11** | |

### Key Points

- **11 of 18 tasks are parallelizable** — marked [P]
- **No new dependencies needed** — all changes use existing APIs
- **Minimal risk** — most changes are deletions or replacements, not new logic
- **Fast to verify** — `npm run build` catches type errors, manual smoke test catches behavioral issues
