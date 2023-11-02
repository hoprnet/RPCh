import SDK, { JRPC } from "@rpch/sdk";
import {
  Chain,
  PublicClient,
  Transport,
  createClient,
  custom,
  publicActions,
} from "viem";
import { WagmiConfig, createConfig, mainnet } from "wagmi";
import Profile from "./Profile";
import { CLIENT_SECRET } from "./config";

const sdk = new SDK(CLIENT_SECRET);

async function sendRpchRequest({
  method,
  sdk,
  params,
}: {
  method: string;
  params?: object | unknown[] | undefined;
  sdk: SDK;
}): Promise<JRPC.Result> {
  console.log(method, params, sdk);
  const req: JRPC.Request = {
    jsonrpc: "2.0",
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

function publicRPChClient(): PublicClient<Transport, Chain> {
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

const config = createConfig({
  autoConnect: true,
  publicClient: publicRPChClient(),
});

export default function App() {
  return (
    <WagmiConfig config={config}>
      <Profile />
    </WagmiConfig>
  );
}
