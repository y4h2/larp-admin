import { Modal, Form, Input, Tag, Space, Button } from 'antd';
import type { FormInstance } from 'antd';
import type { LLMConfigExportItem } from '@/api/llmConfigs';

interface ApiKeyImportModalProps {
  visible: boolean;
  form: FormInstance;
  pendingImports: LLMConfigExportItem[];
  currentImportIndex: number;
  onFinish: (values: { api_key: string }) => void;
  onSkip: () => void;
  onCancel: () => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export const ApiKeyImportModal: React.FC<ApiKeyImportModalProps> = ({
  visible,
  form,
  pendingImports,
  currentImportIndex,
  onFinish,
  onSkip,
  onCancel,
  t,
}) => {
  const currentConfig = pendingImports[currentImportIndex];

  return (
    <Modal
      title={t('llmConfig.importApiKeyTitle')}
      open={visible}
      onCancel={onCancel}
      footer={null}
      maskClosable={false}
    >
      {pendingImports.length > 0 && currentImportIndex < pendingImports.length && currentConfig && (
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <div style={{ marginBottom: 16 }}>
            <Tag color="blue">{currentImportIndex + 1} / {pendingImports.length}</Tag>
            <span style={{ marginLeft: 8 }}>
              {t('llmConfig.importApiKeyHint', { name: currentConfig.name })}
            </span>
          </div>
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
            <div><strong>{t('llmConfig.model')}:</strong> {currentConfig.model}</div>
            <div><strong>{t('llmConfig.baseUrl')}:</strong> {currentConfig.base_url}</div>
            <div><strong>{t('llmConfig.type')}:</strong> {t(`llmConfig.types.${currentConfig.type}`)}</div>
          </div>
          <Form.Item
            name="api_key"
            label={t('llmConfig.apiKey')}
            rules={[{ required: true, message: t('llmConfig.enterApiKey') }]}
          >
            <Input.Password placeholder={t('llmConfig.apiKeyPlaceholder')} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {currentImportIndex < pendingImports.length - 1 ? t('common.next') : t('common.confirm')}
              </Button>
              <Button onClick={onSkip}>
                {t('llmConfig.skipConfig')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
};
