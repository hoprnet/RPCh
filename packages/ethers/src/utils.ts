import { type Response, utils } from "rpch-common";

export const createLogger = utils.LoggerFactory("ethers");

export const parseResponse = (res: Response): Record<any, any> => {
  if (!res.body) throw Error(`Response's body is not parsable '${res.body}'`);
  return JSON.parse(res.body);
};

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
