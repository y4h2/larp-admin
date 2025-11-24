import { Tree, Typography, Tooltip, Empty } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { templateApi } from '@/api';
import type { VariableCategory, VariableInfo } from '@/api/templates';

const { Text } = Typography;

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

  const convertToTreeData = (cats: VariableCategory[]): DataNode[] => {
    return cats.map((category, catIndex) => ({
      key: `cat-${catIndex}`,
      title: (
        <Tooltip title={category.description}>
          <Text strong>{category.name}</Text>
        </Tooltip>
      ),
      selectable: false,
      children: category.variables.map((variable, varIndex) => ({
        key: `var-${catIndex}-${varIndex}`,
        title: (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              paddingRight: 8,
            }}
          >
            <Text code style={{ cursor: 'pointer' }}>
              {`{${variable.name}}`}
            </Text>
            {variable.description && (
              <Tooltip title={`${variable.description}${variable.example ? ` (${t('template.example')}: ${variable.example})` : ''}`}>
                <InfoCircleOutlined style={{ color: '#999', marginLeft: 4 }} />
              </Tooltip>
            )}
          </div>
        ),
        isLeaf: true,
        variable,
      })),
    }));
  };

  const handleSelect = (_: React.Key[], info: { node: DataNode & { variable?: VariableInfo } }) => {
    if (info.node.variable) {
      onInsert(`{${info.node.variable.name}}`);
    }
  };

  if (loading) {
    return <div style={{ padding: 16, textAlign: 'center' }}>{t('common.loading')}</div>;
  }

  if (categories.length === 0) {
    return <Empty description={t('common.noData')} />;
  }

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('template.clickToInsert')}
        </Text>
      </div>
      <Tree
        treeData={convertToTreeData(categories)}
        defaultExpandAll
        onSelect={handleSelect}
        style={{ padding: 8 }}
      />
    </div>
  );
}
