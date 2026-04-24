import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '../types/nodes';

export interface BranchMap {
  trueBranch: string[];
  falseBranch: string[];
  bodyBranch: string[];
  doneBranch: string[];
  tryBranch: string[];
  catchBranch: string[];
  default: string[];
}

export function buildExecutionTree(
  nodes: Node<FlowNodeData>[],
  edges: Edge[]
): Map<string, BranchMap> {
  const childrenMap = new Map<string, BranchMap>();
  nodes.forEach(node =>
    childrenMap.set(node.id, { trueBranch: [], falseBranch: [], bodyBranch: [], doneBranch: [], tryBranch: [], catchBranch: [], default: [] })
  );
  edges.forEach(edge => {
    const entry = childrenMap.get(edge.source);
    if (!entry) return;
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (sourceNode?.data.type === 'if') {
      if (edge.sourceHandle === 'true' || entry.trueBranch.length === 0) {
        entry.trueBranch.push(edge.target);
      } else {
        entry.falseBranch.push(edge.target);
      }
    } else if (sourceNode?.data.type === 'while' || sourceNode?.data.type === 'foreach') {
      if (edge.sourceHandle === 'body') {
        entry.bodyBranch.push(edge.target);
      } else if (edge.sourceHandle === 'done') {
        entry.doneBranch.push(edge.target);
      } else if (entry.bodyBranch.length === 0) {
        entry.bodyBranch.push(edge.target);
      } else {
        entry.doneBranch.push(edge.target);
      }
    } else if (sourceNode?.data.type === 'tryCatch') {
      if (edge.sourceHandle === 'try') {
        entry.tryBranch.push(edge.target);
      } else if (edge.sourceHandle === 'catch') {
        entry.catchBranch.push(edge.target);
      } else if (edge.sourceHandle === 'done') {
        entry.doneBranch.push(edge.target);
      } else if (entry.tryBranch.length === 0) {
        entry.tryBranch.push(edge.target);
      } else if (entry.catchBranch.length === 0) {
        entry.catchBranch.push(edge.target);
      } else {
        entry.doneBranch.push(edge.target);
      }
    } else {
      entry.default.push(edge.target);
    }
  });
  return childrenMap;
}

export function findRootNodes(
  nodes: Node<FlowNodeData>[],
  edges: Edge[]
): Node<FlowNodeData>[] {
  const targetIds = new Set(edges.map(e => e.target));
  return nodes.filter(node => !targetIds.has(node.id));
}

export function resolveVariables(
  params: Record<string, string | number | boolean>,
  variables: Record<string, string>
): Record<string, string | number | boolean> {
  const resolved: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.includes('${')) {
      resolved[key] = value.replace(/\$\{(\w+)\}/g, (_, varName) => {
        return variables[varName] !== undefined ? String(variables[varName]) : `\${${varName}}`;
      });
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}
