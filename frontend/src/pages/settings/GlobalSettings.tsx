import { useEffect, useState } from 'react';
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
import { settingsApi, strategyApi } from '@/api';
import type { GlobalSettings as GlobalSettingsType, AlgorithmStrategy } from '@/types';

const { Option } = Select;

export default function GlobalSettings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [strategies, setStrategies] = useState<AlgorithmStrategy[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [settings, strategiesData] = await Promise.all([
          settingsApi.get(),
          strategyApi.list({ status: 'published', page_size: 100 }),
        ]);
        setStrategies(strategiesData.items);
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
      message.success('Settings saved successfully');
    } catch {
      message.error('Failed to save settings');
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
        title="Global Settings"
        subtitle="Configure default system settings"
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={() => form.submit()}
            loading={saving}
          >
            Save Settings
          </Button>
        }
      />

      <Card>
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ maxWidth: 600 }}>
          <Divider orientation="left">Default Strategy</Divider>

          <Form.Item
            name="default_strategy_id"
            label="Default Matching Strategy"
            extra="This strategy will be used when no specific strategy is configured"
          >
            <Select placeholder="Select default strategy" allowClear>
              {strategies.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.name} {s.is_default && '(current default)'}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Divider orientation="left">Embedding Settings</Divider>

          <Form.Item
            name="default_embedding_model"
            label="Default Embedding Model"
            extra="The embedding model used for semantic matching"
          >
            <Select placeholder="Select embedding model">
              <Option value="text-embedding-ada-002">text-embedding-ada-002 (OpenAI)</Option>
              <Option value="text-embedding-3-small">text-embedding-3-small (OpenAI)</Option>
              <Option value="text-embedding-3-large">text-embedding-3-large (OpenAI)</Option>
              <Option value="bge-large-zh">bge-large-zh (Chinese)</Option>
              <Option value="bge-large-en">bge-large-en (English)</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="default_similarity_threshold"
            label="Default Similarity Threshold"
            extra="Minimum similarity score for semantic matching (0.0 - 1.0)"
          >
            <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
          </Form.Item>

          <Divider orientation="left">Other Settings</Divider>

          <Form.Item
            label="Max Clues per Response"
            name="max_clues_per_response"
            initialValue={5}
          >
            <InputNumber min={1} max={20} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="Context Window Size"
            name="context_window_size"
            extra="Number of previous dialogue turns to consider"
            initialValue={3}
          >
            <InputNumber min={0} max={10} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
