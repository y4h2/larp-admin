import { Select, Space, Tag, Switch, Slider, Button, Typography } from 'antd';
import { ThunderboltOutlined, RobotOutlined } from '@ant-design/icons';
import type { PromptTemplate } from '@/api/templates';
import type { LLMConfig } from '@/api/llmConfigs';
import type { MatchingStrategy } from '@/types';
import type { VectorBackend } from '../types';
import ConfigDetails from './ConfigDetails';

const { Option } = Select;
const { Text } = Typography;

const MATCHING_STRATEGIES: { value: MatchingStrategy; label: string; icon: React.ReactNode }[] = [
  { value: 'embedding', label: 'debug.embeddingMatching', icon: <ThunderboltOutlined /> },
  { value: 'llm', label: 'debug.llmMatching', icon: <RobotOutlined /> },
];

interface MatchingConfigTabProps {
  matchingStrategy: MatchingStrategy;
  matchingTemplateId: string | undefined;
  matchingLlmConfigId: string | undefined;
  matchingTemplates: PromptTemplate[];
  embeddingConfigs: LLMConfig[];
  chatConfigs: LLMConfig[];
  selectedMatchingConfig: LLMConfig | undefined;
  overrideSimilarityThreshold: number | undefined;
  overrideVectorBackend: VectorBackend | undefined;
  llmReturnAllScores: boolean;
  llmScoreThreshold: number | undefined;
  onStrategyChange: (value: MatchingStrategy) => void;
  onTemplateChange: (value: string | undefined) => void;
  onLlmConfigChange: (value: string | undefined) => void;
  onSimilarityThresholdChange: (value: number | undefined) => void;
  onVectorBackendChange: (value: VectorBackend | undefined) => void;
  onLlmReturnAllScoresChange: (value: boolean) => void;
  onLlmScoreThresholdChange: (value: number | undefined) => void;
  t: (key: string) => string;
}

export const MatchingConfigTab: React.FC<MatchingConfigTabProps> = ({
  matchingStrategy,
  matchingTemplateId,
  matchingLlmConfigId,
  matchingTemplates,
  embeddingConfigs,
  chatConfigs,
  selectedMatchingConfig,
  overrideSimilarityThreshold,
  overrideVectorBackend,
  llmReturnAllScores,
  llmScoreThreshold,
  onStrategyChange,
  onTemplateChange,
  onLlmConfigChange,
  onSimilarityThresholdChange,
  onVectorBackendChange,
  onLlmReturnAllScoresChange,
  onLlmScoreThresholdChange,
  t,
}) => {
  return (
    <Space orientation="vertical" style={{ width: '100%' }} size={12}>
      <div>
        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>{t('debug.matchingStrategy')}</div>
        <Select value={matchingStrategy} onChange={onStrategyChange} style={{ width: '100%' }}>
          {MATCHING_STRATEGIES.map((s) => (
            <Option key={s.value} value={s.value}>
              <Space>{s.icon}{t(s.label)}</Space>
            </Option>
          ))}
        </Select>
      </div>
      <div>
        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>{t('debug.matchingTemplate')}</div>
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
          {t('debug.matchingTemplateHint')}
        </Text>
        <Select
          placeholder={t('debug.selectMatchingTemplate')}
          value={matchingTemplateId}
          onChange={onTemplateChange}
          style={{ width: '100%' }}
          allowClear
        >
          {matchingTemplates.map((tpl) => (
            <Option key={tpl.id} value={tpl.id}>
              <Space>
                <span>{tpl.name}</span>
                <Tag color={tpl.type === 'clue_embedding' ? 'blue' : 'default'}>
                  {t(`template.types.${tpl.type}`)}
                </Tag>
              </Space>
            </Option>
          ))}
        </Select>
      </div>

      {matchingStrategy === 'embedding' && (
        <>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>{t('debug.selectEmbeddingConfig')}</div>
            <Select
              placeholder={t('debug.selectEmbeddingConfig')}
              value={matchingLlmConfigId}
              onChange={onLlmConfigChange}
              style={{ width: '100%' }}
              allowClear
            >
              {embeddingConfigs.map((config) => (
                <Option key={config.id} value={config.id}>
                  <Space>
                    <span>{config.name}</span>
                    <Text type="secondary" style={{ fontSize: 12 }}>({config.model})</Text>
                  </Space>
                </Option>
              ))}
            </Select>
            <ConfigDetails config={selectedMatchingConfig} type="embedding" t={t} />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
              <Space>
                {t('debug.vectorBackend')}
                {overrideVectorBackend !== undefined && (
                  <Tag color="orange" style={{ fontSize: 10 }}>{t('debug.override')}</Tag>
                )}
              </Space>
            </div>
            <Select
              placeholder={t('debug.selectVectorBackend')}
              value={overrideVectorBackend}
              onChange={onVectorBackendChange}
              style={{ width: '100%' }}
              allowClear
            >
              <Option value="pgvector">
                <Space>
                  <span>pgVector</span>
                  <Text type="secondary" style={{ fontSize: 11 }}>(PostgreSQL)</Text>
                </Space>
              </Option>
              <Option value="chroma">
                <Space>
                  <span>Chroma</span>
                  <Text type="secondary" style={{ fontSize: 11 }}>(In-memory)</Text>
                </Space>
              </Option>
            </Select>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
              {t('debug.vectorBackendHint')}
            </Text>
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
              <Space>
                {t('debug.similarityThreshold')}
                {overrideSimilarityThreshold !== undefined && (
                  <Tag color="orange" style={{ fontSize: 10 }}>{t('debug.override')}</Tag>
                )}
              </Space>
            </div>
            <Slider
              min={0} max={1} step={0.05}
              value={overrideSimilarityThreshold ?? 0.5}
              onChange={(val) => onSimilarityThresholdChange(val)}
              marks={{ 0: '0', 0.5: '0.5', 1: '1' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>{t('debug.similarityThresholdHint')}</Text>
              {overrideSimilarityThreshold !== undefined && (
                <Button type="link" size="small" onClick={() => onSimilarityThresholdChange(undefined)} style={{ padding: 0, height: 'auto', fontSize: 11 }}>
                  {t('debug.resetToDefault')}
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {matchingStrategy === 'llm' && (
        <div>
          <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>{t('debug.selectChatConfig')}</div>
          <Select
            placeholder={t('debug.selectChatConfig')}
            value={matchingLlmConfigId}
            onChange={onLlmConfigChange}
            style={{ width: '100%' }}
            allowClear
          >
            {chatConfigs.map((config) => (
              <Option key={config.id} value={config.id}>
                <Space>
                  <span>{config.name}</span>
                  <Text type="secondary" style={{ fontSize: 12 }}>({config.model})</Text>
                </Space>
              </Option>
            ))}
          </Select>
          <ConfigDetails config={selectedMatchingConfig} type="chat" t={t} />
          <div style={{ marginTop: 12, padding: '8px 12px', background: llmReturnAllScores ? '#e6f7ff' : '#fafafa', borderRadius: 6, border: llmReturnAllScores ? '1px solid #91d5ff' : '1px solid #d9d9d9' }}>
            <Space>
              <Switch checked={llmReturnAllScores} onChange={onLlmReturnAllScoresChange} size="small" />
              <Text type={llmReturnAllScores ? undefined : 'secondary'}>{t('debug.llmReturnAllScores')}</Text>
            </Space>
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>{t('debug.llmReturnAllScoresHint')}</Text>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
              {t('debug.llmScoreThreshold')}
              {llmScoreThreshold !== undefined && (
                <Button type="link" size="small" onClick={() => onLlmScoreThresholdChange(undefined)} style={{ padding: '0 4px', height: 'auto' }}>
                  {t('debug.resetToDefault')}
                </Button>
              )}
            </div>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={llmScoreThreshold ?? 0.5}
              onChange={onLlmScoreThresholdChange}
              marks={{ 0: '0', 0.5: '0.5', 1: '1' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>{t('debug.llmScoreThresholdHint')}</Text>
          </div>
        </div>
      )}
    </Space>
  );
};
