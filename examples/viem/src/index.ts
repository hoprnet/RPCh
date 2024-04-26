import SDK from '@rpch/sdk';
import dotenv from 'dotenv';
import { PublicClient, createClient, custom, publicActions } from 'viem';
import { mainnet } from 'viem/chains';
dotenv.config();

// This client secret can be found in your dashboard
const sdk = new SDK(process.env.CLIENT_SECRET!);

function publicRPChClient(): PublicClient {
    return createClient({
        chain: mainnet,
        transport: custom({
            async request({ method, params }) {
                const response = await sdk.send({ method, params, jsonrpc: '2.0' });
                return JSON.parse(response.text);
            },
        }),
    }).extend(publicActions);
}

publicRPChClient()
    .getBlock()
    .then((res) => console.log(res));

export default publicRPChClient;
