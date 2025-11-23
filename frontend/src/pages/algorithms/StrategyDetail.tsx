import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Space,
  Row,
  Col,
  InputNumber,
  Slider,
  Divider,
  Spin,
  Empty,
  message,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/common';
import { strategyApi, algorithmApi, scriptApi, sceneApi, npcApi } from '@/api';
import type { AlgorithmStrategy, AlgorithmImplementation, Script, Scene, NPC } from '@/types';

const { Option } = Select;

// Dynamic parameter form based on implementation type
function KeywordParams({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Form.Item label="Minimum Keyword Hits">
        <InputNumber
          min={1}
          max={10}
          value={(value?.min_hits as number) || 1}
          onChange={(v) => onChange({ ...value, min_hits: v })}
        />
      </Form.Item>
      <Form.Item label="Keyword Weight" extra="Higher weight gives keywords more importance">
        <Slider
          min={0.1}
          max={2}
          step={0.1}
          value={(value?.weight as number) || 1}
          onChange={(v) => onChange({ ...value, weight: v })}
          marks={{ 0.1: '0.1', 1: '1.0', 2: '2.0' }}
        />
      </Form.Item>
      <Form.Item label="Stopwords">
        <Select
          mode="tags"
          value={(value?.stopwords as string[]) || []}
          onChange={(v) => onChange({ ...value, stopwords: v })}
          placeholder="Enter stopwords to ignore"
        />
      </Form.Item>
    </Space>
  );
}

function EmbeddingParams({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Form.Item label="Similarity Threshold" extra="Minimum similarity score to match">
        <Slider
          min={0.5}
          max={0.99}
          step={0.01}
          value={(value?.threshold as number) || 0.8}
          onChange={(v) => onChange({ ...value, threshold: v })}
          marks={{ 0.5: '0.5', 0.8: '0.8', 0.99: '0.99' }}
        />
      </Form.Item>
      <Form.Item label="Top-K Results">
        <InputNumber
          min={1}
          max={20}
          value={(value?.top_k as number) || 5}
          onChange={(v) => onChange({ ...value, top_k: v })}
        />
      </Form.Item>
      <Form.Item label="Context Window" extra="Number of previous messages to include">
        <InputNumber
          min={0}
          max={10}
          value={(value?.context_window as number) || 3}
          onChange={(v) => onChange({ ...value, context_window: v })}
        />
      </Form.Item>
    </Space>
  );
}

function HybridParams({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Form.Item label="Keyword Weight">
        <Slider
          min={0}
          max={1}
          step={0.1}
          value={(value?.keyword_weight as number) || 0.5}
          onChange={(v) => onChange({ ...value, keyword_weight: v, embedding_weight: 1 - v })}
          marks={{ 0: 'Embedding', 0.5: 'Balanced', 1: 'Keyword' }}
        />
      </Form.Item>
      <Form.Item label="Trigger Logic">
        <Select
          value={(value?.trigger_logic as string) || 'OR'}
          onChange={(v) => onChange({ ...value, trigger_logic: v })}
        >
          <Option value="OR">OR - Match either keyword or semantic</Option>
          <Option value="AND">AND - Must match both</Option>
          <Option value="KEYWORD_FIRST">Keyword First - Fall back to semantic</Option>
          <Option value="SEMANTIC_FIRST">Semantic First - Fall back to keyword</Option>
        </Select>
      </Form.Item>
      <Divider>Keyword Settings</Divider>
      <Form.Item label="Min Keyword Hits">
        <InputNumber
          min={1}
          max={10}
          value={(value?.min_keyword_hits as number) || 1}
          onChange={(v) => onChange({ ...value, min_keyword_hits: v })}
        />
      </Form.Item>
      <Divider>Embedding Settings</Divider>
      <Form.Item label="Similarity Threshold">
        <Slider
          min={0.5}
          max={0.99}
          step={0.01}
          value={(value?.similarity_threshold as number) || 0.8}
          onChange={(v) => onChange({ ...value, similarity_threshold: v })}
          marks={{ 0.5: '0.5', 0.8: '0.8', 0.99: '0.99' }}
        />
      </Form.Item>
      <Form.Item label="Top-K">
        <InputNumber
          min={1}
          max={20}
          value={(value?.top_k as number) || 5}
          onChange={(v) => onChange({ ...value, top_k: v })}
        />
      </Form.Item>
    </Space>
  );
}

export default function StrategyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [strategy, setStrategy] = useState<AlgorithmStrategy | null>(null);
  const [implementations, setImplementations] = useState<AlgorithmImplementation[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [selectedImpl, setSelectedImpl] = useState<string | null>(null);
  const [scopeType, setScopeType] = useState<AlgorithmStrategy['scope_type']>('global');

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [strategyData, implsData, scriptsData] = await Promise.all([
        strategyApi.get(id),
        algorithmApi.listImplementations(),
        scriptApi.list({}),
      ]);
      setStrategy(strategyData);
      setImplementations(implsData);
      setScripts(scriptsData.items);
      setSelectedImpl(strategyData.impl_id);
      setScopeType(strategyData.scope_type);
      setParams(strategyData.params);
      form.setFieldsValue(strategyData);

      // Load scenes/npcs if needed
      if (strategyData.scope_type === 'scene' && strategyData.scope_target_id) {
        const scenesData = await sceneApi.list({ script_id: strategyData.scope_target_id });
        setScenes(scenesData.items);
      } else if (strategyData.scope_type === 'npc' && strategyData.scope_target_id) {
        const npcsData = await npcApi.list({ page_size: 100 });
        setNpcs(npcsData.items);
      }
    } catch {
      message.error('Failed to load strategy');
      navigate('/algorithms/strategies');
    } finally {
      setLoading(false);
    }
  }, [id, form, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (values: Record<string, unknown>) => {
    if (!id) return;
    setSaving(true);
    try {
      const updateData: Partial<AlgorithmStrategy> = {
        name: values.name as string,
        description: values.description as string,
        impl_id: values.impl_id as string,
        scope_type: values.scope_type as AlgorithmStrategy['scope_type'],
        scope_target_id: values.scope_target_id as string | null,
        status: values.status as AlgorithmStrategy['status'],
        params: params,
      };
      const updated = await strategyApi.update(id, updateData);
      setStrategy(updated);
      message.success('Strategy saved successfully');
    } catch {
      message.error('Failed to save strategy');
    } finally {
      setSaving(false);
    }
  };

  const handleScopeTypeChange = async (type: AlgorithmStrategy['scope_type']) => {
    setScopeType(type);
    form.setFieldValue('scope_target_id', null);

    if (type === 'scene') {
      // Need to load scenes (requires script selection first)
    } else if (type === 'npc') {
      const npcsData = await npcApi.list({ page_size: 100 });
      setNpcs(npcsData.items);
    }
  };

  const renderParamsForm = () => {
    const impl = implementations.find((i) => i.id === selectedImpl);
    if (!impl) return null;

    // Render different forms based on implementation type
    if (impl.id.includes('keyword')) {
      return <KeywordParams value={params} onChange={setParams} />;
    } else if (impl.id.includes('embedding') || impl.id.includes('semantic')) {
      return <EmbeddingParams value={params} onChange={setParams} />;
    } else if (impl.id.includes('hybrid')) {
      return <HybridParams value={params} onChange={setParams} />;
    }

    // Default: show JSON editor
    return (
      <Form.Item label="Parameters (JSON)">
        <Input.TextArea
          value={JSON.stringify(params, null, 2)}
          onChange={(e) => {
            try {
              setParams(JSON.parse(e.target.value));
            } catch {
              // Invalid JSON, ignore
            }
          }}
          rows={10}
          style={{ fontFamily: 'monospace' }}
        />
      </Form.Item>
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!strategy) {
    return <Empty description="Strategy not found" />;
  }

  return (
    <div>
      <PageHeader
        title={strategy.name}
        subtitle={`${strategy.status}${strategy.is_default ? ' (Default)' : ''}`}
        breadcrumbs={[
          { title: 'Strategies', path: '/algorithms/strategies' },
          { title: strategy.name },
        ]}
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={() => form.submit()}
          >
            Save
          </Button>
        }
      />

      <Row gutter={24}>
        <Col span={12}>
          <Card title="Basic Information">
            <Form form={form} layout="vertical" onFinish={handleSave}>
              <Form.Item
                name="name"
                label="Strategy Name"
                rules={[{ required: true }]}
              >
                <Input placeholder="Enter strategy name" />
              </Form.Item>
              <Form.Item name="description" label="Description">
                <Input.TextArea placeholder="Enter description" rows={3} />
              </Form.Item>
              <Form.Item
                name="impl_id"
                label="Implementation"
                rules={[{ required: true }]}
              >
                <Select onChange={(v) => setSelectedImpl(v)}>
                  {implementations.map((impl) => (
                    <Option key={impl.id} value={impl.id}>
                      {impl.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                name="scope_type"
                label="Scope"
                rules={[{ required: true }]}
              >
                <Select onChange={handleScopeTypeChange}>
                  <Option value="global">Global</Option>
                  <Option value="script">Script</Option>
                  <Option value="scene">Scene</Option>
                  <Option value="npc">NPC</Option>
                </Select>
              </Form.Item>
              {scopeType === 'script' && (
                <Form.Item name="scope_target_id" label="Target Script">
                  <Select placeholder="Select script" allowClear>
                    {scripts.map((s) => (
                      <Option key={s.id} value={s.id}>
                        {s.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              )}
              {scopeType === 'scene' && (
                <Form.Item name="scope_target_id" label="Target Scene">
                  <Select placeholder="Select scene" allowClear>
                    {scenes.map((s) => (
                      <Option key={s.id} value={s.id}>
                        {s.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              )}
              {scopeType === 'npc' && (
                <Form.Item name="scope_target_id" label="Target NPC">
                  <Select placeholder="Select NPC" allowClear>
                    {npcs.map((n) => (
                      <Option key={n.id} value={n.id}>
                        {n.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              )}
              <Form.Item name="status" label="Status">
                <Select>
                  <Option value="draft">Draft</Option>
                  <Option value="published">Published</Option>
                  <Option value="deprecated">Deprecated</Option>
                </Select>
              </Form.Item>
            </Form>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Algorithm Parameters">
            {renderParamsForm()}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
