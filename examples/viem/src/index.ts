import HoprSDK, { JRPC } from '@rpch/sdk';
import { createClient, custom, publicActions } from 'viem';
import { mainnet } from 'viem/chains';
import dotenv from 'dotenv';
dotenv.config();

const sdk = new HoprSDK(process.env.CLIENT_SECRET!, { forceZeroHop: true });

async function sendRpchRequest({
    method,
    sdk,
    params,
}: {
    method: string;
    params?: object | any[] | undefined;
    sdk: HoprSDK;
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

function publicRPChClient() {
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
