import type { NextFunction, Request, Response } from "express";
import type { Histogram } from "prom-client";
import type { RegisteredNodeDB, RegisteredNode } from "./db";
import { utils } from "@rpch/common";

/** Generic logger for this project */
export const createLogger = utils.LoggerFactory("availability-monitor");

/** Transform a DB node object to a normalized node objected */
export function fromDbNode(node: RegisteredNodeDB): RegisteredNode {
  return {
    hasExitNode: node.has_exit_node,
    peerId: node.id,
    chainId: node.chain_id,
    hoprdApiEndpoint: node.hoprd_api_endpoint,
    hoprdApiToken: node.hoprd_api_token,
    exitNodePubKey: node.exit_node_pub_key,
    nativeAddress: node.native_address,
  };
}

/** middleware that will track duration of an express request */
export const metricMiddleware =
  (histogramMetric: Histogram<string>) =>
  (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime();
    res.on("finish", () => {
      const end = process.hrtime(start);
      const durationSeconds = end[0] + end[1] / 1e9;
      const statusCode = res.statusCode.toString();
      const method = req.method;
      const path = req.path;

      histogramMetric.labels(method, path, statusCode).observe(durationSeconds);
    });
    next();
  };

/**
 * Wrap a promise with a timeout,
 * if timeout is reached, promise is discarded.
 * @param prom promise to be wrapped
 * @param time miliseconds
 * @returns
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeout: number
): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    fn(),
    // reject after timeout
    new Promise(
      (_r, rej) => (timer = setTimeout(() => rej("check timeout"), timeout))
    ),
  ])
    .then((res) => res as T)
    .finally(() => clearTimeout(timer));
}
