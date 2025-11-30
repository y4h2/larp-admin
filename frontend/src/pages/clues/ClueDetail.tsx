import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Form,
  Select,
  Button,
  Space,
  Spin,
  Empty,
  Tag,
  Tooltip,
  App,
} from 'antd';
import { SaveOutlined, ArrowLeftOutlined, DeleteOutlined, RobotOutlined, BulbOutlined, UndoOutlined, StopOutlined } from '@ant-design/icons';
import { PageHeader, ClueTypeTag, EditingIndicator, SyncStatus } from '@/components/common';
import { CollaborativeTextArea, CollaborativeInput, CollaborativeSelect, CollaborativeMultiSelect } from '@/components/collaborative';
import { usePresence } from '@/contexts/PresenceContext';
import { useClues, useScripts, useNpcs, useRealtimeSync } from '@/hooks';
import { clueApi, aiEnhancementApi } from '@/api';
import type { Clue } from '@/types';

const { Option } = Select;

export default function ClueDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const { trackEditing, stopEditing } = usePresence();
  const { fetchClue, updateClue, deleteClue } = useClues();
  const { scripts, fetchScripts } = useScripts();
  const { npcs, fetchNpcs } = useNpcs();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [suggestingKeywords, setSuggestingKeywords] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [initialClue, setInitialClue] = useState<Clue | null>(null);
  const [siblingClues, setSiblingClues] = useState<Clue[]>([]);

  // AI Polish history for undo
  const [polishHistory, setPolishHistory] = useState<{ field: string; original: string; polished: string } | null>(null);

  // Ref to track if form is mounted
  const formMountedRef = useRef(false);

  // AbortController for cancelling AI streaming
  const abortControllerRef = useRef<AbortController | null>(null);

  // Realtime sync hook
  const handleRemoteChange = useCallback(
    (remoteData: Clue) => {
      form.setFieldsValue(remoteData);
    },
    [form]
  );

  const {
    data: clue,
    setLocalData,
    lastMergeResult,
    isConnected,
  } = useRealtimeSync<Clue>({
    table: 'clues',
    id: id || '',
    initialData: initialClue,
    onRemoteChange: handleRemoteChange,
    enabled: !!id && !loading,
  });

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  // Fetch sibling clues when script_id changes
  const fetchSiblingClues = async (scriptId: string) => {
    try {
      const result = await clueApi.list({ script_id: scriptId, page_size: 100 });
      setSiblingClues(result.items);
    } catch {
      // Ignore errors
    }
  };

  useEffect(() => {
    const loadClue = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await fetchClue(id);
        setInitialClue(data);
        if (data.script_id) {
          fetchNpcs({ script_id: data.script_id });
          fetchSiblingClues(data.script_id);
        }
      } catch {
        // Error handled in hook
      } finally {
        setLoading(false);
      }
    };
    loadClue();
  }, [id, fetchClue, fetchNpcs]);

  // Set form values after loading is complete and Form is mounted
  useEffect(() => {
    if (!loading && initialClue) {
      // Use requestAnimationFrame to ensure Form is mounted before setting values
      const setValues = () => {
        if (formMountedRef.current) {
          form.setFieldsValue(initialClue);
        } else {
          requestAnimationFrame(setValues);
        }
      };
      requestAnimationFrame(setValues);
    }
  }, [loading, initialClue, form]);

  // Track editing presence
  useEffect(() => {
    if (id) {
      trackEditing('clue', id);
    }
    return () => {
      stopEditing();
    };
  }, [id, trackEditing, stopEditing]);

  const handleSave = async (values: Partial<Clue>) => {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await updateClue(id, values);
      setLocalData(updated);
      setInitialClue(updated);
      message.success(t('common.saveSuccess'));
    } catch {
      // Error handled in hook
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteClue(id);
      navigate('/clues');
    } catch {
      // Error handled in hook
    }
  };

  // Cancel AI streaming
  const handleCancelAI = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setPolishing(false);
    setGeneratingSummary(false);
    message.info(t('clue.aiEnhance.cancelled'));
  };

  // AI Enhancement handlers
  const handlePolishDetail = async () => {
    const name = form.getFieldValue('name');
    const detail = form.getFieldValue('detail');
    if (!detail) {
      message.warning(t('clue.aiEnhance.noDetailToPolish'));
      return;
    }

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setPolishing(true);
    const originalDetail = detail;

    await aiEnhancementApi.polishClueStream(
      { clue_name: name || '', clue_detail: detail },
      {
        onChunk: (chunk) => {
          const currentValue = form.getFieldValue('detail') || '';
          // If this is the first chunk, replace with just the chunk
          if (currentValue === originalDetail) {
            form.setFieldValue('detail', chunk);
          } else {
            form.setFieldValue('detail', currentValue + chunk);
          }
        },
        onComplete: (fullContent) => {
          setPolishHistory({
            field: 'detail',
            original: originalDetail,
            polished: fullContent,
          });
          form.setFieldValue('detail', fullContent);
          message.success(t('clue.aiEnhance.polishSuccess'));
          setPolishing(false);
          abortControllerRef.current = null;
        },
        onError: (error) => {
          message.error(t('clue.aiEnhance.polishFailed') + ': ' + error.message);
          form.setFieldValue('detail', originalDetail);
          setPolishing(false);
          abortControllerRef.current = null;
        },
      },
      abortControllerRef.current.signal,
    );
  };

  const handleUndoPolish = () => {
    if (polishHistory) {
      form.setFieldValue(polishHistory.field, polishHistory.original);
      setPolishHistory(null);
      message.info(t('clue.aiEnhance.undoSuccess'));
    }
  };

  const handleSuggestKeywords = async () => {
    const name = form.getFieldValue('name');
    const detail = form.getFieldValue('detail');
    if (!detail) {
      message.warning(t('clue.aiEnhance.noDetailForKeywords'));
      return;
    }

    setSuggestingKeywords(true);
    try {
      const existingKeywords = form.getFieldValue('trigger_keywords') || [];
      const result = await aiEnhancementApi.suggestKeywords({
        clue_name: name || '',
        clue_detail: detail,
        existing_keywords: existingKeywords,
      });
      // Merge with existing keywords
      const merged = [...new Set([...existingKeywords, ...result.keywords])];
      form.setFieldValue('trigger_keywords', merged);
      message.success(t('clue.aiEnhance.suggestKeywordsSuccess', { count: result.keywords.length }));
    } catch {
      message.error(t('clue.aiEnhance.suggestKeywordsFailed'));
    } finally {
      setSuggestingKeywords(false);
    }
  };

  const handleGenerateSummary = async () => {
    const name = form.getFieldValue('name');
    const detail = form.getFieldValue('detail');
    if (!detail) {
      message.warning(t('clue.aiEnhance.noDetailForSummary'));
      return;
    }

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setGeneratingSummary(true);

    await aiEnhancementApi.generateSemanticSummaryStream(
      { clue_name: name || '', clue_detail: detail },
      {
        onChunk: (chunk) => {
          const currentValue = form.getFieldValue('trigger_semantic_summary') || '';
          form.setFieldValue('trigger_semantic_summary', currentValue + chunk);
        },
        onComplete: (fullContent) => {
          form.setFieldValue('trigger_semantic_summary', fullContent);
          message.success(t('clue.aiEnhance.generateSummarySuccess'));
          setGeneratingSummary(false);
          abortControllerRef.current = null;
        },
        onError: (error) => {
          message.error(t('clue.aiEnhance.generateSummaryFailed') + ': ' + error.message);
          setGeneratingSummary(false);
          abortControllerRef.current = null;
        },
      },
      abortControllerRef.current.signal,
    );
  };

  // Set form mounted ref when Form will be rendered
  useEffect(() => {
    if (!loading && clue) {
      formMountedRef.current = true;
    }
    return () => {
      formMountedRef.current = false;
    };
  }, [loading, clue]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!clue) {
    return <Empty description={t('clue.notFound')} />;
  }

  return (
    <div>
      <PageHeader
        title={
          <Space>
            <span>{clue.name}</span>
            <ClueTypeTag type={clue.type} />
          </Space>
        }
        subtitle={
          <Space>
            <span>{`ID: ${clue.id}`}</span>
            <EditingIndicator type="clue" id={id!} />
          </Space>
        }
        breadcrumbs={[
          { title: t('clue.title'), path: '/clues' },
          { title: clue.name },
        ]}
        extra={
          <Space>
            <SyncStatus isConnected={isConnected} lastMergeResult={lastMergeResult} />
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clues')}>
              {t('common.back')}
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
              {t('common.delete')}
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => form.submit()}
              loading={saving}
            >
              {t('common.save')}
            </Button>
          </Space>
        }
      />

      <Card>
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ maxWidth: 800 }}>
          <Form.Item
            name="script_id"
            label={t('script.title')}
            rules={[{ required: true, message: t('clue.pleaseSelectScript') }]}
          >
            <CollaborativeSelect
              docId={`clue_${id}`}
              fieldName="script_id"
              placeholder={t('clue.selectScript')}
              onChange={(value) => {
                if (value) {
                  fetchNpcs({ script_id: value as string });
                  fetchSiblingClues(value as string);
                  // Clear prerequisites when script changes since they're script-specific
                  form.setFieldValue('prereq_clue_ids', []);
                }
              }}
            >
              {scripts.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.title}
                </Option>
              ))}
            </CollaborativeSelect>
          </Form.Item>

          <Form.Item
            name="npc_id"
            label="NPC"
            rules={[{ required: true, message: t('clue.selectNpc') }]}
          >
            <CollaborativeSelect
              docId={`clue_${id}`}
              fieldName="npc_id"
              placeholder={t('clue.selectNpc')}
            >
              {npcs.map((n) => (
                <Option key={n.id} value={n.id}>
                  {n.name}
                </Option>
              ))}
            </CollaborativeSelect>
          </Form.Item>

          <Form.Item
            name="name"
            label={t('clue.name')}
            rules={[{ required: true }]}
          >
            <CollaborativeInput
              docId={`clue_${id}`}
              fieldName="name"
              placeholder={t('clue.name')}
            />
          </Form.Item>

          <Form.Item name="type" label={t('clue.type')}>
            <CollaborativeSelect docId={`clue_${id}`} fieldName="type">
              <Option value="text">{t('common.text')}</Option>
              <Option value="image">{t('common.image')}</Option>
            </CollaborativeSelect>
          </Form.Item>

          <Form.Item
            name="detail"
            label={
              <Space>
                {t('clue.detail')}
                {polishing ? (
                  <Button
                    type="link"
                    size="small"
                    icon={<StopOutlined />}
                    onClick={handleCancelAI}
                    danger
                  >
                    {t('clue.aiEnhance.cancel')}
                  </Button>
                ) : (
                  <Tooltip title={t('clue.aiEnhance.polishTooltip')}>
                    <Button
                      type="link"
                      size="small"
                      icon={<RobotOutlined />}
                      onClick={handlePolishDetail}
                    >
                      {t('clue.aiEnhance.polish')}
                    </Button>
                  </Tooltip>
                )}
                {polishHistory && polishHistory.field === 'detail' && !polishing && (
                  <Tooltip title={t('clue.aiEnhance.undoTooltip')}>
                    <Button
                      type="link"
                      size="small"
                      icon={<UndoOutlined />}
                      onClick={handleUndoPolish}
                      style={{ color: '#faad14' }}
                    >
                      {t('clue.aiEnhance.undo')}
                    </Button>
                  </Tooltip>
                )}
              </Space>
            }
            rules={[{ required: true }]}
          >
            <CollaborativeTextArea
              docId={`clue_${id}`}
              fieldName="detail"
              placeholder={t('clue.detailPlaceholder')}
              rows={4}
            />
          </Form.Item>

          <Form.Item
            name="detail_for_npc"
            label={t('clue.detailForNpc')}
            extra={t('clue.detailForNpcExtra')}
          >
            <CollaborativeTextArea
              docId={`clue_${id}`}
              fieldName="detail_for_npc"
              placeholder={t('clue.detailForNpcPlaceholder')}
              rows={3}
            />
          </Form.Item>

          <Form.Item
            name="trigger_keywords"
            label={
              <Space>
                {t('clue.triggerKeywords')}
                <Tooltip title={t('clue.aiEnhance.suggestKeywordsTooltip')}>
                  <Button
                    type="link"
                    size="small"
                    icon={<BulbOutlined />}
                    loading={suggestingKeywords}
                    onClick={handleSuggestKeywords}
                  >
                    {t('clue.aiEnhance.suggestKeywords')}
                  </Button>
                </Tooltip>
              </Space>
            }
          >
            <CollaborativeMultiSelect
              docId={`clue_${id}`}
              fieldName="trigger_keywords"
              mode="tags"
              placeholder={t('clue.triggerKeywordsPlaceholder')}
            />
          </Form.Item>

          <Form.Item
            name="trigger_semantic_summary"
            label={
              <Space>
                {t('clue.triggerSemanticSummary')}
                {generatingSummary ? (
                  <Button
                    type="link"
                    size="small"
                    icon={<StopOutlined />}
                    onClick={handleCancelAI}
                    danger
                  >
                    {t('clue.aiEnhance.cancel')}
                  </Button>
                ) : (
                  <Tooltip title={t('clue.aiEnhance.generateSummaryTooltip')}>
                    <Button
                      type="link"
                      size="small"
                      icon={<RobotOutlined />}
                      onClick={handleGenerateSummary}
                    >
                      {t('clue.aiEnhance.generateSummary')}
                    </Button>
                  </Tooltip>
                )}
              </Space>
            }
          >
            <CollaborativeTextArea
              docId={`clue_${id}`}
              fieldName="trigger_semantic_summary"
              placeholder={t('clue.triggerSemanticSummaryPlaceholder')}
              rows={2}
            />
          </Form.Item>

          <Form.Item
            name="prereq_clue_ids"
            label={t('clue.prerequisites')}
            extra={t('clue.prerequisiteCluesExtra')}
          >
            <CollaborativeMultiSelect
              docId={`clue_${id}`}
              fieldName="prereq_clue_ids"
              mode="multiple"
              placeholder={t('clue.selectPrerequisiteClues')}
            >
              {siblingClues
                .filter((c) => c.id !== id)
                .map((c) => (
                  <Option key={c.id} value={c.id}>
                    {c.name}
                  </Option>
                ))}
            </CollaborativeMultiSelect>
          </Form.Item>

          <Form.Item>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Space>
                <Tag>{t('common.createdAt')}: {new Date(clue.created_at).toLocaleString()}</Tag>
                <Tag>{t('common.updatedAt')}: {new Date(clue.updated_at).toLocaleString()}</Tag>
              </Space>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
