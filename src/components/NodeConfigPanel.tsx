import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Variable } from 'lucide-react';
import type { Node } from '@xyflow/react';
import type { FlowNodeData, NodeParameter } from '../types/nodes';
import { getNodeDefinition } from '../types/nodes';

interface NodeConfigPanelProps {
  node: Node<FlowNodeData> | null;
  onClose: () => void;
  onSave: (nodeId: string, data: FlowNodeData) => void;
  allVariables?: string[];
}

function renderVariablePreview(value: string): React.ReactNode[] {
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

function ParameterField({
  param,
  value,
  onChange,
  allVariables,
}: {
  param: NodeParameter;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
  allVariables: string[];
}) {
  const inputId = `param-${param.name}`;
  const isVariableType = param.type === 'variable';

  const insertVariable = (varName: string) => {
    const current = String(value || '');
    const newValue = current + `\${${varName}}`;
    onChange(newValue);
  };

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

    case 'variable':
      return (
        <div className="param-field">
          <label className="param-label" htmlFor={inputId}>
            {param.label}
            {param.required && <span className="required">*</span>}
            {isVariableType && <span className="variable-badge">支持变量</span>}
          </label>
          <div className="param-variable-input">
            <input
              id={inputId}
              type="text"
              value={String(value || '')}
              onChange={(e) => onChange(e.target.value)}
              className="param-input"
              placeholder={param.description || '输入值或使用 ${变量名} 引用变量'}
            />
            {allVariables.length > 0 && (
              <div className="variable-dropdown">
                <button
                  type="button"
                  className="variable-insert-btn"
                  title="插入变量引用"
                >
                  <Variable size={14} />
                </button>
                <div className="variable-dropdown-menu">
                  {allVariables.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="variable-dropdown-item"
                      onClick={() => insertVariable(v)}
                    >
                      ${`{${v}}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {param.description && <div className="param-desc">{param.description}</div>}
          {isVariableType && String(value).includes('${') && (
            <div className="variable-preview">
              预览: {renderVariablePreview(String(value))}
            </div>
          )}
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

export default function NodeConfigPanel({ node, onClose, onSave, allVariables = [] }: NodeConfigPanelProps) {
  const [parameters, setParameters] = useState<Record<string, string | number | boolean>>({});
  const definition = node ? getNodeDefinition(node.data.type) : null;

  useEffect(() => {
    if (node) {
      setParameters({ ...node.data.parameters });
    }
  }, [node]);

  const collectedVariables = useMemo(() => {
    return allVariables;
  }, [allVariables]);

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
                allVariables={collectedVariables}
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
