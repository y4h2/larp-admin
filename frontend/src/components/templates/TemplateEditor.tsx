import { useRef, useCallback } from 'react';
import { Input, Card, Row, Col, Typography, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import VariablePanel from './VariablePanel';

const { TextArea } = Input;
const { Text } = Typography;

interface TemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  showVariablePanel?: boolean;
  warnings?: string[];
}

export default function TemplateEditor({
  value,
  onChange,
  placeholder,
  minRows = 6,
  maxRows = 20,
  showVariablePanel = true,
  warnings = [],
}: TemplateEditorProps) {
  const { t } = useTranslation();
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertVariable = useCallback(
    (variable: string) => {
      const textarea = textAreaRef.current;
      if (!textarea) {
        onChange(value + variable);
        return;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + variable + value.substring(end);
      onChange(newValue);

      // Restore cursor position after variable
      setTimeout(() => {
        textarea.focus();
        const newPosition = start + variable.length;
        textarea.setSelectionRange(newPosition, newPosition);
      }, 0);
    },
    [value, onChange]
  );

  // Highlight variables in the syntax hint
  const variablePattern = /\{[^}]+\}/g;
  const extractedVariables = value.match(variablePattern) || [];

  return (
    <Row gutter={16}>
      <Col span={showVariablePanel ? 16 : 24}>
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('template.syntaxHint')}
          </Text>
        </div>
        <TextArea
          ref={textAreaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || t('template.editorPlaceholder')}
          autoSize={{ minRows, maxRows }}
          style={{
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
            fontSize: 13,
          }}
        />
        {extractedVariables.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('template.detectedVariables')} ({extractedVariables.length}):{' '}
            </Text>
            {extractedVariables.map((v, i) => (
              <Text code key={i} style={{ marginRight: 4, fontSize: 11 }}>
                {v}
              </Text>
            ))}
          </div>
        )}
        {warnings.length > 0 && (
          <Alert
            type="warning"
            message={t('template.unresolvedVariables')}
            description={
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            }
            style={{ marginTop: 8 }}
          />
        )}
      </Col>
      {showVariablePanel && (
        <Col span={8}>
          <Card
            title={t('template.availableVariables')}
            size="small"
            style={{ height: '100%' }}
            bodyStyle={{ padding: 0, height: 'calc(100% - 38px)' }}
          >
            <VariablePanel onInsert={handleInsertVariable} />
          </Card>
        </Col>
      )}
    </Row>
  );
}
