import { getOption } from './utils/test-option.js';
import { instantiatePayloadCounters } from './utils/rpc-payload.js';
import { OptionTypes, WalletTypes } from './types.js';
import { JsonRpcMethodCounters } from './wallet/mock-wallet.js';
import { buildWallet } from './wallet/index.js';

// get values from env
const url = __ENV.RPC_SERVER_URL;
const testType = __ENV.TEST_TYPE as OptionTypes;
const walletType = __ENV.WALLET_TYPE as WalletTypes;

// get the test option
console.log(`Starting TestType '${testType}' for wallet type '${walletType}' against '${url}'`)
export const options = getOption(testType);

// create metrics counter
const counters: JsonRpcMethodCounters = instantiatePayloadCounters();

// Simulated user behavior
export default function (): void {
    const wallet = buildWallet(walletType, url);
    wallet.sendRpcCalls(counters);
}
