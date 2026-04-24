# Implementation Tasks: 工程文件系统与应用管理

## Phase 1: 类型定义与核心存储

- [ ] 1.1 [P] 创建 `src/types/project.ts` — 定义 ProjectFile、RecentFile、AppPage 等核心类型
  - 定义 `ProjectFile` 接口（format, version, name, nodes, edges, viewport, settings, variables）
  - 定义 `RecentFile` 接口（name, filePath, lastOpened, nodeCount, timestamps）
  - 定义 `AppPage` 类型（'home' | 'editor'）
  - 定义 `ProjectFileHandle` 接口（fileHandle, project, isDirty, hasFile）
  - 定义 `validateAndMigrate()` 格式校验函数
  - **Depends on**: None

- [ ] 1.2 创建 `src/utils/projectStorage.ts` — 核心文件操作
  - 实现 `saveProjectToFile(project)` — 使用 File System Access API 写入
  - 实现 `openProjectFromFile()` — 使用 showOpenFilePicker 读取
  - 实现 `saveProjectAs(project)` — 弹保存对话框新建文件
  - 实现 `readProjectFromBlob(file)` — 从 File 对象读取（import/fallback）
  - 实现 `downloadProjectFile(project)` — Blob 下载（fallback 保存）
  - 实现 `exportToPlaywrightScript(project)` — 生成 .spec.ts
  - 实现 `validateAndMigrate(data)` — 格式校验与版本迁移
  - IndexedDB 操作：`getRecentFiles()`, `addRecentFile()`, `removeRecentFile()`
  - **Depends on**: 1.1

- [ ] 1.3 创建 `src/hooks/useProjectFile.ts` — 工程文件状态管理 hook
  - 状态：`currentFileHandle`, `currentProject`, `isDirty`, `hasFile`
  - 方法：`newProject()`, `openProject()`, `saveProject()`, `saveProjectAs()`
  - 关闭/切换时检测未保存（`beforeunload` 事件 + isDirty 检查）
  - 自动保存逻辑（nodes/edges 变化后 2s 防抖，仅当 hasFile=true）
  - **Depends on**: 1.1, 1.2

## Phase 2: 应用管理页面

- [ ] 2.1 创建 `src/pages/HomePage.tsx` — 应用管理页
  - 显示最近文件卡片列表（从 IndexedDB 加载）
  - 每个卡片显示：文件名、节点数、最后修改时间
  - 卡片点击 → 设置 `selectedProject` → 切换 page='editor'
  - "新建工程"按钮 → setNodes([]), setEdges([]) → 切换 page='editor'
  - "导入文件"按钮 → <input type="file"> → 加载并跳转
  - 删除卡片（从 IndexedDB 移除）
  - 首次使用时显示引导文字（"还没有工程文件"）
  - **Depends on**: 1.1, 1.2

- [ ] 2.2 [P] 创建 `src/pages/EditorPage.tsx` — 从 App.tsx 抽取编辑器部分
  - 将 App.tsx 中的画布、工具栏、配置面板、代码预览、日志面板抽离为 EditorPage
  - `EditorPageProps`: `{ nodes, edges, setNodes, setEdges, onBack: () => void }`
  - 工具栏新增"返回"按钮，调用 `onBack` 切换回管理页面
  - 工具栏文件操作按钮改为调用 `useProjectFile` 的方法
  - **Depends on**: 1.3

- [ ] 2.3 改造 `src/App.tsx` — 添加页面路由状态
  - 添加 `page: AppPage` 状态，初始值为 `'home'`
  - `page === 'home'` → 渲染 `<HomePage>`
  - `page === 'editor'` → 渲染 `<EditorPage>`
  - 状态提升：nodes, edges, setNodes, setEdges 保持在 App.tsx 层级
  - useProjectFile 在 App.tsx 层级管理
  - **Depends on**: 2.1, 2.2

- [ ] 2.4 样式与布局
  - 创建 `src/pages/HomePage.css` — 管理页面卡片网格布局
  - 修改 `src/App.css` — 管理页面与编辑器页面的容器样式
  - 响应式：管理页在小屏时卡片改为单列
  - **Depends on**: 2.1

## Phase 3: 工具栏改造与自动保存集成

- [ ] 3.1 改造 `src/components/Toolbar.tsx` — 文件操作重构
  - 新增 props: `onNew`, `onSaveAs`, `onBack` (返回管理页), `hasFile`
  - "保存"按钮行为变化：有 fileHandle 直接保存，无则弹另存为
  - 新增"返回"按钮（替代原来的"加载"按钮位置）
  - "导出"按钮改为下拉菜单：导出 .pwg | 导出 .spec.ts
  - key binding 绑定：Ctrl+S (保存), Ctrl+Shift+S (另存为), Ctrl+O (打开)
  - **Depends on**: 1.2, 2.2

- [ ] 3.2 实现自动保存
  - `useProjectFile` 中监听 `nodes` 和 `edges` 变化
  - 变化后设置 `isDirty = true`
  - 2 秒防抖后触发自动保存（仅当 hasFile=true）
  - 标题栏显示状态：工程名 | "已保存" / "未保存的更改"
  - 页面标题（document.title）同步工程名
  - **Depends on**: 1.3, 3.1

- [ ] 3.3 未保存提示
  - 监听 `beforeunload` 事件：isDirty 时阻止关闭
  - 切换回管理页时，isDirty 时弹出确认对话框
  - 新建/打开文件时，当前有未保存更改则提示
  - **Depends on**: 1.3

## Phase 4: 导出增强与边界处理

- [ ] 4.1 导出为 Playwright 测试脚本
  - 复用现有 `generatePlaywrightCode` 函数
  - 生成可直接运行的文件：`import { test } from '@playwright/test'`
  - 文件头添加生成信息和工程名注释
  - 文件扩展名 `.spec.ts`
  - **Depends on**: 1.1, 1.2

- [ ] 4.2 格式校验与错误处理
  - 打开文件时验证 format 字段是否为 `playwright-cli-gui`
  - 验证 version 是否兼容（major 版本检查）
  - 损坏/非法文件时弹出友好的错误提示
  - 捕获 File System API 的错误（用户取消、权限拒绝、磁盘满）
  - **Depends on**: 1.2

- [ ] 4.3 Browser compatibility (fallback 路径)
  - 检测 `'showOpenFilePicker' in window`，不支持时使用 `<input type="file">`
  - 检测 `'showSaveFilePicker' in window`，不支持时使用 Blob 下载
  - 降级时在控制台输出提示，不打扰用户
  - **Depends on**: 1.2

## Notes

- [P] 标记的任务可以并行开发
- 任务 2.2（EditorPage）和 2.4（样式）相互独立，可并行
- 任务 4.2 和 4.3 与 Phase 1 紧密相关，建议在 Phase 1 完成后尽早处理
- 任务 2.3（App.tsx 改造）是所有 Phase 2 任务的最终集成点
