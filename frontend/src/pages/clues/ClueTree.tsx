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
  SaveOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/common';
import { clueApi, type ClueTreeData, type ClueTreeNode } from '@/api/clues';
import { useScripts } from '@/hooks';

const { Option } = Select;
const { Text } = Typography;

// Available fields that can be shown on clue nodes
type ClueNodeField =
  | 'name'
  | 'type'
  | 'detail'
  | 'npc_id'
  | 'prereq_clue_ids'
  | 'trigger_keywords'
  | 'created_at'
  | 'updated_at';

const DEFAULT_VISIBLE_FIELDS: ClueNodeField[] = ['name', 'type'];

// All available fields with their i18n keys
const ALL_CLUE_FIELDS: { field: ClueNodeField; labelKey: string }[] = [
  { field: 'name', labelKey: 'common.name' },
  { field: 'type', labelKey: 'clue.type' },
  { field: 'detail', labelKey: 'clue.detail' },
  { field: 'npc_id', labelKey: 'common.npc' },
  { field: 'prereq_clue_ids', labelKey: 'clue.prerequisites' },
  { field: 'trigger_keywords', labelKey: 'clue.triggerKeywords' },
  { field: 'created_at', labelKey: 'common.createdAt' },
  { field: 'updated_at', labelKey: 'common.updatedAt' },
];

interface ClueNodeData {
  clue: ClueTreeNode;
  onClick: (clueId: string) => void;
  visibleFields: ClueNodeField[];
}

// Helper to format date for display
function formatShortDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// Custom node component for clues
function ClueNode({ data }: { data: ClueNodeData }) {
  const { clue, onClick, visibleFields } = data;

  const typeColor = clue.type === 'image' ? '#722ed1' : '#1890ff';

  // Check which fields to show
  const showName = visibleFields.includes('name');
  const showType = visibleFields.includes('type');
  const showDetail = visibleFields.includes('detail');
  const showNpcId = visibleFields.includes('npc_id');
  const showPrereqIds = visibleFields.includes('prereq_clue_ids');
  const showKeywords = visibleFields.includes('trigger_keywords');
  const showCreatedAt = visibleFields.includes('created_at');
  const showUpdatedAt = visibleFields.includes('updated_at');

  return (
    <div
      style={{
        padding: '10px 14px',
        border: `2px solid ${typeColor}`,
        borderRadius: 8,
        background: '#fff',
        minWidth: 120,
        maxWidth: 240,
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
      onClick={() => onClick(clue.id)}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />

      {showName && (
        <div style={{ marginBottom: 4 }}>
          <Text strong ellipsis style={{ display: 'block', maxWidth: 210 }}>
            {clue.name}
          </Text>
        </div>
      )}

      {showType && (
        <div style={{ marginBottom: 4 }}>
          <Tag color={typeColor} style={{ margin: 0 }}>
            {clue.type}
          </Tag>
        </div>
      )}

      {showDetail && (clue as unknown as { detail?: string }).detail && (
        <div style={{ marginBottom: 4 }}>
          <Text ellipsis style={{ display: 'block', maxWidth: 210, fontSize: 11, color: '#888' }}>
            {((clue as unknown as { detail?: string }).detail || '').substring(0, 50)}
            {((clue as unknown as { detail?: string }).detail || '').length > 50 ? '...' : ''}
          </Text>
        </div>
      )}

      {showNpcId && clue.npc_id && (
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            👤 NPC
          </Text>
        </div>
      )}

      {showPrereqIds && clue.prereq_clue_ids && clue.prereq_clue_ids.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            🔗 {clue.prereq_clue_ids.length} prereq(s)
          </Text>
        </div>
      )}

      {showKeywords && (clue as unknown as { trigger_keywords?: string[] }).trigger_keywords &&
       (clue as unknown as { trigger_keywords?: string[] }).trigger_keywords!.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            🔑 {(clue as unknown as { trigger_keywords?: string[] }).trigger_keywords!.length} keyword(s)
          </Text>
        </div>
      )}

      {(showCreatedAt || showUpdatedAt) && (
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 10 }}>
            {showCreatedAt && `📅 ${formatShortDate((clue as unknown as { created_at?: string }).created_at)}`}
            {showCreatedAt && showUpdatedAt && ' | '}
            {showUpdatedAt && `✏️ ${formatShortDate((clue as unknown as { updated_at?: string }).updated_at)}`}
          </Text>
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

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [treeData, setTreeData] = useState<ClueTreeData | null>(null);
  const [selectedClueId, setSelectedClueId] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [visibleFields, setVisibleFields] = useState<ClueNodeField[]>(DEFAULT_VISIBLE_FIELDS);
  // Track pending changes: Map of clueId -> new prereq_clue_ids
  const [pendingChanges, setPendingChanges] = useState<Map<string, string[]>>(new Map());

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const hasUnsavedChanges = pendingChanges.size > 0;

  const scriptId = searchParams.get('script_id');

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  const fetchTree = useCallback(async () => {
    if (!scriptId) return;
    setLoading(true);
    try {
      const data = await clueApi.getTree(scriptId);
      // Normalize field names from backend
      const normalizedData: ClueTreeData = {
        ...data,
        nodes: data.nodes.map((node) => ({
          ...node,
          name: node.name || '',
          prereq_clue_ids: node.prereq_clue_ids || [],
        })),
      };
      setTreeData(normalizedData);
    } catch {
      message.error(t('common.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [scriptId, t]);

  useEffect(() => {
    if (scriptId) {
      fetchTree();
    }
  }, [scriptId, fetchTree]);

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
    const rootNodes = treeData.nodes.filter((n) => (n.prereq_clue_ids?.length ?? 0) === 0);
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
            visibleFields,
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
  }, [treeData, setNodes, setEdges, visibleFields]);

  // Get current prerequisites for a node (considering pending changes)
  const getCurrentPrerequisites = useCallback(
    (nodeId: string): string[] => {
      if (pendingChanges.has(nodeId)) {
        return pendingChanges.get(nodeId)!;
      }
      const node = treeData?.nodes.find((n) => n.id === nodeId);
      return node?.prereq_clue_ids || [];
    },
    [treeData, pendingChanges]
  );

  // Cycle detection and edge creation (now tracks locally instead of saving immediately)
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;

      // Prevent self-loop
      if (params.source === params.target) {
        message.error(t('clue.cannotSelfReference'));
        return;
      }

      // Get current edges including pending changes
      const currentEdges = treeData?.edges.filter((e) => {
        // Check if this edge was removed in pending changes
        const targetPrereqs = pendingChanges.get(e.target);
        if (targetPrereqs !== undefined) {
          return targetPrereqs.includes(e.source);
        }
        return true;
      }) || [];

      // Add edges from pending additions
      pendingChanges.forEach((prereqs, targetId) => {
        const originalNode = treeData?.nodes.find((n) => n.id === targetId);
        const originalPrereqs = originalNode?.prereq_clue_ids || [];
        prereqs.forEach((prereqId) => {
          if (!originalPrereqs.includes(prereqId)) {
            currentEdges.push({ source: prereqId, target: targetId });
          }
        });
      });

      // Check for cycle
      if (detectCycle(currentEdges, params.source, params.target)) {
        message.error(t('clue.cycleDetected'));
        return;
      }

      // Check if edge already exists
      const currentPrereqs = getCurrentPrerequisites(params.target);
      if (currentPrereqs.includes(params.source)) {
        message.warning(t('clue.dependencyExists'));
        return;
      }

      // Add to pending changes
      const newPrerequisites = [...currentPrereqs, params.source];
      setPendingChanges((prev) => {
        const next = new Map(prev);
        next.set(params.target, newPrerequisites);
        return next;
      });

      // Update local edges display
      const newEdge: Edge = {
        id: `edge-new-${Date.now()}`,
        source: params.source,
        target: params.target,
        type: 'smoothstep',
        animated: true, // Animate to indicate unsaved
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#1890ff', strokeDasharray: '5 5' }, // Dashed blue to indicate unsaved
      };
      setEdges((eds) => [...eds, newEdge]);
      message.info(t('clue.dependencyAddedUnsaved'));
    },
    [treeData, pendingChanges, getCurrentPrerequisites, setEdges, t]
  );

  // Handle edge deletion (now tracks locally instead of saving immediately)
  const handleEdgeDelete = useCallback(
    (source: string, target: string) => {
      const currentPrereqs = getCurrentPrerequisites(target);
      const newPrerequisites = currentPrereqs.filter((id) => id !== source);

      // Add to pending changes
      setPendingChanges((prev) => {
        const next = new Map(prev);
        next.set(target, newPrerequisites);
        return next;
      });

      // Update local edges display
      setEdges((eds) => eds.filter((e) => !(e.source === source && e.target === target)));
      message.info(t('clue.dependencyRemovedUnsaved'));
    },
    [getCurrentPrerequisites, setEdges, t]
  );

  // Save all pending changes to backend
  const handleSaveChanges = useCallback(async () => {
    if (pendingChanges.size === 0) return;

    setSaving(true);
    try {
      // Save all pending changes
      const savePromises = Array.from(pendingChanges.entries()).map(([clueId, prereqs]) =>
        clueApi.updateDependencies(clueId, prereqs)
      );
      await Promise.all(savePromises);

      message.success(t('common.saveSuccess'));
      setPendingChanges(new Map());
      fetchTree(); // Refresh to get latest data
    } catch {
      message.error(t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [pendingChanges, fetchTree, t]);

  // Discard all pending changes
  const handleDiscardChanges = useCallback(() => {
    Modal.confirm({
      title: t('common.discardChanges'),
      content: t('common.discardChangesConfirm'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: () => {
        setPendingChanges(new Map());
        fetchTree(); // Refresh to restore original state
      },
    });
  }, [fetchTree, t]);

  // Handle edge changes (including deletion via backspace/delete key)
  const handleEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      const deleteChanges = changes.filter((change) => change.type === 'remove');
      if (deleteChanges.length > 0) {
        deleteChanges.forEach((change) => {
          if (change.type === 'remove') {
            const edge = edges.find((e) => e.id === change.id);
            if (edge) {
              handleEdgeDelete(edge.source, edge.target);
            }
          }
        });
        return; // Don't apply delete changes directly - handleEdgeDelete updates edges
      }
      onEdgesChange(changes);
    },
    [edges, onEdgesChange, handleEdgeDelete]
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
            onChange={(value) => {
              setSearchParams({ script_id: value });
            }}
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
                  if (!data?.clue) return '#eee';
                  return data.clue.type === 'image' ? '#722ed1' : '#1890ff';
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
                      <Tag
                        key={id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedClueId(id)}
                      >
                        {prereq?.name || id}
                      </Tag>
                    );
                  })}
                </Space>
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('clue.dependents')}>
              {((selectedClue as unknown as { dependent_clue_ids?: string[] }).dependent_clue_ids?.length ?? 0) === 0 ? (
                <Text type="secondary">{t('clue.noneLeaf')}</Text>
              ) : (
                <Space direction="vertical">
                  {((selectedClue as unknown as { dependent_clue_ids?: string[] }).dependent_clue_ids || []).map((id) => {
                    const dep = treeData?.nodes.find((n) => n.id === id);
                    return (
                      <Tag
                        key={id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedClueId(id)}
                      >
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
    </div>
  );
}
