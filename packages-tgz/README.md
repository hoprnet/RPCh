# Packages .tgz folder 

## Description

The purpose of this folder is to store packed *.tgz's of packages that we are not published on npm.

## How to use 

1. Update the version in the `package.json` to a new one (for example `0.2.1-local.0`)
2. Make a GitHub tag with that version, so it will be easy to pinpoint in GitHub history
3. Build package you want with `yarn build`
4. Place the built package in the `./packages-tgz` folder 
5. Import the local package from the `./packages-tgz`
6. Check if the Dockerfile used to build the image has the `COPY packages-tgz packages-tgz` in it. If not, add it.
 
Example pakcage.json with usage of a local package:
```
{
  "name": "@rpch/rpc-server",
  "version": "0.0.6",
  "license": "LGPL-3.0",
  "private": true,
  "scripts": {
    "build": "tsup",
    "dev": "yarn build --watch",
    "format": "prettier --check \"src/**/*.{ts,md}\"",
    "lint": "eslint \"src/**/*.ts*\"",
    "test": "jest --coverage",
    "start": "node build/index.js"
  },
  "devDependencies": {
    ....
  },
  "dependencies": {
    "@rpch/sdk": "./packages-tgz/rpch-sdk-v0.2.1-alpha.25.tgz",
     ...
  }
}
```
