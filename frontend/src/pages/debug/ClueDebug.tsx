import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Form,
  Select,
  Input,
  Button,
  Space,
  Row,
  Col,
  Descriptions,
  Tag,
  Typography,
  message,
  Empty,
} from 'antd';
import { BugOutlined } from '@ant-design/icons';
import { PageHeader, ClueTypeTag } from '@/components/common';
import { clueApi } from '@/api';
import { useScripts } from '@/hooks';
import type { Clue } from '@/types';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

export default function ClueDebug() {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { scripts, fetchScripts } = useScripts();

  const [clues, setClues] = useState<Clue[]>([]);
  const [selectedClue, setSelectedClue] = useState<Clue | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedScriptId = Form.useWatch('script_id', form);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  useEffect(() => {
    if (selectedScriptId) {
      clueApi.list({ script_id: selectedScriptId, page_size: 100 }).then((res) => {
        setClues(res.items);
      });
    }
  }, [selectedScriptId]);

  const handleClueSelect = (clueId: string) => {
    const clue = clues.find((c) => c.id === clueId);
    setSelectedClue(clue || null);
  };

  const handleDebug = async () => {
    const values = form.getFieldsValue();
    if (!selectedClue || !values.player_message) {
      message.warning(t('debug.selectClueAndEnterMessage'));
      return;
    }

    setLoading(true);
    try {
      // For now, just show the clue details
      message.info('Debug simulation coming soon');
    } catch {
      message.error(t('debug.debugFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t('debug.clueDebug')}
        subtitle={t('debug.clueDebugSubtitle')}
      />

      <Row gutter={16}>
        <Col span={12}>
          <Card title={t('debug.debugConfiguration')} size="small">
            <Form form={form} layout="vertical">
              <Form.Item name="script_id" label={t('debug.selectScript')}>
                <Select placeholder={t('debug.selectScript')} allowClear>
                  {scripts.map((s) => (
                    <Option key={s.id} value={s.id}>
                      {s.title}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item name="clue_id" label={t('debug.selectClue')}>
                <Select
                  placeholder={t('debug.selectClueToDebug')}
                  onChange={handleClueSelect}
                  disabled={!selectedScriptId}
                  allowClear
                >
                  {clues.map((c) => (
                    <Option key={c.id} value={c.id}>
                      {c.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item name="player_message" label={t('debug.playerMessage')}>
                <TextArea
                  rows={4}
                  placeholder={t('debug.enterMessageToTest')}
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  icon={<BugOutlined />}
                  onClick={handleDebug}
                  loading={loading}
                >
                  {t('debug.debugClue')}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col span={12}>
          <Card title={t('debug.selectedClueDetails')} size="small">
            {selectedClue ? (
              <Descriptions column={1} size="small">
                <Descriptions.Item label={t('common.name')}>
                  {selectedClue.name}
                </Descriptions.Item>
                <Descriptions.Item label={t('clue.type')}>
                  <ClueTypeTag type={selectedClue.type} />
                </Descriptions.Item>
                <Descriptions.Item label={t('clue.detail')}>
                  <Text ellipsis>{selectedClue.detail}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('clue.triggerKeywords')}>
                  <Space size={[0, 4]} wrap>
                    {selectedClue.trigger_keywords?.map((kw, i) => (
                      <Tag key={i}>{kw}</Tag>
                    ))}
                    {(!selectedClue.trigger_keywords || selectedClue.trigger_keywords.length === 0) && (
                      <Text type="secondary">{t('debug.noneConfigured')}</Text>
                    )}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label={t('clue.triggerSemanticSummary')}>
                  <Text type="secondary">
                    {selectedClue.trigger_semantic_summary || t('debug.noneConfigured')}
                  </Text>
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Empty description={t('debug.selectClueAndMessage')} />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
