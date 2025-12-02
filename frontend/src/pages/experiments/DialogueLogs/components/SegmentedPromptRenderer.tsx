import type { PromptSegment } from '@/types';

interface SegmentedPromptRendererProps {
  segments: PromptSegment[];
}

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

export const SegmentedPromptRenderer: React.FC<SegmentedPromptRendererProps> = ({ segments }) => {
  return (
    <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.6 }}>
      {segments.map((seg, i) => (
        <span
          key={i}
          style={{
            ...getSegmentStyle(seg.type),
            padding: '1px 2px',
            borderRadius: 2,
          }}
          title={seg.type === 'variable' ? `变量: ${seg.variable_name}` : seg.type}
        >
          {seg.content}
        </span>
      ))}
    </div>
  );
};
