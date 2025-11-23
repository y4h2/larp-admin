import { useEffect, useState } from 'react';
import {
  Table,
  Card,
  Select,
  Space,
  DatePicker,
  Tag,
  Modal,
  Descriptions,
  Typography,
} from 'antd';
import type { TableProps } from 'antd';
import { PageHeader } from '@/components/common';
import { auditLogApi, userApi } from '@/api';
import { formatDate } from '@/utils';
import type { AuditLog, User } from '@/types';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text } = Typography;

export default function AuditLogs() {
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
      script: 'Script',
      scene: 'Scene',
      npc: 'NPC',
      clue: 'Clue',
      strategy: 'Strategy',
      user: 'User',
      settings: 'Settings',
    };
    return labels[type] || type;
  };

  const columns: TableProps<AuditLog>['columns'] = [
    {
      title: 'Time',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date) => formatDate(date),
    },
    {
      title: 'User',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 120,
      render: (id) => {
        const user = users.find((u) => u.id === id);
        return user?.username || id;
      },
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (action) => <Tag color={getActionColor(action)}>{action}</Tag>,
    },
    {
      title: 'Resource',
      dataIndex: 'resource_type',
      key: 'resource_type',
      width: 100,
      render: (type) => <Tag>{getResourceTypeLabel(type)}</Tag>,
    },
    {
      title: 'Resource ID',
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
      title: 'Changes',
      dataIndex: 'changes',
      key: 'changes',
      ellipsis: true,
      render: (changes) => {
        const keys = Object.keys(changes || {});
        return keys.length > 0 ? `${keys.length} field(s) changed` : '-';
      },
    },
    {
      title: 'Details',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <a
          onClick={() => {
            setSelectedLog(record);
            setModalVisible(true);
          }}
        >
          View
        </a>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="Track all changes made to the system"
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="User"
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
            placeholder="Resource Type"
            value={filters.resource_type}
            onChange={(v) => setFilters({ ...filters, resource_type: v, page: 1 })}
            style={{ width: 140 }}
            allowClear
          >
            <Option value="script">Script</Option>
            <Option value="scene">Scene</Option>
            <Option value="npc">NPC</Option>
            <Option value="clue">Clue</Option>
            <Option value="strategy">Strategy</Option>
            <Option value="user">User</Option>
            <Option value="settings">Settings</Option>
          </Select>
          <Select
            placeholder="Action"
            value={filters.action}
            onChange={(v) => setFilters({ ...filters, action: v, page: 1 })}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="create">Create</Option>
            <Option value="update">Update</Option>
            <Option value="delete">Delete</Option>
            <Option value="archive">Archive</Option>
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
        title="Audit Log Details"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedLog && (
          <div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Time">{formatDate(selectedLog.created_at)}</Descriptions.Item>
              <Descriptions.Item label="User">
                {users.find((u) => u.id === selectedLog.user_id)?.username || selectedLog.user_id}
              </Descriptions.Item>
              <Descriptions.Item label="Action">
                <Tag color={getActionColor(selectedLog.action)}>{selectedLog.action}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Resource">
                <Tag>{getResourceTypeLabel(selectedLog.resource_type)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Resource ID" span={2}>
                <Text code copyable>
                  {selectedLog.resource_id}
                </Text>
              </Descriptions.Item>
            </Descriptions>

            <Card title="Changes" size="small" style={{ marginTop: 16 }}>
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
