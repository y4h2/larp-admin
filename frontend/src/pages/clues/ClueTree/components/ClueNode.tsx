import { Tag, Tooltip, Typography } from 'antd';
import { Handle, Position } from '@xyflow/react';
import { MinusSquareOutlined, PlusSquareOutlined } from '@ant-design/icons';
import type { ClueNodeData } from '../types';
import { formatShortDate } from '../utils';

const { Text } = Typography;

// Custom node component for clues
export function ClueNode({ data }: { data: ClueNodeData }) {
  const {
    clue, onClick, onToggleCollapse, onNodeHover, visibleFields, npcMap,
    isCollapsed, hasChildren, hiddenChildCount,
    incomingEdgeCount, incomingSourceNames, isHovered
  } = data;

  const typeColor = clue.type === 'image' ? '#722ed1' : '#1890ff';

  // Check which fields to show
  const showName = visibleFields.includes('name');
  const showType = visibleFields.includes('type');
  const showDetail = visibleFields.includes('detail');
  const showNpcId = visibleFields.includes('npc_id');
  const showPrereqIds = visibleFields.includes('prereq_clue_ids');
  const showKeywords = visibleFields.includes('trigger_keywords');
  const showCreatedAt = visibleFields.includes('created_at');
  const showUpdatedAt = visibleFields.includes('updated_at');

  const handleCollapseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCollapse(clue.id);
  };

  return (
    <div
      style={{
        padding: '10px 14px',
        border: `2px solid ${isHovered ? '#1890ff' : typeColor}`,
        borderRadius: 8,
        background: isCollapsed ? '#f5f5f5' : '#fff',
        minWidth: 120,
        maxWidth: 240,
        cursor: 'pointer',
        boxShadow: isHovered ? '0 0 12px rgba(24,144,255,0.5)' : '0 2px 8px rgba(0,0,0,0.1)',
        position: 'relative',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onClick={() => onClick(clue.id)}
      onMouseEnter={() => onNodeHover(clue.id)}
      onMouseLeave={() => onNodeHover(null)}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />

      {/* Incoming edge count badge */}
      {incomingEdgeCount > 0 && (
        <Tooltip
          title={
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>来源节点:</div>
              {incomingSourceNames.map((name, i) => (
                <div key={i}>• {name}</div>
              ))}
            </div>
          }
        >
          <div
            style={{
              position: 'absolute',
              top: -8,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#52c41a',
              color: '#fff',
              borderRadius: 10,
              padding: '0 6px',
              fontSize: 10,
              fontWeight: 'bold',
              minWidth: 18,
              textAlign: 'center',
              lineHeight: '16px',
              zIndex: 10,
              cursor: 'help',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            ↓{incomingEdgeCount}
          </div>
        </Tooltip>
      )}

      {/* Collapse/Expand button */}
      {hasChildren && (
        <div
          style={{
            position: 'absolute',
            top: -10,
            right: -10,
            background: '#fff',
            borderRadius: '50%',
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #d9d9d9',
            cursor: 'pointer',
            zIndex: 10,
          }}
          onClick={handleCollapseClick}
        >
          {isCollapsed ? (
            <PlusSquareOutlined style={{ fontSize: 12, color: '#1890ff' }} />
          ) : (
            <MinusSquareOutlined style={{ fontSize: 12, color: '#666' }} />
          )}
        </div>
      )}

      {showName && (
        <div style={{ marginBottom: 4 }}>
          <Text strong ellipsis style={{ display: 'block', maxWidth: 210 }}>
            {clue.name}
          </Text>
        </div>
      )}

      {showType && (
        <div style={{ marginBottom: 4 }}>
          <Tag color={typeColor} style={{ margin: 0 }}>
            {clue.type}
          </Tag>
        </div>
      )}

      {showDetail && clue.detail && (
        <div style={{ marginBottom: 4 }}>
          <Text ellipsis style={{ display: 'block', maxWidth: 210, fontSize: 11, color: '#888' }}>
            {(clue.detail || '').substring(0, 50)}
            {(clue.detail || '').length > 50 ? '...' : ''}
          </Text>
        </div>
      )}

      {showNpcId && clue.npc_id && (
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            👤 {npcMap.get(clue.npc_id) || clue.npc_id}
          </Text>
        </div>
      )}

      {showPrereqIds && clue.prereq_clue_ids && clue.prereq_clue_ids.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            🔗 {clue.prereq_clue_ids.length} prereq(s)
          </Text>
        </div>
      )}

      {showKeywords && clue.trigger_keywords && clue.trigger_keywords.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            🔑 {clue.trigger_keywords.length} keyword(s)
          </Text>
        </div>
      )}

      {(showCreatedAt || showUpdatedAt) && (
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 10 }}>
            {showCreatedAt && `📅 ${formatShortDate(clue.created_at)}`}
            {showCreatedAt && showUpdatedAt && ' | '}
            {showUpdatedAt && `✏️ ${formatShortDate(clue.updated_at)}`}
          </Text>
        </div>
      )}

      {/* Hidden children indicator */}
      {isCollapsed && hiddenChildCount > 0 && (
        <div style={{ marginTop: 4 }}>
          <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>
            +{hiddenChildCount} hidden
          </Tag>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </div>
  );
}
