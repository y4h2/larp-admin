import { Modal, Tabs } from 'antd';
import {
  CommentOutlined,
  BugOutlined,
} from '@ant-design/icons';
import type { DialogueLog } from '@/types';
import type { PromptTemplate, LLMConfig } from '@/api';
import { ConversationTab } from './ConversationTab';
import { DebugTab } from './DebugTab';

interface LogDetailModalProps {
  visible: boolean;
  log: DialogueLog | null;
  onClose: () => void;
  getNpcName: (npcId: string) => string;
  getTemplate: (id: string | undefined | null) => PromptTemplate | null;
  getLlmConfig: (id: string | undefined | null) => LLMConfig | null;
  t: (key: string) => string;
}

export const LogDetailModal: React.FC<LogDetailModalProps> = ({
  visible,
  log,
  onClose,
  getNpcName,
  getTemplate,
  getLlmConfig,
  t,
}) => {
  if (!log) return null;

  return (
    <Modal
      title={t('logs.logDetails')}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={900}
    >
      <Tabs
        defaultActiveKey="conversation"
        items={[
          {
            key: 'conversation',
            label: <span><CommentOutlined />{t('logs.conversationFlow')}</span>,
            children: <ConversationTab log={log} getNpcName={getNpcName} t={t} />,
          },
          {
            key: 'debug',
            label: <span><BugOutlined />{t('logs.debugDetails')}</span>,
            children: <DebugTab log={log} getTemplate={getTemplate} getLlmConfig={getLlmConfig} t={t} />,
          },
        ]}
      />
    </Modal>
  );
};
