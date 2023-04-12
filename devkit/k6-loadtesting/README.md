# K6 Loadtesting

## Installation 

This package utilizes k6 by Grafana Labs.
Install k6 on test machine: https://k6.io/docs/get-started/installation/


## How to test RPC Server

1. Spin up Sandbox 
2. Spin up RPC Server on http://localhost:3040/
3. Navigate to `.\devkit\k6-loadtesting\`
4. Run:
    - `yarn k6-artificial`  (Artificial usage done with eth_getCode and eth_call)
    - `yarn k6-blockwallet` (Real usage of blockwallet)
    - `yarn k6-trustwallet` (Real usage of trustwallet)
    - `yarn k6-blockwallet`

## How to test Discovery Platform

1. Spin up Sandbox 
2. Spin up RPC Server on http://localhost:3040/
3. Navigate to `.\devkit\k6-loadtesting\`
4. Run:
    - `yarn k6-dp` 