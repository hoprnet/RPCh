# @rpch/discovery-platform

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
