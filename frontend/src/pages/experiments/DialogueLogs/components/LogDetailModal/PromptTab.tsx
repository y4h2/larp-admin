import { Card, Tag, Timeline, Empty, Typography } from 'antd';
import type { DialogueLog } from '@/types';

const { Paragraph } = Typography;

interface PromptTabProps {
  log: DialogueLog;
  t: (key: string) => string;
}

export const PromptTab: React.FC<PromptTabProps> = ({ log, t }) => {
  const promptInfo = log.debug_info?.prompt_info;

  if (!promptInfo) {
    return <Empty description={t('logs.noPromptInfo')} />;
  }

  return (
    <div>
      {promptInfo.system_prompt && (
        <Card size="small" title={t('logs.systemPrompt')} style={{ marginBottom: 16 }}>
          <Paragraph
            copyable
            style={{
              whiteSpace: 'pre-wrap',
              backgroundColor: '#f5f5f5',
              padding: 12,
              borderRadius: 4,
              maxHeight: 300,
              overflow: 'auto',
            }}
          >
            {promptInfo.system_prompt}
          </Paragraph>
        </Card>
      )}

      {promptInfo.user_prompt && (
        <Card size="small" title={t('logs.userPrompt')} style={{ marginBottom: 16 }}>
          <Paragraph
            copyable
            style={{
              whiteSpace: 'pre-wrap',
              backgroundColor: '#e6f7ff',
              padding: 12,
              borderRadius: 4,
              maxHeight: 300,
              overflow: 'auto',
            }}
          >
            {promptInfo.user_prompt}
          </Paragraph>
        </Card>
      )}

      {promptInfo.messages && promptInfo.messages.length > 0 && (
        <Card size="small" title={t('logs.fullMessages')}>
          <Timeline
            items={promptInfo.messages.map((msg, i) => ({
              key: i,
              color: msg.role === 'system' ? 'gray' : msg.role === 'user' ? 'blue' : 'green',
              content: (
                <div>
                  <Tag color={msg.role === 'system' ? 'default' : msg.role === 'user' ? 'blue' : 'green'}>
                    {msg.role === 'system' ? t('logs.messageRole') + ': System' :
                     msg.role === 'user' ? t('logs.messageRole') + ': User' :
                     t('logs.messageRole') + ': Assistant'}
                  </Tag>
                  <Paragraph
                    copyable
                    style={{
                      whiteSpace: 'pre-wrap',
                      backgroundColor: msg.role === 'system' ? '#f5f5f5' :
                                      msg.role === 'user' ? '#e6f7ff' : '#f6ffed',
                      padding: 8,
                      borderRadius: 4,
                      marginTop: 8,
                      maxHeight: 200,
                      overflow: 'auto',
                    }}
                  >
                    {msg.content}
                  </Paragraph>
                </div>
              ),
            }))}
          />
        </Card>
      )}
    </div>
  );
};
