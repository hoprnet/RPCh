import { getOption } from "./optionBuilder.js";
import { JsonRpcMethodCounters, buildWallet, instantiateCounters } from "./requestBuilder.js";
import { OptionTypes, WalletTypes } from "./types.js";

// get values from env
const url = __ENV.RPC_SERVER_URL;
const testType = __ENV.TEST_TYPE as OptionTypes;
const walletType = __ENV.WALLET_TYPE as WalletTypes; 

// get the test option
export const options = getOption(testType);

// create metrics counter
const counters: JsonRpcMethodCounters = instantiateCounters();

// Simulated user behavior
export default function(): void {
  const wallet = buildWallet(walletType, url);
  wallet.sendRpcCalls(counters);
  // const [url, body, params] = getRequest(requestType, count);
  // const res = http.post(url, body, params);

  // // Validate response status
  // check(res, {
  //   "status was 200": (r) => r.status == 200,
  //   "verify resp": (r) =>
  //     typeof r.body == "string" &&
  //     r.body.includes("jsonrpc") &&
  //     !r.body.includes("error"),
  // });
}
