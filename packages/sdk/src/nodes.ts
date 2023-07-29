// these parameters are subject to change and we need to find the best possible combinations
const latencyThreshold = 5e3;
const latencyViolationsThreshold = 2;
const requestThreshold = 5;

export enum WSState {
  Disconnected,
  Connecting,
  Open,
  Error,
  Disconnecting,
}

export type Nodes = {
  slidingWindow: 2; // current amount of kept nodes
  entryNodes: Map<string, EntryNode>; // peerId -> EntryNode
  exitNodes: Map<string, ExitNode>; // peerId -> ExitNode
  recommendedExits: Map<string, string[]>; // peerId(entryNode) -> peerIds(exitNodes)
  requestCounts: Map<string, number>; // peerId(entryNode) -> currently ongoing requests
  lastLatencies: Map<string, number[]>; // peerId(entryNode) -> last latency values (max latencyViolationsThreshold count)
  webSocketStates: Map<string, WSState>;
};

export type EntryNode = {
  apiEndpoint: URL;
  accessToken: string;
  peerId: string;
};

export type ExitNode = {
  peerId: string;
  pubKey: string;
};

export function init(): Nodes {
  return {
    slidingWindow: 2,
    entryNodes: new Map(),
    exitNodes: new Map(),
    requestCounts: new Map(),
    lastLatencies: new Map(),
    recommendedExits: new Map(),
    webSocketStates: new Map(),
  };
}

export function newEntryNode(nodes: Nodes, entryNode: EntryNode) {
  // do nothing if we already track that node
  if (nodes.entryNodes.has(entryNode.peerId)) {
    return;
  }
  const l = nodes.entryNodes.size;
  if (l < nodes.slidingWindow) {
    nodes.entryNodes.set(entryNode.peerId, entryNode);
    nodes.requestCounts.set(entryNode.peerId, 0);
    nodes.lastLatencies.set(entryNode.peerId, []);
    nodes.webSocketStates.set(entryNode.peerId, WSState.Disconnected);
  }
}

export function needsWebSocket(nodes: Nodes): EntryNode | null {
  // aim for one open webSocket connection
  const open = Array.from(nodes.webSocketStates.entries()).filter(
    ([_, state]) => state === WSState.Open || state === WSState.Connecting
  );
  if (open.length > 0) {
    return null;
  }
  const eligiable = Array.from(nodes.webSocketStates.entries()).filter(
    ([_, state]) => state === WSState.Disconnected
  );
  const el = randomEl(eligiable);
  if (el) {
    return nodes.entryNodes.get(el[0])!;
  }
  return null;
}

function randomEl<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
