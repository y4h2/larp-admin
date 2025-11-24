import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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
import {
  PlusOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  DeleteOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { PageHeader, StatusTag, ResizableTable, type ResizableColumn } from '@/components/common';
import { abTestApi, strategyApi } from '@/api';
import { formatDate } from '@/utils';
import type { ABTestConfig, AlgorithmStrategy } from '@/types';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

export default function ABTestConfigPage() {
  const { t } = useTranslation();
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
      message.success(t('abtest.testCreated'));
      setModalVisible(false);
      form.resetFields();
      refreshTests();
    } catch {
      message.error(t('abtest.createFailed'));
    }
  };

  const handleStart = async (id: string) => {
    try {
      await abTestApi.start(id);
      message.success(t('abtest.testStarted'));
      refreshTests();
    } catch {
      message.error(t('abtest.startFailed'));
    }
  };

  const handleStop = async (id: string) => {
    try {
      await abTestApi.stop(id);
      message.success(t('abtest.testStopped'));
      refreshTests();
    } catch {
      message.error(t('abtest.stopFailed'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await abTestApi.delete(id);
      message.success(t('abtest.testDeleted'));
      refreshTests();
    } catch {
      message.error(t('abtest.deleteFailed'));
    }
  };

  const handleViewResults = async (test: ABTestConfig) => {
    setSelectedTest(test);
    try {
      const results = await abTestApi.getResults(test.id);
      setTestResults(results);
      setResultsModalVisible(true);
    } catch {
      message.error(t('abtest.loadResultsFailed'));
    }
  };

  const getStrategyName = (id: string) => {
    return strategies.find((s) => s.id === id)?.name || id;
  };

  const columns: ResizableColumn<ABTestConfig>[] = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('abtest.strategyA'),
      dataIndex: 'strategy_a_id',
      key: 'strategy_a_id',
      render: (id) => <Tag color="blue">{getStrategyName(id)}</Tag>,
    },
    {
      title: t('abtest.strategyB'),
      dataIndex: 'strategy_b_id',
      key: 'strategy_b_id',
      render: (id) => <Tag color="green">{getStrategyName(id)}</Tag>,
    },
    {
      title: t('abtest.trafficSplit'),
      dataIndex: 'traffic_split',
      key: 'traffic_split',
      width: 120,
      render: (split) => `${(split * 100).toFixed(0)}% / ${((1 - split) * 100).toFixed(0)}%`,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <StatusTag status={status} />,
    },
    {
      title: t('abtest.testPeriod'),
      key: 'period',
      width: 200,
      render: (_, record) =>
        record.start_at && record.end_at
          ? `${formatDate(record.start_at, 'MM-DD')} - ${formatDate(record.end_at, 'MM-DD')}`
          : '-',
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space>
          {record.status === 'draft' && (
            <Button
              type="text"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStart(record.id)}
              title={t('abtest.start')}
            />
          )}
          {record.status === 'running' && (
            <Button
              type="text"
              icon={<PauseCircleOutlined />}
              onClick={() => handleStop(record.id)}
              title={t('abtest.stop')}
            />
          )}
          {(record.status === 'running' || record.status === 'completed') && (
            <Button
              type="text"
              icon={<BarChartOutlined />}
              onClick={() => handleViewResults(record)}
              title={t('abtest.viewResults')}
            />
          )}
          <Popconfirm
            title={t('abtest.deleteTest')}
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
        title={t('abtest.title')}
        subtitle={t('abtest.subtitle')}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            {t('abtest.createTest')}
          </Button>
        }
      />

      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder={t('common.status')}
          value={filters.status}
          onChange={(v) => setFilters({ ...filters, status: v, page: 1 })}
          style={{ width: 120 }}
          allowClear
        >
          <Option value="draft">{t('script.draft')}</Option>
          <Option value="running">{t('abtest.running')}</Option>
          <Option value="completed">{t('abtest.completed')}</Option>
        </Select>
      </Space>

      <ResizableTable
        columns={columns}
        dataSource={tests}
        rowKey="id"
        loading={loading}
        pagination={{
          current: filters.page,
          pageSize: filters.page_size,
          total,
          showSizeChanger: true,
          onChange: (page: number, pageSize: number) => setFilters({ ...filters, page, page_size: pageSize }),
        }}
      />

      <Modal
        title={t('abtest.createTest')}
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
            label={t('abtest.testName')}
            rules={[{ required: true }]}
          >
            <Input placeholder={t('abtest.enterTestName')} />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea placeholder={t('script.enterDescription')} rows={2} />
          </Form.Item>
          <Form.Item
            name="strategy_a_id"
            label={t('abtest.strategyAControl')}
            rules={[{ required: true }]}
          >
            <Select placeholder={t('abtest.selectControlStrategy')}>
              {strategies.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="strategy_b_id"
            label={t('abtest.strategyBVariant')}
            rules={[{ required: true }]}
          >
            <Select placeholder={t('abtest.selectVariantStrategy')}>
              {strategies.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="traffic_split"
            label={t('abtest.trafficSplitLabel')}
            initialValue={50}
          >
            <Slider marks={{ 0: '0%', 50: '50%', 100: '100%' }} />
          </Form.Item>
          <Form.Item name="date_range" label={t('abtest.testPeriod')}>
            <RangePicker showTime />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {t('common.create')}
              </Button>
              <Button onClick={() => setModalVisible(false)}>{t('common.cancel')}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('abtest.testResults')}
        open={resultsModalVisible}
        onCancel={() => setResultsModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedTest && testResults && (
          <div>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label={t('abtest.testName')} span={2}>
                {selectedTest.name}
              </Descriptions.Item>
              <Descriptions.Item label={t('abtest.strategyA')}>
                {getStrategyName(selectedTest.strategy_a_id)}
              </Descriptions.Item>
              <Descriptions.Item label={t('abtest.strategyB')}>
                {getStrategyName(selectedTest.strategy_b_id)}
              </Descriptions.Item>
            </Descriptions>

            <Row gutter={16} style={{ marginTop: 24 }}>
              <Col span={12}>
                <Card title={t('abtest.strategyA')} size="small">
                  <Statistic
                    title={t('abtest.totalMatches')}
                    value={testResults.strategy_a_stats.total_matches}
                  />
                  <Statistic
                    title={t('abtest.averageScore')}
                    value={(testResults.strategy_a_stats.avg_score * 100).toFixed(1)}
                    suffix="%"
                    style={{ marginTop: 16 }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card title={t('abtest.strategyB')} size="small">
                  <Statistic
                    title={t('abtest.totalMatches')}
                    value={testResults.strategy_b_stats.total_matches}
                  />
                  <Statistic
                    title={t('abtest.averageScore')}
                    value={(testResults.strategy_b_stats.avg_score * 100).toFixed(1)}
                    suffix="%"
                    style={{ marginTop: 16 }}
                  />
                </Card>
              </Col>
            </Row>

            <Card title={t('abtest.significanceTest')} size="small" style={{ marginTop: 16 }}>
              <Descriptions column={2}>
                <Descriptions.Item label={t('abtest.pValue')}>
                  {testResults.significance_test.p_value.toFixed(4)}
                </Descriptions.Item>
                <Descriptions.Item label={t('abtest.statisticallySignificant')}>
                  <Tag color={testResults.significance_test.significant ? 'success' : 'warning'}>
                    {testResults.significance_test.significant ? t('abtest.yes') : t('abtest.no')}
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
