import { useEffect, useRef, memo } from 'react';
import {
  Card,
  Input,
  Button,
  Space,
  Tag,
  Descriptions,
  Collapse,
  Empty,
  Tooltip,
  Skeleton,
  message as antMessage,
} from 'antd';
import {
  SendOutlined,
  ClearOutlined,
  BulbOutlined,
  BulbFilled,
  CopyOutlined,
  InfoCircleOutlined,
  DownloadOutlined,
  StopOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import type { ChatMessage } from '../types';
import type { MatchedClue } from '@/types';
import type { TFunction } from 'i18next';

const { TextArea } = Input;

interface ChatPanelProps {
  chatHistory: ChatMessage[];
  playerMessage: string;
  loading: boolean;
  streamingNpcResponse: string;
  canSend: boolean;
  t: TFunction;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  onAbort: () => void;
  onClear: () => void;
}

const ChatPanel = memo(function ChatPanel({
  chatHistory,
  playerMessage,
  loading,
  streamingNpcResponse,
  canSend,
  t,
  onMessageChange,
  onSend,
  onAbort,
  onClear,
}: ChatPanelProps) {
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or streaming updates
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, loading, streamingNpcResponse]);

  // Format timestamp
  const formatTime = (timestamp?: number): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  // Copy message content
  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      antMessage.success(t('common.copied'));
    } catch {
      antMessage.error(t('common.copyFailed'));
    }
  };

  // Export chat history as markdown
  const handleExportChat = () => {
    if (chatHistory.length === 0) return;

    const lines: string[] = [
      '# Dialogue Simulation Chat Export',
      `> Exported at: ${new Date().toLocaleString()}`,
      '',
      '---',
      '',
    ];

    chatHistory.forEach((msg) => {
      const time = msg.timestamp ? ` (${formatTime(msg.timestamp)})` : '';
      const roleLabel = msg.role === 'player' ? '👤 Player' : msg.role === 'npc' ? '🤖 NPC' : '📋 System';
      lines.push(`### ${roleLabel}${time}`);
      lines.push('');
      lines.push(msg.content);
      lines.push('');

      if (msg.result && msg.result.matched_clues.length > 0) {
        lines.push('**Matched Clues:**');
        msg.result.matched_clues.forEach((mc) => {
          lines.push(`- ${mc.name || mc.clue_id}: ${(mc.score * 100).toFixed(0)}%`);
        });
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    });

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card
      title={t('debug.simulationChat')}
      size="small"
      extra={
        <Space size={4}>
          {/* Stop button when streaming */}
          {loading && (
            <Tooltip title={t('debug.stopGeneration')}>
              <Button
                icon={<StopOutlined />}
                onClick={onAbort}
                size="small"
                danger
              />
            </Tooltip>
          )}
          <Tooltip title={t('debug.exportChat')}>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportChat}
              size="small"
              disabled={chatHistory.length === 0}
            />
          </Tooltip>
          <Button icon={<ClearOutlined />} onClick={onClear} size="small">
            {t('debug.clear')}
          </Button>
        </Space>
      }
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: 580 } }}
    >
      {/* Chat messages area - scrollable */}
      <div
        ref={chatContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          background: '#fafafa',
        }}
      >
        {chatHistory.length === 0 ? (
          <Empty
            description={
              <Space orientation="vertical" size={4}>
                <span>{t('debug.startMessage')}</span>
                {!canSend && (
                  <span style={{ color: '#faad14', fontSize: 12 }}>
                    <InfoCircleOutlined style={{ marginRight: 4 }} />
                    {t('debug.selectScriptAndNpcFirst')}
                  </span>
                )}
              </Space>
            }
          />
        ) : (
          <>
            {chatHistory.map((msg, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 16,
                  textAlign: msg.role === 'player' ? 'right' : 'left',
                }}
              >
                <Space size={4} style={{ marginBottom: 2 }}>
                  <Tag color={msg.role === 'player' ? 'blue' : msg.role === 'npc' ? 'purple' : 'green'}>
                    {msg.role === 'player' ? t('debug.player') : msg.role === 'npc' ? t('common.npc') : t('debug.system')}
                  </Tag>
                  {/* NPC clue trigger indicator */}
                  {msg.role === 'npc' && (
                    <Tag
                      icon={msg.hasTriggeredClues ? <BulbFilled /> : <BulbOutlined />}
                      color={msg.hasTriggeredClues ? 'success' : 'default'}
                    >
                      {msg.hasTriggeredClues
                        ? t('debug.clueTriggeredReply', { count: msg.triggeredClueCount })
                        : t('debug.noClueReply')
                      }
                    </Tag>
                  )}
                  {/* Timestamp */}
                  {msg.timestamp && (
                    <span style={{ fontSize: 11, color: '#999' }}>
                      {formatTime(msg.timestamp)}
                    </span>
                  )}
                </Space>
                <div
                  style={{
                    display: 'inline-block',
                    maxWidth: '80%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: msg.role === 'player'
                      ? '#e6f7ff'
                      : msg.role === 'npc'
                        ? (msg.hasTriggeredClues ? '#f6ffed' : '#fff7e6')
                        : '#f6ffed',
                    marginTop: 4,
                    textAlign: 'left',
                    border: msg.role === 'npc'
                      ? (msg.hasTriggeredClues ? '1px solid #b7eb8f' : '1px solid #ffd591')
                      : 'none',
                    position: 'relative',
                  }}
                >
                  {/* Copy button for NPC messages */}
                  {msg.role === 'npc' && (
                    <Tooltip title={t('common.copy')}>
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => handleCopy(msg.content)}
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          opacity: 0.6,
                          padding: '0 4px',
                          height: 'auto',
                        }}
                      />
                    </Tooltip>
                  )}
                  <div style={{ paddingRight: msg.role === 'npc' ? 24 : 0 }}>
                    {msg.content}
                  </div>
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
                                    {mc.name || mc.clue_id}
                                  </Descriptions.Item>
                                  <Descriptions.Item label={t('debug.score')}>
                                    {(mc.score * 100).toFixed(0)}%
                                  </Descriptions.Item>
                                  <Descriptions.Item label={t('debug.matchType')}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                      {mc.match_reasons.map((reason, k) => (
                                        <Tag key={k} style={{ marginRight: 0, marginBottom: 0, whiteSpace: 'normal', wordBreak: 'break-word' }}>{reason}</Tag>
                                      ))}
                                    </div>
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
            ))}
            {/* Show streaming NPC response */}
            {loading && streamingNpcResponse && (
              <div style={{ marginBottom: 16, textAlign: 'left' }}>
                <Space size={4} style={{ marginBottom: 2 }}>
                  <Tag color="purple">{t('common.npc')}</Tag>
                  <Tag icon={<LoadingOutlined spin />} color="processing">
                    {t('debug.generating')}
                  </Tag>
                </Space>
                <div
                  style={{
                    display: 'inline-block',
                    maxWidth: '80%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: '#fff7e6',
                    marginTop: 4,
                    border: '1px solid #ffd591',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {streamingNpcResponse}
                  <span
                    style={{
                      display: 'inline-block',
                      width: 2,
                      height: '1em',
                      background: '#1890ff',
                      marginLeft: 2,
                      animation: 'blink 1s infinite',
                      verticalAlign: 'text-bottom',
                    }}
                  />
                </div>
                <style>{`
                  @keyframes blink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0; }
                  }
                `}</style>
              </div>
            )}

            {/* Loading skeleton when waiting for first response */}
            {loading && !streamingNpcResponse && (
              <div style={{ marginBottom: 16, textAlign: 'left' }}>
                <Tag color="purple">{t('common.npc')}</Tag>
                <div
                  style={{
                    display: 'inline-block',
                    maxWidth: '80%',
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: '#fff7e6',
                    marginTop: 4,
                    border: '1px solid #ffd591',
                  }}
                >
                  <Skeleton.Input active size="small" style={{ width: 200 }} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Send area - fixed at bottom */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #f0f0f0',
          background: '#fff',
        }}
      >
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            placeholder={t('debug.enterPlayerMessage')}
            value={playerMessage}
            onChange={(e) => onMessageChange(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            style={{ resize: 'none' }}
            rows={2}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={onSend}
            loading={loading}
            disabled={!canSend || !playerMessage.trim()}
            style={{ height: 'auto' }}
          >
            {t('debug.send')}
          </Button>
        </Space.Compact>
        {/* Keyboard shortcut hint */}
        <div style={{ marginTop: 4, fontSize: 11, color: '#999', textAlign: 'right' }}>
          <kbd style={{
            background: '#f5f5f5',
            padding: '1px 4px',
            borderRadius: 3,
            border: '1px solid #d9d9d9',
            fontFamily: 'monospace'
          }}>Enter</kbd>
          {' '}{t('debug.toSend')}{' · '}
          <kbd style={{
            background: '#f5f5f5',
            padding: '1px 4px',
            borderRadius: 3,
            border: '1px solid #d9d9d9',
            fontFamily: 'monospace'
          }}>Shift+Enter</kbd>
          {' '}{t('debug.newLine')}
        </div>
      </div>
    </Card>
  );
});

export default ChatPanel;
