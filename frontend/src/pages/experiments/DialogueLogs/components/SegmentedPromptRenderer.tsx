import { Tooltip } from 'antd';
import type { PromptSegment } from '@/types';

interface SegmentedPromptRendererProps {
  segments: PromptSegment[];
}

// Variable name to Chinese description mapping
const VARIABLE_DESCRIPTIONS: Record<string, string> = {
  // NPC related
  'npc': 'NPC 对象',
  'npc.id': 'NPC ID',
  'npc.name': 'NPC 名称',
  'npc.age': 'NPC 年龄',
  'npc.personality': 'NPC 性格',
  'npc.background': 'NPC 背景故事',
  'npc.knowledge_scope': 'NPC 知识范围',
  // Script related
  'script': '剧本对象',
  'script.id': '剧本 ID',
  'script.title': '剧本标题',
  'script.background': '剧本背景',
  // Clue related
  'clue': '线索对象',
  'clue.id': '线索 ID',
  'clue.name': '线索名称',
  'clue.type': '线索类型',
  'clue.detail': '线索详情（给玩家）',
  'clue.detail_for_npc': '线索详情（给 NPC）',
  'clue.trigger_keywords': '触发关键词',
  'clue.trigger_semantic_summary': '语义触发摘要',
  'clues': '线索列表',
  // Guide related
  'clue_guides': '线索指引内容',
  'has_clue': '是否有匹配线索',
  // Player related
  'player_message': '玩家消息',
};

const getVariableDescription = (variableName: string | undefined): string => {
  if (!variableName) return '未知变量';

  // Try exact match first
  if (VARIABLE_DESCRIPTIONS[variableName]) {
    return VARIABLE_DESCRIPTIONS[variableName];
  }

  // Try prefix match for nested variables like npc.xxx
  const parts = variableName.split('.');
  if (parts.length > 1) {
    const parent = parts[0];
    if (VARIABLE_DESCRIPTIONS[parent]) {
      return `${VARIABLE_DESCRIPTIONS[parent]} - ${parts.slice(1).join('.')}`;
    }
  }

  return variableName;
};

const getSegmentStyle = (type: PromptSegment['type']) => {
  switch (type) {
    case 'system':
      return { background: '#e6f7ff', borderBottom: '2px solid #1890ff' };
    case 'template':
      return { background: '#fff7e6', borderBottom: '2px solid #fa8c16' };
    case 'variable':
      return { background: '#f6ffed', borderBottom: '2px solid #52c41a' };
    default:
      return {};
  }
};

const getTypeLabel = (type: PromptSegment['type']): string => {
  switch (type) {
    case 'system':
      return '系统固定文本';
    case 'template':
      return '来自提示词模板';
    case 'variable':
      return '动态变量';
    default:
      return type;
  }
};

export const SegmentedPromptRenderer: React.FC<SegmentedPromptRendererProps> = ({ segments }) => {
  return (
    <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.6 }}>
      {segments.map((seg, i) => {
        const tooltipContent = seg.type === 'variable' ? (
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>动态变量</div>
            <div>变量名: <code style={{ background: 'rgba(255,255,255,0.2)', padding: '0 4px', borderRadius: 2 }}>{seg.variable_name}</code></div>
            <div>说明: {getVariableDescription(seg.variable_name)}</div>
          </div>
        ) : (
          <div>{getTypeLabel(seg.type)}</div>
        );

        return (
          <Tooltip key={i} title={tooltipContent} placement="top">
            <span
              style={{
                ...getSegmentStyle(seg.type),
                padding: '1px 2px',
                borderRadius: 2,
                cursor: 'help',
              }}
            >
              {seg.content}
            </span>
          </Tooltip>
        );
      })}
    </div>
  );
};
