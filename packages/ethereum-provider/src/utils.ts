import { type Response, utils } from "@rpch/common";

/**
 * The logger instance to print out logs relevant to this `ethers` package.
 */
export const createLogger = utils.LoggerFactory("ethers");

/**
 * Parses the response body of an RPC response and returns a plain JavaScript object.
 * @param res - The RPC response object.
 * @returns A plain JavaScript object with the parsed response body.
 * @throws An error if the response body cannot be parsed.
 */
export const parseResponse = (res: Response): Record<any, any> => {
  if (!res.body) throw Error(`Response's body is not parsable '${res.body}'`);
  return JSON.parse(res.body);
};

/**
 * Extracts the result from an RPC response payload or throws an error if the payload contains an error.
 * @param payload - The RPC response payload.
 * @returns The result of the RPC call.
 * @throws An error if the RPC response contains an error.
 */
export const getResult = (payload: {
  error?: { code?: number; data?: any; message?: string };
  result?: any;
}): any => {
  if (payload.error) {
    // @TODO: not any
    const error: any = new Error(payload.error.message);
    error.code = payload.error.code;
    error.data = payload.error.data;
    throw error;
  }

  return payload.result;
};
