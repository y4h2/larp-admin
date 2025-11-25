import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Space,
  Input,
  Select,
  Modal,
  Form,
  Dropdown,
  Tag,
  Row,
  Col,
  Collapse,
  Typography,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  MoreOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader, ResizableTable, type ResizableColumn } from '@/components/common';
import { useTemplates } from '@/hooks/useTemplates';
import { templateApi, type VariableCategory } from '@/api/templates';
import { formatDate } from '@/utils';
import type { PromptTemplate, TemplateType, TemplateCreateData } from '@/api/templates';

const { Text } = Typography;

const { Option } = Select;

const TEMPLATE_TYPES: TemplateType[] = ['clue_embedding', 'npc_system_prompt', 'clue_reveal', 'custom'];

export default function TemplateList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const {
    loading,
    templates,
    total,
    fetchTemplates,
    createTemplate,
    deleteTemplate,
    duplicateTemplate,
    setDefaultTemplate,
  } = useTemplates();

  const [modalVisible, setModalVisible] = useState(false);
  const [availableVariables, setAvailableVariables] = useState<VariableCategory[]>([]);
  const [templateContent, setTemplateContent] = useState('');
  const [filters, setFilters] = useState<{
    type?: TemplateType;
    search?: string;
    page: number;
    page_size: number;
  }>({
    page: 1,
    page_size: 10,
  });

  useEffect(() => {
    fetchTemplates(filters);
  }, [filters, fetchTemplates]);

  useEffect(() => {
    // Fetch available variables when modal opens
    if (modalVisible && availableVariables.length === 0) {
      templateApi.getAvailableVariables().then((res) => {
        setAvailableVariables(res.categories);
      });
    }
  }, [modalVisible, availableVariables.length]);

  const insertVariable = (variableName: string) => {
    const newContent = templateContent + `{${variableName}}`;
    setTemplateContent(newContent);
    form.setFieldsValue({ content: newContent });
  };

  const handleCreate = async (values: TemplateCreateData) => {
    try {
      const template = await createTemplate(values);
      setModalVisible(false);
      form.resetFields();
      setTemplateContent('');
      fetchTemplates(filters);
      navigate(`/settings/templates/${template.id}`);
    } catch {
      // Error already handled in hook
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateTemplate(id);
      fetchTemplates(filters);
    } catch {
      // Error already handled
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate(id);
      fetchTemplates(filters);
    } catch {
      // Error already handled
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultTemplate(id);
      fetchTemplates(filters);
    } catch {
      // Error already handled
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

  const getActionMenu = (record: PromptTemplate): MenuProps['items'] => [
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: t('common.edit'),
      onClick: () => navigate(`/settings/templates/${record.id}`),
    },
    {
      key: 'copy',
      icon: <CopyOutlined />,
      label: t('common.copy'),
      onClick: () => handleDuplicate(record.id),
    },
    {
      key: 'setDefault',
      icon: <CheckCircleOutlined />,
      label: t('template.setAsDefault'),
      disabled: record.is_default,
      onClick: () => handleSetDefault(record.id),
    },
    { type: 'divider' },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: t('common.delete'),
      danger: true,
      onClick: () => {
        Modal.confirm({
          title: t('template.deleteTemplate'),
          content: t('template.deleteConfirm', { name: record.name }),
          okText: t('common.delete'),
          okType: 'danger',
          onOk: () => handleDelete(record.id),
        });
      },
    },
  ];

  const columns: ResizableColumn<PromptTemplate>[] = [
    {
      title: t('template.templateName'),
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <a onClick={() => navigate(`/settings/templates/${record.id}`)}>{text}</a>
          {record.is_default && (
            <Tag color="gold">{t('template.default')}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: t('template.type'),
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: (type: TemplateType) => (
        <Tag color={getTypeColor(type)}>{t(`template.types.${type}`)}</Tag>
      ),
    },
    {
      title: t('common.description'),
      dataIndex: 'description',
      key: 'description',
      width: 300,
      ellipsis: true,
    },
    {
      title: t('template.variables'),
      dataIndex: 'variables',
      key: 'variables',
      width: 200,
      render: (variables: string[]) => (
        <span style={{ color: '#666' }}>
          {variables.length > 0 ? variables.slice(0, 3).join(', ') + (variables.length > 3 ? '...' : '') : '-'}
        </span>
      ),
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (date) => formatDate(date),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Dropdown menu={{ items: getActionMenu(record) }} trigger={['click']}>
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('template.title')}
        subtitle={t('template.subtitle')}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            {t('template.createTemplate')}
          </Button>
        }
      />

      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder={t('template.searchPlaceholder')}
          prefix={<SearchOutlined />}
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
          style={{ width: 250 }}
          allowClear
        />
        <Select
          placeholder={t('template.type')}
          value={filters.type}
          onChange={(value) => setFilters({ ...filters, type: value, page: 1 })}
          style={{ width: 180 }}
          allowClear
        >
          {TEMPLATE_TYPES.map((type) => (
            <Option key={type} value={type}>
              {t(`template.types.${type}`)}
            </Option>
          ))}
        </Select>
      </Space>

      <ResizableTable
        columns={columns}
        dataSource={templates}
        rowKey="id"
        loading={loading}
        pagination={{
          current: filters.page,
          pageSize: filters.page_size,
          total,
          showSizeChanger: true,
          showTotal: (total: number) => t('template.totalTemplates', { total }),
          onChange: (page: number, pageSize: number) =>
            setFilters({ ...filters, page, page_size: pageSize }),
        }}
      />

      <Modal
        title={t('template.createTemplate')}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setTemplateContent('');
        }}
        footer={null}
        width={900}
        styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
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
              <Form.Item
                name="type"
                label={t('template.type')}
                rules={[{ required: true, message: t('template.selectType') }]}
                initialValue="custom"
              >
                <Select>
                  {TEMPLATE_TYPES.map((type) => (
                    <Option key={type} value={type}>
                      {t(`template.types.${type}`)}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea placeholder={t('template.descriptionPlaceholder')} rows={2} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={14}>
              <Form.Item
                name="content"
                label={t('template.content')}
                rules={[{ required: true, message: t('template.enterContent') }]}
              >
                <Input.TextArea
                  value={templateContent}
                  onChange={(e) => {
                    setTemplateContent(e.target.value);
                    form.setFieldsValue({ content: e.target.value });
                  }}
                  placeholder={t('template.editorPlaceholder')}
                  rows={12}
                  style={{ fontFamily: 'monospace', fontSize: 13 }}
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <div style={{ marginBottom: 8 }}>
                <Text strong>{t('template.availableVariables')}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('template.clickToInsert')}
                </Text>
              </div>
              <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid #d9d9d9', borderRadius: 6, padding: 8 }}>
                <Collapse
                  size="small"
                  defaultActiveKey={availableVariables.map((_, i) => i.toString())}
                  items={availableVariables.map((category, index) => ({
                    key: index.toString(),
                    label: (
                      <Space>
                        <Tag color="purple">{category.name}</Tag>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {category.description}
                        </Text>
                      </Space>
                    ),
                    children: (
                      <Space size={[4, 4]} wrap>
                        {category.variables.map((variable) => (
                          <Tag
                            key={variable.name}
                            color="blue"
                            style={{ cursor: 'pointer', marginBottom: 4 }}
                            onClick={() => insertVariable(variable.name)}
                            title={`${variable.description}\n${t('template.example')}: ${variable.example || '-'}`}
                          >
                            {`{${variable.name}}`}
                          </Tag>
                        ))}
                      </Space>
                    ),
                  }))}
                />
              </div>
            </Col>
          </Row>

          <Form.Item name="is_default" valuePropName="checked" initialValue={false}>
            <Space>
              <input type="checkbox" id="is_default" />
              <label htmlFor="is_default">{t('template.setAsDefault')}</label>
            </Space>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {t('common.create')}
              </Button>
              <Button onClick={() => setModalVisible(false)}>{t('common.cancel')}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
