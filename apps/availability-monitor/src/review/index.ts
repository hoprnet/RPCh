import type { RegisteredNode } from "../db";
import { createLogger } from "../utils";
import { HoprSDK } from "@hoprnet/hopr-sdk";
import { type CheckResult, createCheck } from "./check";

const log = createLogger(["review"]);

/** Checks made by interacting with the HOPRd node */
const checks = {
  hoprdVersion: createCheck<string, [HoprSDK]>(
    "hoprd-version",
    false,
    async function checkHoprVersion(sdk) {
      const version = await sdk.api.node.getVersion();
      if (typeof version !== "string")
        throw Error(`received version '${version}' is not a string`);
      return [true, version];
    }
  ),
  hoprdHealth: createCheck<string, [HoprSDK]>(
    "hoprd-health",
    false,
    async function checkHoprdHealth(sdk) {
      const info = await sdk.api.node.getInfo();
      if (!info) throw Error("did not receive info");
      const isOk = ["Green", "Orange"].some(
        (status) => info.connectivityStatus === status
      );
      return [isOk, info.connectivityStatus];
    }
  ),
  hoprdSSL: createCheck<boolean, [apiEndpoint: string, apiToken: string]>(
    "hoprd-ssl",
    true,
    async function checkHoprdSSL(apiEndpoint, apiToken) {
      const isDefaultApiEndpointProtected =
        new URL(apiEndpoint).protocol === "https:";
      if (isDefaultApiEndpointProtected) return [true, true];

      const protectedUrl = new URL(apiEndpoint);
      protectedUrl.protocol = "https:";

      const protectedSdk = new HoprSDK({
        apiEndpoint: protectedUrl.toString(),
        apiToken,
      });

      const version = await protectedSdk.api.node.getVersion();
      if (typeof version !== "string") return [false, false];
      return [true, true];
    }
  ),
};

/** List of all checks in a review. */
export const listOfChecks = [
  "hoprdVersion",
  "hoprdHealth",
  "hoprdWorkingApiEndpoint",
  "hoprdSSL",
] as const;

/**
 * A review of the node once it has
 * performed all checks.
 */
export type Review = {
  [key in (typeof listOfChecks)[number]]: CheckResult<any>;
};

/**
 * The final result after a review.
 */
export type Result = Review & {
  isStable: boolean;
};

/**
 * Perform various checks on the node.
 * @param node
 * @returns the result
 */
export default async function review(node: RegisteredNode): Promise<Result> {
  log.verbose("Review on", node.peerId, "is running");

  const sdk = new HoprSDK({
    apiEndpoint: node.hoprdApiEndpoint,
    apiToken: node.hoprdApiToken,
  });

  const [hoprdVersion, hoprdHealth, hoprdSSL] = await Promise.all([
    checks.hoprdVersion.run(sdk),
    checks.hoprdHealth.run(sdk),
    checks.hoprdSSL.run(node.hoprdApiEndpoint, node.hoprdApiToken),
  ]);

  const review: Review = {
    hoprdVersion,
    hoprdHealth,
    hoprdWorkingApiEndpoint: {
      checkId: "hoprd-working-api-endpoint",
      passed: !!hoprdVersion && !!hoprdHealth,
      value: `hoprdVersion=${hoprdVersion},hoprdHealth=${hoprdHealth}`,
    },
    hoprdSSL,
  };

  const result: Result = {
    ...review,
    isStable: isNodeStable(node, review),
  };

  log.verbose(
    "Review on",
    node.peerId,
    "completed",
    "node is",
    result.isStable ? "stable" : "unstable"
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
export function isNodeStable(node: RegisteredNode, review: Review): boolean {
  // required elements, all must be true
  if (
    [
      review.hoprdHealth.passed,
      review.hoprdWorkingApiEndpoint.passed,
      // review.hoprdMessageDelivery,
    ].some((b) => !b)
  ) {
    return false;
  }

  // required elements when `hasExitNode`, all must be true
  // if (node.hasExitNode) {
  //   if ([review.exitNodeGotResponse].some((b) => !b)) {
  //     return false;
  //   }
  // }

  // @TODO: add hoprdOutgoingChannels

  return true;
}
