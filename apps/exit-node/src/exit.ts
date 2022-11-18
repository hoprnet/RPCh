/**
 * Responsible for creating external requests.
 */
import fetch from "node-fetch";
import { utils } from "rpch-commons";
const {createLogger} = utils;

const {log, logVerbose} = createLogger("exit")

/**
 * Creates a request to the given provider and returns response.
 * @param body to send to provider
 * @param provider exiting provider (infure, etc)
 * @returns response from provider
 */
export const sendRequest = async (
  body: string,
  provider: string
): Promise<string> => {

  log("sending request to provider");
  logVerbose("sending request to provider", body, provider);
  return fetch(provider, {
    method: "POST",
    body: body,
  }).then(async (res) => {
    const response = await res.text();
    logVerbose("response from provider", res.status, response);
    return response;
  });
};
