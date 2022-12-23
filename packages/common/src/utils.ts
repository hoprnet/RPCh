import type Segment from "./segment";
import Debug, { type Debugger } from "debug";
import { utils } from "ethers";

/**
 * Sugar fuction for creating consistent loggers.
 * @param args
 * @returns debug logger and error logger
 */
export const createLogger = (
  ...args: any[]
): {
  log: Debugger;
  logVerbose: Debugger;
  logError: Debugger;
} => {
  const log = Debug(["rpch", ...args].join(":"));
  const logVerbose = log.extend("verbose");
  const logError = log.extend("error");

  return {
    log,
    logVerbose,
    logError,
  };
};

/**
 * Maximum bytes we should be sending
 * within the HOPR network.
 */
export const MAX_BYTES = 400;

/**
 * Split string by bytes.
 * @param str
 * @param maxBytes
 * @returns splitted string
 */
export const splitStrByBytes = (str: string, maxBytes: number): string[] => {
  let arr = utils.toUtf8Bytes(str);
  const res: string[] = [];

  while (arr.length > 0) {
    const index = arr.length > maxBytes ? maxBytes : arr.length;
    res.push(utils.toUtf8String(arr.slice(0, index)));
    arr = arr.slice(index, arr.length);
  }

  return res;
};

/**
 * Pseudo generate random numbers, not used in
 * anything cryptographically important.
 * @disclaimer Not suitable for crypto.
 * @returns 6 digit number
 */
export const generateRandomNumber = (): number => {
  return Math.floor(Math.random() * 1e6);
};

/**
 * Check whether given time has expired.
 * @returns whether item has expired
 */
export const isExpired = (
  timeout: number,
  now: Date,
  createdAt: Date
): boolean => {
  return createdAt.valueOf() + timeout < now.valueOf();
};

/**
 * Derive the API url from given parameters.
 * @param protocol
 * @param apiEndpoint
 * @param path
 * @param apiToken
 * @returns URL in string
 */
export const createApiUrl = (
  protocol: "http" | "ws",
  apiEndpoint: string,
  path: string,
  apiToken?: string
): [string, any] => {
  const url = new URL(path, apiEndpoint);

  if (protocol === "ws") {
    url.protocol = url.protocol === "https:" ? "wss" : "ws";
  }
  if (apiToken) {
    url.search = `?apiToken=${apiToken}`;
  }

  let headers = {
    "Content-Type": "application/json",
    "Accept-Content": "application/json",
  } as any;
  if (apiToken) {
    headers["Authorization"] = "Basic " + btoa(apiToken);
  }

  return [url.toString(), headers];
};

/**
 * Attemps to decode a HOPRd body.
 * @param body
 * @returns decoded message
 */
export const decodeIncomingBody = (body: string): string => {
  try {
    return utils.toUtf8String(
      utils.RLP.decode(new Uint8Array(JSON.parse(`[${body}]`)))[0]
    );
  } catch {
    throw new Error("failed to decode body");
  }
};

/**
 * Seperator used to construct bodies
 * for Segment, Request, and Response.
 */
export const SEPERATOR = "|";

/**
 * Given some strings, join them using SEPERATOR.
 * @param parts
 * @returns body
 */
export const joinPartsToBody = (parts: string[]): string => {
  return parts.join(SEPERATOR);
};

/**
 * Given a body, split it using SEPERATOR.
 * @param body
 * @returns parts of the body
 */
export const splitBodyToParts = (body: string): string[] => {
  return body.split(SEPERATOR);
};

/**
 * Checks whether all given segments are present and can be
 * joined to create a message.
 * @param segments
 * @returns true if all segments are present
 */
export const areAllSegmentsPresent = (segments: Segment[]): boolean => {
  if (segments.length === 0) return false;
  const { segmentsLength } = segments[0];
  return segmentsLength === segments.length;
};
