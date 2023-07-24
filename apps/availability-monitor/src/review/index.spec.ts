import assert from "assert";
import { checks, isNodeStable } from ".";
import { NODE_A as NODE } from "../fixtures";

// /** Mock HOPRd's API endpoints */
// function mockHOPRdSDK(
//   hoprdApiEndpoint: string,
//   ops: {
//     failingVersion?: boolean;
//     badHealth?: boolean;
//     workingSSL?: boolean;
//   } = {
//     failingVersion: false,
//     badHealth: false,
//     workingSSL: false,
//   }
// ) {
//   if (ops.workingSSL) {
//     hoprdApiEndpoint = hoprdApiEndpoint.replace("http://", "https://");
//   }

//   if (ops.failingVersion) {
//     nock(hoprdApiEndpoint).get(`/api/v2/node/version`).reply(500);
//   } else {
//     nock(hoprdApiEndpoint).get(`/api/v2/node/version`).reply(200, "1.83.5");
//   }

//   nock(hoprdApiEndpoint)
//     .get(`/api/v2/node/info`)
//     .reply(200, {
//       environment: "anvil-localhost",
//       announcedAddress: [
//         "/ip4/128.0.215.32/tcp/9080/p2p/16Uiu2HAm91QFjPepnwjuZWzK5pb5ZS8z8qxQRfKZJNXjkgGNUAit",
//         "/p2p/16Uiu2HAmLpqczAGfgmJchVgVk233rmB2T3DSn2gPG6JMa5brEHZ1/p2p-circuit/p2p/16Uiu2HAm91QFjPepnwjuZWzK5pb5ZS8z8qxQRfKZJNXjkgGNUAit",
//         "/ip4/127.0.0.1/tcp/9080/p2p/16Uiu2HAm91QFjPepnwjuZWzK5pb5ZS8z8qxQRfKZJNXjkgGNUAit",
//         "/ip4/192.168.178.56/tcp/9080/p2p/16Uiu2HAm91QFjPepnwjuZWzK5pb5ZS8z8qxQRfKZJNXjkgGNUAit",
//       ],
//       listeningAddress: [
//         "/ip4/0.0.0.0/tcp/9080/p2p/16Uiu2HAm91QFjPepnwjuZWzK5pb5ZS8z8qxQRfKZJNXjkgGNUAit",
//       ],
//       network: "anvil",
//       hoprToken: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
//       hoprChannels: "0x2a54194c8fe0e3CdeAa39c49B95495aA3b44Db63",
//       hoprNetworkRegistryAddress: "0xBEE1F5d64b562715E749771408d06D57EE0892A7",
//       connectivityStatus: ops.badHealth ? "orange" : "green",
//       isEligible: true,
//       channelClosurePeriod: 1,
//     });
// }

describe("test hoprdVersion check", function () {
  it("should pass", async function () {
    const sdk: any = {
      api: {
        node: {
          getVersion: () => Promise.resolve("1.0.0"),
        },
      },
    };
    const result = await checks.hoprdVersion.run(sdk);
    assert(result.passed);
    assert.equal(result.value, "1.0.0");
  });

  it("should not pass when SDK throws", async function () {
    const sdk: any = {
      api: {
        node: {
          getVersion: () => Promise.reject(Error("fake error")),
        },
      },
    };
    const result = await checks.hoprdVersion.run(sdk);
    assert(!result.passed);
    assert.equal(result.error, "fake error");
  });
});

describe("test hoprdHealth check", function () {
  it("should pass", async function () {
    const sdk: any = {
      api: {
        node: {
          getInfo: () => Promise.resolve({ connectivityStatus: "green" }),
        },
      },
    };
    const result = await checks.hoprdHealth.run(sdk);
    assert(result.passed);
    assert.equal(result.value, "green");
  });

  it("should not pass when status is red", async function () {
    const sdk: any = {
      api: {
        node: {
          getInfo: () => Promise.resolve({ connectivityStatus: "red" }),
        },
      },
    };
    const result = await checks.hoprdHealth.run(sdk);
    assert(!result.passed);
    assert.equal(result.value, "red");
  });

  it("should not pass when SDK throws", async function () {
    const sdk: any = {
      api: {
        node: {
          getInfo: () => Promise.reject(Error("fake error")),
        },
      },
    };
    const result = await checks.hoprdHealth.run(sdk);
    assert(!result.passed);
    assert.equal(result.error, "fake error");
  });
});

describe("test hoprdSSL check", function () {
  it("should pass", async function () {
    const result = await checks.hoprdSSL.run(
      "https://hoprd_api_endpoint",
      "token"
    );
    assert(result.passed);
    assert.equal(result.value, true);
  });

  it("should not pass", async function () {
    const result = await checks.hoprdSSL.run(
      "http://hoprd_api_endpoint",
      "token"
    );
    assert(!result.passed);
    assert(result.error!.includes("reason: getaddrinfo"));
  });
});

describe("test hoprdSendMessage check", function () {
  it("should pass", async function () {
    const sdk: any = {
      api: {
        node: {
          getPeers: () =>
            Promise.resolve({
              connected: [
                {
                  peerId: "peer_3",
                  quality: 0.85,
                },
                {
                  peerId: "peer_2",
                  quality: 0.9,
                },
                {
                  peerId: "peer_1",
                  quality: 1,
                },
              ],
            }),
        },
        messages: {
          sendMessage: ({ recipient }: { recipient: string }) =>
            Promise.resolve(recipient),
        },
      },
    };
    const result = await checks.hoprdSendMessage.run(sdk);
    assert(result.passed);
    assert.equal(result.value, "peer_1,peer_2,peer_3");
  });

  it("should not pass when peers are too low", async function () {
    const sdk: any = {
      api: {
        node: {
          getPeers: () => Promise.resolve({ connected: [] }),
        },
      },
    };
    const result = await checks.hoprdSendMessage.run(sdk);
    assert(!result.passed);
    assert.equal(result.error, "Not enough peers found to send messages");
  });
});

describe("test hoprdPeers check", function () {
  it("should pass", async function () {
    const sdk: any = {
      api: {
        node: {
          getPeers: () => Promise.resolve({ connected: ["peer_1"] }),
        },
      },
    };
    const result = await checks.hoprdPeers.run(sdk, 1);
    assert(result.passed);
    assert.equal(result.value, 1);
  });

  it("should not pass when peers are too low", async function () {
    const sdk: any = {
      api: {
        node: {
          getPeers: () => Promise.resolve({ connected: [] }),
        },
      },
    };
    const result = await checks.hoprdPeers.run(sdk, 1);
    assert(!result.passed);
    assert.equal(result.value, 0);
  });

  it("should not pass when SDK throws", async function () {
    const sdk: any = {
      api: {
        node: {
          getPeers: () => Promise.reject(Error("fake error")),
        },
      },
    };
    const result = await checks.hoprdPeers.run(sdk, 1);
    assert(!result.passed);
    assert.equal(result.error, "fake error");
  });
});

describe("test hoprdOpenOutgoingChannels check", function () {
  it("should pass", async function () {
    const sdk: any = {
      api: {
        channels: {
          getChannels: () =>
            Promise.resolve({ outgoing: [{ status: "Open" }] }),
        },
      },
    };
    const result = await checks.hoprdOpenOutgoingChannels.run(sdk, 1);
    assert(result.passed);
    assert.deepEqual(result.value, [{ status: "Open" }]);
  });

  it("should not pass when peers are too low", async function () {
    const sdk: any = {
      api: {
        channels: {
          getChannels: () => Promise.resolve({ outgoing: [] }),
        },
      },
    };
    const result = await checks.hoprdOpenOutgoingChannels.run(sdk, 1);
    assert(!result.passed);
    assert.deepEqual(result.value, []);
  });

  it("should not pass when SDK throws", async function () {
    const sdk: any = {
      api: {
        channels: {
          getChannels: () => Promise.reject(Error("fake error")),
        },
      },
    };
    const result = await checks.hoprdOpenOutgoingChannels.run(sdk, 1);
    assert(!result.passed);
    assert.equal(result.error, "fake error");
  });
});
