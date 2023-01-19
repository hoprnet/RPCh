# RPCh monorepo

## Description

The RPCh monorepo contains the main components required to bring RPCh to life.

### Project structure

We have four main project folders:

1. [configs](./configs/): contains internal configurations, not published
2. [packages](./packages/): contains libraries that are used internally, and could be used externally, published
3. [apps](./apps/): contains services which are run centrally by the RPCh org
4. [devkit](./devkit/): contains developer tools and sandbox material

### Getting started

1. Install nodejs `v16`
2. Download dependencies with `yarn`
3. Build everything with `yarn build`

### Try it out

Checkout [Sandbox](https://github.com/Rpc-h/RPCh/tree/main/devkit/sandbox#sandbox) which lets you try RPCh locally via docker.

### Roadmap

| Target  | Task                     | Status |
| ------- | ------------------------ | ------ |
| 11/2022 | @rpch/commons            | 🟢     |
| 11/2022 | CORE multi-hop support   | 🔴     |
| 12/2022 | @rpch/ethers             | 🟢     |
| 12/2022 | RPCh exit node           | 🟢     |
| 12/2022 | RPCh funding service     | 🟢     |
| 12/2022 | @rpch/crypto             | 🟢     |
| 01/2023 | @rpch/sdk                | 🟢     |
| 01/2023 | Block Wallet integration | 🟢     |
| 01/2023 | RPCh Sandbox v1          | 🟢     |
| 01/2023 | RPCh Sandbox v2          | 🟢     |
| 01/2023 | RPCh base infrastructure | 🟡     |
| 01/2023 | RPCh Alpha               | 🟡     |
| 01/2022 | NIRP gnosis              | 🟡     |
| 01/2022 | CORE capability api      | 🟡     |
| 02/2023 | RPCh Beta                | ⚪️    |
| 02/2023 | RPCh discovery platform  | 🟡     |
| 02/2022 | NIRP mainnet             | ⚪️    |
| 02/2023 | RPCh v1                  | ⚪️    |
