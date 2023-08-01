import { WebSocket } from "isomorphic-ws";
import { shortPeerId } from "./utils";
/**
 * Performance and reliability parameters.
 * These parameters are subject to change and we need to find the best possible combinations.
 *
 * latencyThresholdEntry - when a request took longer than this, mark the entry node with a latency violation
 * latencyThresholdExit - when a request took longer than this, mark the exit node with a latency violation
 * latencyViolationsThresholdEntry - amount of violations allowed before outphasing that entry node
 * latencyViolationsThresholdExit - amount of violations allowed before outphasing that exit node
 * requestThresholdEntry - amount of handled request before outphasing that entry node
 * requestThresholdExit - amount of handled request before outphasing that exit node
 * failedRequestThresholdEntry - amount of allowed failing requests before outphasing entry node
 * failedRequestThresholdExit - amount of allowed failing requests before outphasing exit node
 */
const latencyThresholdEntry = 10e3;
const latencyThresholdExit = 10e3;
const latencyViolationsThresholdEntry = 2;
const latencyViolationsThresholdExit = 2;
const requestThresholdEntry = 100;
const requestThresholdExit = 10;
const failedRequestThresholdEntry = 1;
const failedRequestThresholdExit = 1;

export type Nodes = {
  entryNodes: Map<string, EntryNode>; // peerId -> EntryNode
  exitNodes: Map<string, ExitNode>; // peerId -> ExitNode
  outphasingEntries: Set<string>; // no longer eligable entry nodes
  outphasingExits: Set<string>; // no longer eligable exit nodes
  entryDatas: Map<string, EntryData>; // entry node peerId -> entry node data
  exitDatas: Map<string, ExitData>; // exit node peerId -> exit node data
};

export type Command =
  | { readonly cmd: "needEntryNode"; excludeIds: string[] }
  | { readonly cmd: "needExitNode" }
  | { readonly cmd: "openWebSocket"; entryNode: EntryNode }
  | { readonly cmd: "stateError"; info: string }
  | { readonly cmd: "" };

export type Pair = { entryNode: EntryNode; exitNode: ExitNode };
export type PairIds = { entryId: string; exitId: string };

export type EntryNode = {
  apiEndpoint: URL;
  accessToken: string;
  peerId: string;
  recommendedExits: Set<string>;
};

export type ExitNode = {
  peerId: string;
  pubKey: string;
};

type EntryData = {
  failedRequests: number;
  latencyViolations: number;
  ongoingRequests: number;
  webSocket?: WebSocket;
};

type ExitData = {
  failedRequests: number;
  latencyViolations: number;
  ongoingRequests: number;
};

export function init(): Nodes {
  return {
    entryNodes: new Map(),
    exitNodes: new Map(),
    outphasingEntries: new Set(),
    outphasingExits: new Set(),
    entryDatas: new Map(),
    exitDatas: new Map(),
  };
}

/**
 * ready state is achieved when we have at least one entry and one exit node.
 * no websocket connection in this state
 */
export function reachReady(nodes: Nodes): Command {
  // check if we have valid entry nodes
  const entryNodes = Array.from(nodes.entryNodes.values()).filter(
    ({ peerId }) => !nodes.outphasingEntries.has(peerId)
  );
  if (entryNodes.length === 0) {
    const excludeIds = Array.from(nodes.entryNodes.keys());
    return { cmd: "needEntryNode", excludeIds };
  }

  // check if we have valid exit nodes
  const exitNodes = Array.from(nodes.exitNodes.values()).filter(
    ({ peerId }) => !nodes.outphasingExits.has(peerId)
  );
  if (exitNodes.length === 0) {
    return { cmd: "needExitNode" };
  }

  return { cmd: "" };
}

/**
 * node pair can be returned as soon as we have a valid entry / exit node with a connected entry node websocket.
 */
export function reachNodePair(nodes: Nodes): Command & { nodePair?: Pair } {
  // check if we have valid entry nodes
  const entryNodes = Array.from(nodes.entryNodes.values()).filter(
    ({ peerId }) => !nodes.outphasingEntries.has(peerId)
  );
  if (entryNodes.length === 0) {
    const excludeIds = Array.from(nodes.entryNodes.keys());
    return { cmd: "needEntryNode", excludeIds };
  }

  // check if we have valid exit nodes
  const exitNodes = Array.from(nodes.exitNodes.values()).filter(
    ({ peerId }) => !nodes.outphasingExits.has(peerId)
  );
  if (exitNodes.length === 0) {
    return { cmd: "needExitNode" };
  }

  // check if we have an open websocket entry node
  const openNodes = entryNodes.filter(
    ({ peerId }) =>
      nodes.entryDatas.get(peerId)!.webSocket?.readyState === WebSocket.OPEN
  );
  if (openNodes.length === 0) {
    // check if we have connecting websocket entry node
    const connNodes = entryNodes.filter(
      ({ peerId }) =>
        nodes.entryDatas.get(peerId)!.webSocket?.readyState ===
        WebSocket.CONNECTING
    );
    if (connNodes.length === 0) {
      // no connecting webSocket and no open nodes
      const entryNode = randomEl(entryNodes);
      return { cmd: "openWebSocket", entryNode };
    }
    // wait for connecting webSocket
    return { cmd: "" };
  }

  // choose entry node and prepare exit nodes selection
  const entryNode = randomEl(openNodes);
  // remove entry node from exit nodes
  const availableExitNodes = exitNodes.filter(
    ({ peerId }) => entryNode.peerId !== peerId
  );
  // check if we can need more exits
  if (availableExitNodes.length === 0) {
    return { cmd: "needExitNode" };
  }

  // prioritize recommended exit nodes
  const recExits = availableExitNodes.filter(({ peerId }) =>
    entryNode.recommendedExits.has(peerId)
  );
  if (recExits.length > 0) {
    const exitNode = randomEl(recExits);
    return { cmd: "", nodePair: { entryNode, exitNode } };
  }
  const exitNode = randomEl(availableExitNodes);
  return { cmd: "", nodePair: { entryNode, exitNode } };
}

export function newEntryNode(nodes: Nodes, entryNode: EntryNode) {
  if (!nodes.entryNodes.has(entryNode.peerId)) {
    nodes.entryNodes.set(entryNode.peerId, entryNode);
    nodes.entryDatas.set(entryNode.peerId, {
      failedRequests: 0,
      latencyViolations: 0,
      ongoingRequests: 0,
    });
  }
}

export function addExitNodes(nodes: Nodes, exitNodes: ExitNode[]) {
  exitNodes.forEach((exitNode) => {
    if (!nodes.exitNodes.has(exitNode.peerId)) {
      nodes.exitNodes.set(exitNode.peerId, exitNode);
      nodes.exitDatas.set(exitNode.peerId, {
        failedRequests: 0,
        latencyViolations: 0,
        ongoingRequests: 0,
      });
    }
  });
}

export function requestStarted(
  nodes: Nodes,
  { entryId, exitId }: PairIds,
  _requestId: number
): Command {
  const entryData = nodes.entryDatas.get(entryId);
  if (!entryData) {
    return { cmd: "stateError", info: "no entryData" };
  }
  const exitData = nodes.exitDatas.get(exitId);
  if (!exitData) {
    return { cmd: "stateError", info: "no exitData" };
  }
  entryData.ongoingRequests++;
  exitData.ongoingRequests++;
  if (entryData.ongoingRequests > requestThresholdEntry) {
    nodes.outphasingEntries.add(entryId);
  }
  if (exitData.ongoingRequests > requestThresholdExit) {
    nodes.outphasingExits.add(exitId);
  }
  return reachReady(nodes);
}

export function requestSucceeded(
  nodes: Nodes,
  { entryId, exitId }: PairIds,
  _requestId: number,
  responseTime: number
): Command {
  const entryData = nodes.entryDatas.get(entryId);
  if (!entryData) {
    return { cmd: "stateError", info: "no entryData" };
  }
  const exitData = nodes.exitDatas.get(exitId);
  if (!exitData) {
    return { cmd: "stateError", info: "no exitData" };
  }
  entryData.ongoingRequests--;
  exitData.ongoingRequests--;
  if (responseTime > latencyThresholdEntry) {
    entryData.latencyViolations++;
    if (entryData.latencyViolations > latencyViolationsThresholdEntry) {
      nodes.outphasingEntries.add(entryId);
    }
  }
  if (responseTime > latencyThresholdExit) {
    exitData.latencyViolations++;
    if (exitData.latencyViolations > latencyViolationsThresholdExit) {
      nodes.outphasingExits.add(exitId);
    }
  }
  postRequest(nodes, { entryId, entryData, exitId, exitData });
  return reachReady(nodes);
}

export function requestFailed(
  nodes: Nodes,
  { entryId, exitId }: PairIds,
  _requestId: number
): Command {
  const entryData = nodes.entryDatas.get(entryId);
  if (!entryData) {
    return { cmd: "stateError", info: "no entryData" };
  }
  const exitData = nodes.exitDatas.get(exitId);
  if (!exitData) {
    return { cmd: "stateError", info: "no exitData" };
  }
  entryData.ongoingRequests--;
  exitData.ongoingRequests--;
  entryData.failedRequests++;
  if (entryData.failedRequests > failedRequestThresholdEntry) {
    nodes.outphasingEntries.add(entryId);
  }
  exitData.failedRequests++;
  if (exitData.failedRequests > failedRequestThresholdExit) {
    nodes.outphasingExits.add(exitId);
  }
  postRequest(nodes, { entryId, entryData, exitId, exitData });
  return reachReady(nodes);
}

function postRequest(
  nodes: Nodes,
  {
    entryId,
    entryData,
    exitId,
    exitData,
  }: {
    entryId: string;
    entryData: EntryData;
    exitId: string;
    exitData: ExitData;
  }
) {
  // close websocket if possible
  if (entryData.ongoingRequests === 0) {
    entryData.webSocket?.close();

    // check if outphasing entry node
    if (nodes.outphasingEntries.has(entryId)) {
      nodes.outphasingEntries.delete(entryId);
      nodes.entryNodes.delete(entryId);
      nodes.entryDatas.delete(entryId);
    }
  }

  // check if outphasing exit node
  if (exitData.ongoingRequests === 0 && nodes.outphasingExits.has(exitId)) {
    nodes.outphasingExits.delete(exitId);
    nodes.exitNodes.delete(exitId);
    nodes.exitDatas.delete(exitId);
  }
}

export function addWebSocket(
  nodes: Nodes,
  entryNode: EntryNode,
  socket: WebSocket
) {
  const entryData = nodes.entryDatas.get(entryNode.peerId);
  if (entryData) {
    entryData.webSocket = socket;
  }
}

export function stop(nodes: Nodes) {
  for (const entryData of nodes.entryDatas.values()) {
    entryData.webSocket?.close();
  }
}

export function prettyPrint(nodes: Nodes) {
  const entryNodes = `en:${
    nodes.entryNodes.size - nodes.outphasingEntries.size
  }/${nodes.entryNodes.size}`;
  const exitNodes = `ex:${nodes.exitNodes.size - nodes.outphasingExits.size}/${
    nodes.exitNodes.size
  }`;
  const dataEntries = Array.from(nodes.entryDatas.entries())
    .map(
      ([id, ed]) =>
        `en${shortPeerId(id)}:${ed.ongoingRequests}/${ed.failedRequests}r,${
          ed.latencyViolations
        }l,${ed.webSocket?.readyState}`
    )
    .join(";");
  const dataExits = Array.from(nodes.exitDatas.entries())
    .map(
      ([id, ed]) =>
        `ex${shortPeerId(id)}:${ed.ongoingRequests}/${ed.failedRequests}r,${
          ed.latencyViolations
        }l`
    )
    .join(";");
  return [entryNodes, exitNodes, dataEntries, dataExits].join("-");
}

function randomEl<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
