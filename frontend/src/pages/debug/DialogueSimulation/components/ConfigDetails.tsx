import { Space, Tag, Typography } from 'antd';
import type { LLMConfig, EmbeddingOptions, ChatOptions } from '@/api/llmConfigs';

const { Text } = Typography;

interface ConfigDetailsProps {
  config: LLMConfig | undefined;
  type: 'embedding' | 'chat';
  t: (key: string) => string;
}

export default function ConfigDetails({ config, type, t }: ConfigDetailsProps) {
  if (!config) return null;

  const options = config.options;

  // Check if there are any options to display
  const hasEmbeddingOptions = type === 'embedding' && options && (
    (options as EmbeddingOptions).similarity_threshold !== undefined ||
    (options as EmbeddingOptions).dimensions !== undefined
  );
  const hasChatOptions = type === 'chat' && options && (
    (options as ChatOptions).temperature !== undefined ||
    (options as ChatOptions).max_tokens !== undefined ||
    (options as ChatOptions).top_p !== undefined ||
    (options as ChatOptions).frequency_penalty !== undefined ||
    (options as ChatOptions).presence_penalty !== undefined
  );

  if (!hasEmbeddingOptions && !hasChatOptions) return null;

  return (
    <div
      style={{
        background: '#fafafa',
        padding: '8px 12px',
        borderRadius: 6,
        marginTop: 8,
        border: '1px solid #f0f0f0',
        fontSize: 12,
      }}
    >
      <Text type="secondary" style={{ fontSize: 11, marginBottom: 4, display: 'block' }}>
        {t('debug.configDetails')}:
      </Text>
      {type === 'embedding' && options && (
        <Space wrap size={[8, 4]}>
          {(options as EmbeddingOptions).similarity_threshold !== undefined && (
            <span>
              <Text type="secondary" style={{ fontSize: 11 }}>{t('llmConfig.similarityThreshold')}:</Text>
              <Tag color="blue" style={{ marginLeft: 4 }}>{(options as EmbeddingOptions).similarity_threshold}</Tag>
            </span>
          )}
          {(options as EmbeddingOptions).dimensions !== undefined && (
            <span>
              <Text type="secondary" style={{ fontSize: 11 }}>{t('llmConfig.dimensions')}:</Text>
              <Tag style={{ marginLeft: 4 }}>{(options as EmbeddingOptions).dimensions}</Tag>
            </span>
          )}
        </Space>
      )}
      {type === 'chat' && options && (
        <Space wrap size={[8, 4]}>
          {(options as ChatOptions).temperature !== undefined && (
            <span>
              <Text type="secondary" style={{ fontSize: 11 }}>{t('llmConfig.temperature')}:</Text>
              <Tag color="blue" style={{ marginLeft: 4 }}>{(options as ChatOptions).temperature}</Tag>
            </span>
          )}
          {(options as ChatOptions).max_tokens !== undefined && (
            <span>
              <Text type="secondary" style={{ fontSize: 11 }}>{t('llmConfig.maxTokens')}:</Text>
              <Tag color="blue" style={{ marginLeft: 4 }}>{(options as ChatOptions).max_tokens}</Tag>
            </span>
          )}
          {(options as ChatOptions).top_p !== undefined && (
            <span>
              <Text type="secondary" style={{ fontSize: 11 }}>{t('llmConfig.topP')}:</Text>
              <Tag style={{ marginLeft: 4 }}>{(options as ChatOptions).top_p}</Tag>
            </span>
          )}
          {(options as ChatOptions).frequency_penalty !== undefined && (
            <span>
              <Text type="secondary" style={{ fontSize: 11 }}>{t('debug.frequencyPenalty')}:</Text>
              <Tag style={{ marginLeft: 4 }}>{(options as ChatOptions).frequency_penalty}</Tag>
            </span>
          )}
          {(options as ChatOptions).presence_penalty !== undefined && (
            <span>
              <Text type="secondary" style={{ fontSize: 11 }}>{t('debug.presencePenalty')}:</Text>
              <Tag style={{ marginLeft: 4 }}>{(options as ChatOptions).presence_penalty}</Tag>
            </span>
          )}
        </Space>
      )}
    </div>
  );
}
