# @rpch/rpc-server

## 3.0.0

### Major Changes

-   17e8bf5: Removed MEV provider handling from rpc server

### Patch Changes

-   Updated dependencies [17e8bf5]
    -   @rpch/sdk@4.0.0

## 2.0.3

### Patch Changes

-   Updated dependencies
    -   @rpch/sdk@3.1.1

## 2.0.2

### Patch Changes

-   Updated dependencies [c17e3b2]
-   Updated dependencies [c17e3b2]
    -   @rpch/sdk@3.1.0

## 2.0.1

### Patch Changes

-   Updated dependencies
    -   @rpch/sdk@3.0.1

## 2.0.0

### Major Changes

-   a325843: No longer expose request latency measurements via request url

### Patch Changes

-   Updated dependencies [b610049]
-   Updated dependencies [a325843]
    -   @rpch/sdk@3.0.0

## 1.4.3

### Patch Changes

-   Updated dependencies [00e3508]
    -   @rpch/sdk@2.0.3

## 1.4.2

### Patch Changes

-   Updated dependencies
    -   @rpch/sdk@2.0.2

## 1.4.1

### Patch Changes

-   Updated dependencies
    -   @rpch/sdk@2.0.1

## 1.4.0

### Minor Changes

-   af3a2e8: Propagate request and response headers.
    Allow priority header definition via url search parameters.
    These can be useful to provide authorization header value to various RPC endpoint.

### Patch Changes

-   Updated dependencies [af3a2e8]
-   Updated dependencies [af3a2e8]
    -   @rpch/sdk@2.0.0

## 1.3.4

### Patch Changes

-   Updated dependencies [3066770]
    -   @rpch/sdk@1.14.0

## 1.3.3

### Patch Changes

-   Updated dependencies [26ff588]
    -   @rpch/sdk@1.13.0

## 1.3.2

### Patch Changes

-   Updated dependencies [f0572d1]
-   Updated dependencies [dbd5eaa]
    -   @rpch/sdk@1.12.2

## 1.3.1

### Patch Changes

-   Updated dependencies [b924905]
    -   @rpch/sdk@1.12.1

## 1.3.0

### Minor Changes

-   907e34b: Allow arbitrary headers via ENV vars and via URL parameters.
    Failed request file now prints handy curl oneliners.

### Patch Changes

-   f085c2c: No longer enforce JSON RPC at incoming requests
-   3f3d6a9: Fix provider and request header tracking to reflect actual usage
-   Updated dependencies [f085c2c]
-   Updated dependencies [f085c2c]
-   Updated dependencies [907e34b]
-   Updated dependencies [c507632]
-   Updated dependencies [3f3d6a9]
    -   @rpch/sdk@1.12.0

## 1.2.1

### Patch Changes

-   d900818: make failed reqs volume mountable without using chown

## 1.2.0

### Minor Changes

-   bee0cff: Expose requesting latency measurements from exit node
    Additionally return those stats from requests

### Patch Changes

-   Updated dependencies [bee0cff]
    -   @rpch/sdk@1.11.0

## 1.1.6

### Patch Changes

-   Updated dependencies [8225d5c]
    -   @rpch/sdk@1.10.1

## 1.1.5

### Patch Changes

-   Fix error string conversion for http stream writing

## 1.1.4

### Patch Changes

-   9c92b60: Fix error message forwarding

## 1.1.3

### Patch Changes

-   9e5ab02: reenable custom port inside rpc server container

## 1.1.2

### Patch Changes

-   fix typo to enforce permissions on failed_req folder

## 1.1.1

### Patch Changes

-   a5ddb16: Allow dynamic env vars forwarding into container and make failed request recording working

## 1.1.0

### Minor Changes

-   2c13794: Rename DEBUG_LEVEL to LOG_LEVEL to avoid conflicts with bash logger inside RPC server container

### Patch Changes

-   Updated dependencies [2c13794]
    -   @rpch/sdk@1.10.0

## 1.0.1

### Patch Changes

-   Updated dependencies [978f729]
    -   @rpch/sdk@1.9.0

## 1.0.0

### Major Changes

-   85d02e3: Use `FAILED_REQUESTS_FILE` env var to log failed requests to file.
    Elevate to stable version.

### Patch Changes

-   655f519: Expose `DEBUG_LEVEL` in RPC server and allow debugLevel ops parameter in SDK.
    This will set a minimal debug level and can be used in addition with scope to better control logging output.
    SDK and RPC-Server now default to `info` log level.
    Will only use default log level if `DEBUG` is not set.
-   Updated dependencies [85d02e3]
-   Updated dependencies [655f519]
    -   @rpch/sdk@1.8.0

## 0.14.0

### Minor Changes

-   7504a6f: allow logging of failed requests to file

## 0.13.1

### Patch Changes

-   Updated dependencies
    -   @rpch/sdk@1.7.1

## 0.13.0

### Minor Changes

-   d2b7a70: better handling of boolean env vars, allowing 'false', 'no', and 0 as a negative boolean
    exposing new forceManualRelaying SDK option

### Patch Changes

-   Updated dependencies [d2b7a70]
    -   @rpch/sdk@1.7.0

## 0.12.1

### Patch Changes

-   improved version outdated error log

## 0.12.0

### Minor Changes

-   cda0447: yell at the user when outdated

### Patch Changes

-   Updated dependencies [cda0447]
    -   @rpch/sdk@1.6.0

## 0.11.5

### Patch Changes

-   increase HAPROXY server side timeout values

## 0.11.4

### Patch Changes

-   dace3d5: update to latest SDK

## 0.11.3

### Patch Changes

-   fix env var forwarding

## 0.11.2

### Patch Changes

-   better timeout logs
-   Updated dependencies
    -   @rpch/sdk@1.5.2

## 0.11.1

### Patch Changes

-   update sdk

## 0.11.0

### Minor Changes

-   crypto protocol update

### Patch Changes

-   Updated dependencies
    -   @rpch/sdk@1.5.0

## 0.10.0

### Minor Changes

-   d1479ea: use request uuid inside crypto box
    use determined exit node counter offset inside crypto counter as well
    better version output log

### Patch Changes

-   Updated dependencies [d1479ea]
    -   @rpch/sdk@1.4.0

## 0.9.4

### Patch Changes

-   34e0d18: better log output and startup logs
-   Updated dependencies [34e0d18]
    -   @rpch/sdk@1.3.0

## 0.9.3

### Patch Changes

-   fb64847: fix missing dependency resolution
-   Updated dependencies [10eb627]
-   Updated dependencies [fb64847]
    -   @rpch/sdk@1.2.4

## 0.9.2

### Patch Changes

-   f3f9ee2: cleanup dependencies and consolidate formatting
-   Updated dependencies [f3f9ee2]
    -   @rpch/sdk@1.2.3

## 0.9.1

### Patch Changes

-   fix port overwriting

## 0.9.0

### Minor Changes

-   58cbdc0: - Optimize docker images size
    -   Enabled https certificate generation inside container

### Patch Changes

-   Updated dependencies [c5ae645]
    -   @rpch/sdk@1.2.2

## 0.8.1

### Patch Changes

-   Updated dependencies [e6fed45]
    -   @rpch/sdk@1.2.1

## 0.8.0

### Minor Changes

-   184fdaf: remove request limit

### Patch Changes

-   Updated dependencies [184fdaf]
    -   @rpch/sdk@1.2.0

## 0.7.1

### Patch Changes

-   Updated dependencies [827de28]
    -   @rpch/sdk@1.1.1

## 0.7.0

### Minor Changes

-   eaa424c: Http errors and crypto counter errors are now correctly returned by SDK

### Patch Changes

-   Updated dependencies [eaa424c]
    -   @rpch/sdk@1.1.0

## 0.6.3

### Patch Changes

-   better response logging

## 0.6.2

### Patch Changes

-   0d4c37e: allow zero hop params in rpc-server
-   Updated dependencies [0d4c37e]
    -   @rpch/sdk@1.0.0

## 0.6.1

### Patch Changes

-   cedc0e7: Allow huge incoming messages at RPC server level, not SDK level though

## 0.6.0

### Minor Changes

-   afe2ab0: Integrate MEV kickback for propellorheads

### Patch Changes

-   Updated dependencies [afe2ab0]
    -   @rpch/sdk@0.11.0

## 0.5.0

### Minor Changes

-   e65c12b: rpc server got an option to skip RPCh entirely - for testing and comparison purpose

### Patch Changes

-   Updated dependencies [e65c12b]
    -   @rpch/sdk@0.8.0

## 0.4.1

### Patch Changes

-   Fixed compilation handling

## 0.4.0

### Minor Changes

-   e691140: - changed default port to 45750
    -   added cors headers to allow using it locally, can be disabled with `RESTRICT_CORS`

### Patch Changes

-   Updated dependencies [e691140]
    -   @rpch/sdk@0.7.0

## 0.3.6

### Patch Changes

-   Change MEV_PROTECTION_PROVIDER logic and expose it to RPC_SERVER
-   Updated dependencies
    -   @rpch/sdk@0.6.2

## 0.3.5

### Patch Changes

-   Updated dependencies
    -   @rpch/sdk@0.6.1

## 0.3.4

### Patch Changes

-   Updated dependencies [333a830]
    -   @rpch/sdk@0.6.0

## 0.3.3

### Patch Changes

-   Updated dependencies [7633232]
    -   @rpch/sdk@0.5.2

## 0.3.2

### Patch Changes

-   Updated dependencies [b9e964b]
    -   @rpch/sdk@0.5.1

## 0.3.1

### Patch Changes

-   Updated dependencies [ed54216]
    -   @rpch/sdk@0.5.0

## 0.3.0

### Minor Changes

-   ae6ca99: RPCserver now behaves more like a JSON-RPC endpoint.
    It also exposes newly introduced per request parameters and SDK startup parmeters via env vars and request parameters.

### Patch Changes

-   6f9a67b: Fixed return code issues and JSON return values
-   Updated dependencies [6f9a67b]
-   Updated dependencies [ae6ca99]
    -   @rpch/sdk@0.4.0

## 0.2.0

### Minor Changes

-   191b247: Updates to support nodejs v18 and native fetch

### Patch Changes

-   Updated dependencies [191b247]
-   Updated dependencies [fc83313]
    -   @rpch/sdk@0.3.0

## 0.1.0

### Initial production version

-   Allow long running RPC server to handle RPCh requests.
