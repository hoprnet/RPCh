import { HoprSDK } from "@hoprnet/hopr-sdk";
import { createLogger } from "../utils";

const log = createLogger(["review", "measureAveragePing"]);

/**
 * Measures the average ping towards a HOPRd node.
 * It will attempt to create five successful pings.
 * Will return `-1` if no ping was successful.
 * @param sdk
 * @param target HOPRd node we would like to ping
 * @returns the average ping
 */
export async function measureAveragePing(
  sdk: HoprSDK,
  target: string
): Promise<number> {
  const results: number[] = [];

  for (let i = 0; i < 5; i++) {
    let result: number = -1;
    try {
      result = await sdk.api.node
        .pingNode({
          peerId: target,
        })
        .then((obj) => obj.latency);
    } catch {}
    if (result > 0) results.push(result);
  }

  if (results.length === 0) return -1;
  return results.reduce((a, b) => a + b) / results.length;
}

/**
 * Measures the average pings towards a given list of HOPRd nodes.
 * @param sdk
 * @param nodePeerId HOPRd node we are interacting with
 * @param target HOPRd node we would like to ping
 * @returns a map with the average ping of each node
 */
export default async function measureAveragePingToAll(
  sdk: HoprSDK,
  node: { peerId: string },
  targets: string[]
): Promise<{
  [peerId: string]: number;
}> {
  if (targets.length === 0) {
    log.verbose("No target to measure pings for %s", node.peerId);
    return {};
  }
  log.verbose(
    "Measuring pings for %s to %i nodes",
    node.peerId,
    targets.length
  );

  const results: {
    [peerId: string]: number;
  } = {};

  const pings = await Promise.all(
    targets.map((peerId) =>
      measureAveragePing(sdk, peerId).then((averagePing) => ({
        target: peerId,
        averagePing,
      }))
    )
  );
  for (const { target, averagePing } of pings) {
    log.verbose(
      "Measured %i ms from %s to %s",
      averagePing,
      node.peerId,
      target
    );
    results[target] = averagePing;
  }

  return results;
}
