import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Space,
  Input,
  Select,
  Modal,
  Form,
  Popconfirm,
  Tag,
  message,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled,
} from '@ant-design/icons';
import { PageHeader, StatusTag, ResizableTable, type ResizableColumn } from '@/components/common';
import { strategyApi, algorithmApi } from '@/api';
import { formatDate } from '@/utils';
import type { AlgorithmStrategy, AlgorithmImplementation } from '@/types';

const { Option } = Select;

export default function StrategyList() {
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [strategies, setStrategies] = useState<AlgorithmStrategy[]>([]);
  const [implementations, setImplementations] = useState<AlgorithmImplementation[]>([]);
  const [total, setTotal] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [filters, setFilters] = useState<{
    impl_id?: string;
    scope_type?: AlgorithmStrategy['scope_type'];
    status?: AlgorithmStrategy['status'];
    search?: string;
    page: number;
    page_size: number;
  }>({
    page: 1,
    page_size: 10,
  });

  useEffect(() => {
    const fetchImplementations = async () => {
      try {
        const data = await algorithmApi.listImplementations();
        setImplementations(data);
      } catch {
        // Error handled
      }
    };
    fetchImplementations();
  }, []);

  useEffect(() => {
    const fetchStrategies = async () => {
      setLoading(true);
      try {
        const data = await strategyApi.list(filters);
        setStrategies(data.items);
        setTotal(data.total);
      } catch {
        // Error handled
      } finally {
        setLoading(false);
      }
    };
    fetchStrategies();
  }, [filters]);

  const handleCreate = async (values: Partial<AlgorithmStrategy>) => {
    try {
      const strategy = await strategyApi.create({
        ...values,
        params: {},
      });
      setModalVisible(false);
      form.resetFields();
      message.success('Strategy created');
      navigate(`/algorithms/strategies/${strategy.id}`);
    } catch {
      message.error('Failed to create strategy');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await strategyApi.delete(id);
      message.success('Strategy deleted');
      const data = await strategyApi.list(filters);
      setStrategies(data.items);
      setTotal(data.total);
    } catch {
      message.error('Failed to delete strategy');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await strategyApi.setDefault(id);
      message.success('Default strategy updated');
      const data = await strategyApi.list(filters);
      setStrategies(data.items);
    } catch {
      message.error('Failed to set default strategy');
    }
  };

  const getScopeTypeColor = (type: AlgorithmStrategy['scope_type']) => {
    const colors = {
      global: 'purple',
      script: 'blue',
      scene: 'green',
      npc: 'orange',
    };
    return colors[type];
  };

  const columns: ResizableColumn<AlgorithmStrategy>[] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <a onClick={() => navigate(`/algorithms/strategies/${record.id}`)}>{text}</a>
          {record.is_default && (
            <Tag icon={<StarFilled />} color="gold">
              Default
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Implementation',
      dataIndex: 'impl_id',
      key: 'impl_id',
      render: (implId) => {
        const impl = implementations.find((i) => i.id === implId);
        return impl?.name || implId;
      },
    },
    {
      title: 'Scope',
      dataIndex: 'scope_type',
      key: 'scope_type',
      width: 100,
      render: (type) => <Tag color={getScopeTypeColor(type)}>{type}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <StatusTag status={status} />,
    },
    {
      title: 'Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (date) => formatDate(date),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          {!record.is_default && (
            <Button
              type="text"
              icon={<StarOutlined />}
              onClick={() => handleSetDefault(record.id)}
              title="Set as default"
            />
          )}
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => navigate(`/algorithms/strategies/${record.id}`)}
          />
          <Popconfirm
            title="Delete Strategy"
            description="Are you sure you want to delete this strategy?"
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okType="danger"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Algorithm Strategies"
        subtitle="Configure matching algorithm strategies"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            Create Strategy
          </Button>
        }
      />

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="Search strategies..."
          prefix={<SearchOutlined />}
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
          style={{ width: 200 }}
          allowClear
        />
        <Select
          placeholder="Implementation"
          value={filters.impl_id}
          onChange={(value) => setFilters({ ...filters, impl_id: value, page: 1 })}
          style={{ width: 160 }}
          allowClear
        >
          {implementations.map((impl) => (
            <Option key={impl.id} value={impl.id}>
              {impl.name}
            </Option>
          ))}
        </Select>
        <Select
          placeholder="Scope"
          value={filters.scope_type}
          onChange={(value) => setFilters({ ...filters, scope_type: value, page: 1 })}
          style={{ width: 120 }}
          allowClear
        >
          <Option value="global">Global</Option>
          <Option value="script">Script</Option>
          <Option value="scene">Scene</Option>
          <Option value="npc">NPC</Option>
        </Select>
        <Select
          placeholder="Status"
          value={filters.status}
          onChange={(value) => setFilters({ ...filters, status: value, page: 1 })}
          style={{ width: 120 }}
          allowClear
        >
          <Option value="draft">Draft</Option>
          <Option value="published">Published</Option>
          <Option value="deprecated">Deprecated</Option>
        </Select>
      </Space>

      <ResizableTable
        columns={columns}
        dataSource={strategies}
        rowKey="id"
        loading={loading}
        pagination={{
          current: filters.page,
          pageSize: filters.page_size,
          total,
          showSizeChanger: true,
          showTotal: (total: number) => `Total ${total} strategies`,
          onChange: (page: number, pageSize: number) =>
            setFilters({ ...filters, page, page_size: pageSize }),
        }}
      />

      <Modal
        title="Create Strategy"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="name"
            label="Strategy Name"
            rules={[{ required: true, message: 'Please enter strategy name' }]}
          >
            <Input placeholder="Enter strategy name" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea placeholder="Enter description" rows={2} />
          </Form.Item>
          <Form.Item
            name="impl_id"
            label="Implementation"
            rules={[{ required: true, message: 'Please select implementation' }]}
          >
            <Select placeholder="Select implementation">
              {implementations
                .filter((i) => i.status === 'active')
                .map((impl) => (
                  <Option key={impl.id} value={impl.id}>
                    {impl.name}
                  </Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="scope_type"
            label="Scope"
            rules={[{ required: true }]}
            initialValue="global"
          >
            <Select>
              <Option value="global">Global</Option>
              <Option value="script">Script</Option>
              <Option value="scene">Scene</Option>
              <Option value="npc">NPC</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Create
              </Button>
              <Button onClick={() => setModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
