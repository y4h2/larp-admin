import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Input,
  Select,
  Space,
  Button,
  DatePicker,
  Tag,
  Modal,
  Descriptions,
  Typography,
  Collapse,
} from 'antd';
import { SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { PageHeader, ResizableTable, type ResizableColumn } from '@/components/common';
import { logApi } from '@/api';
import { useScripts, useNpcs } from '@/hooks';
import { formatDate } from '@/utils';
import type { DialogueLog, MatchedClue } from '@/types';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text, Paragraph } = Typography;

export default function DialogueLogs() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<DialogueLog[]>([]);
  const [total, setTotal] = useState(0);
  const { scripts, fetchScripts } = useScripts();
  const { npcs, fetchNpcs } = useNpcs();
  const [selectedLog, setSelectedLog] = useState<DialogueLog | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [filters, setFilters] = useState<{
    script_id?: string;
    npc_id?: string;
    session_id?: string;
    start_date?: string;
    end_date?: string;
    page: number;
    page_size: number;
  }>({
    page: 1,
    page_size: 20,
  });

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  useEffect(() => {
    if (filters.script_id) {
      fetchNpcs({ script_id: filters.script_id });
    }
  }, [filters.script_id, fetchNpcs]);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const data = await logApi.list(filters);
        setLogs(data.items);
        setTotal(data.total);
      } catch {
        // Error handled
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [filters]);

  const columns: ResizableColumn<DialogueLog>[] = [
    {
      title: t('logs.session'),
      dataIndex: 'session_id',
      key: 'session_id',
      width: 120,
      render: (id) => (
        <Text code copyable style={{ fontSize: 12 }}>
          {id.slice(0, 8)}...
        </Text>
      ),
    },
    {
      title: t('logs.playerMessage'),
      dataIndex: 'player_message',
      key: 'player_message',
      ellipsis: true,
      render: (msg) => <Text>{msg}</Text>,
    },
    {
      title: 'NPC',
      dataIndex: 'npc_id',
      key: 'npc_id',
      width: 100,
      render: (id) => {
        const npc = npcs.find((n) => n.id === id);
        return npc?.name || id;
      },
    },
    {
      title: t('logs.matchedClues'),
      dataIndex: 'matched_clues',
      key: 'matched_clues',
      width: 120,
      render: (clues: MatchedClue[]) => (
        <Tag color={clues.length > 0 ? 'success' : 'default'}>{clues.length} {t('logs.clues')}</Tag>
      ),
    },
    {
      title: t('logs.time'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date) => formatDate(date),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedLog(record);
            setModalVisible(true);
          }}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('logs.title')}
        subtitle={t('logs.subtitle')}
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder={t('logs.sessionId')}
            prefix={<SearchOutlined />}
            value={filters.session_id}
            onChange={(e) => setFilters({ ...filters, session_id: e.target.value, page: 1 })}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder={t('script.title')}
            value={filters.script_id}
            onChange={(v) =>
              setFilters({ ...filters, script_id: v, npc_id: undefined, page: 1 })
            }
            style={{ width: 160 }}
            allowClear
          >
            {scripts.map((s) => (
              <Option key={s.id} value={s.id}>
                {s.title}
              </Option>
            ))}
          </Select>
          <Select
            placeholder="NPC"
            value={filters.npc_id}
            onChange={(v) => setFilters({ ...filters, npc_id: v, page: 1 })}
            style={{ width: 140 }}
            allowClear
            disabled={!filters.script_id}
          >
            {npcs.map((n) => (
              <Option key={n.id} value={n.id}>
                {n.name}
              </Option>
            ))}
          </Select>
          <RangePicker
            onChange={(dates) => {
              setFilters({
                ...filters,
                start_date: dates?.[0]?.format('YYYY-MM-DD'),
                end_date: dates?.[1]?.format('YYYY-MM-DD'),
                page: 1,
              });
            }}
          />
        </Space>
      </Card>

      <ResizableTable
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={{
          current: filters.page,
          pageSize: filters.page_size,
          total,
          showSizeChanger: true,
          showTotal: (total: number) => t('logs.totalLogs', { total }),
          onChange: (page: number, pageSize: number) => setFilters({ ...filters, page, page_size: pageSize }),
        }}
      />

      <Modal
        title={t('logs.logDetails')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedLog && (
          <div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label={t('logs.sessionId')} span={2}>
                <Text code copyable>
                  {selectedLog.session_id}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('logs.time')}>{formatDate(selectedLog.created_at)}</Descriptions.Item>
              <Descriptions.Item label="NPC">{selectedLog.npc_id}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title={t('logs.playerMessage')} style={{ marginTop: 16 }}>
              <Paragraph>{selectedLog.player_message}</Paragraph>
            </Card>

            <Card size="small" title={t('logs.npcResponse')} style={{ marginTop: 16 }}>
              <Paragraph>{selectedLog.npc_response}</Paragraph>
            </Card>

            <Card
              size="small"
              title={`${t('logs.matchedClues')} (${selectedLog.matched_clues.length})`}
              style={{ marginTop: 16 }}
            >
              {selectedLog.matched_clues.length === 0 ? (
                <Text type="secondary">{t('logs.noCluesMatched')}</Text>
              ) : (
                <Collapse
                  items={selectedLog.matched_clues.map((mc, i) => ({
                    key: i,
                    label: (
                      <Space>
                        <span>{mc.clue_id}</span>
                        {mc.match_reasons.map((reason, j) => (
                          <Tag key={j} color={reason.includes('keyword') ? 'blue' : 'green'}>
                            {reason}
                          </Tag>
                        ))}
                        <Tag>{t('debug.score')}: {(mc.score * 100).toFixed(0)}%</Tag>
                      </Space>
                    ),
                    children: (
                      <Descriptions size="small" column={2}>
                        {mc.keyword_matches && mc.keyword_matches.length > 0 && (
                          <Descriptions.Item label={t('debug.keywords')} span={2}>
                            {mc.keyword_matches.map((kw, j) => (
                              <Tag key={j}>{kw}</Tag>
                            ))}
                          </Descriptions.Item>
                        )}
                        {mc.embedding_similarity && (
                          <Descriptions.Item label={t('debug.similarity')}>
                            {(mc.embedding_similarity * 100).toFixed(1)}%
                          </Descriptions.Item>
                        )}
                      </Descriptions>
                    ),
                  }))}
                />
              )}
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}
