import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Spin,
  Empty,
  Row,
  Col,
  message,
  Typography,
  Tag,
  Collapse,
  Space,
  Checkbox,
  Alert,
  Table,
} from 'antd';
import { SaveOutlined, EyeOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/common';
import {
  templateApi,
  type PromptTemplate,
  type TemplateUpdateData,
  type TemplateType,
  type VariableCategory,
} from '@/api/templates';

const { Option } = Select;
const { TextArea } = Input;
const { Text, Paragraph } = Typography;

const TEMPLATE_TYPES: TemplateType[] = ['clue_embedding', 'npc_system_prompt', 'clue_reveal', 'custom'];

export default function TemplateDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<PromptTemplate | null>(null);
  const [availableVariables, setAvailableVariables] = useState<VariableCategory[]>([]);
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
  const [previewing, setPreviewing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [templateData, variablesData] = await Promise.all([
        templateApi.get(id),
        templateApi.getAvailableVariables(),
      ]);
      setTemplate(templateData);
      setAvailableVariables(variablesData.categories);
      form.setFieldsValue(templateData);
    } catch {
      message.error(t('common.loadFailed'));
      navigate('/settings/templates');
    } finally {
      setLoading(false);
    }
  }, [id, form, navigate, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (values: TemplateUpdateData) => {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await templateApi.update(id, values);
      setTemplate(updated);
      message.success(t('common.saveSuccess'));
    } catch {
      message.error(t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    const content = form.getFieldValue('content');
    if (!content) {
      message.warning(t('template.enterContent'));
      return;
    }

    setPreviewing(true);
    try {
      // Build sample context from available variables
      const sampleContext = buildSampleContext();
      const result = await templateApi.render({
        template_content: content,
        context: sampleContext,
      });
      setPreviewResult(result.rendered_content);
      setPreviewWarnings(result.warnings);
    } catch (error) {
      message.error(t('template.renderFailed'));
    } finally {
      setPreviewing(false);
    }
  };

  const buildSampleContext = (): Record<string, unknown> => {
    // Build sample context for preview
    return {
      clue: {
        id: 'clue-sample-123',
        name: 'Murder Weapon',
        type: 'text',
        detail: 'A bloody knife found under the bed.',
        detail_for_npc: 'Nervously mention finding something sharp...',
        trigger_keywords: ['knife', 'weapon', 'murder'],
        trigger_semantic_summary: 'Player asks about the murder weapon',
      },
      npc: {
        id: 'npc-sample-456',
        name: 'John Smith',
        age: 45,
        background: 'A former butler who worked at the mansion for 20 years.',
        personality: 'Nervous and secretive, tends to avoid eye contact.',
        knowledge_scope: {
          knows: ['saw the victim at 10pm', 'heard a scream'],
          does_not_know: ['who the murderer is', 'where the weapon is'],
          world_model_limits: ['does not know about modern technology'],
        },
      },
      script: {
        id: 'script-sample-789',
        title: 'Murder at the Manor',
        summary: 'A thrilling murder mystery set in Victorian England.',
        background: 'The year is 1888, in a wealthy London mansion...',
        difficulty: 'medium',
        truth: {
          murderer: 'The Butler',
          weapon: 'Kitchen Knife',
          motive: 'Revenge for past betrayal',
          crime_method: 'Stabbed in the study at midnight',
        },
      },
      player_input: 'What happened last night?',
      now: new Date().toLocaleString(),
      unlocked_clues: ['Blood Stain', 'Alibi Letter'],
    };
  };

  const insertVariable = (variableName: string) => {
    const currentContent = form.getFieldValue('content') || '';
    const textArea = document.querySelector('textarea[id="content"]') as HTMLTextAreaElement;
    if (textArea) {
      const start = textArea.selectionStart;
      const end = textArea.selectionEnd;
      const newContent =
        currentContent.substring(0, start) +
        `{${variableName}}` +
        currentContent.substring(end);
      form.setFieldsValue({ content: newContent });
      // Move cursor after the inserted variable
      setTimeout(() => {
        textArea.focus();
        const newPosition = start + variableName.length + 2;
        textArea.setSelectionRange(newPosition, newPosition);
      }, 0);
    } else {
      form.setFieldsValue({ content: currentContent + `{${variableName}}` });
    }
  };

  const getTypeColor = (type: TemplateType) => {
    switch (type) {
      case 'clue_embedding':
        return 'blue';
      case 'npc_system_prompt':
        return 'green';
      case 'clue_reveal':
        return 'orange';
      case 'custom':
        return 'purple';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!template) {
    return <Empty description={t('template.notFound')} />;
  }

  const detectedVariables = template.variables || [];

  return (
    <div>
      <PageHeader
        title={template.name}
        subtitle={
          <Space>
            <Tag color={getTypeColor(template.type)}>{t(`template.types.${template.type}`)}</Tag>
            {template.is_default && <Tag color="gold">{t('template.default')}</Tag>}
          </Space>
        }
        breadcrumbs={[
          { title: t('template.title'), path: '/settings/templates' },
          { title: template.name },
        ]}
        extra={
          <Space>
            <Button
              icon={<EyeOutlined />}
              onClick={handlePreview}
              loading={previewing}
            >
              {t('template.preview')}
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={() => form.submit()}
            >
              {t('common.save')}
            </Button>
          </Space>
        }
      />

      <Row gutter={24}>
        <Col span={16}>
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Card title={t('common.basicInfo')} style={{ marginBottom: 24 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="name"
                    label={t('template.templateName')}
                    rules={[{ required: true, message: t('template.enterName') }]}
                  >
                    <Input placeholder={t('template.templateNamePlaceholder')} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="type" label={t('template.type')}>
                    <Select>
                      {TEMPLATE_TYPES.map((type) => (
                        <Option key={type} value={type}>
                          {t(`template.types.${type}`)}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="description" label={t('common.description')}>
                    <Input placeholder={t('template.descriptionPlaceholder')} />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="is_default" valuePropName="checked">
                    <Checkbox>{t('template.setAsDefault')}</Checkbox>
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card title={t('template.content')} style={{ marginBottom: 24 }}>
              <Alert
                message={t('template.syntaxHint')}
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Form.Item
                name="content"
                rules={[{ required: true, message: t('template.enterContent') }]}
              >
                <TextArea
                  id="content"
                  placeholder={t('template.editorPlaceholder')}
                  rows={12}
                  style={{ fontFamily: 'monospace', fontSize: 13 }}
                />
              </Form.Item>

              {detectedVariables.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">{t('template.detectedVariables')}: </Text>
                  {detectedVariables.map((v) => (
                    <Tag key={v} color="blue" style={{ marginBottom: 4 }}>
                      {`{${v}}`}
                    </Tag>
                  ))}
                </div>
              )}
            </Card>

            {previewResult !== null && (
              <Card
                title={t('template.renderedContent')}
                extra={
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => {
                      navigator.clipboard.writeText(previewResult);
                      message.success(t('common.copied'));
                    }}
                  >
                    {t('common.copy')}
                  </Button>
                }
              >
                {previewWarnings.length > 0 && (
                  <Alert
                    message={t('template.renderWarnings')}
                    description={previewWarnings.join(', ')}
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                )}
                <Paragraph
                  style={{
                    background: '#f5f5f5',
                    padding: 16,
                    borderRadius: 4,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: 13,
                  }}
                >
                  {previewResult || t('template.emptyResult')}
                </Paragraph>
              </Card>
            )}
          </Form>
        </Col>

        <Col span={8}>
          <Card
            title={t('template.availableVariables')}
            styles={{ body: { maxHeight: 'calc(100vh - 250px)', overflow: 'auto' } }}
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              {t('template.clickToInsert')}
            </Text>
            <Collapse
              defaultActiveKey={availableVariables.map((_, i) => i.toString())}
              size="small"
              items={availableVariables.map((category, index) => ({
                key: index.toString(),
                label: (
                  <span>
                    <Tag color="purple">{category.name}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t(`template.categoryDescriptions.${category.name}`, { defaultValue: category.description })}
                    </Text>
                  </span>
                ),
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {category.variables.map((variable) => (
                      <div
                        key={variable.name}
                        style={{
                          padding: '8px 12px',
                          background: '#fafafa',
                          borderRadius: 4,
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onClick={() => insertVariable(variable.name)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#e6f7ff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#fafafa';
                        }}
                      >
                        <div>
                          <Tag
                            color="blue"
                            style={{ cursor: 'pointer', marginBottom: 4 }}
                          >
                            {`{${variable.name}}`}
                          </Tag>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            ({variable.type})
                          </Text>
                        </div>
                        <Text style={{ fontSize: 12 }}>{variable.description}</Text>
                        {variable.example && (
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {t('template.example')}: {variable.example}
                            </Text>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ),
              }))}
            />

          </Card>

          <Card
            title={t('template.listFormatTitle')}
            style={{ marginTop: 16 }}
            size="small"
          >
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
              {t('template.listFormatHint')}
            </Text>
            <Table
              dataSource={[
                { key: '1', syntax: '{var}', effect: t('template.listFormatDefault'), example: '1. 项目一\n2. 项目二' },
                { key: '2', syntax: '{var|comma}', effect: t('template.listFormatComma'), example: '项目一, 项目二' },
                { key: '3', syntax: '{var|bullet}', effect: t('template.listFormatBullet'), example: '• 项目一\n• 项目二' },
                { key: '4', syntax: '{var|dash}', effect: t('template.listFormatDash'), example: '- 项目一\n- 项目二' },
                { key: '5', syntax: '{var|newline}', effect: t('template.listFormatNewline'), example: '项目一\n项目二' },
              ]}
              columns={[
                { title: t('template.formatSyntax'), dataIndex: 'syntax', key: 'syntax', width: 100 },
                { title: t('template.formatEffect'), dataIndex: 'effect', key: 'effect', width: 120 },
                {
                  title: t('template.formatPreview'),
                  dataIndex: 'example',
                  key: 'example',
                  render: (text: string) => <Text style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>{text}</Text>
                },
              ]}
              pagination={false}
              size="small"
              bordered
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
