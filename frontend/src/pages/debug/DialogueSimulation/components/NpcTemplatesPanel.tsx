import { memo } from 'react';
import { Tag, Button, Divider, Alert, Empty, Spin, Typography } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import type { PromptTemplate, TemplateRenderResponse } from '@/api/templates';
import type { NPC } from '@/types';

const { Text } = Typography;

interface NpcTemplatesPanelProps {
  selectedNpc: NPC | null;
  selectedNpcClueTemplate: PromptTemplate | null;
  selectedNpcNoClueTemplate: PromptTemplate | null;
  npcClueTemplatePreview: TemplateRenderResponse | null;
  npcNoClueTemplatePreview: TemplateRenderResponse | null;
  renderingNpcClueTemplate: boolean;
  renderingNpcNoClueTemplate: boolean;
  onRenderClueTemplate: () => void;
  onRenderNoClueTemplate: () => void;
  t: (key: string) => string;
}

export const NpcTemplatesPanel = memo(function NpcTemplatesPanel({
  selectedNpc,
  selectedNpcClueTemplate,
  selectedNpcNoClueTemplate,
  npcClueTemplatePreview,
  npcNoClueTemplatePreview,
  renderingNpcClueTemplate,
  renderingNpcNoClueTemplate,
  onRenderClueTemplate,
  onRenderNoClueTemplate,
  t,
}: NpcTemplatesPanelProps) {
  if (!selectedNpcClueTemplate && !selectedNpcNoClueTemplate) {
    return <Empty description={t('debug.selectNpcTemplate')} />;
  }

  return (
    <>
      {selectedNpcClueTemplate && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong style={{ fontSize: 12 }}>{t('debug.npcClueTemplatePreview')}</Text>
            <Button
              size="small"
              icon={renderingNpcClueTemplate ? <Spin size="small" /> : <EyeOutlined />}
              onClick={onRenderClueTemplate}
              disabled={renderingNpcClueTemplate || !selectedNpc}
            >
              {t('template.render')}
            </Button>
          </div>
          <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, maxHeight: 150, overflow: 'auto', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', border: '1px solid #d9d9d9' }}>
            {selectedNpcClueTemplate.content}
          </div>
          {selectedNpcClueTemplate.variables && selectedNpcClueTemplate.variables.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('template.detectedVariables')}:</Text>
              <div style={{ marginTop: 4 }}>
                {selectedNpcClueTemplate.variables.map((v, i) => <Tag key={i} color="purple" style={{ marginBottom: 4 }}>{v}</Tag>)}
              </div>
            </div>
          )}
          {npcClueTemplatePreview && (
            <div style={{ marginTop: 12 }}>
              <Divider style={{ margin: '8px 0' }} />
              <Text strong style={{ color: '#722ed1', fontSize: 12 }}>{t('debug.renderedResult')}:</Text>
              <div style={{ background: '#f9f0ff', padding: 12, borderRadius: 6, marginTop: 8, border: '1px solid #d3adf7', whiteSpace: 'pre-wrap', fontSize: 13, maxHeight: 200, overflow: 'auto' }}>
                {npcClueTemplatePreview.rendered_content || t('template.emptyResult')}
              </div>
              {npcClueTemplatePreview.warnings.length > 0 && (
                <Alert type="warning" message={t('template.renderWarnings')} description={npcClueTemplatePreview.warnings.join(', ')} style={{ marginTop: 8, fontSize: 12 }} />
              )}
            </div>
          )}
        </div>
      )}

      {selectedNpcNoClueTemplate && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong style={{ fontSize: 12 }}>{t('debug.npcNoClueTemplatePreview')}</Text>
            <Button
              size="small"
              icon={renderingNpcNoClueTemplate ? <Spin size="small" /> : <EyeOutlined />}
              onClick={onRenderNoClueTemplate}
              disabled={renderingNpcNoClueTemplate || !selectedNpc}
            >
              {t('template.render')}
            </Button>
          </div>
          <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, maxHeight: 150, overflow: 'auto', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', border: '1px solid #d9d9d9' }}>
            {selectedNpcNoClueTemplate.content}
          </div>
          {selectedNpcNoClueTemplate.variables && selectedNpcNoClueTemplate.variables.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('template.detectedVariables')}:</Text>
              <div style={{ marginTop: 4 }}>
                {selectedNpcNoClueTemplate.variables.map((v, i) => <Tag key={i} color="orange" style={{ marginBottom: 4 }}>{v}</Tag>)}
              </div>
            </div>
          )}
          {npcNoClueTemplatePreview && (
            <div style={{ marginTop: 12 }}>
              <Divider style={{ margin: '8px 0' }} />
              <Text strong style={{ color: '#fa8c16', fontSize: 12 }}>{t('debug.renderedResult')}:</Text>
              <div style={{ background: '#fff7e6', padding: 12, borderRadius: 6, marginTop: 8, border: '1px solid #ffd591', whiteSpace: 'pre-wrap', fontSize: 13, maxHeight: 200, overflow: 'auto' }}>
                {npcNoClueTemplatePreview.rendered_content || t('template.emptyResult')}
              </div>
              {npcNoClueTemplatePreview.warnings.length > 0 && (
                <Alert type="warning" message={t('template.renderWarnings')} description={npcNoClueTemplatePreview.warnings.join(', ')} style={{ marginTop: 8, fontSize: 12 }} />
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
});
