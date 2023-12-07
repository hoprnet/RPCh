# RPCh monorepo

## Description

The RPCh monorepo contains the main components required to bring RPCh to life.

### Project structure

We have four main project folders:

2. [packages](./packages/): contains libraries that are used internally, and could be used externally, published
3. [apps](./apps/): contains services which are run centrally by the RPCh org
4. [devkit](./devkit/): contains developer tools and sandbox material
5. [examples](./examples/): contains examples of how to use the SDK with popular libraries

### Getting started

1. Install nodejs `v18`
2. Download dependencies with `yarn`
3. Build everything with `yarn build`

### Try it out

Checkout [Sandbox](https://github.com/Rpc-h/RPCh/tree/main/devkit/sandbox#sandbox) which lets you try RPCh locally via docker.

### For developers

- unit-tests: you are required to run a postgres instance locally in order to run the unit tests
  the connection string must look like `postgresql://postgres:postgres@127.0.0.1:5432`
- coverage: currently we can generate coverage reports for each project,
  but we do not have a threshold set in which we would fail our CI
- dependency check: we currently use `check-dependency-version-consistency` to ensure consistency between the dependency version,
  future plan is to use `depcheck` for every project to ensure all libraries are correctly added per `package.json`

Please refer to [DEVELOPER_SETUP](./DEVELOPER_SETUP.md) for more details

## Changelogs

This project aims to use [Changesets](https://turbo.build/repo/docs/handbook/publishing-packages/versioning-and-publishing) for versioning.
We will gradually add changesets for new releases/tags, so that given some time we will have every app/package covered.

## Tagging scheme

This monorepo will use the usual tagging scheme for monorepos:
Tags are usually only created prior to releases. See [Deployment](##Deployment) section.

```
org/appname-vX.X.X

org  # organization name, usually @rpch
appname  # application or package name to be released with that tag
-  # slash separator
v  # single letter 'v'
X.X.X  # Semver versioning for that app or package
```

## Deployment

Github Workflows builds and pushes container images to our configured artifacts registry.
During development changesets are used to manage user facing changelogs.

### Staging deployment

To update singular applications on staging, the usual flow is like this:

* Create PR with desired changes
* Wait for automation job to build and upload container
* Take container hash - easiest from [artifacts registry](https://console.cloud.google.com/artifacts/docker/rpch-375921/europe-west6/rpch?project=rpch-375921)
* Use hash according to deployment instructions for the desired applications further down

### Production deployment

* Checkout latest `main` branch and run `$ yarn changeset version`
* Execute `$ yarn build` from the root folder
* If you updated the Exit Node make sure to update [SDK compatibility Version](https://github.com/Rpc-h/RPCh/blob/main/packages/sdk/src/node-selector.ts#L9)
* Add changes and make a version commit
* Tag all applications/packages that you updated and want to deploy
* Ideally you have now one commit ahead of `origin/main` with all the tags.
* Push it `$ git push origin main --tags`
* After the correct tags for your application where built, follow deployment instructions further down

### Availability Monitor

Version tag on main branch: `@rpch/availability-monitor-vX.X.X`

The Availability Monitor is managed via [applications](https://github.com/Rpc-h/applications) repo.
Update version in `<ENV>/availability-monitor/application.yaml` and push to main branch.

### Discovery Platform

Version tag on main branch: `@rpch/discovery-platform-vX.X.X`

The Discovery Platform is managed via [applications](https://github.com/Rpc-h/applications) repo.
Update version in `<ENV>/discovery-platform/application.yaml` and push to main branch.

### Exit Node

Version tag on main branch: `@rpch/exit-node-vX.X.X`

Exit Nodes are managed via [infrastructure](https://github.com/Rpc-h/infrastructure) repo.
Update version in `day-1/inventories/<ENV>/group_vars/all/vars.yaml` and run exit node deployment:

```
env=<ENV> ANSIBLE_HOST_KEY_CHECKING=False private_key=<SSH PRIVATE KEY> make install-exit-node
```

Create a pull request afterwards.

### RPC Server

Version tag on main branch: `@rpch/rpc-server-vX.X.X`

RPC Server that are version tagged on main branch will contain an additional container tag: `latest`.
In order to inform users that there is a new version update the database of the Discovery Platform with that version inside the `configs` table;
[RPCh degen webiste](https://degen.rpch.net/) will also show the updated info there.
The [Latency Monitor](https://github.com/Rpc-h/latency-monitor) also uses rpc servers. To update those follow instructions there.

### RPCh Compat Crypto

Version tag on main branch: `@rpch/compat-crypto-vX.X.X`

Published version can be found on [npm](https://www.npmjs.com/package/@rpch/compat-crypto).
A new version can be published by running `$ yarn publish`.

### RPCh SDK

Version tag on main branch: `@rpch/sdk-vX.X.X`

Published version can be found on [npm](https://www.npmjs.com/package/@rpch/sdk).
A new version can be published by running `$ yarn publish`.
If it depends on a new version of Compat Crypto, make sure to publish the new version there as well.
