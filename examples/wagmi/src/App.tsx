import SDK from "@rpch/sdk";
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

/* Viem config */
function publicRPChClient(): PublicClient<Transport, Chain> {
  return createClient({
    chain: mainnet,
    transport: custom(
      {
        async request({ method, params }) {
          try {
            const response = await sdk.send({ method, params, jsonrpc: "2.0" });
            const responseJson = await response.json();

            return "error" in responseJson
              ? responseJson.error
              : responseJson.result;
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

/* Wagmi config */
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
