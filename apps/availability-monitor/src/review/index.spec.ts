import assert from "assert";
import nock from "nock";
import review from ".";
import { NODE_A as NODE } from "../fixtures";

/** Mock HOPRd's API endpoints */
function mockHoprdApi(
  hoprdApiEndpoint: string,
  ops: {
    failingVersion?: boolean;
    badHealth?: boolean;
    workingSSL?: boolean;
  } = {
    failingVersion: false,
    badHealth: false,
    workingSSL: false,
  }
) {
  if (ops.workingSSL) {
    hoprdApiEndpoint = hoprdApiEndpoint.replace("http://", "https://");
  }

  if (ops.failingVersion) {
    nock(hoprdApiEndpoint).get(`/api/v2/node/version`).reply(500);
  } else {
    nock(hoprdApiEndpoint).get(`/api/v2/node/version`).reply(200, "1.83.5");
  }

  nock(hoprdApiEndpoint)
    .get(`/api/v2/node/info`)
    .reply(200, {
      environment: "anvil-localhost",
      announcedAddress: [
        "/ip4/128.0.215.32/tcp/9080/p2p/16Uiu2HAm91QFjPepnwjuZWzK5pb5ZS8z8qxQRfKZJNXjkgGNUAit",
        "/p2p/16Uiu2HAmLpqczAGfgmJchVgVk233rmB2T3DSn2gPG6JMa5brEHZ1/p2p-circuit/p2p/16Uiu2HAm91QFjPepnwjuZWzK5pb5ZS8z8qxQRfKZJNXjkgGNUAit",
        "/ip4/127.0.0.1/tcp/9080/p2p/16Uiu2HAm91QFjPepnwjuZWzK5pb5ZS8z8qxQRfKZJNXjkgGNUAit",
        "/ip4/192.168.178.56/tcp/9080/p2p/16Uiu2HAm91QFjPepnwjuZWzK5pb5ZS8z8qxQRfKZJNXjkgGNUAit",
      ],
      listeningAddress: [
        "/ip4/0.0.0.0/tcp/9080/p2p/16Uiu2HAm91QFjPepnwjuZWzK5pb5ZS8z8qxQRfKZJNXjkgGNUAit",
      ],
      network: "anvil",
      hoprToken: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
      hoprChannels: "0x2a54194c8fe0e3CdeAa39c49B95495aA3b44Db63",
      hoprNetworkRegistryAddress: "0xBEE1F5d64b562715E749771408d06D57EE0892A7",
      connectivityStatus: ops.badHealth ? "orange" : "green",
      isEligible: true,
      channelClosurePeriod: 1,
    });
}

describe("test review", function () {
  beforeEach(function () {
    // reset nock before every test
    nock.cleanAll();
  });

  it("should review stable node as stable", async function () {
    mockHoprdApi(NODE.hoprdApiEndpoint);
    const result = await review(NODE);
    assert(result.isStable);
  });

  it("should review unstable node as unstable", async function () {
    mockHoprdApi(NODE.hoprdApiEndpoint, { badHealth: true });
    const result = await review(NODE);
    assert(!result.isStable);
  });

  it("should correctly identify failing checks", async function () {
    mockHoprdApi(NODE.hoprdApiEndpoint, {
      failingVersion: true,
      badHealth: true,
    });
    const result = await review(NODE);
    assert(!result.hoprdVersion.passed);
    assert(!result.hoprdHealth.passed);
    assert(!result.hoprdSSL.passed);
  });

  it("should correctly identify working SSL", async function () {
    mockHoprdApi(NODE.hoprdApiEndpoint, {
      workingSSL: true,
    });
    const result = await review(NODE);
    assert(result.hoprdSSL.passed);
  });
});
