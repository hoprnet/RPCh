# K6 Loadtesting

## Installation

This package utilizes k6 by Grafana Labs.
Install k6 on test machine: https://k6.io/docs/get-started/installation/

## How to test RPC Server

1. Spin up Sandbox or all the infrastracture locally (except for the entry/exit nodes) or spin up a RPCh node of staging environment where the RPC Server runs on http://localhost:45740/. Please refer to [DEVELOPER_SETUP](../../DEVELOPER_SETUP.md) for more details
2. Navigate to `devkit/loadtesting-k6`
3. Run:
```bash
RPC_SERVER_URL=http://localhost:45740 yarn start:spike-small
```
   - `yarn start:artificial` (Artificial usage with `eth_getCode` and `eth_call`)
   - `yarn start:blockwallet` (Real usage of blockwallet)
   - `yarn start:trustwallet` (Real usage of trustwallet)
   - `yarn start:burst` (Run various burst tests)
   - `yarn start:constant` (Run various load tests for 10 seconds each)
   - `yarn start:long` (Run long lived load tests for 1 minute each)
4. Check the result json file and "500” means that there’s failure in RPCh side


## How to test Discovery Platform

1. Spin up Sandbox
2. Spin up RPC Server on http://localhost:3040/
3. Navigate to `.\devkit\k6-loadtesting\`
4. Run:
   - `yarn start:discovery-platform` (Artificial usage with `GET` requests)