import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '../types/nodes';

export interface FlowData {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  version: string;
  createdAt: string;
  name?: string;
}

const STORAGE_KEY = 'playwright-flows';
const CURRENT_FLOW_KEY = 'playwright-current-flow';

export function saveFlow(nodes: Node<FlowNodeData>[], edges: Edge[], name?: string): string {
  const flowData: FlowData = {
    nodes,
    edges,
    version: '1.0',
    createdAt: new Date().toISOString(),
    name: name || `Flow_${Date.now()}`,
  };

  const json = JSON.stringify(flowData, null, 2);
  localStorage.setItem(CURRENT_FLOW_KEY, json);

  const flows = getSavedFlows();
  flows.push(flowData);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flows));

  return json;
}

export function loadFlow(json: string): FlowData | null {
  try {
    const data = JSON.parse(json) as FlowData;
    if (!data.nodes || !data.edges) {
      throw new Error('Invalid flow data');
    }
    return data;
  } catch (error) {
    console.error('Failed to load flow:', error);
    return null;
  }
}

export function loadCurrentFlow(): FlowData | null {
  const json = localStorage.getItem(CURRENT_FLOW_KEY);
  if (!json) return null;
  return loadFlow(json);
}

export function getSavedFlows(): FlowData[] {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return [];
    return JSON.parse(json) as FlowData[];
  } catch {
    return [];
  }
}

export function exportFlowToFile(nodes: Node<FlowNodeData>[], edges: Edge[], name?: string): string {
  const flowData: FlowData = {
    nodes,
    edges,
    version: '1.0',
    createdAt: new Date().toISOString(),
    name: name || `Flow_${Date.now()}`,
  };

  return JSON.stringify(flowData, null, 2);
}

export function downloadFlowFile(json: string, filename?: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `playwright-flow-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importFlowFromFile(file: File): Promise<FlowData | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve(loadFlow(content));
    };
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}
