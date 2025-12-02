import { Tag, Tooltip, Typography, Button } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import type { PromptTemplate, LLMConfig } from '@/api';

const { Text } = Typography;

export interface IdWithNameProps {
  id: string | null | undefined;
  type: 'template' | 'llmConfig';
  template?: PromptTemplate | null;
  llmConfig?: LLMConfig | null;
  t: (key: string) => string;
}

export const IdWithName: React.FC<IdWithNameProps> = ({ id, type, template, llmConfig, t }) => {
  if (!id) return <span>-</span>;

  const handleCopy = () => {
    navigator.clipboard.writeText(id);
  };

  if (type === 'template') {
    const displayName = template?.name || id;
    return (
      <Tooltip
        title={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 400 }}>
            <div><Text style={{ color: 'rgba(255,255,255,0.65)' }}>{t('common.name')}:</Text> <span style={{ color: '#fff' }}>{template?.name || '-'}</span></div>
            <div><Text style={{ color: 'rgba(255,255,255,0.65)' }}>{t('template.type')}:</Text> <Tag color="blue" style={{ margin: 0 }}>{template?.type ? t(`template.types.${template.type}`) : '-'}</Tag></div>
            {template?.description && (
              <div><Text style={{ color: 'rgba(255,255,255,0.65)' }}>{t('common.description')}:</Text> <span style={{ color: '#fff' }}>{template.description}</span></div>
            )}
            {template?.content && (
              <div>
                <Text style={{ color: 'rgba(255,255,255,0.65)' }}>{t('template.content')}:</Text>
                <pre style={{
                  color: '#fff',
                  fontSize: 11,
                  background: 'rgba(255,255,255,0.1)',
                  padding: 8,
                  borderRadius: 4,
                  marginTop: 4,
                  maxHeight: 150,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {template.content}
                </pre>
              </div>
            )}
            <div><Text style={{ color: 'rgba(255,255,255,0.65)' }}>ID:</Text> <Text code style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 11 }}>{id}</Text></div>
            <Button size="small" icon={<CopyOutlined />} onClick={handleCopy} style={{ marginTop: 4 }}>
              {t('common.copy')} ID
            </Button>
          </div>
        }
        overlayStyle={{ maxWidth: 450 }}
      >
        <Tag color="blue" style={{ cursor: 'pointer' }}>
          {displayName}
        </Tag>
      </Tooltip>
    );
  }

  // LLM Config
  const displayName = llmConfig?.name || id;
  return (
    <Tooltip
      title={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div><Text style={{ color: 'rgba(255,255,255,0.65)' }}>{t('common.name')}:</Text> <span style={{ color: '#fff' }}>{llmConfig?.name || '-'}</span></div>
          <div><Text style={{ color: 'rgba(255,255,255,0.65)' }}>{t('llmConfig.type')}:</Text> <Tag color="green" style={{ margin: 0 }}>{llmConfig?.type ? t(`llmConfig.types.${llmConfig.type}`) : '-'}</Tag></div>
          <div><Text style={{ color: 'rgba(255,255,255,0.65)' }}>{t('llmConfig.model')}:</Text> <span style={{ color: '#fff' }}>{llmConfig?.model || '-'}</span></div>
          <div><Text style={{ color: 'rgba(255,255,255,0.65)' }}>{t('llmConfig.baseUrl')}:</Text> <span style={{ color: '#fff', fontSize: 11 }}>{llmConfig?.base_url || '-'}</span></div>
          <div><Text style={{ color: 'rgba(255,255,255,0.65)' }}>ID:</Text> <Text code style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 11 }}>{id}</Text></div>
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopy} style={{ marginTop: 4 }}>
            {t('common.copy')} ID
          </Button>
        </div>
      }
    >
      <Tag color="purple" style={{ cursor: 'pointer' }}>
        {displayName}
      </Tag>
    </Tooltip>
  );
};
