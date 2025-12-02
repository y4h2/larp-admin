import { Modal, Form, Input, Select, Row, Col, InputNumber, Switch, Space, Button } from 'antd';
import type { FormInstance } from 'antd';
import type { LLMConfig, LLMConfigType } from '@/api/llmConfigs';
import { CONFIG_TYPES, type LLMConfigFormValues } from '../types';

const { Option } = Select;

interface ConfigFormModalProps {
  visible: boolean;
  form: FormInstance<LLMConfigFormValues>;
  editingConfig: LLMConfig | null;
  submitting: boolean;
  selectedType: LLMConfigType | undefined;
  onFinish: (values: LLMConfigFormValues) => void;
  onCancel: () => void;
  t: (key: string) => string;
}

export const ConfigFormModal: React.FC<ConfigFormModalProps> = ({
  visible,
  form,
  editingConfig,
  submitting,
  selectedType,
  onFinish,
  onCancel,
  t,
}) => {
  return (
    <Modal
      title={editingConfig ? t('llmConfig.editConfig') : t('llmConfig.createConfig')}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={600}
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="name"
              label={t('llmConfig.configName')}
              rules={[{ required: true, message: t('llmConfig.enterName') }]}
            >
              <Input placeholder={t('llmConfig.configNamePlaceholder')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="type"
              label={t('llmConfig.type')}
              rules={[{ required: true, message: t('llmConfig.selectType') }]}
              initialValue="chat"
            >
              <Select disabled={!!editingConfig}>
                {CONFIG_TYPES.map((type) => (
                  <Option key={type} value={type}>
                    {t(`llmConfig.types.${type}`)}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="model"
          label={t('llmConfig.model')}
          rules={[{ required: true, message: t('llmConfig.enterModel') }]}
        >
          <Input placeholder={t('llmConfig.modelPlaceholder')} />
        </Form.Item>

        <Form.Item
          name="base_url"
          label={t('llmConfig.baseUrl')}
          rules={[{ required: true, message: t('llmConfig.enterBaseUrl') }]}
        >
          <Input placeholder={t('llmConfig.baseUrlPlaceholder')} />
        </Form.Item>

        <Form.Item
          name="api_key"
          label={t('llmConfig.apiKey')}
          rules={[{ required: !editingConfig, message: t('llmConfig.enterApiKey') }]}
          extra={editingConfig ? t('llmConfig.apiKeyEditHint') : undefined}
        >
          <Input.Password placeholder={t('llmConfig.apiKeyPlaceholder')} />
        </Form.Item>

        {/* Embedding options */}
        {selectedType === 'embedding' && (
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="similarity_threshold"
                label={t('llmConfig.similarityThreshold')}
                extra={t('llmConfig.similarityThresholdHint')}
              >
                <InputNumber
                  min={0}
                  max={1}
                  step={0.1}
                  style={{ width: '100%' }}
                  placeholder="0.7"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="dimensions"
                label={t('llmConfig.dimensions')}
                extra={t('llmConfig.dimensionsHint')}
              >
                <InputNumber
                  min={1}
                  style={{ width: '100%' }}
                  placeholder="1536"
                />
              </Form.Item>
            </Col>
          </Row>
        )}

        {/* Chat options */}
        {selectedType === 'chat' && (
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="temperature"
                label={t('llmConfig.temperature')}
              >
                <InputNumber
                  min={0}
                  max={2}
                  step={0.1}
                  style={{ width: '100%' }}
                  placeholder="0.7"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="max_tokens"
                label={t('llmConfig.maxTokens')}
              >
                <InputNumber
                  min={1}
                  style={{ width: '100%' }}
                  placeholder="4096"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="top_p"
                label={t('llmConfig.topP')}
              >
                <InputNumber
                  min={0}
                  max={1}
                  step={0.1}
                  style={{ width: '100%' }}
                  placeholder="1.0"
                />
              </Form.Item>
            </Col>
          </Row>
        )}

        <Form.Item name="is_default" valuePropName="checked" initialValue={false}>
          <Space>
            <Switch />
            <span>{t('llmConfig.setAsDefault')}</span>
          </Space>
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={submitting} disabled={submitting}>
              {editingConfig ? t('common.save') : t('common.create')}
            </Button>
            <Button onClick={onCancel} disabled={submitting}>{t('common.cancel')}</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};
