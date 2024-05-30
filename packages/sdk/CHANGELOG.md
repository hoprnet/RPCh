# @rpch/sdk

## 3.0.1

### Patch Changes

-   Fix route selection logic in uHTTP

## 3.0.0

### Major Changes

-   a325843: Remove exposed SDK utilities as they were moved to phttp. Use phttp as transport handler.

### Minor Changes

-   b610049: remove since param from nodes query and improve offline error message

## 2.0.3

### Patch Changes

-   00e3508: Fix default header content-type

## 2.0.2

### Patch Changes

-   update compatible node version for manual relaying

## 2.0.1

### Patch Changes

-   Update relay versions to currently working 1hop version

## 2.0.0

### Major Changes

-   af3a2e8: Changes SDK send function return response.
    No longer offers async resolvers for json and text.
    Response contains attributes for server status, statusCode and headers.
    Text property can now be used to parse as JSON.

### Minor Changes

-   af3a2e8: Consolidated latency metrics env vars.
    RPC server now only exposes `RPCH_LATENCY_STATS` to retrieve additional metrics from the logs.

## 1.14.0

### Minor Changes

-   3066770: Update default RPC provider on Gnosis chain

## 1.13.0

### Minor Changes

-   26ff588: Report chainId for provider with request payload

## 1.12.2

### Patch Changes

-   f0572d1: Decrease some too verbose info log messages.
-   dbd5eaa: fallback to non crypto uuid generation

## 1.12.1

### Patch Changes

-   b924905: Fixed latency stats naming

## 1.12.0

### Minor Changes

-   f085c2c: Update transmission protocol to work with private HTTP
-   907e34b: Allow arbitrary headers on construction and during requests.
    Try chainId fetching from starknet if eth fetching fails.

### Patch Changes

-   f085c2c: Add sane timeout values to all node related communication
-   c507632: Enhance chainId parsing to allow hex and dec numbers
-   3f3d6a9: Fix provider and request header tracking to reflect actual usage

## 1.11.0

### Minor Changes

-   bee0cff: Allow requesting latency tracking from exit node
    Fix time measurements throughout the sdk making them clock independent

## 1.10.1

### Patch Changes

-   8225d5c: route chain id request through RPCh instead of directly calling it

## 1.10.0

### Minor Changes

-   2c13794: Rename DEBUG_LEVEL to LOG_LEVEL to avoid conflicts with bash logger inside RPC server container

## 1.9.0

### Minor Changes

-   978f729: Increase performance of sending large requests
    Fix impact of relay handling when not using manual relaying

## 1.8.0

### Minor Changes

-   85d02e3: Better highlight node fetching errors and mitigations. Specifically invalid client ids and no nodes available.
    Allow SDK relay path specification (via `FORCE_MANUAL_RELAYING`) for request and response paths. This means the SDK determines quality peers with the help of the exit node to specify relays.
    Fix an issue when the SDK would falsly report info response timeouts.
    Repeatedly ask Discovery Platform for new nodes and update routes accordingly.
    Fix an issue when decoding compressed info response from exit node.

### Patch Changes

-   655f519: Expose `DEBUG_LEVEL` in RPC server and allow debugLevel ops parameter in SDK.
    This will set a minimal debug level and can be used in addition with scope to better control logging output.
    SDK and RPC-Server now default to `info` log level.
    Will only use default log level if `DEBUG` is not set.

## 1.7.1

### Patch Changes

-   fix exit nodes compats

## 1.7.0

### Minor Changes

-   d2b7a70: Correctly determine info ping latency.
    Determine potential relays for 1hop messages.
    Force manual relaying only via env var.

## 1.6.0

### Minor Changes

-   cda0447: inform user about version mismatches and improve logging

## 1.5.3

### Patch Changes

-   fix info resp dangling response polling
    increase exit-node request purging timeout

## 1.5.2

### Patch Changes

-   better timeout logs

## 1.5.1

### Patch Changes

-   fix zero hop info req

## 1.5.0

### Minor Changes

-   crypto protocol update

## 1.4.0

### Minor Changes

-   d1479ea: use request uuid inside crypto box
    use determined exit node counter offset inside crypto counter as well
    better version output log

### Patch Changes

-   Updated dependencies [d1479ea]
    -   @rpch/compat-crypto@0.7.0

## 1.3.0

### Minor Changes

-   34e0d18: SDK now sends unique request id to adhere to updated crypto protocol
    SDK will utilize new info request message from exit nodes to determine routes

### Patch Changes

-   Updated dependencies [34e0d18]
    -   @rpch/compat-crypto@0.6.0

## 1.2.4

### Patch Changes

-   10eb627: making crypto module browser compatible
-   fb64847: fix missing dependency resolution
-   Updated dependencies [10eb627]
    -   @rpch/compat-crypto@0.5.3

## 1.2.3

### Patch Changes

-   f3f9ee2: cleanup dependencies and consolidate formatting
-   Updated dependencies [f3f9ee2]
    -   @rpch/compat-crypto@0.5.1

## 1.2.2

### Patch Changes

-   c5ae645: consolidated NodeAPI functions here

## 1.2.1

### Patch Changes

-   e6fed45: fix timestamp accuracy to ms

## 1.2.0

### Minor Changes

-   184fdaf: remove request limit

## 1.1.1

### Patch Changes

-   827de28: Allow sender to determine return amount of hops

## 1.1.0

### Minor Changes

-   eaa424c: Http errors and crypto counter errors are now correctly returned by SDK

### Patch Changes

-   Updated dependencies [eaa424c]
    -   @rpch/compat-crypto@0.5.0

## 1.0.0

### Major Changes

-   0d4c37e: Implement one hop by default and hide zero hop behind feature flag

## 0.11.0

### Minor Changes

-   afe2ab0: Integrate MEV kickback for propellorheads

## 0.10.0

### Minor Changes

-   26e5292: enhance segment and request counting as well as report segment sizes for future optimization

## 0.9.0

### Minor Changes

-   326a86e: Report quota usages to discovery platform
-   d3728dc: Use LZ compression before sending requests

## 0.8.0

### Minor Changes

-   e65c12b: sdk used default compression

## 0.7.0

### Minor Changes

-   e691140: - be more verbose about failing Discovery Platform requests
    -   handle MEV PROTECTION better by checking for correct chainId
    -   allow explicit MEV PROTECTION disable in SDK

## 0.6.2

### Patch Changes

-   Change MEV_PROTECTION_PROVIDER logic and expose it to RPC_SERVER

## 0.6.1

### Patch Changes

-   distribute load evenly among available routes

## 0.6.0

### Minor Changes

-   333a830: Implemented new algorithm enabled by api v3.
    The SDK no longer needs a websocket connection.
    It will ping entry nodes that are received from the DP
    for best initial route and keep tracking those entry exit pairs for perfomance.

## 0.5.2

### Patch Changes

-   7633232: correctly handling msgpack unpack errors

## 0.5.1

### Patch Changes

-   b9e964b: Minor bug fixes in the SDK
    Update load tests with smaller values and different distributions

## 0.5.0

### Minor Changes

-   ed54216: Rework node selection algorithm:

    -   query initial fixed amount of entry nodes (e.g. 10)
    -   open websockets to all, determine best connection
    -   close other connections
    -   use determined routes as long as feasible
    -   repeat

    Resending requests on fallback route if possible:

    -   if request on preferred entry-exit combination does not work,
        we try resending it on the second best one

### Patch Changes

-   Updated dependencies [23f842a]
    -   @rpch/common@0.4.0

## 0.4.0

### Minor Changes

-   6f9a67b: Changed the SDK approach to only have one websocket open to one entry node
-   ae6ca99: Refactored send API to take and return structured data.
    Change counter store to a per session store.

## 0.3.0

### Minor Changes

-   191b247: Updates to support nodejs v18 and native fetch
-   fc83313: Refactored SDK for performance improvements specifically on incoming messages.

    -   removes needless array conversion on segment building
    -   correctly drops incoming segments that are not tied to a request
    -   remove needless async handling in compression module

### Patch Changes

-   Updated dependencies [191b247]
-   Updated dependencies [fc83313]
    -   @rpch/common@0.3.0

## 0.2.3

### Patch Changes

-   Introduce parallel entry nodes & improve reliability score
-   Updated dependencies
    -   @rpch/common@0.2.3

## 0.2.2

### Patch Changes

-   Improved entry node re-selection
-   Updated dependencies
    -   @rpch/common@0.2.2

## 0.2.1

### Patch Changes

-   Updated dependencies
    -   @rpch/common@0.2.1

## 0.2.0

### Minor Changes

-   Introduce compression and many stability improvements

### Patch Changes

-   Updated dependencies
    -   @rpch/common@0.2.0

## 0.1.7

### Patch Changes

-   Use @rpch/crypto v0.3.4
-   Updated dependencies
    -   @rpch/common@0.1.7

## 0.1.6

### Patch Changes

-   Preparation release for Alpha
-   Updated dependencies
    -   @rpch/crypto-bridge@0.1.6
    -   @rpch/common@0.1.6

## 0.1.5

### Patch Changes

-   Fix publishing bug
-   Updated dependencies
    -   @rpch/crypto-bridge@0.1.5
    -   @rpch/common@0.1.5

## 0.1.4

### Patch Changes

-   Release of Sandbox v2
-   Updated dependencies
    -   @rpch/crypto-bridge@0.1.4
    -   @rpch/common@0.1.4

## 0.1.3

### Patch Changes

-   Updated dependencies
    -   @rpch/crypto-bridge@0.1.3
    -   @rpch/common@0.1.3

## 0.1.2

### Patch Changes

-   Introduce web compatibility and various improvements.
-   Updated dependencies
    -   @rpch/crypto-bridge@0.1.2
    -   @rpch/common@0.1.2

## 0.1.1

### Patch Changes

-   43ba0b5: Minor patch to test publishing
-   Updated dependencies [43ba0b5]
    -   @rpch/common@0.1.1
    -   @rpch/crypto-bridge@0.1.1

## 0.1.0

### Minor Changes

-   9d40520: Initial release of RPCh packages

### Patch Changes

-   Updated dependencies [9d40520]
    -   @rpch/common@0.1.0
    -   @rpch/crypto-bridge@0.1.0
