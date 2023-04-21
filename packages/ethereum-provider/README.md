# RPCh ethereum provider adaptor

## Description
The RPCh ethereum provider adaptor is an extension of the [`ethereum-provider`](https://github.com/floating/ethereum-provider). The goal of this adaptor is to provide a plug and play experience of for projects that currently use the ethereum provider.

# How to use RPCh ethereum provider adaptor
You will need to have Node.js and npm/yarn installed on your computer. You can download them from their official website or use a package manager like Homebrew (for Mac) or Chocolatey (for Windows).

```
yarn add @rpch/crypto-for-nodejs @rpch/ethereum-provider
```

Get your rpch client by running
```
curl --request GET \
  --url https://staging.discovery.rpch.tech/api/v1/request/trial
```

or go to https://access.rpch.net/ and follow the docker guide

You can create an instance of this adaptor by passing in the required options and key-value store functions:
```TypeScript
import * as RPChCrypto from "@rpch/crypto-for-nodejs";
import { RPChEthereumProvider } from "@rpch/ethereum-provider";

const PROVIDER_URL = 'https://primary.gnosis-chain.rpc.hoprtech.net';
const TIMEOUT = 10000;
const DISCOVERY_PLATFORM_API_ENDPOINT = 'https://staging.discovery.rpch.tech';

const provider = new RPChEthereumProvider(
  PROVIDER_URL,
  {
    crypto: RPChCrypto,
    client: "your_client_name",
    timeout: TIMEOUT,
    discoveryPlatformApiEndpoint: DISCOVERY_PLATFORM_API_ENDPOINT,
  },
 setKeyValFunction,
 getKeyValFunction
);
```

- PROVIDER_URL: a string representing the URL of the provider we want to connect to.
- HoprSdkOps: an object containing the options for the RPCh SDK instance. It includes:
  - crypto: The RPChCrypto module required for cryptographic operations. Learn more about what module to pass [here](https://github.com/Rpc-h/crypto#rpch-crypto)
  - client: A string that identifies the client using the SDK. This is used for statistics and logging.
  - timeout: The timeout for requests in milliseconds.
  - discoveryPlatformApiEndpoint: The URL for the discovery platform API.
- setKeyVal: a function that sets a key-value pair in storage.
- getKeyVal: a function that retrieves the value corresponding to a key from storage.

The setKeyValFunction and getKeyValFunction functions are used to store and retrieve key-value pairs for the SDK. These are used to store counters for outgoing requests and responses.

```TypeScript
// This is an example of a simple way to set these functions
async function setKeyVal(key: string, val: string): Promise<void> {
  localStorage.setItem(key, val);
}
async function getKeyVal(key: string): Promise<string | undefined> {
  return localStorage.getItem(key);
}
```

After creating the instance, you can use the provider just like you would use a regular Ethereum provider:

```TypeScript
provider.send(
  {
    method: "eth_accounts",
    params: [],
    id: 1,
    jsonrpc: "2.0"
  },
  (error, response) => {
    if (error) {
      console.error(error);
    } else {
        // do whatever you want with the response
      return response
    }
  }
);
```

In addition, the adaptor emits the following events:

- connect: Emitted when the provider is connected.
- payload: Emitted when a payload is received from RPCh.
- close: Emitted when the provider is closed.
