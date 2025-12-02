import { Select, Space, Tag, Switch, Slider, Button, Alert, Typography } from 'antd';
import { BulbOutlined, BulbFilled } from '@ant-design/icons';
import type { PromptTemplate } from '@/api/templates';
import type { LLMConfig } from '@/api/llmConfigs';
import ConfigDetails from './ConfigDetails';

const { Option } = Select;
const { Text } = Typography;

interface NpcReplyConfigTabProps {
  enableNpcReply: boolean;
  npcClueTemplateId: string | undefined;
  npcNoClueTemplateId: string | undefined;
  npcChatConfigId: string | undefined;
  npcSystemTemplates: PromptTemplate[];
  chatConfigs: LLMConfig[];
  selectedNpcChatConfig: LLMConfig | undefined;
  overrideTemperature: number | undefined;
  overrideMaxTokens: number | undefined;
  onEnableChange: (value: boolean) => void;
  onClueTemplateChange: (value: string | undefined) => void;
  onNoClueTemplateChange: (value: string | undefined) => void;
  onChatConfigChange: (value: string | undefined) => void;
  onTemperatureChange: (value: number | undefined) => void;
  onMaxTokensChange: (value: number | undefined) => void;
  t: (key: string) => string;
}

export const NpcReplyConfigTab: React.FC<NpcReplyConfigTabProps> = ({
  enableNpcReply,
  npcClueTemplateId,
  npcNoClueTemplateId,
  npcChatConfigId,
  npcSystemTemplates,
  chatConfigs,
  selectedNpcChatConfig,
  overrideTemperature,
  overrideMaxTokens,
  onEnableChange,
  onClueTemplateChange,
  onNoClueTemplateChange,
  onChatConfigChange,
  onTemperatureChange,
  onMaxTokensChange,
  t,
}) => {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <div style={{ padding: '8px 12px', background: enableNpcReply ? '#f6ffed' : '#fafafa', borderRadius: 6, border: enableNpcReply ? '1px solid #b7eb8f' : '1px solid #d9d9d9' }}>
        <Space>
          <Switch checked={enableNpcReply} onChange={onEnableChange} size="small" />
          <Text type={enableNpcReply ? undefined : 'secondary'}>{t('debug.enableNpcReply')}</Text>
        </Space>
        <div style={{ marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>{t('debug.enableNpcReplyHint')}</Text>
        </div>
      </div>

      <div>
        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
          <BulbFilled style={{ color: '#52c41a', marginRight: 4 }} />{t('debug.npcClueTemplate')}
        </div>
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>{t('debug.npcClueTemplateHint')}</Text>
        <Select
          placeholder={t('debug.selectNpcClueTemplate')}
          value={npcClueTemplateId}
          onChange={onClueTemplateChange}
          style={{ width: '100%' }}
          allowClear
          disabled={!enableNpcReply}
        >
          {npcSystemTemplates.map((tpl) => (
            <Option key={tpl.id} value={tpl.id}>
              <Space>
                <span>{tpl.name}</span>
                <Tag color={tpl.type === 'npc_system_prompt' ? 'purple' : 'default'}>{t(`template.types.${tpl.type}`)}</Tag>
              </Space>
            </Option>
          ))}
        </Select>
      </div>

      <div>
        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
          <BulbOutlined style={{ color: '#faad14', marginRight: 4 }} />{t('debug.npcNoClueTemplate')}
        </div>
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>{t('debug.npcNoClueTemplateHint')}</Text>
        <Select
          placeholder={t('debug.selectNpcNoClueTemplate')}
          value={npcNoClueTemplateId}
          onChange={onNoClueTemplateChange}
          style={{ width: '100%' }}
          allowClear
          disabled={!enableNpcReply}
        >
          {npcSystemTemplates.map((tpl) => (
            <Option key={tpl.id} value={tpl.id}>
              <Space>
                <span>{tpl.name}</span>
                <Tag color={tpl.type === 'npc_system_prompt' ? 'purple' : 'default'}>{t(`template.types.${tpl.type}`)}</Tag>
              </Space>
            </Option>
          ))}
        </Select>
      </div>

      <div>
        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>{t('debug.npcChatModel')}</div>
        <Select
          placeholder={t('debug.selectNpcChatModel')}
          value={npcChatConfigId}
          onChange={onChatConfigChange}
          style={{ width: '100%' }}
          allowClear
          disabled={!enableNpcReply}
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
        {enableNpcReply && <ConfigDetails config={selectedNpcChatConfig} type="chat" t={t} />}
      </div>

      {enableNpcReply && npcChatConfigId && (
        <>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
              <Space>
                {t('debug.temperature')}
                {overrideTemperature !== undefined && <Tag color="orange" style={{ fontSize: 10 }}>{t('debug.override')}</Tag>}
              </Space>
            </div>
            <Slider
              min={0} max={2} step={0.1}
              value={overrideTemperature ?? 0.7}
              onChange={onTemperatureChange}
              marks={{ 0: '0', 0.7: '0.7', 1: '1', 2: '2' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>{t('debug.temperatureHint')}</Text>
              {overrideTemperature !== undefined && (
                <Button type="link" size="small" onClick={() => onTemperatureChange(undefined)} style={{ padding: 0, height: 'auto', fontSize: 11 }}>
                  {t('debug.resetToDefault')}
                </Button>
              )}
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
              <Space>
                {t('debug.maxTokens')}
                {overrideMaxTokens !== undefined && <Tag color="orange" style={{ fontSize: 10 }}>{t('debug.override')}</Tag>}
              </Space>
            </div>
            <Slider
              min={100} max={8000} step={100}
              value={overrideMaxTokens ?? 2000}
              onChange={onMaxTokensChange}
              marks={{ 100: '100', 2000: '2k', 4000: '4k', 8000: '8k' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>{t('debug.maxTokensHint')}</Text>
              {overrideMaxTokens !== undefined && (
                <Button type="link" size="small" onClick={() => onMaxTokensChange(undefined)} style={{ padding: 0, height: 'auto', fontSize: 11 }}>
                  {t('debug.resetToDefault')}
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {enableNpcReply && ((!npcClueTemplateId && !npcNoClueTemplateId) || !npcChatConfigId) && (
        <Alert type="warning" message={t('debug.npcReplyConfigWarning')} showIcon style={{ fontSize: 12 }} />
      )}
    </Space>
  );
};
