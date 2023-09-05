import * as NodePair from "./node-pair";
import * as NodeSel from "./node-selector";

import type { EntryNode } from "./entry-node";
import type { ExitNode } from "./exit-node";

describe("test node selector", function () {
  it("selects none if no information is given", function () {
    const entryNode = genEntryNode("e1");
    const exitNode = genExitNode("x1");
    entryNode.recommendedExits.push(exitNode.id);
    const np = NodePair.create(entryNode, [exitNode], 0, () => {});
    const nodePairs = new Map([[NodePair.id(np), np]]);
    const res = NodeSel.routePair(nodePairs);
    expect(res).toMatchObject({ success: false, error: "none available" });
  });
});

function genEntryNode(id: string): EntryNode {
  return {
    apiEndpoint: new URL("http://url.url"),
    accessToken: "",
    id,
    recommendedExits: [],
  };
}

function genExitNode(id: string): ExitNode {
  return {
    id,
    pubKey: "",
  };
}
