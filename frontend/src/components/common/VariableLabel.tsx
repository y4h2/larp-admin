import { ReactNode, useState } from 'react';
import { Space, Tooltip, message } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export interface VariableLabelProps {
  /** The label text to display */
  label: ReactNode;
  /** The variable path without curly braces (e.g., "script.title") */
  variablePath: string;
  /** Additional elements to render after the icon (e.g., AI buttons) */
  extra?: ReactNode;
}

/**
 * A form label component that displays a variable path hint with copy functionality.
 * Hover over the icon to see the variable path, click to copy it to clipboard.
 */
export default function VariableLabel({ label, variablePath, extra }: VariableLabelProps) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);

  const copyValue = `{{${variablePath}}}`;

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await navigator.clipboard.writeText(copyValue);
      message.success(t('common.copied'));
    } catch {
      message.error(t('common.copyFailed'));
    }
  };

  return (
    <Space size={4}>
      <span>{label}</span>
      <Tooltip title={`${t('common.variable')}: ${copyValue}`} placement="top">
        <CodeOutlined
          style={{
            fontSize: 12,
            color: isHovered ? '#1890ff' : '#8c8c8c',
            cursor: 'pointer',
            marginLeft: 2,
            transition: 'color 0.2s',
          }}
          onClick={handleCopy}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        />
      </Tooltip>
      {extra}
    </Space>
  );
}
