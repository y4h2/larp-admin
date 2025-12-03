import { Space, Collapse, Tag, Divider, Typography } from 'antd';
import {
  SearchOutlined,
  UserOutlined,
  RobotOutlined,
  SettingOutlined,
  CodeOutlined,
  MessageOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { DialogueLog } from '@/types';
import { formatDate } from '@/utils';
import { SegmentedPromptRenderer } from '../SegmentedPromptRenderer';
import { PromptLegend } from '../PromptLegend';

const { Text, Paragraph } = Typography;

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

      {/* Chat Messages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* System Prompt */}
        {promptInfo?.system_prompt && (
          <Collapse
            size="small"
            items={[{
              key: 'system',
              label: (
                <span style={{ color: '#666' }}>
                  <SettingOutlined style={{ marginRight: 6 }} />
                  {t('logs.systemPromptLabel')}
                </span>
              ),
              children: (
                <Paragraph copyable style={{ whiteSpace: 'pre-wrap', margin: 0, maxHeight: 300, overflow: 'auto', fontSize: 13 }}>
                  {promptInfo.system_prompt}
                </Paragraph>
              ),
            }]}
          />
        )}

        {/* User Prompt */}
        {promptInfo?.user_prompt && (
          <Collapse
            size="small"
            items={[{
              key: 'user_prompt',
              label: (
                <span style={{ color: '#1890ff' }}>
                  <CodeOutlined style={{ marginRight: 6 }} />
                  {t('logs.userPromptLabel')}
                </span>
              ),
              children: (
                <Paragraph
                  copyable
                  style={{ whiteSpace: 'pre-wrap', margin: 0, maxHeight: 300, overflow: 'auto', fontSize: 13, background: '#e6f7ff', padding: 12, borderRadius: 4 }}
                >
                  {promptInfo.user_prompt}
                </Paragraph>
              ),
            }]}
          />
        )}

        {/* Player Message */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ maxWidth: '85%', padding: 12, background: '#1890ff', color: '#fff', borderRadius: '12px 12px 4px 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: 12, marginBottom: 4, opacity: 0.8 }}>
              <UserOutlined style={{ marginRight: 4 }} />
              {t('logs.playerMessage')}
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{log.player_message}</div>
          </div>
        </div>

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

                  {/* Candidates */}
                  {debugInfo.candidates && debugInfo.candidates.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <Text strong style={{ fontSize: 13 }}>{t('logs.candidateClues')} ({debugInfo.candidates.length})</Text>
                      <Collapse
                        size="small"
                        style={{ marginTop: 8 }}
                        items={debugInfo.candidates.map((c, i) => ({
                          key: i,
                          label: <Text strong style={{ fontSize: 13 }}>{c.name}</Text>,
                          children: (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {/* Clue ID */}
                              <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>ID: </Text>
                                <Text code copyable style={{ fontSize: 11 }}>{c.clue_id}</Text>
                              </div>

                              {/* Trigger Keywords */}
                              <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>{t('common.keywords')}: </Text>
                                {c.trigger_keywords && c.trigger_keywords.length > 0 ? (
                                  c.trigger_keywords.map((kw, j) => <Tag key={j} style={{ fontSize: 11 }}>{kw}</Tag>)
                                ) : (
                                  <Text type="secondary" italic style={{ fontSize: 12 }}>({t('common.notSet')})</Text>
                                )}
                              </div>

                              {/* Trigger Semantic Summary */}
                              <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>{t('clues.triggerSemanticSummary')}: </Text>
                                {c.trigger_semantic_summary ? (
                                  <div style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, marginTop: 4 }}>
                                    <Text style={{ fontSize: 12 }}>{c.trigger_semantic_summary}</Text>
                                  </div>
                                ) : (
                                  <Text type="secondary" italic style={{ fontSize: 12 }}>({t('common.notSet')})</Text>
                                )}
                              </div>

                              {/* Embedding Rendered Content (only for embedding strategy) */}
                              {debugInfo.strategy === 'embedding' && (
                                <div>
                                  <Text type="secondary" style={{ fontSize: 12 }}>{t('logs.renderedContent')}: </Text>
                                  {c.embedding_rendered_segments ? (
                                    <>
                                      <div style={{ background: '#fafafa', padding: 8, borderRadius: 4, marginTop: 4, border: '1px solid #e8e8e8' }}>
                                        <SegmentedPromptRenderer segments={c.embedding_rendered_segments} />
                                      </div>
                                      <PromptLegend />
                                    </>
                                  ) : c.embedding_rendered_content ? (
                                    <div style={{ background: '#e6f7ff', padding: 8, borderRadius: 4, marginTop: 4, border: '1px solid #91d5ff' }}>
                                      <Text style={{ fontSize: 12 }}>{c.embedding_rendered_content}</Text>
                                    </div>
                                  ) : (
                                    <Text type="secondary" italic style={{ fontSize: 12 }}>({t('common.notSet')})</Text>
                                  )}
                                </div>
                              )}
                            </div>
                          ),
                        }))}
                      />
                    </div>
                  )}

                  {/* Match Results */}
                  {log.matched_clues && log.matched_clues.length > 0 && (
                    <div>
                      <Text strong style={{ fontSize: 13 }}>
                        {t('logs.matchDetails')} ({log.matched_clues.filter(mc => mc.is_triggered).length}/{log.matched_clues.length} {t('logs.triggeredClues').toLowerCase()})
                      </Text>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                        {log.matched_clues.map((mc, i) => (
                          <div
                            key={i}
                            style={{
                              padding: 8,
                              background: mc.is_triggered ? '#f6ffed' : '#fff',
                              borderRadius: 6,
                              border: mc.is_triggered ? '1px solid #52c41a' : '1px solid #d9d9d9',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              {mc.is_triggered ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#999' }} />}
                              <Text strong style={{ fontSize: 13 }}>{mc.name || mc.clue_id}</Text>
                              <Tag color={mc.is_triggered ? 'green' : 'default'}>{(mc.score * 100).toFixed(0)}%</Tag>
                              {mc.embedding_similarity != null && <Tag color="purple">{t('debug.similarity')}: {(mc.embedding_similarity * 100).toFixed(0)}%</Tag>}
                              {mc.clue_type && <Tag>{mc.clue_type}</Tag>}
                            </div>
                            {mc.match_reasons && mc.match_reasons.length > 0 && (
                              <div style={{ marginTop: 6 }}>
                                <Space size={4} wrap>
                                  {mc.match_reasons.map((r, j) => (
                                    <Tag key={j} color={r.includes('keyword') ? 'blue' : r.includes('LLM') ? 'purple' : 'cyan'} style={{ fontSize: 11 }}>{r}</Tag>
                                  ))}
                                </Space>
                              </div>
                            )}
                            {mc.keyword_matches && mc.keyword_matches.length > 0 && (
                              <div style={{ marginTop: 4 }}>
                                <Text type="secondary" style={{ fontSize: 11 }}>{t('debug.keywords')}: </Text>
                                {mc.keyword_matches.map((kw, j) => <Tag key={j} color="blue" style={{ fontSize: 11 }}>{kw}</Tag>)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
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
