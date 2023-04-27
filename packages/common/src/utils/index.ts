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
 * 1st place in the array is the number of added strings to the array (we do not count 1st number)
 * @param parts
 * @returns body
 */
export const joinPartsToBody = (parts: string[]): string => {
  const toJoin = [parts.length, ...parts];
  const joined = toJoin.join(SEPERATOR);
  return joined;
};

/**
 * Given a body, split it using SEPERATOR.
 * @param body
 * @returns parts of the body
 */
export const splitBodyToParts = (body: string): string[] => {
  if (!body.includes("|")) {
    return [body];
  }
  const numberOfParts = parseInt(body.split("|")[0]);
  let array = [];
  let splitIndex = body.indexOf("|");
  body = body.substring(splitIndex + 1);
  for (let i = 1; i < numberOfParts; i++) {
    splitIndex = body.indexOf("|");
    const part = body.substring(0, splitIndex);
    array.push(part);
    body = body.substring(splitIndex + 1);
  }
  array.push(body);
  return array;
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

/**
 * Function to replace a character in a string with another character or string
 */
export const replaceInStringAt = (
  string: string,
  index: number,
  replacement: string
): string => {
  return (
    string.substring(0, index) +
    replacement +
    string.substring(index + replacement.length)
  );
};

/**
 * Function to check if variable is an array
 */
export const isArray = (input: any): boolean => {
  return Array.isArray(input);
};

/**
 * Function to check if variable is a json object
 */
export const isJsonObject = (input: any): boolean => {
  return input.constructor == Object;
};

/**
 * Function to check if variable is an array of json objects
 */
export const isArrayOfJsonObjects = (input: any): boolean => {
  const isArrayBool = isArray(input);
  if (!isArrayBool) return false;
  if (input.length === 0) return false;

  for (let i = 0; i < input.length; i++) {
    const isJsonObjectBool = isJsonObject(input[i]);
    if (!isJsonObjectBool) return false;
  }

  return true;
};

/**
 * Function to check if variable is an array and has at least one json object
 */
export const isArrayWithAtLeastOneJsonObject = (input: any): boolean => {
  const isArrayBool = isArray(input);
  if (!isArrayBool) return false;
  if (input.length === 0) return false;

  for (let i = 0; i < input.length; i++) {
    const isJsonObjectBool = isJsonObject(input[i]);
    if (isJsonObjectBool) return true;
  }

  return false;
};

/**
 * Function to check if variable is an array of json objectsobject
 */
export const findCommonElement = (
  array1: string[],
  array2: string[]
): boolean => {
  // Loop for array1
  for (let i = 0; i < array1.length; i++) {
    // Loop for array2
    for (let j = 0; j < array2.length; j++) {
      // Compare the element of each and
      // every element from both of the
      // arrays
      if (array1[i] === array2[j]) {
        // Return if common element found
        return true;
      }
    }
  }

  // Return if no common element exist
  return false;
};

/**
 * Function to check if input is a stringified JSON
 */
export const isStringifiedJSON = (input: any): Boolean => {
  let result = false;
  try {
    if (typeof input === "string") {
      JSON.parse(input);
      result = true;
    }
  } catch (e) {
    // It's all good man!
  }
  return result;
};
