import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
import QuickNodePicker from './components/QuickNodePicker';
import PageExplorer from './components/PageExplorer';
import { executor } from './engine/executor';
import type { ExecutionLog } from './engine/executor';
import type { PendingAction } from './components/PageExplorer';
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

type PickerMode = 'after' | 'between';

interface PickerState {
  show: boolean;
  position: { x: number; y: number };
  mode: PickerMode;
  sourceId: string;
  targetId?: string;
  sourceHandleId?: string;
}

const initialPickerState: PickerState = {
  show: false,
  position: { x: 0, y: 0 },
  mode: 'after',
  sourceId: '',
  sourceHandleId: undefined,
};

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
  const [picker, setPicker] = useState<PickerState>(initialPickerState);
  const [showExplorer, setShowExplorer] = useState(false);

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

  useEffect(() => {
    const handleQuickAdd = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setPicker({
        show: true,
        position: { x: detail.clientX + 10, y: detail.clientY + 10 },
        mode: 'after',
        sourceId: detail.nodeId,
      });
    };

    const handleQuickInsert = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setPicker({
        show: true,
        position: { x: detail.clientX + 10, y: detail.clientY + 10 },
        mode: 'between',
        sourceId: detail.sourceId,
        targetId: detail.targetId,
        sourceHandleId: detail.sourceHandleId,
      });
    };

    window.addEventListener('quick-add-node', handleQuickAdd);
    window.addEventListener('quick-insert-node', handleQuickInsert);
    return () => {
      window.removeEventListener('quick-add-node', handleQuickAdd);
      window.removeEventListener('quick-insert-node', handleQuickInsert);
    };
  }, []);

  const createNode = useCallback(
    (type: string, position: { x: number; y: number }): Node<FlowNodeData> => {
      const def = getNodeDefinition(type);
      if (!def) {
        throw new Error(`Unknown node type: ${type}`);
      }

      const params: Record<string, string | number | boolean> = {};
      def.parameters.forEach((param) => {
        params[param.name] = param.defaultValue ?? '';
      });

      return {
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
    },
    []
  );

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
        x: event.clientX - rect.left - 50,
        y: event.clientY - rect.top - 30,
      };

      const newNode = createNode(type, position);
      setNodes((nds) => [...nds, newNode]);
    },
    [createNode, setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node<FlowNodeData>) => {
    setSelectedNode(node);
  }, []);

  const handlePickerSelect = useCallback(
    (nodeType: string) => {
      if (picker.mode === 'after' && picker.sourceId) {
        const sourceNode = nodes.find((n) => n.id === picker.sourceId);
        const newPosition = sourceNode
          ? { x: sourceNode.position.x + 20, y: sourceNode.position.y + 80 }
          : { x: 100, y: 100 };

        const newNode = createNode(nodeType, newPosition);

        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => [
          ...eds,
          {
            id: `edge-${Date.now()}`,
            source: picker.sourceId,
            target: newNode.id,
            animated: true,
          },
        ]);
      } else if (picker.mode === 'between' && picker.sourceId && picker.targetId) {
        const sourceNode = nodes.find((n) => n.id === picker.sourceId);
        const targetNode = nodes.find((n) => n.id === picker.targetId);
        const newPosition =
          sourceNode && targetNode
            ? {
                x: (sourceNode.position.x + targetNode.position.x) / 2 + 10,
                y: (sourceNode.position.y + targetNode.position.y) / 2 + 10,
              }
            : { x: 100, y: 100 };

        const newNode = createNode(nodeType, newPosition);

        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => {
          const oldEdge = eds.find(
            (e) =>
              e.source === picker.sourceId &&
              e.target === picker.targetId &&
              (picker.sourceHandleId ? e.sourceHandle === picker.sourceHandleId : true)
          );
          const filtered = eds.filter(
            (e) =>
              !(e.source === picker.sourceId &&
                e.target === picker.targetId &&
                (picker.sourceHandleId ? e.sourceHandle === picker.sourceHandleId : true))
          );
          const newEdges = [
            ...filtered,
            {
              id: `edge-${Date.now()}-a`,
              source: picker.sourceId,
              target: newNode.id,
              sourceHandle: oldEdge?.sourceHandle || picker.sourceHandleId || undefined,
              animated: true,
            },
            {
              id: `edge-${Date.now()}-b`,
              source: newNode.id,
              target: picker.targetId,
              animated: true,
            },
          ];
          return newEdges;
        });
      }

      setPicker(initialPickerState);
    },
    [picker, nodes, createNode, setNodes, setEdges]
  );

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

  const handleExplorerGenerateNodes = useCallback(
    (actions: PendingAction[]) => {
      if (actions.length === 0) return;

      const newNodes: Node<FlowNodeData>[] = [];
      const newEdges: Edge[] = [];
      let lastNodeId: string | null = null;

      const lastExistingNode = nodes.length > 0 ? nodes[nodes.length - 1] : null;
      if (lastExistingNode) {
        lastNodeId = lastExistingNode.id;
      }

      const startX = lastExistingNode ? lastExistingNode.position.x : 100;
      const startY = lastExistingNode ? lastExistingNode.position.y + 100 : 100;

      const needOpenNode = !nodes.some(n => n.data.type === 'open' || n.data.type === 'goto');
      if (needOpenNode && actions.length > 0) {
        const openDef = getNodeDefinition('open');
        if (openDef) {
          const openParams: Record<string, string | number | boolean> = {};
          openDef.parameters.forEach(p => { openParams[p.name] = p.defaultValue ?? ''; });
          openParams.url = actions[0].element.href || '';
          openParams.headless = 'false';
          const openNode: Node<FlowNodeData> = {
            id: getNodeId(),
            type: 'custom',
            position: { x: startX, y: startY },
            data: { label: openDef.label, type: 'open', parameters: openParams, icon: openDef.icon, color: openDef.color },
          };
          newNodes.push(openNode);
          if (lastNodeId) {
            newEdges.push({ id: `edge-${Date.now()}-exp-open`, source: lastNodeId, target: openNode.id, animated: true });
          }
          lastNodeId = openNode.id;
        }
      }

      actions.forEach((action, idx) => {
        const nodeType = action.nodeType === 'check' ? 'checkbox' : action.nodeType === 'uncheck' ? 'checkbox' : action.nodeType;
        const def = getNodeDefinition(nodeType);
        if (!def) return;

        const params: Record<string, string | number | boolean> = {};
        def.parameters.forEach(p => { params[p.name] = p.defaultValue ?? ''; });

        params.selector = action.element.selector;

        if (action.nodeType === 'fill' || action.nodeType === 'type') {
          params.value = action.value || '';
        } else if (action.nodeType === 'selectOption') {
          params.value = action.value || '';
        } else if (action.nodeType === 'check') {
          params.action = 'check';
        } else if (action.nodeType === 'uncheck') {
          params.action = 'uncheck';
        }

        const node: Node<FlowNodeData> = {
          id: getNodeId(),
          type: 'custom',
          position: { x: startX + (needOpenNode ? 20 : 0), y: startY + (needOpenNode ? 100 : 0) + idx * 100 },
          data: { label: def.label, type: def.type, parameters: params, icon: def.icon, color: def.color },
        };
        newNodes.push(node);

        if (lastNodeId) {
          newEdges.push({ id: `edge-${Date.now()}-exp-${idx}`, source: lastNodeId, target: node.id, animated: true });
        }
        lastNodeId = node.id;
      });

      setNodes(prev => [...prev, ...newNodes]);
      setEdges(prev => [...prev, ...newEdges]);
    },
    [nodes, setNodes, setEdges]
  );

  const collectedVariables = useMemo(() => {
    const vars: string[] = [];
    nodes.forEach((node) => {
      if (node.data.type === 'setVariable' && node.data.parameters.name) {
        const name = String(node.data.parameters.name);
        if (name && !vars.includes(name)) vars.push(name);
      }
      if (node.data.type === 'extract' && node.data.parameters.variableName) {
        const name = String(node.data.parameters.variableName);
        if (name && !vars.includes(name)) vars.push(name);
      }
      if (node.data.type === 'evaluate' && node.data.parameters.variableName) {
        const name = String(node.data.parameters.variableName);
        if (name && !vars.includes(name)) vars.push(name);
      }
      if (node.data.type === 'foreach' && node.data.parameters.variableName) {
        const name = String(node.data.parameters.variableName);
        if (name && !vars.includes(name)) vars.push(name);
      }
    });
    return vars;
  }, [nodes]);

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
          onToggleExplorer={() => setShowExplorer(prev => !prev)}
          showExplorer={showExplorer}
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

          {showExplorer && (
            <div className="app-explorer">
              <PageExplorer
                onGenerateNodes={handleExplorerGenerateNodes}
                onClose={() => setShowExplorer(false)}
              />
            </div>
          )}

          <div className="app-log">
            <LogPanel logs={logs} isExecuting={isExecuting} />
          </div>
        </div>

        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onSave={onSaveNodeConfig}
            allVariables={collectedVariables}
          />
        )}

        {showCode && (
          <CodePreview code={generatedCode} onClose={() => setShowCode(false)} />
        )}

        {picker.show && (
          <QuickNodePicker
            position={picker.position}
            onSelect={handlePickerSelect}
            onClose={() => setPicker(initialPickerState)}
          />
        )}
      </div>
    </ReactFlowProvider>
  );
}

export default App;
