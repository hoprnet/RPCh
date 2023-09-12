# @rpch/rpc-server

## 0.4.0

### Minor Changes

- e691140: - changed default port to 45750
  - added cors headers to allow using it locally, can be disabled with `RESTRICT_CORS`

### Patch Changes

- Updated dependencies [e691140]
  - @rpch/sdk@0.7.0

## 0.3.6

### Patch Changes

- Change MEV_PROTECTION_PROVIDER logic and expose it to RPC_SERVER
- Updated dependencies
  - @rpch/sdk@0.6.2

## 0.3.5

### Patch Changes

- Updated dependencies
  - @rpch/sdk@0.6.1

## 0.3.4

### Patch Changes

- Updated dependencies [333a830]
  - @rpch/sdk@0.6.0

## 0.3.3

### Patch Changes

- Updated dependencies [7633232]
  - @rpch/sdk@0.5.2

## 0.3.2

### Patch Changes

- Updated dependencies [b9e964b]
  - @rpch/sdk@0.5.1

## 0.3.1

### Patch Changes

- Updated dependencies [ed54216]
  - @rpch/sdk@0.5.0

## 0.3.0

### Minor Changes

- ae6ca99: RPCserver now behaves more like a JSON-RPC endpoint.
  It also exposes newly introduced per request parameters and SDK startup parmeters via env vars and request parameters.

### Patch Changes

- 6f9a67b: Fixed return code issues and JSON return values
- Updated dependencies [6f9a67b]
- Updated dependencies [ae6ca99]
  - @rpch/sdk@0.4.0

## 0.2.0

### Minor Changes

- 191b247: Updates to support nodejs v18 and native fetch

### Patch Changes

- Updated dependencies [191b247]
- Updated dependencies [fc83313]
  - @rpch/sdk@0.3.0

## 0.1.0

### Initial production version

- Allow long running RPC server to handle RPCh requests.
