import assert from 'assert';
import RPChSDK, { type Ops } from '@rpch/sdk';
import { RPChProvider } from '../../../examples/ethers/build/index';

const SECRET = 'foobarfoobar';
const PROVIDER_URL = 'https://gnosis-provider.rpch.tech';
const DISCOVERY_PLATFORM_API_ENDPOINT = 'http://localhost:3020';

jest.setTimeout(1e3 * 60 * 1); // one minute

const ops: Ops = {
    discoveryPlatformEndpoint: DISCOVERY_PLATFORM_API_ENDPOINT,
    provider: PROVIDER_URL,
    forceZeroHop: true,
};

describe('ethers-integration tests', function () {
    let sdk: any, provider: any;

    beforeAll(() => {
        sdk = new RPChSDK(SECRET, ops);
        provider = new RPChProvider(DISCOVERY_PLATFORM_API_ENDPOINT, sdk);
        return sdk.isReady();
    }, 30_000);

    afterAll(() => {
        sdk.destruct();
        // wait for close events to happen
        return new Promise((resolve) => setTimeout(resolve, 1_000));
    });

    it('should get block number from default online PRCh provider', async function () {
        const blockNumberString = await provider.send('eth_blockNumber', []);
        const blockNumber = BigInt(blockNumberString);
        assert.equal(typeof blockNumber, 'bigint');
    });

    it('should get chain id from default online PRCh provider', async function () {
        const chainId = await provider.send('eth_chainId', []);
        assert.equal(chainId, '0x64');
    });
});
