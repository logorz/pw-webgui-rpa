import { useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
} from '@xyflow/react';
import type { Connection, Edge, Node, OnNodesChange, OnEdgesChange } from '@xyflow/react';
import type { ComponentType } from 'react';
import '@xyflow/react/dist/style.css';
import CustomNode from './CustomNode';
import CustomEdge from './CustomEdge';
import type { FlowNodeData } from '../types/nodes';

interface FlowCanvasProps {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  onNodesChange: OnNodesChange<Node<FlowNodeData>>;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onNodeDoubleClick: (event: React.MouseEvent, node: Node<FlowNodeData>) => void;
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  executingNodeId?: string | null;
}

const nodeTypes = { custom: CustomNode as unknown as ComponentType<any> };
const edgeTypes = { default: CustomEdge }

function FlowCanvasInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeDoubleClick,
  onDrop,
  onDragOver,
  executingNodeId,
}: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      onDrop(event);
    },
    [onDrop]
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      onDragOver(event);
    },
    [onDragOver]
  );

  const mappedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isExecuting: node.id === executingNodeId,
        },
      })),
    [nodes, executingNodeId]
  );

  return (
    <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={mappedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        deleteKeyCode={['Backspace', 'Delete']}
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Control"
      >
        <Background gap={12} size={1} />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
        <Panel position="top-center">
          <div className="canvas-hint">
            拖拽节点到此处 · 双击节点配置 · Shift+框选多选
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export default function FlowCanvas(props: FlowCanvasProps) {
  return <FlowCanvasInner {...props} />;
}
