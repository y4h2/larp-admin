import { memo } from 'react';
import { Space, Tag, Table, Progress, Alert, Empty, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { PromptTemplate } from '@/api/templates';
import type { MatchedClue } from '@/types';

const { Text } = Typography;

interface MatchResultsPanelProps {
  lastMatchResults: MatchedClue[] | null;
  lastDebugInfo: Record<string, unknown> | null;
  selectedMatchingTemplate: PromptTemplate | null;
  t: (key: string) => string;
}

export const MatchResultsPanel = memo(function MatchResultsPanel({
  lastMatchResults,
  lastDebugInfo,
  selectedMatchingTemplate,
  t,
}: MatchResultsPanelProps) {
  const matchResultColumns: ColumnsType<MatchedClue> = [
    {
      title: t('clue.name'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: MatchedClue) => (
        <Space>
          <span>{text}</span>
          {record.is_triggered && <Tag color="green">{t('debug.triggered')}</Tag>}
        </Space>
      ),
    },
    {
      title: t('debug.score'),
      dataIndex: 'score',
      key: 'score',
      width: 120,
      render: (score: number) => (
        <Progress percent={Math.round(score * 100)} size="small" status={score >= 0.5 ? 'success' : 'normal'} />
      ),
    },
    {
      title: t('debug.matchDetails'),
      dataIndex: 'match_reasons',
      key: 'match_reasons',
      render: (reasons: string[]) => (
        <Space orientation="vertical" size={2}>
          {reasons.map((r, i) => (
            <Text key={i} type="secondary" style={{ fontSize: 12 }}>{r}</Text>
          ))}
        </Space>
      ),
    },
  ];

  if (!lastMatchResults || lastMatchResults.length === 0) {
    return <Empty description={t('debug.noMatchResults')} />;
  }

  return (
    <>
      {lastDebugInfo && (
        <Alert
          message={t('debug.debugSummary')}
          description={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <Text>{t('debug.totalCandidates')}: {String(lastDebugInfo.total_candidates ?? 0)}</Text>
              <Text>{t('debug.totalMatched')}: {String(lastDebugInfo.total_matched ?? 0)}</Text>
              <Text>{t('debug.totalTriggered')}: {String(lastDebugInfo.total_triggered ?? 0)}</Text>
              <Text>{t('debug.strategy')}: {t(`debug.${String(lastDebugInfo.strategy ?? 'keyword')}Matching`)}</Text>
            </div>
          }
          type="info"
          style={{ marginBottom: 12 }}
        />
      )}
      <Table
        columns={matchResultColumns}
        dataSource={lastMatchResults}
        rowKey="clue_id"
        size="small"
        pagination={false}
        scroll={{ y: 200 }}
      />
      {selectedMatchingTemplate && (
        <div style={{ marginTop: 16 }}>
          <Text strong style={{ fontSize: 12 }}>{t('debug.templateContent')}:</Text>
          <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, maxHeight: 200, overflow: 'auto', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', border: '1px solid #d9d9d9', marginTop: 8 }}>
            {selectedMatchingTemplate.content}
          </div>
          {selectedMatchingTemplate.variables && selectedMatchingTemplate.variables.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('template.detectedVariables')}:</Text>
              <div style={{ marginTop: 4 }}>
                {selectedMatchingTemplate.variables.map((v, i) => <Tag key={i} color="blue" style={{ marginBottom: 4 }}>{v}</Tag>)}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
});
