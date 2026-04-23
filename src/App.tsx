import { useState, useCallback, useRef, useEffect } from 'react';
import { addEdge, useNodesState, useEdgesState, ReactFlowProvider } from '@xyflow/react';
import type { Node, Edge, Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';
import type { FlowNodeData } from './types/nodes';
import { getNodeDefinition } from './types/nodes';
import NodePanel from './components/NodePanel';
import FlowCanvas from './components/FlowCanvas';
import NodeConfigPanel from './components/NodeConfigPanel';
import LogPanel from './components/LogPanel';
import Toolbar from './components/Toolbar';
import CodePreview from './components/CodePreview';
import { executor } from './engine/executor';
import type { ExecutionLog } from './engine/executor';
import { generatePlaywrightCode } from './engine/codeGenerator';
import {
  saveFlow,
  loadCurrentFlow,
  exportFlowToFile,
  downloadFlowFile,
  importFlowFromFile,
} from './utils/persistence';
import { useUndoRedo } from './hooks/useUndoRedo';

let nodeIdCounter = 0;

function getNodeId() {
  return `node-${++nodeIdCounter}`;
}

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node<FlowNodeData> | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingNodeId, setExecutingNodeId] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [serverConnected, setServerConnected] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const { recordHistory, undo, redo, canUndo, canRedo } = useUndoRedo(nodes, edges, setNodes, setEdges);

  useEffect(() => {
    recordHistory();
  }, [nodes, edges, recordHistory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
    },
    [setEdges]
  );

  const onDragStart = useCallback((event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const def = getNodeDefinition(type);
      if (!def) return;

      const rect = reactFlowWrapper.current?.getBoundingClientRect();
      if (!rect) return;

      const position = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      const params: Record<string, string | number | boolean> = {};
      def.parameters.forEach((param) => {
        params[param.name] = param.defaultValue ?? '';
      });

      const newNode: Node<FlowNodeData> = {
        id: getNodeId(),
        type: 'custom',
        position,
        data: {
          label: def.label,
          type: def.type,
          parameters: params,
          icon: def.icon,
          color: def.color,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node<FlowNodeData>) => {
    setSelectedNode(node);
  }, []);

  const onSaveNodeConfig = useCallback(
    (nodeId: string, data: FlowNodeData) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return { ...node, data };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  const handleRun = useCallback(async () => {
    setLogs([]);
    setIsExecuting(true);

    const connected = await executor.checkServerConnection();
    setServerConnected(connected);

    executor.setCallback((log) => {
      setLogs((prev) => {
        const existing = prev.find((l) => l.id === log.id);
        if (existing) {
          return prev.map((l) => (l.id === log.id ? log : l));
        }
        return [...prev, log];
      });

      if (log.status === 'running') {
        setExecutingNodeId(log.nodeId);
      } else {
        setExecutingNodeId(null);
      }
    });

    const result = await executor.execute(nodes, edges);
    setIsExecuting(false);
    setExecutingNodeId(null);

    if (!result.success) {
      console.error('Execution failed:', result.error);
    }
  }, [nodes, edges]);

  const handleStop = useCallback(() => {
    executor.abort();
    setIsExecuting(false);
    setExecutingNodeId(null);
  }, []);

  const handleSave = useCallback(() => {
    saveFlow(nodes, edges);
    console.log('流程已保存到本地存储');
  }, [nodes, edges]);

  const handleLoad = useCallback(() => {
    const flow = loadCurrentFlow();
    if (flow) {
      setNodes(flow.nodes);
      setEdges(flow.edges);
      console.log('流程已加载');
    } else {
      console.log('没有找到保存的流程');
    }
  }, [setNodes, setEdges]);

  const handleGenerateCode = useCallback(() => {
    const result = generatePlaywrightCode(nodes, edges);
    setGeneratedCode(result.code);
    setShowCode(true);
  }, [nodes, edges]);

  const handleExport = useCallback(() => {
    const json = exportFlowToFile(nodes, edges);
    downloadFlowFile(json);
  }, [nodes, edges]);

  const handleImport = useCallback(
    async (file: File) => {
      const flow = await importFlowFromFile(file);
      if (flow) {
        setNodes(flow.nodes);
        setEdges(flow.edges);
        console.log('流程已导入');
      } else {
        console.log('导入失败，请检查文件格式');
      }
    },
    [setNodes, setEdges]
  );

  const handleClear = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setLogs([]);
  }, [setNodes, setEdges]);

  return (
    <ReactFlowProvider>
      <div className="app">
        <Toolbar
          onRun={handleRun}
          onStop={handleStop}
          onSave={handleSave}
          onLoad={handleLoad}
          onGenerateCode={handleGenerateCode}
          onExport={handleExport}
          onImport={handleImport}
          onClear={handleClear}
          onUndo={undo}
          onRedo={redo}
          isExecuting={isExecuting}
          serverConnected={serverConnected}
          canUndo={canUndo}
          canRedo={canRedo}
        />

        <div className="app-body" ref={reactFlowWrapper}>
          <div className="app-sidebar">
            <NodePanel onDragStart={onDragStart} />
          </div>

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

          <div className="app-log">
            <LogPanel logs={logs} isExecuting={isExecuting} />
          </div>
        </div>

        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onSave={onSaveNodeConfig}
          />
        )}

        {showCode && (
          <CodePreview code={generatedCode} onClose={() => setShowCode(false)} />
        )}
      </div>
    </ReactFlowProvider>
  );
}

export default App;
