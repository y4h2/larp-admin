import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  Dropdown,
  Checkbox,
  App,
} from 'antd';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BaseEdge,
  getSmoothStepPath,
  type Node,
  type Edge,
  type EdgeProps,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
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
import dagre from 'dagre';
import { PageHeader } from '@/components/common';
import { clueApi, type ClueTreeData, type ClueTreeNode } from '@/api/clues';
import { useScripts, useNpcs } from '@/hooks';

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
  npcMap: Map<string, string>; // npc_id -> npc name
}

// Helper to format date for display
function formatShortDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// Custom node component for clues
function ClueNode({ data }: { data: ClueNodeData }) {
  const { clue, onClick, visibleFields, npcMap } = data;

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

      {showDetail && clue.detail && (
        <div style={{ marginBottom: 4 }}>
          <Text ellipsis style={{ display: 'block', maxWidth: 210, fontSize: 11, color: '#888' }}>
            {(clue.detail || '').substring(0, 50)}
            {(clue.detail || '').length > 50 ? '...' : ''}
          </Text>
        </div>
      )}

      {showNpcId && clue.npc_id && (
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            👤 {npcMap.get(clue.npc_id) || clue.npc_id}
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

      {showKeywords && clue.trigger_keywords && clue.trigger_keywords.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            🔑 {clue.trigger_keywords.length} keyword(s)
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

      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  clueNode: ClueNode,
};

// Custom edge component with click handler
interface ClickableEdgeData extends Record<string, unknown> {
  onDelete?: (source: string, target: string) => void;
  edgeIndex?: number; // Index among edges with same target
  totalEdgesToTarget?: number; // Total edges pointing to same target
}

function ClickableEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
    source,
    target,
    data,
  } = props;

  const [isHovered, setIsHovered] = useState(false);

  const edgeData = data as ClickableEdgeData | undefined;

  // Calculate offset to separate overlapping edges
  const edgeIndex = edgeData?.edgeIndex ?? 0;
  const totalEdges = edgeData?.totalEdgesToTarget ?? 1;
  // Spread edges horizontally: offset ranges from negative to positive
  const offsetX = totalEdges > 1
    ? (edgeIndex - (totalEdges - 1) / 2) * 25
    : 0;

  const [edgePath] = getSmoothStepPath({
    sourceX: sourceX + offsetX,
    sourceY,
    sourcePosition,
    targetX: targetX + offsetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (edgeData?.onDelete) {
      edgeData.onDelete(source, target);
    }
  };

  return (
    <>
      {/* Highlight glow effect on hover */}
      {isHovered && (
        <path
          d={edgePath}
          fill="none"
          strokeWidth={8}
          stroke="#ff4d4f"
          strokeOpacity={0.4}
          style={{ filter: 'blur(2px)' }}
        />
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd as string}
        style={{
          ...style,
          stroke: isHovered ? '#ff4d4f' : (style?.stroke as string) || '#888',
          strokeWidth: isHovered ? 3 : (style?.strokeWidth as number) || 2,
          transition: 'stroke 0.2s, stroke-width 0.2s',
        }}
      />
      {/* Invisible wider path for easier clicking and hover detection */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        style={{ cursor: 'pointer' }}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
    </>
  );
}

const edgeTypes: EdgeTypes = {
  clickable: ClickableEdge,
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
  const { modal, message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { scripts, fetchScripts } = useScripts();
  const { npcs, fetchNpcs } = useNpcs();

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

  // Ref to store the edge delete handler for use in edge components
  const edgeDeleteHandlerRef = useRef<((source: string, target: string) => void) | undefined>(undefined);

  const hasUnsavedChanges = pendingChanges.size > 0;

  const scriptId = searchParams.get('script_id');

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  // Fetch NPCs when script changes
  useEffect(() => {
    if (scriptId) {
      fetchNpcs({ script_id: scriptId });
    }
  }, [scriptId, fetchNpcs]);

  // Create a map from npc_id to npc name
  const npcMap = useMemo(() => {
    const map = new Map<string, string>();
    npcs.forEach((npc) => {
      map.set(npc.id, npc.name);
    });
    return map;
  }, [npcs]);

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
  }, [scriptId, message, t]);

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

    // Build node map for quick lookup
    const nodeMap = new Map<string, ClueTreeNode>();
    treeData.nodes.forEach((node) => {
      nodeMap.set(node.id, node);
    });

    // Use dagre for automatic graph layout
    const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    g.setGraph({
      rankdir: 'TB', // Top to bottom
      nodesep: 80,   // Horizontal spacing between nodes
      ranksep: 120,  // Vertical spacing between ranks
      marginx: 20,
      marginy: 20,
    });

    // Add nodes to dagre graph
    treeData.nodes.forEach((node) => {
      // Estimate node dimensions based on visible fields
      const nodeWidth = 180;
      const nodeHeight = 60 + visibleFields.length * 20;
      g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    // Add edges to dagre graph
    treeData.edges.forEach((edge) => {
      g.setEdge(edge.source, edge.target);
    });

    // Run dagre layout
    dagre.layout(g);

    // Create positioned nodes from dagre results
    const flowNodes: Node[] = treeData.nodes.map((node) => {
      const nodeWithPosition = g.node(node.id);
      return {
        id: node.id,
        type: 'clueNode',
        position: {
          x: nodeWithPosition.x - nodeWithPosition.width / 2,
          y: nodeWithPosition.y - nodeWithPosition.height / 2,
        },
        data: {
          clue: node,
          onClick: handleClueClick,
          visibleFields,
          npcMap,
        },
      };
    });

    // Group edges by target to calculate offsets for overlapping edges
    const edgesByTarget = new Map<string, typeof treeData.edges>();
    treeData.edges.forEach((edge) => {
      const existing = edgesByTarget.get(edge.target) || [];
      existing.push(edge);
      edgesByTarget.set(edge.target, existing);
    });

    // Create edges with persistent IDs based on source-target
    const flowEdges: Edge[] = treeData.edges.map((edge) => {
      const edgesToSameTarget = edgesByTarget.get(edge.target) || [];
      const edgeIndex = edgesToSameTarget.findIndex(
        (e) => e.source === edge.source && e.target === edge.target
      );
      return {
        id: `${edge.source}->${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: 'clickable',
        animated: false,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        style: { stroke: '#888', strokeWidth: 2 },
        data: {
          onDelete: (source: string, target: string) => {
            edgeDeleteHandlerRef.current?.(source, target);
          },
          edgeIndex,
          totalEdgesToTarget: edgesToSameTarget.length,
        },
      };
    });

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [treeData, setNodes, setEdges, visibleFields, npcMap]);

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
      setEdges((eds) => {
        // Count existing edges to the same target
        const existingEdgesToTarget = eds.filter((e) => e.target === params.target);
        const edgeIndex = existingEdgesToTarget.length;
        const totalEdgesToTarget = edgeIndex + 1;

        // Update totalEdgesToTarget for existing edges to same target
        const updatedEdges = eds.map((e) => {
          if (e.target === params.target) {
            return {
              ...e,
              data: {
                ...e.data,
                totalEdgesToTarget,
              },
            };
          }
          return e;
        });

        const newEdge: Edge = {
          id: `edge-new-${Date.now()}`,
          source: params.source,
          target: params.target,
          type: 'clickable',
          animated: true, // Animate to indicate unsaved
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#1890ff', strokeWidth: 2, strokeDasharray: '5 5' }, // Dashed blue to indicate unsaved
          data: {
            onDelete: (source: string, target: string) => {
              edgeDeleteHandlerRef.current?.(source, target);
            },
            edgeIndex,
            totalEdgesToTarget,
          },
        };
        return [...updatedEdges, newEdge];
      });
      message.info(t('clue.dependencyAddedUnsaved'));
    },
    [treeData, pendingChanges, getCurrentPrerequisites, setEdges, message, t]
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
    [getCurrentPrerequisites, setEdges, message, t]
  );

  // Show delete confirmation modal - used by edge click handler
  const showDeleteConfirmModal = useCallback(
    (source: string, target: string) => {
      modal.confirm({
        title: t('clue.confirmDeleteDependency'),
        content: t('clue.deleteDependencyWarning'),
        okText: t('common.confirm'),
        cancelText: t('common.cancel'),
        okButtonProps: { danger: true, icon: <DeleteOutlined /> },
        onOk: () => handleEdgeDelete(source, target),
      });
    },
    [modal, handleEdgeDelete, t]
  );

  // Keep the ref updated
  useEffect(() => {
    edgeDeleteHandlerRef.current = showDeleteConfirmModal;
  }, [showDeleteConfirmModal]);

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
  }, [pendingChanges, fetchTree, message, t]);

  // Discard all pending changes
  const handleDiscardChanges = useCallback(() => {
    modal.confirm({
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
  }, [modal, fetchTree, t]);

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
            popupRender={() => (
              <Card size="small" style={{ width: 220, maxHeight: 400, overflow: 'auto' }}>
                <Space orientation="vertical" style={{ width: '100%' }}>
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
            <Space orientation="vertical">
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
        <Card styles={{ body: { padding: 0 } }}>
          <div style={{ height: 600 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
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
                <Space orientation="vertical">
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
              {(selectedClue?.dependent_clue_ids?.length ?? 0) === 0 ? (
                <Text type="secondary">{t('clue.noneLeaf')}</Text>
              ) : (
                <Space orientation="vertical">
                  {(selectedClue?.dependent_clue_ids || []).map((id) => {
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
