import { check } from 'k6';
import http from 'k6/http';
import { JsonRpcMethod, JsonRpcPayload } from '../types.js';
import { JsonRpcMethodCounters, MockWallet } from './mock-wallet.js';
import {
    getMethodFromPayload,
    getRandomPayloadFromDapp,
    getStandardPayload,
} from '../utils/rpc-payload.js';

export class MockOkxWallet extends MockWallet implements MockWallet {
    protected buildRequestBodies(): JsonRpcPayload[] {
        const requests = [];
        requests.push(getStandardPayload(JsonRpcMethod.GET_BLOCKNUMBER));

        // get balance for all the accounts, here we assume 10
        requests.push(...new Array(10).fill(getStandardPayload(JsonRpcMethod.GET_BALANCE)));

        // using some dapp randomly
        requests.push(...getRandomPayloadFromDapp());

        return requests;
    }

    public sendRpcCalls(counters: JsonRpcMethodCounters): void {
        for (let i = 0; i < this.bodies.length; i++) {
            const reqBody = getMethodFromPayload(this.bodies[i]);
            if (!reqBody) {
                console.log('Cannot find the method');
                return;
            }
            // update counter
            counters[reqBody].add(1);
            const res = http.post(this.url, JSON.stringify(this.bodies[i]), this.params);

            // Validate response status
            check(res, {
                'status was 200': (r) => r.status == 200,
                'verify resp': (r) =>
                    typeof r.body == 'string' &&
                    r.body.includes('jsonrpc') &&
                    !r.body.includes('error'),
            });

            this.sleep();
        }
    }
}
