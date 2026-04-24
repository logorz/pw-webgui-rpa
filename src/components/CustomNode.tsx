import React, { memo, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../types/nodes';
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
  Settings,
  Plus,
  MessageSquare,
  Download,
  Wifi,
  ShieldOff,
  Activity,
  Layers,
  Loader,
  Shield,
  SkipForward,
  Workflow,
  Terminal,
} from 'lucide-react';

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
  MessageSquare,
  Download,
  Wifi,
  ShieldOff,
  Activity,
  Layers,
  Loader,
  Shield,
  SkipForward,
  Workflow,
  Terminal,
};

function renderParamValue(value: string): React.ReactNode[] {
  const str = String(value);
  const regex = /\$\{(\w+)\}/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{str.slice(lastIndex, match.index)}</span>);
    }
    parts.push(
      <span key={key++} className="var-chip">{match[1]}</span>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < str.length) {
    parts.push(<span key={key++}>{str.slice(lastIndex)}</span>);
  }

  if (parts.length === 0) {
    parts.push(<span key={0}>{str}</span>);
  }

  return parts;
}

function CustomNode({ data, selected, id }: NodeProps<FlowNodeData>) {
  const Icon = iconMap[data.icon || 'Globe'] || Globe;
  const isExecuting = data.isExecuting;
  const [isHovered, setIsHovered] = useState(false);

  const handleQuickAddClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const event = new CustomEvent('quick-add-node', {
      detail: { nodeId: id, clientX: e.clientX, clientY: e.clientY },
      bubbles: true,
    });
    window.dispatchEvent(event);
  }, [id]);

  return (
    <div
      className={`custom-node ${selected ? 'selected' : ''} ${isExecuting ? 'executing' : ''}`}
      style={{ borderColor: data.color || '#3b82f6' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="node-handle"
        style={{ background: data.color || '#3b82f6' }}
      />
      
      <div className="custom-node-header" style={{ backgroundColor: `${data.color}15` || '#3b82f615' }}>
        <div className="custom-node-icon" style={{ color: data.color || '#3b82f6' }}>
          <Icon size={16} />
        </div>
        <div className="custom-node-title">{data.label}</div>
        <div className="custom-node-settings">
          <Settings size={12} />
        </div>
      </div>
      
      <div className="custom-node-body">
        {Object.entries(data.parameters || {}).length > 0 ? (
          <div className="custom-node-params">
            {Object.entries(data.parameters)
              .filter(([key]) => key !== 'description')
              .slice(0, 3)
              .map(([key, value]) => (
                <div key={key} className="custom-node-param">
                  <span className="param-key">{key}:</span>
                  <span className="param-value">{renderParamValue(String(value).substring(0, 30))}</span>
                </div>
              ))}
            {Object.entries(data.parameters).length > 3 && (
              <div className="custom-node-more">+{Object.entries(data.parameters).length - 3} more</div>
            )}
          </div>
        ) : (
          <div className="custom-node-empty">无参数</div>
        )}
      </div>

      {data.type === 'if' ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="node-handle node-handle-true"
            style={{ background: '#22c55e', left: '30%' }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="node-handle node-handle-false"
            style={{ background: '#ef4444', left: '70%' }}
          />
          <div className="if-branch-labels">
            <span className="branch-label branch-true">是</span>
            <span className="branch-label branch-false">否</span>
          </div>
        </>
      ) : data.type === 'while' || data.type === 'foreach' ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="body"
            className="node-handle node-handle-body"
            style={{ background: '#f59e0b', left: '30%' }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="done"
            className="node-handle node-handle-done"
            style={{ background: '#64748b', left: '70%' }}
          />
          <div className="if-branch-labels">
            <span className="branch-label branch-body">循环体</span>
            <span className="branch-label branch-done">结束</span>
          </div>
        </>
      ) : data.type === 'tryCatch' ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="try"
            className="node-handle node-handle-try"
            style={{ background: '#3b82f6', left: '20%' }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="catch"
            className="node-handle node-handle-catch"
            style={{ background: '#ef4444', left: '50%' }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="done"
            className="node-handle node-handle-done"
            style={{ background: '#64748b', left: '80%' }}
          />
          <div className="if-branch-labels">
            <span className="branch-label branch-try">尝试</span>
            <span className="branch-label branch-catch">捕获</span>
            <span className="branch-label branch-done">继续</span>
          </div>
        </>
      ) : data.type === 'breakLoop' ? (
        <div className="if-branch-labels">
          <span className="branch-label" style={{ color: '#f59e0b', fontSize: '9px' }}>⤴ 跳出循环</span>
        </div>
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          className="node-handle"
          style={{ background: data.color || '#3b82f6' }}
        />
      )}

      {isHovered && (
        <div
          className="quick-add-btn"
          onClick={handleQuickAddClick}
          style={{ borderColor: data.color || '#3b82f6' }}
          title="点击添加下一步指令"
        >
          <Plus size={16} />
        </div>
      )}
    </div>
  );
}

export default memo(CustomNode);
