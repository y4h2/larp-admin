import { useState, useEffect, useCallback } from 'react';
import { Card, Tabs, Button, Empty, Spin, Alert, message } from 'antd';
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { templateApi } from '@/api';
import type { TemplateRenderResponse } from '@/api/templates';

interface TemplatePreviewProps {
  templateContent: string;
  context: Record<string, unknown>;
  templateId?: string;
  autoRender?: boolean;
}

export default function TemplatePreview({
  templateContent,
  context,
  templateId,
  autoRender = false,
}: TemplatePreviewProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [renderResult, setRenderResult] = useState<TemplateRenderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRender = useCallback(async () => {
    if (!templateContent && !templateId) {
      setRenderResult(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await templateApi.render({
        template_id: templateId,
        template_content: templateContent,
        context,
      });
      setRenderResult(result);
    } catch (err) {
      setError(t('template.renderFailed'));
      setRenderResult(null);
    } finally {
      setLoading(false);
    }
  }, [templateContent, templateId, context, t]);

  useEffect(() => {
    if (autoRender) {
      const debounceTimer = setTimeout(() => {
        handleRender();
      }, 500);
      return () => clearTimeout(debounceTimer);
    }
  }, [autoRender, handleRender]);

  const handleCopy = () => {
    if (renderResult?.rendered_content) {
      navigator.clipboard.writeText(renderResult.rendered_content);
      message.success(t('common.copy') + ' ' + t('common.saveSuccess'));
    }
  };

  return (
    <Card
      title={t('template.preview')}
      size="small"
      extra={
        <Button.Group>
          <Button icon={<ReloadOutlined />} onClick={handleRender} loading={loading}>
            {t('template.render')}
          </Button>
          <Button
            icon={<CopyOutlined />}
            onClick={handleCopy}
            disabled={!renderResult?.rendered_content}
          >
            {t('common.copy')}
          </Button>
        </Button.Group>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin />
        </div>
      ) : error ? (
        <Alert type="error" message={error} />
      ) : !renderResult ? (
        <Empty description={t('template.clickRenderToPreview')} />
      ) : (
        <Tabs
          items={[
            {
              key: 'rendered',
              label: t('template.renderedContent'),
              children: (
                <div>
                  {renderResult.warnings.length > 0 && (
                    <Alert
                      type="warning"
                      message={t('template.renderWarnings')}
                      description={
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {renderResult.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      }
                      style={{ marginBottom: 12 }}
                    />
                  )}
                  {renderResult.unresolved_variables.length > 0 && (
                    <Alert
                      type="info"
                      message={t('template.unresolvedVariables')}
                      description={renderResult.unresolved_variables.join(', ')}
                      style={{ marginBottom: 12 }}
                    />
                  )}
                  <pre
                    style={{
                      background: '#f5f5f5',
                      padding: 12,
                      borderRadius: 4,
                      overflow: 'auto',
                      maxHeight: 400,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: 13,
                      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
                    }}
                  >
                    {renderResult.rendered_content || t('template.emptyResult')}
                  </pre>
                </div>
              ),
            },
            {
              key: 'context',
              label: t('template.contextData'),
              children: (
                <pre
                  style={{
                    background: '#f5f5f5',
                    padding: 12,
                    borderRadius: 4,
                    overflow: 'auto',
                    maxHeight: 400,
                    fontSize: 12,
                    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
                  }}
                >
                  {JSON.stringify(context, null, 2)}
                </pre>
              ),
            },
          ]}
        />
      )}
    </Card>
  );
}
