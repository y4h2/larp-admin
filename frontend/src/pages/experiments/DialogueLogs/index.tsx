import { useTranslation } from 'react-i18next';
import {
  Card,
  Input,
  Select,
  Space,
  Button,
  DatePicker,
  Tag,
  Typography,
  Timeline,
  Switch,
} from 'antd';
import {
  SearchOutlined,
  EyeOutlined,
  MessageOutlined,
  UserOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { PageHeader, ResizableTable, type ResizableColumn } from '@/components/common';
import { formatDate } from '@/utils';
import type { DialogueLog, MatchedClue } from '@/types';
import { useDialogueLogs } from './hooks/useDialogueLogs';
import { LogDetailModal } from './components/LogDetailModal';
import type { SessionGroup } from './types';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text, Paragraph } = Typography;

export default function DialogueLogs() {
  const { t } = useTranslation();

  const {
    loading,
    logs,
    total,
    scripts,
    filteredNpcs,
    selectedLog,
    modalVisible,
    groupBySession,
    setGroupBySession,
    filters,
    setFilters,
    sessionGroups,
    getNpcName,
    getTemplate,
    getLlmConfig,
    openLogDetail,
    closeLogDetail,
  } = useDialogueLogs();

  const flatColumns: ResizableColumn<DialogueLog>[] = [
    {
      title: t('logs.session'),
      dataIndex: 'session_id',
      key: 'session_id',
      width: 120,
      render: (id) => (
        <Text code copyable style={{ fontSize: 12 }}>
          {id?.slice(0, 8)}...
        </Text>
      ),
    },
    {
      title: t('logs.username'),
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (username: string | null | undefined) => {
        if (!username) return <Text type="secondary">-</Text>;
        const displayName = username.includes('@') ? username.split('@')[0] : username;
        return <Text title={username}>{displayName}</Text>;
      },
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
      render: (id) => getNpcName(id),
    },
    {
      title: t('logs.matchedClues'),
      dataIndex: 'matched_clues',
      key: 'matched_clues',
      width: 120,
      render: (clues: MatchedClue[]) => (
        <Tag color={clues?.length > 0 ? 'success' : 'default'}>{clues?.length || 0} {t('logs.clues')}</Tag>
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
        <Button type="text" icon={<EyeOutlined />} onClick={() => openLogDetail(record)} />
      ),
    },
  ];

  const groupedColumns: ResizableColumn<SessionGroup>[] = [
    {
      title: t('logs.session'),
      dataIndex: 'session_id',
      key: 'session_id',
      width: 120,
      ellipsis: true,
      render: (id) => (
        <Text code copyable style={{ fontSize: 12 }}>
          {id?.slice(0, 8)}...
        </Text>
      ),
    },
    {
      title: t('logs.username'),
      dataIndex: 'username',
      key: 'username',
      width: 80,
      render: (username: string | null | undefined) => {
        if (!username) return <Text type="secondary">-</Text>;
        const displayName = username.includes('@') ? username.split('@')[0] : username;
        return <Text title={username}>{displayName}</Text>;
      },
    },
    {
      title: 'NPC',
      dataIndex: 'npc_name',
      key: 'npc_name',
      width: 120,
    },
    {
      title: t('logs.messageCount'),
      key: 'message_count',
      width: 100,
      render: (_, record) => <Tag icon={<MessageOutlined />}>{record.logs.length}</Tag>,
    },
    {
      title: t('logs.matchedClues'),
      dataIndex: 'total_clues',
      key: 'total_clues',
      width: 120,
      render: (count: number) => (
        <Tag color={count > 0 ? 'success' : 'default'}>{count} {t('logs.clues')}</Tag>
      ),
    },
    {
      title: t('logs.time'),
      key: 'time',
      width: 180,
      render: (_, record) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatDate(record.first_time)}
        </Text>
      ),
    },
  ];

  const renderSessionDetail = (session: SessionGroup) => (
    <div style={{ padding: '8px 16px', background: '#fafafa' }}>
      <Timeline
        items={session.logs.map((log, index) => ({
          key: log.id,
          content: (
            <div style={{ marginBottom: index < session.logs.length - 1 ? 16 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <Tag icon={<UserOutlined />} color="blue">{t('logs.player')}</Tag>
                <div style={{ flex: 1 }}>
                  <Paragraph style={{ margin: 0 }}>{log.player_message}</Paragraph>
                  <Text type="secondary" style={{ fontSize: 11 }}>{formatDate(log.created_at)}</Text>
                </div>
                <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openLogDetail(log)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginLeft: 24 }}>
                <Tag icon={<RobotOutlined />} color="green">NPC</Tag>
                <div style={{ flex: 1 }}>
                  <Paragraph style={{ margin: 0 }}>{log.npc_response}</Paragraph>
                  {log.matched_clues?.length > 0 && (
                    <Space size={4} style={{ marginTop: 4 }} wrap>
                      <Text type="secondary" style={{ fontSize: 11 }}>{t('logs.matchedClues')}:</Text>
                      {log.matched_clues.map((mc, i) => (
                        <Tag key={i} color="orange" style={{ fontSize: 11 }}>{mc.name || mc.clue_id?.slice(0, 12)}</Tag>
                      ))}
                    </Space>
                  )}
                </div>
              </div>
            </div>
          ),
        }))}
      />
    </div>
  );

  return (
    <div>
      <PageHeader title={t('logs.title')} subtitle={t('logs.subtitle')} />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
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
              onChange={(v) => setFilters({ ...filters, script_id: v, npc_id: undefined, page: 1 })}
              style={{ width: 160 }}
              allowClear
            >
              {scripts.map((s) => (
                <Option key={s.id} value={s.id}>{s.title}</Option>
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
              {filteredNpcs.map((n) => (
                <Option key={n.id} value={n.id}>{n.name}</Option>
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
          <Space>
            <Text type="secondary">{t('logs.groupBySession')}</Text>
            <Switch checked={groupBySession} onChange={setGroupBySession} />
          </Space>
        </Space>
      </Card>

      {groupBySession ? (
        <ResizableTable
          columns={groupedColumns}
          dataSource={sessionGroups}
          rowKey="session_id"
          loading={loading}
          fixFirstColumn={false}
          expandable={{
            expandedRowRender: renderSessionDetail,
            rowExpandable: () => true,
          }}
          pagination={{
            current: filters.page,
            pageSize: filters.page_size,
            total,
            showSizeChanger: true,
            showTotal: (total: number) => t('logs.totalLogs', { total }),
            onChange: (page: number, pageSize: number) => setFilters({ ...filters, page, page_size: pageSize }),
          }}
        />
      ) : (
        <ResizableTable
          columns={flatColumns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          fixFirstColumn={false}
          pagination={{
            current: filters.page,
            pageSize: filters.page_size,
            total,
            showSizeChanger: true,
            showTotal: (total: number) => t('logs.totalLogs', { total }),
            onChange: (page: number, pageSize: number) => setFilters({ ...filters, page, page_size: pageSize }),
          }}
        />
      )}

      <LogDetailModal
        visible={modalVisible}
        log={selectedLog}
        onClose={closeLogDetail}
        getNpcName={getNpcName}
        getTemplate={getTemplate}
        getLlmConfig={getLlmConfig}
        t={t}
      />
    </div>
  );
}
