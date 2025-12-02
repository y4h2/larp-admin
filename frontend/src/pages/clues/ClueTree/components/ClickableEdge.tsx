import { useState } from 'react';
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import type { ClickableEdgeData } from '../types';

export function ClickableEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
    source,
    target,
    data,
  } = props;

  const [isHovered, setIsHovered] = useState(false);

  const edgeData = data as ClickableEdgeData | undefined;
  const isHighlighted = edgeData?.isHighlighted ?? false;

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (edgeData?.onDelete) {
      edgeData.onDelete(source, target);
    }
  };

  // Determine edge color based on state
  const getEdgeColor = () => {
    if (isHovered) return '#ff4d4f';
    if (isHighlighted) return '#1890ff';
    return (style?.stroke as string) || '#888';
  };

  const getEdgeWidth = () => {
    if (isHovered) return 3;
    if (isHighlighted) return 2.5;
    return (style?.strokeWidth as number) || 2;
  };

  return (
    <>
      {/* Glow effect on hover or highlight */}
      {(isHovered || isHighlighted) && (
        <path
          d={edgePath}
          fill="none"
          strokeWidth={isHovered ? 8 : 6}
          stroke={isHovered ? '#ff4d4f' : '#1890ff'}
          strokeOpacity={0.4}
          style={{ filter: 'blur(2px)' }}
        />
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd as string}
        style={{
          ...style,
          stroke: getEdgeColor(),
          strokeWidth: getEdgeWidth(),
          transition: 'stroke 0.2s, stroke-width 0.2s',
        }}
      />
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        style={{ cursor: 'pointer' }}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
    </>
  );
}
