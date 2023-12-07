---
'@rpch/sdk': minor
---

Better highlight node fetching errors and mitigations. Specifically invalid client ids and no nodes available.
Allow SDK relay path specification (via `FORCE_MANUAL_RELAYING`) for request and response paths. This means the SDK determines quality peers with the help of the exit node to specify relays.
Fix an issue when the SDK would falsly report info response timeouts.
Repeatedly ask Discovery Platform for new nodes and update routes accordingly.
Fix an issue when decoding compressed info response from exit node.
