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

### For developers

- coverage: currently we can generate coverage reports for each project, but we do not have a threshold set in which we would fail our CI
- dependency check: we currently use `check-dependency-version-consistency` to ensure consistency between the dependency version, future plan is to use `depcheck` for every project to ensure all libraries are correctly added per `package.json`
