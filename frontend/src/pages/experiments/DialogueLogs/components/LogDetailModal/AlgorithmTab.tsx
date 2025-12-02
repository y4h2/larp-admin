import { Card, Row, Col, Statistic, Table, Space, Tag, Progress, Empty, Typography, Tooltip } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { DialogueLog } from '@/types';

const { Text } = Typography;

interface AlgorithmTabProps {
  log: DialogueLog;
  t: (key: string) => string;
}

export const AlgorithmTab: React.FC<AlgorithmTabProps> = ({ log, t }) => {
  const debugInfo = log.debug_info;
  const hasDebugInfo = debugInfo && Object.keys(debugInfo).length > 0;

  if (!hasDebugInfo) {
    return <Empty description={t('logs.noDebugInfo')} />;
  }

  const totalClues = debugInfo.total_clues || 0;
  const candidates = debugInfo.total_candidates || 0;
  const excluded = debugInfo.total_excluded || 0;
  const matched = debugInfo.total_matched || 0;
  const triggered = debugInfo.total_triggered || 0;

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card size="small">
            <Statistic title={t('logs.totalClues')} value={totalClues} styles={{ content: { color: '#1890ff' } }} />
          </Card>
        </Col>
        <Col span={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Text type="secondary">→</Text>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title={t('logs.candidates')} value={candidates} styles={{ content: { color: '#722ed1' } }} />
          </Card>
        </Col>
        <Col span={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Text type="secondary">→</Text>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title={t('logs.matchedCount')} value={matched} styles={{ content: { color: '#fa8c16' } }} />
          </Card>
        </Col>
        <Col span={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Text type="secondary">→</Text>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title={t('logs.triggeredCount')} value={triggered} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title={t('logs.excludedCount')} value={excluded} styles={{ content: { color: '#ff4d4f' } }} />
          </Card>
        </Col>
      </Row>

      <Card size="small" title={t('logs.matchedCluesDetail')} style={{ marginBottom: 16 }}>
        {log.matched_clues?.length > 0 ? (
          <Table
            size="small"
            dataSource={log.matched_clues}
            rowKey="clue_id"
            pagination={false}
            columns={[
              {
                title: t('logs.clueName'),
                dataIndex: 'name',
                key: 'name',
                width: 150,
                render: (name, record) => name || record.clue_id,
              },
              {
                title: t('debug.score'),
                dataIndex: 'score',
                key: 'score',
                width: 100,
                render: (score: number) => (
                  <Progress
                    percent={Math.round(score * 100)}
                    size="small"
                    status={score >= 0.8 ? 'success' : score >= 0.5 ? 'normal' : 'exception'}
                  />
                ),
              },
              {
                title: t('logs.matchReasons'),
                dataIndex: 'match_reasons',
                key: 'match_reasons',
                render: (reasons: string[]) => (
                  <Space wrap size={4}>
                    {reasons?.map((r, i) => (
                      <Tag
                        key={i}
                        color={r.includes('keyword') ? 'blue' : r.includes('LLM') ? 'purple' : 'green'}
                        style={{ maxWidth: 300, whiteSpace: 'normal', wordBreak: 'break-word', height: 'auto' }}
                      >
                        {r}
                      </Tag>
                    ))}
                  </Space>
                ),
              },
              {
                title: t('logs.triggered'),
                dataIndex: 'is_triggered',
                key: 'is_triggered',
                width: 80,
                render: (triggered: boolean) =>
                  triggered ? (
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                  ) : (
                    <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
                  ),
              },
            ]}
          />
        ) : (
          <Text type="secondary">{t('logs.noCluesMatched')}</Text>
        )}
      </Card>

      {debugInfo.excluded && debugInfo.excluded.length > 0 && (
        <Card size="small" title={t('logs.excludedClues')}>
          <Space wrap>
            {debugInfo.excluded.map((item, i) => {
              if (typeof item === 'string') {
                return <Tag key={i} color="default">{item}</Tag>;
              }
              const excluded = item as { name?: string; reason?: string; clue_id?: string; missing_prereq_ids?: string[] };
              return (
                <Tooltip
                  key={i}
                  title={
                    <div>
                      <div>{t('logs.excludeReason')}: {excluded.reason || '-'}</div>
                      {excluded.missing_prereq_ids && excluded.missing_prereq_ids.length > 0 && (
                        <div>{t('logs.missingPrereqs')}: {excluded.missing_prereq_ids.join(', ')}</div>
                      )}
                    </div>
                  }
                >
                  <Tag color="default">{excluded.name || excluded.clue_id}</Tag>
                </Tooltip>
              );
            })}
          </Space>
        </Card>
      )}
    </div>
  );
};
