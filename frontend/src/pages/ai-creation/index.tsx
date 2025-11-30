/**
 * AI Story Creation Wizard
 *
 * A step-by-step wizard for creating stories with AI assistance.
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Steps,
  Button,
  Form,
  Input,
  Select,
  InputNumber,
  Space,
  Alert,
  Spin,
  Result,
  Tag,
  Typography,
  Row,
  Col,
  Divider,
  List,
  Collapse,
  App,
} from 'antd';
import {
  RocketOutlined,
  BulbOutlined,
  ApartmentOutlined,
  TeamOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/common';
import {
  aiAssistantApi,
  type StorySettingInput,
  type TruthOption,
  type SelectedTruth,
  type ClueChainSuggestion,
  type NPCSuggestion,
  type ClueDetail,
  type NPCDetail,
  type StoryGenre,
} from '@/api/aiAssistant';
import { llmConfigApi, type LLMConfig } from '@/api/llmConfigs';

const { TextArea } = Input;
const { Text, Paragraph, Title } = Typography;
const { Option } = Select;

const GENRES: { value: StoryGenre; labelKey: string }[] = [
  { value: 'murder_mystery', labelKey: 'aiCreation.genres.murderMystery' },
  { value: 'thriller', labelKey: 'aiCreation.genres.thriller' },
  { value: 'wuxia', labelKey: 'aiCreation.genres.wuxia' },
  { value: 'modern', labelKey: 'aiCreation.genres.modern' },
  { value: 'historical', labelKey: 'aiCreation.genres.historical' },
  { value: 'fantasy', labelKey: 'aiCreation.genres.fantasy' },
];

const STEPS = [
  { key: 'setting', icon: <RocketOutlined /> },
  { key: 'truth', icon: <BulbOutlined /> },
  { key: 'clueChain', icon: <ApartmentOutlined /> },
  { key: 'npcs', icon: <TeamOutlined /> },
  { key: 'details', icon: <FileTextOutlined /> },
  { key: 'review', icon: <CheckCircleOutlined /> },
];

export default function AICreationWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [settingForm] = Form.useForm();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // LLM config state
  const [chatConfigs, setChatConfigs] = useState<LLMConfig[]>([]);
  const [selectedLLMConfigId, setSelectedLLMConfigId] = useState<string | undefined>();
  const [loadingConfigs, setLoadingConfigs] = useState(true);

  // Data state
  const [setting, setSetting] = useState<StorySettingInput | null>(null);
  const [truthOptions, setTruthOptions] = useState<TruthOption[]>([]);
  const [selectedTruth, setSelectedTruth] = useState<SelectedTruth | null>(null);
  const [clueChain, setClueChain] = useState<ClueChainSuggestion | null>(null);
  const [npcs, setNPCs] = useState<NPCSuggestion[]>([]);
  const [clueDetails, setClueDetails] = useState<ClueDetail[]>([]);
  const [npcDetails, setNPCDetails] = useState<NPCDetail[]>([]);
  const [createdScriptId, setCreatedScriptId] = useState<string | null>(null);

  // Fetch available Chat LLM configs on mount
  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const response = await llmConfigApi.list({ type: 'chat', page_size: 100 });
        setChatConfigs(response.items);
        // Auto-select default config if available
        const defaultConfig = response.items.find((c) => c.is_default);
        if (defaultConfig) {
          setSelectedLLMConfigId(defaultConfig.id);
        } else if (response.items.length > 0) {
          setSelectedLLMConfigId(response.items[0].id);
        }
      } catch (error) {
        message.error(t('aiCreation.errors.loadLLMConfigs'));
      } finally {
        setLoadingConfigs(false);
      }
    };
    fetchConfigs();
  }, [message, t]);

  // Step 1: Setting
  const handleSettingSubmit = useCallback(async (values: StorySettingInput) => {
    setLoading(true);
    try {
      setSetting(values);
      const result = await aiAssistantApi.generateTruth({
        setting: values,
        llm_config_id: selectedLLMConfigId,
      });
      setTruthOptions(result.options);
      setCurrentStep(1);
    } catch (error) {
      message.error(t('aiCreation.errors.generateTruth'));
    } finally {
      setLoading(false);
    }
  }, [t, message, selectedLLMConfigId]);

  // Step 2: Select Truth
  const handleSelectTruth = useCallback(async (option: TruthOption) => {
    if (!setting) return;

    setLoading(true);
    try {
      const truth: SelectedTruth = {
        murderer: option.murderer,
        motive: option.motive,
        method: option.method,
        twist: option.twist,
      };
      setSelectedTruth(truth);

      const result = await aiAssistantApi.generateClueChain({
        setting,
        truth,
        llm_config_id: selectedLLMConfigId,
      });
      setClueChain(result);
      setCurrentStep(2);
    } catch (error) {
      message.error(t('aiCreation.errors.generateClueChain'));
    } finally {
      setLoading(false);
    }
  }, [setting, t, message, selectedLLMConfigId]);

  // Step 3: Confirm Clue Chain
  const handleConfirmClueChain = useCallback(async () => {
    if (!setting || !selectedTruth || !clueChain) return;

    setLoading(true);
    try {
      const result = await aiAssistantApi.generateNPCs({
        setting,
        truth: selectedTruth,
        clue_chain: clueChain,
        npc_count: setting.npc_count,
        llm_config_id: selectedLLMConfigId,
      });
      setNPCs(result.npcs);
      setCurrentStep(3);
    } catch (error) {
      message.error(t('aiCreation.errors.generateNPCs'));
    } finally {
      setLoading(false);
    }
  }, [setting, selectedTruth, clueChain, t, message, selectedLLMConfigId]);

  // Step 3: Optimize Clue Chain
  const handleOptimizeClueChain = useCallback(async () => {
    if (!clueChain) return;

    setLoading(true);
    try {
      const result = await aiAssistantApi.optimizeClueChain({
        clue_chain: clueChain,
        llm_config_id: selectedLLMConfigId,
      });
      setClueChain(result);
      message.success(t('aiCreation.clueChainOptimized'));
    } catch (error) {
      message.error(t('aiCreation.errors.optimizeClueChain'));
    } finally {
      setLoading(false);
    }
  }, [clueChain, t, message, selectedLLMConfigId]);

  // Step 4: Confirm NPCs
  const handleConfirmNPCs = useCallback(async () => {
    if (!setting || !selectedTruth || !clueChain) return;

    setLoading(true);
    try {
      const result = await aiAssistantApi.generateDetails({
        setting,
        truth: selectedTruth,
        clue_chain: clueChain,
        npcs,
        llm_config_id: selectedLLMConfigId,
      });
      setClueDetails(result.clue_details);
      setNPCDetails(result.npc_details);
      setCurrentStep(4);
    } catch (error) {
      message.error(t('aiCreation.errors.generateDetails'));
    } finally {
      setLoading(false);
    }
  }, [setting, selectedTruth, clueChain, npcs, t, message, selectedLLMConfigId]);

  // Step 5: Confirm Details -> Review
  const handleConfirmDetails = useCallback(() => {
    setCurrentStep(5);
  }, []);

  // Step 6: Create Script
  const handleCreateScript = useCallback(async () => {
    if (!setting || !selectedTruth || !clueChain) return;

    setLoading(true);
    try {
      const draft = {
        title: `${setting.era} - ${setting.location}`,
        summary: `A ${setting.genre} story set in ${setting.era}`,
        background: setting.atmosphere || '',
        difficulty: 'medium',
        truth: {
          murderer: selectedTruth.murderer,
          motive: selectedTruth.motive,
          method: selectedTruth.method,
        },
        clue_chain: clueChain,
        npcs,
        clue_details: clueDetails,
        npc_details: npcDetails,
        validation_result: clueChain.validation,
        ready_to_create: true,
      };

      const result = await aiAssistantApi.createScript(draft);
      setCreatedScriptId(result.script_id);
      message.success(t('aiCreation.scriptCreated'));
    } catch (error) {
      message.error(t('aiCreation.errors.createScript'));
    } finally {
      setLoading(false);
    }
  }, [setting, selectedTruth, clueChain, npcs, clueDetails, npcDetails, t, message]);

  // Render step content
  const renderStepContent = () => {
    if (createdScriptId) {
      return (
        <Result
          status="success"
          title={t('aiCreation.success.title')}
          subTitle={t('aiCreation.success.subtitle')}
          extra={[
            <Button
              type="primary"
              key="view"
              onClick={() => navigate(`/scripts/${createdScriptId}`)}
            >
              {t('aiCreation.success.viewScript')}
            </Button>,
            <Button key="new" onClick={() => window.location.reload()}>
              {t('aiCreation.success.createAnother')}
            </Button>,
          ]}
        />
      );
    }

    switch (currentStep) {
      case 0:
        return renderSettingStep();
      case 1:
        return renderTruthStep();
      case 2:
        return renderClueChainStep();
      case 3:
        return renderNPCsStep();
      case 4:
        return renderDetailsStep();
      case 5:
        return renderReviewStep();
      default:
        return null;
    }
  };

  // Step 1: Setting Form
  const renderSettingStep = () => (
    <Card title={t('aiCreation.steps.setting.title')}>
      <Alert
        message={t('aiCreation.steps.setting.hint')}
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      <Form
        form={settingForm}
        layout="vertical"
        onFinish={handleSettingSubmit}
        initialValues={{ npc_count: 6, genre: 'murder_mystery' }}
      >
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="genre"
              label={t('aiCreation.fields.genre')}
              rules={[{ required: true }]}
            >
              <Select>
                {GENRES.map((g) => (
                  <Option key={g.value} value={g.value}>
                    {t(g.labelKey)}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="npc_count"
              label={t('aiCreation.fields.npcCount')}
              rules={[{ required: true }]}
            >
              <InputNumber min={3} max={12} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label={t('aiCreation.fields.llmConfig')}>
              <Select
                value={selectedLLMConfigId}
                onChange={setSelectedLLMConfigId}
                loading={loadingConfigs}
                placeholder={t('aiCreation.placeholders.llmConfig')}
              >
                {chatConfigs.map((config) => (
                  <Option key={config.id} value={config.id}>
                    {config.name} ({config.model})
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="era"
              label={t('aiCreation.fields.era')}
              rules={[{ required: true }]}
            >
              <Input placeholder={t('aiCreation.placeholders.era')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="location"
              label={t('aiCreation.fields.location')}
              rules={[{ required: true }]}
            >
              <Input placeholder={t('aiCreation.placeholders.location')} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="atmosphere" label={t('aiCreation.fields.atmosphere')}>
          <TextArea rows={3} placeholder={t('aiCreation.placeholders.atmosphere')} />
        </Form.Item>
        <Form.Item name="additional_notes" label={t('aiCreation.fields.additionalNotes')}>
          <TextArea rows={2} placeholder={t('aiCreation.placeholders.additionalNotes')} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            {t('aiCreation.generateTruth')}
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );

  // Step 2: Truth Selection
  const renderTruthStep = () => (
    <Card title={t('aiCreation.steps.truth.title')}>
      <Alert
        message={t('aiCreation.steps.truth.hint')}
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      <List
        grid={{ gutter: 16, column: 1 }}
        dataSource={truthOptions}
        renderItem={(option, index) => (
          <List.Item>
            <Card
              hoverable
              onClick={() => handleSelectTruth(option)}
              style={{ cursor: 'pointer' }}
            >
              <Row gutter={16}>
                <Col span={24}>
                  <Tag color="blue">{t('aiCreation.option')} {index + 1}</Tag>
                  <Paragraph style={{ marginTop: 8 }}>
                    <Text strong>{t('aiCreation.fields.murderer')}: </Text>
                    {option.murderer}
                  </Paragraph>
                  <Paragraph>
                    <Text strong>{t('aiCreation.fields.motive')}: </Text>
                    {option.motive}
                  </Paragraph>
                  <Paragraph>
                    <Text strong>{t('aiCreation.fields.method')}: </Text>
                    {option.method}
                  </Paragraph>
                  {option.twist && (
                    <Paragraph>
                      <Text strong>{t('aiCreation.fields.twist')}: </Text>
                      {option.twist}
                    </Paragraph>
                  )}
                  <Divider style={{ margin: '12px 0' }} />
                  <Text type="secondary">{option.summary}</Text>
                </Col>
              </Row>
            </Card>
          </List.Item>
        )}
      />
      <Space style={{ marginTop: 16 }}>
        <Button onClick={() => setCurrentStep(0)}>{t('common.back')}</Button>
        <Button
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => setting && handleSettingSubmit(setting)}
        >
          {t('aiCreation.regenerate')}
        </Button>
      </Space>
    </Card>
  );

  // Step 3: Clue Chain
  const renderClueChainStep = () => (
    <Card title={t('aiCreation.steps.clueChain.title')}>
      {clueChain && (
        <>
          <Alert
            message={
              clueChain.validation.is_valid
                ? t('aiCreation.steps.clueChain.valid')
                : t('aiCreation.steps.clueChain.invalid')
            }
            type={clueChain.validation.is_valid ? 'success' : 'warning'}
            showIcon
            style={{ marginBottom: 16 }}
          />
          {clueChain.validation.warnings.length > 0 && (
            <Alert
              message={t('aiCreation.steps.clueChain.warnings')}
              description={
                <ul>
                  {clueChain.validation.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              }
              type="warning"
              style={{ marginBottom: 16 }}
            />
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Title level={5}>{t('aiCreation.steps.clueChain.stats')}</Title>
              <Paragraph>
                {t('aiCreation.steps.clueChain.totalClues')}: {clueChain.nodes.length}
              </Paragraph>
              <Paragraph>
                {t('aiCreation.steps.clueChain.rootClues')}: {clueChain.validation.root_clue_count}
              </Paragraph>
              <Paragraph>
                {t('aiCreation.steps.clueChain.paths')}: {clueChain.validation.reasoning_path_count}
              </Paragraph>
            </Col>
            <Col span={12}>
              {clueChain.ai_notes.length > 0 && (
                <>
                  <Title level={5}>{t('aiCreation.steps.clueChain.aiNotes')}</Title>
                  <ul>
                    {clueChain.ai_notes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </>
              )}
            </Col>
          </Row>
          <Divider />
          <Collapse
            items={[
              {
                key: 'clues',
                label: t('aiCreation.steps.clueChain.viewClues'),
                children: (
                  <List
                    size="small"
                    dataSource={clueChain.nodes}
                    renderItem={(node) => (
                      <List.Item>
                        <Space>
                          <Tag color={
                            node.importance === 'high' ? 'red' :
                            node.importance === 'medium' ? 'orange' : 'blue'
                          }>
                            {node.importance}
                          </Tag>
                          <Text strong>{node.name}</Text>
                          <Text type="secondary">- {node.description}</Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                ),
              },
            ]}
          />
        </>
      )}
      <Space style={{ marginTop: 24 }}>
        <Button onClick={() => setCurrentStep(1)}>{t('common.back')}</Button>
        <Button
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={handleOptimizeClueChain}
        >
          {t('aiCreation.optimize')}
        </Button>
        <Button type="primary" loading={loading} onClick={handleConfirmClueChain}>
          {t('aiCreation.confirmAndContinue')}
        </Button>
      </Space>
    </Card>
  );

  // Step 4: NPCs
  const renderNPCsStep = () => (
    <Card title={t('aiCreation.steps.npcs.title')}>
      <Alert
        message={t('aiCreation.steps.npcs.hint')}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <List
        grid={{ gutter: 16, column: 2 }}
        dataSource={npcs}
        renderItem={(npc) => (
          <List.Item>
            <Card size="small" title={npc.name}>
              <Paragraph>
                <Text strong>{t('aiCreation.fields.role')}: </Text>
                {npc.role}
              </Paragraph>
              {npc.age && (
                <Paragraph>
                  <Text strong>{t('aiCreation.fields.age')}: </Text>
                  {npc.age}
                </Paragraph>
              )}
              <Paragraph>
                <Text type="secondary">{npc.background_summary}</Text>
              </Paragraph>
              <Paragraph>
                <Text strong>{t('aiCreation.fields.clueCount')}: </Text>
                {npc.assigned_clue_temp_ids.length}
              </Paragraph>
            </Card>
          </List.Item>
        )}
      />
      <Space style={{ marginTop: 24 }}>
        <Button onClick={() => setCurrentStep(2)}>{t('common.back')}</Button>
        <Button type="primary" loading={loading} onClick={handleConfirmNPCs}>
          {t('aiCreation.generateDetails')}
        </Button>
      </Space>
    </Card>
  );

  // Step 5: Details
  const renderDetailsStep = () => (
    <Card title={t('aiCreation.steps.details.title')}>
      <Alert
        message={t('aiCreation.steps.details.hint')}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <Collapse
        items={[
          {
            key: 'clues',
            label: `${t('aiCreation.steps.details.clueDetails')} (${clueDetails.length})`,
            children: (
              <List
                size="small"
                dataSource={clueDetails}
                renderItem={(clue) => (
                  <List.Item>
                    <div style={{ width: '100%' }}>
                      <Text strong>{clue.name}</Text>
                      <Paragraph style={{ marginTop: 8 }}>
                        <Text type="secondary">{clue.detail}</Text>
                      </Paragraph>
                      <Space size={[4, 4]} wrap>
                        {clue.trigger_keywords.map((kw, i) => (
                          <Tag key={i} color="blue">{kw}</Tag>
                        ))}
                      </Space>
                    </div>
                  </List.Item>
                )}
              />
            ),
          },
          {
            key: 'npcs',
            label: `${t('aiCreation.steps.details.npcDetails')} (${npcDetails.length})`,
            children: (
              <List
                size="small"
                dataSource={npcDetails}
                renderItem={(npc) => (
                  <List.Item>
                    <div style={{ width: '100%' }}>
                      <Text strong>{npc.name}</Text>
                      <Paragraph style={{ marginTop: 8 }}>
                        {npc.background}
                      </Paragraph>
                    </div>
                  </List.Item>
                )}
              />
            ),
          },
        ]}
      />
      <Space style={{ marginTop: 24 }}>
        <Button onClick={() => setCurrentStep(3)}>{t('common.back')}</Button>
        <Button type="primary" onClick={handleConfirmDetails}>
          {t('aiCreation.proceedToReview')}
        </Button>
      </Space>
    </Card>
  );

  // Step 6: Review
  const renderReviewStep = () => (
    <Card title={t('aiCreation.steps.review.title')}>
      <Alert
        message={t('aiCreation.steps.review.hint')}
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      {setting && selectedTruth && (
        <>
          <Title level={5}>{t('aiCreation.steps.review.summary')}</Title>
          <Row gutter={16}>
            <Col span={12}>
              <Paragraph>
                <Text strong>{t('aiCreation.fields.genre')}: </Text>
                {setting.genre}
              </Paragraph>
              <Paragraph>
                <Text strong>{t('aiCreation.fields.era')}: </Text>
                {setting.era}
              </Paragraph>
              <Paragraph>
                <Text strong>{t('aiCreation.fields.location')}: </Text>
                {setting.location}
              </Paragraph>
            </Col>
            <Col span={12}>
              <Paragraph>
                <Text strong>{t('aiCreation.fields.murderer')}: </Text>
                {selectedTruth.murderer}
              </Paragraph>
              <Paragraph>
                <Text strong>{t('aiCreation.fields.motive')}: </Text>
                {selectedTruth.motive}
              </Paragraph>
              <Paragraph>
                <Text strong>{t('aiCreation.fields.method')}: </Text>
                {selectedTruth.method}
              </Paragraph>
            </Col>
          </Row>
          <Divider />
          <Row gutter={16}>
            <Col span={8}>
              <Paragraph>
                <Text strong>{t('aiCreation.steps.review.totalClues')}: </Text>
                {clueChain?.nodes.length || 0}
              </Paragraph>
            </Col>
            <Col span={8}>
              <Paragraph>
                <Text strong>{t('aiCreation.steps.review.totalNPCs')}: </Text>
                {npcs.length}
              </Paragraph>
            </Col>
            <Col span={8}>
              <Paragraph>
                <Text strong>{t('aiCreation.steps.review.status')}: </Text>
                <Tag color={clueChain?.validation.is_valid ? 'green' : 'orange'}>
                  {clueChain?.validation.is_valid
                    ? t('aiCreation.steps.review.ready')
                    : t('aiCreation.steps.review.hasWarnings')}
                </Tag>
              </Paragraph>
            </Col>
          </Row>
        </>
      )}
      <Space style={{ marginTop: 24 }}>
        <Button onClick={() => setCurrentStep(4)}>{t('common.back')}</Button>
        <Button type="primary" loading={loading} onClick={handleCreateScript}>
          {t('aiCreation.createScript')}
        </Button>
      </Space>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title={t('aiCreation.title')}
        subtitle={t('aiCreation.subtitle')}
      />

      <Card style={{ marginBottom: 24 }}>
        <Steps
          current={currentStep}
          items={STEPS.map((step) => ({
            title: t(`aiCreation.steps.${step.key}.name`),
            icon: step.icon,
          }))}
        />
      </Card>

      <Spin spinning={loading}>
        {renderStepContent()}
      </Spin>
    </div>
  );
}
