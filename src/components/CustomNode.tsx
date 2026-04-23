import { memo } from 'react';
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
  Settings,
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
};

function CustomNode({ data, selected }: NodeProps<FlowNodeData>) {
  const Icon = iconMap[data.icon || 'Globe'] || Globe;
  const isExecuting = data.isExecuting;

  return (
    <div
      className={`custom-node ${selected ? 'selected' : ''} ${isExecuting ? 'executing' : ''}`}
      style={{ borderColor: data.color || '#3b82f6' }}
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
                  <span className="param-value">{String(value).substring(0, 20)}</span>
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

      <Handle
        type="source"
        position={Position.Bottom}
        className="node-handle"
        style={{ background: data.color || '#3b82f6' }}
      />
    </div>
  );
}

export default memo(CustomNode);
