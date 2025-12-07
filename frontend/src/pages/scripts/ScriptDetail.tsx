import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Space,
  Tabs,
  Spin,
  Empty,
  message,
} from 'antd';
import { NodeIndexOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader, VariableLabel } from '@/components/common';
import { SCRIPT_VARIABLES } from '@/constants';
import { scriptApi } from '@/api';
import { formatDate } from '@/utils';
import type { Script } from '@/types';

const { Option } = Select;
const { TextArea } = Input;

export default function ScriptDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [script, setScript] = useState<Script | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const scriptData = await scriptApi.get(id);
      setScript(scriptData);
      form.setFieldsValue(scriptData);
    } catch {
      message.error(t('common.loadFailed'));
      navigate('/scripts');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, t, form]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (values: Partial<Script>) => {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await scriptApi.update(id, values);
      setScript(updated);
      message.success(t('common.saveSuccess'));
    } catch {
      message.error(t('common.saveFailed'));
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

  if (!script) {
    return <Empty description={t('script.notFound')} />;
  }

  return (
    <div>
      <PageHeader
        title={script.title}
        subtitle={`${t('common.updatedAt')} ${formatDate(script.updated_at)}`}
        breadcrumbs={[
          { title: t('script.title'), path: '/scripts' },
          { title: script.title },
        ]}
        extra={
          <Space>
            <Button
              icon={<NodeIndexOutlined />}
              onClick={() => navigate(`/clues/tree?script_id=${script.id}`)}
            >
              {t('script.viewClueTree')}
            </Button>
            <Button type="primary" loading={saving} onClick={() => form.submit()}>
              {t('common.save')}
            </Button>
          </Space>
        }
      />

      <Tabs
        defaultActiveKey="basic"
        items={[
          {
            key: 'basic',
            label: t('common.basicInfo'),
            children: (
              <Card>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                  <Form.Item
                    name="title"
                    label={<VariableLabel label={t('script.scriptName')} variablePath={SCRIPT_VARIABLES.title} />}
                    rules={[{ required: true, message: t('script.enterScriptName') }]}
                  >
                    <Input placeholder={t('script.enterScriptName')} />
                  </Form.Item>
                  <Form.Item name="summary" label={<VariableLabel label={t('script.summary')} variablePath={SCRIPT_VARIABLES.summary} />}>
                    <TextArea
                      placeholder={t('script.summaryPlaceholder')}
                      rows={3}
                    />
                  </Form.Item>
                  <Form.Item name="background" label={<VariableLabel label={t('script.background')} variablePath={SCRIPT_VARIABLES.background} />}>
                    <TextArea
                      placeholder={t('script.backgroundPlaceholder')}
                      rows={4}
                    />
                  </Form.Item>
                  <Form.Item name="difficulty" label={<VariableLabel label={t('script.difficulty')} variablePath={SCRIPT_VARIABLES.difficulty} />}>
                    <Select>
                      <Option value="easy">{t('script.easy')}</Option>
                      <Option value="medium">{t('script.medium')}</Option>
                      <Option value="hard">{t('script.hard')}</Option>
                    </Select>
                  </Form.Item>
                </Form>
              </Card>
            ),
          },
          {
            key: 'truth',
            label: t('script.truth'),
            children: (
              <Card title={t('script.truthSubtitle')}>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                  <Form.Item name={['truth', 'murderer']} label={<VariableLabel label={t('script.murderer')} variablePath={SCRIPT_VARIABLES['truth.murderer']} />}>
                    <Input placeholder={t('script.murdererPlaceholder')} />
                  </Form.Item>
                  <Form.Item name={['truth', 'weapon']} label={<VariableLabel label={t('script.weapon')} variablePath={SCRIPT_VARIABLES['truth.weapon']} />}>
                    <Input placeholder={t('script.weaponPlaceholder')} />
                  </Form.Item>
                  <Form.Item name={['truth', 'motive']} label={<VariableLabel label={t('script.motive')} variablePath={SCRIPT_VARIABLES['truth.motive']} />}>
                    <TextArea
                      placeholder={t('script.motivePlaceholder')}
                      rows={3}
                    />
                  </Form.Item>
                  <Form.Item name={['truth', 'crime_method']} label={<VariableLabel label={t('script.crimeMethod')} variablePath={SCRIPT_VARIABLES['truth.crime_method']} />}>
                    <TextArea
                      placeholder={t('script.crimeMethodPlaceholder')}
                      rows={4}
                    />
                  </Form.Item>
                </Form>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
