import { useState } from 'react';
import {
  Globe,
  Navigation,
  MousePointer,
  Type,
  Keyboard,
  Camera,
  Clock,
  Timer,
  X,
  GitBranch,
  Repeat,
  List,
  Variable,
  Eye,
  Database,
  CheckSquare,
  Upload,
  Save,
  Key,
  Code,
  Hash,
  Tag,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { NodeTypeDefinition } from '../types/nodes';
import { getNodesByCategory } from '../types/nodes';

const iconMap: Record<string, React.ElementType> = {
  Globe,
  Navigation,
  MousePointer,
  Type,
  Keyboard,
  Camera,
  Clock,
  Timer,
  X,
  GitBranch,
  Repeat,
  List,
  Variable,
  Eye,
  Database,
  CheckSquare,
  Upload,
  Save,
  Key,
  Code,
  Hash,
  Tag,
};

type CategoryKey = 'browser' | 'interaction' | 'control' | 'variable' | 'assertion';

const categoryConfig: Record<CategoryKey, { label: string; color: string }> = {
  browser: { label: '浏览器操作', color: '#3b82f6' },
  interaction: { label: '交互操作', color: '#8b5cf6' },
  control: { label: '流程控制', color: '#f59e0b' },
  variable: { label: '变量数据', color: '#10b981' },
  assertion: { label: '断言验证', color: '#ef4444' },
};

interface NodePanelProps {
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
}

function DraggableNodeItem({ node, onDragStart }: { node: NodeTypeDefinition; onDragStart: (event: React.DragEvent, nodeType: string) => void }) {
  const Icon = iconMap[node.icon] || Globe;

  return (
    <div
      className="node-item"
      draggable
      onDragStart={(e) => onDragStart(e, node.type)}
      title={node.description}
    >
      <div className="node-item-icon" style={{ color: node.color }}>
        <Icon size={18} />
      </div>
      <div className="node-item-info">
        <div className="node-item-label">{node.label}</div>
        <div className="node-item-desc">{node.description}</div>
      </div>
    </div>
  );
}

function CategorySection({
  category,
  onDragStart,
  defaultExpanded,
}: {
  category: CategoryKey;
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? true);
  const nodes = getNodesByCategory(category);
  const config = categoryConfig[category];

  if (nodes.length === 0) return null;

  return (
    <div className="category-section">
      <button className="category-header" onClick={() => setExpanded(!expanded)}>
        <div className="category-title">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span
            className="category-dot"
            style={{ backgroundColor: config.color }}
          />
          <span>{config.label}</span>
        </div>
        <span className="category-count">{nodes.length}</span>
      </button>
      {expanded && (
        <div className="category-nodes">
          {nodes.map((node) => (
            <DraggableNodeItem key={node.type} node={node} onDragStart={onDragStart} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function NodePanel({ onDragStart }: NodePanelProps) {
  return (
    <div className="node-panel">
      <div className="node-panel-header">
        <h3>节点面板</h3>
        <p>拖拽节点到画布</p>
      </div>
      <div className="node-panel-content">
        <CategorySection category="browser" onDragStart={onDragStart} />
        <CategorySection category="interaction" onDragStart={onDragStart} />
        <CategorySection category="control" onDragStart={onDragStart} />
        <CategorySection category="variable" onDragStart={onDragStart} />
        <CategorySection category="assertion" onDragStart={onDragStart} defaultExpanded={false} />
      </div>
    </div>
  );
}
