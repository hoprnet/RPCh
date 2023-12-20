# Sandbox v2

<p align="center">
  <img width="500" height="500" src="https://user-images.githubusercontent.com/1877679/213269429-3e17ce98-216d-40d9-8047-86a55413988d.png" alt="a [sandbox protected by a glass]::2 in a yellow solid background, in the sandbox you have foxes playing, digital drawing">
</p>

## Description

Sandbox is a docker-compose file that aims to emulate the whole RPCh stack locally on your machine.

This includes:

- running local RPC node
- running local HOPRd node which uses the RPC node (acts as entry node)
- running intermediary nodes
- running HOPRd and RPCh exit nodes
- running RPCh discovery platform
- running RPCh funding service

### Getting started

1. Install
   - nodejs `v18`
   - latest version of `docker` and `docker-compose`
2. Clone this repository
3. Download dependencies with `yarn`
4. Build everything with `yarn build`
5. Navigate to `devkit/sandbox`
6. Start sandbox with `yarn start`
7. Stop sandbox with `yarn stop`

### Using it with Block Wallet

You can try out the RPCh sandbox by setting up our forked version of Block Wallet.

1. Install `git` and `make` on your machine
2. Git clone [Rpc-h/extension-block-wallet](https://github.com/Rpc-h/extension-block-wallet)
3. Checkout to branch `master`
4. Follow the setup instructions in the [README](https://github.com/Rpc-h/extension-block-wallet#readme)
5. Add extension into your browser



### Networking issues:
At the moment of writing this, there is definitely an issue with mac, the issues is that docker in mac uses a linux virtual machine where containers live, so when you use network_mode: "host" it will only be valid for the VM's network, not for your mac :( more info here.

As an alternative, do not use network_mode: "host", instead keep it in bridge (the default) then configure your service to instead of reaching localhost:xxxx, use host.docker.internal:xxxx