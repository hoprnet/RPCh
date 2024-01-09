import assert from 'assert';

const PROVIDER_URL = 'http://localhost:45760/?provider=https://ethereum-provider.rpch.tech';

jest.setTimeout(1e3 * 60 * 1); // one minute

const GET_BLOCK_NUMBER = {
  body: JSON.stringify({
    method: 'eth_blockNumber',
    params: [],
    jsonrpc: '2.0',
  }),
  headers: {
    'content-type': 'application/json',
  },
  method: 'POST'
}

const GET_CHAIN_ID = {
  body: JSON.stringify({
    method: 'eth_chainId',
    params: [],
    jsonrpc: '2.0',
  }),
  headers: {
    'content-type': 'application/json',
  },
  method: 'POST'
}

describe('rpch-server-zero-hop tests', function () {

  afterAll(() => {
    // wait for close events to happen
    return new Promise((resolve) => setTimeout(resolve, 1_000));
  });

  it('should get block number from default online PRCh provider', async function () {
    const response = await fetch(PROVIDER_URL, GET_BLOCK_NUMBER);
    const json = await response.json();
    const blockNumber = BigInt(json.result);
    assert.equal(typeof blockNumber, 'bigint');
  });

  it('should get chain id  from default online PRCh provider', async function () {
    const response = await fetch(PROVIDER_URL, GET_CHAIN_ID);
    const json = await response.json();
    const chainId = json.result;
    assert.equal(chainId, '0x1');
  });
});