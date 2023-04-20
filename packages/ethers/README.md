# RPCh ethers adaptor

## Description

The RPCh ethers adaptor is an extension of the original `JsonRpcProvider` which allows clients to use drop-in and replace, so they can send their RPC requests through the RPCh network.

## How to use RPCh ethers adaptor
You will need to have Node.js and npm/yarn installed on your computer. You can download them from their official website or use a package manager like Homebrew (for Mac) or Chocolatey (for Windows).

```
yarn add @rpch/crypto @rpch/ethers
```

Get your rpch client by running
```
curl --request GET \
  --url https://staging.discovery.rpch.tech/api/v1/request/trial
```

or go to https://access.rpch.net/ and follow the docker guide

You can create an instance of this adaptor by passing in the required options and key-value store functions:
```TypeScript
import * as RPChCrypto from "@rpch/crypto";
import { RPChProvider } from "@rpch/ethers";

const PROVIDER_URL = 'https://primary.gnosis-chain.rpc.hoprtech.net';
const TIMEOUT = 10000;
const DISCOVERY_PLATFORM_API_ENDPOINT = 'https://staging.discovery.rpch.tech';

const provider = new RPChProvider(
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

Once we have constructed the RPChProvider instance, we can use it to send requests to the provider using the send method. For example, to get the current block number, we can call: 
```TypeScript
provider.send('eth_blockNumber', [])
```