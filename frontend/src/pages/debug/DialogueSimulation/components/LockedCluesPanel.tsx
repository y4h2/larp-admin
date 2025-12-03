import { memo } from 'react';
import { Collapse, Space, Tag, Tooltip, Button, Divider, Alert, Empty, Spin, Typography } from 'antd';
import { LockOutlined, EyeOutlined } from '@ant-design/icons';
import { ClueTypeTag } from '@/components/common';
import type { TemplateRenderResponse } from '@/api/templates';
import type { Clue } from '@/types';

const { Text, Paragraph } = Typography;

interface LockedCluesPanelProps {
  lockedClues: Clue[];
  totalClues: number;
  matchingTemplateId: string | undefined;
  renderedPreviews: Record<string, TemplateRenderResponse>;
  renderingClueId: string | null;
  onRenderClue: (clue: Clue) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export const LockedCluesPanel = memo(function LockedCluesPanel({
  lockedClues,
  totalClues,
  matchingTemplateId,
  renderedPreviews,
  renderingClueId,
  onRenderClue,
  t,
}: LockedCluesPanelProps) {
  return (
    <>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
        {t('debug.totalInScript', { count: totalClues })}
      </Text>
      {lockedClues.length === 0 ? (
        <Empty description={t('debug.noLockedClues')} />
      ) : (
        <Collapse
          size="small"
          items={lockedClues.map((clue) => ({
            key: clue.id,
            label: (
              <Space>
                <ClueTypeTag type={clue.type} />
                <span>{clue.name}</span>
                {clue.prereq_clue_ids && clue.prereq_clue_ids.length > 0 && (
                  <Tooltip title={t('debug.hasPrerequisites', { count: clue.prereq_clue_ids.length })}>
                    <Tag color="orange" style={{ marginLeft: 4 }}>
                      <LockOutlined style={{ marginRight: 2 }} />
                      {clue.prereq_clue_ids.length}
                    </Tag>
                  </Tooltip>
                )}
                {renderedPreviews[clue.id] && <Tag color="green" style={{ marginLeft: 8 }}>{t('debug.rendered')}</Tag>}
              </Space>
            ),
            extra: matchingTemplateId && (
              <Tooltip title={t('debug.renderPreview')}>
                <Button
                  size="small"
                  type="text"
                  icon={renderingClueId === clue.id ? <Spin size="small" /> : <EyeOutlined />}
                  onClick={(e) => { e.stopPropagation(); onRenderClue(clue); }}
                  disabled={renderingClueId !== null}
                />
              </Tooltip>
            ),
            children: (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{t('clue.detail')}:</Text>
                  <Paragraph style={{ margin: '4px 0', fontSize: 13 }} ellipsis={{ rows: 2, expandable: true }}>{clue.detail}</Paragraph>
                </div>
                {clue.trigger_keywords && clue.trigger_keywords.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{t('clue.triggerKeywords')}:</Text>
                    <div style={{ marginTop: 4 }}>{clue.trigger_keywords.map((kw, i) => <Tag key={i} style={{ marginBottom: 4 }}>{kw}</Tag>)}</div>
                  </div>
                )}
                {renderedPreviews[clue.id] && (
                  <div style={{ marginTop: 12 }}>
                    <Divider style={{ margin: '8px 0' }} />
                    <Text strong style={{ color: '#1890ff', fontSize: 12 }}>{t('debug.renderedResult')}:</Text>
                    <div style={{ background: '#e6f7ff', padding: 12, borderRadius: 6, marginTop: 8, border: '1px solid #91d5ff', whiteSpace: 'pre-wrap', fontSize: 13, maxHeight: 150, overflow: 'auto' }}>
                      {renderedPreviews[clue.id].rendered_content || t('template.emptyResult')}
                    </div>
                    {renderedPreviews[clue.id].warnings.length > 0 && (
                      <Alert type="warning" message={t('template.renderWarnings')} description={renderedPreviews[clue.id].warnings.join(', ')} style={{ marginTop: 8, fontSize: 12 }} />
                    )}
                  </div>
                )}
              </div>
            ),
          }))}
        />
      )}
    </>
  );
});
