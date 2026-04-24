import { useCallback, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '../types/nodes';

interface HistoryEntry {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
}

const MAX_HISTORY = 50;

export function useUndoRedo(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  setNodes: (nodes: Node<FlowNodeData>[]) => void,
  setEdges: (edges: Edge[]) => void,
) {
  const historyRef = useRef<HistoryEntry[]>([{ nodes: [], edges: [] }]);
  const indexRef = useRef(0);
  const skipRecordRef = useRef(false);

  const recordHistory = useCallback(() => {
    if (skipRecordRef.current) {
      skipRecordRef.current = false;
      return;
    }

    const entry: HistoryEntry = {
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
    };

    if (indexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, indexRef.current + 1);
    }

    historyRef.current.push(entry);

    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    }

    indexRef.current = historyRef.current.length - 1;
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (indexRef.current <= 0) return;
    indexRef.current--;
    skipRecordRef.current = true;
    const entry = historyRef.current[indexRef.current];
    setNodes(structuredClone(entry.nodes));
    setEdges(structuredClone(entry.edges));
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    if (indexRef.current >= historyRef.current.length - 1) return;
    indexRef.current++;
    skipRecordRef.current = true;
    const entry = historyRef.current[indexRef.current];
    setNodes(structuredClone(entry.nodes));
    setEdges(structuredClone(entry.edges));
  }, [setNodes, setEdges]);

  const canUndo = indexRef.current > 0;
  const canRedo = indexRef.current < historyRef.current.length - 1;

  return { recordHistory, undo, redo, canUndo, canRedo };
}
