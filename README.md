# RPCh monorepo

## Description

The RPCh monorepo contains the main components required to bring RPCh to life.
Discovery Platform holds entry and exit nodes information and delivers best routes through the API to the SDK.
Availability Monitor determines those routes.
The Exit Node is an application connected to the hoprd exit node that does the actual RPC provider interaction.
RPC server leverages the RPCh SDK to provide RPCh functionality as a configurable endpoint.
CompatCrypto package implements RPCh [crypto protocol](https://docs.google.com/document/d/1YnyigOW-_i7-u-FjZhOsPnRei3WpIwLdYz5kTPi3AXk/edit#heading=h.av7965dt9dvc).
RPCh SDK is the integration point for routing JSON RPC requests through [hopr mixnet](https://docs.hoprnet.org/core/what-is-hopr).

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

- Create PR with desired changes
- Wait for automation job to build and upload container
- Take container hash - easiest from [artifacts registry](https://console.cloud.google.com/artifacts/docker/rpch-375921/europe-west6/rpch?project=rpch-375921)
- Use hash according to deployment instructions for the desired applications further down

### Production deployment

- Checkout latest `main` branch and run `$ yarn changeset version`
- Execute `$ yarn build` from the root folder
- If you updated the Exit Node make sure to update [SDK compatibility Version](https://github.com/Rpc-h/RPCh/blob/main/packages/sdk/src/node-selector.ts#L9)
- If you updated hoprd and want to rely on SDK's relay pathing update [Nodes compatibility Version](https://github.com/Rpc-h/RPCh/blob/main/packages/sdk/src/node-pair.ts#L20)
- Add changes and make a version commit
- Tag all applications/packages that you updated and want to deploy
- Ideally you have now one commit ahead of `origin/main` with all the tags.
- Push it `$ git push origin main --tags`
- After the correct tags for your application where built, follow deployment instructions further down

### Availability Monitor

Version tag on main branch: `@rpch/availability-monitor-vX.X.X`

The Availability Monitor is managed via [applications](https://github.com/Rpc-h/applications) repo.
Update version in `<ENV>/availability-monitor/application.yaml` and push to main branch.

### Discovery Platform

Version tag on main branch: `@rpch/discovery-platform-vX.X.X`

The Discovery Platform is managed via [applications](https://github.com/Rpc-h/applications) repo.
Update version in `<ENV>/discovery-platform/application.yaml` and push to main branch.

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

### RPCh log output

Generally nodes are referred to by an abbreviation of their peer ID.
Entry nodes are prefixed with `e.` and exit nodes with `x.`. Intermediary nodes are just `.`.

e.g.:

```
# entry node
e.kJXR
# exit node
x.EcRZ
# intermediary node
.QfzR
```

#### Detailed specs

If you are interested in more detailed network specs, you can enhance the log output.

`RPCH_LOG_LEVEL=verbose` - increase verbosity
`RPCH_EXPOSE_LATENCY_STATS=1` - show latency during RPCh travel path (this will slightly increase the payload size, so essentially draining your quota faster)

Explanation of sample outputs:

- route pair

```
found route pair: e.kJXR>x.EcRZ (via only route available)
                  ^      ^       ^
                  |  exit node   |
              entry node     path selection reason
```

This means RPCh has determined a valid path from `e.kJXR` directly to `x.EcRZ`.
The path selection reason is mentioned in the brackets thereafter.

- request

```
started request[c60b08c9-f860-4c2f-9788-3d0c50e2fca7, e.kJXR>x.EcRZ, https://gnosis-provider.rpch.tech] on .kJXR[ping: 149ms, seg: 28(58ms)/28, msgs: 30(29ms)/30, 1x: .EcRZ[v2.0.0,o:445ms,i:720ms,14(822ms)/14+1]]
                ^                                     ^              ^                                     ^                                                       ^   ^
           request id                           request path         |                              entry node stats                                               | exit node stats
                                                             request endpoint                                                                        number of available exit nodes

# entry node stats
ping: 149ms - discovery ping latency
ping: .. - discovery ping not yet returned
seg: 28(58ms)/28 - outgoing segments stats: segments successfully sent (mean segment send latency) / all segments sent to this node
seg: 28(58ms)/28+x - outgoing segments stats: segments successfully sent (mean segment send latency) / all segments sent to this node + ongoing outgoing segments
msgs: 30(29ms)/30 - incoming messages stats, counting empty polls as well: successful messages poll (mean retrieval latency) / all messages polls
msgs: 30(29ms)/30+x - incoming messages stats, counting empty polls as well: successful messages poll (mean retrieval latency) / all messages polls + ongoing incoming messages
1x: - number of available exit nodes from that entry node

# exit node stats
v2.0.0 - exit application version
o:445ms - exit node clock offset, needed to adjust crypto counter
i:720ms - discovery info request latency
i:fail - discovery info request failed
14(822ms)/14 - successful requests (mean request latency) / all requests sent to this node
14(822ms)/14+1 - successful requests (mean request latency) / all requests sent to this node + ongoing requests
```

Request output shows the choses path through the network.
It also prints current node stats as experienced by this instance.

- segment

```
segment[rId: c60b08c9-f860-4c2f-9788-3d0c50e2fca7, nr: 0, total: 2] on .kJXR[ping: 149ms, seg: 28(58ms)/28+1, msgs: 30(29ms)/30, 1x: .EcRZ[v2.0.0,o:445ms,i:720ms,14(822ms)/14+1]]
        ^                                          ^      ^            ^                                                             ^
   request id                                      | total segments    |                                                      exit node stats
                                            segment number      entry node stats
```

Requests are split into smaller segments.
This shows the total number of segments and the current segment number.
See request section for detailed entry and exit node stats.

- latency stats

These will only work if you start the rpc server with `RPCH_EXPOSE_LATENCY_STATS=1`.
Keep in mind that this will slightly increase quota usage.

```
response time for request c60b08c9-f860-4c2f-9788-3d0c50e2fca7: 1087 ms { segDur: 85, rpcDur: 166, exitNodeDur: 13, hoprDur: 823 }
                          ^                                     ^       ^
                     request id                                 |  latency stats
                                                         request duration

# latency stats
segDur - segments duration: time difference between starting first segment send and finishing last segment send
rpcDur - rpc duration: actual RPC request latency from the exit application
exitNodeDur - exit application duration: approximate time the exit application took to process the request
hoprDur - hoprnet duration: approximate time the request segments spent to travel through the network, back and forth
```

The latency stats give some insight to the networks / components performance.
