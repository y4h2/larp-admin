import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Select,
  Input,
  Button,
  Space,
  Row,
  Col,
  Tag,
  Descriptions,
  Collapse,
  Empty,
  message,
} from 'antd';
import { SendOutlined, ClearOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/common';
import { simulationApi, clueApi } from '@/api';
import { useScripts, useNpcs } from '@/hooks';
import type { Clue, SimulationResult, MatchedClue } from '@/types';

const { Option } = Select;
const { TextArea } = Input;

interface ChatMessage {
  role: 'player' | 'system';
  content: string;
  result?: SimulationResult;
}

export default function DialogueSimulation() {
  const { t } = useTranslation();
  const { scripts, fetchScripts } = useScripts();
  const { npcs, fetchNpcs } = useNpcs();
  const [clues, setClues] = useState<Clue[]>([]);

  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [unlockedClueIds, setUnlockedClueIds] = useState<string[]>([]);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [playerMessage, setPlayerMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  useEffect(() => {
    if (selectedScriptId) {
      fetchNpcs({ script_id: selectedScriptId });
      clueApi.list({ script_id: selectedScriptId, page_size: 100 }).then((res) => {
        setClues(res.items);
      });
    }
  }, [selectedScriptId, fetchNpcs]);

  const handleSend = async () => {
    if (!selectedScriptId || !selectedNpcId || !playerMessage.trim()) {
      message.warning(t('debug.fillAllFields'));
      return;
    }

    const newPlayerMessage: ChatMessage = {
      role: 'player',
      content: playerMessage,
    };
    setChatHistory((prev) => [...prev, newPlayerMessage]);
    setPlayerMessage('');
    setLoading(true);

    try {
      const result = await simulationApi.run({
        script_id: selectedScriptId,
        npc_id: selectedNpcId,
        unlocked_clue_ids: unlockedClueIds,
        player_message: playerMessage,
      });

      const systemMessage: ChatMessage = {
        role: 'system',
        content: `Matched ${result.matched_clues.length} clue(s)`,
        result,
      };
      setChatHistory((prev) => [...prev, systemMessage]);
    } catch {
      message.error(t('debug.simulationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setChatHistory([]);
    setUnlockedClueIds([]);
  };

  return (
    <div>
      <PageHeader
        title={t('debug.simulation')}
        subtitle={t('debug.simulationSubtitle')}
      />

      <Row gutter={16}>
        <Col span={8}>
          <Card title={t('debug.configuration')} size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <div style={{ marginBottom: 4 }}>{t('debug.selectScript')}</div>
                <Select
                  placeholder={t('debug.selectScript')}
                  value={selectedScriptId}
                  onChange={(value) => {
                    setSelectedScriptId(value);
                    setSelectedNpcId(null);
                    setUnlockedClueIds([]);
                    setClues([]);
                  }}
                  style={{ width: '100%' }}
                  allowClear
                >
                  {scripts.map((s) => (
                    <Option key={s.id} value={s.id}>
                      {s.title}
                    </Option>
                  ))}
                </Select>
              </div>

              <div>
                <div style={{ marginBottom: 4 }}>{t('debug.selectNpc')}</div>
                <Select
                  placeholder={t('debug.selectNpc')}
                  value={selectedNpcId}
                  onChange={setSelectedNpcId}
                  style={{ width: '100%' }}
                  disabled={!selectedScriptId}
                  allowClear
                >
                  {npcs.map((n) => (
                    <Option key={n.id} value={n.id}>
                      {n.name}
                    </Option>
                  ))}
                </Select>
              </div>

              <div>
                <div style={{ marginBottom: 4 }}>{t('debug.unlockedClues')}</div>
                <Select
                  mode="multiple"
                  placeholder={t('debug.unlockedCluesExtra')}
                  value={unlockedClueIds}
                  onChange={setUnlockedClueIds}
                  style={{ width: '100%' }}
                  disabled={!selectedScriptId}
                >
                  {clues.map((c) => (
                    <Option key={c.id} value={c.id}>
                      {c.name}
                    </Option>
                  ))}
                </Select>
              </div>
            </Space>
          </Card>
        </Col>

        <Col span={16}>
          <Card
            title={t('debug.simulationChat')}
            size="small"
            extra={
              <Button icon={<ClearOutlined />} onClick={handleClear} size="small">
                {t('debug.clear')}
              </Button>
            }
          >
            <div
              style={{
                height: 400,
                overflowY: 'auto',
                marginBottom: 16,
                padding: 16,
                background: '#fafafa',
                borderRadius: 8,
              }}
            >
              {chatHistory.length === 0 ? (
                <Empty description={t('debug.startMessage')} />
              ) : (
                chatHistory.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      marginBottom: 16,
                      textAlign: msg.role === 'player' ? 'right' : 'left',
                    }}
                  >
                    <Tag color={msg.role === 'player' ? 'blue' : 'green'}>
                      {msg.role === 'player' ? t('debug.player') : t('debug.system')}
                    </Tag>
                    <div
                      style={{
                        display: 'inline-block',
                        maxWidth: '70%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: msg.role === 'player' ? '#e6f7ff' : '#f6ffed',
                        marginTop: 4,
                      }}
                    >
                      {msg.content}
                      {msg.result && (
                        <Collapse
                          size="small"
                          style={{ marginTop: 8 }}
                          items={[
                            {
                              key: '1',
                              label: `${t('debug.matchDetails')} (${msg.result.matched_clues.length})`,
                              children: (
                                <div>
                                  {msg.result.matched_clues.map((mc: MatchedClue, j: number) => (
                                    <Descriptions key={j} size="small" column={1}>
                                      <Descriptions.Item label={t('debug.clue')}>
                                        {mc.clue_id}
                                      </Descriptions.Item>
                                      <Descriptions.Item label={t('debug.score')}>
                                        {(mc.score * 100).toFixed(0)}%
                                      </Descriptions.Item>
                                      <Descriptions.Item label={t('debug.matchType')}>
                                        <Tag>{mc.match_type}</Tag>
                                      </Descriptions.Item>
                                    </Descriptions>
                                  ))}
                                </div>
                              ),
                            },
                          ]}
                        />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <Space.Compact style={{ width: '100%' }}>
              <TextArea
                placeholder={t('debug.enterPlayerMessage')}
                value={playerMessage}
                onChange={(e) => setPlayerMessage(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                style={{ resize: 'none' }}
                rows={2}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSend}
                loading={loading}
                disabled={!selectedScriptId || !selectedNpcId}
              >
                {t('debug.send')}
              </Button>
            </Space.Compact>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
