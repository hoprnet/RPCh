import assert from 'assert';
import RPChSDK, { type Ops } from '@rpch/sdk';

const SECRET = 'foobarfoobar';
const PROVIDER_URL = 'https://gnosis-provider.rpch.tech';
const DISCOVERY_PLATFORM_API_ENDPOINT = 'http://localhost:3020';

jest.setTimeout(1e3 * 60 * 1); // one minute

describe('rpch-sdk-one-hop tests', function () {
    let sdk: any;

    beforeAll(() => {
        sdk = setupSDK();
        return sdk.isReady();
    }, 30_000);

    afterAll(() => {
        sdk.destruct();
        // wait for close events to happen
        return new Promise((resolve) => setTimeout(resolve, 1_000));
    });

    it('should get block number from default online PRCh provider', async function () {
        const response = await sdk.send(
            {
                method: 'eth_blockNumber',
                params: [],
                jsonrpc: '2.0',
            },
            {
                provider: PROVIDER_URL,
            },
        );
        const json = await response.json();
        const blockNumber = BigInt(json.result);
        assert.equal(typeof blockNumber, 'bigint');
    });

    it('should get chain id from default online PRCh provider', async function () {
        const response = await sdk.send(
            {
                method: 'eth_chainId',
                params: [],
                jsonrpc: '2.0',
            },
            {
                provider: PROVIDER_URL,
            },
        );
        const json = await response.json();
        const chainId = json.result;
        assert.equal(chainId, '0x64');
    });
});

function setupSDK() {
    const ops: Ops = {
        discoveryPlatformEndpoint: DISCOVERY_PLATFORM_API_ENDPOINT,
    };
    return new RPChSDK(SECRET, ops);
}
