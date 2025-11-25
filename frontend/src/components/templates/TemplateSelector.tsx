import { useState, useEffect } from 'react';
import { Select, Button, Space, Modal, Form, Input, message } from 'antd';
import { PlusOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { templateApi } from '@/api';
import type { PromptTemplate, TemplateCreateData } from '@/api/templates';

const { Option, OptGroup } = Select;

interface TemplateSelectorProps {
  type?: PromptTemplate['type'];
  value?: string;
  onChange?: (templateId: string | undefined, template?: PromptTemplate) => void;
  onTemplateLoad?: (content: string) => void;
}

export default function TemplateSelector({
  type,
  value,
  onChange,
  onTemplateLoad,
}: TemplateSelectorProps) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await templateApi.list({
        type,
        page_size: 100,
      });
      setTemplates(data.items);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [type]);

  const handleSelect = async (templateId: string) => {
    try {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        onChange?.(templateId, template);
        onTemplateLoad?.(template.content);
      }
    } catch {
      message.error(t('common.loadFailed'));
    }
  };

  const handleDuplicate = async () => {
    if (!value) return;
    try {
      const duplicated = await templateApi.duplicate(value);
      await fetchTemplates();
      onChange?.(duplicated.id, duplicated);
      onTemplateLoad?.(duplicated.content);
      message.success(t('template.duplicateSuccess'));
    } catch {
      message.error(t('template.duplicateFailed'));
    }
  };

  const handleCreate = async (values: { name: string; description?: string }) => {
    try {
      const createData: TemplateCreateData = {
        name: values.name,
        description: values.description,
        type: type || 'custom',
        content: '',
      };
      const created = await templateApi.create(createData);
      await fetchTemplates();
      onChange?.(created.id, created);
      onTemplateLoad?.(created.content);
      setCreateModalVisible(false);
      form.resetFields();
      message.success(t('template.createSuccess'));
    } catch {
      message.error(t('template.createFailed'));
    }
  };

  // Group templates by default status
  const defaultTemplates = templates.filter((t) => t.is_default);
  const otherTemplates = templates.filter((t) => !t.is_default);

  return (
    <>
      <Space.Compact style={{ width: '100%' }}>
        <Select
          placeholder={t('template.selectTemplate')}
          value={value}
          onChange={handleSelect}
          loading={loading}
          allowClear
          style={{ flex: 1 }}
          onClear={() => {
            onChange?.(undefined);
            onTemplateLoad?.('');
          }}
        >
          {defaultTemplates.length > 0 && (
            <OptGroup label={t('template.default')}>
              {defaultTemplates.map((template) => (
                <Option key={template.id} value={template.id}>
                  {template.name}
                </Option>
              ))}
            </OptGroup>
          )}
          {otherTemplates.length > 0 && (
            <OptGroup label={t('template.globalTemplates')}>
              {otherTemplates.map((template) => (
                <Option key={template.id} value={template.id}>
                  {template.name}
                </Option>
              ))}
            </OptGroup>
          )}
        </Select>
        <Button icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
          {t('template.new')}
        </Button>
        <Button icon={<CopyOutlined />} onClick={handleDuplicate} disabled={!value}>
          {t('template.saveAs')}
        </Button>
      </Space.Compact>

      <Modal
        title={t('template.createTemplate')}
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="name"
            label={t('common.name')}
            rules={[{ required: true, message: t('template.enterName') }]}
          >
            <Input placeholder={t('template.templateNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={3} placeholder={t('template.descriptionPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
