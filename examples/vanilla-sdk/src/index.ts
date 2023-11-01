import SDK from '@rpch/sdk';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Example of how to use SDK
 */
async function example() {
    // this client secret can be found in your dashboard
    const sdk = new SDK(process.env.CLIENT_SECRET!, { forceZeroHop: true });

    const response = await sdk.send(
        {
            method: 'eth_blockNumber',
            params: [],
            jsonrpc: '2.0',
        },
        {
            provider: 'https://ethereum-provider.rpch.tech',
        },
    );

    return response;
}

example()
    .then((res) => console.log(res))
    .catch((err) => console.error(err));
