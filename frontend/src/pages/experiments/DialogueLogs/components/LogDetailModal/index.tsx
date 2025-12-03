import { Modal, Tabs } from 'antd';
import {
  MessageOutlined,
  SettingOutlined,
  ExperimentOutlined,
  CommentOutlined,
} from '@ant-design/icons';
import type { DialogueLog } from '@/types';
import type { PromptTemplate, LLMConfig } from '@/api';
import { DialogueTab } from './DialogueTab';
import { ConversationTab } from './ConversationTab';
import { ConfigTab } from './ConfigTab';
import { AlgorithmTab } from './AlgorithmTab';

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
            key: 'dialogue',
            label: <span><MessageOutlined />{t('logs.dialogueContent')}</span>,
            children: <DialogueTab log={log} getNpcName={getNpcName} t={t} />,
          },
          {
            key: 'config',
            label: <span><SettingOutlined />{t('logs.matchConfig')}</span>,
            children: <ConfigTab log={log} getTemplate={getTemplate} getLlmConfig={getLlmConfig} t={t} />,
          },
          {
            key: 'algorithm',
            label: <span><ExperimentOutlined />{t('logs.algorithmFlow')}</span>,
            children: <AlgorithmTab log={log} t={t} />,
          },
        ]}
      />
    </Modal>
  );
};
