import { Space, Collapse, Tag, Divider, Typography, Statistic, Row, Col, Progress, Tooltip } from 'antd';
import {
  SearchOutlined,
  RobotOutlined,
  SettingOutlined,
  CodeOutlined,
  MessageOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
  FieldTimeOutlined,
  StopOutlined,
  LockOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { DialogueLog, LLMUsageInfo, LLMTokenUsage, CandidateClueDetail, ExcludedClueDetail } from '@/types';
import { formatDate } from '@/utils';
import { SegmentedPromptRenderer } from '../SegmentedPromptRenderer';
import { PromptLegend } from '../PromptLegend';

const { Text, Paragraph } = Typography;

// Helper to format latency
const formatLatency = (ms: number | null | undefined): string => {
  if (ms == null) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

// Helper to format token count
const formatTokens = (tokens: LLMTokenUsage | null | undefined): string => {
  if (!tokens) return '-';
  return tokens.total_tokens?.toLocaleString() ?? '-';
};

// LLM Usage Stats Panel Component
const LLMUsagePanel: React.FC<{ usage: LLMUsageInfo | null | undefined; t: (key: string) => string }> = ({ usage, t }) => {
  if (!usage) return null;

  const hasMatchingData = usage.matching_tokens || usage.matching_latency_ms;
  const hasNpcData = usage.npc_tokens || usage.npc_latency_ms;

  if (!hasMatchingData && !hasNpcData) return null;

  return (
    <div style={{ marginBottom: 16, padding: 12, background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e9f2 100%)', borderRadius: 8, border: '1px solid #d9d9d9' }}>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <ThunderboltOutlined style={{ color: '#722ed1' }} />
        <Text strong style={{ color: '#722ed1' }}>{t('logs.llmUsage')}</Text>
      </div>
      <Row gutter={[16, 8]}>
        {hasMatchingData && (
          <Col xs={24} sm={12}>
            <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e8e8e8' }}>
              <div style={{ marginBottom: 8 }}>
                <Tag color="purple">{t('logs.matching')}</Tag>
                {usage.matching_model && <Text type="secondary" style={{ fontSize: 11 }}>({usage.matching_model})</Text>}
              </div>
              <Space size="large">
                <Statistic
                  title={<span style={{ fontSize: 11 }}><FieldTimeOutlined /> {t('logs.latency')}</span>}
                  value={formatLatency(usage.matching_latency_ms)}
                  styles={{ content: { fontSize: 16 } }}
                />
                <Statistic
                  title={<span style={{ fontSize: 11 }}>{t('logs.tokens')}</span>}
                  value={formatTokens(usage.matching_tokens)}
                  styles={{ content: { fontSize: 16 } }}
                />
              </Space>
              {usage.matching_tokens && (usage.matching_tokens.prompt_tokens || usage.matching_tokens.completion_tokens) && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#666' }}>
                  {t('logs.promptTokens')}: {usage.matching_tokens.prompt_tokens?.toLocaleString() ?? '-'} | {t('logs.completionTokens')}: {usage.matching_tokens.completion_tokens?.toLocaleString() ?? '-'}
                </div>
              )}
            </div>
          </Col>
        )}
        {hasNpcData && (
          <Col xs={24} sm={12}>
            <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e8e8e8' }}>
              <div style={{ marginBottom: 8 }}>
                <Tag color="green">{t('logs.generation')}</Tag>
                {usage.npc_model && <Text type="secondary" style={{ fontSize: 11 }}>({usage.npc_model})</Text>}
              </div>
              <Space size="large">
                <Statistic
                  title={<span style={{ fontSize: 11 }}><FieldTimeOutlined /> {t('logs.latency')}</span>}
                  value={formatLatency(usage.npc_latency_ms)}
                  styles={{ content: { fontSize: 16 } }}
                />
                <Statistic
                  title={<span style={{ fontSize: 11 }}>{t('logs.tokens')}</span>}
                  value={formatTokens(usage.npc_tokens)}
                  styles={{ content: { fontSize: 16 } }}
                />
              </Space>
              {usage.npc_tokens && (usage.npc_tokens.prompt_tokens || usage.npc_tokens.completion_tokens) && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#666' }}>
                  {t('logs.promptTokens')}: {usage.npc_tokens.prompt_tokens?.toLocaleString() ?? '-'} | {t('logs.completionTokens')}: {usage.npc_tokens.completion_tokens?.toLocaleString() ?? '-'}
                </div>
              )}
            </div>
          </Col>
        )}
      </Row>
    </div>
  );
};

// Helper to get score color based on value and threshold
const getScoreColor = (score: number, threshold: number, triggered: boolean): string => {
  if (triggered) return '#52c41a'; // Green for triggered
  if (score >= threshold) return '#faad14'; // Yellow for matched but not triggered
  return '#ff4d4f'; // Red for below threshold
};

// Helper to get score status
const getScoreStatus = (score: number, threshold: number, triggered: boolean): 'success' | 'exception' | 'normal' => {
  if (triggered) return 'success';
  if (score >= threshold) return 'normal';
  return 'exception';
};

// Candidate Clue Score Display Component
const CandidateScoreDisplay: React.FC<{
  candidates: CandidateClueDetail[];
  excluded: ExcludedClueDetail[] | undefined;
  threshold: number;
  t: (key: string) => string;
}> = ({ candidates, excluded, threshold, t }) => {
  // Sort candidates: triggered first, then by score descending
  const sortedCandidates = [...candidates].sort((a, b) => {
    if (a.triggered && !b.triggered) return -1;
    if (!a.triggered && b.triggered) return 1;
    return (b.score ?? 0) - (a.score ?? 0);
  });

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Score Overview Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text strong style={{ fontSize: 13 }}>
          {t('logs.candidateClues')} ({candidates.length})
        </Text>
        <Space size="small">
          <Tag>{t('logs.threshold')}: {(threshold * 100).toFixed(0)}%</Tag>
        </Space>
      </div>

      {/* Score Legend */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 16, fontSize: 11 }}>
        <span><CheckCircleOutlined style={{ color: '#52c41a' }} /> {t('logs.triggered')}</span>
        <span><ExclamationCircleOutlined style={{ color: '#faad14' }} /> {t('logs.matchedCount')}</span>
        <span><CloseCircleOutlined style={{ color: '#ff4d4f' }} /> {t('logs.noCluesMatched')}</span>
      </div>

      {/* Candidate Scores */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sortedCandidates.map((c, i) => {
          const score = c.score ?? 0;
          const triggered = c.triggered ?? false;
          const color = getScoreColor(score, threshold, triggered);
          const status = getScoreStatus(score, threshold, triggered);

          return (
            <div
              key={i}
              style={{
                padding: '8px 12px',
                background: triggered ? '#f6ffed' : score >= threshold ? '#fffbe6' : '#fff',
                borderRadius: 6,
                border: `1px solid ${triggered ? '#b7eb8f' : score >= threshold ? '#ffe58f' : '#d9d9d9'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {triggered ? (
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                ) : score >= threshold ? (
                  <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                ) : (
                  <CloseCircleOutlined style={{ color: '#999' }} />
                )}
                <Text strong style={{ fontSize: 13, flex: 1 }}>{c.name}</Text>
                <Tag color={triggered ? 'green' : score >= threshold ? 'gold' : 'default'}>
                  {(score * 100).toFixed(0)}%
                </Tag>
                {triggered && <Tag color="green">{t('logs.triggered')}</Tag>}
              </div>
              <div style={{ paddingLeft: 24 }}>
                <Progress
                  percent={Math.round(score * 100)}
                  size="small"
                  status={status}
                  strokeColor={color}
                  railColor="#f0f0f0"
                  showInfo={false}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Excluded Clues */}
      {excluded && excluded.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Text strong style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
            <LockOutlined style={{ color: '#999' }} />
            {t('logs.excludedClues')} ({excluded.length})
          </Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {excluded.map((e, i) => (
              <div
                key={i}
                style={{
                  padding: '6px 12px',
                  background: '#fafafa',
                  borderRadius: 4,
                  border: '1px dashed #d9d9d9',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StopOutlined style={{ color: '#999' }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>{e.name}</Text>
                  <Tooltip title={e.missing_prereq_ids?.join(', ')}>
                    <Tag color="orange" style={{ fontSize: 10 }}>
                      {t('logs.missingPrereqs')}
                    </Tag>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface ConversationTabProps {
  log: DialogueLog;
  getNpcName: (npcId: string) => string;
  t: (key: string) => string;
}

export const ConversationTab: React.FC<ConversationTabProps> = ({ log, getNpcName, t }) => {
  const promptInfo = log.debug_info?.prompt_info;
  const debugInfo = log.debug_info;

  return (
    <div>
      {/* Session Metadata */}
      <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 8 }}>
        <Space separator={<Divider orientation="vertical" />}>
          <span>
            {t('logs.sessionId')}:{' '}
            <Text code copyable={{ text: log.session_id }}>
              {log.session_id.slice(0, 8)}...
            </Text>
          </span>
          <span>{formatDate(log.created_at)}</span>
          <span>NPC: {getNpcName(log.npc_id)}</span>
        </Space>
      </div>

      {/* LLM Usage Statistics */}
      <LLMUsagePanel usage={log.debug_info?.llm_usage as LLMUsageInfo | undefined} t={t} />

      {/* Chat Messages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Retrieval Process */}
        {debugInfo && (debugInfo.candidates?.length > 0 || log.matched_clues?.length > 0) && (
          <Collapse
            size="small"
            defaultActiveKey={['retrieval']}
            items={[{
              key: 'retrieval',
              label: (
                <Space>
                  <SearchOutlined style={{ color: '#722ed1' }} />
                  <span style={{ color: '#722ed1' }}>{t('logs.retrievalProcess')}</span>
                  <Tag color="purple">{debugInfo.strategy || 'keyword'}</Tag>
                  {debugInfo.threshold != null && <Tag>{t('logs.threshold')}: {debugInfo.threshold}</Tag>}
                </Space>
              ),
              children: (
                <div>
                  {/* LLM Strategy Prompts - Show once at top level */}
                  {debugInfo.strategy === 'llm' && debugInfo.candidates && debugInfo.candidates.length > 0 && (() => {
                    const firstCandidate = debugInfo.candidates[0];
                    const hasLlmPrompt = firstCandidate.llm_system_prompt || firstCandidate.llm_user_message || firstCandidate.llm_system_prompt_segments || firstCandidate.llm_user_message_segments;
                    if (!hasLlmPrompt) return null;
                    return (
                      <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 8, border: '1px solid #e8e8e8' }}>
                        {(firstCandidate.llm_system_prompt_segments || firstCandidate.llm_system_prompt) && (
                          <div style={{ marginBottom: 12 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>{t('logs.systemPromptLabel')}:</Text>
                            <div style={{ background: '#fff', padding: 8, borderRadius: 4, margin: '4px 0 0 0', maxHeight: 300, overflow: 'auto', border: '1px solid #e8e8e8' }}>
                              {firstCandidate.llm_system_prompt_segments ? (
                                <SegmentedPromptRenderer segments={firstCandidate.llm_system_prompt_segments} />
                              ) : (
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>{firstCandidate.llm_system_prompt}</pre>
                              )}
                            </div>
                          </div>
                        )}
                        {(firstCandidate.llm_user_message_segments || firstCandidate.llm_user_message) && (
                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>{t('logs.userPromptLabel')}:</Text>
                            <div style={{ background: '#fff', padding: 8, borderRadius: 4, margin: '4px 0 0 0', maxHeight: 300, overflow: 'auto', border: '1px solid #e8e8e8' }}>
                              {firstCandidate.llm_user_message_segments ? (
                                <SegmentedPromptRenderer segments={firstCandidate.llm_user_message_segments} />
                              ) : (
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>{firstCandidate.llm_user_message}</pre>
                              )}
                            </div>
                          </div>
                        )}
                        {(firstCandidate.llm_system_prompt_segments || firstCandidate.llm_user_message_segments) && <PromptLegend />}
                      </div>
                    );
                  })()}

                  {/* Candidates Score Display - New visual format */}
                  {debugInfo.candidates && debugInfo.candidates.length > 0 && (
                    <CandidateScoreDisplay
                      candidates={debugInfo.candidates}
                      excluded={debugInfo.excluded}
                      threshold={debugInfo.threshold ?? 0.5}
                      t={t}
                    />
                  )}

                  {/* Match Reasons Detail - Collapsed for additional info */}
                  {log.matched_clues && log.matched_clues.length > 0 && log.matched_clues.some(mc => mc.match_reasons?.length > 0) && (
                    <Collapse
                      size="small"
                      items={[{
                        key: 'match_reasons',
                        label: <Text type="secondary" style={{ fontSize: 12 }}>{t('logs.matchDetails')}</Text>,
                        children: (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {log.matched_clues.filter(mc => mc.match_reasons?.length > 0).map((mc, i) => (
                              <div key={i} style={{ fontSize: 12 }}>
                                <Text strong>{mc.name}: </Text>
                                <Space size={4} wrap>
                                  {mc.match_reasons.map((r, j) => (
                                    <Tag key={j} color={r.includes('keyword') ? 'blue' : r.includes('LLM') ? 'purple' : 'cyan'} style={{ fontSize: 11 }}>{r}</Tag>
                                  ))}
                                </Space>
                              </div>
                            ))}
                          </div>
                        ),
                      }]}
                    />
                  )}
                </div>
              ),
            }]}
          />
        )}

        {/* NPC Reply Section - Complete prompt info + response */}
        {(promptInfo || log.npc_response) && (
          <Collapse
            size="small"
            defaultActiveKey={['npc_section']}
            items={[{
              key: 'npc_section',
              label: (
                <Space>
                  <RobotOutlined style={{ color: '#722ed1' }} />
                  <span style={{ color: '#722ed1' }}>{t('logs.npcReplySection')}</span>
                  {promptInfo && (
                    <Tag color={promptInfo.has_clue ? 'green' : 'orange'}>
                      {promptInfo.has_clue ? t('logs.hasClueTemplate') : t('logs.noClueTemplate')}
                    </Tag>
                  )}
                </Space>
              ),
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* System Prompt with segments */}
                  {promptInfo?.system_prompt && (
                    <div style={{ background: '#fafafa', padding: 12, borderRadius: 8, border: '1px solid #e8e8e8' }}>
                      <div style={{ marginBottom: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          <SettingOutlined style={{ marginRight: 4 }} />
                          {t('logs.systemPromptLabel')}
                        </Text>
                      </div>
                      <div style={{ maxHeight: 400, overflow: 'auto' }}>
                        {promptInfo.system_prompt_segments ? (
                          <>
                            <SegmentedPromptRenderer segments={promptInfo.system_prompt_segments} />
                            <PromptLegend />
                          </>
                        ) : (
                          <Paragraph copyable style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 13 }}>
                            {promptInfo.system_prompt}
                          </Paragraph>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Chat History (if multi-turn) */}
                  {promptInfo?.messages && promptInfo.messages.length > 2 && (
                    <Collapse
                      size="small"
                      items={[{
                        key: 'history',
                        label: (
                          <span style={{ color: '#52c41a' }}>
                            <MessageOutlined style={{ marginRight: 6 }} />
                            {t('logs.chatHistory')} ({Math.floor((promptInfo.messages.length - 2) / 2)} {t('logs.rounds')})
                          </span>
                        ),
                        children: (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {promptInfo.messages.slice(1, -1).map((msg, i) => (
                              msg.role === 'user' ? (
                                <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                  <div style={{ maxWidth: '85%', padding: 10, background: '#1890ff', color: '#fff', borderRadius: '10px 10px 4px 10px', fontSize: 13 }}>
                                    <Paragraph copyable={{ text: msg.content }} style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#fff' }}>{msg.content}</Paragraph>
                                  </div>
                                </div>
                              ) : (
                                <div key={i} style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                  <div style={{ maxWidth: '85%', padding: 10, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '10px 10px 10px 4px', fontSize: 13 }}>
                                    <Paragraph copyable style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</Paragraph>
                                  </div>
                                </div>
                              )
                            ))}
                          </div>
                        ),
                      }]}
                    />
                  )}

                  {/* User Prompt with segments */}
                  {promptInfo?.user_prompt && (
                    <div style={{ background: '#e6f7ff', padding: 12, borderRadius: 8, border: '1px solid #91d5ff' }}>
                      <div style={{ marginBottom: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          <CodeOutlined style={{ marginRight: 4 }} />
                          {t('logs.userPromptLabel')}
                        </Text>
                      </div>
                      <div style={{ maxHeight: 300, overflow: 'auto' }}>
                        {promptInfo.user_prompt_segments ? (
                          <>
                            <SegmentedPromptRenderer segments={promptInfo.user_prompt_segments} />
                            <PromptLegend />
                          </>
                        ) : (
                          <Paragraph copyable style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 13 }}>
                            {promptInfo.user_prompt}
                          </Paragraph>
                        )}
                      </div>
                    </div>
                  )}

                  {/* NPC Response */}
                  {log.npc_response && (
                    <div style={{ background: '#f6ffed', padding: 12, borderRadius: 8, border: '1px solid #b7eb8f' }}>
                      <div style={{ marginBottom: 8 }}>
                        <Text style={{ fontSize: 12, color: '#52c41a' }}>
                          <RobotOutlined style={{ marginRight: 4 }} />
                          {t('logs.npcResponse')}
                        </Text>
                      </div>
                      <Paragraph copyable style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13 }}>{log.npc_response}</Paragraph>
                    </div>
                  )}
                </div>
              ),
            }]}
          />
        )}
      </div>
    </div>
  );
};
