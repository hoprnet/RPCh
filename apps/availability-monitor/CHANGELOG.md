# @rpch/availability-monitor

## 0.5.0

### Minor Changes

- ab541f9: Gather one hops alongside zero hops

### Patch Changes

- Updated dependencies [84bef2e]
  - @rpch/discovery-platform@0.10.1

## 0.4.0

### Minor Changes

- Consolidated env vars

## 0.3.1

### Patch Changes

- Fixed route aggregation bug

## 0.3.0

### Minor Changes

- 333a830: stripped AM to only determine zero hop quality and report results to db
- 333a830: Determines zero hop routes by references entry and exit nodes' peers.
  No longer runs any other checks for now.

### Patch Changes

- Updated dependencies [333a830]
  - @rpch/discovery-platform@0.4.0

## 0.2.0

### Minor Changes

- 23f842a: Add quota_paid, quota_used columns

### Patch Changes

- a8f068f: Fixes issue where availability monitor could not reach HOPRd nodes in sandbox
- Updated dependencies [a8f068f]
- Updated dependencies [23f842a]
  - @rpch/discovery-platform@0.3.0
  - @rpch/common@0.4.0

## 0.1.0

### Minor Changes

- 191b247: Updates to support nodejs v18 and native fetch

### Patch Changes

- 06e9585: Fix freezing queue bug
- Updated dependencies [191b247]
- Updated dependencies [fc83313]
  - @rpch/discovery-platform@0.2.0
  - @rpch/common@0.3.0

## 0.0.1

### Patch Changes

- Updated dependencies
  - @rpch/common@0.2.3
  - @rpch/discovery-platform@0.0.8
