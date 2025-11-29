import { Row, Col, Typography, Tooltip, Empty, Tag, Spin, Divider, Table } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { templateApi } from '@/api';
import type { VariableCategory, VariableInfo } from '@/api/templates';

const { Text, Title } = Typography;

interface VariablePanelProps {
  onInsert: (variable: string) => void;
}

export default function VariablePanel({ onInsert }: VariablePanelProps) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<VariableCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVariables = async () => {
      try {
        const data = await templateApi.getAvailableVariables();
        setCategories(data.categories);
      } catch {
        // Error handled silently
      } finally {
        setLoading(false);
      }
    };
    fetchVariables();
  }, []);

  const handleClick = (variable: VariableInfo) => {
    onInsert(`{${variable.name}}`);
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="small" />
      </div>
    );
  }

  if (categories.length === 0) {
    return <Empty description={t('common.noData')} />;
  }

  const listFormatData = [
    { key: '1', syntax: '{var}', effect: t('template.listFormatDefault'), example: '1. 项目一\n2. 项目二' },
    { key: '2', syntax: '{var|comma}', effect: t('template.listFormatComma'), example: '项目一, 项目二' },
    { key: '3', syntax: '{var|bullet}', effect: t('template.listFormatBullet'), example: '• 项目一\n• 项目二' },
    { key: '4', syntax: '{var|dash}', effect: t('template.listFormatDash'), example: '- 项目一\n- 项目二' },
    { key: '5', syntax: '{var|newline}', effect: t('template.listFormatNewline'), example: '项目一\n项目二' },
  ];

  const listFormatColumns = [
    { title: t('template.formatSyntax'), dataIndex: 'syntax', key: 'syntax', width: 150 },
    { title: t('template.formatEffect'), dataIndex: 'effect', key: 'effect', width: 150 },
    {
      title: t('template.formatPreview'),
      dataIndex: 'example',
      key: 'example',
      render: (text: string) => <Text style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{text}</Text>
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('template.clickToInsert')}
        </Text>
      </div>
      <Row gutter={[24, 16]}>
        {categories.map((category, catIndex) => (
          <Col key={catIndex} xs={24} sm={12} md={8} lg={6}>
            <div style={{ marginBottom: 8 }}>
              <Tooltip title={category.description}>
                <Text strong style={{ fontSize: 13 }}>
                  {category.name}
                </Text>
              </Tooltip>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {category.variables.map((variable, varIndex) => (
                <Tooltip
                  key={varIndex}
                  title={`${variable.description || ''}${variable.example ? ` (${t('template.example')}: ${variable.example})` : ''}`}
                >
                  <Tag
                    color="blue"
                    style={{ cursor: 'pointer', marginBottom: 4 }}
                    onClick={() => handleClick(variable)}
                  >
                    {`{${variable.name}}`}
                    {variable.description && (
                      <InfoCircleOutlined style={{ marginLeft: 4, fontSize: 10 }} />
                    )}
                  </Tag>
                </Tooltip>
              ))}
            </div>
          </Col>
        ))}
      </Row>

      <Divider style={{ margin: '16px 0' }} />

      <div>
        <Title level={5} style={{ marginBottom: 8 }}>{t('template.listFormatTitle')}</Title>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          {t('template.listFormatHint')}
        </Text>
        <Table
          dataSource={listFormatData}
          columns={listFormatColumns}
          pagination={false}
          size="small"
          bordered
        />
      </div>
    </div>
  );
}
