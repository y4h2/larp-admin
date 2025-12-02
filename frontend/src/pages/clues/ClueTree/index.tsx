import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Select,
  Space,
  Button,
  Alert,
  Spin,
  Empty,
  Drawer,
  Descriptions,
  Tag,
  Typography,
  Dropdown,
  Checkbox,
  Tooltip,
  Modal,
  Progress,
  List,
  Divider,
} from 'antd';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  type EdgeTypes,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  WarningOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  SaveOutlined,
  MinusSquareOutlined,
  PlusSquareOutlined,
  AimOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  BulbOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/common';
import { ClueNode, ClickableEdge } from './components';
import { useClueTree } from './hooks/useClueTree';
import { ALL_CLUE_FIELDS } from './constants';
import type { ClueNodeData } from './types';

const { Option } = Select;
const { Text } = Typography;

const nodeTypes: NodeTypes = {
  clueNode: ClueNode,
};

const edgeTypes: EdgeTypes = {
  clickable: ClickableEdge,
};

export default function ClueTree() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const {
    loading,
    layouting,
    saving,
    treeData,
    selectedClueId,
    setSelectedClueId,
    drawerVisible,
    setDrawerVisible,
    visibleFields,
    setVisibleFields,
    pendingChanges,
    analyzing,
    analysisResult,
    analysisModalVisible,
    setAnalysisModalVisible,
    collapsedNodes,
    hasCustomPositions,
    nodes,
    edges,
    hasUnsavedChanges,
    scriptId,
    scripts,
    visibleNodeIds,
    hiddenNodeIds,
    selectedClue,
    hasIssues,
    setSearchParams,
    fetchTree,
    handleNodesChange,
    handleEdgesChange,
    onConnect,
    handleClearPositions,
    handleAIAnalysis,
    handleExpandAll,
    handleCollapseAll,
    handleSaveChanges,
    handleDiscardChanges,
  } = useClueTree();

  return (
    <div>
      <PageHeader
        title={t('clue.treeTitle')}
        subtitle={t('clue.treeSubtitle')}
        breadcrumbs={[
          { title: 'Clues', path: '/clues' },
          { title: 'Clue Tree' },
        ]}
        extra={
          <Space>
            {hasUnsavedChanges && (
              <>
                <Button onClick={handleDiscardChanges} disabled={saving}>
                  {t('common.discard')}
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSaveChanges}
                  loading={saving}
                >
                  {t('common.save')} ({pendingChanges.size})
                </Button>
              </>
            )}
            <Button
              icon={<RobotOutlined />}
              onClick={handleAIAnalysis}
              loading={analyzing}
              disabled={!treeData || treeData.nodes.length === 0}
            >
              {t('clue.aiAnalysis.button')}
            </Button>
            <Button icon={<SyncOutlined />} onClick={fetchTree} disabled={!scriptId || saving}>
              {t('clue.refresh')}
            </Button>
          </Space>
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder={t('script.title')}
            value={scriptId || undefined}
            onChange={(value) => setSearchParams({ script_id: value })}
            style={{ width: 200 }}
          >
            {scripts.map((s) => (
              <Option key={s.id} value={s.id}>
                {s.title}
              </Option>
            ))}
          </Select>

          <Dropdown
            trigger={['click']}
            popupRender={() => (
              <Card size="small" style={{ width: 220, maxHeight: 400, overflow: 'auto' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text strong style={{ fontSize: 12 }}>{t('clue.displayFields')}</Text>
                  {ALL_CLUE_FIELDS.map(({ field, labelKey }) => (
                    <Checkbox
                      key={field}
                      checked={visibleFields.includes(field)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setVisibleFields([...visibleFields, field]);
                        } else {
                          setVisibleFields(visibleFields.filter((f) => f !== field));
                        }
                      }}
                    >
                      {t(labelKey)}
                    </Checkbox>
                  ))}
                </Space>
              </Card>
            )}
          >
            <Button icon={<SettingOutlined />}>
              {t('clue.displayFields')}
            </Button>
          </Dropdown>

          <Tooltip title={t('clue.expandAll')}>
            <Button
              icon={<PlusSquareOutlined />}
              onClick={handleExpandAll}
              disabled={collapsedNodes.size === 0}
            />
          </Tooltip>
          <Tooltip title={t('clue.collapseAll')}>
            <Button icon={<MinusSquareOutlined />} onClick={handleCollapseAll} />
          </Tooltip>

          {hasCustomPositions && (
            <Tooltip title={t('clue.clearPositions')}>
              <Button icon={<AimOutlined />} onClick={handleClearPositions} />
            </Tooltip>
          )}

          {treeData && (
            <Text type="secondary">
              {visibleNodeIds.size}/{treeData.nodes.length} clues, {edges.length} {t('clue.dependencies')}
              {hiddenNodeIds.size > 0 && ` (${hiddenNodeIds.size} hidden)`}
            </Text>
          )}
        </Space>
      </Card>

      {hasIssues && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message={t('clue.qualityIssues')}
          description={
            <Space direction="vertical">
              {(treeData?.issues?.dead_clues?.length ?? 0) > 0 && (
                <span>
                  <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
                  {t('clue.deadClues')}: {treeData?.issues?.dead_clues?.length}
                </span>
              )}
              {(treeData?.issues?.orphan_clues?.length ?? 0) > 0 && (
                <span>
                  <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
                  {t('clue.orphanClues')}: {treeData?.issues?.orphan_clues?.length}
                </span>
              )}
              {(treeData?.issues?.cycles?.length ?? 0) > 0 && (
                <span>
                  <ExclamationCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
                  {t('clue.circularDependencies')}: {treeData?.issues?.cycles?.length}
                </span>
              )}
            </Space>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {!scriptId ? (
        <Card>
          <Empty description={t('clue.selectScriptToView')} />
        </Card>
      ) : loading || layouting ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 100 }}>
            <Spin size="large" />
            {layouting && <div style={{ marginTop: 16 }}>{t('clue.calculating')}</div>}
          </div>
        </Card>
      ) : !treeData || treeData.nodes.length === 0 ? (
        <Card>
          <Empty description={t('clue.noCluesFound')} />
        </Card>
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          <div style={{ height: 600 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              edgesReconnectable={false}
              deleteKeyCode={['Backspace', 'Delete']}
              fitView
              attributionPosition="bottom-left"
              defaultEdgeOptions={{
                type: 'smoothstep',
                animated: false,
                interactionWidth: 20,
                markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 },
                style: { strokeWidth: 2, stroke: '#888', cursor: 'pointer' },
              }}
            >
              <Background />
              <Controls />
              <MiniMap
                nodeColor={(node) => {
                  const data = node.data as unknown as ClueNodeData;
                  if (!data?.clue) return '#eee';
                  if (data.isCollapsed) return '#faad14';
                  return data.clue.type === 'image' ? '#722ed1' : '#1890ff';
                }}
              />
            </ReactFlow>
          </div>
          <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', fontSize: 12, color: '#888' }}>
            {t('clue.treeHint')} | {t('clue.dragToReposition')}
          </div>
        </Card>
      )}

      <Drawer
        title={t('clue.clueDetails')}
        placement="right"
        size="large"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        extra={
          <Button type="primary" onClick={() => navigate(`/clues/${selectedClueId}`)}>
            {t('clue.editClue')}
          </Button>
        }
      >
        {selectedClue && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label={t('common.name')}>{selectedClue.name}</Descriptions.Item>
            <Descriptions.Item label={t('clue.type')}>
              <Tag color={selectedClue.type === 'image' ? '#722ed1' : '#1890ff'}>
                {selectedClue.type}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('clue.prerequisites')}>
              {(selectedClue.prereq_clue_ids?.length ?? 0) === 0 ? (
                <Text type="secondary">{t('clue.noneRoot')}</Text>
              ) : (
                <Space direction="vertical">
                  {(selectedClue.prereq_clue_ids || []).map((id) => {
                    const prereq = treeData?.nodes.find((n) => n.id === id);
                    return (
                      <Tag key={id} style={{ cursor: 'pointer' }} onClick={() => setSelectedClueId(id)}>
                        {prereq?.name || id}
                      </Tag>
                    );
                  })}
                </Space>
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('clue.dependents')}>
              {(selectedClue?.dependent_clue_ids?.length ?? 0) === 0 ? (
                <Text type="secondary">{t('clue.noneLeaf')}</Text>
              ) : (
                <Space direction="vertical">
                  {(selectedClue?.dependent_clue_ids || []).map((id) => {
                    const dep = treeData?.nodes.find((n) => n.id === id);
                    return (
                      <Tag key={id} style={{ cursor: 'pointer' }} onClick={() => setSelectedClueId(id)}>
                        {dep?.name || id}
                      </Tag>
                    );
                  })}
                </Space>
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* AI Analysis Modal */}
      <Modal
        title={
          <Space>
            <RobotOutlined />
            {t('clue.aiAnalysis.title')}
          </Space>
        }
        open={analysisModalVisible}
        onCancel={() => setAnalysisModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setAnalysisModalVisible(false)}>
            {t('common.close')}
          </Button>,
        ]}
        width={700}
      >
        {analysisResult && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Progress
                type="circle"
                percent={analysisResult.overall_score * 10}
                format={() => `${analysisResult.overall_score}/10`}
                strokeColor={
                  analysisResult.overall_score >= 7
                    ? '#52c41a'
                    : analysisResult.overall_score >= 4
                      ? '#faad14'
                      : '#ff4d4f'
                }
              />
              <div style={{ marginTop: 8 }}>
                <Text strong>{t('clue.aiAnalysis.overallScore')}</Text>
              </div>
            </div>

            <Alert
              message={t('clue.aiAnalysis.summary')}
              description={analysisResult.summary}
              type="info"
              style={{ marginBottom: 16 }}
            />

            {analysisResult.issues.length > 0 && (
              <>
                <Divider orientation="left">
                  <Space>
                    <ExclamationCircleOutlined />
                    {t('clue.aiAnalysis.issues')} ({analysisResult.issues.length})
                  </Space>
                </Divider>
                <List
                  size="small"
                  dataSource={analysisResult.issues}
                  renderItem={(issue) => (
                    <List.Item>
                      <Space>
                        <Tag
                          color={
                            issue.severity === 'high' ? 'red' : issue.severity === 'medium' ? 'orange' : 'blue'
                          }
                        >
                          {issue.severity}
                        </Tag>
                        <Text strong>{issue.type}</Text>
                        <Text>{issue.description}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </>
            )}

            {analysisResult.suggestions.length > 0 && (
              <>
                <Divider orientation="left">
                  <Space>
                    <BulbOutlined />
                    {t('clue.aiAnalysis.suggestions')} ({analysisResult.suggestions.length})
                  </Space>
                </Divider>
                <List
                  size="small"
                  dataSource={analysisResult.suggestions}
                  renderItem={(suggestion) => (
                    <List.Item>
                      <Space>
                        <Tag
                          color={
                            suggestion.priority === 'high' ? 'red' : suggestion.priority === 'medium' ? 'orange' : 'green'
                          }
                        >
                          {suggestion.priority}
                        </Tag>
                        <Text strong>{suggestion.type}</Text>
                        <Text>{suggestion.description}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </>
            )}

            {analysisResult.key_clues.length > 0 && (
              <>
                <Divider orientation="left">
                  <Space>
                    <CheckCircleOutlined />
                    {t('clue.aiAnalysis.keyClues')}
                  </Space>
                </Divider>
                <Space wrap>
                  {analysisResult.key_clues.map((clueId) => {
                    const clue = treeData?.nodes.find((n) => n.id === clueId);
                    return (
                      <Tag key={clueId} color="green">
                        {clue?.name || clueId}
                      </Tag>
                    );
                  })}
                </Space>
              </>
            )}

            {analysisResult.reasoning_paths.length > 0 && (
              <>
                <Divider orientation="left">{t('clue.aiAnalysis.reasoningPaths')}</Divider>
                <List
                  size="small"
                  dataSource={analysisResult.reasoning_paths}
                  renderItem={(path, index) => (
                    <List.Item>
                      <Text>
                        {index + 1}. {path}
                      </Text>
                    </List.Item>
                  )}
                />
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
