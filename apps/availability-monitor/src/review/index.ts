import type { RegisteredNode } from "../db";
import { createLogger } from "../utils";
import { HoprSDK, api } from "@hoprnet/hopr-sdk";
import { type CheckResult, createCheck } from "./check";
import measureAveragePingToAll from "./ping";
import { MIN_AMOUNT_PEERS, MIN_AMOUNT_CHANNELS } from "../constants";

const log = createLogger(["review"]);

/** Return type of sdk.api.channels.getChannels() */
type Channel = Awaited<ReturnType<(typeof api)["getChannels"]>>["outgoing"][0];

/** Checks made by interacting with the HOPRd node */
const checks = {
  hoprdVersion: createCheck<string, [HoprSDK]>(
    "hoprd-version",
    async function checkHoprdVersion(sdk) {
      const version = await sdk.api.node.getVersion();
      if (typeof version !== "string")
        throw Error(`received version '${version}' is not a string`);
      return [true, version];
    }
  ),
  hoprdHealth: createCheck<string, [HoprSDK]>(
    "hoprd-health",
    async function checkHoprdHealth(sdk) {
      const info = await sdk.api.node.getInfo();
      if (!info) throw Error("did not receive info");
      const isOk = ["green", "yellow"].some(
        (status) => info.connectivityStatus.toLowerCase() === status
      );
      return [isOk, info.connectivityStatus];
    }
  ),
  hoprdSSL: createCheck<boolean, [string, string]>(
    "hoprd-ssl",
    async function checkHoprdSSL(apiEndpoint, apiToken) {
      const isDefaultApiEndpointProtected =
        new URL(apiEndpoint).protocol === "https:";
      if (isDefaultApiEndpointProtected) return [true, true];

      const protectedUrl = new URL(apiEndpoint);
      protectedUrl.protocol = "https:";

      const protectedSdk = new HoprSDK({
        apiEndpoint: protectedUrl.toString(),
        apiToken,
        timeout: 1000,
      });

      const version = await protectedSdk.api.node.getVersion();
      if (typeof version !== "string") return [false, false];
      return [true, true];
    }
  ),
  hoprdSendMessage: createCheck<string, [HoprSDK]>(
    "hoprd-send-message",
    async function checkHoprdSendMessage(sdk) {
      const peers = await sdk.api.node.getPeers({});
      if (!peers || !peers.connected || peers.connected.length === 0) {
        throw Error("Not enough peers found to send messages");
      }

      // get 5 highest quality nodes
      const highestQuality = peers.connected
        .sort((a, b) => {
          return b.quality - a.quality;
        })
        .slice(0, 5);

      const results = await Promise.all(
        highestQuality.map((peer) => {
          return sdk.api.messages.sendMessage({
            recipient: peer.peerId,
            body: "automatic: availability monitor check",
            path: [], // direct path
          });
        })
      );

      return [true, results.join(",")];
    }
  ),
  hoprdPeers: createCheck<number, [HoprSDK, number]>(
    "hoprd-peers",
    async function checkHoprdPeers(sdk, minAmountOfPeers) {
      const peers = await sdk.api.node.getPeers({
        quality: 0.8,
      });

      return [
        peers.connected.length >= minAmountOfPeers,
        peers.connected.length,
      ];
    }
  ),
  hoprdOpenOutgoingChannels: createCheck<Channel[], [HoprSDK, number]>(
    "hoprd-open-outgoing-channels",
    async function checkHoprdOpenChannels(sdk, minChannels) {
      const channels = await sdk.api.channels.getChannels();
      const outgoing = channels.outgoing.filter((c) => c.status === "Open");

      return [outgoing.length >= minChannels, outgoing];
    }
  ),
};

/** List of all checks in a review. */
export const listOfChecks = [
  "hoprdVersion",
  "hoprdHealth",
  "hoprdSSL",
  "hoprdSendMessage",
  "hoprdPeers",
  "hoprdOpenOutgoingChannels",
] as const;

/**
 * A stability review of the node once it has
 * performed all checks.
 */
export type StabilityReview = {
  [key in (typeof listOfChecks)[number]]: CheckResult<any>;
};

/**
 * Ping results for a node's outgoing channels
 * AND given the SAME list of outgoing channels,
 * the ping results of the exit nodes towards them.
 */
export type ConnectivityReview = {
  outgoingChannels: { [outgoingChannelPeerId: string]: number };
  exitNodesToOutgoingChannels: {
    [exitNodePeerId: string]: {
      [outgoingChannelPeerId: string]: number;
    };
  };
};

/**
 * The final result after a review.
 */
export type Result = {
  stabilityReview: StabilityReview;
  connectivityReview: ConnectivityReview;
  reviewedAt: string;
  isStable: boolean;
  deliveryOdds: number;
};

/**
 * Perform various checks on the node.
 * @param node
 * @returns the result
 */
export default async function review({
  node,
  exitNodes,
}: {
  node: RegisteredNode;
  exitNodes: RegisteredNode[];
}): Promise<Result> {
  log.verbose("Review on", node.peerId, "is running");

  const sdk = new HoprSDK({
    apiEndpoint: node.hoprdApiEndpoint,
    apiToken: node.hoprdApiToken,
    timeout: 1000,
  });

  const [
    hoprdVersion,
    hoprdHealth,
    hoprdSSL,
    hoprdSendMessage,
    hoprdPeers,
    hoprdOpenOutgoingChannels,
  ] = await Promise.all([
    checks.hoprdVersion.run(sdk),
    checks.hoprdHealth.run(sdk),
    checks.hoprdSSL.run(node.hoprdApiEndpoint, node.hoprdApiToken),
    checks.hoprdSendMessage.run(sdk),
    checks.hoprdPeers.run(sdk, MIN_AMOUNT_PEERS),
    checks.hoprdOpenOutgoingChannels.run(sdk, MIN_AMOUNT_CHANNELS),
  ]);

  const stabilityReview: StabilityReview = {
    hoprdVersion,
    hoprdHealth,
    hoprdSSL,
    hoprdSendMessage,
    hoprdPeers,
    hoprdOpenOutgoingChannels,
  };
  const isStable = isNodeStable(node, stabilityReview);

  // only continue with ConnectivityReview if node is stable
  let connectivityReview: ConnectivityReview = {
    outgoingChannels: {},
    exitNodesToOutgoingChannels: {},
  };
  const outgoingChannels: Channel[] = hoprdOpenOutgoingChannels.value || [];
  if (isStable) {
    // measure pings from OUR node towards all outgoing channels
    connectivityReview.outgoingChannels = await measureAveragePingToAll(
      sdk,
      node,
      outgoingChannels.map((c) => c.peerId)
    );

    // for each exit node, measure ping towards outgoing channels
    const exitNodeResults = await Promise.all(
      exitNodes.map((exitNode) => {
        const tempSdk = new HoprSDK({
          apiEndpoint: exitNode.hoprdApiEndpoint,
          apiToken: exitNode.hoprdApiToken,
          timeout: 1000,
        });
        return measureAveragePingToAll(
          tempSdk,
          exitNode,
          // remove exit node if it happens to be an outgoing channel
          outgoingChannels
            .filter((c) => c.peerId !== exitNode.peerId)
            .map((c) => c.peerId)
        ).then((pings) => ({
          exitNode,
          pings,
        }));
      })
    );
    for (const result of exitNodeResults) {
      connectivityReview.exitNodesToOutgoingChannels[result.exitNode.peerId] =
        result.pings;
    }
  }

  const result: Result = {
    stabilityReview,
    connectivityReview,
    reviewedAt: new Date().toUTCString(),
    isStable: isNodeStable(node, stabilityReview),
    deliveryOdds: measureOddsOfDelivery(outgoingChannels, connectivityReview),
  };

  log.verbose(
    "Review on %s completed, node is %s with %i delivery score",
    node.peerId,
    result.isStable ? "stable" : "unstable",
    result.deliveryOdds
  );

  return result;
}

/**
 * Given the node and it's review, return `true`
 * if the node is stable.
 * @param node
 * @param review
 * @returns `true` if the node is stable
 */
export function isNodeStable(
  _node: RegisteredNode,
  review: StabilityReview
): boolean {
  // required elements, all must be true
  if (
    [
      review.hoprdVersion.passed,
      review.hoprdHealth.passed,
      review.hoprdSendMessage,
      review.hoprdPeers,
      review.hoprdOpenOutgoingChannels,
    ].some((b) => !b)
  ) {
    return false;
  }

  return true;
}

/**
 * Measures the delivery odds of a node.
 * It filters out outgoing channels which we cannot ping,
 * afterwards, given the list of good outgoing channels,
 * which look for at least ONE exit node which can ping them.
 * We then divide the good outgoing channels with the total outgoing channels.
 * @param outgoingChannels
 * @param review
 * @returns delivery score
 */
export function measureOddsOfDelivery(
  outgoingChannels: Channel[],
  review: ConnectivityReview
): number {
  // reduce to a list of outgoing channels which are confirmed to have
  // connectivity between them, the HOP, and the exit node
  const goodOutgoingChannels = Object.entries(review.outgoingChannels)
    // filter out outgoing channels with bad ping
    .filter(([, ping]) => ping > 0)
    // filter out outgoing channels where no exit node can ping them
    .filter(([peerId]) => {
      for (const [, exitNodePings] of Object.entries(
        review.exitNodesToOutgoingChannels
      )) {
        if (exitNodePings[peerId] > 0) {
          return true;
        }
      }
      return false;
    });

  if (goodOutgoingChannels.length === 0) return 0;
  return goodOutgoingChannels.length / outgoingChannels.length;
}
