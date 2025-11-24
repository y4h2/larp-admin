import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Select,
  Space,
  DatePicker,
  Tag,
  Modal,
  Descriptions,
  Typography,
} from 'antd';
import { PageHeader, ResizableTable, type ResizableColumn } from '@/components/common';
import { auditLogApi, userApi } from '@/api';
import { formatDate } from '@/utils';
import type { AuditLog, User } from '@/types';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text } = Typography;

export default function AuditLogs() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [filters, setFilters] = useState<{
    user_id?: string;
    resource_type?: string;
    action?: string;
    start_date?: string;
    end_date?: string;
    page: number;
    page_size: number;
  }>({
    page: 1,
    page_size: 20,
  });

  useEffect(() => {
    userApi.list({ page_size: 100 }).then((data) => setUsers(data.items));
  }, []);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const data = await auditLogApi.list(filters);
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

  const getActionColor = (action: string) => {
    if (action.includes('create')) return 'success';
    if (action.includes('update')) return 'processing';
    if (action.includes('delete')) return 'error';
    return 'default';
  };

  const getResourceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      script: t('strategy.script'),
      scene: t('strategy.scene'),
      npc: 'NPC',
      clue: t('debug.clue'),
      strategy: t('algorithm.strategy'),
      user: t('audit.user'),
      settings: t('settings.title'),
    };
    return labels[type] || type;
  };

  const columns: ResizableColumn<AuditLog>[] = [
    {
      title: t('audit.time'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date) => formatDate(date),
    },
    {
      title: t('audit.user'),
      dataIndex: 'user_id',
      key: 'user_id',
      width: 120,
      render: (id) => {
        const user = users.find((u) => u.id === id);
        return user?.username || id;
      },
    },
    {
      title: t('audit.action'),
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (action) => <Tag color={getActionColor(action)}>{action}</Tag>,
    },
    {
      title: t('audit.resource'),
      dataIndex: 'resource_type',
      key: 'resource_type',
      width: 100,
      render: (type) => <Tag>{getResourceTypeLabel(type)}</Tag>,
    },
    {
      title: t('audit.resourceId'),
      dataIndex: 'resource_id',
      key: 'resource_id',
      width: 150,
      render: (id) => (
        <Text code copyable style={{ fontSize: 12 }}>
          {id.slice(0, 12)}...
        </Text>
      ),
    },
    {
      title: t('audit.changes'),
      dataIndex: 'changes',
      key: 'changes',
      ellipsis: true,
      render: (changes) => {
        const keys = Object.keys(changes || {});
        return keys.length > 0 ? `${keys.length} ${t('audit.fieldsChanged')}` : '-';
      },
    },
    {
      title: t('audit.details'),
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <a
          onClick={() => {
            setSelectedLog(record);
            setModalVisible(true);
          }}
        >
          {t('audit.view')}
        </a>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('audit.title')}
        subtitle={t('audit.subtitle')}
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder={t('audit.user')}
            value={filters.user_id}
            onChange={(v) => setFilters({ ...filters, user_id: v, page: 1 })}
            style={{ width: 150 }}
            allowClear
          >
            {users.map((u) => (
              <Option key={u.id} value={u.id}>
                {u.username}
              </Option>
            ))}
          </Select>
          <Select
            placeholder={t('audit.resourceType')}
            value={filters.resource_type}
            onChange={(v) => setFilters({ ...filters, resource_type: v, page: 1 })}
            style={{ width: 140 }}
            allowClear
          >
            <Option value="script">{t('strategy.script')}</Option>
            <Option value="scene">{t('strategy.scene')}</Option>
            <Option value="npc">NPC</Option>
            <Option value="clue">{t('debug.clue')}</Option>
            <Option value="strategy">{t('algorithm.strategy')}</Option>
            <Option value="user">{t('audit.user')}</Option>
            <Option value="settings">{t('settings.title')}</Option>
          </Select>
          <Select
            placeholder={t('audit.action')}
            value={filters.action}
            onChange={(v) => setFilters({ ...filters, action: v, page: 1 })}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="create">{t('audit.create')}</Option>
            <Option value="update">{t('audit.update')}</Option>
            <Option value="delete">{t('audit.delete')}</Option>
            <Option value="archive">{t('audit.archive')}</Option>
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
          showTotal: (total: number) => t('audit.totalLogs', { total }),
          onChange: (page: number, pageSize: number) => setFilters({ ...filters, page, page_size: pageSize }),
        }}
      />

      <Modal
        title={t('audit.logDetails')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedLog && (
          <div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label={t('audit.time')}>{formatDate(selectedLog.created_at)}</Descriptions.Item>
              <Descriptions.Item label={t('audit.user')}>
                {users.find((u) => u.id === selectedLog.user_id)?.username || selectedLog.user_id}
              </Descriptions.Item>
              <Descriptions.Item label={t('audit.action')}>
                <Tag color={getActionColor(selectedLog.action)}>{selectedLog.action}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('audit.resource')}>
                <Tag>{getResourceTypeLabel(selectedLog.resource_type)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('audit.resourceId')} span={2}>
                <Text code copyable>
                  {selectedLog.resource_id}
                </Text>
              </Descriptions.Item>
            </Descriptions>

            <Card title={t('audit.changes')} size="small" style={{ marginTop: 16 }}>
              <pre
                style={{
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 4,
                  overflow: 'auto',
                  maxHeight: 300,
                }}
              >
                {JSON.stringify(selectedLog.changes, null, 2)}
              </pre>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}
