# Sandbox

## Description

Sandbox is a docker-compose file that aims to emulate the whole RPCh stack locally on your machine.

This includes:

- running local RPC node
- running local HOPRd node which uses the RPC node (acts as entry node)
- running intermediary nodes
- running HOPRd and RPCh exit nodes
- running RPCh discovery platform (coming soon)
- running RPCh funding service (coming soon)

### Getting started

1. Install
   - nodejs `v16`
   - latest version of `docker` and `docker-compose`
2. Clone this repository & go to commit `627a3f2a9930662a91bc913f558e6d7e7f89b17e`
3. Download dependencies with `yarn`
4. Build everything with `yarn build`
5. Navigate to `devkit/sandbox`
6. Launch sandbox with `DEBUG="rpch*,-*metrics" docker-compose up`

### Using it with Block Wallet

You can try out the RPCh sandbox by setting up our forked version of Block Wallet.

1. Install `git` and `make` on your machine
2. Git clone [Rpc-h/extension-block-wallet](https://github.com/Rpc-h/extension-block-wallet)
3. Checkout to branch `implement-ethers-adaptor`
4. Navigate to file `packages/background/src/controllers/NetworkController.ts`
5. Go to line `506` and modify the following values (you can find all these values in the logs produced by the sandbox during startup):
   - entryNodePeerId: enter the peer-id of any node from sandbox which you would want to act as an entry node
   - exitNodePeerId: enter the peer-id of any node from sandbox which you would want to act as an exit node
   - exitNodePubKey: enter the public key of the designed exit node
6. Follow the setup instructions in the [README](https://github.com/Rpc-h/extension-block-wallet/tree/implement-ethers-adaptor#getting-started)
7. Add extension into your browser
