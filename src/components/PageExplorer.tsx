import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Search, RefreshCw, X, MousePointer, Type, CheckSquare,
  List, ChevronDown, ChevronRight, Loader, Globe, Link,
  ArrowRight, Plus, Trash2, Eye, Zap, Crosshair, Edit3
} from 'lucide-react';

interface ElementInfo {
  tag: string;
  text: string;
  category: string;
  id: string | null;
  className: string;
  selector: string;
  xpath: string;
  type: string | null;
  placeholder: string | null;
  href: string | null;
  name: string | null;
  value: string | null;
  role: string | null;
  dataTestId: string | null;
  ariaLabel: string | null;
  boundingBox: { x: number; y: number; width: number; height: number };
  visible: boolean;
  editable: boolean;
  checked: boolean;
  disabled: boolean;
}

export interface PendingAction {
  id: string;
  element: ElementInfo | null;
  action: string;
  value?: string;
  nodeType: string;
  customSelector?: string;
}

interface PageExplorerProps {
  onGenerateNodes: (actions: PendingAction[]) => void;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  button: { label: '按钮', icon: MousePointer, color: '#8b5cf6' },
  link: { label: '链接', icon: Link, color: '#3b82f6' },
  input: { label: '输入框', icon: Type, color: '#10b981' },
  select: { label: '下拉选择', icon: List, color: '#f59e0b' },
  checkbox: { label: '复选框', icon: CheckSquare, color: '#06b6d4' },
  toggle: { label: '展开/折叠', icon: ChevronDown, color: '#64748b' },
  tab: { label: '标签页', icon: ArrowRight, color: '#ec4899' },
  menu: { label: '菜单项', icon: List, color: '#f97316' },
  option: { label: '选项', icon: CheckSquare, color: '#14b8a6' },
  other: { label: '其他', icon: Eye, color: '#64748b' },
};

const ACTION_OPTIONS: Record<string, { label: string; nodeType: string; needsValue: boolean }[]> = {
  button: [
    { label: '点击', nodeType: 'click', needsValue: false },
    { label: '悬停', nodeType: 'hover', needsValue: false },
  ],
  link: [
    { label: '点击', nodeType: 'click', needsValue: false },
    { label: '悬停', nodeType: 'hover', needsValue: false },
  ],
  input: [
    { label: '填充输入', nodeType: 'fill', needsValue: true },
    { label: '输入文本', nodeType: 'type', needsValue: true },
    { label: '点击', nodeType: 'click', needsValue: false },
    { label: '悬停', nodeType: 'hover', needsValue: false },
  ],
  select: [
    { label: '选择选项', nodeType: 'selectOption', needsValue: true },
    { label: '点击', nodeType: 'click', needsValue: false },
  ],
  checkbox: [
    { label: '勾选', nodeType: 'check', needsValue: false },
    { label: '取消勾选', nodeType: 'uncheck', needsValue: false },
    { label: '点击', nodeType: 'click', needsValue: false },
  ],
  toggle: [
    { label: '点击', nodeType: 'click', needsValue: false },
  ],
  tab: [
    { label: '点击', nodeType: 'click', needsValue: false },
  ],
  menu: [
    { label: '点击', nodeType: 'click', needsValue: false },
  ],
  option: [
    { label: '点击', nodeType: 'click', needsValue: false },
  ],
  other: [
    { label: '点击', nodeType: 'click', needsValue: false },
    { label: '悬停', nodeType: 'hover', needsValue: false },
  ],
  custom: [
    { label: '点击', nodeType: 'click', needsValue: false },
    { label: '填充输入', nodeType: 'fill', needsValue: true },
    { label: '悬停', nodeType: 'hover', needsValue: false },
  ],
};

export default function PageExplorer({ onGenerateNodes, onClose }: PageExplorerProps) {
  const [url, setUrl] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [elements, setElements] = useState<ElementInfo[]>([]);
  const [pageTitle, setPageTitle] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [highlightedElement, setHighlightedElement] = useState<ElementInfo | null>(null);
  const [hoveredElement, setHoveredElement] = useState<ElementInfo | null>(null);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({ button: true, input: true, link: false });
  const [filterText, setFilterText] = useState('');
  const [actionModal, setActionModal] = useState<{ element: ElementInfo | null; customSelector?: string; x: number; y: number } | null>(null);
  const [actionValue, setActionValue] = useState('');
  const [selectedAction, setSelectedAction] = useState<{ label: string; nodeType: string; needsValue: boolean } | null>(null);
  const [customSelector, setCustomSelector] = useState('');
  const [showCustomSelector, setShowCustomSelector] = useState(false);
  const [scale, setScale] = useState(1);
  const [actionFlash, setActionFlash] = useState<string | null>(null);
  const screenshotRef = useRef<HTMLDivElement>(null);
  const screenshotScrollRef = useRef<HTMLDivElement>(null);

  const handleOpen = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:3210/explore/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to open page');
      setSessionId(data.sessionId);
      setScreenshot(data.screenshot);
      setElements(data.elements);
      setPageTitle(data.title);
      setCurrentUrl(data.url);
      const cats: Record<string, boolean> = {};
      data.elements.forEach((el: ElementInfo) => { cats[el.category] = true; });
      setExpandedCategories(cats);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [url]);

  const handleNavigate = useCallback(async (newUrl: string) => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:3210/explore/navigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl, sessionId }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Navigation failed');
      setScreenshot(data.screenshot);
      setElements(data.elements);
      setPageTitle(data.title);
      setCurrentUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const handleRefresh = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:3210/explore/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Refresh failed');
      setScreenshot(data.screenshot);
      setElements(data.elements);
      setPageTitle(data.title);
      setCurrentUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const handleExploreAction = useCallback(async (action: string, selector: string, value?: string) => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    setActionFlash(`${action}:${selector}`);
    try {
      const response = await fetch('http://localhost:3210/explore/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action, selector, value }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Action failed');
      setScreenshot(data.screenshot);
      setElements(data.elements);
      setPageTitle(data.title);
      setCurrentUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setTimeout(() => setActionFlash(null), 1500);
    }
  }, [sessionId]);

  const handleCloseSession = useCallback(async () => {
    if (!sessionId) return;
    if (!window.confirm('确定要关闭探索浏览器吗？所有未确认的操作将丢失。')) return;
    try {
      await fetch('http://localhost:3210/explore/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch {}
    setSessionId(null);
    setScreenshot(null);
    setElements([]);
    setPageTitle('');
    setCurrentUrl('');
    setPendingActions([]);
    setSelectedElement(null);
    setHighlightedElement(null);
  }, [sessionId]);

  const handleConfirmAndContinue = useCallback(() => {
    if (pendingActions.length > 0) {
      onGenerateNodes(pendingActions);
      setPendingActions([]);
    }
  }, [pendingActions, onGenerateNodes]);

  const handleConfirmAndClose = useCallback(async () => {
    if (pendingActions.length > 0) {
      onGenerateNodes(pendingActions);
    }
    if (sessionId) {
      try {
        await fetch('http://localhost:3210/explore/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      } catch {}
    }
    setSessionId(null);
    setScreenshot(null);
    setElements([]);
    setPageTitle('');
    setCurrentUrl('');
    setPendingActions([]);
    setSelectedElement(null);
    setHighlightedElement(null);
  }, [pendingActions, onGenerateNodes, sessionId]);

  const handleElementHighlight = useCallback((element: ElementInfo | null) => {
    setHighlightedElement(element);
    setSelectedElement(element);
    if (element && screenshotScrollRef.current) {
      const containerHeight = screenshotScrollRef.current.clientHeight;
      const scrollTarget = element.boundingBox.y * scale - containerHeight / 3;
      screenshotScrollRef.current.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
    }
  }, [scale]);

  const handleElementClick = useCallback((element: ElementInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    handleElementHighlight(element);
    setActionModal({ element, x: e.clientX, y: e.clientY });
    setActionValue('');
    setSelectedAction(null);
  }, [handleElementHighlight]);

  const handleActionConfirm = useCallback(() => {
    if (!actionModal || !selectedAction) return;
    const selector = actionModal.customSelector || actionModal.element?.selector || '';
    const action: PendingAction = {
      id: `action-${Date.now()}-${Math.random()}`,
      element: actionModal.element,
      action: selectedAction.label,
      value: selectedAction.needsValue ? actionValue : undefined,
      nodeType: selectedAction.nodeType,
      customSelector: actionModal.customSelector,
    };
    setPendingActions(prev => [...prev, action]);
    handleExploreAction(
      selectedAction.nodeType === 'check' ? 'check' : selectedAction.nodeType === 'uncheck' ? 'uncheck' : selectedAction.nodeType,
      selector,
      selectedAction.needsValue ? actionValue : undefined
    );
    setActionModal(null);
    setSelectedAction(null);
    setActionValue('');
  }, [actionModal, selectedAction, actionValue, handleExploreAction]);

  const handleCustomSelectorSubmit = useCallback(() => {
    if (!customSelector.trim() || !sessionId) return;
    setActionModal({ element: null, customSelector: customSelector.trim(), x: window.innerWidth / 2 - 130, y: window.innerHeight / 2 - 100 });
    setActionValue('');
    setSelectedAction(null);
    setShowCustomSelector(false);
  }, [customSelector, sessionId]);

  const handleRemovePendingAction = useCallback((actionId: string) => {
    setPendingActions(prev => prev.filter(a => a.id !== actionId));
  }, []);

  const handleScreenshotClick = useCallback((e: React.MouseEvent) => {
    if (!screenshotRef.current) return;
    const rect = screenshotRef.current.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / scale;
    const clickY = (e.clientY - rect.top) / scale;
    const clickedElements = elements.filter(el => {
      const bb = el.boundingBox;
      return clickX >= bb.x && clickX <= bb.x + bb.width && clickY >= bb.y && clickY <= bb.y + bb.height;
    });
    const clicked = clickedElements.length > 0 ? clickedElements[clickedElements.length - 1] : null;
    if (clicked) {
      handleElementHighlight(clicked);
      setActionModal({ element: clicked, x: e.clientX, y: e.clientY });
      setActionValue('');
      setSelectedAction(null);
    }
  }, [elements, scale, handleElementHighlight]);

  const handleScreenshotHover = useCallback((e: React.MouseEvent) => {
    if (!screenshotRef.current) return;
    const rect = screenshotRef.current.getBoundingClientRect();
    const hoverX = (e.clientX - rect.left) / scale;
    const hoverY = (e.clientY - rect.top) / scale;
    const hoveredElements = elements.filter(el => {
      const bb = el.boundingBox;
      return hoverX >= bb.x && hoverX <= bb.x + bb.width && hoverY >= bb.y && hoverY <= bb.y + bb.height;
    });
    setHoveredElement(hoveredElements.length > 0 ? hoveredElements[hoveredElements.length - 1] : null);
  }, [elements, scale]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (actionModal) {
          setActionModal(null);
        } else if (showCustomSelector) {
          setShowCustomSelector(false);
        } else if (selectedElement) {
          setSelectedElement(null);
          setHighlightedElement(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actionModal, showCustomSelector, selectedElement]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (sessionId) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionId]);

  useEffect(() => {
    if (screenshotRef.current) {
      const containerWidth = screenshotRef.current.clientWidth;
      setScale(containerWidth / 1280);
    }
  }, [screenshot]);

  const categorizedElements = elements.reduce((acc, el) => {
    if (!acc[el.category]) acc[el.category] = [];
    acc[el.category].push(el);
    return acc;
  }, {} as Record<string, ElementInfo[]>);

  const filteredElements = filterText
    ? elements.filter(el =>
        el.text.toLowerCase().includes(filterText.toLowerCase()) ||
        el.selector.toLowerCase().includes(filterText.toLowerCase()) ||
        (el.id || '').toLowerCase().includes(filterText.toLowerCase()) ||
        (el.placeholder || '').toLowerCase().includes(filterText.toLowerCase())
      )
    : null;

  return (
    <div className="page-explorer">
      <div className="page-explorer-header">
        <div className="page-explorer-title">
          <Globe size={16} />
          <span>页面探索器</span>
        </div>
        <button className="page-explorer-close-btn" onClick={() => {
          if (sessionId) {
            if (window.confirm('探索浏览器仍在运行，确定要关闭面板吗？')) {
              handleCloseSession();
              onClose();
            }
          } else {
            onClose();
          }
        }}>
          <X size={16} />
        </button>
      </div>

      <div className="page-explorer-url-bar">
        <input
          type="text"
          className="page-explorer-url-input"
          placeholder="输入网页地址，如 https://www.baidu.com"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleOpen(); }}
          disabled={loading}
        />
        <button
          className="page-explorer-go-btn"
          onClick={sessionId ? () => handleNavigate(url) : handleOpen}
          disabled={loading || !url.trim()}
        >
          {loading ? <Loader size={14} className="spin" /> : sessionId ? <ArrowRight size={14} /> : <Search size={14} />}
        </button>
        {sessionId && (
          <button className="page-explorer-refresh-btn" onClick={handleRefresh} disabled={loading} title="刷新页面">
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        )}
      </div>

      {error && (
        <div className="page-explorer-error">
          <X size={12} onClick={() => setError(null)} style={{ cursor: 'pointer' }} />
          {error}
        </div>
      )}

      {sessionId && (
        <div className="page-explorer-info-bar">
          <span className="page-explorer-page-title" title={pageTitle}>{pageTitle || '无标题'}</span>
          <span className="page-explorer-page-url" title={currentUrl}>{currentUrl}</span>
          <span className="page-explorer-element-count">{elements.length} 个可操作元素</span>
        </div>
      )}

      {screenshot && (
        <div className="page-explorer-screenshot" ref={screenshotScrollRef}>
          {actionFlash && (
            <div className="page-explorer-flash">页面已更新 ✓</div>
          )}
          <div
            className="page-explorer-screenshot-inner"
            style={{ width: 1280, height: 720, transform: `scale(${scale})`, transformOrigin: 'top left' }}
            ref={screenshotRef}
          >
            <img
              src={`data:image/png;base64,${screenshot}`}
              alt="Page screenshot"
              style={{ width: 1280, height: 720, display: 'block' }}
            />
            <svg
              className="page-explorer-overlay"
              width={1280}
              height={720}
              onClick={handleScreenshotClick}
              onMouseMove={handleScreenshotHover}
              onMouseLeave={() => setHoveredElement(null)}
              style={{ cursor: 'crosshair' }}
            >
              {elements.map((el, idx) => {
                const bb = el.boundingBox;
                const isHighlighted = highlightedElement?.selector === el.selector && highlightedElement?.boundingBox.x === bb.x && highlightedElement?.boundingBox.y === bb.y;
                const isHovered = hoveredElement?.selector === el.selector && hoveredElement?.boundingBox.x === bb.x && hoveredElement?.boundingBox.y === bb.y;
                const isPending = pendingActions.some(a => a.element?.selector === el.selector);
                const showOutline = isHighlighted || isHovered;
                return (
                  <g key={`${el.selector}-${idx}`}>
                    <rect
                      x={bb.x}
                      y={bb.y}
                      width={bb.width}
                      height={bb.height}
                      fill={isHighlighted ? 'rgba(59,130,246,0.3)' : isHovered ? 'rgba(59,130,246,0.15)' : 'transparent'}
                      stroke={isPending ? '#10b981' : isHighlighted ? '#3b82f6' : isHovered ? '#3b82f6' : 'transparent'}
                      strokeWidth={isHighlighted ? 2.5 : isPending ? 2 : 1.5}
                      strokeDasharray={isHighlighted ? '' : isPending ? '' : '4,2'}
                      rx={2}
                      style={{ pointerEvents: 'all', cursor: 'pointer', transition: 'all 0.15s' }}
                    >
                      <title>{el.tag}: {el.text || el.selector}</title>
                    </rect>
                    {isHighlighted && (
                      <g>
                        <rect
                          x={bb.x}
                          y={bb.y - 20}
                          width={Math.max(bb.width, 60)}
                          height={18}
                          fill="#3b82f6"
                          rx={3}
                        />
                        <text
                          x={bb.x + 4}
                          y={bb.y - 7}
                          fill="#fff"
                          fontSize={10}
                          fontFamily="system-ui, sans-serif"
                          fontWeight={500}
                        >
                          {el.tag}{el.id ? `#${el.id}` : ''} {el.text ? el.text.substring(0, 20) : el.selector.substring(0, 20)}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {sessionId && (
        <div className="page-explorer-filter">
          <Search size={12} />
          <input
            type="text"
            placeholder="搜索元素（文本/选择器/ID）"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            className="page-explorer-filter-input"
          />
          <button
            className="page-explorer-custom-selector-btn"
            onClick={() => setShowCustomSelector(true)}
            title="手动输入CSS选择器"
          >
            <Edit3 size={12} />
          </button>
        </div>
      )}

      {showCustomSelector && (
        <div className="page-explorer-custom-selector-bar">
          <Crosshair size={12} />
          <input
            type="text"
            placeholder="输入CSS选择器，如 .my-class 或 #my-id"
            value={customSelector}
            onChange={e => setCustomSelector(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCustomSelectorSubmit(); }}
            className="page-explorer-custom-selector-input"
            autoFocus
          />
          <button
            className="page-explorer-custom-selector-go"
            onClick={handleCustomSelectorSubmit}
            disabled={!customSelector.trim()}
          >
            操作
          </button>
          <button className="page-explorer-custom-selector-cancel" onClick={() => { setShowCustomSelector(false); setCustomSelector(''); }}>
            <X size={12} />
          </button>
        </div>
      )}

      <div className="page-explorer-elements">
        {filteredElements ? (
          <div className="page-explorer-filtered-list">
            {filteredElements.length === 0 ? (
              <div className="page-explorer-empty">没有匹配的元素</div>
            ) : (
              filteredElements.map((el, idx) => (
                <ElementItem
                  key={`${el.selector}-${idx}`}
                  element={el}
                  isSelected={selectedElement?.selector === el.selector && selectedElement?.boundingBox.x === el.boundingBox.x}
                  isHighlighted={highlightedElement?.selector === el.selector && highlightedElement?.boundingBox.x === el.boundingBox.x}
                  isPending={pendingActions.some(a => a.element?.selector === el.selector)}
                  onClick={handleElementClick}
                  onHover={setHighlightedElement}
                />
              ))
            )}
          </div>
        ) : (
          Object.entries(categorizedElements).map(([category, els]) => {
            const catInfo = CATEGORY_LABELS[category] || CATEGORY_LABELS.other;
            const CatIcon = catInfo.icon;
            const isExpanded = expandedCategories[category] !== false;
            return (
              <div key={category} className="page-explorer-category">
                <div
                  className="page-explorer-category-header"
                  onClick={() => setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }))}
                >
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <CatIcon size={12} style={{ color: catInfo.color }} />
                  <span className="page-explorer-category-label">{catInfo.label}</span>
                  <span className="page-explorer-category-count">{els.length}</span>
                </div>
                {isExpanded && els.map((el, idx) => (
                  <ElementItem
                    key={`${el.selector}-${idx}`}
                    element={el}
                    isSelected={selectedElement?.selector === el.selector && selectedElement?.boundingBox.x === el.boundingBox.x}
                    isHighlighted={highlightedElement?.selector === el.selector && highlightedElement?.boundingBox.x === el.boundingBox.x}
                    isPending={pendingActions.some(a => a.element?.selector === el.selector)}
                    onClick={handleElementClick}
                    onHover={setHighlightedElement}
                  />
                ))}
              </div>
            );
          })
        )}
      </div>

      {pendingActions.length > 0 && (
        <div className="page-explorer-pending">
          <div className="page-explorer-pending-header">
            <Zap size={12} />
            <span>待生成操作 ({pendingActions.length})</span>
          </div>
          <div className="page-explorer-pending-list">
            {pendingActions.map(action => (
              <div key={action.id} className="page-explorer-pending-item">
                <span className="page-explorer-pending-action">{action.action}</span>
                <span className="page-explorer-pending-selector" title={action.customSelector || action.element?.selector}>
                  {(action.customSelector || action.element?.selector || '').length > 25 ? (action.customSelector || action.element?.selector || '').substring(0, 25) + '...' : (action.customSelector || action.element?.selector || '')}
                </span>
                {action.value && <span className="page-explorer-pending-value">"{action.value.length > 10 ? action.value.substring(0, 10) + '...' : action.value}"</span>}
                <button className="page-explorer-pending-remove" onClick={() => handleRemovePendingAction(action.id)}>
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {sessionId && (
        <div className="page-explorer-footer">
          <div className="page-explorer-footer-hint">
            {pendingActions.length === 0
              ? '👆 点击截图或列表中的元素来添加操作'
              : `已添加 ${pendingActions.length} 个操作，点击确认生成流程节点`
            }
          </div>
          <div className="page-explorer-footer-buttons">
            <button
              className="page-explorer-btn page-explorer-btn-primary"
              onClick={handleConfirmAndContinue}
              disabled={pendingActions.length === 0}
            >
              <Plus size={14} />
              确定并继续
            </button>
            <button
              className="page-explorer-btn page-explorer-btn-danger"
              onClick={handleConfirmAndClose}
            >
              {pendingActions.length > 0 ? (
                <>
                  <Zap size={14} />
                  确定并关闭
                </>
              ) : (
                <>
                  <X size={14} />
                  关闭浏览器
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {actionModal && (
        <div className="page-explorer-action-modal-overlay" onClick={() => setActionModal(null)}>
          <div
            className="page-explorer-action-modal"
            onClick={e => e.stopPropagation()}
            style={{
              left: Math.min(actionModal.x, window.innerWidth - 280),
              top: Math.min(actionModal.y, window.innerHeight - 300),
            }}
          >
            <div className="page-explorer-action-modal-header">
              {actionModal.element ? (
                <>
                  <span>{actionModal.element.tag}</span>
                  <span className="page-explorer-action-modal-selector" title={actionModal.element.selector}>
                    {actionModal.element.selector}
                  </span>
                </>
              ) : (
                <>
                  <Crosshair size={12} />
                  <span className="page-explorer-action-modal-selector" title={actionModal.customSelector}>
                    {actionModal.customSelector}
                  </span>
                </>
              )}
            </div>
            {actionModal.element?.text && (
              <div className="page-explorer-action-modal-text">
                "{actionModal.element.text.length > 40 ? actionModal.element.text.substring(0, 40) + '...' : actionModal.element.text}"
              </div>
            )}
            {!actionModal.element && actionModal.customSelector && (
              <div className="page-explorer-action-modal-text" style={{ color: '#f59e0b' }}>
                自定义选择器（元素不在自动检测列表中）
              </div>
            )}
            <div className="page-explorer-action-modal-actions">
              {(ACTION_OPTIONS[actionModal.element?.category || 'custom'] || ACTION_OPTIONS.other).map(opt => (
                <button
                  key={opt.label}
                  className={`page-explorer-action-btn ${selectedAction?.label === opt.label ? 'selected' : ''}`}
                  onClick={() => setSelectedAction(opt)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {selectedAction?.needsValue && (
              <div className="page-explorer-action-modal-value">
                <input
                  type="text"
                  placeholder={`输入${selectedAction.label}的值`}
                  value={actionValue}
                  onChange={e => setActionValue(e.target.value)}
                  className="page-explorer-action-value-input"
                  autoFocus
                />
              </div>
            )}
            <div className="page-explorer-action-modal-footer">
              <button className="page-explorer-btn page-explorer-btn-secondary" onClick={() => setActionModal(null)}>取消</button>
              <button
                className="page-explorer-btn page-explorer-btn-primary"
                onClick={handleActionConfirm}
                disabled={!selectedAction || (selectedAction.needsValue && !actionValue.trim())}
              >
                添加操作
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ElementItem({
  element,
  isSelected,
  isHighlighted,
  isPending,
  onClick,
  onHover,
}: {
  element: ElementInfo;
  isSelected: boolean;
  isHighlighted: boolean;
  isPending: boolean;
  onClick: (element: ElementInfo, e: React.MouseEvent) => void;
  onHover: (element: ElementInfo | null) => void;
}) {
  const catInfo = CATEGORY_LABELS[element.category] || CATEGORY_LABELS.other;
  return (
    <div
      className={`page-explorer-element-item ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''} ${isPending ? 'pending' : ''}`}
      onClick={e => onClick(element, e)}
      onMouseEnter={() => onHover(element)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="page-explorer-element-dot" style={{ background: catInfo.color }} />
      <div className="page-explorer-element-info">
        <span className="page-explorer-element-tag">{element.tag}</span>
        {element.id && <span className="page-explorer-element-id">#{element.id}</span>}
        {element.text && <span className="page-explorer-element-text">{element.text.length > 30 ? element.text.substring(0, 30) + '...' : element.text}</span>}
        {element.placeholder && <span className="page-explorer-element-placeholder">placeholder="{element.placeholder}"</span>}
      </div>
      <div className="page-explorer-element-selector" title={element.selector}>
        {element.selector.length > 30 ? element.selector.substring(0, 30) + '...' : element.selector}
      </div>
      {isPending && <div className="page-explorer-element-pending-badge">✓</div>}
    </div>
  );
}
