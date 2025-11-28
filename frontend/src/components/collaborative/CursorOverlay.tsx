import { useEffect, useState, useMemo } from 'react';
import { Tooltip } from 'antd';
import { calculateCursorPosition, type CursorPixelPosition } from '@/utils/cursorPosition';

export interface RemoteCursor {
  odystyleId: string;
  userId: string;
  userName: string;
  color: string;
  cursor: {
    index: number;
    length: number;
  } | null;
}

interface CursorOverlayProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  remoteCursors: RemoteCursor[];
  textValue: string;
}

interface CursorWithPosition extends RemoteCursor {
  position: CursorPixelPosition | null;
  selectionEnd: CursorPixelPosition | null;
}

export default function CursorOverlay({
  textareaRef,
  remoteCursors,
  textValue,
}: CursorOverlayProps) {
  const [cursorsWithPositions, setCursorsWithPositions] = useState<CursorWithPosition[]>([]);

  // Calculate pixel positions for all cursors
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const newCursors: CursorWithPosition[] = remoteCursors
      .filter((c) => c.cursor !== null)
      .map((cursor) => {
        const position = calculateCursorPosition(textarea, cursor.cursor!.index);
        const selectionEnd =
          cursor.cursor!.length > 0
            ? calculateCursorPosition(textarea, cursor.cursor!.index + cursor.cursor!.length)
            : null;

        return {
          ...cursor,
          position,
          selectionEnd,
        };
      });

    setCursorsWithPositions(newCursors);
  }, [remoteCursors, textareaRef, textValue]);

  // Recalculate on scroll
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleScroll = () => {
      const newCursors: CursorWithPosition[] = remoteCursors
        .filter((c) => c.cursor !== null)
        .map((cursor) => {
          const position = calculateCursorPosition(textarea, cursor.cursor!.index);
          const selectionEnd =
            cursor.cursor!.length > 0
              ? calculateCursorPosition(textarea, cursor.cursor!.index + cursor.cursor!.length)
              : null;

          return {
            ...cursor,
            position,
            selectionEnd,
          };
        });

      setCursorsWithPositions(newCursors);
    };

    textarea.addEventListener('scroll', handleScroll);
    return () => textarea.removeEventListener('scroll', handleScroll);
  }, [remoteCursors, textareaRef]);

  // Get textarea bounds for clipping
  const textareaBounds = useMemo(() => {
    const textarea = textareaRef.current;
    if (!textarea) return null;

    const rect = textarea.getBoundingClientRect();
    const computed = getComputedStyle(textarea);
    const paddingTop = parseInt(computed.paddingTop) || 0;
    const paddingBottom = parseInt(computed.paddingBottom) || 0;
    const paddingLeft = parseInt(computed.paddingLeft) || 0;
    const paddingRight = parseInt(computed.paddingRight) || 0;
    const borderTop = parseInt(computed.borderTopWidth) || 0;
    const borderLeft = parseInt(computed.borderLeftWidth) || 0;

    return {
      top: borderTop + paddingTop,
      left: borderLeft + paddingLeft,
      width: rect.width - paddingLeft - paddingRight - borderLeft * 2,
      height: rect.height - paddingTop - paddingBottom - borderTop * 2,
    };
  }, [textareaRef, textValue]);

  if (cursorsWithPositions.length === 0 || !textareaBounds) {
    return null;
  }

  return (
    <div
      className="cursor-overlay"
      style={{
        position: 'absolute',
        top: -20,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {cursorsWithPositions.map((cursor) => {
        if (!cursor.position) return null;

        // Check if cursor is within visible area
        const isVisible =
          cursor.position.top >= 0 &&
          cursor.position.top < textareaBounds.height + textareaBounds.top &&
          cursor.position.left >= 0;

        if (!isVisible) return null;

        return (
          <div key={cursor.userId}>
            {/* Selection highlight */}
            {cursor.selectionEnd && cursor.cursor && cursor.cursor.length > 0 && (
              <SelectionHighlight
                startPos={cursor.position}
                endPos={cursor.selectionEnd}
                color={cursor.color}
                textareaBounds={textareaBounds}
                topOffset={20}
              />
            )}

            {/* Cursor line */}
            <div
              className="remote-cursor"
              style={{
                position: 'absolute',
                top: cursor.position.top + 20,
                left: cursor.position.left,
                width: 2,
                height: cursor.position.height,
                backgroundColor: cursor.color,
                borderRadius: 1,
                animation: 'cursor-blink 1.2s ease-in-out infinite',
                zIndex: 10,
              }}
            >
              {/* User name label */}
              <Tooltip title={cursor.userName} placement="top">
                <div
                  style={{
                    position: 'absolute',
                    top: -18,
                    left: 0,
                    backgroundColor: cursor.color,
                    color: 'white',
                    fontSize: 10,
                    padding: '1px 4px',
                    borderRadius: 2,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'auto',
                    fontWeight: 500,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  }}
                >
                  {cursor.userName}
                </div>
              </Tooltip>
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes cursor-blink {
          0%, 40% { opacity: 1; }
          50%, 90% { opacity: 0.3; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// Selection highlight component
function SelectionHighlight({
  startPos,
  endPos,
  color,
  textareaBounds,
  topOffset = 0,
}: {
  startPos: CursorPixelPosition;
  endPos: CursorPixelPosition;
  color: string;
  textareaBounds: { top: number; left: number; width: number; height: number };
  topOffset?: number;
}) {
  // Simple single-line selection for now
  // For multi-line selection, this would need to be more complex
  const isSameLine = Math.abs(startPos.top - endPos.top) < 5;

  if (isSameLine) {
    return (
      <div
        style={{
          position: 'absolute',
          top: startPos.top + topOffset,
          left: startPos.left,
          width: Math.max(0, endPos.left - startPos.left),
          height: startPos.height,
          backgroundColor: color,
          opacity: 0.2,
          borderRadius: 2,
        }}
      />
    );
  }

  // Multi-line selection - render multiple rectangles
  const lineHeight = startPos.height;
  const lines: JSX.Element[] = [];

  // First line (from start to end of line)
  lines.push(
    <div
      key="first"
      style={{
        position: 'absolute',
        top: startPos.top + topOffset,
        left: startPos.left,
        width: textareaBounds.width - startPos.left + textareaBounds.left,
        height: lineHeight,
        backgroundColor: color,
        opacity: 0.2,
        borderRadius: 2,
      }}
    />
  );

  // Middle lines (full width)
  const middleLines = Math.floor((endPos.top - startPos.top) / lineHeight) - 1;
  for (let i = 0; i < middleLines; i++) {
    lines.push(
      <div
        key={`middle-${i}`}
        style={{
          position: 'absolute',
          top: startPos.top + lineHeight * (i + 1) + topOffset,
          left: textareaBounds.left,
          width: textareaBounds.width,
          height: lineHeight,
          backgroundColor: color,
          opacity: 0.2,
        }}
      />
    );
  }

  // Last line (from start of line to end position)
  if (endPos.top > startPos.top + lineHeight) {
    lines.push(
      <div
        key="last"
        style={{
          position: 'absolute',
          top: endPos.top + topOffset,
          left: textareaBounds.left,
          width: endPos.left - textareaBounds.left,
          height: lineHeight,
          backgroundColor: color,
          opacity: 0.2,
          borderRadius: 2,
        }}
      />
    );
  }

  return <>{lines}</>;
}
