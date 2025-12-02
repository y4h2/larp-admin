import { Card, Descriptions, Space, Tag, Empty, Typography } from 'antd';
import type { DialogueLog } from '@/types';
import type { PromptTemplate, LLMConfig } from '@/api';
import { IdWithName } from '../IdWithName';

const { Text } = Typography;

interface ConfigTabProps {
  log: DialogueLog;
  getTemplate: (id: string | undefined | null) => PromptTemplate | null;
  getLlmConfig: (id: string | undefined | null) => LLMConfig | null;
  t: (key: string) => string;
}

export const ConfigTab: React.FC<ConfigTabProps> = ({ log, getTemplate, getLlmConfig, t }) => {
  const context = log.context;
  if (!context) {
    return <Empty description={t('logs.noDebugInfo')} />;
  }

  return (
    <div>
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label={t('logs.matchingStrategy')}>
          <Tag color="blue">{context.matching_strategy || '-'}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label={t('logs.threshold')}>
          {log.debug_info?.threshold != null ? (
            <Tag color="orange">{(log.debug_info.threshold * 100).toFixed(0)}%</Tag>
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

      <Card size="small" title={t('logs.unlockedClues')} style={{ marginTop: 16 }}>
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
    </div>
  );
};
