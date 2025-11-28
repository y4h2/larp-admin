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
import { PageHeader, EditingIndicator, SyncStatus } from '@/components/common';
import { CollaborativeTextArea, CollaborativeInput, CollaborativeSelect } from '@/components/collaborative';
import { usePresence } from '@/contexts/PresenceContext';
import { useRealtimeSync } from '@/hooks';
import { scriptApi } from '@/api';
import { formatDate } from '@/utils';
import type { Script } from '@/types';

const { Option } = Select;

export default function ScriptDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { trackEditing, stopEditing } = usePresence();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialScript, setInitialScript] = useState<Script | null>(null);

  // Realtime sync hook
  const handleRemoteChange = useCallback(
    (remoteData: Script) => {
      // Update form with merged data
      form.setFieldsValue(remoteData);
    },
    [form]
  );

  const {
    data: script,
    setLocalData,
    lastMergeResult,
    isConnected,
  } = useRealtimeSync<Script>({
    table: 'scripts',
    id: id || '',
    initialData: initialScript,
    onRemoteChange: handleRemoteChange,
    enabled: !!id && !loading,
  });

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const scriptData = await scriptApi.get(id);
      setInitialScript(scriptData);
    } catch {
      message.error(t('common.loadFailed'));
      navigate('/scripts');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Set form values after loading completes and Form is mounted
  useEffect(() => {
    if (!loading && initialScript) {
      form.setFieldsValue(initialScript);
    }
  }, [loading, initialScript, form]);

  // Track editing presence
  useEffect(() => {
    if (id) {
      trackEditing('script', id);
    }
    return () => {
      stopEditing();
    };
  }, [id, trackEditing, stopEditing]);

  const handleSave = async (values: Partial<Script>) => {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await scriptApi.update(id, values);
      setLocalData(updated);
      setInitialScript(updated);
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
        subtitle={
          <Space>
            <span>{`${t('common.updatedAt')} ${formatDate(script.updated_at)}`}</span>
            <EditingIndicator type="script" id={id!} />
          </Space>
        }
        breadcrumbs={[
          { title: t('script.title'), path: '/scripts' },
          { title: script.title },
        ]}
        extra={
          <Space>
            <SyncStatus isConnected={isConnected} lastMergeResult={lastMergeResult} />
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
                    label={t('script.scriptName')}
                    rules={[{ required: true, message: t('script.enterScriptName') }]}
                  >
                    <CollaborativeInput
                      docId={`script_${id}`}
                      fieldName="title"
                      placeholder={t('script.enterScriptName')}
                    />
                  </Form.Item>
                  <Form.Item name="summary" label={t('script.summary')}>
                    <CollaborativeTextArea
                      docId={`script_${id}`}
                      fieldName="summary"
                      placeholder={t('script.summaryPlaceholder')}
                      rows={3}
                    />
                  </Form.Item>
                  <Form.Item name="background" label={t('script.background')}>
                    <CollaborativeTextArea
                      docId={`script_${id}`}
                      fieldName="background"
                      placeholder={t('script.backgroundPlaceholder')}
                      rows={4}
                    />
                  </Form.Item>
                  <Form.Item name="difficulty" label={t('script.difficulty')}>
                    <CollaborativeSelect docId={`script_${id}`} fieldName="difficulty">
                      <Option value="easy">{t('script.easy')}</Option>
                      <Option value="medium">{t('script.medium')}</Option>
                      <Option value="hard">{t('script.hard')}</Option>
                    </CollaborativeSelect>
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
                  <Form.Item name={['truth', 'murderer']} label={t('script.murderer')}>
                    <CollaborativeInput
                      docId={`script_${id}`}
                      fieldName="truth_murderer"
                      placeholder={t('script.murdererPlaceholder')}
                    />
                  </Form.Item>
                  <Form.Item name={['truth', 'weapon']} label={t('script.weapon')}>
                    <CollaborativeInput
                      docId={`script_${id}`}
                      fieldName="truth_weapon"
                      placeholder={t('script.weaponPlaceholder')}
                    />
                  </Form.Item>
                  <Form.Item name={['truth', 'motive']} label={t('script.motive')}>
                    <CollaborativeTextArea
                      docId={`script_${id}`}
                      fieldName="truth_motive"
                      placeholder={t('script.motivePlaceholder')}
                      rows={3}
                    />
                  </Form.Item>
                  <Form.Item name={['truth', 'crime_method']} label={t('script.crimeMethod')}>
                    <CollaborativeTextArea
                      docId={`script_${id}`}
                      fieldName="truth_crime_method"
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
