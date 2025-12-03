import { memo } from 'react';
import { Select, Space, Typography } from 'antd';
import type { Script, NPC, Clue } from '@/types';

const { Option } = Select;
const { Text } = Typography;

interface BasicConfigTabProps {
  scripts: Script[];
  npcs: NPC[];
  clues: Clue[];
  selectedScriptId: string | null;
  selectedNpcId: string | null;
  unlockedClueIds: string[];
  onScriptChange: (value: string | null) => void;
  onNpcChange: (value: string | null) => void;
  onUnlockedCluesChange: (value: string[]) => void;
  getNpcName: (npcId: string) => string;
  t: (key: string) => string;
}

export const BasicConfigTab = memo(function BasicConfigTab({
  scripts,
  npcs,
  clues,
  selectedScriptId,
  selectedNpcId,
  unlockedClueIds,
  onScriptChange,
  onNpcChange,
  onUnlockedCluesChange,
  getNpcName,
  t,
}: BasicConfigTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <div>
        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>{t('debug.selectScript')}</div>
        <Select
          placeholder={t('debug.selectScript')}
          value={selectedScriptId}
          onChange={onScriptChange}
          style={{ width: '100%' }}
          allowClear
        >
          {scripts.map((s) => <Option key={s.id} value={s.id}>{s.title}</Option>)}
        </Select>
      </div>
      <div>
        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>{t('debug.selectNpc')}</div>
        <Select
          placeholder={t('debug.selectNpc')}
          value={selectedNpcId}
          onChange={onNpcChange}
          style={{ width: '100%' }}
          disabled={!selectedScriptId}
          allowClear
        >
          {npcs.map((n) => <Option key={n.id} value={n.id}>{n.name}</Option>)}
        </Select>
      </div>
      <div>
        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>{t('debug.unlockedClues')}</div>
        <Select
          mode="multiple"
          placeholder={t('debug.unlockedCluesExtra')}
          value={unlockedClueIds}
          onChange={onUnlockedCluesChange}
          style={{ width: '100%' }}
          disabled={!selectedScriptId}
          maxTagCount={2}
        >
          {clues.map((c) => (
            <Option key={c.id} value={c.id}>
              <Space size={4}>
                <span>{c.name}</span>
                <Text type="secondary" style={{ fontSize: 11 }}>({getNpcName(c.npc_id)})</Text>
              </Space>
            </Option>
          ))}
        </Select>
      </div>
    </div>
  );
});
