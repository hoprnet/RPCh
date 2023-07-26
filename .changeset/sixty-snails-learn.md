---
"@rpch/sdk": minor
"@rpch/common": patch
---

Refactored SDK for performance improvements specifically on incoming messages.

- removes needless array conversion on segment building
- correctly drops incoming segments that are not tied to a request
- remove needless async handling in compression module
