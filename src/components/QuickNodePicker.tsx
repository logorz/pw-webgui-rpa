import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import type { NodeTypeDefinition } from '../types/nodes';
import { NODE_DEFINITIONS } from '../types/nodes';
import * as Icons from 'lucide-react';

interface QuickNodePickerProps {
  position: { x: number; y: number };
  onSelect: (nodeType: string) => void;
  onClose: () => void;
  targetNodeId?: string;
  insertMode?: 'after' | 'between' | 'replace';
}

export default function QuickNodePicker({
  position,
  onSelect,
  onClose,
}: QuickNodePickerProps) {
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const filteredNodes = NODE_DEFINITIONS.filter((node) =>
    node.label.toLowerCase().includes(search.toLowerCase()) ||
    node.description.toLowerCase().includes(search.toLowerCase()) ||
    node.type.toLowerCase().includes(search.toLowerCase())
  );

  const groupedNodes: Record<string, NodeTypeDefinition[]> = {
    '浏览器操作': [],
    '交互操作': [],
    '网络控制': [],
    '流程控制': [],
    '变量数据': [],
    '断言验证': [],
  };

  filteredNodes.forEach((node) => {
    if (node.category === 'browser') {
      groupedNodes['浏览器操作'].push(node);
    } else if (node.category === 'interaction') {
      groupedNodes['交互操作'].push(node);
    } else if (node.category === 'network') {
      groupedNodes['网络控制'].push(node);
    } else if (node.category === 'control') {
      groupedNodes['流程控制'].push(node);
    } else if (node.category === 'assertion') {
      groupedNodes['断言验证'].push(node);
    } else {
      groupedNodes['变量数据'].push(node);
    }
  });

  const getIconComponent = (iconName: string) => {
    return (Icons as any)[iconName] || Icons.Globe;
  };

  return (
    <div
      className="quick-node-picker"
      ref={containerRef}
      style={{
        position: 'fixed',
        left: Math.min(position.x, window.innerWidth - 300),
        top: Math.min(position.y, window.innerHeight - 400),
        zIndex: 10000,
      }}
    >
      <div className="quick-node-picker-header">
        <Search size={16} className="quick-node-search-icon" />
        <input
          type="text"
          placeholder="搜索节点..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="quick-node-search"
          autoFocus
        />
      </div>

      <div className="quick-node-picker-list">
        {Object.entries(groupedNodes).map(([category, nodes]) => (
          nodes.length > 0 && (
            <div key={category} className="quick-node-group">
              <div className="quick-node-group-title">{category}</div>
              <div className="quick-node-items">
                {nodes.map((node) => {
                  const Icon = getIconComponent(node.icon);
                  return (
                    <button
                      key={node.type}
                      className="quick-node-item"
                      onClick={() => onSelect(node.type)}
                    >
                      <div
                        className="quick-node-item-icon"
                        style={{ color: node.color }}
                      >
                        <Icon size={16} />
                      </div>
                      <div className="quick-node-item-info">
                        <div className="quick-node-item-label">{node.label}</div>
                        <div className="quick-node-item-desc">
                          {node.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )
        ))}

        {filteredNodes.length === 0 && (
          <div className="quick-node-empty">没有找到匹配的节点</div>
        )}
      </div>
    </div>
  );
}
