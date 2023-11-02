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

const sdk = new SDK(CLIENT_SECRET, { forceZeroHop: true });

async function sendRpchRequest({
  method,
  sdk,
  params,
}: {
  method: string;
  params?: object | unknown[] | undefined;
  sdk: SDK;
}): Promise<JRPC.Result> {
  console.log(method, params);

  const req: JRPC.Request = {
    jsonrpc: "2.0",
    method: method,
    params: params,
  };

  const rpchResponse = await sdk.send(req);

  console.log("rpchResponse", rpchResponse);

  const responseJson = await rpchResponse.json();

  if (JRPC.isError(responseJson)) {
    throw new Error(responseJson.error.message);
  }

  console.log("result", responseJson.result);

  return responseJson.result;
}

function publicRPChClient(): PublicClient<Transport, Chain> {
  return createClient({
    chain: mainnet,
    batch: {
      multicall: true,
    },
    pollingInterval: 30_000,
    transport: custom(
      {
        async request({ method, params }) {
          try {
            const response = await sendRpchRequest({ method, sdk, params });
            return response;
          } catch (e) {
            console.log(e);
          }
        },
      },
      {
        retryCount: 3,
        retryDelay: 3_000,
      }
    ),
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
