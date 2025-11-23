import { useEffect, useState } from 'react';
import {
  Table,
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
import type { TableProps } from 'antd';
import { SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/common';
import { logApi, scriptApi, sceneApi, npcApi } from '@/api';
import { formatDate } from '@/utils';
import type { DialogueLog, Script, Scene, NPC, MatchedClue } from '@/types';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text, Paragraph } = Typography;

export default function DialogueLogs() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<DialogueLog[]>([]);
  const [total, setTotal] = useState(0);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [selectedLog, setSelectedLog] = useState<DialogueLog | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [filters, setFilters] = useState<{
    script_id?: string;
    scene_id?: string;
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
    scriptApi.list({}).then((data) => setScripts(data.items));
  }, []);

  useEffect(() => {
    if (filters.script_id) {
      Promise.all([
        sceneApi.list({ script_id: filters.script_id }),
        npcApi.list({ script_id: filters.script_id, page_size: 100 }),
      ]).then(([scenesData, npcsData]) => {
        setScenes(scenesData.items);
        setNpcs(npcsData.items);
      });
    }
  }, [filters.script_id]);

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

  const columns: TableProps<DialogueLog>['columns'] = [
    {
      title: 'Session',
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
      title: 'Player Message',
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
      title: 'Matched Clues',
      dataIndex: 'matched_clues',
      key: 'matched_clues',
      width: 120,
      render: (clues: MatchedClue[]) => (
        <Tag color={clues.length > 0 ? 'success' : 'default'}>{clues.length} clues</Tag>
      ),
    },
    {
      title: 'Time',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date) => formatDate(date),
    },
    {
      title: 'Actions',
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
        title="Dialogue Logs"
        subtitle="View player-NPC dialogue history and clue matches"
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Session ID"
            prefix={<SearchOutlined />}
            value={filters.session_id}
            onChange={(e) => setFilters({ ...filters, session_id: e.target.value, page: 1 })}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder="Script"
            value={filters.script_id}
            onChange={(v) =>
              setFilters({ ...filters, script_id: v, scene_id: undefined, npc_id: undefined, page: 1 })
            }
            style={{ width: 160 }}
            allowClear
          >
            {scripts.map((s) => (
              <Option key={s.id} value={s.id}>
                {s.name}
              </Option>
            ))}
          </Select>
          <Select
            placeholder="Scene"
            value={filters.scene_id}
            onChange={(v) => setFilters({ ...filters, scene_id: v, page: 1 })}
            style={{ width: 160 }}
            allowClear
            disabled={!filters.script_id}
          >
            {scenes.map((s) => (
              <Option key={s.id} value={s.id}>
                {s.name}
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

      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={{
          current: filters.page,
          pageSize: filters.page_size,
          total,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} logs`,
          onChange: (page, pageSize) => setFilters({ ...filters, page, page_size: pageSize }),
        }}
      />

      <Modal
        title="Dialogue Log Details"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedLog && (
          <div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Session ID" span={2}>
                <Text code copyable>
                  {selectedLog.session_id}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Time">{formatDate(selectedLog.created_at)}</Descriptions.Item>
              <Descriptions.Item label="Strategy">{selectedLog.strategy_id}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="Player Message" style={{ marginTop: 16 }}>
              <Paragraph>{selectedLog.player_message}</Paragraph>
            </Card>

            <Card size="small" title="NPC Response" style={{ marginTop: 16 }}>
              <Paragraph>{selectedLog.npc_response}</Paragraph>
            </Card>

            <Card
              size="small"
              title={`Matched Clues (${selectedLog.matched_clues.length})`}
              style={{ marginTop: 16 }}
            >
              {selectedLog.matched_clues.length === 0 ? (
                <Text type="secondary">No clues matched</Text>
              ) : (
                <Collapse
                  items={selectedLog.matched_clues.map((mc, i) => ({
                    key: i,
                    label: (
                      <Space>
                        <span>{mc.clue_id}</span>
                        <Tag color={mc.match_type === 'keyword' ? 'blue' : 'green'}>
                          {mc.match_type}
                        </Tag>
                        <Tag>Score: {(mc.score * 100).toFixed(0)}%</Tag>
                      </Space>
                    ),
                    children: (
                      <Descriptions size="small" column={2}>
                        {mc.keyword_matches && mc.keyword_matches.length > 0 && (
                          <Descriptions.Item label="Keywords" span={2}>
                            {mc.keyword_matches.map((kw, j) => (
                              <Tag key={j}>{kw}</Tag>
                            ))}
                          </Descriptions.Item>
                        )}
                        {mc.embedding_similarity && (
                          <Descriptions.Item label="Embedding Similarity">
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
