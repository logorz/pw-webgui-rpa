import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '../types/nodes';
import { getNodeDefinition } from '../types/nodes';
import { getSavedFlows } from '../utils/persistence';
import { buildExecutionTree, findRootNodes, resolveVariables } from './graphUtils';

class BreakSignal extends Error {
  constructor() {
    super('BREAK');
    this.name = 'BreakSignal';
  }
}

export interface ExecutionLog {
  id: string;
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  timestamp: number;
  duration?: number;
  screenshot?: string;
}

export interface ExecutionResult {
  success: boolean;
  logs: ExecutionLog[];
  error?: string;
  totalDuration: number;
}

export type ExecutionCallback = (log: ExecutionLog) => void;

interface ExecutionContext {
  browser: any;
  context: any;
  page: any;
  variables: Record<string, string>;
  sessionId: string;
}

class Executor {
  private logs: ExecutionLog[] = [];
  private callback?: ExecutionCallback;
  private abortController: AbortController | null = null;
  private serverConnected: boolean = false;

  setCallback(callback: ExecutionCallback) {
    this.callback = callback;
  }

  private addLog(log: ExecutionLog) {
    this.logs.push(log);
    this.callback?.(log);
  }

  async checkServerConnection(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:3210/health', {
        signal: AbortSignal.timeout(2000),
      });
      this.serverConnected = response.ok;
      return this.serverConnected;
    } catch {
      this.serverConnected = false;
      return false;
    }
  }

  async execute(
    nodes: Node<FlowNodeData>[],
    edges: Edge[]
  ): Promise<ExecutionResult> {
    this.logs = [];
    this.abortController = new AbortController();
    const startTime = Date.now();

    const serverAvailable = await this.checkServerConnection();

    if (serverAvailable) {
      return this.executeReal(nodes, edges, startTime);
    } else {
      return this.executeSimulated(nodes, edges, startTime);
    }
  }

  private async executeReal(
    nodes: Node<FlowNodeData>[],
    edges: Edge[],
    startTime: number
  ): Promise<ExecutionResult> {
    const sessionId = `session-${Date.now()}`;
    try {
      const childrenMap = buildExecutionTree(nodes, edges);
      const rootNodes = findRootNodes(nodes, edges);

      if (rootNodes.length === 0 && nodes.length > 0) {
        rootNodes.push(nodes[0]);
      }

      const ctx: ExecutionContext = {
        browser: null,
        context: null,
        page: null,
        variables: {},
        sessionId,
      };

      for (const root of rootNodes) {
        await this.executeNodeReal(root.id, nodes, childrenMap, new Set(), ctx);
      }

      try {
        await fetch(`http://localhost:3210/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'close', params: {}, sessionId }),
        });
      } catch (e) { console.warn('[executor] close session failed:', e); }

      return {
        success: true,
        logs: this.logs,
        totalDuration: Date.now() - startTime,
      };
    } catch (error) {
      try {
        await fetch(`http://localhost:3210/cleanup`, { method: 'POST' });
      } catch (e) { console.warn('[executor] cleanup failed:', e); }
      return {
        success: false,
        logs: this.logs,
        error: error instanceof Error ? error.message : String(error),
        totalDuration: Date.now() - startTime,
      };
    }
  }

  private async executeNodeReal(
    nodeId: string,
    nodes: Node<FlowNodeData>[],
    childrenMap: Map<string, { trueBranch: string[]; falseBranch: string[]; bodyBranch: string[]; doneBranch: string[]; tryBranch: string[]; catchBranch: string[]; default: string[] }>,
    visited: Set<string>,
    ctx: ExecutionContext
  ): Promise<void> {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const def = getNodeDefinition(node.data.type);
    const logId = `log-${Date.now()}-${Math.random()}`;

    this.addLog({
      id: logId,
      nodeId,
      nodeType: node.data.type,
      nodeLabel: def?.label || node.data.type,
      status: 'running',
      message: `执行中: ${def?.label || node.data.type}`,
      timestamp: Date.now(),
    });

    const nodeStartTime = Date.now();

    try {
      await this.runNodeAction(node, ctx);

      this.addLog({
        id: logId,
        nodeId,
        nodeType: node.data.type,
        nodeLabel: def?.label || node.data.type,
        status: 'success',
        message: `执行成功: ${def?.label || node.data.type}`,
        timestamp: Date.now(),
        duration: Date.now() - nodeStartTime,
      });

      const children = childrenMap.get(nodeId);
      if (!children) return;

      if (node.data.type === 'if') {
        const condition = await this.evaluateConditionReal(node.data.parameters, ctx);
        if (condition) {
          for (const childId of children.trueBranch) {
            await this.executeNodeReal(childId, nodes, childrenMap, new Set(visited), ctx);
          }
        } else {
          for (const childId of children.falseBranch) {
            await this.executeNodeReal(childId, nodes, childrenMap, new Set(visited), ctx);
          }
        }
      } else if (node.data.type === 'while') {
        const maxIterations = Number(node.data.parameters.maxIterations) || 10;
        for (let i = 0; i < maxIterations; i++) {
          const condition = await this.evaluateConditionReal(node.data.parameters, ctx);
          if (!condition) break;
          try {
            for (const childId of children.bodyBranch) {
              await this.executeNodeReal(childId, nodes, childrenMap, new Set(visited), ctx);
            }
          } catch (e) {
            if (e instanceof BreakSignal) break;
            throw e;
          }
        }
        for (const childId of children.doneBranch) {
          await this.executeNodeReal(childId, nodes, childrenMap, new Set(visited), ctx);
        }
      } else if (node.data.type === 'foreach') {
        const selector = node.data.parameters.selector || 'div';
        const varName = String(node.data.parameters.variableName || 'item');
        if (ctx.page) {
          const elements = await ctx.page.locator(selector).all();
          for (const el of elements) {
            ctx.variables[varName] = await el.textContent() || '';
            try {
              for (const childId of children.bodyBranch) {
                await this.executeNodeReal(childId, nodes, childrenMap, new Set(visited), ctx);
              }
            } catch (e) {
              if (e instanceof BreakSignal) break;
              throw e;
            }
          }
        }
        for (const childId of children.doneBranch) {
          await this.executeNodeReal(childId, nodes, childrenMap, new Set(visited), ctx);
        }
      } else if (node.data.type === 'tryCatch') {
        const errorVar = String(node.data.parameters.errorVariable || 'errorMessage');
        try {
          for (const childId of children.tryBranch) {
            await this.executeNodeReal(childId, nodes, childrenMap, new Set(visited), ctx);
          }
        } catch (e) {
          ctx.variables[errorVar] = e instanceof Error ? e.message : String(e);
          for (const childId of children.catchBranch) {
            await this.executeNodeReal(childId, nodes, childrenMap, new Set(visited), ctx);
          }
        }
        for (const childId of children.doneBranch) {
          await this.executeNodeReal(childId, nodes, childrenMap, new Set(visited), ctx);
        }
      } else if (node.data.type === 'breakLoop') {
        throw new BreakSignal();
      } else if (node.data.type === 'log') {
        const message = resolveVariables(
          { message: node.data.parameters.message || '' },
          ctx.variables
        ).message;
        const level = node.data.parameters.level || 'info';
        this.addLog({
          id: `log-${Date.now()}-${Math.random()}`,
          nodeId,
          nodeType: 'log',
          nodeLabel: '输出日志',
          status: level === 'error' ? 'error' : level === 'warn' ? 'running' : 'success',
          message: `[${String(level).toUpperCase()}] ${message}`,
          timestamp: Date.now(),
          duration: 0,
        });
      } else if (node.data.type === 'callSubflow') {
        const flowName = String(node.data.parameters.flowName || '');
        if (!flowName) throw new Error('子流程名称不能为空');
        const savedFlows = getSavedFlows();
        const targetFlow = savedFlows.find(f => f.name === flowName);
        if (!targetFlow) throw new Error(`未找到名为"${flowName}"的已保存流程`);
        if (targetFlow.nodes && targetFlow.edges) {
          const subChildrenMap = buildExecutionTree(targetFlow.nodes, targetFlow.edges);
          const subRootNodes = findRootNodes(targetFlow.nodes, targetFlow.edges);
          if (subRootNodes.length === 0 && targetFlow.nodes.length > 0) {
            subRootNodes.push(targetFlow.nodes[0]);
          }
          for (const root of subRootNodes) {
            await this.executeNodeReal(root.id, targetFlow.nodes, subChildrenMap, new Set(), ctx);
          }
        }
      } else {
        for (const childId of children.default) {
          await this.executeNodeReal(childId, nodes, childrenMap, visited, ctx);
        }
      }
    } catch (error) {
      this.addLog({
        id: logId,
        nodeId,
        nodeType: node.data.type,
        nodeLabel: def?.label || node.data.type,
        status: 'error',
        message: `执行失败: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
        duration: Date.now() - nodeStartTime,
      });
      throw error;
    }
  }

  private async runNodeAction(node: Node<FlowNodeData>, ctx: ExecutionContext): Promise<void> {
    const p = resolveVariables(node.data.parameters, ctx.variables);
    const action = node.data.type;

    let response: Response;
    try {
      response = await fetch('http://localhost:3210/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params: p, sessionId: ctx.sessionId }),
      });
    } catch (fetchError) {
      throw new Error('无法连接执行服务器，请确认服务器已启动 (npm run server)');
    }

    const result = await response.json();

    if (!result.success) {
      const errorMsg = result.error || 'Execution failed';
      if (errorMsg.includes("Executable doesn't exist") || errorMsg.includes('playwright install')) {
        throw new Error('Playwright 浏览器未安装，请运行: npx playwright install chromium');
      }
      throw new Error(errorMsg);
    }

    if (result.variables) {
      Object.assign(ctx.variables, result.variables);
    }
  }

  private async evaluateConditionReal(
    params: Record<string, string | number | boolean>,
    ctx: ExecutionContext
  ): Promise<boolean> {
    try {
      const resolvedParams = resolveVariables(params, ctx.variables);
      const response = await fetch('http://localhost:3210/evaluate-condition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params: resolvedParams, sessionId: ctx.sessionId }),
      });
      const result = await response.json();
      return result.result === true;
    } catch {
      return false;
    }
  }

  private async executeSimulated(
    nodes: Node<FlowNodeData>[],
    edges: Edge[],
    startTime: number
  ): Promise<ExecutionResult> {
    this.addLog({
      id: `log-sim-${Date.now()}`,
      nodeId: 'system',
      nodeType: 'system',
      nodeLabel: '系统',
      status: 'running',
      message: '⚠️ 未连接执行服务，使用模拟执行模式',
      timestamp: Date.now(),
    });

    try {
      const childrenMap = buildExecutionTree(nodes, edges);
      const rootNodes = findRootNodes(nodes, edges);

      if (rootNodes.length === 0 && nodes.length > 0) {
        rootNodes.push(nodes[0]);
      }

      for (const root of rootNodes) {
        await this.executeNodeSimulated(root.id, nodes, childrenMap, new Set());
      }

      return {
        success: true,
        logs: this.logs,
        totalDuration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        logs: this.logs,
        error: error instanceof Error ? error.message : String(error),
        totalDuration: Date.now() - startTime,
      };
    }
  }

  private async executeNodeSimulated(
    nodeId: string,
    nodes: Node<FlowNodeData>[],
    childrenMap: Map<string, { trueBranch: string[]; falseBranch: string[]; bodyBranch: string[]; doneBranch: string[]; tryBranch: string[]; catchBranch: string[]; default: string[] }>,
    visited: Set<string>
  ): Promise<void> {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const def = getNodeDefinition(node.data.type);
    const logId = `log-${Date.now()}-${Math.random()}`;

    this.addLog({
      id: logId,
      nodeId,
      nodeType: node.data.type,
      nodeLabel: def?.label || node.data.type,
      status: 'running',
      message: `[模拟] 执行中: ${def?.label || node.data.type}`,
      timestamp: Date.now(),
    });

    const nodeStartTime = Date.now();

    try {
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

      if (this.abortController?.signal.aborted) {
        throw new Error('执行已取消');
      }

      this.addLog({
        id: logId,
        nodeId,
        nodeType: node.data.type,
        nodeLabel: def?.label || node.data.type,
        status: 'success',
        message: `[模拟] 执行成功: ${def?.label || node.data.type}`,
        timestamp: Date.now(),
        duration: Date.now() - nodeStartTime,
      });

      const children = childrenMap.get(nodeId);
      if (!children) return;

      if (node.data.type === 'if') {
        const condition = this.evaluateConditionSimulated(node.data.parameters);
        const branch = condition ? children.trueBranch : children.falseBranch;
        for (const childId of branch) {
          await this.executeNodeSimulated(childId, nodes, childrenMap, new Set(visited));
        }
      } else if (node.data.type === 'while') {
        const maxIterations = Number(node.data.parameters.maxIterations) || 10;
        for (let i = 0; i < Math.min(maxIterations, 2); i++) {
          const condition = this.evaluateConditionSimulated(node.data.parameters);
          if (!condition) break;
          try {
            for (const childId of children.bodyBranch) {
              await this.executeNodeSimulated(childId, nodes, childrenMap, new Set(visited));
            }
          } catch (e) {
            if (e instanceof BreakSignal) break;
            throw e;
          }
        }
        for (const childId of children.doneBranch) {
          await this.executeNodeSimulated(childId, nodes, childrenMap, new Set(visited));
        }
      } else if (node.data.type === 'tryCatch') {
        try {
          for (const childId of children.tryBranch) {
            await this.executeNodeSimulated(childId, nodes, childrenMap, new Set(visited));
          }
        } catch {
          for (const childId of children.catchBranch) {
            await this.executeNodeSimulated(childId, nodes, childrenMap, new Set(visited));
          }
        }
        for (const childId of children.doneBranch) {
          await this.executeNodeSimulated(childId, nodes, childrenMap, new Set(visited));
        }
      } else if (node.data.type === 'breakLoop') {
        throw new BreakSignal();
      } else if (node.data.type === 'log') {
        const message = String(node.data.parameters.message || '');
        const level = node.data.parameters.level || 'info';
        this.addLog({
          id: `log-sim-${Date.now()}-${Math.random()}`,
          nodeId,
          nodeType: 'log',
          nodeLabel: '输出日志',
          status: level === 'error' ? 'error' : level === 'warn' ? 'running' : 'success',
          message: `[模拟] [${String(level).toUpperCase()}] ${message}`,
          timestamp: Date.now(),
          duration: 0,
        });
      } else if (node.data.type === 'callSubflow') {
        this.addLog({
          id: `log-sim-${Date.now()}-${Math.random()}`,
          nodeId,
          nodeType: 'callSubflow',
          nodeLabel: '调用子流程',
          status: 'success',
          message: `[模拟] 调用子流程: ${node.data.parameters.flowName || '(未命名)'}`,
          timestamp: Date.now(),
          duration: 0,
        });
      } else {
        for (const childId of children.default) {
          await this.executeNodeSimulated(childId, nodes, childrenMap, visited);
        }
      }
    } catch (error) {
      this.addLog({
        id: logId,
        nodeId,
        nodeType: node.data.type,
        nodeLabel: def?.label || node.data.type,
        status: 'error',
        message: `[模拟] 执行失败: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
        duration: Date.now() - nodeStartTime,
      });
      throw error;
    }
  }

  private evaluateConditionSimulated(params: Record<string, string | number | boolean>): boolean {
    switch (params.condition) {
      case 'selectorExists':
        return !!params.selector;
      case 'selectorVisible':
        return !!params.selector;
      case 'textContains':
        return !!params.text;
      case 'urlMatches':
        return !!params.url;
      case 'selectorEditable':
        return !!params.selector;
      case 'selectorChecked':
        return !!params.selector;
      case 'selectorEnabled':
        return !!params.selector;
      case 'variableTruthy':
        return !!params.variableName;
      default:
        return true;
    }
  }

  abort() {
    this.abortController?.abort();
  }
}

export const executor = new Executor();
