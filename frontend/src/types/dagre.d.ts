declare module 'dagre' {
  export interface GraphLabel {
    rankdir?: 'TB' | 'BT' | 'LR' | 'RL';
    nodesep?: number;
    ranksep?: number;
    edgesep?: number;
    marginx?: number;
    marginy?: number;
    acyclicer?: 'greedy' | undefined;
    ranker?: 'network-simplex' | 'tight-tree' | 'longest-path';
  }

  export interface NodeConfig {
    width: number;
    height: number;
  }

  export interface NodeWithPosition extends NodeConfig {
    x: number;
    y: number;
  }

  export interface Graph {
    setDefaultEdgeLabel(callback: () => object): Graph;
    setGraph(label: GraphLabel): Graph;
    setNode(node: string, config: NodeConfig): void;
    setEdge(source: string, target: string): void;
    node(id: string): NodeWithPosition;
    nodes(): string[];
    edges(): Array<{ v: string; w: string }>;
    graph(): GraphLabel;
  }

  export const graphlib: {
    Graph: new () => Graph;
  };

  export function layout(graph: Graph): void;

  const dagre: {
    graphlib: typeof graphlib;
    layout: typeof layout;
  };

  export default dagre;
}
