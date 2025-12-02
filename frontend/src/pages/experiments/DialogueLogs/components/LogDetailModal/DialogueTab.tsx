import { Card, Descriptions, Typography } from 'antd';
import type { DialogueLog } from '@/types';
import { formatDate } from '@/utils';

const { Text, Paragraph } = Typography;

interface DialogueTabProps {
  log: DialogueLog;
  getNpcName: (npcId: string) => string;
  t: (key: string) => string;
}

export const DialogueTab: React.FC<DialogueTabProps> = ({ log, getNpcName, t }) => (
  <div>
    <Descriptions column={2} bordered size="small">
      <Descriptions.Item label={t('logs.sessionId')} span={2}>
        <Text code copyable>{log.session_id}</Text>
      </Descriptions.Item>
      <Descriptions.Item label={t('logs.time')}>{formatDate(log.created_at)}</Descriptions.Item>
      <Descriptions.Item label="NPC">{getNpcName(log.npc_id)}</Descriptions.Item>
    </Descriptions>

    <Card size="small" title={t('logs.playerMessage')} style={{ marginTop: 16 }}>
      <Paragraph>{log.player_message}</Paragraph>
    </Card>

    <Card size="small" title={t('logs.npcResponse')} style={{ marginTop: 16 }}>
      <Paragraph>{log.npc_response}</Paragraph>
    </Card>
  </div>
);
