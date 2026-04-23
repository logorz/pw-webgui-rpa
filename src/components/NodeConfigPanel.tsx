import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import type { Node } from '@xyflow/react';
import type { FlowNodeData, NodeParameter } from '../types/nodes';
import { getNodeDefinition } from '../types/nodes';

interface NodeConfigPanelProps {
  node: Node<FlowNodeData> | null;
  onClose: () => void;
  onSave: (nodeId: string, data: FlowNodeData) => void;
}

function ParameterField({
  param,
  value,
  onChange,
}: {
  param: NodeParameter;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
}) {
  const inputId = `param-${param.name}`;

  switch (param.type) {
    case 'boolean':
      return (
        <div className="param-field">
          <label className="param-label" htmlFor={inputId}>
            {param.label}
            {param.required && <span className="required">*</span>}
          </label>
          <div className="param-boolean">
            <input
              id={inputId}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
            />
            <span>{Boolean(value) ? '是' : '否'}</span>
          </div>
          {param.description && <div className="param-desc">{param.description}</div>}
        </div>
      );

    case 'select':
      return (
        <div className="param-field">
          <label className="param-label" htmlFor={inputId}>
            {param.label}
            {param.required && <span className="required">*</span>}
          </label>
          <select
            id={inputId}
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className="param-input"
          >
            {param.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {param.description && <div className="param-desc">{param.description}</div>}
        </div>
      );

    case 'number':
      return (
        <div className="param-field">
          <label className="param-label" htmlFor={inputId}>
            {param.label}
            {param.required && <span className="required">*</span>}
          </label>
          <input
            id={inputId}
            type="number"
            value={Number(value)}
            onChange={(e) => onChange(Number(e.target.value))}
            className="param-input"
            placeholder={param.description}
          />
          {param.description && <div className="param-desc">{param.description}</div>}
        </div>
      );

    case 'textarea':
      return (
        <div className="param-field">
          <label className="param-label" htmlFor={inputId}>
            {param.label}
            {param.required && <span className="required">*</span>}
          </label>
          <textarea
            id={inputId}
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            className="param-input param-textarea"
            rows={4}
            placeholder={param.description}
          />
          {param.description && <div className="param-desc">{param.description}</div>}
        </div>
      );

    default:
      return (
        <div className="param-field">
          <label className="param-label" htmlFor={inputId}>
            {param.label}
            {param.required && <span className="required">*</span>}
          </label>
          <input
            id={inputId}
            type="text"
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            className="param-input"
            placeholder={param.description}
          />
          {param.description && <div className="param-desc">{param.description}</div>}
        </div>
      );
  }
}

export default function NodeConfigPanel({ node, onClose, onSave }: NodeConfigPanelProps) {
  const [parameters, setParameters] = useState<Record<string, string | number | boolean>>({});
  const definition = node ? getNodeDefinition(node.data.type) : null;

  useEffect(() => {
    if (node) {
      setParameters({ ...node.data.parameters });
    }
  }, [node]);

  if (!node || !definition) return null;

  const handleParamChange = (name: string, value: string | number | boolean) => {
    setParameters((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    onSave(node.id, {
      ...node.data,
      parameters,
    });
    onClose();
  };

  return (
    <div className="config-panel-overlay" onClick={onClose}>
      <div className="config-panel" onClick={(e) => e.stopPropagation()}>
        <div className="config-panel-header">
          <h3>配置节点</h3>
          <button className="config-panel-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="config-panel-body">
          <div className="config-node-info">
            <div className="config-node-type" style={{ color: definition.color }}>
              {definition.label}
            </div>
            <div className="config-node-desc">{definition.description}</div>
          </div>

          <div className="config-params">
            {definition.parameters.map((param) => (
              <ParameterField
                key={param.name}
                param={param}
                value={parameters[param.name] ?? param.defaultValue ?? ''}
                onChange={(value) => handleParamChange(param.name, value)}
              />
            ))}
          </div>
        </div>

        <div className="config-panel-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={16} />
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
