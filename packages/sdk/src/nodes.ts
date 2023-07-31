import type { WebSocketHelper, onEventParameterType } from "@rpch/common";
// these parameters are subject to change and we need to find the best possible combinations
const latencyThreshold = 5e3;
const latencyViolationsThreshold = 2;
const requestThreshold = 5;

export type Nodes = {
  entryNodes: Map<string, EntryNode>; // peerId -> EntryNode
  exitNodes: Map<string, ExitNode>; // peerId -> ExitNode
  outphasing: Set<string>; // no longer eligable entry nodes
};

export type Command =
  | { readonly cmd: "needEntryNode"; excludeIds: string[] }
  | { readonly cmd: "needExitNode" }
  | { readonly cmd: "openWebSocket"; entryNode: EntryNode }
  | { readonly cmd: "" };

export type Pair = { entryNode: EntryNode; exitNode: ExitNode };
export type PairIds = { entryId: string; exitId: string };

export type EntryNode = {
  apiEndpoint: URL;
  accessToken: string;
  latencyViolations: number;
  ongoingRequests: number;
  peerId: string;
  recommendedExits: Set<string>;
  wsState: WSstate;
  wsConn?: WebSocketHelper;
};

export type ExitNode = {
  ongoingRequests: number;
  peerId: string;
  pubKey: string;
};

export enum WSstate {
  Disconnected,
  Connecting,
  Open,
  Error,
  Disconnecting,
}

export function init(): Nodes {
  return {
    entryNodes: new Map(),
    exitNodes: new Map(),
    outphasing: new Set(),
  };
}

/**
 * ready state is achieved when we have at least one entry and one exit node.
 * no websocket connection in this state
 */
export function reachReady(nodes: Nodes): Command {
  // check entry nodes
  if (nodes.entryNodes.size === 0) {
    return { cmd: "needEntryNode", excludeIds: [] };
  }

  // check exit nodes
  if (nodes.exitNodes.size === 0) {
    return { cmd: "needExitNode" };
  }

  // check if we have valid entry nodes
  const entryNodes = Array.from(nodes.entryNodes.values()).filter(
    ({ peerId }) => !nodes.outphasing.has(peerId)
  );
  if (entryNodes.length === 0) {
    const excludeIds = Array.from(nodes.entryNodes.keys());
    return { cmd: "needEntryNode", excludeIds };
  }

  return { cmd: "" };
}

/**
 * node pair can be returned as soon as we have a valid entry / exit node with a connected entry node websocket.
 */
export function reachNodePair(nodes: Nodes): Command & { nodePair?: Pair } {
  // check entry nodes
  if (nodes.entryNodes.size === 0) {
    return { cmd: "needEntryNode", excludeIds: [] };
  }

  // check exit nodes
  if (nodes.exitNodes.size === 0) {
    return { cmd: "needExitNode" };
  }

  // check if we have valid entry nodes
  const entryNodes = Array.from(nodes.entryNodes.values()).filter(
    ({ peerId }) => !nodes.outphasing.has(peerId)
  );
  if (entryNodes.length === 0) {
    const excludeIds = Array.from(nodes.entryNodes.keys());
    return { cmd: "needEntryNode", excludeIds: excludeIds };
  }

  // check if we have an open websocket entry node
  const openNodes = entryNodes.filter(({ wsState }) => wsState == WSstate.Open);
  if (openNodes.length === 0) {
    // check if we have connecting websocket entry node
    const connNodes = entryNodes.filter(
      ({ wsState }) => wsState == WSstate.Connecting
    );
    if (connNodes.length === 0) {
      // no connecting webSocket and no open nodes
      const entryNode = randomEl(entryNodes);
      return { cmd: "openWebSocket", entryNode };
    }
    // wait for connecting webSocket
    return { cmd: "" };
  }

  // prioritize recommendedExits
  const entryNode = randomEl(openNodes);
  const exitNodes = Array.from(nodes.exitNodes.values());
  const recExits = exitNodes.filter(({ peerId }) =>
    entryNode.recommendedExits.has(peerId)
  );
  if (recExits.length > 0) {
    const exitNode = randomEl(recExits);
    return { cmd: "", nodePair: { entryNode, exitNode } };
  }
  const exitNode = randomEl(exitNodes);
  return { cmd: "", nodePair: { entryNode, exitNode } };
}

export function newEntryNode(nodes: Nodes, entryNode: EntryNode) {
  nodes.entryNodes.set(entryNode.peerId, entryNode);
}

export function addExitNodes(nodes: Nodes, exitNodes: ExitNode[]) {
  exitNodes.forEach((exitNode) =>
    nodes.exitNodes.set(exitNode.peerId, exitNode)
  );
}

export function onWSevt(
  nodes: Nodes,
  entryNode: EntryNode,
  evt: onEventParameterType
) {
  console.log("onWSevt", evt);
  switch (evt.action) {
    case "open":
      entryNode.wsState = WSstate.Open;
      break;
    case "close":
      entryNode.wsState = WSstate.Disconnected;
      break;
    case "error":
      entryNode.wsState = WSstate.Error;
      break;
  }
}

export function addWSconn(
  nodes: Nodes,
  entryNode: EntryNode,
  wsConn: WebSocketHelper
) {
  entryNode.wsConn = wsConn;
}

export function requestStarted(
  nodes: Nodes,
  { entryId, exitId }: PairIds,
  _requestId: number
): Command {
  const entryNode = nodes.entryNodes.get(entryId)!;
  const exitNode = nodes.exitNodes.get(exitId)!;
  entryNode.ongoingRequests++;
  exitNode.ongoingRequests++;
  if (entryNode.ongoingRequests > requestThreshold) {
    nodes.outphasing.add(entryNode.peerId);
  }
  return reachReady(nodes);
}

export function requestSucceeded(
  nodes: Nodes,
  { entryId, exitId }: PairIds,
  _requestId: number,
  responseTime: number
): Command {
  const entryNode = nodes.entryNodes.get(entryId)!;
  const exitNode = nodes.exitNodes.get(exitId)!;
  if (responseTime > latencyThreshold) {
    entryNode.latencyViolations++;
    if (entryNode.latencyViolations > latencyViolationsThreshold) {
      nodes.outphasing.add(entryNode.peerId);
    }
  }
  postRequest(nodes, { entryNode, exitNode });
  return reachReady(nodes);
}

export function requestFailed(
  nodes: Nodes,
  { entryId, exitId }: PairIds,
  _requestId: number
): Command {
  const entryNode = nodes.entryNodes.get(entryId)!;
  const exitNode = nodes.exitNodes.get(exitId)!;
  nodes.outphasing.add(entryNode.peerId);
  postRequest(nodes, { entryNode, exitNode });
  return reachReady(nodes);
}

function postRequest(nodes: Nodes, { entryNode, exitNode }: Pair) {
  entryNode.ongoingRequests--;
  exitNode.ongoingRequests--;

  // close websocket if possible
  if (entryNode.ongoingRequests === 0) {
    entryNode.wsState = WSstate.Disconnecting;
    entryNode.wsConn?.close();

    // check if outphasing entry node
    if (nodes.outphasing.has(entryNode.peerId)) {
      nodes.outphasing.delete(entryNode.peerId);
      nodes.entryNodes.delete(entryNode.peerId);
      // see if we can opportunistically remove exit node
      if (exitNode.ongoingRequests === 0) {
        nodes.exitNodes.delete(exitNode.peerId);
      }
    }
  }
}

export function stop(nodes: Nodes) {
  for (const entryNode of nodes.entryNodes.values()) {
    entryNode.wsConn?.close();
  }
}

function randomEl<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
