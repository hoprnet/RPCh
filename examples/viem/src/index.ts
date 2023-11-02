import SDK, { JRPC } from '@rpch/sdk';
import dotenv from 'dotenv';
import { PublicClient, createClient, custom, publicActions } from 'viem';
import { mainnet } from 'viem/chains';
dotenv.config();

const sdk = new SDK(process.env.CLIENT_SECRET!);

async function sendRpchRequest({
    method,
    sdk,
    params,
}: {
    method: string;
    params?: object | any[] | undefined;
    sdk: SDK;
}): Promise<JRPC.Result> {
    console.log(method, params, sdk);
    const req: JRPC.Request = {
        jsonrpc: '2.0',
        method: method,
        params: params,
    };

    const rpchResponse = await sdk.send(req);

    const responseJson = await rpchResponse.json();

    if (JRPC.isError(responseJson)) {
        throw new Error(responseJson.error.message);
    }

    return responseJson.result;
}

function publicRPChClient(): PublicClient {
    return createClient({
        chain: mainnet,
        transport: custom({
            async request({ method, params }) {
                const response = await sendRpchRequest({ method, sdk, params });
                return response;
            },
        }),
    }).extend(publicActions);
}

publicRPChClient()
    .getBlock()
    .then((res) => console.log(res));

export default publicRPChClient;
