# @rpch/availability-monitor

## 1.1.13

### Patch Changes

-   Updated dependencies [17e8bf5]
    -   @rpch/sdk@4.0.0

## 1.1.12

### Patch Changes

-   Updated dependencies
    -   @rpch/sdk@3.1.1

## 1.1.11

### Patch Changes

-   Updated dependencies [c17e3b2]
-   Updated dependencies [c17e3b2]
    -   @rpch/sdk@3.1.0

## 1.1.10

### Patch Changes

-   Updated dependencies
    -   @rpch/sdk@3.0.1

## 1.1.9

### Patch Changes

-   Updated dependencies [b610049]
-   Updated dependencies [a325843]
    -   @rpch/sdk@3.0.0

## 1.1.8

### Patch Changes

-   d3332bb: better error log formatting

## 1.1.7

### Patch Changes

-   Updated dependencies [00e3508]
    -   @rpch/sdk@2.0.3

## 1.1.6

### Patch Changes

-   Updated dependencies
    -   @rpch/sdk@2.0.2

## 1.1.5

### Patch Changes

-   Updated dependencies
    -   @rpch/sdk@2.0.1

## 1.1.4

### Patch Changes

-   Updated dependencies [af3a2e8]
-   Updated dependencies [af3a2e8]
    -   @rpch/sdk@2.0.0

## 1.1.3

### Patch Changes

-   332f227: enhance logging output even more tailored to expected offline nodes

## 1.1.2

### Patch Changes

-   7d93775: fix log output typo

## 1.1.1

### Patch Changes

-   a5ca6c1: Enhance logging output to show problematic nodes and routes

## 1.1.0

### Minor Changes

-   5ab2871: handle offline nodes gracefully

## 1.0.9

### Patch Changes

-   972915e: Fix online exit application reporting
-   Updated dependencies [3066770]
    -   @rpch/sdk@1.14.0

## 1.0.8

### Patch Changes

-   Updated dependencies [26ff588]
    -   @rpch/sdk@1.13.0

## 1.0.7

### Patch Changes

-   f0572d1: Handle down nodes better in regards to zero / one hop routing.
-   Updated dependencies [f0572d1]
-   Updated dependencies [dbd5eaa]
    -   @rpch/sdk@1.12.2

## 1.0.6

### Patch Changes

-   Updated dependencies [b924905]
    -   @rpch/sdk@1.12.1

## 1.0.5

### Patch Changes

-   f085c2c: Slightly enhanced log output on routing errors
-   Updated dependencies [f085c2c]
-   Updated dependencies [f085c2c]
-   Updated dependencies [907e34b]
-   Updated dependencies [c507632]
-   Updated dependencies [3f3d6a9]
    -   @rpch/sdk@1.12.0

## 1.0.4

### Patch Changes

-   Updated dependencies [bee0cff]
    -   @rpch/sdk@1.11.0

## 1.0.3

### Patch Changes

-   Updated dependencies [8225d5c]
    -   @rpch/sdk@1.10.1

## 1.0.2

### Patch Changes

-   Updated dependencies [2c13794]
    -   @rpch/sdk@1.10.0

## 1.0.1

### Patch Changes

-   978f729: put slightly less load on nodes used for pinging
-   Updated dependencies [978f729]
    -   @rpch/sdk@1.9.0

## 1.0.0

### Major Changes

-   85d02e3: Correctly filter peers - channels from entry nodes to exit nodes and on the response path

### Patch Changes

-   85d02e3: fix logging output for one hop
-   Updated dependencies [85d02e3]
-   Updated dependencies [655f519]
    -   @rpch/sdk@1.8.0

## 0.8.1

### Patch Changes

-   Updated dependencies
    -   @rpch/sdk@1.7.1

## 0.8.0

### Minor Changes

-   d2b7a70: exclude offline exit nodes from one hop pairs as well

### Patch Changes

-   Updated dependencies [d2b7a70]
    -   @rpch/sdk@1.7.0

## 0.7.6

### Patch Changes

-   Updated dependencies [cda0447]
    -   @rpch/sdk@1.6.0

## 0.7.5

### Patch Changes

-   increasing error reporting even further

## 0.7.4

### Patch Changes

-   handle node json error in get peers call

## 0.7.3

### Patch Changes

-   consolidate logging

## 0.7.2

### Patch Changes

-   better log output

## 0.7.1

### Patch Changes

-   3de2d3d: redact secrets from startup log

## 0.7.0

### Minor Changes

-   d1479ea: use request uuid inside crypto box
    use determined exit node counter offset inside crypto counter as well
    better version output log

### Patch Changes

-   Updated dependencies [d1479ea]
    -   @rpch/sdk@1.4.0

## 0.6.3

### Patch Changes

-   34e0d18: print version in startup log
-   Updated dependencies [34e0d18]
    -   @rpch/sdk@1.3.0

## 0.6.2

### Patch Changes

-   f3f9ee2: cleanup dependencies and consolidate formatting
-   Updated dependencies [f3f9ee2]
    -   @rpch/sdk@1.2.3

## 0.6.1

### Patch Changes

-   fix accidental comment

## 0.6.0

### Minor Changes

-   c5ae645: Determine if exit-nodes are online for zero-hops

### Patch Changes

-   Updated dependencies [c5ae645]
    -   @rpch/sdk@1.2.2

## 0.5.1

### Patch Changes

-   better logging

## 0.5.0

### Minor Changes

-   ab541f9: Gather one hops alongside zero hops

### Patch Changes

-   Updated dependencies [84bef2e]
    -   @rpch/discovery-platform@0.10.1

## 0.4.0

### Minor Changes

-   Consolidated env vars

## 0.3.1

### Patch Changes

-   Fixed route aggregation bug

## 0.3.0

### Minor Changes

-   333a830: stripped AM to only determine zero hop quality and report results to db
-   333a830: Determines zero hop routes by references entry and exit nodes' peers.
    No longer runs any other checks for now.

### Patch Changes

-   Updated dependencies [333a830]
    -   @rpch/discovery-platform@0.4.0

## 0.2.0

### Minor Changes

-   23f842a: Add quota_paid, quota_used columns

### Patch Changes

-   a8f068f: Fixes issue where availability monitor could not reach HOPRd nodes in sandbox
-   Updated dependencies [a8f068f]
-   Updated dependencies [23f842a]
    -   @rpch/discovery-platform@0.3.0
    -   @rpch/common@0.4.0

## 0.1.0

### Minor Changes

-   191b247: Updates to support nodejs v18 and native fetch

### Patch Changes

-   06e9585: Fix freezing queue bug
-   Updated dependencies [191b247]
-   Updated dependencies [fc83313]
    -   @rpch/discovery-platform@0.2.0
    -   @rpch/common@0.3.0

## 0.0.1

### Patch Changes

-   Updated dependencies
    -   @rpch/common@0.2.3
    -   @rpch/discovery-platform@0.0.8
