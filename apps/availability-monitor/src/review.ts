import type { RegisteredNode } from "./db";
import retry from "async-retry";
import { createLogger } from "./utils";
import { HoprSdk } from "../../../hopr-sdk/dist";

const log = createLogger(["reviewer"]);

/**
 * A review of the node once it has
 * performed all checks.
 */
export type Review = {
  hoprdVersion?: string;
  hoprdHealthGood: boolean;
  // hoprdOutgoingChannels: { amount: number };
  hoprdWorkingApiEndpoint: boolean;
  hoprdWorkingProtectedApiEndpoint: boolean;
  hoprdMessageDelivery: boolean;
  exitNodeGotResponse: boolean;
};

/**
 * The result after a node has been reviewed.
 */
export type Result = RegisteredNode &
  Review & {
    stable: boolean;
  };

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
      review.hoprdHealthGood,
      review.hoprdWorkingApiEndpoint,
      review.hoprdMessageDelivery,
    ].some((b) => !b)
  ) {
    return false;
  }

  // required elements when `hasExitNode`, all must be true
  if (node.hasExitNode) {
    if ([review.exitNodeGotResponse].some((b) => !b)) {
      return false;
    }
  }

  // @TODO: add hoprdOutgoingChannels

  return true;
}

/**
 * Wraps a function with retry.
 * @param fn
 * @returns a promise which resolves to the response of the function
 */
export async function WrapWithRetry<T>(fn: retry.RetryFunction<T>): Promise<T> {
  return retry(fn, {
    retries: 3,
    minTimeout: 500,
    maxTimeout: 500,
    maxRetryTime: 2e3,
  });
}

/**
 * Perform various checks on the node.
 * @param node
 * @returns the result
 */
export default async function review(node: RegisteredNode): Promise<Result> {
  try {
    const defaultApiEndpoint = node.hoprdApiEndpoint;
    const isDefaultApiEndpointProtected =
      new URL(defaultApiEndpoint).protocol === "https:";

    const sdk = new HoprSdk({
      url: node.hoprdApiEndpoint,
      apiToken: node.hoprdApiToken,
    });

    const [hoprdVersion, hoprdHealthGood, hoprdWorkingProtectedApiEndpoint] =
      await Promise.all([
        // get HOPRd version
        WrapWithRetry(async function getHoprdVersion() {
          const version = await sdk.api.node.getVersion();
          if (typeof version !== "string")
            throw Error(`received version '${version}' is not a string`);
          return version;
        }).catch((error) => {
          log.verbose("Error while trying to get HOPRd version", error);
          return undefined;
        }),
        // get HOPRd health status
        WrapWithRetry(async function getHoprdHealthGood() {
          const info = await sdk.api.node.getInfo();
          if (info?.connectivityStatus !== "green")
            throw Error(
              `received connectivityStatus '${info?.connectivityStatus}' is 'green'`
            );
          return true;
        }).catch((error) => {
          log.verbose("Error while trying to get HOPRd health status", error);
          return false;
        }),
        // get if HOPRd has protected API endpoint
        WrapWithRetry(async function getHoprdWorkingProtectedApiEndpoint() {
          if (isDefaultApiEndpointProtected) return true;

          const protectedUrl = new URL(defaultApiEndpoint);
          protectedUrl.protocol = "https:";

          const protectedSdk = new HoprSdk({
            url: protectedUrl.toString(),
            apiToken: node.hoprdApiToken,
          });

          const version = await protectedSdk.api.node.getVersion();
          if (typeof version !== "string")
            throw Error(
              `received version '${version}' via SSL is not a string`
            );
          return true;
        }).catch((error) => {
          log.verbose("Error while trying to check for SSL support", error);
          return false;
        }),
      ]);

    const review: Review = {
      hoprdVersion,
      hoprdHealthGood,
      hoprdWorkingApiEndpoint: !!hoprdVersion && !!hoprdHealthGood,
      hoprdWorkingProtectedApiEndpoint,
      hoprdMessageDelivery: true, // @TODO: check
      exitNodeGotResponse: true, // @TODO: check
    };

    return {
      ...node,
      ...review,
      stable: isNodeStable(node, review),
    };
  } catch (error) {
    log.verbose("Unexpected error when reviewing node", node, error);
    return {
      ...node,
      hoprdVersion: undefined,
      hoprdHealthGood: false,
      hoprdWorkingApiEndpoint: false,
      hoprdWorkingProtectedApiEndpoint: false,
      hoprdMessageDelivery: false,
      exitNodeGotResponse: false,
      stable: false,
    };
  }
}
