import SDK from '@rpch/sdk';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Example of how to use SDK
 */
async function example() {
    // This client secret can be found in your dashboard
    const sdk = new SDK(process.env.CLIENT_SECRET!);

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

    return JSON.parse(response.text);
}

async function main() {
    try {
        const response = await example();
        console.log(response);
    } catch (e) {
        console.error(e);
    }
}

main();
