import * as NodePair from "./node-pair";
import * as NodeSel from "./node-selector";

import type { EntryNode } from "./entry-node";
import type { ExitNode } from "./exit-node";

describe("test node selector", function () {
  it("selects none if no information is given", function () {
    const xn = genExitNode("x");
    const en = genEntryNode("e", [xn.id]);
    const np = NodePair.create(en, [xn], 0, () => {});
    const nodePairs = new Map([[NodePair.id(np), np]]);
    const res = NodeSel.routePair(nodePairs);
    expect(res).toMatchObject({ success: false, error: "none available" });
  });

  it("selects quickest ping if no other information is given", function () {
    const xn1 = genExitNode("x1");
    const xn2 = genExitNode("x2");
    const en1 = genEntryNode("e1", [xn1.id]);
    const en2 = genEntryNode("e2", [xn2.id]);
    const np1 = NodePair.create(en1, [xn1], 0, () => {});
    const np2 = NodePair.create(en2, [xn2], 0, () => {});
    np1.entryData.pingDuration = 20;
    np2.entryData.pingDuration = 10;
    const nodePairs = new Map([
      [NodePair.id(np1), np1],
      [NodePair.id(np2), np2],
    ]);
    const res = NodeSel.routePair(nodePairs);
    expect(res).toMatchObject({
      success: true,
      entryNode: en2,
      exitNode: xn2,
      via: "quickest ping",
    });
  });
});

function genEntryNode(id: string, recommendedExits: string[]): EntryNode {
  return {
    apiEndpoint: new URL("http://url.url"),
    accessToken: "",
    id,
    recommendedExits,
  };
}

function genExitNode(id: string): ExitNode {
  return {
    id,
    pubKey: "",
  };
}
