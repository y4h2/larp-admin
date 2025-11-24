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
  Modal,
  Dropdown,
  Checkbox,
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
  type EdgeChange,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  WarningOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  DeleteOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { PageHeader, ClueTypeTag, ImportanceTag, StatusTag } from '@/components/common';
import { clueApi, type ClueTreeData, type ClueTreeNode } from '@/api/clues';
import { useScripts, useScenes } from '@/hooks';
import { clueTypeColors, importanceColors } from '@/utils';

const { Option } = Select;
const { Text } = Typography;

// Available fields that can be shown on clue nodes
type ClueNodeField =
  | 'title_internal'
  | 'title_player'
  | 'clue_type'
  | 'importance'
  | 'stage'
  | 'status'
  | 'scene_id'
  | 'content_text'
  | 'content_type'
  | 'npc_ids'
  | 'prereq_clue_ids'
  | 'version'
  | 'created_at'
  | 'updated_at';

const DEFAULT_VISIBLE_FIELDS: ClueNodeField[] = ['title_internal', 'clue_type', 'importance', 'stage'];

// All available fields with their i18n keys
const ALL_CLUE_FIELDS: { field: ClueNodeField; labelKey: string }[] = [
  { field: 'title_internal', labelKey: 'clue.internalTitle' },
  { field: 'title_player', labelKey: 'clue.playerTitle' },
  { field: 'clue_type', labelKey: 'clue.type' },
  { field: 'importance', labelKey: 'clue.importance' },
  { field: 'stage', labelKey: 'clue.stage' },
  { field: 'status', labelKey: 'common.status' },
  { field: 'scene_id', labelKey: 'common.scene' },
  { field: 'content_text', labelKey: 'clue.content' },
  { field: 'content_type', labelKey: 'clue.contentType' },
  { field: 'npc_ids', labelKey: 'clue.associatedNpcs' },
  { field: 'prereq_clue_ids', labelKey: 'clue.prerequisites' },
  { field: 'version', labelKey: 'common.version' },
  { field: 'created_at', labelKey: 'common.createdAt' },
  { field: 'updated_at', labelKey: 'common.updatedAt' },
];

interface ClueNodeData {
  clue: ClueTreeNode;
  onClick: (clueId: string) => void;
  visibleFields: ClueNodeField[];
  sceneName?: string;
}

// Helper to format date for display
function formatShortDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// Custom node component for clues
function ClueNode({ data }: { data: ClueNodeData }) {
  const { clue, onClick, visibleFields, sceneName } = data;

  const borderColor = clueTypeColors[clue.clue_type] || '#d9d9d9';
  const bgColor = clue.status === 'disabled' ? '#f5f5f5' : '#fff';

  // Check which fields to show
  const showTitleInternal = visibleFields.includes('title_internal');
  const showTitlePlayer = visibleFields.includes('title_player');
  const showType = visibleFields.includes('clue_type');
  const showImportance = visibleFields.includes('importance');
  const showStage = visibleFields.includes('stage');
  const showStatus = visibleFields.includes('status');
  const showScene = visibleFields.includes('scene_id');
  const showContentText = visibleFields.includes('content_text');
  const showContentType = visibleFields.includes('content_type');
  const showNpcIds = visibleFields.includes('npc_ids');
  const showPrereqIds = visibleFields.includes('prereq_clue_ids');
  const showVersion = visibleFields.includes('version');
  const showCreatedAt = visibleFields.includes('created_at');
  const showUpdatedAt = visibleFields.includes('updated_at');

  const hasTags = showType || showImportance || showStage || showContentType || showVersion;
  const hasTitle = showTitleInternal || showTitlePlayer;

  return (
    <div
      style={{
        padding: '10px 14px',
        border: `2px solid ${borderColor}`,
        borderRadius: 8,
        background: bgColor,
        minWidth: 120,
        maxWidth: 240,
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
      onClick={() => onClick(clue.id)}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />

      {showTitleInternal && (
        <div style={{ marginBottom: 4 }}>
          <Text strong ellipsis style={{ display: 'block', maxWidth: 210 }}>
            {clue.title_internal || clue.title}
          </Text>
        </div>
      )}

      {showTitlePlayer && (
        <div style={{ marginBottom: hasTitle ? 4 : 0 }}>
          <Text ellipsis style={{ display: 'block', maxWidth: 210, fontSize: 12, color: '#666' }}>
            {clue.title_player}
          </Text>
        </div>
      )}

      {showScene && sceneName && (
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            📍 {sceneName}
          </Text>
        </div>
      )}

      {showContentText && clue.content_text && (
        <div style={{ marginBottom: 4 }}>
          <Text ellipsis style={{ display: 'block', maxWidth: 210, fontSize: 11, color: '#888' }}>
            {clue.content_text.substring(0, 50)}
            {clue.content_text.length > 50 ? '...' : ''}
          </Text>
        </div>
      )}

      {hasTags && (
        <Space size={4} wrap style={{ marginBottom: 4 }}>
          {showType && (
            <Tag color={clueTypeColors[clue.clue_type]} style={{ margin: 0 }}>
              {clue.clue_type}
            </Tag>
          )}
          {showImportance && (
            <Tag color={importanceColors[clue.importance]} style={{ margin: 0 }}>
              {clue.importance}
            </Tag>
          )}
          {showStage && <Tag style={{ margin: 0 }}>S{clue.stage}</Tag>}
          {showContentType && clue.content_type && (
            <Tag style={{ margin: 0 }}>{clue.content_type}</Tag>
          )}
          {showVersion && clue.version !== undefined && (
            <Tag style={{ margin: 0 }}>v{clue.version}</Tag>
          )}
        </Space>
      )}

      {showNpcIds && clue.npc_ids && clue.npc_ids.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            👥 {clue.npc_ids.length} NPC(s)
          </Text>
        </div>
      )}

      {showPrereqIds && clue.prerequisite_clue_ids && clue.prerequisite_clue_ids.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            🔗 {clue.prerequisite_clue_ids.length} prereq(s)
          </Text>
        </div>
      )}

      {(showCreatedAt || showUpdatedAt) && (
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 10 }}>
            {showCreatedAt && `📅 ${formatShortDate(clue.created_at)}`}
            {showCreatedAt && showUpdatedAt && ' | '}
            {showUpdatedAt && `✏️ ${formatShortDate(clue.updated_at)}`}
          </Text>
        </div>
      )}

      {showStatus && clue.status !== 'active' && (
        <div style={{ marginTop: 4 }}>
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

// Helper function to detect cycles in the dependency graph
function detectCycle(
  edges: Array<{ source: string; target: string }>,
  newSource: string,
  newTarget: string
): boolean {
  // Build adjacency list including the new edge
  const adjacency = new Map<string, string[]>();

  // Add existing edges
  edges.forEach((edge) => {
    const children = adjacency.get(edge.source) || [];
    children.push(edge.target);
    adjacency.set(edge.source, children);
  });

  // Add the new edge
  const children = adjacency.get(newSource) || [];
  children.push(newTarget);
  adjacency.set(newSource, children);

  // DFS to detect cycle: check if we can reach newSource from newTarget
  const visited = new Set<string>();
  const stack = [newTarget];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === newSource) {
      // Found a path from newTarget back to newSource - this would create a cycle
      return true;
    }
    if (visited.has(current)) continue;
    visited.add(current);

    const neighbors = adjacency.get(current) || [];
    stack.push(...neighbors);
  }

  return false;
}

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
  const [visibleFields, setVisibleFields] = useState<ClueNodeField[]>(DEFAULT_VISIBLE_FIELDS);

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
      // Normalize field names from backend (prerequisites -> prerequisite_clue_ids)
      const normalizedData: ClueTreeData = {
        ...data,
        nodes: data.nodes.map((node) => ({
          ...node,
          title: node.title || node.title_internal || '',
          prerequisite_clue_ids: node.prerequisite_clue_ids || node.prerequisites || [],
          dependent_clue_ids: node.dependent_clue_ids || node.dependents || [],
        })),
      };
      setTreeData(normalizedData);
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
    const rootNodes = treeData.nodes.filter((n) => (n.prerequisite_clue_ids?.length ?? 0) === 0);
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
        const scene = clueNode.scene_id ? scenes.find((s) => s.id === clueNode.scene_id) : null;
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
            visibleFields,
            sceneName: scene?.name,
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
  }, [treeData, setNodes, setEdges, visibleFields, scenes]);

  // Cycle detection and edge creation
  const onConnect = useCallback(
    async (params: Connection) => {
      if (!params.source || !params.target) return;

      // Prevent self-loop
      if (params.source === params.target) {
        message.error(t('clue.cannotSelfReference'));
        return;
      }

      // Check for cycle
      if (treeData && detectCycle(treeData.edges, params.source, params.target)) {
        message.error(t('clue.cycleDetected'));
        return;
      }

      // Check if edge already exists
      const targetNode = treeData?.nodes.find((n) => n.id === params.target);
      if (!targetNode) return;

      if (targetNode.prerequisite_clue_ids?.includes(params.source)) {
        message.warning(t('clue.dependencyExists'));
        return;
      }

      const newPrerequisites = [...(targetNode.prerequisite_clue_ids || []), params.source];

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

  // Handle edge deletion
  const handleEdgeDelete = useCallback(
    async (source: string, target: string) => {
      const targetNode = treeData?.nodes.find((n) => n.id === target);
      if (!targetNode) return;

      const newPrerequisites = (targetNode.prerequisite_clue_ids || []).filter(
        (id) => id !== source
      );

      try {
        await clueApi.updateDependencies(target, newPrerequisites);
        message.success(t('clue.dependencyRemoved'));
        fetchTree();
      } catch {
        message.error(t('common.saveFailed'));
      }
    },
    [treeData, fetchTree, t]
  );

  // Handle edge changes (including deletion via backspace/delete key)
  const handleEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      const deleteChanges = changes.filter((change) => change.type === 'remove');
      if (deleteChanges.length > 0) {
        deleteChanges.forEach((change) => {
          if (change.type === 'remove') {
            const edge = edges.find((e) => e.id === change.id);
            if (edge) {
              Modal.confirm({
                title: t('clue.confirmDeleteDependency'),
                content: t('clue.deleteDependencyWarning'),
                okText: t('common.confirm'),
                cancelText: t('common.cancel'),
                onOk: () => handleEdgeDelete(edge.source, edge.target),
              });
            }
          }
        });
        return; // Don't apply delete changes directly - let the confirmation handle it
      }
      onEdgesChange(changes);
    },
    [edges, onEdgesChange, handleEdgeDelete, t]
  );

  // Handle edge click for deletion
  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      Modal.confirm({
        title: t('clue.confirmDeleteDependency'),
        content: t('clue.deleteDependencyWarning'),
        okText: t('common.confirm'),
        cancelText: t('common.cancel'),
        okButtonProps: { danger: true, icon: <DeleteOutlined /> },
        onOk: () => handleEdgeDelete(edge.source, edge.target),
      });
    },
    [handleEdgeDelete, t]
  );

  const selectedClue = useMemo(() => {
    return treeData?.nodes.find((n) => n.id === selectedClueId);
  }, [treeData, selectedClueId]);

  const hasIssues =
    treeData?.issues &&
    ((treeData.issues.dead_clues?.length ?? 0) > 0 ||
      (treeData.issues.orphan_clues?.length ?? 0) > 0 ||
      (treeData.issues.cycles?.length ?? 0) > 0);

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

          <Dropdown
            trigger={['click']}
            dropdownRender={() => (
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
              onEdgesChange={handleEdgesChange}
              onConnect={onConnect}
              onEdgeClick={onEdgeClick}
              nodeTypes={nodeTypes}
              fitView
              attributionPosition="bottom-left"
              defaultEdgeOptions={{
                type: 'smoothstep',
                animated: false,
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  width: 20,
                  height: 20,
                },
                style: {
                  strokeWidth: 2,
                  stroke: '#888',
                  cursor: 'pointer',
                },
              }}
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
          <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', fontSize: 12, color: '#888' }}>
            {t('clue.treeHint')}
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
            {t('clue.editClue')}
          </Button>
        }
      >
        {selectedClue && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label={t('common.name')}>{selectedClue.title}</Descriptions.Item>
            <Descriptions.Item label={t('clue.type')}>
              <ClueTypeTag type={selectedClue.clue_type} />
            </Descriptions.Item>
            <Descriptions.Item label={t('clue.importance')}>
              <ImportanceTag importance={selectedClue.importance} />
            </Descriptions.Item>
            <Descriptions.Item label={t('clue.stage')}>{selectedClue.stage}</Descriptions.Item>
            <Descriptions.Item label={t('common.status')}>
              <StatusTag status={selectedClue.status} />
            </Descriptions.Item>
            <Descriptions.Item label={t('clue.prerequisites')}>
              {(selectedClue.prerequisite_clue_ids?.length ?? 0) === 0 ? (
                <Text type="secondary">{t('clue.noneRoot')}</Text>
              ) : (
                <Space direction="vertical">
                  {(selectedClue.prerequisite_clue_ids || []).map((id) => {
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
              {(selectedClue.dependent_clue_ids?.length ?? 0) === 0 ? (
                <Text type="secondary">{t('clue.noneLeaf')}</Text>
              ) : (
                <Space direction="vertical">
                  {(selectedClue.dependent_clue_ids || []).map((id) => {
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
