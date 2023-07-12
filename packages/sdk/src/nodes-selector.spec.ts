import selectNodes from "./nodes-selector";

describe("test nodes-selector", function () {
  it("selects correct node pair in 1.Pass", function () {
    const entryNodes = new Map(
      ["entry1", "entry2", "entry3"].map((id) => [id, entryNode(id)])
    );
    const exitNodes = new Map(
      ["exit1", "exit2", "exit3"].map((id) => [id, exitNode(id)])
    );
    const reliabilities = new Map([
      [
        "entry1",
        {
          onlineHistory: [{ date: 0, online: true }],
          exitNodesHistory: new Map([["exit1", [1]]]),
          requestHistory: new Map([
            [
              1,
              {
                started: 0,
                ended: 0,
                success: true,
                exitId: "exit1",
                requestId: 1,
              },
            ],
          ]),
        },
      ],
      [
        "entry2",
        {
          onlineHistory: [{ date: 0, online: true }],
          exitNodesHistory: new Map([["exit2", [2]]]),
          requestHistory: new Map([
            [
              2,
              {
                started: 0,
                success: false,
                exitId: "exit2",
                requestId: 2,
              },
            ],
          ]),
        },
      ],
      [
        "entry3",
        {
          onlineHistory: [],
          exitNodesHistory: new Map([["exit3", [3]]]),
          requestHistory: new Map([
            [
              3,
              {
                started: 0,
                ended: 0,
                success: true,
                exitId: "exit3",
                requestId: 3,
              },
            ],
          ]),
        },
      ],
    ]);

    const res = selectNodes(entryNodes, exitNodes, reliabilities);
    switch (res.res) {
      case "ok":
        expect(res.entryNode).toMatchObject(entryNode("entry1"));
        expect(res.exitNode).toMatchObject(exitNode("exit1"));
        break;
      case "error":
        throw new Error(res.reason);
        break;
    }
  });

  it("selects correct node pair in 2.Pass", function () {
    const entryNodes = new Map(
      ["entry1", "entry2", "entry3"].map((id) => [id, entryNode(id)])
    );
    const exitNodes = new Map(
      ["exit1", "exit2", "exit3"].map((id) => [id, exitNode(id)])
    );
    const reliabilities = new Map([
      [
        "entry1",
        {
          onlineHistory: [{ date: 0, online: true }],
          exitNodesHistory: new Map([1, 2, 3].map((id) => [`exit${id}`, [id]])),
          requestHistory: new Map([
            [
              1,
              {
                started: 0,
                ended: 0,
                success: false,
                exitId: "exit1",
                requestId: 1,
              },
            ],
            [
              2,
              {
                started: 0,
                ended: 0,
                success: false,
                exitId: "exit2",
                requestId: 2,
              },
            ],
            [
              3,
              {
                started: 0,
                ended: 0,
                success: false,
                exitId: "exit3",
                requestId: 3,
              },
            ],
          ]),
        },
      ],
      [
        "entry2",
        {
          onlineHistory: [{ date: 0, online: true }],
          exitNodesHistory: new Map([["exit2", [2]]]),
          requestHistory: new Map([
            [
              2,
              {
                started: 0,
                success: false,
                exitId: "exit2",
                requestId: 2,
              },
            ],
          ]),
        },
      ],
      [
        "entry3",
        {
          onlineHistory: [],
          exitNodesHistory: new Map([["exit3", [3]]]),
          requestHistory: new Map([
            [
              3,
              {
                started: 0,
                ended: 0,
                success: true,
                exitId: "exit3",
                requestId: 3,
              },
            ],
          ]),
        },
      ],
    ]);

    const res = selectNodes(entryNodes, exitNodes, reliabilities);
    switch (res.res) {
      case "ok":
        expect(res.entryNode).toMatchObject(entryNode("entry2"));
        expect(res.exitNode.peerId).toMatch(/^exit1|exit3$/);
        break;
      case "error":
        throw new Error(res.reason);
        break;
    }
  });

  it("fails selecting node pair", function () {
    const entryNodes = new Map(
      ["entry1", "entry2", "entry3"].map((id) => [id, entryNode(id)])
    );
    const exitNodes = new Map(
      ["exit1", "exit2", "exit3"].map((id) => [id, exitNode(id)])
    );
    const reliabilities = new Map([
      [
        "entry1",
        {
          onlineHistory: [{ date: 0, online: true }],
          exitNodesHistory: new Map([1, 2, 3].map((id) => [`exit${id}`, [id]])),
          requestHistory: new Map([
            [
              1,
              {
                started: 0,
                ended: 0,
                success: false,
                exitId: "exit1",
                requestId: 1,
              },
            ],
            [
              2,
              {
                started: 0,
                ended: 0,
                success: false,
                exitId: "exit2",
                requestId: 2,
              },
            ],
            [
              3,
              {
                started: 0,
                ended: 0,
                success: false,
                exitId: "exit3",
                requestId: 3,
              },
            ],
          ]),
        },
      ],
      [
        "entry2",
        {
          onlineHistory: [{ date: 0, online: true }],
          exitNodesHistory: new Map([1, 2, 3].map((id) => [`exit${id}`, [id]])),
          requestHistory: new Map([
            [
              1,
              {
                started: 0,
                success: false,
                exitId: "exit1",
                requestId: 1,
              },
            ],
            [
              2,
              {
                started: 0,
                success: false,
                exitId: "exit2",
                requestId: 2,
              },
            ],
            [
              3,
              {
                started: 0,
                success: false,
                exitId: "exit3",
                requestId: 3,
              },
            ],
          ]),
        },
      ],
      [
        "entry3",
        {
          onlineHistory: [],
          exitNodesHistory: new Map([["exit3", [3]]]),
          requestHistory: new Map([
            [
              3,
              {
                started: 0,
                ended: 0,
                success: true,
                exitId: "exit3",
                requestId: 3,
              },
            ],
          ]),
        },
      ],
    ]);

    const res = selectNodes(entryNodes, exitNodes, reliabilities);
    switch (res.res) {
      case "ok":
        throw new Error("should fail");
        break;
      case "error":
        expect(res.reason).toBe("no reliable idle entry - exit pair found");
        break;
    }
  });
});

function entryNode(id: string) {
  return {
    apiEndpoint: new URL(`http://${id}`),
    apiToken: "",
    peerId: id,
    connection: null,
    recommendedExitNodes: [],
  };
}

function exitNode(id: string) {
  return { peerId: id, pubKey: "" };
}
