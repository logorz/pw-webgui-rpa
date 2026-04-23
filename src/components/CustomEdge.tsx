import { useState, useCallback } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { Plus } from 'lucide-react';

export default function CustomEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  sourceHandleId,
}: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handlePlusClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const event = new CustomEvent('quick-insert-node', {
      detail: {
        edgeId: id,
        sourceId: source,
        targetId: target,
        sourceHandleId: sourceHandleId || undefined,
        clientX: e.clientX,
        clientY: e.clientY,
      },
      bubbles: true,
    });
    window.dispatchEvent(event);
  }, [id, source, target, sourceHandleId]);

  return (
    <>
      <g
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <BaseEdge
          path={edgePath}
          markerEnd={markerEnd}
          style={{
            ...style,
            strokeWidth: isHovered ? 3 : 2,
            stroke: isHovered ? '#3b82f6' : style?.stroke || '#94a3b8',
          }}
        />

        {isHovered && (
          <EdgeLabelRenderer>
            <div
              className="edge-quick-insert"
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                pointerEvents: 'all',
              }}
              onClick={handlePlusClick}
            >
              <Plus size={14} />
            </div>
          </EdgeLabelRenderer>
        )}
      </g>
    </>
  );
}
