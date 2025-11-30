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
  type NodeChange,
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
  MinusSquareOutlined,
  PlusSquareOutlined,
  AimOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import ELK from 'elkjs/lib/elk.bundled.js';
import { PageHeader } from '@/components/common';
import { clueApi, type ClueTreeData, type ClueTreeNode } from '@/api/clues';
import { aiEnhancementApi, type AnalyzeClueChainResponse } from '@/api/aiEnhancement';
import { useScripts, useNpcs } from '@/hooks';

const { Option } = Select;
const { Text } = Typography;

// ELK instance
const elk = new ELK();

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

// Local storage key for saved positions
const POSITIONS_STORAGE_KEY = 'clue-tree-positions';

interface SavedPositions {
  [scriptId: string]: {
    [nodeId: string]: { x: number; y: number };
  };
}

// Load saved positions from localStorage
function loadSavedPositions(): SavedPositions {
  try {
    const saved = localStorage.getItem(POSITIONS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

// Save positions to localStorage
function savePositionsToStorage(positions: SavedPositions): void {
  try {
    localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // Ignore storage errors
  }
}

interface ClueNodeData {
  clue: ClueTreeNode;
  onClick: (clueId: string) => void;
  onToggleCollapse: (clueId: string) => void;
  onNodeHover: (nodeId: string | null) => void;
  visibleFields: ClueNodeField[];
  npcMap: Map<string, string>;
  isCollapsed: boolean;
  hasChildren: boolean;
  hiddenChildCount: number;
  incomingEdgeCount: number;
  incomingSourceNames: string[];
  isHovered: boolean;
}

// Helper to format date for display
function formatShortDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// Custom node component for clues
function ClueNode({ data }: { data: ClueNodeData }) {
  const {
    clue, onClick, onToggleCollapse, onNodeHover, visibleFields, npcMap,
    isCollapsed, hasChildren, hiddenChildCount,
    incomingEdgeCount, incomingSourceNames, isHovered
  } = data;

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

  const handleCollapseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCollapse(clue.id);
  };

  return (
    <div
      style={{
        padding: '10px 14px',
        border: `2px solid ${isHovered ? '#1890ff' : typeColor}`,
        borderRadius: 8,
        background: isCollapsed ? '#f5f5f5' : '#fff',
        minWidth: 120,
        maxWidth: 240,
        cursor: 'pointer',
        boxShadow: isHovered ? '0 0 12px rgba(24,144,255,0.5)' : '0 2px 8px rgba(0,0,0,0.1)',
        position: 'relative',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onClick={() => onClick(clue.id)}
      onMouseEnter={() => onNodeHover(clue.id)}
      onMouseLeave={() => onNodeHover(null)}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />

      {/* Incoming edge count badge */}
      {incomingEdgeCount > 0 && (
        <Tooltip
          title={
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>来源节点:</div>
              {incomingSourceNames.map((name, i) => (
                <div key={i}>• {name}</div>
              ))}
            </div>
          }
        >
          <div
            style={{
              position: 'absolute',
              top: -8,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#52c41a',
              color: '#fff',
              borderRadius: 10,
              padding: '0 6px',
              fontSize: 10,
              fontWeight: 'bold',
              minWidth: 18,
              textAlign: 'center',
              lineHeight: '16px',
              zIndex: 10,
              cursor: 'help',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            ↓{incomingEdgeCount}
          </div>
        </Tooltip>
      )}

      {/* Collapse/Expand button */}
      {hasChildren && (
        <div
          style={{
            position: 'absolute',
            top: -10,
            right: -10,
            background: '#fff',
            borderRadius: '50%',
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #d9d9d9',
            cursor: 'pointer',
            zIndex: 10,
          }}
          onClick={handleCollapseClick}
        >
          {isCollapsed ? (
            <PlusSquareOutlined style={{ fontSize: 12, color: '#1890ff' }} />
          ) : (
            <MinusSquareOutlined style={{ fontSize: 12, color: '#666' }} />
          )}
        </div>
      )}

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

      {/* Hidden children indicator */}
      {isCollapsed && hiddenChildCount > 0 && (
        <div style={{ marginTop: 4 }}>
          <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>
            +{hiddenChildCount} hidden
          </Tag>
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
  edgeIndex?: number;
  totalEdgesToTarget?: number;
  isHighlighted?: boolean;
  sourceName?: string;
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
  const isHighlighted = edgeData?.isHighlighted ?? false;

  const edgeIndex = edgeData?.edgeIndex ?? 0;
  const totalEdges = edgeData?.totalEdgesToTarget ?? 1;
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

  // Determine edge color based on state
  const getEdgeColor = () => {
    if (isHovered) return '#ff4d4f';
    if (isHighlighted) return '#1890ff';
    return (style?.stroke as string) || '#888';
  };

  const getEdgeWidth = () => {
    if (isHovered) return 3;
    if (isHighlighted) return 2.5;
    return (style?.strokeWidth as number) || 2;
  };

  return (
    <>
      {/* Glow effect on hover or highlight */}
      {(isHovered || isHighlighted) && (
        <path
          d={edgePath}
          fill="none"
          strokeWidth={isHovered ? 8 : 6}
          stroke={isHovered ? '#ff4d4f' : '#1890ff'}
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
          stroke: getEdgeColor(),
          strokeWidth: getEdgeWidth(),
          transition: 'stroke 0.2s, stroke-width 0.2s',
        }}
      />
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

// Helper function to detect cycles
function detectCycle(
  edges: Array<{ source: string; target: string }>,
  newSource: string,
  newTarget: string
): boolean {
  const adjacency = new Map<string, string[]>();

  edges.forEach((edge) => {
    const children = adjacency.get(edge.source) || [];
    children.push(edge.target);
    adjacency.set(edge.source, children);
  });

  const children = adjacency.get(newSource) || [];
  children.push(newTarget);
  adjacency.set(newSource, children);

  const visited = new Set<string>();
  const stack = [newTarget];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === newSource) {
      return true;
    }
    if (visited.has(current)) continue;
    visited.add(current);

    const neighbors = adjacency.get(current) || [];
    stack.push(...neighbors);
  }

  return false;
}

// Get all descendants of a node
function getDescendants(
  nodeId: string,
  edges: Array<{ source: string; target: string }>
): Set<string> {
  const descendants = new Set<string>();
  const adjacency = new Map<string, string[]>();

  // Build adjacency list (parent -> children)
  edges.forEach((edge) => {
    const children = adjacency.get(edge.source) || [];
    children.push(edge.target);
    adjacency.set(edge.source, children);
  });

  // BFS to find all descendants
  const queue = adjacency.get(nodeId) || [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (!descendants.has(current)) {
      descendants.add(current);
      const children = adjacency.get(current) || [];
      queue.push(...children);
    }
  }

  return descendants;
}

export default function ClueTree() {
  const { t } = useTranslation();
  const { modal, message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { scripts, fetchScripts } = useScripts();
  const { npcs, fetchNpcs } = useNpcs();

  const [loading, setLoading] = useState(false);
  const [layouting, setLayouting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [treeData, setTreeData] = useState<ClueTreeData | null>(null);
  const [selectedClueId, setSelectedClueId] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [visibleFields, setVisibleFields] = useState<ClueNodeField[]>(DEFAULT_VISIBLE_FIELDS);
  const [pendingChanges, setPendingChanges] = useState<Map<string, string[]>>(new Map());

  // AI Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeClueChainResponse | null>(null);
  const [analysisModalVisible, setAnalysisModalVisible] = useState(false);

  // Collapsed nodes state
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  // Custom positions state (for manual dragging)
  const [customPositions, setCustomPositions] = useState<{ [nodeId: string]: { x: number; y: number } }>({});
  const [hasCustomPositions, setHasCustomPositions] = useState(false);

  // Hovered node state for edge highlighting
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const edgeDeleteHandlerRef = useRef<((source: string, target: string) => void) | undefined>(undefined);

  const hasUnsavedChanges = pendingChanges.size > 0;
  const scriptId = searchParams.get('script_id');

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  useEffect(() => {
    if (scriptId) {
      fetchNpcs({ script_id: scriptId });
      // Load saved positions for this script
      const allPositions = loadSavedPositions();
      const scriptPositions = allPositions[scriptId] || {};
      setCustomPositions(scriptPositions);
      setHasCustomPositions(Object.keys(scriptPositions).length > 0);
    }
  }, [scriptId, fetchNpcs]);

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

  // Toggle collapse state for a node
  const handleToggleCollapse = useCallback((nodeId: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Calculate hidden nodes based on collapsed state
  const { visibleNodeIds, hiddenNodeIds, childCountMap } = useMemo(() => {
    if (!treeData) return { visibleNodeIds: new Set<string>(), hiddenNodeIds: new Set<string>(), childCountMap: new Map<string, number>() };

    const allNodeIds = new Set(treeData.nodes.map((n) => n.id));
    const hiddenIds = new Set<string>();
    const childCounts = new Map<string, number>();

    // For each collapsed node, hide all its descendants
    collapsedNodes.forEach((collapsedId) => {
      const descendants = getDescendants(collapsedId, treeData.edges);
      descendants.forEach((id) => hiddenIds.add(id));
      childCounts.set(collapsedId, descendants.size);
    });

    // But if a hidden node is also collapsed, its count shouldn't be shown
    // since it's already hidden by a parent
    const visibleIds = new Set<string>();
    allNodeIds.forEach((id) => {
      if (!hiddenIds.has(id)) {
        visibleIds.add(id);
      }
    });

    return { visibleNodeIds: visibleIds, hiddenNodeIds: hiddenIds, childCountMap: childCounts };
  }, [treeData, collapsedNodes]);

  // Check if a node has children
  const hasChildrenMap = useMemo(() => {
    if (!treeData) return new Map<string, boolean>();
    const map = new Map<string, boolean>();
    treeData.nodes.forEach((n) => map.set(n.id, false));
    treeData.edges.forEach((e) => map.set(e.source, true));
    return map;
  }, [treeData]);

  // Run ELK layout
  const runElkLayout = useCallback(async (
    nodesList: ClueTreeNode[],
    edgesList: Array<{ source: string; target: string }>,
    savedPositions: { [nodeId: string]: { x: number; y: number } }
  ) => {
    const nodeWidth = 180;
    const nodeHeight = 60 + visibleFields.length * 20;

    // If we have saved positions for all nodes, use them directly
    const hasSavedPositionsForAll = nodesList.every((n) => savedPositions[n.id]);
    if (hasSavedPositionsForAll && Object.keys(savedPositions).length > 0) {
      return nodesList.map((node) => ({
        id: node.id,
        x: savedPositions[node.id].x,
        y: savedPositions[node.id].y,
      }));
    }

    // Otherwise, run ELK layout
    const elkGraph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.spacing.nodeNode': '80',
        'elk.layered.spacing.nodeNodeBetweenLayers': '120',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
        'elk.edgeRouting': 'ORTHOGONAL',
      },
      children: nodesList.map((node) => ({
        id: node.id,
        width: nodeWidth,
        height: nodeHeight,
        // Use saved position if available
        ...(savedPositions[node.id] ? {
          x: savedPositions[node.id].x,
          y: savedPositions[node.id].y,
        } : {}),
      })),
      edges: edgesList.map((edge, i) => ({
        id: `e${i}`,
        sources: [edge.source],
        targets: [edge.target],
      })),
    };

    try {
      const layout = await elk.layout(elkGraph);
      return (layout.children || []).map((node) => ({
        id: node.id,
        x: node.x || 0,
        y: node.y || 0,
      }));
    } catch (error) {
      console.error('ELK layout error:', error);
      // Fallback to simple grid layout
      return nodesList.map((node, i) => ({
        id: node.id,
        x: (i % 5) * 220,
        y: Math.floor(i / 5) * 150,
      }));
    }
  }, [visibleFields.length]);

  // Convert tree data to React Flow nodes and edges
  useEffect(() => {
    if (!treeData) return;

    const handleClueClick = (clueId: string) => {
      setSelectedClueId(clueId);
      setDrawerVisible(true);
    };

    // Filter visible nodes and edges
    const visibleNodes = treeData.nodes.filter((n) => visibleNodeIds.has(n.id));
    const visibleEdges = treeData.edges.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    );

    setLayouting(true);

    // Build node name map for edge source names
    const nodeNameMap = new Map<string, string>();
    visibleNodes.forEach((n) => nodeNameMap.set(n.id, n.name));

    // Group edges by target for incoming edge count
    const edgesByTarget = new Map<string, typeof visibleEdges>();
    visibleEdges.forEach((edge) => {
      const existing = edgesByTarget.get(edge.target) || [];
      existing.push(edge);
      edgesByTarget.set(edge.target, existing);
    });

    runElkLayout(visibleNodes, visibleEdges, customPositions).then((positions) => {
      const positionMap = new Map(positions.map((p) => [p.id, { x: p.x, y: p.y }]));

      const flowNodes: Node[] = visibleNodes.map((node) => {
        const pos = positionMap.get(node.id) || { x: 0, y: 0 };
        const incomingEdges = edgesByTarget.get(node.id) || [];
        return {
          id: node.id,
          type: 'clueNode',
          position: pos,
          data: {
            clue: node,
            onClick: handleClueClick,
            onToggleCollapse: handleToggleCollapse,
            onNodeHover: setHoveredNodeId,
            visibleFields,
            npcMap,
            isCollapsed: collapsedNodes.has(node.id),
            hasChildren: hasChildrenMap.get(node.id) || false,
            hiddenChildCount: childCountMap.get(node.id) || 0,
            incomingEdgeCount: incomingEdges.length,
            incomingSourceNames: incomingEdges.map((e) => nodeNameMap.get(e.source) || e.source),
            isHovered: false, // Will be updated by separate effect
          },
        };
      });

      const flowEdges: Edge[] = visibleEdges.map((edge) => {
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
            sourceName: nodeNameMap.get(edge.source) || edge.source,
            isHighlighted: false, // Will be updated by separate effect
          },
        };
      });

      setNodes(flowNodes);
      setEdges(flowEdges);
      setLayouting(false);
    });
  }, [treeData, setNodes, setEdges, visibleFields, npcMap, visibleNodeIds, collapsedNodes, hasChildrenMap, childCountMap, customPositions, runElkLayout, handleToggleCollapse]);

  // Update node/edge highlighting when hovered node changes
  useEffect(() => {
    if (!treeData) return;

    // Update nodes to reflect hover state
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isHovered: node.id === hoveredNodeId,
        },
      }))
    );

    // Update edges to highlight those connected to hovered node
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        data: {
          ...edge.data,
          isHighlighted: hoveredNodeId !== null && (edge.source === hoveredNodeId || edge.target === hoveredNodeId),
        },
      }))
    );
  }, [hoveredNodeId, treeData, setNodes, setEdges]);

  // Handle node position changes (for saving custom positions)
  const handleNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      onNodesChange(changes);

      // Check for position changes from dragging
      const positionChanges = changes.filter(
        (c) => c.type === 'position' && 'position' in c && c.position && !c.dragging
      );

      if (positionChanges.length > 0 && scriptId) {
        const newPositions = { ...customPositions };
        positionChanges.forEach((change) => {
          if (change.type === 'position' && 'position' in change && change.position) {
            newPositions[change.id] = change.position;
          }
        });
        setCustomPositions(newPositions);
        setHasCustomPositions(true);

        // Save to localStorage
        const allPositions = loadSavedPositions();
        allPositions[scriptId] = newPositions;
        savePositionsToStorage(allPositions);
      }
    },
    [onNodesChange, customPositions, scriptId]
  );

  // Clear custom positions and re-layout
  const handleClearPositions = useCallback(() => {
    if (!scriptId) return;

    modal.confirm({
      title: t('clue.clearPositions'),
      content: t('clue.clearPositionsConfirm'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: () => {
        setCustomPositions({});
        setHasCustomPositions(false);

        // Remove from localStorage
        const allPositions = loadSavedPositions();
        delete allPositions[scriptId];
        savePositionsToStorage(allPositions);

        // Force re-layout
        if (treeData) {
          setTreeData({ ...treeData });
        }

        message.success(t('clue.positionsCleared'));
      },
    });
  }, [scriptId, modal, t, message, treeData]);

  // AI Analysis handler
  const handleAIAnalysis = useCallback(async () => {
    if (!treeData || treeData.nodes.length === 0) return;

    setAnalyzing(true);
    try {
      const clues = treeData.nodes.map((node) => ({
        id: node.id,
        name: node.name,
        detail: node.detail,
        prereq_clue_ids: node.prereq_clue_ids || [],
      }));

      const result = await aiEnhancementApi.analyzeClueChain({ clues });
      setAnalysisResult(result);
      setAnalysisModalVisible(true);
    } catch {
      message.error(t('clue.aiAnalysis.failed'));
    } finally {
      setAnalyzing(false);
    }
  }, [treeData, message, t]);

  // Expand all collapsed nodes
  const handleExpandAll = useCallback(() => {
    setCollapsedNodes(new Set());
  }, []);

  // Collapse all nodes with children
  const handleCollapseAll = useCallback(() => {
    const nodesWithChildren = new Set<string>();
    hasChildrenMap.forEach((hasChildren, nodeId) => {
      if (hasChildren) {
        nodesWithChildren.add(nodeId);
      }
    });
    setCollapsedNodes(nodesWithChildren);
  }, [hasChildrenMap]);

  // Get current prerequisites for a node
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

  // Handle new connection
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;

      if (params.source === params.target) {
        message.error(t('clue.cannotSelfReference'));
        return;
      }

      const currentEdges = treeData?.edges.filter((e) => {
        const targetPrereqs = pendingChanges.get(e.target);
        if (targetPrereqs !== undefined) {
          return targetPrereqs.includes(e.source);
        }
        return true;
      }) || [];

      pendingChanges.forEach((prereqs, targetId) => {
        const originalNode = treeData?.nodes.find((n) => n.id === targetId);
        const originalPrereqs = originalNode?.prereq_clue_ids || [];
        prereqs.forEach((prereqId) => {
          if (!originalPrereqs.includes(prereqId)) {
            currentEdges.push({ source: prereqId, target: targetId });
          }
        });
      });

      if (detectCycle(currentEdges, params.source, params.target)) {
        message.error(t('clue.cycleDetected'));
        return;
      }

      const currentPrereqs = getCurrentPrerequisites(params.target);
      if (currentPrereqs.includes(params.source)) {
        message.warning(t('clue.dependencyExists'));
        return;
      }

      const newPrerequisites = [...currentPrereqs, params.source];
      setPendingChanges((prev) => {
        const next = new Map(prev);
        next.set(params.target, newPrerequisites);
        return next;
      });

      setEdges((eds) => {
        const existingEdgesToTarget = eds.filter((e) => e.target === params.target);
        const edgeIndex = existingEdgesToTarget.length;
        const totalEdgesToTarget = edgeIndex + 1;

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
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#1890ff', strokeWidth: 2, strokeDasharray: '5 5' },
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

  // Handle edge deletion
  const handleEdgeDelete = useCallback(
    (source: string, target: string) => {
      const currentPrereqs = getCurrentPrerequisites(target);
      const newPrerequisites = currentPrereqs.filter((id) => id !== source);

      setPendingChanges((prev) => {
        const next = new Map(prev);
        next.set(target, newPrerequisites);
        return next;
      });

      setEdges((eds) => eds.filter((e) => !(e.source === source && e.target === target)));
      message.info(t('clue.dependencyRemovedUnsaved'));
    },
    [getCurrentPrerequisites, setEdges, message, t]
  );

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

  useEffect(() => {
    edgeDeleteHandlerRef.current = showDeleteConfirmModal;
  }, [showDeleteConfirmModal]);

  // Save pending changes
  const handleSaveChanges = useCallback(async () => {
    if (pendingChanges.size === 0) return;

    setSaving(true);
    try {
      const savePromises = Array.from(pendingChanges.entries()).map(([clueId, prereqs]) =>
        clueApi.updateDependencies(clueId, prereqs)
      );
      await Promise.all(savePromises);

      message.success(t('common.saveSuccess'));
      setPendingChanges(new Map());
      fetchTree();
    } catch {
      message.error(t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [pendingChanges, fetchTree, message, t]);

  // Discard pending changes
  const handleDiscardChanges = useCallback(() => {
    modal.confirm({
      title: t('common.discardChanges'),
      content: t('common.discardChangesConfirm'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: () => {
        setPendingChanges(new Map());
        fetchTree();
      },
    });
  }, [modal, fetchTree, t]);

  // Handle edge changes
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
        return;
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

          {/* Collapse controls */}
          <Tooltip title={t('clue.expandAll')}>
            <Button
              icon={<PlusSquareOutlined />}
              onClick={handleExpandAll}
              disabled={collapsedNodes.size === 0}
            />
          </Tooltip>
          <Tooltip title={t('clue.collapseAll')}>
            <Button
              icon={<MinusSquareOutlined />}
              onClick={handleCollapseAll}
            />
          </Tooltip>

          {/* Clear positions */}
          {hasCustomPositions && (
            <Tooltip title={t('clue.clearPositions')}>
              <Button
                icon={<AimOutlined />}
                onClick={handleClearPositions}
              />
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
            {/* Score */}
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

            {/* Summary */}
            <Alert
              message={t('clue.aiAnalysis.summary')}
              description={analysisResult.summary}
              type="info"
              style={{ marginBottom: 16 }}
            />

            {/* Issues */}
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
                            issue.severity === 'high'
                              ? 'red'
                              : issue.severity === 'medium'
                                ? 'orange'
                                : 'blue'
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

            {/* Suggestions */}
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
                            suggestion.priority === 'high'
                              ? 'red'
                              : suggestion.priority === 'medium'
                                ? 'orange'
                                : 'green'
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

            {/* Key Clues */}
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

            {/* Reasoning Paths */}
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
