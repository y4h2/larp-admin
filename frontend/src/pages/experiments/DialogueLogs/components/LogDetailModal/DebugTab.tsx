import { Card, Row, Col, Statistic, Descriptions, Space, Tag, Empty, Typography, Divider } from 'antd';
import {
  RightOutlined,
  SettingOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import type { DialogueLog } from '@/types';
import type { PromptTemplate, LLMConfig } from '@/api';
import { IdWithName } from '../IdWithName';

const { Text } = Typography;

interface DebugTabProps {
  log: DialogueLog;
  getTemplate: (id: string | undefined | null) => PromptTemplate | null;
  getLlmConfig: (id: string | undefined | null) => LLMConfig | null;
  t: (key: string) => string;
}

export const DebugTab: React.FC<DebugTabProps> = ({ log, getTemplate, getLlmConfig, t }) => {
  const context = log.context;
  const debugInfo = log.debug_info;
  const hasDebugInfo = debugInfo && Object.keys(debugInfo).length > 0;

  if (!context && !hasDebugInfo) {
    return <Empty description={t('logs.noDebugInfo')} />;
  }

  const totalClues = debugInfo?.total_clues || 0;
  const candidates = debugInfo?.total_candidates || 0;
  const excluded = debugInfo?.total_excluded || 0;
  const matched = debugInfo?.total_matched || 0;
  const triggered = debugInfo?.total_triggered || 0;

  return (
    <div>
      {/* Statistics Flow */}
      {hasDebugInfo && (
        <>
          <div style={{ marginBottom: 8 }}>
            <Text strong>
              <DatabaseOutlined style={{ marginRight: 8 }} />
              {t('logs.algorithmFlow')}
            </Text>
          </div>
          <Row gutter={8} style={{ marginBottom: 24 }} align="middle">
            <Col>
              <Card size="small" style={{ minWidth: 80, textAlign: 'center' }}>
                <Statistic
                  title={<span style={{ fontSize: 11 }}>{t('logs.totalClues')}</span>}
                  value={totalClues}
                  valueStyle={{ fontSize: 20, color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col><RightOutlined style={{ color: '#999' }} /></Col>
            <Col>
              <Card size="small" style={{ minWidth: 80, textAlign: 'center' }}>
                <Statistic
                  title={<span style={{ fontSize: 11 }}>{t('logs.candidates')}</span>}
                  value={candidates}
                  valueStyle={{ fontSize: 20, color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col><RightOutlined style={{ color: '#999' }} /></Col>
            <Col>
              <Card size="small" style={{ minWidth: 80, textAlign: 'center' }}>
                <Statistic
                  title={<span style={{ fontSize: 11 }}>{t('logs.matchedCount')}</span>}
                  value={matched}
                  valueStyle={{ fontSize: 20, color: '#fa8c16' }}
                />
              </Card>
            </Col>
            <Col><RightOutlined style={{ color: '#999' }} /></Col>
            <Col>
              <Card size="small" style={{ minWidth: 80, textAlign: 'center' }}>
                <Statistic
                  title={<span style={{ fontSize: 11 }}>{t('logs.triggeredCount')}</span>}
                  value={triggered}
                  valueStyle={{ fontSize: 20, color: '#52c41a' }}
                />
              </Card>
            </Col>
            {excluded > 0 && (
              <>
                <Col style={{ marginLeft: 16 }}>
                  <Card size="small" style={{ minWidth: 80, textAlign: 'center', borderStyle: 'dashed' }}>
                    <Statistic
                      title={<span style={{ fontSize: 11 }}>{t('logs.excludedCount')}</span>}
                      value={excluded}
                      valueStyle={{ fontSize: 20, color: '#ff4d4f' }}
                    />
                  </Card>
                </Col>
              </>
            )}
          </Row>
        </>
      )}

      <Divider style={{ margin: '16px 0' }} />

      {/* Configuration */}
      {context && (
        <>
          <div style={{ marginBottom: 8 }}>
            <Text strong>
              <SettingOutlined style={{ marginRight: 8 }} />
              {t('logs.matchConfig')}
            </Text>
          </div>
          <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label={t('logs.matchingStrategy')}>
              <Tag color="blue">{context.matching_strategy || '-'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('logs.threshold')}>
              {debugInfo?.threshold != null ? (
                <Tag color="orange">{(debugInfo.threshold * 100).toFixed(0)}%</Tag>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('logs.templateId')}>
              <IdWithName id={context.template_id} type="template" template={getTemplate(context.template_id)} t={t} />
            </Descriptions.Item>
            <Descriptions.Item label={t('logs.llmConfigId')}>
              <IdWithName id={context.llm_config_id} type="llmConfig" llmConfig={getLlmConfig(context.llm_config_id)} t={t} />
            </Descriptions.Item>
            <Descriptions.Item label={t('logs.npcClueTemplate')}>
              <IdWithName id={context.npc_clue_template_id} type="template" template={getTemplate(context.npc_clue_template_id)} t={t} />
            </Descriptions.Item>
            <Descriptions.Item label={t('logs.npcNoClueTemplate')}>
              <IdWithName id={context.npc_no_clue_template_id} type="template" template={getTemplate(context.npc_no_clue_template_id)} t={t} />
            </Descriptions.Item>
          </Descriptions>

          <Card size="small" title={t('logs.unlockedClues')}>
            {context.unlocked_clue_ids?.length > 0 ? (
              <Space wrap>
                {context.unlocked_clue_ids.map((id, i) => (
                  <Tag key={i}>{id}</Tag>
                ))}
              </Space>
            ) : (
              <Text type="secondary">{t('logs.noUnlockedClues')}</Text>
            )}
          </Card>
        </>
      )}
    </div>
  );
};
