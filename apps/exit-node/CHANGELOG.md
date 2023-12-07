# @rpch/exit-node

## 1.1.0

### Minor Changes

-   978f729: Increase performance when sending large requests
    Fix manual relay node selection

### Patch Changes

-   Updated dependencies [978f729]
    -   @rpch/sdk@1.9.0

## 1.0.0

### Major Changes

-   85d02e3: Include relays in info response
    Better exit node logging

### Patch Changes

-   Updated dependencies [85d02e3]
-   Updated dependencies [655f519]
    -   @rpch/sdk@1.8.0

## 0.14.1

### Patch Changes

-   Updated dependencies
    -   @rpch/sdk@1.7.1

## 0.14.0

### Minor Changes

-   d2b7a70: Will determine available relays for responses.
    If request payload contains relay will choose this one or - if invalid - a random determined one.

### Patch Changes

-   d2b7a70: Fix opening multiple Websocket connections on hoprd restarts
-   Updated dependencies [d2b7a70]
    -   @rpch/sdk@1.7.0

## 0.13.2

### Patch Changes

-   Updated dependencies [cda0447]
    -   @rpch/sdk@1.6.0

## 0.13.1

### Patch Changes

-   fix info resp dangling response polling
    increase exit-node request purging timeout
-   Updated dependencies
    -   @rpch/sdk@1.5.3

## 0.13.0

### Minor Changes

-   crypto protocol update

### Patch Changes

-   Updated dependencies
    -   @rpch/sdk@1.5.0

## 0.12.0

### Minor Changes

-   d1479ea: use request uuid inside crypto box
    use determined exit node counter offset inside crypto counter as well
    better version output log

### Patch Changes

-   Updated dependencies [d1479ea]
    -   @rpch/sdk@1.4.0

## 0.11.0

### Minor Changes

-   34e0d18: Exit node now handles request ids and counters to reject duplicates.

### Patch Changes

-   Updated dependencies [34e0d18]
    -   @rpch/sdk@1.3.0

## 0.10.1

### Patch Changes

-   f3f9ee2: cleanup dependencies and consolidate formatting
-   Updated dependencies [f3f9ee2]
    -   @rpch/sdk@1.2.3

## 0.10.0

### Minor Changes

-   c5ae645: allow pong response to ping request

### Patch Changes

-   Updated dependencies [c5ae645]
    -   @rpch/sdk@1.2.2

## 0.9.3

### Patch Changes

-   e6fed45: fix timestamp accuracy to ms
-   Updated dependencies [e6fed45]
    -   @rpch/sdk@1.2.1

## 0.9.2

### Patch Changes

-   Updated dependencies [184fdaf]
    -   @rpch/sdk@1.2.0

## 0.9.1

### Patch Changes

-   827de28: Allow sender to determine return amount of hops
-   Updated dependencies [827de28]
    -   @rpch/sdk@1.1.1

## 0.9.0

### Minor Changes

-   eaa424c: Http errors and crypto counter errors are now correctly returned by SDK

### Patch Changes

-   Updated dependencies [eaa424c]
    -   @rpch/sdk@1.1.0

## 0.8.2

### Patch Changes

-   even better logging

## 0.8.1

### Patch Changes

-   better error logging

## 0.8.0

### Minor Changes

-   0d4c37e: enable one hop in exit node by default

### Patch Changes

-   Updated dependencies [0d4c37e]
    -   @rpch/sdk@1.0.0

## 0.7.0

### Minor Changes

-   afe2ab0: Integrate MEV kickback for propellorheads

### Patch Changes

-   Updated dependencies [afe2ab0]
    -   @rpch/sdk@0.11.0

## 0.6.0

### Minor Changes

-   26e5292: enhance segment and request counting as well as report segment sizes for future optimization

### Patch Changes

-   Updated dependencies [26e5292]
    -   @rpch/sdk@0.10.0

## 0.5.0

### Minor Changes

-   326a86e: Report quota usages to discovery platform

### Patch Changes

-   Updated dependencies [326a86e]
-   Updated dependencies [d3728dc]
    -   @rpch/sdk@0.9.0

## 0.4.0

### Minor Changes

-   e65c12b: exit node now uses sdk packages with default compression

### Patch Changes

-   Updated dependencies [e65c12b]
    -   @rpch/sdk@0.8.0

## 0.3.0

### Minor Changes

-   333a830: Exit node now handles api v3 hoprd node

## 0.2.1

### Patch Changes

-   Updated dependencies [23f842a]
    -   @rpch/common@0.4.0

## 0.2.0

### Minor Changes

-   191b247: Updates to support nodejs v18 and native fetch

### Patch Changes

-   Updated dependencies [191b247]
-   Updated dependencies [fc83313]
    -   @rpch/common@0.3.0

## 0.1.0

### Initial production version

-   handle incoming RPCh message and forward them to an RPCprovider
