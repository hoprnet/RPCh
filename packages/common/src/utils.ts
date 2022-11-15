import Debug, { type Debugger } from "debug";
import { utils } from "ethers";

/**
 * Maximum bytes we should be sending
 * within the HOPR network.
 */
export const MAX_BYTES = 400;

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
