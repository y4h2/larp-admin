import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  message,
} from 'antd';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  WarningOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { PageHeader, ClueTypeTag, ImportanceTag, StatusTag } from '@/components/common';
import { clueApi, type ClueTreeData, type ClueTreeNode } from '@/api/clues';
import { useScripts, useScenes } from '@/hooks';
import { clueTypeColors, importanceColors } from '@/utils';

const { Option } = Select;
const { Text } = Typography;

interface ClueNodeData {
  clue: ClueTreeNode;
  onClick: (clueId: string) => void;
}

// Custom node component for clues
function ClueNode({ data }: { data: ClueNodeData }) {
  const { clue, onClick } = data;

  const borderColor = clueTypeColors[clue.clue_type] || '#d9d9d9';
  const bgColor = clue.status === 'disabled' ? '#f5f5f5' : '#fff';

  return (
    <div
      style={{
        padding: '10px 14px',
        border: `2px solid ${borderColor}`,
        borderRadius: 8,
        background: bgColor,
        minWidth: 150,
        maxWidth: 200,
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
      onClick={() => onClick(clue.id)}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />

      <div style={{ marginBottom: 6 }}>
        <Text strong ellipsis style={{ display: 'block', maxWidth: 170 }}>
          {clue.title}
        </Text>
      </div>

      <Space size={4} wrap>
        <Tag color={clueTypeColors[clue.clue_type]} style={{ margin: 0 }}>
          {clue.clue_type}
        </Tag>
        <Tag color={importanceColors[clue.importance]} style={{ margin: 0 }}>
          {clue.importance}
        </Tag>
        <Tag style={{ margin: 0 }}>S{clue.stage}</Tag>
      </Space>

      {clue.status !== 'active' && (
        <div style={{ marginTop: 6 }}>
          <StatusTag status={clue.status} />
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  clueNode: ClueNode,
};

export default function ClueTree() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { scripts, fetchScripts } = useScripts();
  const { scenes, fetchScenes } = useScenes();

  const [loading, setLoading] = useState(false);
  const [treeData, setTreeData] = useState<ClueTreeData | null>(null);
  const [selectedClueId, setSelectedClueId] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const scriptId = searchParams.get('script_id');
  const sceneId = searchParams.get('scene_id');

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  useEffect(() => {
    if (scriptId) {
      fetchScenes({ script_id: scriptId });
    }
  }, [scriptId, fetchScenes]);

  const fetchTree = useCallback(async () => {
    if (!scriptId) return;
    setLoading(true);
    try {
      const data = await clueApi.getTree(scriptId, sceneId || undefined);
      setTreeData(data);
    } catch {
      message.error(t('common.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [scriptId, sceneId, t]);

  useEffect(() => {
    if (scriptId) {
      fetchTree();
    }
  }, [scriptId, sceneId, fetchTree]);

  // Convert tree data to React Flow nodes and edges
  useEffect(() => {
    if (!treeData) return;

    const handleClueClick = (clueId: string) => {
      setSelectedClueId(clueId);
      setDrawerVisible(true);
    };

    // Calculate positions using a simple layout algorithm
    const nodeMap = new Map<string, ClueTreeNode>();
    const levelMap = new Map<string, number>();
    const childrenMap = new Map<string, string[]>();

    treeData.nodes.forEach((node) => {
      nodeMap.set(node.id, node);
      childrenMap.set(node.id, []);
    });

    treeData.edges.forEach((edge) => {
      const children = childrenMap.get(edge.source) || [];
      children.push(edge.target);
      childrenMap.set(edge.source, children);
    });

    // Calculate levels (BFS from nodes without prerequisites)
    const rootNodes = treeData.nodes.filter((n) => n.prerequisite_clue_ids.length === 0);
    const queue: Array<{ id: string; level: number }> = rootNodes.map((n) => ({
      id: n.id,
      level: 0,
    }));
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      levelMap.set(id, Math.max(levelMap.get(id) || 0, level));

      const children = childrenMap.get(id) || [];
      children.forEach((childId) => {
        queue.push({ id: childId, level: level + 1 });
      });
    }

    // Handle orphan nodes
    treeData.nodes.forEach((node) => {
      if (!levelMap.has(node.id)) {
        levelMap.set(node.id, 0);
      }
    });

    // Group nodes by level
    const levelGroups = new Map<number, string[]>();
    levelMap.forEach((level, nodeId) => {
      const group = levelGroups.get(level) || [];
      group.push(nodeId);
      levelGroups.set(level, group);
    });

    // Create positioned nodes
    const flowNodes: Node[] = [];
    const xSpacing = 250;
    const ySpacing = 150;

    levelGroups.forEach((nodeIds, level) => {
      const totalWidth = (nodeIds.length - 1) * xSpacing;
      const startX = -totalWidth / 2;

      nodeIds.forEach((nodeId, index) => {
        const clueNode = nodeMap.get(nodeId)!;
        flowNodes.push({
          id: nodeId,
          type: 'clueNode',
          position: {
            x: startX + index * xSpacing,
            y: level * ySpacing,
          },
          data: {
            clue: clueNode,
            onClick: handleClueClick,
          },
        });
      });
    });

    // Create edges
    const flowEdges: Edge[] = treeData.edges.map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
      style: { stroke: '#888' },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [treeData, setNodes, setEdges]);

  const onConnect = useCallback(
    async (params: Connection) => {
      if (!params.source || !params.target) return;

      // Update dependencies in backend
      const targetNode = treeData?.nodes.find((n) => n.id === params.target);
      if (!targetNode) return;

      const newPrerequisites = [...targetNode.prerequisite_clue_ids, params.source];

      try {
        await clueApi.updateDependencies(params.target, newPrerequisites);
        message.success(t('clue.dependencyAdded'));
        fetchTree();
      } catch {
        message.error(t('common.saveFailed'));
      }
    },
    [treeData, fetchTree, t]
  );

  const selectedClue = useMemo(() => {
    return treeData?.nodes.find((n) => n.id === selectedClueId);
  }, [treeData, selectedClueId]);

  const hasIssues =
    treeData &&
    (treeData.issues.dead_clues.length > 0 ||
      treeData.issues.orphan_clues.length > 0 ||
      treeData.issues.cycles.length > 0);

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
            <Button icon={<SyncOutlined />} onClick={fetchTree} disabled={!scriptId}>
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
            onChange={(value) => {
              setSearchParams({ script_id: value });
            }}
            style={{ width: 200 }}
          >
            {scripts.map((s) => (
              <Option key={s.id} value={s.id}>
                {s.name}
              </Option>
            ))}
          </Select>
          <Select
            placeholder={t('clue.filterByScene')}
            value={sceneId || undefined}
            onChange={(value) => {
              const params: Record<string, string> = { script_id: scriptId! };
              if (value) params.scene_id = value;
              setSearchParams(params);
            }}
            style={{ width: 180 }}
            allowClear
            disabled={!scriptId}
          >
            {scenes.map((s) => (
              <Option key={s.id} value={s.id}>
                {s.name}
              </Option>
            ))}
          </Select>

          {treeData && (
            <Text type="secondary">
              {treeData.nodes.length} clues, {treeData.edges.length} {t('clue.dependencies')}
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
              {treeData!.issues.dead_clues.length > 0 && (
                <span>
                  <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
                  {t('clue.deadClues')}: {treeData!.issues.dead_clues.length}
                </span>
              )}
              {treeData!.issues.orphan_clues.length > 0 && (
                <span>
                  <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
                  {t('clue.orphanClues')}: {treeData!.issues.orphan_clues.length}
                </span>
              )}
              {treeData!.issues.cycles.length > 0 && (
                <span>
                  <ExclamationCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
                  {t('clue.circularDependencies')}: {treeData!.issues.cycles.length}
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
      ) : loading ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 100 }}>
            <Spin size="large" />
          </div>
        </Card>
      ) : !treeData || treeData.nodes.length === 0 ? (
        <Card>
          <Empty description={t('clue.noCluesFound')} />
        </Card>
      ) : (
        <Card bodyStyle={{ padding: 0 }}>
          <div style={{ height: 600 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
              attributionPosition="bottom-left"
            >
              <Background />
              <Controls />
              <MiniMap
                nodeColor={(node) => {
                  const data = node.data as unknown as ClueNodeData;
                  return data?.clue ? clueTypeColors[data.clue.clue_type] || '#eee' : '#eee';
                }}
              />
            </ReactFlow>
          </div>
        </Card>
      )}

      <Drawer
        title={t('clue.clueDetails')}
        placement="right"
        width={400}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        extra={
          <Button type="primary" onClick={() => navigate(`/clues/${selectedClueId}`)}>
            Edit Clue
          </Button>
        }
      >
        {selectedClue && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Title">{selectedClue.title}</Descriptions.Item>
            <Descriptions.Item label="Type">
              <ClueTypeTag type={selectedClue.clue_type} />
            </Descriptions.Item>
            <Descriptions.Item label="Importance">
              <ImportanceTag importance={selectedClue.importance} />
            </Descriptions.Item>
            <Descriptions.Item label="Stage">{selectedClue.stage}</Descriptions.Item>
            <Descriptions.Item label={t('common.status')}>
              <StatusTag status={selectedClue.status} />
            </Descriptions.Item>
            <Descriptions.Item label={t('clue.prerequisites')}>
              {selectedClue.prerequisite_clue_ids.length === 0 ? (
                <Text type="secondary">{t('clue.noneRoot')}</Text>
              ) : (
                <Space direction="vertical">
                  {selectedClue.prerequisite_clue_ids.map((id) => {
                    const prereq = treeData?.nodes.find((n) => n.id === id);
                    return (
                      <Tag
                        key={id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedClueId(id)}
                      >
                        {prereq?.title || id}
                      </Tag>
                    );
                  })}
                </Space>
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('clue.dependents')}>
              {selectedClue.dependent_clue_ids.length === 0 ? (
                <Text type="secondary">{t('clue.noneLeaf')}</Text>
              ) : (
                <Space direction="vertical">
                  {selectedClue.dependent_clue_ids.map((id) => {
                    const dep = treeData?.nodes.find((n) => n.id === id);
                    return (
                      <Tag
                        key={id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedClueId(id)}
                      >
                        {dep?.title || id}
                      </Tag>
                    );
                  })}
                </Space>
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
}
