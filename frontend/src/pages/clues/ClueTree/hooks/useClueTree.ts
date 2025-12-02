import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type EdgeChange,
  type NodeChange,
  MarkerType,
} from '@xyflow/react';
import { App } from 'antd';
import ELK from 'elkjs/lib/elk.bundled.js';
import { clueApi, type ClueTreeData, type ClueTreeNode } from '@/api/clues';
import { aiEnhancementApi, type AnalyzeClueChainResponse } from '@/api/aiEnhancement';
import { useScripts, useNpcs } from '@/hooks';
import type { ClueNodeField, ClueNodeData } from '../types';
import { DEFAULT_VISIBLE_FIELDS } from '../constants';
import { loadSavedPositions, savePositionsToStorage, detectCycle, getDescendants } from '../utils';

// ELK instance
const elk = new ELK();

export function useClueTree() {
  const { t } = useTranslation();
  const { modal, message } = App.useApp();
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

  // Custom positions state
  const customPositionsRef = useRef<{ [nodeId: string]: { x: number; y: number } }>({});
  const [hasCustomPositions, setHasCustomPositions] = useState(false);
  const [layoutTrigger, setLayoutTrigger] = useState(0);

  // Hovered node state
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
      const allPositions = loadSavedPositions();
      const scriptPositions = allPositions[scriptId] || {};
      customPositionsRef.current = scriptPositions;
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

  const { visibleNodeIds, hiddenNodeIds, childCountMap } = useMemo(() => {
    if (!treeData) return { visibleNodeIds: new Set<string>(), hiddenNodeIds: new Set<string>(), childCountMap: new Map<string, number>() };

    const allNodeIds = new Set(treeData.nodes.map((n) => n.id));
    const hiddenIds = new Set<string>();
    const childCounts = new Map<string, number>();

    collapsedNodes.forEach((collapsedId) => {
      const descendants = getDescendants(collapsedId, treeData.edges);
      descendants.forEach((id) => hiddenIds.add(id));
      childCounts.set(collapsedId, descendants.size);
    });

    const visibleIds = new Set<string>();
    allNodeIds.forEach((id) => {
      if (!hiddenIds.has(id)) {
        visibleIds.add(id);
      }
    });

    return { visibleNodeIds: visibleIds, hiddenNodeIds: hiddenIds, childCountMap: childCounts };
  }, [treeData, collapsedNodes]);

  const hasChildrenMap = useMemo(() => {
    if (!treeData) return new Map<string, boolean>();
    const map = new Map<string, boolean>();
    treeData.nodes.forEach((n) => map.set(n.id, false));
    treeData.edges.forEach((e) => map.set(e.source, true));
    return map;
  }, [treeData]);

  const runElkLayout = useCallback(async (
    nodesList: ClueTreeNode[],
    edgesList: Array<{ source: string; target: string }>,
    savedPositions: { [nodeId: string]: { x: number; y: number } }
  ) => {
    const nodeWidth = 180;
    const nodeHeight = 60 + visibleFields.length * 20;

    const hasSavedPositionsForAll = nodesList.every((n) => savedPositions[n.id]);
    if (hasSavedPositionsForAll && Object.keys(savedPositions).length > 0) {
      return nodesList.map((node) => ({
        id: node.id,
        x: savedPositions[node.id].x,
        y: savedPositions[node.id].y,
      }));
    }

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

    const visibleNodes = treeData.nodes.filter((n) => visibleNodeIds.has(n.id));
    const visibleEdges = treeData.edges.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    );

    setLayouting(true);

    const nodeNameMap = new Map<string, string>();
    visibleNodes.forEach((n) => nodeNameMap.set(n.id, n.name));

    const edgesByTarget = new Map<string, typeof visibleEdges>();
    visibleEdges.forEach((edge) => {
      const existing = edgesByTarget.get(edge.target) || [];
      existing.push(edge);
      edgesByTarget.set(edge.target, existing);
    });

    runElkLayout(visibleNodes, visibleEdges, customPositionsRef.current).then((positions) => {
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
            isHovered: false,
          } as ClueNodeData,
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
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#888', strokeWidth: 2 },
          data: {
            onDelete: (source: string, target: string) => {
              edgeDeleteHandlerRef.current?.(source, target);
            },
            edgeIndex,
            totalEdgesToTarget: edgesToSameTarget.length,
            sourceName: nodeNameMap.get(edge.source) || edge.source,
            isHighlighted: false,
          },
        };
      });

      setNodes(flowNodes);
      setEdges(flowEdges);
      setLayouting(false);
    });
  }, [treeData, setNodes, setEdges, visibleFields, npcMap, visibleNodeIds, collapsedNodes, hasChildrenMap, childCountMap, layoutTrigger, runElkLayout, handleToggleCollapse]);

  // Update highlighting on hover
  useEffect(() => {
    if (!treeData) return;

    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isHovered: node.id === hoveredNodeId,
        },
      }))
    );

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

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      onNodesChange(changes);

      const positionChanges = changes.filter(
        (c) => c.type === 'position' && 'position' in c && c.position && !c.dragging
      );

      if (positionChanges.length > 0 && scriptId) {
        positionChanges.forEach((change) => {
          if (change.type === 'position' && 'position' in change && change.position) {
            customPositionsRef.current[change.id] = change.position;
          }
        });
        setHasCustomPositions(true);

        const allPositions = loadSavedPositions();
        allPositions[scriptId] = customPositionsRef.current;
        savePositionsToStorage(allPositions);
      }
    },
    [onNodesChange, scriptId]
  );

  const handleClearPositions = useCallback(() => {
    if (!scriptId) return;

    modal.confirm({
      title: t('clue.clearPositions'),
      content: t('clue.clearPositionsConfirm'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: () => {
        customPositionsRef.current = {};
        setHasCustomPositions(false);

        const allPositions = loadSavedPositions();
        delete allPositions[scriptId];
        savePositionsToStorage(allPositions);

        setLayoutTrigger((prev) => prev + 1);
        message.success(t('clue.positionsCleared'));
      },
    });
  }, [scriptId, modal, t, message]);

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

  const handleExpandAll = useCallback(() => {
    setCollapsedNodes(new Set());
  }, []);

  const handleCollapseAll = useCallback(() => {
    const nodesWithChildren = new Set<string>();
    hasChildrenMap.forEach((hasChildren, nodeId) => {
      if (hasChildren) {
        nodesWithChildren.add(nodeId);
      }
    });
    setCollapsedNodes(nodesWithChildren);
  }, [hasChildrenMap]);

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
            return { ...e, data: { ...e.data, totalEdgesToTarget } };
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
        okButtonProps: { danger: true },
        onOk: () => handleEdgeDelete(source, target),
      });
    },
    [modal, handleEdgeDelete, t]
  );

  useEffect(() => {
    edgeDeleteHandlerRef.current = showDeleteConfirmModal;
  }, [showDeleteConfirmModal]);

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

  return {
    // State
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
    npcMap,
    visibleNodeIds,
    hiddenNodeIds,
    selectedClue,
    hasIssues,

    // Handlers
    setSearchParams,
    fetchTree,
    handleToggleCollapse,
    handleNodesChange,
    handleEdgesChange,
    onConnect,
    handleClearPositions,
    handleAIAnalysis,
    handleExpandAll,
    handleCollapseAll,
    handleSaveChanges,
    handleDiscardChanges,
  };
}
