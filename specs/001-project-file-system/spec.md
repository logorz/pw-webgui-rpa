# Feature Specification: 工程文件系统与应用管理

**Feature Branch**: `001-project-file-system`
**Created**: 2025-04-25
**Status**: Draft
**Input**: 用户需求 — 将 localStorage 持久化改为基于工程文件（JSON）的存储方式，同时增加应用列表管理页面

## User Scenarios & Testing

### User Story 1 - 新建工程文件并保存 (Priority: P1)

作为用户，我想从空白画布开始创建一个新的自动化流程，然后保存为工程文件，这样我可以随时打开继续编辑。

**Why this priority**: 这是持久化的核心交互，所有其他功能都依赖它。

**Independent Test**: 打开应用 → 点击"新建" → 画布显示空白 → 添加一个节点 → 点击"保存" → 系统弹出文件保存对话框 → 选择路径 → 文件写入成功。

**Acceptance Scenarios**:
1. **Given** 应用初始状态（无加载任何文件），**When** 点击"新建工程"，**Then** 画布清空为空白，文件标题显示"未命名工程"
2. **Given** 画布上有节点和连线，**When** 点击"保存"（或 Ctrl+S），**Then** 弹出系统保存对话框，默认文件名基于工程名
3. **Given** 文件已保存过一次，**When** 再次按 Ctrl+S，**Then** 直接覆盖写入原文件（不再弹保存对话框）
4. **Given** 文件已修改但未保存，**When** 尝试关闭或新建，**Then** 弹出确认对话框"有未保存的更改，是否保存？"

---

### User Story 2 - 打开已有工程文件并编辑 (Priority: P1)

作为用户，我想打开之前保存的 .pwg 文件进行编辑，这样我可以继续之前的工作或修改已有的自动化流程。

**Why this priority**: 与 Story 1 互为镜像，构成完整的 CRUD 基础。

**Independent Test**: 保存一个工程文件 → 关闭应用 → 重新打开 → 点击"打开文件" → 选择之前保存的 .pwg 文件 → 画布恢复到之前的状态。

**Acceptance Scenarios**:
1. **Given** 应用处于打开状态，**When** 点击"打开"（或 Ctrl+O），**Then** 弹出文件选择对话框，仅显示 .pwg 文件
2. **Given** 选中的 .pwg 文件格式正确，**When** 打开成功，**Then** 画布、配置、视口完全恢复到上次保存的状态
3. **Given** 选中的文件格式损坏或不是 .pwg 文件，**When** 打开失败，**Then** 显示友好的错误提示，不破坏当前画布
4. **Given** 当前画布有未保存的更改，**When** 点击"打开"，**Then** 先弹出保存确认，再执行打开操作

---

### User Story 3 - 应用列表管理页面 (Priority: P2)

作为用户，我想看到一个应用管理页面，列出我最近打开过的工程文件，这样我可以快速切换和浏览多个自动化流程。

**Why this priority**: 在 Story 1 和 Story 2 基础上的增强功能，提升多项目管理体验。

**Independent Test**: 保存 2-3 个 .pwg 文件 → 打开管理页面 → 看到所有工程文件的列表（名称、修改时间、节点数） → 点击其中一个 → 跳转到编辑器并加载该文件。

**Acceptance Scenarios**:
1. **Given** 有多个已保存的 .pwg 文件，**When** 访问管理页面，**Then** 以卡片列表形式展示所有工程文件
2. **Given** 管理页面打开，**When** 点击某个工程文件卡片，**Then** 跳转到编辑器页面并加载该文件
3. **Given** 管理页面打开，**When** 点击"新建工程"按钮，**Then** 跳转到编辑器的空白画布
4. **Given** 最近文件列表中有多个文件，**When** 某个文件被手动删除/移动，**Then** 列表自动移除该项（访问时检测文件是否存在）
5. **Given** 管理页面打开，**When** 点击"导入文件"，**Then** 弹出文件选择对话框，选择 .pwg 文件后添加到列表并跳转到编辑器

---

### User Story 4 - 导出为 Playwright 脚本 (Priority: P2)

作为用户，我想将可视化的流程导出为可直接运行的 Playwright 测试脚本，这样我可以在 CI/CD 或命令行中使用。

**Why this priority**: 将图形化流程与实际可执行脚本连接起来，是该工具的核心价值之一。

**Independent Test**: 创建一个包含打开网页、点击、填写表单的简单流程 → 点击"导出" → 选择"Playwright 测试脚本" → 下载 .spec.ts 文件 → 用 `npx playwright test` 运行。

**Acceptance Scenarios**:
1. **Given** 画布上有完整的流程，**When** 点击"导出为 Playwright 脚本"，**Then** 下载一个格式正确的 `.spec.ts` 文件
2. **Given** 导出格式选择 `raw JSON`，**When** 导出，**Then** 下载 `.pwg.json` 文件（等价于保存的工程文件内容）
3. **Given** 画布为空，**When** 点击导出，**Then** 提示"画布为空，无法导出"

---

### Edge Cases

1. **文件被外部修改**: 当工程文件在外部（如 Git pull）被修改，而编辑器中有未保存更改时，应提示用户冲突。
2. **多标签页冲突**: 同一 .pwg 文件在浏览器两个标签页中打开，保存时不会互相覆盖（File System Access API 天然带锁）。
3. **浏览器不支持 File System API**: 自动降级到下载/上传模式，并在控制台提示。
4. **超大文件**: 1000+ 节点的工程文件，保存和打开应在 1 秒内完成。
5. **磁盘空间不足**: 保存失败时捕获错误并提示用户。

---

## Requirements

### Functional Requirements

- **FR-001**: 系统必须支持创建新工程，初始化空白画布
- **FR-002**: 系统必须支持将工程保存为 `.pwg` JSON 文件，包含所有节点、连线、视口和设置
- **FR-003**: 系统必须支持通过 File System Access API 直接读写文件
- **FR-004**: 系统必须支持 fallback 模式（下载/上传）用于不支持 File System API 的浏览器
- **FR-005**: 系统必须支持打开已有的 `.pwg` 文件，恢复画布完全状态
- **FR-006**: 系统必须检测未保存的更改并在关闭/新建/打开前提示
- **FR-007**: 系统必须提供自动保存功能（修改后 2 秒防抖，仅对已有文件句柄时生效）
- **FR-008**: 系统必须有"最近文件"列表，存储在 IndexedDB 中，记录最近 20 个文件路径
- **FR-009**: 系统必须提供应用管理页面，展示最近工程文件的卡片列表
- **FR-010**: 应用管理页面的卡片必须显示：文件名、最后修改时间、节点数量、简短描述
- **FR-011**: 系统必须支持从管理页面点击卡片跳转到编辑器并加载文件
- **FR-012**: 系统必须支持导出为 Playwright `.spec.ts` 测试脚本（复用现有 codeGenerator）
- **FR-013**: 导出为 `.spec.ts` 时，必须生成可直接用 `npx playwright test` 运行的代码
- **FR-014**: 系统必须验证导入的 `.pwg` 文件格式，格式不匹配时显示友好错误

### [NEEDS CLARIFICATION] 需求

## Clarifications

### Q1: 路由方案如何选择？

**Decision**: 使用简单状态切换（`page: 'home' | 'editor'`），不引入 react-router-dom。
**Rationale**: 目前只有两个页面，不需要路由库的重量级依赖。如果后续需要复杂路由再引入。

### Q2: 管理页面的入口在哪？

**Decision**: 启动时先显示管理页面（应用程序首页），用户选择工程后再进入编辑器。编辑器工具栏中提供"返回"按钮切换回管理页面。

### Q3: 是否需要国际化支持？

**Decision**: v1 暂不需要国际化。项目为中文用户设计，后续如果有多语言需求再添加。

### Q4: 是否需要支持从模板创建新工程？

**Decision**: v1 只需要空白画布。模板功能放入后续迭代需求池。

### Key Entities

- **ProjectFile**: .pwg 工程文件，包含节点、连线、元数据的 JSON 文件。是用户数据的唯一持久化载体。
- **RecentFile**: 最近打开的文件记录，存储路径、名称、修改时间等元数据。存储在 IndexedDB 中。
- **AppProject**: 管理页面中显示的工程卡片，是 RecentFile 与 ProjectFile 元数据的组合视图。

## Success Criteria

### Measurable Outcomes

- **SC-001**: 用户可以在 2 次点击内完成打开或保存操作
- **SC-002**: 包含 200 个节点的工程文件打开时间 < 500ms（含解析和渲染时间）
- **SC-003**: 自动保存在用户停止操作后 2 秒内触发
- **SC-004**: 应用管理页面加载时间 < 200ms（最近文件列表为空时）
- **SC-005**: 不支持 File System API 的浏览器（Firefox/Safari）能正常使用下载/上传模式

## Assumptions

- 用户主要在桌面 Chrome 浏览器（Chrome 86+）上使用此工具
- 用户会使用本地 Git 版本管理 .pwg 文件
- 应用是单页 Web 应用，没有后端服务器管理用户文件
- 导出为 Playwright 脚本时，用户本地已安装 Playwright
- 应用不需要实时多人协作（v1 不包含此功能）
- 管理页面与编辑器页面通过简单的路由切换（不涉及复杂的状态管理库）
