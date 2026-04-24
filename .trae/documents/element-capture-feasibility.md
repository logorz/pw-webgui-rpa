# 元素捕获与智能探索功能 — 可行性分析与实现方案

## 一、需求理解

用户提出了三个层次的需求：

1. **元素捕获**：自动检测目标网页上所有可交互元素，智能列出（按钮、输入框、链接、表单等）
2. **目标网页检测**：对当前打开的页面进行结构分析，生成可操作元素的清单
3. **探索式记录**：类似 Playwright CodeGen 的交互录制功能，用户在浏览器中操作时自动生成节点

---

## 二、当前架构分析

### 现有通信链路

```
前端 (React Flow) ──HTTP POST──▶ 执行服务器 (:3210) ──▶ Playwright 浏览器实例
                       │                        │
                   /execute               sessions Map
                   /evaluate-condition     { browser, context, page }
                   /health
                   /cleanup
```

### 关键资产

| 组件 | 能力 | 与元素捕获的关系 |
|------|------|------------------|
| `sessions Map` | 持有 `page` 对象 | **核心**：可通过 `page.evaluate()` 注入 JS 到页面 |
| `page.evaluate()` | 在浏览器上下文执行 JS | **核心**：可遍历 DOM 提取元素信息 |
| `page.screenshot()` | 截图 | 辅助：可用于可视化定位 |
| `page.locator()` | 元素定位 | 已有：可作为验证手段 |
| HTTP 请求-响应 | 前后端通信 | 需扩展：新增 API 端点 |

### 架构约束

| 约束 | 影响 | 应对策略 |
|------|------|----------|
| 无 WebSocket | 无法实时推送 | 改用轮询或 SSE，或保持请求-响应模式 |
| 会话生命周期 | 仅执行期间有 page | 需要"持久会话"模式：open 后保持连接供检查用 |
| headless 默认开启 | 用户无法看到浏览器 | 检查模式强制 headless=false |

---

## 三、三大功能可行性评估

### 功能 1：智能元素检测（推荐优先级 P0）⭐⭐⭐⭐⭐

**可行性：完全可行，改动量适中**

#### 核心思路

在服务端新增 `inspectElements` API，利用 `page.evaluate()` 在页面上下文中执行 DOM 遍历脚本，提取所有可交互元素的信息。

#### 服务端实现方案

```javascript
// execution-server.mjs 新增 action
case 'inspectElements': {
  if (!session?.page) throw new Error('No active page. Open browser first.');

  const elements = await session.page.evaluate(() => {
    const results = [];

    // 可交互元素选择器策略
    const interactiveSelectors = [
      'button', 'input', 'select', 'textarea',
      'a[href]', '[role="button"]', '[role="link"]',
      '[contenteditable]', '[tabindex]:not([tabindex="-1"])',
      '[onclick]', '[onsubmit]', 'summary', 'details'
    ];

    const seen = new Set();

    document.querySelectorAll(interactiveSelectors.join(',')).forEach(el => {
      // 去重
      if (seen.has(el)) return;
      seen.add(el);

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return; // 不可见元素跳过

      // 生成最佳选择器
      let bestSelector = '';
      if (el.id) bestSelector = `#${CSS.escape(el.id)}`;
      else if (el.className && typeof el.className === 'string' && el.className.trim()) {
        const classes = el.className.trim().split(/\s+/).filter(c => !c.match(/^[0-9]/));
        if (classes.length > 0) bestSelector = `${el.tagName.toLowerCase()}.${classes.slice(0, 2).join('.')}`;
      } else {
        bestSelector = `${el.tagName.toLowerCase()}${el.getAttribute('data-testid') ? `[data-testid="${el.getAttribute('data-testid')}"]` : ''}`;
      }

      // XPath 作为备选
      const xpath = getXPath(el);

      results.push({
        tag: el.tagName.toLowerCase(),
        text: el.textContent?.trim().substring(0, 100) || '',
        id: el.id || null,
        className: typeof el.className === 'string' ? el.className : '',
        selector: bestSelector,
        xpath: xpath,
        type: el.type || null,          // input type
        placeholder: el.placeholder || null,
        href: el.href || null,           // for <a>
        name: el.name || null,
        value: el.value || null,
        role: el.getAttribute('role') || null,
        dataTestId: el.getAttribute('data-testid') || null,
        ariaLabel: el.getAttribute('aria-label') || null,
        boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        visible: rect.width > 0 && rect.height > 0,
        editable: ['INPUT', 'TEXTAREA'].includes(el.tagName) || el.contentEditable === 'true',
        interactive: true,
      });
    });

    // 按 DOM 顺序排序
    results.sort((a, b) => {
      const aTop = a.boundingBox.y;
      const bTop = b.boundingBox.y;
      return aTop - bTop || a.boundingBox.x - b.boundingBox.x;
    });

    return results;
  });

  return { success: true, elements, count: elements.length };
}
```

#### 前端实现方案

**新增组件：ElementInspector（元素检查器面板）**

位置：右侧面板区域（与 LogPanel 同级或替换）

```
┌─────────────────────────────┐
│ 🔍 页面元素检测              │
│ ─────────────────────────  │
│ [🔄 刷新检测] [📸 截图叠加]  │
│ ─────────────────────────  │
│ ▼ 按钮 (12)                 │
│   ├ [button] 登录           │ ← 点击复制选择器
│   ├ [button] 注册           │
│   └ [button#submit] 提交    │
│ ▼ 输入框 (5)                │
│   ├ [input] 用户名           │
│   ├ [input] 密码            │
│   └ [input[type=search]]    │
│ ▼ 链接 (23)                 │
│   ...                       │
└─────────────────────────────┘
```

**交互流程**：
1. 用户先执行"打开浏览器"节点（headless=false）
2. 点击工具栏的"🔍 检测元素"按钮
2. 前端发送 `inspectElements` 请求到当前 session
3. 服务端返回元素列表
4. 面板展示分类列表
5. 用户点击某元素 → 自动将该选择器填入正在配置的节点的 selector 字段

#### 需要修改的文件

| 文件 | 改动内容 |
|------|----------|
| `server/execution-server.mjs` | 新增 `inspectElements` action + `inspectWithScreenshot` action |
| `src/components/ElementInspector.tsx` | **新建**：元素检查器面板组件 |
| `src/App.tsx` | 新增 inspector 状态、新增工具栏按钮、传递 session 信息 |
| `src/components/Toolbar.tsx` | 新增"检测元素"按钮 |
| `src/App.css` | 元素面板样式 |
| `src/types/nodes.ts` | 可能不需要改（这是运行时功能，不是新节点类型） |

---

### 功能 2：截图叠加可视化定位（推荐优先级 P1）⭐⭐⭐⭐

**可行性：可行，依赖功能 1**

#### 核心思路

在获取元素列表的同时，截取当前页面截图（base64），将每个元素的 bounding box 以高亮矩形叠加在截图上。前端渲染截图 + SVG/canvas 覆盖层，用户直接点击截图上的元素来选择。

#### 服务端增强

```javascript
case 'inspectWithScreenshot': {
  if (!session?.page) throw new Error('No active page.');

  // 1. 截图（返回 base64）
  const screenshotBuffer = await session.page.screenshot({ type: 'png' });

  // 2. 获取元素列表（复用上面的逻辑）
  const elements = await session.page.evaluate(/* 同上 */);

  // 3. 返回两者
  return {
    success: true,
    screenshot: screenshotBuffer.toString('base64'),
    elements,
    count: elements.length,
  };
}
```

#### 前端渲染

```tsx
// 截图 + 热力图叠加
<div className="screenshot-viewer">
  <img src={`data:image/png;base64,{screenshot}`} />
  <svg className="element-overlay">
    {elements.map(el => (
      <rect
        key={el.selector}
        x={el.boundingBox.x} y={el.boundingBox.y}
        width={el.boundingBox.width} height={el.boundingBox.height}
        fill="rgba(59,130,246,0.15)"
        stroke="#3b82f6" strokeWidth="1"
        onClick={() => onSelectElement(el)}
        className="hover:fill-blue-400 hover:cursor-pointer"
      >
        <title>{el.tag}: {el.text}</title>
      </rect>
    ))}
  </svg>
</div>
```

---

### 功能 3：探索式交互录制（推荐优先级 P2）⭐⭐⭐

**可行性：可行但复杂，需要架构调整**

#### 三种技术路线对比

| 方案 | 原理 | 优点 | 缺点 | 推荐度 |
|------|------|------|------|--------|
| **A: CDP 录制** | 通过 Chrome DevTools Protocol 监听 Input.dispatchMouseEvent 等事件 | 最精确，能捕获所有用户输入 | 需要管理额外 CDP 连接；仅限 Chromium | ⭐⭐⭐⭐ |
| **B: 页面内注入 JS** | 通过 page.addInitScript 或 page.evaluate 注入事件监听器 | 跨浏览器兼容 | 只能监听页面内事件，无法区分用户操作和程序操作 | ⭐⭐⭐ |
| **C: Playwright 自带 trace** | 启动 tracing.start(screenshots:true)，事后回放 | 最简单，Playwright 原生支持 | 不是实时录制，是事后分析 | ⭐⭐ |

#### 推荐方案 A：CDP 录制（最实用）

**架构调整**：

```
                    ┌─────────────┐
                    │  CDP Client  │ ◄── WebSocket/HTTP ──▶ Chrome DevTools
                    │ (录制模块)   │
                    └──────┬──────┘
                           │ 事件流
                    ┌──────▼──────┐
       HTTP请求 ──▶ │ 执行服务器   │ ◄──▶ Playwright Browser
       /execute     │ (现有逻辑)   │     (with CDP endpoint)
       /recordStart │              │
       /recordStop  │  sessions    │
       /recordSnapshot│             │
                    └──────────────┘
```

**实现步骤**：

1. **启动浏览器时暴露 CDP 端点**：
```javascript
case 'open': {
  const browser = await chromium.launch({
    headless: false,
    args: ['--remote-debugging-port=9222']  // 暴露 CDP
  });
  // ...
}
```

2. **新增录制相关 API**：
```javascript
// 开始录制
case 'startRecord': {
  if (!session?.page) throw new Error('No active page.');
  session.recording = [];
  session.cdpSession = await session.context.newCDPSession(session.page);

  await session.cdpSession.send('Input.enable');  // 启用输入事件监听
  session.cdpSession.on('Input.eventDispatched', (event) => {
    session.recording.push({
      type: event.type,       // mousePressed, mouseReleased, charTyped, etc.
      timestamp: Date.now(),
      x: event.x,
      y: event.y,
      // ...
    });
  });

  // 同时监听导航事件
  session.cdpSession.send('Page.enable');
  session.cdpSession.on('Page.frameNavigated', (frame) => {
    session.recording.push({ type: 'navigation', url: frame.frame.url });
  });

  return { success: true, message: 'Recording started' };
}

// 停止录制并返回操作序列
case 'stopRecord': {
  if (!session?.recording) throw new Error('Not recording.');
  const actions = convertRecordingToNodes(session.recording);  // 转换为节点格式
  session.cdpSession?.detach();
  session.recording = null;
  return { success: true, actions, count: actions.length };
}

// 录制过程中实时快照（用于预览）
case 'recordSnapshot': {
  if (!session?.recording) return { success: true, actions: [] };
  return { success: true, actions: session.recording };
}
```

3. **前端录制 UI**：

```
┌──────────────────────────────────┐
│ ⏺️ 录制控制台                     │
│                                  │
│ 状态: ● 正在录制 (00:03:22)       │
│                                  │
│ [⏹️ 停止录制] [📋 生成节点]         │
│                                  │
│ 已录制操作:                        │
│  1. navigate https://baidu.com    │
│  2. click #su (搜索框)            │
│  3. type "playwright"            │
│  4. click #su (搜索按钮)          │
│                                  │
└──────────────────────────────────┘
```

4. **录制数据转节点**：
```javascript
function convertRecordingToNodes(events) {
  const nodes = [];
  for (const event of events) {
    switch (event.type) {
      case 'navigation':
        nodes.push({ type: 'goto', params: { url: event.url } });
        break;
      case 'mousePressed':
        // 通过坐标反查元素
        nodes.push({ type: 'click', params: { selector: event.selectorFromPoint } });
        break;
      case 'charTyped':
        nodes.push({ type: 'type', params: { text: event.text } });
        break;
    }
  }
  return nodes;
}
```

#### 关键难点和解决方案

| 难点 | 解决方案 |
|------|----------|
| 鼠标点击坐标→元素选择器的转换 | 使用 `page.evaluate(() => document.elementFromPoint(x, y))` 反查 |
| 滚动后坐标偏移 | 记录 scrollOffset，转换坐标时补偿 |
| 输入内容的完整捕获 | CDP charTyped 只给单字符，需要缓冲合并 |
| 动态内容（SPA路由变化） | 监听 Page.frameNavigated 事件同步 |
| 非 Chromium 浏览器支持 | Firefox/WebKit 不支持 CDP，降级到方案 B（注入JS） |

---

## 四、推荐的分阶段实施路径

### Phase 1：基础元素检测（P0 — 1-2天工作量）

**目标**：用户打开浏览器后，可以一键检测页面所有可交互元素，点击即可使用选择器

**交付物**：
1. 服务端 `inspectElements` API
2. 前端 ElementInspector 面板
3. 工具栏"检测元素"按钮
4. 点击元素 → 自动填充选择器到当前编辑节点的功能
5. 元素分类展示（按钮/输入框/链接/其他）
6. 搜索过滤功能

### Phase 2：截图可视化定位（P1 — 1天工作量）

**目标**：在截图上直观看到元素位置，点击截图区域选中元素

**交付物**：
1. 服务端 `inspectWithScreenshot` API（截图 + 元素列表联合返回）
2. 截图查看器组件（img + SVG 叠加层）
3. 元素 hover 高亮效果
4. 缩放/平移支持

### Phase 3：探索式录制（P2 — 2-3天工作量）

**目标**：用户在浏览器中的操作被自动记录并转换为流程节点

**交付物**：
1. 浏览器启动时启用 CDP
2. startRecord / stopRecord / recordSnapshot API
3. 录制控制面板（开始/停止/计时器）
4. 实时操作列表
5. 录制结果 → 节点转换
6. 一键插入录制的节点到画布

---

## 五、架构影响评估

### 需要的新增文件

```
src/
  components/
    ElementInspector.tsx          # 元素检查器面板（Phase 1）
    ScreenshotViewer.tsx          # 截图可视化查看器（Phase 2）
    RecordingPanel.tsx            # 录制控制面板（Phase 3）
  hooks/
    useElementInspector.ts        # 元素检测 hook
    useRecorder.ts                # 录制控制 hook
```

### 需要修改的现有文件

| 文件 | Phase 1 改动 | Phase 2 改动 | Phase 3 改动 |
|------|-------------|-------------|-------------|
| `server/execution-server.mjs` | +40行 (inspectElements) | +30行 (inspectWithScreenshot) | +80行 (CDP录制API) |
| `src/App.tsx` | +20行 (inspector状态) | +10行 (screenshot状态) | +30行 (recorder状态) |
| `src/components/Toolbar.tsx` | +5行 (检测按钮) | +3行 (截图按钮) | +5行 (录制按钮) |
| `src/App.css` | +80行 (面板样式) | +60行 (截图样式) | +50行 (录制样式) |
| `package.json` | 无需新依赖 | 无需新依赖 | 可能需要 `chrome-remote-interface` 或原生 fetch |

### 不需要改动的文件

- `src/types/nodes.ts` — 这是运行时功能，不涉及新节点类型定义
- `src/engine/executor.ts` — 元素检测不经过执行引擎
- `src/engine/codeGenerator.ts` — 同上
- `src/components/CustomNode.tsx` — 节点渲染不变
- `src/components/NodeConfigPanel.tsx` — 仅需小改（接收外部选择器填充）

---

## 六、风险与注意事项

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| SPA 动态内容检测不全 | 元素遗漏 | 提供"刷新检测"按钮；支持延迟检测 |
| Shadow DOM 内元素不可达 | 选择器失效 | 检测时穿透 shadowRoot |
| iframe 跨域限制 | iframe 内元素无法检测 | 列出 iframe 并提示用户切换 |
| 大型页面元素过多（>500） | 性能问题 | 分页加载；虚拟滚动；按类型筛选 |
| headless 模式下无意义 | 用户看不到检测结果 | 强制 headless=false 才允许检测 |
| CDP 端口安全 | 9222端口暴露 | 仅绑定 localhost；或使用随机端口 |
| 录制产生大量冗余节点 | 流程混乱 | 录制后提供编辑/合并/删除界面 |

---

## 七、总结

| 功能 | 可行性 | 工作量 | 价值 | 推荐 |
|------|--------|--------|------|------|
| 智能元素检测 | ⭐⭐⭐⭐⭐ | 小 | 极高 | **立即做** |
| 截图叠加定位 | ⭐⭐⭐⭐ | 中 | 高 | **紧随其后** |
| 探索式录制 | ⭐⭐⭐ | 大 | 极高 | **第三步做** |

**核心结论**：基于当前架构，这三个功能都是可行的。项目已有的 `sessions Map` 和 `page.evaluate()` 是最大的资产——它们意味着我们无需任何新的基础设施就能实现元素检测。CDP 录制需要一些架构调整但完全在可控范围内。
