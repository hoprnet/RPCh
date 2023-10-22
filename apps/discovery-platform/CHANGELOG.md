# @rpch/discovery-platform

## 0.12.2

### Patch Changes

- e6fed45: fix type in validator

## 0.12.1

### Patch Changes

- eaa424c: fix last_segment_length reporting

## 0.12.0

### Minor Changes

- e8baa98: add configs table

## 0.11.0

### Minor Changes

- 0d4c37e: Change hop pairing routes endpoint to default one hop and allow zero hop

## 0.10.1

### Patch Changes

- 84bef2e: create boomfi associatins table

## 0.10.0

### Minor Changes

- Create webhook logs table

## 0.9.0

### Minor Changes

- Refactor packages and voucher handling
- Create default packages and vouchers

## 0.8.0

### Minor Changes

- 26e5292: enhance segment and request counting as well as report segment sizes for future optimization

## 0.7.0

### Minor Changes

- 9ad3401: add name column to client

## 0.6.1

### Patch Changes

- 7ca27e6: fix new user signup

## 0.6.0

### Minor Changes

- d3728dc: prepare db migrations for degen
- 326a86e: Add request and response quota tracking
  Add aggregation to monthly quota usage
  Replace token handling with better secret generation
  Create access tokens for exit nodes upon registration

### Patch Changes

- f1e4602: added mev information to user

## 0.5.5

### Patch Changes

- e691140: fixed error text'

## 0.5.4

### Patch Changes

- fix cookie issues

## 0.5.3

### Patch Changes

- fix cors cookie setting

## 0.5.2

### Patch Changes

- updated SIWE dep with further fixes

## 0.5.1

### Patch Changes

- updated SIWE dep

## 0.5.0

### Minor Changes

- 00f6de6: Add DP as backend for user onboarding

  - includes adding signup with google and ethereum
  - backend routes for creating RPCh ready clients

## 0.4.0

### Minor Changes

- 333a830: Reset and fix database migration and setup.
  Need admin authorization to register new nodes.
  Delivers zero hop pairings to SDK.

## 0.3.0

### Minor Changes

- 23f842a: Add quota_paid, quota_used columns

### Patch Changes

- a8f068f: Fixes issue where availability monitor could not reach HOPRd nodes in sandbox
- Updated dependencies [23f842a]
  - @rpch/common@0.4.0

## 0.2.0

### Minor Changes

- 191b247: Updates to support nodejs v18 and native fetch

### Patch Changes

- Updated dependencies [191b247]
- Updated dependencies [fc83313]
  - @rpch/common@0.3.0

## 0.1.0

### Initial production version

- Fix excludeList body parameter of entry node request.
