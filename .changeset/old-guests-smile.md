---
'@rpch/rpc-server': patch
'@rpch/sdk': patch
---

Expose `DEBUG_LEVEL` in RPC server and allow debugLevel ops parameter in SDK.
This will set a minimal debug level and can be used in addition with scope to better control logging output.
SDK and RPC-Server now default to `info` log level.
