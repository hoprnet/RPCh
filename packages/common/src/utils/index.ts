import type Segment from "../segment";
import { utils } from "ethers";
import LoggerFactory from "./logger";

export { default as LoggerFactory } from "./logger";
export const createLogger = LoggerFactory("common");

/**
 * Maximum bytes we should be sending
 * within the HOPR network.
 */
export const MAX_BYTES = 400;

/**
 * Split string such that its byte representation does not
 * exceed maxBytes
 * @param str
 * @param maxBytes
 * @returns splitted string
 */
export const splitStrByBytes = (str: string, maxBytes: number): string[] => {
  const res: string[] = [];

  let offset = 0;
  let current = ''

  for (let utf8char of str) {
    if (offset + utf8char.length > maxBytes) {
      res.push(current)
      offset = 0
      current = ''
    }

    offset += utf8char.length
    current += utf8char
  }

  if (current.length > 0) {
    res.push(current)
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
 * Pseudo generate random numbers giving a maximum
 * @disclaimer Not suitable for crypto.
 * @param maximum maximum number that the random number can be
 * @returns a number from 0 to maximum number
 */
export const generatePseudoRandomId = (maximum: number) => {
  return Math.floor(Math.random() * maximum);
};

/**
 * Choose pseudo random element from an array
 * @disclaimer Not suitable for crypto.
 * @param arr array to choose random element
 * @returns element from array
 */
export const randomlySelectFromArray = <T>(arr: T[]): T => {
  if (!Array.isArray(arr) || !arr.length)
    throw new Error("Can not select randomly from array with no content");
  return arr[Math.floor(Math.random() * arr.length)];
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

/**
 * Function to convert bigint values to string when doing JSON.stringify
 */
export const bigIntReplacer = (key: any, value: any) =>
  typeof value === "bigint" ? value.toString() : value;
