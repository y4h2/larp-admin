import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Form,
  Select,
  Button,
  InputNumber,
  Divider,
  Spin,
  message,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/common';
import { settingsApi } from '@/api';
import type { GlobalSettings as GlobalSettingsType } from '@/types';

const { Option } = Select;

export default function GlobalSettings() {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const settings = await settingsApi.get();
        form.setFieldsValue(settings);
      } catch {
        // Error handled
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [form]);

  const handleSave = async (values: GlobalSettingsType) => {
    setSaving(true);
    try {
      await settingsApi.update(values);
      message.success(t('settings.settingsSaved'));
    } catch {
      message.error(t('settings.settingsSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('settings.globalSettings')}
        subtitle={t('settings.globalSettingsSubtitle')}
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={() => form.submit()}
            loading={saving}
          >
            {t('settings.saveSettings')}
          </Button>
        }
      />

      <Card>
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ maxWidth: 600 }}>
          <Divider orientation="left">{t('settings.embeddingSettings')}</Divider>

          <Form.Item
            name="default_embedding_model"
            label={t('settings.defaultEmbeddingModel')}
            extra={t('settings.defaultEmbeddingModelExtra')}
          >
            <Select placeholder={t('settings.defaultEmbeddingModel')}>
              <Option value="text-embedding-ada-002">text-embedding-ada-002 (OpenAI)</Option>
              <Option value="text-embedding-3-small">text-embedding-3-small (OpenAI)</Option>
              <Option value="text-embedding-3-large">text-embedding-3-large (OpenAI)</Option>
              <Option value="bge-large-zh">bge-large-zh (Chinese)</Option>
              <Option value="bge-large-en">bge-large-en (English)</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="default_similarity_threshold"
            label={t('settings.defaultSimilarityThreshold')}
            extra={t('settings.defaultSimilarityThresholdExtra')}
          >
            <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
