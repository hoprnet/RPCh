# K6 Loadtesting

## Installation

This package utilizes k6 by Grafana Labs.
Install k6 on test machine: https://k6.io/docs/get-started/installation/

## Build
1. Navigate to `devkit/loadtesting-k6`
2. Build the repo
```
yarn build
```

## Test
### How to test RPC Server

1. Spin up Sandbox or all the infrastracture locally (except for the entry/exit nodes) or spin up a RPCh node of staging environment where the RPC Server runs on http://localhost:45740/. Please refer to [DEVELOPER_SETUP](../../DEVELOPER_SETUP.md) for more details
2. Navigate to `devkit/loadtesting-k6`
3. Run:
```bash
export TEST_TYPE=SMOKE WALLET_TYPE=METAMASK ; \
   RPC_SERVER_URL=http://localhost:45750 \
   k6 run ./build/rpc-server/index.js \
   --out json="results/test-$TEST_TYPE-$WALLET_TYPE-$(date +%s).json"
```
Where a list of values for `TEST_TYPE` and `WALLET_TYPE` can be found with:
```
yarn run help
```

4. Check the result json file and "500” means that there’s failure in RPCh side


### How to test Discovery Platform

1. Spin up Sandbox
2. Spin up RPC Server on http://localhost:3040/
3. Navigate to `.\devkit\k6-loadtesting\`
4. Run:
   - `yarn start:discovery-platform` (Artificial usage with `GET` requests)

## Develop

### RPC Server
Load testing for 'rpc-server' simulates how crypto wallets send traffic over RPCh network when end-users interact with dApps.
The test traffic has been captured during manual testing sessions involving various wallets and dApps.

#### Adding profile for a new wallet
Each wallet has its own pattern of sending json-rpc calls.
To create a profile for a new wallet, follow these steps:

1. create a new class that extends "MockWallet" class in the `./src/rpc-server/wallet` folder. Modify the two functions:
  - `buildRequestBodies`: pPopulate this function with the json-rpc calls that the wallet sends per user session. Additionally, include `requests.push(...getRandomPayloadFromDapp());`  to simulate the wallet's interaction with a random dApp.
  - `sendRpcCalls`: adjust the `sleep()` timer to set the waiting interval between requests.

2. Extend `Wallet` enum in `./src/rpc-server/types.ts` and the `buildWallet` function in `./src/rpc-server/wallet/index.ts` to include the new wallet.

#### Extending dApp interaction scenarios
When testing a wallet's behavior, the load testing process randomly selects a dApp for each iteration to simulate its interaction.
To add typical payloads for a dApp, extend the `getRandomPayloadFromDapp` function located in `./src/rpc-server/utils/rpc-payload.ts`

Existing dApp scenarios include:
  - Uniswap
  - CoWswap

#### Adding new metrics
In addition to the standard built-in metrics provided by k6, you can customize metrics to track network performance.

Existing counters include:
  - counters for json-rpc calls (defined in `instantiatePayloadCounters`)

#### Adjust test options
Test options (e.g. duration of test, number of VUs) are defined in `./src/rpc-server/utils/test-option.ts`.
To adjust those parameters, please refer to the [k6 documentation](https://k6.io/docs/using-k6/k6-options/reference/)
