import React from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type { Node, Edge, Connection } from '@xyflow/react';
import type { FlowNodeData } from '../types/nodes';
import NodePanel from '../components/NodePanel';
import FlowCanvas from '../components/FlowCanvas';
import NodeConfigPanel from '../components/NodeConfigPanel';
import LogPanel from '../components/LogPanel';
import ErrorBoundary from '../components/ErrorBoundary';
import Toolbar from '../components/Toolbar';
import CodePreview from '../components/CodePreview';
import QuickNodePicker from '../components/QuickNodePicker';
import PageExplorer from '../components/PageExplorer';
import type { PendingAction } from '../components/PageExplorer';
import type { ExecutionLog } from '../engine/executor';

export interface PickerState {
  show: boolean;
  position: { x: number; y: number };
  mode: 'after' | 'between';
  sourceId: string;
  targetId?: string;
  sourceHandleId?: string;
}

export const initialPickerState: PickerState = {
  show: false,
  position: { x: 0, y: 0 },
  mode: 'after',
  sourceId: '',
  sourceHandleId: undefined,
};

interface EditorPageProps {
  // Canvas
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  onNodesChange: any;
  onEdgesChange: any;
  onConnect: (connection: Connection) => void;
  executingNodeId: string | null;

  // Node config
  selectedNode: Node<FlowNodeData> | null;
  onSaveNodeConfig: (nodeId: string, data: FlowNodeData) => void;
  onCloseConfigPanel: () => void;
  onNodeDoubleClick: (event: React.MouseEvent, node: Node<FlowNodeData>) => void;
  allVariables: string[];

  // Run state
  logs: ExecutionLog[];
  isExecuting: boolean;
  serverConnected: boolean;

  // Toolbar actions
  onRun: () => void;
  onStop: () => void;
  onSave: () => void;
  onOpen: () => void;
  onGenerateCode: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onBackToHome: () => void;

  // Code preview
  showCode: boolean;
  generatedCode: string;
  onCloseCode: () => void;

  // Drag & drop
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;

  // Page explorer
  showExplorer: boolean;
  onToggleExplorer: () => void;
  onExplorerGenerateNodes: (actions: PendingAction[]) => void;
  onCloseExplorer: () => void;

  // Quick node picker
  picker: PickerState;
  onPickerSelect: (nodeType: string) => void;
  onClosePicker: () => void;

  // Refs
  reactFlowWrapperRef: React.RefObject<HTMLDivElement | null>;
}

export default function EditorPage({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  executingNodeId,
  selectedNode,
  onSaveNodeConfig,
  onCloseConfigPanel,
  onNodeDoubleClick,
  allVariables,
  logs,
  isExecuting,
  serverConnected,
  onRun,
  onStop,
  onSave,
  onOpen,
  onGenerateCode,
  onExport,
  onImport,
  onClear,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onBackToHome,
  showCode,
  generatedCode,
  onCloseCode,
  onDragStart,
  onDrop,
  onDragOver,
  showExplorer,
  onToggleExplorer,
  onExplorerGenerateNodes,
  onCloseExplorer,
  picker,
  onPickerSelect,
  onClosePicker,
  reactFlowWrapperRef,
}: EditorPageProps) {
  return (
    <ReactFlowProvider>
      <div className="app">
        <Toolbar
          onRun={onRun}
          onStop={onStop}
          onSave={onSave}
          onOpen={onOpen}
          onGenerateCode={onGenerateCode}
          onExport={onExport}
          onImport={onImport}
          onClear={onClear}
          onUndo={onUndo}
          onRedo={onRedo}
          isExecuting={isExecuting}
          serverConnected={serverConnected}
          canUndo={canUndo}
          canRedo={canRedo}
          onToggleExplorer={onToggleExplorer}
          showExplorer={showExplorer}
          onBackToHome={onBackToHome}
        />

        <div className="app-body" ref={reactFlowWrapperRef}>
          <div className="app-sidebar">
            <NodePanel onDragStart={onDragStart} />
          </div>

          <ErrorBoundary>
            <div className="app-canvas">
              <FlowCanvas
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeDoubleClick={onNodeDoubleClick}
                onDrop={onDrop}
                onDragOver={onDragOver}
                executingNodeId={executingNodeId}
              />
            </div>
          </ErrorBoundary>

          {showExplorer && (
            <ErrorBoundary>
              <div className="app-explorer">
                <PageExplorer
                  onGenerateNodes={onExplorerGenerateNodes}
                  onClose={onCloseExplorer}
                />
              </div>
            </ErrorBoundary>
          )}

          <div className="app-log">
            <LogPanel logs={logs} isExecuting={isExecuting} />
          </div>
        </div>

        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            onClose={onCloseConfigPanel}
            onSave={onSaveNodeConfig}
            allVariables={allVariables}
          />
        )}

        {showCode && (
          <CodePreview code={generatedCode} onClose={onCloseCode} />
        )}

        {picker.show && (
          <QuickNodePicker
            position={picker.position}
            onSelect={onPickerSelect}
            onClose={onClosePicker}
          />
        )}
      </div>
    </ReactFlowProvider>
  );
}
