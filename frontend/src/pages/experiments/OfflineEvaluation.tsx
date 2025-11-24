import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Form,
  Select,
  Button,
  Upload,
  Alert,
  Progress,
  Statistic,
  Row,
  Col,
  Divider,
  message,
} from 'antd';
import type { UploadFile } from 'antd';
import { UploadOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { PageHeader, ResizableTable, type ResizableColumn } from '@/components/common';

const { Option } = Select;

interface EvaluationResult {
  query: string;
  expected_clues: string[];
  matched_clues: string[];
  precision: number;
  recall: number;
  f1_score: number;
}

export default function OfflineEvaluation() {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [summary, setSummary] = useState<{
    avg_precision: number;
    avg_recall: number;
    avg_f1: number;
    total_queries: number;
  } | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const handleEvaluate = async () => {
    if (fileList.length === 0) {
      message.warning(t('evaluation.pleaseUploadDataset'));
      return;
    }

    setLoading(true);
    // Simulate evaluation - in real implementation, this would call the backend
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Mock results
    const mockResults: EvaluationResult[] = [
      {
        query: 'Where was the victim found?',
        expected_clues: ['clue_1', 'clue_2'],
        matched_clues: ['clue_1', 'clue_2', 'clue_3'],
        precision: 0.67,
        recall: 1.0,
        f1_score: 0.8,
      },
      {
        query: 'What was the murder weapon?',
        expected_clues: ['clue_4'],
        matched_clues: ['clue_4'],
        precision: 1.0,
        recall: 1.0,
        f1_score: 1.0,
      },
      {
        query: 'Who saw the suspect last?',
        expected_clues: ['clue_5', 'clue_6'],
        matched_clues: ['clue_5'],
        precision: 1.0,
        recall: 0.5,
        f1_score: 0.67,
      },
    ];

    setResults(mockResults);
    setSummary({
      avg_precision: 0.89,
      avg_recall: 0.83,
      avg_f1: 0.82,
      total_queries: 3,
    });
    setLoading(false);
    message.success(t('evaluation.evaluationCompleted'));
  };

  const columns: ResizableColumn<EvaluationResult>[] = [
    {
      title: t('evaluation.query'),
      dataIndex: 'query',
      key: 'query',
      ellipsis: true,
    },
    {
      title: t('evaluation.expected'),
      dataIndex: 'expected_clues',
      key: 'expected_clues',
      width: 100,
      render: (clues) => clues.length,
    },
    {
      title: t('evaluation.matched'),
      dataIndex: 'matched_clues',
      key: 'matched_clues',
      width: 100,
      render: (clues) => clues.length,
    },
    {
      title: t('evaluation.precision'),
      dataIndex: 'precision',
      key: 'precision',
      width: 120,
      render: (p) => <Progress percent={Math.round(p * 100)} size="small" />,
    },
    {
      title: t('evaluation.recall'),
      dataIndex: 'recall',
      key: 'recall',
      width: 120,
      render: (r) => <Progress percent={Math.round(r * 100)} size="small" />,
    },
    {
      title: t('evaluation.f1Score'),
      dataIndex: 'f1_score',
      key: 'f1_score',
      width: 120,
      render: (f) => <Progress percent={Math.round(f * 100)} size="small" status="active" />,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('evaluation.title')}
        subtitle={t('evaluation.subtitle')}
      />

      <Row gutter={24}>
        <Col span={8}>
          <Card title={t('evaluation.evaluationSetup')} size="small">
            <Form form={form} layout="vertical">
              <Form.Item label={t('evaluation.strategyToEvaluate')}>
                <Select placeholder={t('evaluation.selectStrategy')}>
                  <Option value="keyword">{t('evaluation.keywordMatching')}</Option>
                  <Option value="semantic">{t('evaluation.semanticMatching')}</Option>
                  <Option value="hybrid">{t('evaluation.hybridMatching')}</Option>
                </Select>
              </Form.Item>
              <Form.Item
                label={t('evaluation.testDataset')}
                extra={t('evaluation.testDatasetExtra')}
              >
                <Upload
                  fileList={fileList}
                  onChange={({ fileList }) => setFileList(fileList)}
                  beforeUpload={() => false}
                  maxCount={1}
                  accept=".json"
                >
                  <Button icon={<UploadOutlined />}>{t('evaluation.uploadDataset')}</Button>
                </Upload>
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleEvaluate}
                  loading={loading}
                  block
                >
                  {t('evaluation.runEvaluation')}
                </Button>
              </Form.Item>
            </Form>

            <Divider />

            <Alert
              message={t('evaluation.datasetFormat')}
              description={
                <pre style={{ fontSize: 11, marginTop: 8 }}>
                  {JSON.stringify(
                    [
                      {
                        query: 'Player message',
                        expected_clue_ids: ['clue_1', 'clue_2'],
                      },
                    ],
                    null,
                    2
                  )}
                </pre>
              }
              type="info"
            />
          </Card>
        </Col>

        <Col span={16}>
          {summary && (
            <Card title={t('evaluation.evaluationSummary')} size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic
                    title={t('evaluation.totalQueries')}
                    value={summary.total_queries}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title={t('evaluation.avgPrecision')}
                    value={(summary.avg_precision * 100).toFixed(1)}
                    suffix="%"
                    valueStyle={{ color: summary.avg_precision >= 0.8 ? '#3f8600' : '#cf1322' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title={t('evaluation.avgRecall')}
                    value={(summary.avg_recall * 100).toFixed(1)}
                    suffix="%"
                    valueStyle={{ color: summary.avg_recall >= 0.8 ? '#3f8600' : '#cf1322' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title={t('evaluation.avgF1Score')}
                    value={(summary.avg_f1 * 100).toFixed(1)}
                    suffix="%"
                    valueStyle={{ color: summary.avg_f1 >= 0.8 ? '#3f8600' : '#cf1322' }}
                  />
                </Col>
              </Row>
            </Card>
          )}

          <Card title={t('evaluation.detailedResults')} size="small">
            <ResizableTable
              columns={columns}
              dataSource={results}
              rowKey="query"
              pagination={false}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
