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

export enum CommandLabel {
  NeedEntryNode,
  NeedExitNode,
  OpenWebSocket,
  CloseWebSocket,
  None,
}

export type Command =
  | { label: CommandLabel.NeedEntryNode; excludeIds: string[] }
  | { label: CommandLabel.NeedExitNode }
  | { label: CommandLabel.OpenWebSocket; entryNode: EntryNode }
  | { label: CommandLabel.CloseWebSocket; entryNode: EntryNode }
  | { label: CommandLabel.None };

export type Pair = { entryNode: EntryNode; exitNode: ExitNode };

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

enum WSstate {
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
    return { label: CommandLabel.NeedEntryNode, excludeIds: [] };
  }

  // check exit nodes
  if (nodes.exitNodes.size === 0) {
    return { label: CommandLabel.NeedExitNode };
  }

  // check if we have valid entry nodes
  const entryNodes = Array.from(nodes.entryNodes.values()).filter(
    ({ peerId }) => !nodes.outphasing.has(peerId)
  );
  if (entryNodes.length === 0) {
    const excludeIds = Array.from(nodes.entryNodes.keys());
    return { label: CommandLabel.NeedEntryNode, excludeIds: excludeIds };
  }

  return { label: CommandLabel.None };
}

/**
 * node pair can be returned as soon as we have a valid entry / exit node with a connected entry node websocket.
 */
export function reachNodePair(nodes: Nodes): { cmd: Command; nodePair?: Pair } {
  // check entry nodes
  if (nodes.entryNodes.size === 0) {
    return { cmd: { label: CommandLabel.NeedEntryNode, excludeIds: [] } };
  }

  // check exit nodes
  if (nodes.exitNodes.size === 0) {
    return { cmd: { label: CommandLabel.NeedExitNode } };
  }

  // check if we have valid entry nodes
  const entryNodes = Array.from(nodes.entryNodes.values()).filter(
    ({ peerId }) => !nodes.outphasing.has(peerId)
  );
  if (entryNodes.length === 0) {
    const excludeIds = Array.from(nodes.entryNodes.keys());
    return {
      cmd: { label: CommandLabel.NeedEntryNode, excludeIds: excludeIds },
    };
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
      return { cmd: { label: CommandLabel.OpenWebSocket, entryNode } };
    }
    // wait for connecting webSocket
    return { cmd: { label: CommandLabel.None } };
  }

  // prioritize recommendedExits
  const entryNode = randomEl(openNodes);
  const exitNodes = Array.from(nodes.exitNodes.values());
  const recExits = exitNodes.filter(({ peerId }) =>
    entryNode.recommendedExits.has(peerId)
  );
  if (recExits.length > 0) {
    const exitNode = randomEl(recExits);
    return {
      cmd: { label: CommandLabel.None },
      nodePair: { entryNode, exitNode },
    };
  }
  const exitNode = randomEl(exitNodes);
  return {
    cmd: { label: CommandLabel.None },
    nodePair: { entryNode, exitNode },
  };
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
  { entryNode, exitNode }: Pair,
  _requestId: number
): Command {
  entryNode.ongoingRequests++;
  exitNode.ongoingRequests++;
  if (entryNode.ongoingRequests > requestThreshold) {
    nodes.outphasing.add(entryNode.peerId);
  }
  return reachReady(nodes);
}

export function requestSucceeded(
  nodes: Nodes,
  pair: Pair,
  _requestId: number,
  responseTime: number
): Command {
  if (responseTime > latencyThreshold) {
    pair.entryNode.latencyViolations++;
    if (pair.entryNode.latencyViolations > latencyViolationsThreshold) {
      nodes.outphasing.add(pair.entryNode.peerId);
    }
  }
  postRequest(nodes, pair);
  return reachReady(nodes);
}

export function requestFailed(
  nodes: Nodes,
  pair: Pair,
  _requestId: number
): Command {
  nodes.outphasing.add(pair.entryNode.peerId);
  postRequest(nodes, pair);
  return reachReady(nodes);
}

function postRequest(nodes: Nodes, { entryNode, exitNode }: Pair) {
  entryNode.ongoingRequests--;
  exitNode.ongoingRequests--;

  // close websocket if possible
  if (entryNode.ongoingRequests === 0) {
    entryNode.wsState = WSstate.Disconnecting;
    entryNode.wsConn.close();

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

function randomEl<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
