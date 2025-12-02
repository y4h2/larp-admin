import { Collapse, Space, Tag, Descriptions, Progress, Empty, Typography } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import type { DialogueLog } from '@/types';

const { Text } = Typography;

interface TriggeredTabProps {
  log: DialogueLog;
  t: (key: string) => string;
}

export const TriggeredTab: React.FC<TriggeredTabProps> = ({ log, t }) => {
  const triggeredClues = log.matched_clues?.filter((mc) => mc.is_triggered) || [];

  if (triggeredClues.length === 0) {
    return <Empty description={t('logs.noCluesTriggered')} />;
  }

  return (
    <Collapse
      items={triggeredClues.map((mc, i) => ({
        key: i,
        label: (
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <span>{mc.name || mc.clue_id}</span>
            <Tag color="green">{(mc.score * 100).toFixed(0)}%</Tag>
          </Space>
        ),
        children: (
          <Descriptions size="small" column={1}>
            <Descriptions.Item label={t('logs.clueId')}>
              <Text code copyable>{mc.clue_id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('logs.clueType')}>
              <Tag>{mc.clue_type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('logs.matchReasons')}>
              <Space wrap>
                {mc.match_reasons?.map((r, j) => (
                  <Tag
                    key={j}
                    color={r.includes('keyword') ? 'blue' : r.includes('LLM') ? 'purple' : 'green'}
                    style={{ maxWidth: '100%', whiteSpace: 'normal', wordBreak: 'break-word', height: 'auto' }}
                  >
                    {r}
                  </Tag>
                ))}
              </Space>
            </Descriptions.Item>
            {mc.keyword_matches && mc.keyword_matches.length > 0 && (
              <Descriptions.Item label={t('debug.keywords')}>
                <Space wrap>
                  {mc.keyword_matches.map((kw, j) => (
                    <Tag key={j} color="blue">{kw}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            )}
            {mc.embedding_similarity != null && (
              <Descriptions.Item label={t('debug.similarity')}>
                <Progress percent={Math.round(mc.embedding_similarity * 100)} size="small" />
              </Descriptions.Item>
            )}
          </Descriptions>
        ),
      }))}
    />
  );
};
