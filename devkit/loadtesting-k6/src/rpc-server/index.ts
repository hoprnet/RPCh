import { getOption } from './utils/test-option.js';
import { instantiatePayloadCounters } from './utils/rpc-payload.js';
import { OptionTypes, WalletTypes } from './types.js';
import { JsonRpcMethodCounters } from './wallet/mock-wallet.js';
import { buildWallet } from './wallet/index.js';

// get values from env
const url = __ENV.RPC_SERVER_URL || 'http://localhost:45750';
const testType = __ENV.TEST_TYPE || 'SMOKE';
const walletType = __ENV.WALLET_TYPE || 'METAMASK';

// get the test option
console.log(`Starting TestType '${testType}' for wallet type '${walletType}' against '${url}'`);
export const options = getOption(testType as OptionTypes);

// create metrics counter
const counters: JsonRpcMethodCounters = instantiatePayloadCounters();

// Simulated user behavior
export default function (): void {
    const wallet = buildWallet(walletType as WalletTypes, url);
    wallet.sendRpcCalls(counters);
}
