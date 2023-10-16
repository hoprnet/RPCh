# K6 Loadtesting

## Installation

This package utilizes k6 by Grafana Labs.
Install k6 on test machine: https://k6.io/docs/get-started/installation/

## How to test RPC Server

1. Spin up Sandbox
2. Spin up RPC Server on http://localhost:8080/
3. Navigate to `.\devkit\k6-loadtesting\`
4. Run:
   - `yarn start:artificial` (Artificial usage with `eth_getCode` and `eth_call`)
   - `yarn start:blockwallet` (Real usage of blockwallet)
   - `yarn start:trustwallet` (Real usage of trustwallet)
   - `yarn start:burst` (Run various burst tests)
   - `yarn start:constant` (Run various load tests for 10 seconds each)
   - `yarn start:long` (Run long lived load tests for 1 minute each)

## How to test Discovery Platform

1. Spin up Sandbox
2. Spin up RPC Server on http://localhost:3040/
3. Navigate to `.\devkit\k6-loadtesting\`
4. Run:
   - `yarn start:discovery-platform` (Artificial usage with `GET` requests)

## How to run a flood test

Please refer to [LOAD_TEST](./LOAD_TESTING.md) for more details
