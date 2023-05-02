# RPCh SDK

## Description

RPCh SDK is a library which will be used by a client who wants to access the RPCh network, additionally, the SDK will be integrated into our own “RPCh web3 adaptors”.
Through the SDK, the client should be able to send traffic through the RPCh network and maintain a reliability metric of used HOPR entry nodes.

## How to use SDK
You will need to have Node.js and npm/yarn installed on your computer. You can download them from their official website or use a package manager like Homebrew (for Mac) or Chocolatey (for Windows).

Install necessary packages
```
yarn add @rpch/crypto @rpch/sdk
```

Get your rpch client by running
```
curl --request GET \
  --url https://staging.discovery.rpch.tech/api/v1/request/trial
```

or go to https://access.rpch.net/ and follow the docker guide


You can create an instance of the SDK by passing in the required options and key-value store functions:
```TypeScript
import * as RPChCrypto from "@rpch/crypto";
import SDK from "@rpch/sdk";

const sdk = new SDK(
  {
    crypto: RPChCrypto,
    client: "your_client_name",
    timeout: 20000,
    discoveryPlatformApiEndpoint: "https://staging.discovery.rpch.tech",
  },
  setKeyValFunction,
  getKeyValFunction
);
```
Here are the available options:

- crypto: The RPChCrypto module required for cryptographic operations. Learn more about what module to pass [here](https://github.com/Rpc-h/crypto#rpch-crypto)
- client: A string that identifies the client using the SDK. This is used for statistics and logging.
- timeout: The timeout for requests in milliseconds.
- discoveryPlatformApiEndpoint: The URL for the discovery platform API.

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

Before you can send requests through the SDK, you must start it by calling the start method:
```TypeScript
await sdk.start();
```
This will fetch the required data from the discovery platform and start any necessary intervals.


Sending a requests consists of 2 steps:
1. creating the request `const req = await sdk.createRequest("provider", "body");` The first argument is the provider name and the second argument is the request body.
2. sending the previously created request `const res = await sdk.sendRequest(req);` This will send the request through the HOPR network and return the response. If there is an error, it will be thrown.

When you are finished using the SDK, be sure to call the stop method:
```TypeScript
await sdk.stop();
```
This will stop any necessary intervals and clear up any remaining processes.

## Enabling debugging logs

Depending on which platform you are running the SDK, you need to enable debugging in different ways.
We use the library [debug](https://github.com/debug-js/debug) for our logging.

- on nodejs: you need to run the instance with the following environment variable `DEBUG="rpch*" ..`
- on web platforms:
  - localStorage: update `localStorage` with keyval `debug:rpch*`
  - programmatic: access the SDK object and enable logging with `sdk.debug.enable("rpch*")`



   
