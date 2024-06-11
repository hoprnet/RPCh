# @rpch/discovery-platform

## 2.0.4

### Patch Changes

-   Updated dependencies [c17e3b2]
-   Updated dependencies [c17e3b2]
    -   @rpch/sdk@3.1.0

## 2.0.3

### Patch Changes

-   Updated dependencies
    -   @rpch/sdk@3.0.1

## 2.0.2

### Patch Changes

-   c8db74a: Allow requests from all origins.

## 2.0.1

### Patch Changes

-   Removed obsolete packages

## 2.0.0

### Major Changes

-   a325843: No longer return config versions when fetching nodes.

### Minor Changes

-   a9f0740: Update routing query to prioritize exit nodes variety while trying to stay random as much as possible.
    Removed since parameter from routing query as it was never used correctly.
-   a325843: Expose config keys via API

### Patch Changes

-   Updated dependencies [b610049]
-   Updated dependencies [a325843]
    -   @rpch/sdk@3.0.0

## 1.2.1

### Patch Changes

-   2b919df: fix uses_left column migration
-   1995a92: update config keys for easier access

## 1.2.0

### Minor Changes

-   036c898: Added a new column in the vouchers table to have a possibility of limiting nubmer of voucher uses

### Patch Changes

-   Updated dependencies [00e3508]
    -   @rpch/sdk@2.0.3

## 1.1.4

### Patch Changes

-   Updated dependencies
    -   @rpch/sdk@2.0.2

## 1.1.3

### Patch Changes

-   Updated dependencies
    -   @rpch/sdk@2.0.1

## 1.1.2

### Patch Changes

-   Updated dependencies [af3a2e8]
-   Updated dependencies [af3a2e8]
    -   @rpch/sdk@2.0.0

## 1.1.1

### Patch Changes

-   Updated dependencies [3066770]
    -   @rpch/sdk@1.14.0

## 1.1.0

### Minor Changes

-   26ff588: Allow chainId reporting

### Patch Changes

-   Updated dependencies [26ff588]
    -   @rpch/sdk@1.13.0

## 1.0.6

### Patch Changes

-   Updated dependencies [b924905]
    -   @rpch/sdk@1.12.1

## 1.0.5

### Patch Changes

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

-   Updated dependencies [978f729]
    -   @rpch/sdk@1.9.0

## 1.0.0

### Major Changes

-   85d02e3: Elevate version to indicate stable production version

### Patch Changes

-   Updated dependencies [85d02e3]
-   Updated dependencies [655f519]
    -   @rpch/sdk@1.8.0

## 0.14.4

### Patch Changes

-   7504a6f: fix crash on invalid clientId report from exit node

## 0.14.3

### Patch Changes

-   626ea0e: Use correctly named configs key to determine rpc server version

## 0.14.2

### Patch Changes

-   Updated dependencies
    -   @rpch/sdk@1.7.1

## 0.14.1

### Patch Changes

-   Updated dependencies [d2b7a70]
    -   @rpch/sdk@1.7.0

## 0.14.0

### Minor Changes

-   458f598: wrap monthly quota usages into history table when applicable'
-   cda0447: expose versions on node pairs request

### Patch Changes

-   Updated dependencies [cda0447]
    -   @rpch/sdk@1.6.0

## 0.13.1

### Patch Changes

-   3de2d3d: redact secrets from startup log

## 0.13.0

### Minor Changes

-   d1479ea: use request uuid inside crypto box
    use determined exit node counter offset inside crypto counter as well
    better version output log

### Patch Changes

-   Updated dependencies [d1479ea]
    -   @rpch/sdk@1.4.0

## 0.12.6

### Patch Changes

-   fix migrations directory

## 0.12.5

### Patch Changes

-   fix container build

## 0.12.4

### Patch Changes

-   34e0d18: print version in startup log
-   Updated dependencies [34e0d18]
    -   @rpch/sdk@1.3.0

## 0.12.3

### Patch Changes

-   f3f9ee2: cleanup dependencies and consolidate formatting
-   Updated dependencies [f3f9ee2]
    -   @rpch/sdk@1.2.3

## 0.12.2

### Patch Changes

-   e6fed45: fix type in validator

## 0.12.1

### Patch Changes

-   eaa424c: fix last_segment_length reporting

## 0.12.0

### Minor Changes

-   e8baa98: add configs table

## 0.11.0

### Minor Changes

-   0d4c37e: Change hop pairing routes endpoint to default one hop and allow zero hop

## 0.10.1

### Patch Changes

-   84bef2e: create boomfi associatins table

## 0.10.0

### Minor Changes

-   Create webhook logs table

## 0.9.0

### Minor Changes

-   Refactor packages and voucher handling
-   Create default packages and vouchers

## 0.8.0

### Minor Changes

-   26e5292: enhance segment and request counting as well as report segment sizes for future optimization

## 0.7.0

### Minor Changes

-   9ad3401: add name column to client

## 0.6.1

### Patch Changes

-   7ca27e6: fix new user signup

## 0.6.0

### Minor Changes

-   d3728dc: prepare db migrations for degen
-   326a86e: Add request and response quota tracking
    Add aggregation to monthly quota usage
    Replace token handling with better secret generation
    Create access tokens for exit nodes upon registration

### Patch Changes

-   f1e4602: added mev information to user

## 0.5.5

### Patch Changes

-   e691140: fixed error text'

## 0.5.4

### Patch Changes

-   fix cookie issues

## 0.5.3

### Patch Changes

-   fix cors cookie setting

## 0.5.2

### Patch Changes

-   updated SIWE dep with further fixes

## 0.5.1

### Patch Changes

-   updated SIWE dep

## 0.5.0

### Minor Changes

-   00f6de6: Add DP as backend for user onboarding

    -   includes adding signup with google and ethereum
    -   backend routes for creating RPCh ready clients

## 0.4.0

### Minor Changes

-   333a830: Reset and fix database migration and setup.
    Need admin authorization to register new nodes.
    Delivers zero hop pairings to SDK.

## 0.3.0

### Minor Changes

-   23f842a: Add quota_paid, quota_used columns

### Patch Changes

-   a8f068f: Fixes issue where availability monitor could not reach HOPRd nodes in sandbox
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

-   Fix excludeList body parameter of entry node request.
