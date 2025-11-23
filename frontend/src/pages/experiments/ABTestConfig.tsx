import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Slider,
  DatePicker,
  Tag,
  Popconfirm,
  Card,
  Descriptions,
  Statistic,
  Row,
  Col,
  message,
} from 'antd';
import type { TableProps } from 'antd';
import {
  PlusOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  DeleteOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { PageHeader, StatusTag } from '@/components/common';
import { abTestApi, strategyApi } from '@/api';
import { formatDate } from '@/utils';
import type { ABTestConfig, AlgorithmStrategy } from '@/types';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

export default function ABTestConfigPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [tests, setTests] = useState<ABTestConfig[]>([]);
  const [strategies, setStrategies] = useState<AlgorithmStrategy[]>([]);
  const [total, setTotal] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [resultsModalVisible, setResultsModalVisible] = useState(false);
  const [selectedTest, setSelectedTest] = useState<ABTestConfig | null>(null);
  const [testResults, setTestResults] = useState<{
    strategy_a_stats: { total_matches: number; avg_score: number };
    strategy_b_stats: { total_matches: number; avg_score: number };
    significance_test: { p_value: number; significant: boolean };
  } | null>(null);

  const [filters, setFilters] = useState<{
    status?: ABTestConfig['status'];
    page: number;
    page_size: number;
  }>({
    page: 1,
    page_size: 10,
  });

  useEffect(() => {
    strategyApi.list({ status: 'published', page_size: 100 }).then((data) => {
      setStrategies(data.items);
    });
  }, []);

  useEffect(() => {
    const fetchTests = async () => {
      setLoading(true);
      try {
        const data = await abTestApi.list(filters);
        setTests(data.items);
        setTotal(data.total);
      } catch {
        // Error handled
      } finally {
        setLoading(false);
      }
    };
    fetchTests();
  }, [filters]);

  const refreshTests = async () => {
    const data = await abTestApi.list(filters);
    setTests(data.items);
    setTotal(data.total);
  };

  const handleCreate = async (values: Record<string, unknown>) => {
    try {
      const dateRange = values.date_range as [dayjs.Dayjs, dayjs.Dayjs] | undefined;
      await abTestApi.create({
        name: values.name as string,
        description: values.description as string,
        strategy_a_id: values.strategy_a_id as string,
        strategy_b_id: values.strategy_b_id as string,
        traffic_split: (values.traffic_split as number) / 100,
        start_at: dateRange?.[0]?.toISOString(),
        end_at: dateRange?.[1]?.toISOString(),
      });
      message.success('A/B test created');
      setModalVisible(false);
      form.resetFields();
      refreshTests();
    } catch {
      message.error('Failed to create A/B test');
    }
  };

  const handleStart = async (id: string) => {
    try {
      await abTestApi.start(id);
      message.success('A/B test started');
      refreshTests();
    } catch {
      message.error('Failed to start A/B test');
    }
  };

  const handleStop = async (id: string) => {
    try {
      await abTestApi.stop(id);
      message.success('A/B test stopped');
      refreshTests();
    } catch {
      message.error('Failed to stop A/B test');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await abTestApi.delete(id);
      message.success('A/B test deleted');
      refreshTests();
    } catch {
      message.error('Failed to delete A/B test');
    }
  };

  const handleViewResults = async (test: ABTestConfig) => {
    setSelectedTest(test);
    try {
      const results = await abTestApi.getResults(test.id);
      setTestResults(results);
      setResultsModalVisible(true);
    } catch {
      message.error('Failed to load results');
    }
  };

  const getStrategyName = (id: string) => {
    return strategies.find((s) => s.id === id)?.name || id;
  };

  const columns: TableProps<ABTestConfig>['columns'] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Strategy A',
      dataIndex: 'strategy_a_id',
      key: 'strategy_a_id',
      render: (id) => <Tag color="blue">{getStrategyName(id)}</Tag>,
    },
    {
      title: 'Strategy B',
      dataIndex: 'strategy_b_id',
      key: 'strategy_b_id',
      render: (id) => <Tag color="green">{getStrategyName(id)}</Tag>,
    },
    {
      title: 'Traffic Split',
      dataIndex: 'traffic_split',
      key: 'traffic_split',
      width: 120,
      render: (split) => `${(split * 100).toFixed(0)}% / ${((1 - split) * 100).toFixed(0)}%`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <StatusTag status={status} />,
    },
    {
      title: 'Period',
      key: 'period',
      width: 200,
      render: (_, record) =>
        record.start_at && record.end_at
          ? `${formatDate(record.start_at, 'MM-DD')} - ${formatDate(record.end_at, 'MM-DD')}`
          : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space>
          {record.status === 'draft' && (
            <Button
              type="text"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStart(record.id)}
              title="Start"
            />
          )}
          {record.status === 'running' && (
            <Button
              type="text"
              icon={<PauseCircleOutlined />}
              onClick={() => handleStop(record.id)}
              title="Stop"
            />
          )}
          {(record.status === 'running' || record.status === 'completed') && (
            <Button
              type="text"
              icon={<BarChartOutlined />}
              onClick={() => handleViewResults(record)}
              title="View Results"
            />
          )}
          <Popconfirm
            title="Delete A/B Test"
            onConfirm={() => handleDelete(record.id)}
            disabled={record.status === 'running'}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={record.status === 'running'}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="A/B Test Configuration"
        subtitle="Compare algorithm strategies with controlled experiments"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            Create A/B Test
          </Button>
        }
      />

      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="Status"
          value={filters.status}
          onChange={(v) => setFilters({ ...filters, status: v, page: 1 })}
          style={{ width: 120 }}
          allowClear
        >
          <Option value="draft">Draft</Option>
          <Option value="running">Running</Option>
          <Option value="completed">Completed</Option>
        </Select>
      </Space>

      <Table
        columns={columns}
        dataSource={tests}
        rowKey="id"
        loading={loading}
        pagination={{
          current: filters.page,
          pageSize: filters.page_size,
          total,
          showSizeChanger: true,
          onChange: (page, pageSize) => setFilters({ ...filters, page, page_size: pageSize }),
        }}
      />

      <Modal
        title="Create A/B Test"
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
            label="Test Name"
            rules={[{ required: true }]}
          >
            <Input placeholder="Enter test name" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea placeholder="Enter description" rows={2} />
          </Form.Item>
          <Form.Item
            name="strategy_a_id"
            label="Strategy A (Control)"
            rules={[{ required: true }]}
          >
            <Select placeholder="Select control strategy">
              {strategies.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="strategy_b_id"
            label="Strategy B (Variant)"
            rules={[{ required: true }]}
          >
            <Select placeholder="Select variant strategy">
              {strategies.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="traffic_split"
            label="Traffic Split (Strategy A %)"
            initialValue={50}
          >
            <Slider marks={{ 0: '0%', 50: '50%', 100: '100%' }} />
          </Form.Item>
          <Form.Item name="date_range" label="Test Period">
            <RangePicker showTime />
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

      <Modal
        title="A/B Test Results"
        open={resultsModalVisible}
        onCancel={() => setResultsModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedTest && testResults && (
          <div>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Test Name" span={2}>
                {selectedTest.name}
              </Descriptions.Item>
              <Descriptions.Item label="Strategy A">
                {getStrategyName(selectedTest.strategy_a_id)}
              </Descriptions.Item>
              <Descriptions.Item label="Strategy B">
                {getStrategyName(selectedTest.strategy_b_id)}
              </Descriptions.Item>
            </Descriptions>

            <Row gutter={16} style={{ marginTop: 24 }}>
              <Col span={12}>
                <Card title="Strategy A" size="small">
                  <Statistic
                    title="Total Matches"
                    value={testResults.strategy_a_stats.total_matches}
                  />
                  <Statistic
                    title="Average Score"
                    value={(testResults.strategy_a_stats.avg_score * 100).toFixed(1)}
                    suffix="%"
                    style={{ marginTop: 16 }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Strategy B" size="small">
                  <Statistic
                    title="Total Matches"
                    value={testResults.strategy_b_stats.total_matches}
                  />
                  <Statistic
                    title="Average Score"
                    value={(testResults.strategy_b_stats.avg_score * 100).toFixed(1)}
                    suffix="%"
                    style={{ marginTop: 16 }}
                  />
                </Card>
              </Col>
            </Row>

            <Card title="Significance Test" size="small" style={{ marginTop: 16 }}>
              <Descriptions column={2}>
                <Descriptions.Item label="P-Value">
                  {testResults.significance_test.p_value.toFixed(4)}
                </Descriptions.Item>
                <Descriptions.Item label="Statistically Significant">
                  <Tag color={testResults.significance_test.significant ? 'success' : 'warning'}>
                    {testResults.significance_test.significant ? 'Yes' : 'No'}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}
