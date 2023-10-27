# RPCh SDK

## Description

RPCh SDK is a library which will be used by a client who wants to access the RPCh network, additionally, the SDK will be integrated into our own “RPCh web3 adaptors”.
Through the SDK, the client should be able to send traffic through the RPCh network and maintain a reliability metric of used HOPR entry nodes.

## How to use SDK

You will need to have Node.js and npm/yarn installed on your computer. You can download them from their official website or use a package manager like Homebrew (for Mac) or Chocolatey (for Windows).

Install necessary packages

```
yarn add @rpch/sdk
```

Get your rpch client by visiting [degen rpch website](https://degen.rpch.net).

You can create an instance of the SDK by passing in the required options and key-value store functions:

```TypeScript
import SDK from "@rpch/sdk";
const sdk = new SDK(<your-client-secret>)
```

Now you can start sending request similar to using `fetch`:

```TypeScript
const rpcReq = {
    jsonrpc: "2.0",
    method: "eth_chainId",
    id: "test1",
    params: [],
};
const resp = await sdk.send(rpcReq);
console.log(resp);
```

This will send the request through the HOPR network and return the response. If there is an error, it will be thrown.

In case you want to use a different EVM chain or a different RPC provider, just specify it in the options:

```TypeScript
sdk.send(rpcReq, {
    provider: 'https://ethereum-provider.rpch.tech'
});
```

## Enabling debugging logs

Depending on which platform you are running the SDK, you need to enable debugging in different ways.
We use the library [debug](https://github.com/debug-js/debug) for our logging.

- on nodejs: you need to run the instance with the following environment variable `DEBUG="rpch*" ..`
- on web platforms: update `localStorage` with keyval `debug:rpch*`
