import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { addEdge, useNodesState, useEdgesState } from '@xyflow/react';
import type { Node, Edge, Connection } from '@xyflow/react';
import { Switch, Route, useLocation } from 'wouter';
import '@xyflow/react/dist/style.css';
import './App.css';
import type { FlowNodeData } from './types/nodes';
import { getNodeDefinition } from './types/nodes';
import { executor } from './engine/executor';
import type { ExecutionLog } from './engine/executor';
import type { PendingAction } from './components/PageExplorer';
import { generatePlaywrightCode } from './engine/codeGenerator';
import useProjectFile, { useAutoSave } from './hooks/useProjectFile';
import HomePage from './pages/HomePage';
import EditorPage from './pages/EditorPage';
import type { ProjectFile } from './types/project';
import { importFlowFromFile, exportFlowToFile, downloadFlowFile } from './utils/persistence';
import { useUndoRedo } from './hooks/useUndoRedo';

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
  const [, navigate] = useLocation();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>([] as Node<FlowNodeData>[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
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
  const nodeIdCounterRef = useRef(0);

  function getNodeId() {
    return `node-${++nodeIdCounterRef.current}`;
  }

  const {
    currentProject,
    hasFile,
    isDirty,
    saveProject,
    saveProjectAs,
    newProject,
    openProject,
    setDirty,
  } = useProjectFile();

  const { recordHistory, undo, redo, canUndo, canRedo } = useUndoRedo(nodes, edges, setNodes, setEdges);

  useEffect(() => {
    recordHistory();
    if (hasFile) {
      setDirty(true);
    }
  }, [nodes, edges, recordHistory, hasFile, setDirty]);

  // Warn before closing/refreshing if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleSave = useCallback(async () => {
    if (currentProject === null) {
      await saveProjectAs();
    } else {
      await saveProject();
    }
  }, [currentProject, saveProject, saveProjectAs]);

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
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, handleSave]);

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
              target: picker.targetId || '',
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

  const handleOpen = useCallback(async () => {
    await openProject();
  }, [openProject]);

  const handleGenerateCode = useCallback(() => {
    const result = generatePlaywrightCode(nodes, edges);
    setGeneratedCode(result.code);
    setShowCode(true);
  }, [nodes, edges]);

  const handleExport = useCallback(() => {
    const json = exportFlowToFile(nodes, edges, currentProject?.name);
    downloadFlowFile(json, `${currentProject?.name || 'playwright-flow'}.pwg`);
  }, [nodes, edges, currentProject]);

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
    if (!window.confirm('确定要清空所有节点吗？此操作不可撤销。')) return;
    nodeIdCounterRef.current = 0;
    setNodes([]);
    setEdges([]);
    setLogs([]);
  }, [setNodes, setEdges]);

  const handleNewProject = useCallback(() => {
    nodeIdCounterRef.current = 0;
    newProject();
    setNodes([]);
    setEdges([]);
    setLogs([]);
    setShowCode(false);
    setSelectedNode(null);
    navigate('/editor');
  }, [newProject, setNodes, setEdges, navigate]);

  const handleOpenProjectFile = useCallback((project: ProjectFile) => {
    setNodes(project.nodes);
    setEdges(project.edges);
    navigate('/editor');
  }, [setNodes, setEdges, navigate]);

  const handleImportProject = useCallback((project: ProjectFile) => {
    setNodes(project.nodes);
    setEdges(project.edges);
    navigate('/editor');
  }, [setNodes, setEdges, navigate]);

  const handleBackToHome = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm('当前工程有未保存的修改，确定要返回管理页面吗？');
      if (!confirmed) return;
    }
    navigate('/');
  }, [isDirty, navigate]);

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
          openParams.url = actions[0].element?.href || '';
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

        params.selector = action.customSelector || action.element?.selector || '';

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

  useAutoSave(nodes, edges, saveProject, isDirty, hasFile);

  return (
    <div className="app-container">
      <Switch>
        <Route path="/">
          <HomePage
            onNewProject={handleNewProject}
            onOpenProject={handleOpenProjectFile}
            onImportProject={handleImportProject}
          />
        </Route>
        <Route path="/editor">
          <EditorPage
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            executingNodeId={executingNodeId}
            selectedNode={selectedNode}
            onSaveNodeConfig={onSaveNodeConfig}
            onCloseConfigPanel={() => setSelectedNode(null)}
            onNodeDoubleClick={onNodeDoubleClick}
            allVariables={collectedVariables}
            logs={logs}
            isExecuting={isExecuting}
            serverConnected={serverConnected}
            onRun={handleRun}
            onStop={handleStop}
            onSave={handleSave}
            onOpen={handleOpen}
            onGenerateCode={handleGenerateCode}
            onExport={handleExport}
            onImport={handleImport}
            onClear={handleClear}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onBackToHome={handleBackToHome}
            showCode={showCode}
            generatedCode={generatedCode}
            onCloseCode={() => setShowCode(false)}
            onDragStart={onDragStart}
            onDrop={onDrop}
            onDragOver={onDragOver}
            showExplorer={showExplorer}
            onToggleExplorer={() => setShowExplorer(prev => !prev)}
            onExplorerGenerateNodes={handleExplorerGenerateNodes}
            onCloseExplorer={() => setShowExplorer(false)}
            picker={picker}
            onPickerSelect={handlePickerSelect}
            onClosePicker={() => setPicker(initialPickerState)}
            reactFlowWrapperRef={reactFlowWrapper}
          />
        </Route>
      </Switch>
    </div>
  );
}

export default App;
