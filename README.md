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

- coverage: currently we can generate coverage reports for each project,
  but we do not have a threshold set in which we would fail our CI
- dependency check: we currently use `check-dependency-version-consistency` to ensure consistency between the dependency version,
  future plan is to use `depcheck` for every project to ensure all libraries are correctly added per `package.json`

## Changelogs

This project aims to use [Changesets](https://turbo.build/repo/docs/handbook/publishing-packages/versioning-and-publishing) for versioning.
We will gradually add changesets for new releases/tags, so that given some time we will have every app/package covered.

## Tagging scheme

This monorepo will use the usual tagging scheme for monorepos:
Tags are usually only created prior to releases. See [Deployment](##Deployment) section.

```
appname/vX.X.X

appname - application or package name to be released with that tag
/ - slash separator
v - single letter 'v'
X.X.X - Semver versioning for that app or package
```

## Deployment

Deployment works automated.
For staging, pull requests are built and merges/pushes to the `main` branch will also trigger builds.
For production, this works a little bit different.
Whenever a new tags is updated (usually alongside corresponding changeset changes) on `main` the automation will check

- if it can build new application container images
- if it can publish new npm packages
